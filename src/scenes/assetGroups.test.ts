// P6.1 / P6.2: the AssetLoader core against a stub Phaser loader — dedupe, per-
// file settle, error paths, and the "never hangs" guarantee that replaced the
// Versus screen's 12 s cap.
import { describe, expect, it } from 'vitest';
import { AssetGroups, prefetchAllowed, prefetchUrls, RETRY_AFTER_MS, type LoaderPort } from './assetGroups';
import { fighterFiles, stageFiles, stageThumbFiles, type AssetFile } from './assetQueue';

/** a fake LoaderPlugin: files queue up; the test lands/fails them by key */
class FakeLoader implements LoaderPort {
  cache = new Set<string>();
  added: AssetFile[] = [];
  pending: AssetFile[] = [];
  loading = false;
  starts = 0;
  private handlers: Record<string, ((...a: never[]) => void)[]> = {};
  cached(f: AssetFile): boolean { return this.cache.has(f.key); }
  add(f: AssetFile): void { this.added.push(f); this.pending.push(f); }
  isLoading(): boolean { return this.loading; }
  start(): void {
    this.starts++;
    this.loading = true;
    if (this.pending.length === 0) this.drain();
  }
  on(ev: string, fn: (...a: never[]) => void): void { (this.handlers[ev] ??= []).push(fn); }
  private emit(ev: string, ...a: unknown[]): void { for (const h of this.handlers[ev] ?? []) (h as (...x: unknown[]) => void)(...a); }
  private take(key: string): AssetFile {
    const i = this.pending.findIndex((f) => f.key === key);
    if (i < 0) throw new Error(`not pending: ${key}`);
    return this.pending.splice(i, 1)[0];
  }
  private drain(): void { if (this.pending.length === 0) { this.loading = false; this.emit('complete'); } }
  land(key: string): void { const f = this.take(key); this.cache.add(key); this.emit('filecomplete', key, f.kind); this.drain(); }
  fail(key: string): void { const f = this.take(key); this.emit('loaderror', { key, type: f.kind }); this.drain(); }
  /** downloaded but never produced an event (decode error) */
  silentlyDrop(key: string): void { this.take(key); this.drain(); }
  landAll(): void { for (const f of [...this.pending]) this.land(f.key); }
}

const files = (...keys: string[]): (() => AssetFile[]) => () => keys.map((key) => ({ kind: 'image' as const, key, url: `${key}.png` }));
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('AssetGroups (one persistent loader, per-file settle)', () => {
  it('dedupes: concurrent + repeat requests for a group cost one load', async () => {
    const g = new AssetGroups();
    const L = new FakeLoader();
    g.attach(L);
    const a = g.ensure('sprite-x', files('sheet-x', 'meta-x'));
    const b = g.ensure('sprite-x', files('sheet-x', 'meta-x'));
    expect(a).toBe(b);
    await flush();
    expect(L.added.map((f) => f.key)).toEqual(['sheet-x', 'meta-x']);
    L.landAll();
    expect(await a).toBe(true);
    expect(await g.ensure('sprite-x', files('sheet-x', 'meta-x'))).toBe(true);
    expect(L.added).toHaveLength(2);
    expect(g.status('sprite-x')).toBe('done');
  });

  it('resolves per file — does not wait for unrelated files on the same loader', async () => {
    const g = new AssetGroups();
    const L = new FakeLoader();
    g.attach(L);
    let stageDone = false;
    void g.ensure('stage-a', files('bg-a')).then(() => { stageDone = true; });
    void g.ensure('fat-x', files('fat-1', 'fat-2'));
    await flush();
    L.land('bg-a');
    await flush();
    expect(stageDone).toBe(true); // fatality panels still in flight
    expect(L.isLoading()).toBe(true);
  });

  it('a file that 404s settles the group false instead of hanging', async () => {
    const g = new AssetGroups();
    const L = new FakeLoader();
    g.attach(L);
    const p = g.ensure('vo-x', files('v1', 'v2'));
    await flush();
    L.land('v1');
    L.fail('v2');
    expect(await p).toBe(false);
    expect(g.status('vo-x')).toBe('idle');
  });

  it('a file that never reports (decode failure) settles when the loader drains', async () => {
    const g = new AssetGroups();
    const L = new FakeLoader();
    g.attach(L);
    const p = g.ensure('sprite-y', files('sheet-y'));
    await flush();
    L.silentlyDrop('sheet-y');
    expect(await p).toBe(false);
  });

  it('a failed group is not re-requested every frame, but retries after a cooldown', async () => {
    let now = 0;
    const g = new AssetGroups(() => {}, () => now);
    const L = new FakeLoader();
    g.attach(L);
    const p = g.ensure('sprite-z', files('sheet-z'));
    await flush();
    L.fail('sheet-z');
    await p;
    expect(await g.ensure('sprite-z', files('sheet-z'))).toBe(false);
    expect(L.added).toHaveLength(1);
    now += RETRY_AFTER_MS;
    const retry = g.ensure('sprite-z', files('sheet-z'));
    await flush();
    expect(L.added).toHaveLength(2);
    L.land('sheet-z');
    expect(await retry).toBe(true);
  });

  it('a shared file is downloaded once and awaited by both groups (thumb ⊂ stage)', async () => {
    const g = new AssetGroups();
    const L = new FakeLoader();
    g.attach(L);
    const thumb = g.ensure('thumb-a', files('bg-a'));
    await flush();
    const stage = g.ensure('stage-a', files('bg-a', 'bg-wide-a'));
    await flush();
    expect(L.added.map((f) => f.key)).toEqual(['bg-a', 'bg-wide-a']);
    L.land('bg-wide-a');
    let stageDone = false;
    void stage.then(() => { stageDone = true; });
    await flush();
    expect(stageDone).toBe(false); // still needs bg-a, which the thumb queued
    L.land('bg-a');
    expect(await thumb).toBe(true);
    expect(await stage).toBe(true);
  });

  it('already-cached files resolve without touching the loader', async () => {
    const g = new AssetGroups();
    const L = new FakeLoader();
    L.cache.add('bg-a');
    g.attach(L);
    expect(await g.ensure('stage-a', files('bg-a'))).toBe(true);
    expect(L.added).toHaveLength(0);
    expect(L.starts).toBe(0);
  });

  it('requests made before the host scene attaches wait for it, then load', async () => {
    const g = new AssetGroups();
    const p = g.ensure('sprite-x', files('sheet-x'));
    const L = new FakeLoader();
    await flush();
    g.attach(L);
    await flush();
    L.landAll();
    expect(await p).toBe(true);
  });

  it('highlight → immediate lock → Versus, repeated: one load per key, nothing waits', async () => {
    const g = new AssetGroups();
    const L = new FakeLoader();
    g.attach(L);
    for (let round = 0; round < 3; round++) {
      const reqs = [
        g.ensure('sprite-ben', files('sheet-ben', 'meta-ben')), // select highlight
        g.ensure('vo-ben', files('v-ben-1')),                   // lock-in
        g.ensure('sprite-ben', files('sheet-ben', 'meta-ben')), // Versus
        g.ensure('stage-dojo', files('bg-dojo')),               // Versus
        g.ensure('sprite-ben', files('sheet-ben', 'meta-ben')), // FightScene.preload
      ];
      await flush();
      if (round === 0) L.landAll();
      expect(await Promise.all(reqs)).toEqual([true, true, true, true, true]);
    }
    expect(L.added.map((f) => f.key).sort()).toEqual(['bg-dojo', 'meta-ben', 'sheet-ben', 'v-ben-1']);
  });
});

describe('asset file lists', () => {
  it('fighter/stage URLs are content-versioned (P6.6)', () => {
    const sheet = fighterFiles('vincent').find((f) => f.key === 'sheet-vincent');
    expect(sheet?.url).toMatch(/^assets\/sprites\/vincent\/sheet\.png\?v=[0-9a-f]{8}$/);
    expect(sheet?.kind).toBe('spritesheet');
    for (const f of stageFiles('dojo')) expect(f.url).toMatch(/\?v=[0-9a-f]{8}$/);
  });

  it('the stage thumbnail is only the 21:9 art', () => {
    expect(stageThumbFiles('dojo').map((f) => f.key)).toEqual(['bg-stage-dojo']);
    expect(stageFiles('dojo').map((f) => f.key)).toContain('bg-stage-wide-dojo');
  });
});

describe('prefetch (HTTP cache only)', () => {
  it('fetches each URL once with bounded concurrency, holds while paused, skips decoded', async () => {
    let inFlight = 0;
    let peak = 0;
    const got: string[] = [];
    let paused = true;
    let sleeps = 0;
    const run = prefetchUrls(['a', 'b', 'a', 'c', 'd', 'skip-me'], {
      concurrency: 2,
      paused: () => paused,
      sleep: async () => { sleeps++; paused = sleeps < 3; },
      skip: (u) => u === 'skip-me',
      fetchOne: async (u) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await flush();
        got.push(u);
        inFlight--;
        if (u === 'c') throw new Error('network');
      },
    });
    expect(await run).toBe(3); // a, b, d (c failed, skip-me skipped)
    expect(got.sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(peak).toBe(2);
    expect(sleeps).toBeGreaterThanOrEqual(3);
  });

  it('is skipped on data-saver and coarse-pointer devices', () => {
    expect(prefetchAllowed({ connection: { saveData: true } }, false)).toBe(false);
    expect(prefetchAllowed({}, true)).toBe(false);
    expect(prefetchAllowed({ connection: { saveData: false } }, false)).toBe(true);
    expect(prefetchAllowed(undefined, false)).toBe(true);
  });
});

describe('eviction (decoded-memory budget)', () => {
  it('drops finished groups not kept, never a file a kept group shares, then reloads on demand', async () => {
    const g = new AssetGroups();
    const L = new FakeLoader();
    g.attach(L);
    const all = [
      g.ensure('sprite-a', files('sheet-a')),
      g.ensure('sprite-b', files('sheet-b')),
      g.ensure('thumb-s', files('bg-s')),
      g.ensure('stage-s', files('bg-s', 'bg-wide-s')),
      g.ensure('vo-a', files('v-a')),
    ];
    await flush();
    L.landAll();
    await Promise.all(all);
    const dropped: string[] = [];
    const ev = g.evict(['sprite-a', 'stage-s'], ['sprite-', 'stage-', 'thumb-'], (f) => { dropped.push(f.key); L.cache.delete(f.key); });
    expect(ev.sort()).toEqual(['sprite-b', 'thumb-s']);
    expect(dropped).toEqual(['sheet-b']); // bg-s is still used by stage-s; VO untouched
    expect(g.status('sprite-b')).toBe('idle');
    const again = g.ensure('sprite-b', files('sheet-b'));
    await flush();
    L.landAll();
    expect(await again).toBe(true);
  });
});
