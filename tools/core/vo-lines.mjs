// tools/core/vo-lines.mjs — where a fighter's VO line TEXTS come from.
//
// The character JSON is the single source of truth (02-PLAN P8.6a): the `vo`
// block holds the kiai/hurt/victory lines and each `voice: true` move holds
// its call-out in `voiceText`. Those texts were ground-truthed against the
// actual clips (whisper, 2026-07-08), so gen-audio must never read anything
// else — the old per-fighter tables in gen-audio.mjs drifted from the clips
// (vincent's in every line) and are gone.
//
// Pure + import-safe: no env, no network. gen-audio, the tests and any future
// tool share it.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A `voiceText` that marks a non-speech clip (a recorded sound, not a line):
 *  never send it to TTS. */
export const SFX_MARK = '(SFX)';

/** Clips that are REAL recordings of the person, wired straight into
 *  public/assets/audio/voice/ — `gen:audio --force` must not overwrite them
 *  (only `--include-recorded` does). `true` = every clip in that category;
 *  an array = only those move ids. */
export const RECORDED = {
  // assets/voice-inspo/yulia/{kiai,hurt,victory}/; only backbend-guillotine
  // ("Take That!") is clone-generated.
  yulia: {
    kiai: true,
    hurt: true,
    victory: true,
    move: ['volga-piledriver', 'braid-lariat', 'sickle-kick', 'throw'],
  },
};

/** true when this clip is a real recording that regeneration must skip */
export function isRecorded(id, category, moveId) {
  const r = RECORDED[id]?.[category];
  if (r === true) return true;
  return Array.isArray(r) && moveId !== undefined && r.includes(moveId);
}

/** ids registered `playable: true` in src/data/roster.ts (tools can't import TS) */
export function playableIds() {
  const src = readFileSync(join(ROOT, 'src/data/roster.ts'), 'utf8');
  return [...src.matchAll(/\{\s*id:\s*'([^']+)',[^}]*playable:\s*true/g)].map((m) => m[1]);
}

export function readCharacter(id) {
  return JSON.parse(readFileSync(join(ROOT, 'src/data/characters', `${id}.json`), 'utf8'));
}

/** A fighter's VO texts from its character JSON:
 *  { kiai: string[], hurt: string[], victory: string[], moves: {moveId: text} }.
 *  `moves` holds only speakable call-outs (voice: true, not the SFX mark). */
export function fighterVo(id, def = readCharacter(id)) {
  const vo = def.vo ?? {};
  const moves = {};
  for (const [moveId, m] of Object.entries(def.moves ?? {})) {
    if (m?.voice && typeof m.voiceText === 'string' && m.voiceText !== SFX_MARK) moves[moveId] = m.voiceText;
  }
  return {
    kiai: [...(vo.kiai ?? [])],
    hurt: [...(vo.hurt ?? [])],
    victory: [...(vo.victory ?? [])],
    moves,
  };
}
