// core/jobs.mjs — the job runner behind /__editor/jobs and studio:run.
// Synthetic in-memory workers (no child processes, no network).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { JobRunner, type Job, type JobApi } from '../../tools/core/jobs.mjs';

const dirs: string[] = [];
const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'mk-jobs-'));
  dirs.push(d);
  return d;
};
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('JobRunner', () => {
  it('runs a DAG in dependency order with pooled concurrency', async () => {
    const order: string[] = [];
    const runner = new JobRunner({
      dir: tmp(),
      concurrency: 2,
      workers: { t: async (job: Job) => { order.push(job.label); await wait(5); } },
    });
    runner.enqueueDag([
      { key: 'a', kind: 't', label: 'a' },
      { key: 'b', kind: 't', label: 'b' },
      { key: 'c', kind: 't', label: 'c', deps: ['a', 'b'] },
    ]);
    await runner.idle();
    expect(order).toHaveLength(3);
    expect(order[2]).toBe('c'); // c strictly after both deps
    expect(runner.list().every((j) => j.status === 'done')).toBe(true);
  });

  it('skips dependents when a dependency errors', async () => {
    const runner = new JobRunner({
      dir: tmp(),
      workers: { t: async (job: Job) => { if (job.label === 'boom') throw new Error('boom'); } },
    });
    runner.enqueueDag([
      { key: 'boom', kind: 't', label: 'boom' },
      { key: 'after', kind: 't', label: 'after', deps: ['boom'] },
      { key: 'free', kind: 't', label: 'free' },
    ]);
    await runner.idle();
    const byLabel = Object.fromEntries(runner.list().map((j) => [j.label, j.status]));
    expect(byLabel).toEqual({ boom: 'error', after: 'skipped', free: 'done' });
  });

  it('accounts cost and streams log lines to subscribers', async () => {
    const runner = new JobRunner({
      dir: tmp(),
      workers: { t: async (_job: Job, api: JobApi) => { api.log('wrote x'); api.cost({ assetsWritten: 1 }); api.cost({ assetsWritten: 2 }); } },
    });
    const lines: string[] = [];
    runner.subscribe((ev) => { if (ev.type === 'log') lines.push(ev.line); });
    const job = runner.enqueue({ kind: 't', label: 'cost' });
    await runner.idle();
    expect(lines).toContain('wrote x');
    expect(job.cost.assetsWritten).toBe(3);
  });

  it('persists state and re-queues interrupted running jobs on load', async () => {
    const dir = tmp();
    const a = new JobRunner({ dir, workers: { t: async () => wait(5) } });
    const done = a.enqueue({ kind: 't', label: 'finished' });
    await a.idle();
    // simulate a crash mid-job: hand-mark a persisted job as running
    done.status = 'running';
    a.persist();
    await wait(400); // let the debounced persist flush
    const b = new JobRunner({ dir, workers: { t: async () => undefined } });
    expect(b.list().find((j) => j.label === 'finished')?.status).toBe('queued');
    await b.idle();
    expect(b.list().find((j) => j.label === 'finished')?.status).toBe('done');
  });

  it('cancels queued jobs and skips their dependents', async () => {
    let ran = 0;
    const runner = new JobRunner({
      dir: tmp(),
      concurrency: 1,
      workers: { t: async () => { ran++; await wait(20); } },
    });
    const [, second, third] = runner.enqueueDag([
      { key: 'run', kind: 't', label: 'run' },
      { key: 'axe', kind: 't', label: 'axe' },
      { key: 'child', kind: 't', label: 'child', deps: ['axe'] },
    ]);
    runner.cancel(second.id);
    await runner.idle();
    expect(ran).toBe(1);
    expect(second.status).toBe('cancelled');
    expect(third.status).toBe('skipped');
  });
});
