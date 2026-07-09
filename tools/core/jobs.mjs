// tools/core/jobs.mjs — the server-side job queue behind /__editor/jobs and
// the headless auto-pilot (docs/CHARACTER_STUDIO.md §2.4). Named jobs with
// dependencies, pooled concurrency, live progress events (the vite adapter
// turns them into SSE), per-job cost accounting, and persistence across
// server restarts. Workers must be idempotent/resumable — the gen:* scripts
// already are (skip-existing), so an interrupted job simply re-queues.
// Plain ESM, no deps.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LOG_CAP = 400; // in-memory lines per job (full log streams to <id>.log)

export class JobRunner {
  /**
   * @param {object} opts
   * @param {string} opts.dir persistence directory (e.g. assets/raw/jobs)
   * @param {Record<string, (job, api) => Promise<void>>} opts.workers by job kind
   * @param {number} [opts.concurrency] jobs in flight at once
   */
  constructor({ dir, workers, concurrency = 2 }) {
    this.dir = dir;
    this.workers = workers;
    this.concurrency = concurrency;
    this.jobs = new Map();
    this.subs = new Set();
    this.running = 0;
    this.seq = 0;
    this.persistTimer = null;
    this.idleResolvers = [];
    mkdirSync(dir, { recursive: true });
    this.load();
    queueMicrotask(() => this.tick()); // resume any re-queued (interrupted) jobs
  }

  statePath() {
    return join(this.dir, 'state.json');
  }

  /** resume across server restarts: interrupted running jobs re-queue */
  load() {
    if (!existsSync(this.statePath())) return;
    try {
      const saved = JSON.parse(readFileSync(this.statePath(), 'utf8'));
      for (const j of saved.jobs ?? []) {
        if (j.status === 'running') { j.status = 'queued'; j.startedAt = undefined; }
        this.jobs.set(j.id, j);
      }
      this.seq = saved.seq ?? this.jobs.size;
    } catch (e) {
      console.warn(`  jobs: could not load ${this.statePath()} — starting fresh (${String(e).slice(0, 80)})`);
    }
  }

  persist() {
    clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      try {
        mkdirSync(this.dir, { recursive: true });
        const jobs = [...this.jobs.values()].map((j) => ({ ...j, log: j.log.slice(-40) }));
        writeFileSync(this.statePath(), JSON.stringify({ seq: this.seq, jobs }, null, 2));
      } catch { /* best-effort — persistence never takes down the queue */ }
    }, 250);
    this.persistTimer.unref?.();
  }

  /** @param {(ev: {type:string}) => void} fn */
  subscribe(fn) {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  emit(ev) {
    for (const fn of this.subs) {
      try { fn(ev); } catch { /* a dead subscriber never blocks the queue */ }
    }
  }

  publicJob(j) {
    return { ...j, log: j.log.slice(-20) };
  }

  list() {
    return [...this.jobs.values()].map((j) => this.publicJob(j));
  }

  /** enqueue one job. deps are job IDS (see enqueueDag for key-based specs). */
  enqueue({ kind, label, char, payload = {}, deps = [], estCost = {} }) {
    if (!this.workers[kind]) throw new Error(`jobs: no worker for kind "${kind}"`);
    const id = `j${(this.seq++).toString(36).padStart(4, '0')}`;
    const job = {
      id, kind, label: label ?? kind, char, payload, deps, estCost,
      status: 'queued', log: [], cost: {}, createdAt: Date.now(),
    };
    this.jobs.set(id, job);
    this.emit({ type: 'job', job: this.publicJob(job) });
    this.persist();
    queueMicrotask(() => this.tick());
    return job;
  }

  /** enqueue a DAG: specs carry a local `key` and reference dep KEYS —
   *  translated to job ids here. Returns jobs in spec order. */
  enqueueDag(specs) {
    const byKey = new Map();
    const out = [];
    for (const spec of specs) {
      const deps = (spec.deps ?? []).map((k) => {
        const dep = byKey.get(k);
        if (!dep) throw new Error(`jobs: dag spec "${spec.key}" depends on unknown key "${k}"`);
        return dep.id;
      });
      const job = this.enqueue({ ...spec, deps });
      byKey.set(spec.key, job);
      out.push(job);
    }
    return out;
  }

  cancel(id) {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (job.status === 'queued') {
      job.status = 'cancelled';
      job.endedAt = Date.now();
      this.emit({ type: 'job', job: this.publicJob(job) });
      this.persist();
      this.tick();
      return true;
    }
    if (job.status === 'running') {
      job.cancelRequested = true;
      job._kill?.();
      return true;
    }
    return false;
  }

  /** resolves when nothing is queued or running (the CLI's exit condition) */
  idle() {
    if (!this.busy()) return Promise.resolve();
    return new Promise((res) => this.idleResolvers.push(res));
  }

  busy() {
    return this.running > 0 || [...this.jobs.values()].some((j) => j.status === 'queued');
  }

  depState(job) {
    let allDone = true;
    for (const d of job.deps) {
      const dep = this.jobs.get(d);
      if (!dep) continue;
      if (dep.status === 'error' || dep.status === 'cancelled' || dep.status === 'skipped') return 'blocked';
      if (dep.status !== 'done') allDone = false;
    }
    return allDone ? 'ready' : 'waiting';
  }

  tick() {
    for (const job of this.jobs.values()) {
      if (job.status !== 'queued') continue;
      const state = this.depState(job);
      if (state === 'blocked') {
        job.status = 'skipped';
        job.error = 'a dependency failed or was cancelled';
        job.endedAt = Date.now();
        this.emit({ type: 'job', job: this.publicJob(job) });
        this.persist();
        continue;
      }
      if (state !== 'ready' || this.running >= this.concurrency) continue;
      void this.run(job);
    }
    if (!this.busy()) {
      for (const res of this.idleResolvers.splice(0)) res();
    }
  }

  async run(job) {
    this.running++;
    job.status = 'running';
    job.startedAt = Date.now();
    this.emit({ type: 'job', job: this.publicJob(job) });
    const api = {
      log: (line) => {
        job.log.push(line);
        if (job.log.length > LOG_CAP) job.log.splice(0, job.log.length - LOG_CAP);
        try { appendFileSync(join(this.dir, `${job.id}.log`), line + '\n'); } catch { /* log file is best-effort */ }
        this.emit({ type: 'log', id: job.id, line });
      },
      cost: (patch) => {
        for (const [k, v] of Object.entries(patch)) job.cost[k] = (job.cost[k] ?? 0) + v;
        this.emit({ type: 'cost', id: job.id, cost: job.cost });
      },
      onCancel: (fn) => { job._kill = fn; },
      isCancelled: () => !!job.cancelRequested,
    };
    try {
      await this.workers[job.kind](job, api);
      job.status = job.cancelRequested ? 'cancelled' : 'done';
    } catch (e) {
      job.status = job.cancelRequested ? 'cancelled' : 'error';
      job.error = String(e?.message ?? e).slice(0, 500);
    } finally {
      delete job._kill;
      job.endedAt = Date.now();
      this.running--;
      this.emit({ type: 'job', job: this.publicJob(job) });
      this.persist();
      this.tick();
    }
  }
}
