// The dedupe/settle core of AssetLoader, kept free of Phaser so it can be unit-
// tested with a stub loader (assetGroups.test.ts). AssetLoader wires it to ONE
// persistent scene's loader (AssetHostScene) — P6.1.
//
// Why per-file, and why one loader: the old ensure() resolved on the CALLING
// scene's loader COMPLETE. Phaser's LoaderPlugin.shutdown removes every
// listener, so a scene that stopped mid-download (Select → Versus before a
// ~7 MB sheet landed) left its promise pending forever — and every later
// Versus with that fighter waited out a 12 s cap. Now every file is loaded on
// a loader that never shuts down, and each group settles when ITS files have
// each either landed (`filecomplete`) or failed (`loaderror`, or still missing
// when the loader drains — e.g. an image that downloaded but failed to decode).
import type { AssetFile } from './assetQueue';

/** the slice of Phaser's LoaderPlugin + caches the core needs */
export interface LoaderPort {
  /** already in the game-global texture/json/audio cache? */
  cached(f: AssetFile): boolean;
  /** queue one file on the persistent loader */
  add(f: AssetFile): void;
  isLoading(): boolean;
  start(): void;
  /** subscribe to the loader's 'filecomplete' (key, type), 'loaderror' (file)
   *  and 'complete' events — once, for the life of the game */
  on(event: 'filecomplete', fn: (key: string, type: string) => void): void;
  on(event: 'loaderror', fn: (file: { key: string; type: string }) => void): void;
  on(event: 'complete', fn: () => void): void;
}

export type GroupLog = (kind: 'load' | 'done' | 'hit' | 'fail', key: string, extra?: string) => void;

/** a failed group may be retried after this long (a 404 shouldn't re-request
 *  every frame; a transient mobile drop shouldn't cost the whole session) */
export const RETRY_AFTER_MS = 10_000;

/** Phaser's loader `type` for each descriptor kind (what 'filecomplete' reports) */
const TYPE: Record<AssetFile['kind'], string> = {
  image: 'image', spritesheet: 'spritesheet', json: 'json', audio: 'audio',
};
const fileId = (type: string, key: string): string => `${type}:${key}`;

export class AssetGroups {
  /** groups fully in cache */
  readonly done = new Set<string>();
  private readonly inflight = new Map<string, Promise<boolean>>();
  private readonly failedAt = new Map<string, number>();
  /** the files each requested group asked for (for eviction) */
  private readonly groupFiles = new Map<string, AssetFile[]>();
  /** per-file waiters, keyed `type:key` — shared, so two groups needing the
   *  same file (stage thumb ⊂ stage) both wait on the one download */
  private readonly waiters = new Map<string, ((ok: boolean) => void)[]>();
  private port: LoaderPort | null = null;
  private readonly portReady: Promise<LoaderPort>;
  private resolvePort!: (p: LoaderPort) => void;

  constructor(
    private readonly log: GroupLog = () => {},
    private readonly clock: () => number = () => Date.now(),
  ) {
    this.portReady = new Promise((r) => { this.resolvePort = r; });
  }

  /** bind the persistent loader (once). Requests made before this wait for it. */
  attach(port: LoaderPort): void {
    if (this.port) return;
    this.port = port;
    port.on('filecomplete', (key, type) => this.settle(fileId(type, key), true));
    port.on('loaderror', (file) => this.settle(fileId(file.type, file.key), false));
    // the loader drained: anything still waiting never produced an event
    // (a decode/process failure, or a file the loader refused) — fail it so no
    // group can hang
    port.on('complete', () => {
      for (const id of [...this.waiters.keys()]) this.settle(id, false);
    });
    this.resolvePort(port);
  }

  get attached(): boolean {
    return this.port !== null;
  }

  /** is this group already in cache (or in flight)? */
  status(key: string): 'done' | 'loading' | 'idle' {
    if (this.done.has(key)) return 'done';
    return this.inflight.has(key) ? 'loading' : 'idle';
  }

  /** Ensure a named group of files is in cache. Resolves true when every file
   *  landed, false if any failed — it ALWAYS settles. Concurrent calls for the
   *  same group share one promise; a finished group never re-queues. */
  ensure(key: string, files: () => AssetFile[]): Promise<boolean> {
    if (this.done.has(key)) return Promise.resolve(true);
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const failed = this.failedAt.get(key);
    if (failed !== undefined && this.clock() - failed < RETRY_AFTER_MS) return Promise.resolve(false);

    const p = (this.port ? Promise.resolve(this.port) : this.portReady).then((port) => {
      const list = files();
      this.groupFiles.set(key, list);
      return this.run(port, key, list);
    });
    this.inflight.set(key, p);
    return p;
  }

  private run(port: LoaderPort, key: string, files: AssetFile[]): Promise<boolean> {
    const missing = files.filter((f) => !port.cached(f));
    if (missing.length === 0) {
      this.finish(key, true);
      this.log('hit', key);
      return Promise.resolve(true);
    }
    const t0 = this.clock();
    this.log('load', key, `(${missing.length} file${missing.length === 1 ? '' : 's'})`);
    const waits = missing.map((f) => {
      const id = fileId(TYPE[f.kind], f.key);
      const queued = this.waiters.has(id);
      const w = new Promise<boolean>((res) => {
        const list = this.waiters.get(id) ?? [];
        list.push(res);
        this.waiters.set(id, list);
      });
      // a file another group already queued is awaited, not re-added
      if (!queued) port.add(f);
      return w;
    });
    if (!port.isLoading()) port.start();
    return Promise.all(waits).then((oks) => {
      const ok = oks.every(Boolean);
      this.finish(key, ok);
      this.log(ok ? 'done' : 'fail', key, `${Math.round(this.clock() - t0)}ms`);
      return ok;
    });
  }

  /** Free the decoded memory of finished groups that are no longer needed:
   *  every DONE group whose key starts with one of `prefixes` and isn't in
   *  `keep` is dropped (it reloads — from the HTTP cache — if requested again).
   *  A file shared with a kept or in-flight group (stage thumb ⊂ stage) is
   *  left alone. Returns the evicted group keys. */
  evict(keep: Iterable<string>, prefixes: string[], drop: (f: AssetFile) => void): string[] {
    const keepSet = new Set(keep);
    const live = new Set<string>();
    for (const [k, files] of this.groupFiles) {
      if (keepSet.has(k) || this.inflight.has(k)) for (const f of files) live.add(f.key);
    }
    const evicted: string[] = [];
    for (const k of [...this.done]) {
      if (keepSet.has(k) || !prefixes.some((p) => k.startsWith(p))) continue;
      for (const f of this.groupFiles.get(k) ?? []) if (!live.has(f.key)) drop(f);
      this.done.delete(k);
      this.groupFiles.delete(k);
      evicted.push(k);
    }
    return evicted;
  }

  private finish(key: string, ok: boolean): void {
    this.inflight.delete(key);
    if (ok) {
      this.done.add(key);
      this.failedAt.delete(key);
    } else {
      this.failedAt.set(key, this.clock());
    }
  }

  private settle(id: string, ok: boolean): void {
    const list = this.waiters.get(id);
    if (!list) return;
    this.waiters.delete(id);
    for (const res of list) res(ok);
  }
}

// ── background prefetch: warm the HTTP cache, decode NOTHING (P6.2) ─────────
// The old sweep pushed every sheet through the Phaser loader, i.e. decoded all
// of them into GPU textures (~28 MB RGBA each, ~520 MB for the roster) while the
// player sat on the menu — a tab-crash risk on phones. Now the sweep only
// fetch()es the bytes at low priority so the later on-demand decode (select
// highlight / Versus) is a cache hit, with ≤ 2 requests in flight and a pause
// while a fight is running (no network/GC contention mid-match).

export interface PrefetchOpts {
  concurrency: number;
  /** true while prefetch should hold (a fight is on) — polled between files */
  paused: () => boolean;
  /** download + drain one URL (rejects are swallowed) */
  fetchOne: (url: string) => Promise<unknown>;
  /** wait helper while paused (injectable for tests) */
  sleep?: (ms: number) => Promise<void>;
  /** skip a URL (already decoded / in flight) — checked right before fetching */
  skip?: (url: string) => boolean;
}

/** fetch every URL once, in order, `concurrency` at a time. Never rejects. */
export async function prefetchUrls(urls: string[], o: PrefetchOpts): Promise<number> {
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const seen = new Set<string>();
  const queue = urls.filter((u) => (seen.has(u) ? false : (seen.add(u), true)));
  let i = 0;
  let fetched = 0;
  const worker = async (): Promise<void> => {
    while (i < queue.length) {
      while (o.paused()) await sleep(1000);
      const url = queue[i++];
      if (o.skip?.(url)) continue;
      try {
        await o.fetchOne(url);
        fetched++;
      } catch { /* keep sweeping — a miss just loads on demand later */ }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, o.concurrency) }, worker));
  return fetched;
}

/** Should this device skip the background sweep entirely? Data-saver users
 *  and touch-first devices (phones/tablets: small caches, metered data) load
 *  on demand only. */
export function prefetchAllowed(nav: { connection?: { saveData?: boolean } } | undefined, coarsePointer: boolean): boolean {
  if (nav?.connection?.saveData) return false;
  return !coarsePointer;
}
