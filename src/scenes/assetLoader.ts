// Lazy asset loader — the seam that keeps boot small. BootScene now loads only
// the light "you're in the menu" set (portraits/UI/sparks/SFX/announcer); the
// heavy per-fighter sheets, per-stage backgrounds, VO, and fatality panels are
// pulled on demand through here as the player moves select → versus → fight.
//
// Phaser's texture/audio/json caches are GAME-GLOBAL (not per-scene), so a file
// loaded through ANY active scene's loader is visible everywhere afterward. We
// dedupe by group key: an in-flight or finished group is never re-queued, so
// calling ensureFighter('vincent') from both the select highlight AND the versus
// screen costs one download.
import Phaser from 'phaser';
import { ROSTER } from '../data/roster';
import { STAGES } from '../data/stages';
import {
  queueFighterFatality,
  queueFighterSprite,
  queueFighterVO,
  queueStage,
} from './assetQueue';

const done = new Set<string>();
const inflight = new Map<string, Promise<void>>();
let prefetchStarted = false;

// ── dev/inspector visibility ────────────────────────────────────────────────
// Every group logs when it starts a real download, when it lands (with elapsed
// ms), and when it was already on disk (a "hit" — no bytes fetched). A repeat
// fight with the same fighters should log ONLY hits: if you ever see "load" for
// a fighter you already used this session, that's a genuine re-download bug.
// `window.__mkAssets()` in the console prints what's been pulled locally.
const now = (): number => (typeof performance !== 'undefined' ? performance.now() : 0);
function logAsset(kind: 'load' | 'done' | 'hit', key: string, extra = ''): void {
  const tag = kind === 'load' ? '↓ load ' : kind === 'done' ? '✓ ready' : '· cache';
  // eslint-disable-next-line no-console
  console.info(`[MK assets] ${tag} ${key}${extra ? '  ' + extra : ''}`);
}
if (typeof window !== 'undefined') {
  (window as unknown as { __mkAssets?: () => Record<string, string[]> }).__mkAssets = () => {
    const by: Record<string, string[]> = { sprite: [], vo: [], fat: [], stage: [] };
    for (const k of done) {
      const dash = k.indexOf('-');
      const type = k.slice(0, dash);
      const id = k.slice(dash + 1);
      (by[type] ??= []).push(id);
    }
    return by;
  };
}

/**
 * Ensure a named group of files is in the global cache. `queue` adds the missing
 * files to the scene loader and returns how many it queued; if none, we resolve
 * immediately without touching the loader. Concurrent groups share the loader's
 * batch — the COMPLETE event drains them all, so each group resolves once every
 * queued file (its own included) has landed.
 */
function ensure(scene: Phaser.Scene, key: string, queue: (s: Phaser.Scene) => number): Promise<void> {
  if (done.has(key)) return Promise.resolve();
  const pending = inflight.get(key);
  if (pending) return pending;

  const p = new Promise<void>((resolve) => {
    const queued = queue(scene);
    if (queued === 0) { done.add(key); logAsset('hit', key); resolve(); return; }
    const t0 = now();
    logAsset('load', key, `(${queued} file${queued === 1 ? '' : 's'})`);
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      done.add(key);
      inflight.delete(key);
      logAsset('done', key, `${Math.round(now() - t0)}ms`);
      resolve();
    });
    if (!scene.load.isLoading()) scene.load.start();
  });
  inflight.set(key, p);
  return p;
}

export const AssetLoader = {
  /** heavy sheet + meta + per-move art — call on select highlight / lock-in */
  fighter: (scene: Phaser.Scene, id: string): Promise<void> =>
    ensure(scene, `sprite-${id}`, (s) => queueFighterSprite(s, id)),

  /** kiai/hurt/victory + move call-outs — call on lock-in */
  fighterVO: (scene: Phaser.Scene, id: string): Promise<void> =>
    ensure(scene, `vo-${id}`, (s) => queueFighterVO(s, id)),

  /** fatality cutscene panels — call in the background DURING the fight */
  fatality: (scene: Phaser.Scene, id: string): Promise<void> =>
    ensure(scene, `fat-${id}`, (s) => queueFighterFatality(s, id)),

  /** stage background + parallax layers — call on stage select */
  stage: (scene: Phaser.Scene, id: string): Promise<void> =>
    ensure(scene, `stage-${id}`, (s) => queueStage(s, id)),

  /** already resolved (or resolvable without a download)? — lets callers avoid
   *  awaiting when everything's cached (e.g. reopening a fighter) */
  ready: (key: string): boolean => done.has(key),

  /** Background prefetch of the WHOLE game, in priority order, kicked off once
   *  from a PERSISTENT scene (the Volume overlay) right after boot. Runs on that
   *  scene's own loader so it survives Boot→Menu→Select→Fight transitions.
   *
   *  On-demand selection loads (highlight → sheet, lock → VO, pick → stage) run
   *  on the ACTIVE scene's loader instead, and because everything is deduped by
   *  the global `done`/`inflight` maps, a selection that this background sweep
   *  hasn't reached yet just loads immediately on the active loader — i.e. the
   *  player's pick always preempts the bulk prefetch. Tiers load high-value
   *  interactive art first (idles + thumbnails), fight-only art last. */
  prefetchAll: (scene: Phaser.Scene): void => {
    if (prefetchStarted) return;
    prefetchStarted = true;
    const playable = ROSTER.filter((r) => r.playable).map((r) => r.id);
    const stages = STAGES.map((s) => s.id);
    void (async () => {
      // stage-picker thumbnails first — small (~1 MB each), so the CHOOSE STAGE
      // grid fills fast without much delaying the sheets behind it
      await tier(scene, stages, (s, id) => AssetLoader.stage(s, id), 6);
      // idle sprites for the select sidebar — the heavy art (~7 MB each)
      await tier(scene, playable, (s, id) => AssetLoader.fighter(s, id), 4);
      // in-fight audio + finisher art — needed later, so lowest priority
      await tier(scene, playable, (s, id) => AssetLoader.fighterVO(s, id), 3);
      await tier(scene, playable, (s, id) => AssetLoader.fatality(s, id), 3);
    })();
  },
};

/** Load a list of ids through `load`, at most `concurrency` in flight. Errors are
 *  swallowed and each load is capped by ASSET_TIMEOUT_MS, so neither a bad nor a
 *  hung asset can stall the sweep (and thus block the lower-priority tiers). */
const ASSET_TIMEOUT_MS = 20000;
async function tier(
  scene: Phaser.Scene,
  ids: string[],
  load: (scene: Phaser.Scene, id: string) => Promise<void>,
  concurrency: number,
): Promise<void> {
  let i = 0;
  const worker = async (): Promise<void> => {
    while (i < ids.length) {
      const id = ids[i++];
      // bail if the host scene died (shouldn't — it's persistent — but be safe)
      if (!scene.sys || !scene.sys.isActive()) return;
      try {
        await Promise.race([
          load(scene, id),
          new Promise<void>((res) => setTimeout(res, ASSET_TIMEOUT_MS)),
        ]);
      } catch { /* keep sweeping */ }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}
