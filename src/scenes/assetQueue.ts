// Per-fighter / per-stage asset QUEUE helpers, shared by BootScene (essential
// boot set) and assetLoader (lazy load-on-demand). Each helper queues only the
// files that AREN'T already in the texture/audio/json cache and returns how many
// it queued — so callers can skip starting the loader when nothing is missing,
// and re-requesting an already-loaded group is a cheap no-op. Mirrors the file
// keys/paths BootScene used to load up front, so nothing downstream changes.
import Phaser from 'phaser';
import { characters } from '../data/characters';
import { ROSTER } from '../data/roster';
import { STAGES } from '../data/stages';
import assetManifest from '../data/assetManifest.json';
import { CELL_H, CELL_W } from '../render/coords';

// VO exists only for the playable roster (the asset audit guarantees it). A
// 404'd mp3 decodes to an uncaught EncodingError — NOT harmless like a missing
// PNG — so we never request VO for an id outside this set (e.g. a WIP Studio
// draft under construction). This mirrors BootScene's old playable-only gate.
const VO_FIGHTERS = new Set(ROSTER.filter((r) => r.playable).map((r) => r.id));

// A fighter carries as many kiai/hurt/victory clips as its `vo` arrays declare
// (real-recording fighters carry more), defaulting to 6/6/4.
export const VOICE_COUNTS = { kiai: 6, hurt: 6, victory: 4 } as const;
export function voiceCount(charId: string, cat: keyof typeof VOICE_COUNTS): number {
  return characters[charId]?.vo?.[cat]?.length ?? VOICE_COUNTS[cat];
}

/** which optional/drift-prone per-move art actually exists on disk */
const HAS = {
  legacyProj: new Set<string>(assetManifest.legacyProj),
  moveProj: new Set(assetManifest.moveProj),
  moveBurst: new Set(assetManifest.moveBurst),
  moveVfx: new Set(assetManifest.moveVfx),
};
const stageById = new Map(STAGES.map((s) => [s.id, s]));

/** head icon + side bust + defeated bust — the select grid / VS / win screen.
 *  Small (~4 MB for the whole roster); loaded at boot. */
export function queueFighterPortraits(scene: Phaser.Scene, id: string): number {
  let n = 0;
  const img = (key: string, url: string): void => {
    if (!scene.textures.exists(key)) { scene.load.image(key, url); n++; }
  };
  img(`portrait-${id}`, `assets/portraits/${id}.png`);
  img(`bust-${id}`, `assets/portraits/${id}-bust.png`);
  img(`portrait-ko-${id}`, `assets/portraits/${id}-ko.png`);
  return n;
}

/** the packed sheet + meta + per-move projectile/VFX art — the heavy per-fighter
 *  payload (~7 MB each). Lazy: loaded when a fighter is highlighted/selected. */
export function queueFighterSprite(scene: Phaser.Scene, id: string): number {
  let n = 0;
  if (!scene.textures.exists(`sheet-${id}`)) {
    scene.load.spritesheet(`sheet-${id}`, `assets/sprites/${id}/sheet.png`, { frameWidth: CELL_W, frameHeight: CELL_H });
    n++;
  }
  if (!scene.cache.json.exists(`meta-${id}`)) { scene.load.json(`meta-${id}`, `assets/sprites/${id}/meta.json`); n++; }
  if (HAS.legacyProj.has(id) && !scene.textures.exists(`proj-${id}`)) {
    scene.load.image(`proj-${id}`, `assets/sprites/${id}/projectile.png`); n++;
  }
  for (const [moveId, mv] of Object.entries(characters[id]?.moves ?? {})) {
    const ref = `${id}/${moveId}`;
    if (mv.projectile && HAS.moveProj.has(ref) && !scene.textures.exists(`proj-${id}-${moveId}`)) {
      scene.load.image(`proj-${id}-${moveId}`, `assets/sprites/${id}/projectile-${moveId}.png`); n++;
      if (mv.projectile.detonate && HAS.moveBurst.has(ref) && !scene.textures.exists(`proj-${id}-${moveId}-burst`)) {
        scene.load.image(`proj-${id}-${moveId}-burst`, `assets/sprites/${id}/projectile-${moveId}-burst.png`); n++;
      }
    }
    if (mv.vfx && HAS.moveVfx.has(ref) && !scene.textures.exists(`vfx-${id}-${moveId}`)) {
      scene.load.image(`vfx-${id}-${moveId}`, `assets/sprites/${id}/vfx-${moveId}.png`); n++;
    }
  }
  return n;
}

/** every kiai/hurt/victory clip (by count) + per-move call-outs. Lazy: loaded
 *  when a fighter is locked in (they're picking the other fighter / stage). */
export function queueFighterVO(scene: Phaser.Scene, id: string): number {
  if (!VO_FIGHTERS.has(id)) return 0; // no VO on disk — requesting it would 404-throw
  let n = 0;
  const aud = (key: string, url: string): void => {
    if (!scene.cache.audio.exists(key)) { scene.load.audio(key, url); n++; }
  };
  for (const cat of Object.keys(VOICE_COUNTS) as (keyof typeof VOICE_COUNTS)[]) {
    for (let i = 1; i <= voiceCount(id, cat); i++) aud(`v-${id}-${cat}-${i}`, `assets/audio/voice/${id}-${cat}-${i}.mp3`);
  }
  for (const [moveId, mv] of Object.entries(characters[id]?.moves ?? {})) {
    if (mv.voice) aud(`v-${id}-move-${moveId}`, `assets/audio/voice/${id}-move-${moveId}.mp3`);
  }
  return n;
}

/** the 4 cutscene panels. Lazy: loaded in the background DURING the fight (not
 *  needed until FINISH HIM at match end). */
export function queueFighterFatality(scene: Phaser.Scene, id: string): number {
  const fat = characters[id]?.fatality;
  if (!fat) return 0;
  let n = 0;
  for (let k = 1; k <= fat.panels; k++) {
    const key = `fat-${id}-${fat.id}-${k}`;
    if (!scene.textures.exists(key)) { scene.load.image(key, `assets/fatalities/${id}/${fat.id}-${k}.jpg`); n++; }
  }
  return n;
}

/** the stage background (+ parallax layers). Lazy: loaded when a stage is chosen. */
export function queueStage(scene: Phaser.Scene, stageId: string): number {
  const st = stageById.get(stageId);
  if (!st) return 0;
  let n = 0;
  const img = (key: string, url: string): void => {
    if (!scene.textures.exists(key)) { scene.load.image(key, url); n++; }
  };
  img(`bg-stage-${st.id}`, st.file);
  if (st.layers?.sky) img(`bg-stage-${st.id}-sky`, st.layers.sky.file);
  if (st.layers?.far) img(`bg-stage-${st.id}-far`, st.layers.far.file);
  if (st.layers?.near) img(`bg-stage-${st.id}-near`, st.layers.near.file);
  if (st.layers?.floor) img(`bg-stage-${st.id}-floor`, st.layers.floor.file);
  return n;
}
