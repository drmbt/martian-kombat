// P13.3 — the D8 feel changes as a DATA transform over the roster, so they
// can be A/B'd against the current feel without touching the engine (and so
// online play stays guarded by the existing character-data compat hash).
//
// D8 (decided 2026-10-06): KFM-like hitstop (~8 / 12 / 12 / 15), mediums and
// heavies plus on hit (links exist), lights ≈ −2..+1 and mediums ≈ −4 on
// block, walk toward ~1.5 character-heights per second.
import type { CharacterDef, Defs, MoveDef } from '../../engine';

export type FeelProfile = 'current' | 'd8';

export const FEEL_PROFILES: FeelProfile[] = ['current', 'd8'];

/** D8 targets (measured on hit / on block = stun − active − recovery) */
export const D8 = {
  hitstop: { light: 8, medium: 12, heavy: 12, special: 15 },
  onHit: { medium: 3, heavy: 2 },
  onBlockFloor: { light: -2, medium: -4 },
  walkChPerSec: 1.5,
} as const;

const NORMAL = /^(c|j)?([lmh])[pk]$/;

function strengthOf(id: string, m: MoveDef): 'light' | 'medium' | 'heavy' | 'special' | null {
  if (m.input || m.grab) return m.grab ? null : 'special';
  const s = NORMAL.exec(id)?.[2];
  return s === 'l' ? 'light' : s === 'm' ? 'medium' : s === 'h' ? 'heavy' : null;
}

function feelMove(id: string, m: MoveDef): MoveDef {
  const cls = strengthOf(id, m);
  if (!cls) return m;
  const out: MoveDef = { ...m };
  // hitstop (a move's explicit per-move hitstop is authored intent — keep it)
  if (out.hitstop === undefined) out.hitstop = D8.hitstop[cls];
  if (!id.startsWith('j') && cls !== 'special') {
    const tail = out.active + out.recovery;
    // plus on hit for mediums / heavies (knockdowns have no on-hit number)
    if ((cls === 'medium' || cls === 'heavy') && !out.knockdown) {
      out.hitstun = Math.max(out.hitstun, tail + D8.onHit[cls]);
    }
    // safer on block for lights / mediums
    if (cls === 'light' || cls === 'medium') {
      out.blockstun = Math.max(out.blockstun, tail + D8.onBlockFloor[cls]);
    }
  }
  return out;
}

function feelChar(def: CharacterDef): CharacterDef {
  const moves: Record<string, MoveDef> = {};
  for (const [id, m] of Object.entries(def.moves)) moves[id] = feelMove(id, m);
  // walk toward 1.5 CH/s (never slow anyone down); back-walk keeps its ratio.
  // RAW defs: the character's real height is hurtStand.h × scale (applyScale
  // bakes size at load; speeds are never scaled)
  const target = (D8.walkChPerSec * def.hurtStand.h * (def.scale ?? 1)) / 60;
  const walkSpeed = Math.max(def.walkSpeed, Math.round(target * 100) / 100);
  const ratio = def.walkSpeed > 0 ? def.backSpeed / def.walkSpeed : 0.85;
  return { ...def, moves, walkSpeed, backSpeed: Math.round(walkSpeed * ratio * 100) / 100 };
}

/** The roster under a feel profile — pass RAW (unscaled, as in the JSON)
 *  defs, then bake with applyScale. 'current' returns the defs unchanged. */
export function applyFeel(defs: Defs, profile: FeelProfile): Defs {
  if (profile === 'current') return defs;
  const out: Defs = {};
  for (const [id, def] of Object.entries(defs)) out[id] = feelChar(def);
  return out;
}
