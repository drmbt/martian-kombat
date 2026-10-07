// Lazy asset loader — the seam that keeps boot small. BootScene loads only the
// light "you're in the menu" set (portraits/UI/sparks/SFX/announcer); the heavy
// per-fighter sheets, per-stage backgrounds, VO and fatality panels are pulled
// on demand through here as the player moves select → versus → fight.
//
// ONE loader (P6.1): every on-demand load runs on the persistent, never-stopped
// AssetHostScene's loader, so a scene that shuts down mid-download can't strand
// a promise. Groups are deduped and settle per file (see assetGroups.ts) — a
// fighter requested from the select highlight, the lock-in, Versus and
// FightScene.preload costs ONE download, and every request always settles.
//
// Background prefetch (P6.2) only warms the HTTP cache — it never decodes.
import Phaser from 'phaser';
import { ROSTER } from '../data/roster';
import { STAGES } from '../data/stages';
import {
  addToLoader,
  fatalityFiles,
  fighterFiles,
  fileCached,
  stageFiles,
  stageThumbFiles,
  voFiles,
  type AssetFile,
} from './assetQueue';
import { AssetGroups, prefetchAllowed, prefetchUrls } from './assetGroups';

// ── dev/inspector visibility ────────────────────────────────────────────────
// Every group logs when it starts a real download, when it lands (with elapsed
// ms), and when it was already in cache (a "hit" — nothing fetched). A repeat
// fight with the same fighters should log ONLY hits: a second "load" for the
// same key is a genuine re-download bug. `window.__mkAssets()` lists what's in.
function logAsset(kind: 'load' | 'done' | 'hit' | 'fail', key: string, extra = ''): void {
  const tag = { load: '↓ load ', done: '✓ ready', hit: '· cache', fail: '✗ FAIL ' }[kind];
  // eslint-disable-next-line no-console
  console.info(`[MK assets] ${tag} ${key}${extra ? '  ' + extra : ''}`);
}

const groups = new AssetGroups(logAsset, () => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
let host: Phaser.Scene | null = null;
let prefetchStarted = false;

if (typeof window !== 'undefined') {
  (window as unknown as { __mkAssets?: () => Record<string, string[]> }).__mkAssets = () => {
    const by: Record<string, string[]> = { sprite: [], vo: [], fat: [], stage: [], thumb: [] };
    for (const k of groups.done) {
      const dash = k.indexOf('-');
      (by[k.slice(0, dash)] ??= []).push(k.slice(dash + 1));
    }
    return by;
  };
}

/** how long one file may take before the loader gives up on it (XHR timeout).
 *  Generous — a 7 MB sheet on a slow mobile link is ~20-60 s — but finite, so a
 *  stalled connection fails the group (retryable) instead of hanging it. */
const FILE_TIMEOUT_MS = 90_000;

/** prefetch requests in flight at once */
const PREFETCH_CONCURRENCY = 2;

/** scenes during which the background sweep holds (fight + its warm-up) */
const BUSY_SCENES = ['Versus', 'Fight', 'Fight3D'];

const ensure = (key: string, files: () => AssetFile[]): Promise<void> =>
  groups.ensure(key, files).then(() => undefined);

/** A loader "file" that completes when a promise settles — lets a scene's
 *  preload() block create() on AssetLoader groups that are loading on the
 *  persistent host loader (so the scene never double-downloads them). */
class BarrierFile extends Phaser.Loader.File {
  private readonly wait: Promise<unknown>;
  constructor(loader: Phaser.Loader.LoaderPlugin, key: string, wait: Promise<unknown>) {
    super(loader, { type: 'mkbarrier', key, url: 'mk-barrier' });
    this.wait = wait;
  }
  override load(): void {
    const next = (): void => this.loader.nextFile(this, true);
    this.wait.then(next, next);
  }
  override onProcess(): void {
    this.onProcessComplete();
  }
  override addToCache(): void { /* nothing to cache */ }
}
let barrierSeq = 0;

export const AssetLoader = {
  /** Bind the persistent loader. Called once by AssetHostScene.create(). */
  attach(scene: Phaser.Scene): void {
    if (host) return;
    host = scene;
    scene.load.xhr.timeout = FILE_TIMEOUT_MS;
    const load = scene.load;
    groups.attach({
      cached: (f) => fileCached(scene, f),
      add: (f) => addToLoader(load, f),
      isLoading: () => load.isLoading(),
      start: () => load.start(),
      on: (ev: string, fn: (...a: never[]) => void) => { load.on(ev, fn); },
    } as Parameters<AssetGroups['attach']>[0]);
  },

  /** heavy sheet + meta + per-move art — call on select highlight / lock-in */
  fighter: (id: string): Promise<void> => ensure(`sprite-${id}`, () => fighterFiles(id)),

  /** kiai/hurt/victory + move call-outs — call on lock-in */
  fighterVO: (id: string): Promise<void> => ensure(`vo-${id}`, () => voFiles(id)),

  /** fatality cutscene panels — call in the background DURING the fight */
  fatality: (id: string): Promise<void> => ensure(`fat-${id}`, () => fatalityFiles(id)),

  /** stage background + wide art + parallax layers — call on stage select */
  stage: (id: string): Promise<void> => ensure(`stage-${id}`, () => stageFiles(id)),

  /** only the 21:9 art the CHOOSE STAGE grid shows as a thumbnail */
  stageThumb: (id: string): Promise<void> => ensure(`thumb-${id}`, () => stageThumbFiles(id)),

  /** Free decoded memory (P6.2): drop every finished fighter-sheet / stage /
   *  fatality group except `keep` (group keys, e.g. `sprite-ben`). Each sheet
   *  is ~28 MB of RGBA, so without this every attract-mode demo and every
   *  fighter browsed on Select stays resident for the session. Call only where
   *  nothing on screen still shows the dropped art — a fight's preload (the
   *  previous scenes are gone) or Select (keeping what its previews show).
   *  Dropped groups reload from the HTTP cache on demand. */
  retainOnly(keep: string[], kinds: ('sprite' | 'stage' | 'thumb' | 'fat')[] = ['sprite', 'stage', 'thumb', 'fat']): void {
    if (!host) return;
    const game = host.game;
    const evicted = groups.evict(keep, kinds.map((k) => `${k}-`), (f) => {
      if (f.kind === 'json') game.cache.json.remove(f.key);
      else if (f.kind === 'audio') game.cache.audio.remove(f.key);
      else if (game.textures.exists(f.key)) game.textures.remove(f.key);
      // FightScene's per-cell drop-shadow bakes derive from the sheet
      if (f.kind === 'spritesheet') {
        const prefix = `shadow-${f.key.slice('sheet-'.length)}-`;
        for (const k of game.textures.getTextureKeys()) if (k.startsWith(prefix)) game.textures.remove(k);
      }
    });
    if (evicted.length) logAsset('hit', 'evicted', evicted.join(' '));
  },

  /** Block `scene`'s create() until these AssetLoader requests settle (call
   *  from preload()). Instant when they're already in cache. */
  barrier(scene: Phaser.Scene, keys: string[], wait: Promise<unknown>): void {
    if (keys.every((k) => groups.status(k) === 'done')) return;
    scene.load.addFile(new BarrierFile(scene.load, `mk-barrier-${++barrierSeq}`, wait));
  },

  /** Background prefetch of the WHOLE game into the HTTP cache, in priority
   *  order — started once from the host after boot. Decodes nothing: the
   *  player's highlight/lock/Versus requests decode on demand (a cache hit once
   *  the sweep has passed that file). Skipped on data-saver and touch devices;
   *  holds while a fight is on; ≤ 2 requests in flight. */
  prefetchAll(): void {
    if (prefetchStarted || !host) return;
    prefetchStarted = true;
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    if (!prefetchAllowed(typeof navigator !== 'undefined' ? (navigator as never) : undefined, coarse)) {
      logAsset('hit', 'prefetch', 'skipped (data saver / touch device)');
      return;
    }
    const scene = host;
    const playable = ROSTER.filter((r) => r.playable).map((r) => r.id);
    const stages = STAGES.map((s) => s.id);
    // stage thumbnails (CHOOSE STAGE grid) → fighter sheets (select idles) →
    // full stage art → in-fight audio → finisher art
    const files: AssetFile[] = [
      ...stages.flatMap(stageThumbFiles),
      ...playable.flatMap(fighterFiles),
      ...stages.flatMap(stageFiles),
      ...playable.flatMap(voFiles),
      ...playable.flatMap(fatalityFiles),
    ];
    const byUrl = new Map(files.map((f) => [f.url, f]));
    const t0 = performance.now();
    void prefetchUrls([...byUrl.keys()], {
      concurrency: PREFETCH_CONCURRENCY,
      paused: () => BUSY_SCENES.some((k) => scene.game.scene.isActive(k)),
      skip: (url) => { const f = byUrl.get(url); return !!f && fileCached(scene, f); },
      fetchOne: (url) =>
        fetch(url, { priority: 'low' } as RequestInit).then((r) => (r.ok ? r.arrayBuffer() : null)),
    }).then((n) => logAsset('done', 'prefetch', `${n} files warmed in ${Math.round((performance.now() - t0) / 1000)}s`));
  },
};
