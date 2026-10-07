// Raw (as-authored, UNSCALED) character JSON for the calibration lab: the
// calibrator edits raw data — exactly what gets written back on approval —
// and bakes it with applyScale (like src/data/characters/index.ts) to measure.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CharacterDef, Defs } from '../../engine';
import { applyScale } from '../../data/characterScale';

const ROOT = join(import.meta.dirname ?? '.', '..', '..', '..');

export type RawDefs = Record<string, CharacterDef>;

export function loadRaw(ids: string[]): RawDefs {
  const out: RawDefs = {};
  for (const id of ids) out[id] = JSON.parse(readFileSync(join(ROOT, 'src/data/characters', `${id}.json`), 'utf8'));
  return out;
}

/** a deep copy (calibration never mutates the caller's data) */
export const cloneRaw = (raw: RawDefs): RawDefs => JSON.parse(JSON.stringify(raw));

/** bake raw defs into engine-ready Defs (fresh objects every call, so the
 *  SmartBot playbook cache — keyed by def object — sees changes) */
export function bake(raw: RawDefs): Defs {
  const out: Defs = {};
  for (const [id, def] of Object.entries(raw)) out[id] = applyScale(JSON.parse(JSON.stringify(def)));
  return out;
}
