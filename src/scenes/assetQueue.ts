// Per-fighter / per-stage asset FILE LISTS, shared by BootScene (essential boot
// set) and assetLoader (lazy load-on-demand + HTTP-cache prefetch). Each group
// is plain data — `{ kind, key, url }` descriptors — so the same list drives the
// Phaser loader (decode into the texture/audio/json cache), the background
// prefetch (a low-priority fetch() that only warms the HTTP cache), and tests.
// Every URL is content-versioned (assetUrl, P6.6) so media can be cached
// immutable. Keys/paths are what BootScene used to load up front.
import type Phaser from 'phaser';
import { assetUrl } from '../data/assetUrl';
import { characters } from '../data/characters';
import { ROSTER } from '../data/roster';
import { STAGES, wideStage } from '../data/stages';
import assetManifest from '../data/assetManifest.json';
import { CELL_H } from '../render/coords';
import { cellWidth } from '../render/geometry';

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

/** one loadable file. `kind` picks the Phaser loader method + the cache it
 *  lands in; spritesheets carry their frame size. */
export interface AssetFile {
  kind: 'image' | 'spritesheet' | 'json' | 'audio';
  key: string;
  url: string;
  frameWidth?: number;
  frameHeight?: number;
}

const img = (key: string, path: string): AssetFile => ({ kind: 'image', key, url: assetUrl(path) });

/** head icon + side bust + defeated bust — the select grid / VS / win screen.
 *  Small (~4 MB for the whole roster); loaded at boot. */
export function portraitFiles(id: string): AssetFile[] {
  return [
    img(`portrait-${id}`, `assets/portraits/${id}.png`),
    img(`bust-${id}`, `assets/portraits/${id}-bust.png`),
    img(`portrait-ko-${id}`, `assets/portraits/${id}-ko.png`),
  ];
}

/** the packed sheet + meta + per-move projectile/VFX art — the heavy per-fighter
 *  payload (~7 MB each, ~28 MB decoded). Lazy: decoded when a fighter is
 *  highlighted/selected. */
export function fighterFiles(id: string): AssetFile[] {
  const out: AssetFile[] = [
    {
      kind: 'spritesheet', key: `sheet-${id}`, url: assetUrl(`assets/sprites/${id}/sheet.png`),
      frameWidth: cellWidth(characters[id]), frameHeight: CELL_H,
    },
    { kind: 'json', key: `meta-${id}`, url: assetUrl(`assets/sprites/${id}/meta.json`) },
  ];
  if (HAS.legacyProj.has(id)) out.push(img(`proj-${id}`, `assets/sprites/${id}/projectile.png`));
  for (const [moveId, mv] of Object.entries(characters[id]?.moves ?? {})) {
    const ref = `${id}/${moveId}`;
    if (mv.projectile && HAS.moveProj.has(ref)) {
      out.push(img(`proj-${id}-${moveId}`, `assets/sprites/${id}/projectile-${moveId}.png`));
      if (mv.projectile.detonate && HAS.moveBurst.has(ref)) {
        out.push(img(`proj-${id}-${moveId}-burst`, `assets/sprites/${id}/projectile-${moveId}-burst.png`));
      }
    }
    if (mv.vfx && HAS.moveVfx.has(ref)) out.push(img(`vfx-${id}-${moveId}`, `assets/sprites/${id}/vfx-${moveId}.png`));
  }
  return out;
}

/** every kiai/hurt/victory clip (by count) + per-move call-outs. Lazy: loaded
 *  when a fighter is locked in (they're picking the other fighter / stage). */
export function voFiles(id: string): AssetFile[] {
  if (!VO_FIGHTERS.has(id)) return []; // no VO on disk — requesting it would 404-throw
  const out: AssetFile[] = [];
  const aud = (key: string, path: string): void => { out.push({ kind: 'audio', key, url: assetUrl(path) }); };
  for (const cat of Object.keys(VOICE_COUNTS) as (keyof typeof VOICE_COUNTS)[]) {
    for (let i = 1; i <= voiceCount(id, cat); i++) aud(`v-${id}-${cat}-${i}`, `assets/audio/voice/${id}-${cat}-${i}.mp3`);
  }
  for (const [moveId, mv] of Object.entries(characters[id]?.moves ?? {})) {
    if (mv.voice) aud(`v-${id}-move-${moveId}`, `assets/audio/voice/${id}-move-${moveId}.mp3`);
  }
  return out;
}

/** the 4 cutscene panels. Lazy: loaded in the background DURING the fight (not
 *  needed until FINISH HIM at match end). */
export function fatalityFiles(id: string): AssetFile[] {
  const fat = characters[id]?.fatality;
  if (!fat) return [];
  const out: AssetFile[] = [];
  for (let k = 1; k <= fat.panels; k++) {
    out.push(img(`fat-${id}-${fat.id}-${k}`, `assets/fatalities/${id}/${fat.id}-${k}.jpg`));
  }
  return out;
}

/** just the 21:9 art — the CHOOSE STAGE grid thumbnail (no wide/parallax). */
export function stageThumbFiles(stageId: string): AssetFile[] {
  const st = stageById.get(stageId);
  return st ? [img(`bg-stage-${st.id}`, st.file)] : [];
}

/** the stage background (+ ultra-wide art + parallax layers). Lazy: loaded
 *  when a stage is chosen. */
export function stageFiles(stageId: string): AssetFile[] {
  const st = stageById.get(stageId);
  if (!st) return [];
  const out = stageThumbFiles(stageId);
  // the ultra-wide (scrolling-camera) art, when generated — FightScene prefers it
  const wide = wideStage(st.id);
  if (wide) out.push(img(`bg-stage-wide-${st.id}`, wide.file));
  if (st.layers?.sky) out.push(img(`bg-stage-${st.id}-sky`, st.layers.sky.file));
  if (st.layers?.far) out.push(img(`bg-stage-${st.id}-far`, st.layers.far.file));
  if (st.layers?.near) out.push(img(`bg-stage-${st.id}-near`, st.layers.near.file));
  if (st.layers?.floor) out.push(img(`bg-stage-${st.id}-floor`, st.layers.floor.file));
  return out;
}

/** already in Phaser's game-global cache? */
export function fileCached(scene: Phaser.Scene, f: AssetFile): boolean {
  if (f.kind === 'json') return scene.cache.json.exists(f.key);
  if (f.kind === 'audio') return scene.cache.audio.exists(f.key);
  return scene.textures.exists(f.key);
}

/** add one file to a scene's loader (no cache check — see queueFiles) */
export function addToLoader(load: Phaser.Loader.LoaderPlugin, f: AssetFile): void {
  if (f.kind === 'image') load.image(f.key, f.url);
  else if (f.kind === 'json') load.json(f.key, f.url);
  else if (f.kind === 'audio') load.audio(f.key, f.url);
  else load.spritesheet(f.key, f.url, { frameWidth: f.frameWidth ?? 0, frameHeight: f.frameHeight ?? 0 });
}

/** queue the not-yet-cached files on a scene's loader; returns how many. Boot
 *  only — everything after boot goes through AssetLoader (one loader, deduped). */
export function queueFiles(scene: Phaser.Scene, files: AssetFile[]): number {
  let n = 0;
  for (const f of files) if (!fileCached(scene, f)) { addToLoader(scene.load, f); n++; }
  return n;
}

export const queueFighterPortraits = (scene: Phaser.Scene, id: string): number =>
  queueFiles(scene, portraitFiles(id));
