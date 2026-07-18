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
import {
  queueFighterFatality,
  queueFighterSprite,
  queueFighterVO,
  queueStage,
} from './assetQueue';

const done = new Set<string>();
const inflight = new Map<string, Promise<void>>();

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
    if (queued === 0) { done.add(key); resolve(); return; }
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      done.add(key);
      inflight.delete(key);
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
};
