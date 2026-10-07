// Input interpretation: packing InputFrames into the per-fighter history,
// fresh presses, motions, chords, mash, SOCD cleaning, and which attack a
// press selects (special priority P3.6, edge-triggered normals P3.4).
// Part of the deterministic fight core (split out of step.ts in P3.9).
// Same rules as all of src/engine/: no Phaser, no randomness, no wall clock.

import {
  CharacterDef,
  FatalityDef,
  FighterState,
  GameState,
  InputFrame,
  Motion,
  Strength,
} from './types';
import {
  CHARGE_TICKS,
} from './constants';
import { ownsLiveProjectile } from './world';

export const BIT = {
  left: 1, right: 2, up: 4, down: 8,
  lp: 16, mp: 32, hp: 64, lk: 128, mk: 256, hk: 512,
  taunt: 1024,
} as const;

export const PUNCH_BITS = BIT.lp | BIT.mp | BIT.hp;

export const KICK_BITS = BIT.lk | BIT.mk | BIT.hk;

export function packInput(i: InputFrame): number {
  return (
    (i.left ? BIT.left : 0) |
    (i.right ? BIT.right : 0) |
    (i.up ? BIT.up : 0) |
    (i.down ? BIT.down : 0) |
    (i.lp ? BIT.lp : 0) |
    (i.mp ? BIT.mp : 0) |
    (i.hp ? BIT.hp : 0) |
    (i.lk ? BIT.lk : 0) |
    (i.mk ? BIT.mk : 0) |
    (i.hk ? BIT.hk : 0) |
    (i.taunt ? BIT.taunt : 0)
  );
}

/** Inverse of packInput — rebuilds the InputFrame a net packet carried
 *  (SPEC V22: inputs travel as packed numbers, never objects). */
export function unpackInput(n: number): InputFrame {
  return {
    left: (n & BIT.left) !== 0,
    right: (n & BIT.right) !== 0,
    up: (n & BIT.up) !== 0,
    down: (n & BIT.down) !== 0,
    lp: (n & BIT.lp) !== 0,
    mp: (n & BIT.mp) !== 0,
    hp: (n & BIT.hp) !== 0,
    lk: (n & BIT.lk) !== 0,
    mk: (n & BIT.mk) !== 0,
    hk: (n & BIT.hk) !== 0,
    taunt: (n & BIT.taunt) !== 0,
  };
}

/** True when any bit of `mask` is down this tick but was up last tick. */
export function freshPress(f: FighterState, mask: number): boolean {
  const buf = f.inputBuffer;
  const cur = (buf[buf.length - 1] ?? 0) & mask;
  const prev = (buf[buf.length - 2] ?? 0) & mask;
  return cur !== 0 && prev === 0;
}

/** Staged motion matcher over the input buffer, facing-aware.
 *  Each stage is {need, not?}: a buffered frame advances the stage when it has
 *  every `need` bit and no `not` bit. The (simplified) 360 instead requires
 *  down + back + forward all seen inside the window ("270 rule" — pressing up
 *  would start a jump, exactly like real players buffer SPDs). */
export function motionDone(f: FighterState, motion: Motion): boolean {
  const buf = f.inputBuffer;
  const from = 0; // the whole input history (INPUT_BUFFER_LEN ticks) is the motion window
  const fwd = f.facing === 1 ? BIT.right : BIT.left;
  const back = f.facing === 1 ? BIT.left : BIT.right;

  if (motion === '360') {
    let seen = 0;
    for (let i = from; i < buf.length; i++) {
      if (buf[i] & BIT.down) seen |= 1;
      if (buf[i] & back) seen |= 2;
      if (buf[i] & fwd) seen |= 4;
    }
    return seen === 7;
  }

  // charge down-up (MUGEN `~60$D, U, x`): a ≥CHARGE_TICKS down-hold, still
  // held or released within CHARGE_RELEASE_TICKS, + up now. pickAttack runs
  // before the jump check, so the special wins over prejump.
  if (motion === 'du') {
    return (f.charge >= CHARGE_TICKS || f.chargeWindow > 0) && ((buf[buf.length - 1] ?? 0) & BIT.up) !== 0;
  }

  // charge back-forward (sonic boom, MUGEN `~60$B, F, x`): same, on back.
  if (motion === 'cbf') {
    return (f.backCharge >= CHARGE_TICKS || f.backChargeWindow > 0) && ((buf[buf.length - 1] ?? 0) & fwd) !== 0;
  }

  const STAGES: Record<Exclude<Motion, '360' | 'du' | 'cbf'>, { need: number; not?: number }[]> = {
    qcf: [{ need: BIT.down }, { need: fwd, not: BIT.down }],
    qcb: [{ need: BIT.down }, { need: back, not: BIT.down }],
    bf: [{ need: back }, { need: fwd, not: back }],
    dp: [{ need: fwd, not: BIT.down }, { need: BIT.down }, { need: fwd }],
    hcb: [{ need: fwd }, { need: BIT.down }, { need: back }],
    hcf: [{ need: back }, { need: BIT.down }, { need: fwd }],
  };
  const stages = STAGES[motion];
  let stage = 0;
  for (let i = from; i < buf.length; i++) {
    const s = stages[stage];
    if ((buf[i] & s.need) === s.need && !(buf[i] & (s.not ?? 0))) {
      stage++;
      if (stage === stages.length) return true;
    }
  }
  return false;
}

export const STRENGTH_BITS: Record<'punch' | 'kick', [number, number, number]> = {
  punch: [BIT.lp, BIT.mp, BIT.hp],
  kick: [BIT.lk, BIT.mk, BIT.hk],
};

/** Which strength of the class was FRESHLY pressed this tick (h wins ties). */
export function freshStrength(f: FighterState, cls: 'punch' | 'kick'): Strength | null {
  const [l, m, h] = STRENGTH_BITS[cls];
  if (freshPress(f, h)) return 'h';
  if (freshPress(f, m)) return 'm';
  if (freshPress(f, l)) return 'l';
  return null;
}

/** Mash trigger (lightning legs): the final press is THIS tick and the input
 *  buffer holds at least `need` fresh press edges of the class in total —
 *  any button of the class counts, so drumming lp/mp/hp all feed the mash. */
export function mashedStrength(f: FighterState, cls: 'punch' | 'kick', need: number): Strength | null {
  const now = freshStrength(f, cls);
  if (!now) return null;
  const buf = f.inputBuffer;
  let edges = 0;
  for (const bit of STRENGTH_BITS[cls]) {
    for (let i = 0; i < buf.length; i++) {
      const prev = i > 0 ? buf[i - 1] : 0;
      if (buf[i] & bit && !(prev & bit)) edges++;
    }
  }
  return edges >= need ? now : null;
}

/** 2+ presses of the class landing within a ~5-tick window (practical 3P/3K —
 *  humans can't hit two keys on the same 60hz tick; SFII buffers this too).
 *  A button counts if it's held NOW and was released at some point inside the
 *  window (i.e. it's a recent press, not an ancient hold). */
export function comboPress(f: FighterState, cls: 'punch' | 'kick'): boolean {
  const buf = f.inputBuffer;
  const cur = buf[buf.length - 1] ?? 0;
  let recent = 0;
  for (const bit of STRENGTH_BITS[cls]) {
    if (!(cur & bit)) continue;
    for (let i = buf.length - 6; i < buf.length - 1; i++) {
      // frames before the buffer began count as released
      if (i < 0 || !(buf[i] & bit)) {
        recent++;
        break;
      }
    }
  }
  return recent >= 2;
}

/** The universal-throw chord: LP AND LK held now, both pressed recently
 *  (same recent-press rule as comboPress, across the punch/kick classes). */
export function throwChord(f: FighterState): boolean {
  const buf = f.inputBuffer;
  const cur = buf[buf.length - 1] ?? 0;
  if (!(cur & BIT.lp) || !(cur & BIT.lk)) return false;
  for (const bit of [BIT.lp, BIT.lk]) {
    let recent = false;
    for (let i = buf.length - 6; i < buf.length - 1; i++) {
      // frames before the buffer began count as released
      if (i < 0 || !(buf[i] & bit)) {
        recent = true;
        break;
      }
    }
    if (!recent) return false;
  }
  return true;
}

/** Did `f` just complete this fatality's input? Same button grammar as
 *  specials: PPP/KKK chords, the LPLK throw chord, mash counts, plain
 *  punch/kick (P3.7: LPLK used to index STRENGTH_BITS['LPLK'] → crash). */
export function fatalityInputDone(f: FighterState, fat: FatalityDef): boolean {
  const { button, motion, mash } = fat.input;
  let pressed: boolean;
  if (button === 'LPLK') pressed = throwChord(f);
  else if (button === 'PPP' || button === 'KKK') pressed = comboPress(f, button === 'PPP' ? 'punch' : 'kick');
  else if (mash) pressed = mashedStrength(f, button, mash) !== null;
  else pressed = freshStrength(f, button) !== null;
  return pressed && (!motion || motionDone(f, motion));
}

export function holdingBack(f: FighterState, i: InputFrame): boolean {
  return f.facing === 1 ? i.left : i.right;
}

export function holdingForward(f: FighterState, i: InputFrame): boolean {
  return f.facing === 1 ? i.right : i.left;
}

/** Double-tap detection against the rolling input buffer (newest entry is the
 *  current tick). Pattern: press now, with a release and an earlier press of
 *  the same direction inside the buffer window. */
export function doubleTapped(f: FighterState, dir: 'f' | 'b'): boolean {
  const buf = f.inputBuffer;
  if (buf.length < 3) return false;
  const bit = (dir === 'f') === (f.facing === 1) ? 2 : 1; // right : left
  const cur = buf[buf.length - 1] & bit;
  const prev = buf[buf.length - 2] & bit;
  if (!cur || prev) return false; // not a fresh press
  let sawGap = false;
  for (let i = buf.length - 3; i >= 0; i--) {
    if (!(buf[i] & bit)) sawGap = true;
    else if (sawGap) return true; // earlier press separated by a release
  }
  return false;
}

/** Any of the six attack buttons freshly pressed this tick (per-button edge —
 *  a second button pressed while another is held still counts). */
export function anyFreshButton(f: FighterState): boolean {
  const buf = f.inputBuffer;
  const cur = buf[buf.length - 1] ?? 0;
  const prev = buf[buf.length - 2] ?? 0;
  return ((cur & ~prev) & (PUNCH_BITS | KICK_BITS)) !== 0;
}

// heavier buttons win when several land on the same tick
export const BUTTON_PRIORITY = ['hp', 'hk', 'mp', 'mk', 'lp', 'lk'] as const;

/** special-move priority when one input satisfies several (P3.6): the
 *  harder / more specific motion wins — SF2 resolves overlaps the same way.
 *  Button chords (PPP/KKK/LPLK, no motion) rank lowest. */
export const MOTION_RANK: Record<Motion, number> = {
  '360': 6, dp: 5, hcf: 4, hcb: 4, qcf: 3, qcb: 3, cbf: 2, du: 2, bf: 1,
};

export const STRENGTH_RANK: Record<Strength, number> = { l: 0, m: 1, h: 2 };

export interface AttackPick {
  id: string;
  strength?: Strength;
}

export function pickAttack(
  s: GameState,
  slot: 0 | 1,
  def: CharacterDef,
  i: InputFrame,
  stance: 'stand' | 'crouch',
): AttackPick | null {
  const f = s.fighters[slot];
  // named specials: each declares its own motion + button class; the button's
  // strength (L/M/H) selects the variant. When one input satisfies several,
  // the strongest motion wins, then the strength, then JSON order (P3.6) —
  // a DP's usual overshoot also completes a qcf, and key order used to win.
  let best: { id: string; strength: Strength; rank: number; str: number } | null = null;
  for (const [id, m] of Object.entries(def.moves)) {
    if (!m.input) continue;
    let strength: Strength | null;
    if (m.input.button === 'LPLK') {
      strength = throwChord(f) ? 'l' : null;
    } else {
      const cls = m.input.button === 'PPP' ? 'punch' : m.input.button === 'KKK' ? 'kick' : m.input.button;
      const combo = m.input.button === 'PPP' || m.input.button === 'KKK';
      strength = combo
        ? comboPress(f, cls)
          ? 'm'
          : null
        : m.input.mash
          ? mashedStrength(f, cls, m.input.mash)
          : freshStrength(f, cls);
    }
    if (!strength) continue;
    if (m.input.motion && !motionDone(f, m.input.motion)) continue;
    if (m.projectile && !m.projectile.field && ownsLiveProjectile(s, slot)) continue;
    const rank = m.input.mash ? MOTION_RANK['360'] : m.input.motion ? MOTION_RANK[m.input.motion] : 0;
    const str = STRENGTH_RANK[strength];
    if (!best || rank > best.rank || (rank === best.rank && str > best.str)) best = { id, strength, rank, str };
  }
  if (best) return { id: best.id, strength: best.strength };
  // normals are edge-triggered: a HELD button attacks once, not every time the
  // previous attack ends (P3.4). A press made while unactionable was already
  // resolved into f.buffered at press time, so the fresh edge isn't lost.
  const prefix = stance === 'crouch' ? 'c' : '';
  for (const b of BUTTON_PRIORITY) {
    if (i[b] && freshPress(f, BIT[b]) && def.moves[prefix + b]) return { id: prefix + b };
  }
  return null;
}

export function pickAirAttack(f: FighterState, def: CharacterDef, i: InputFrame): string | null {
  for (const b of BUTTON_PRIORITY) {
    if (i[b] && def.moves[`j${b}`] && freshPress(f, BIT[b])) return `j${b}`;
  }
  return null;
}

/** SOCD cleaning (P3.2, IKEMEN's rule): L+R → neutral, U+D → up. Done in the
 *  engine so both online peers agree. Unchanged frames are returned as-is. */
export function cleanSocd(i: InputFrame): InputFrame {
  const lr = i.left && i.right;
  const ud = i.up && i.down;
  if (!lr && !ud) return i;
  return { ...i, ...(lr ? { left: false, right: false } : {}), ...(ud ? { down: false } : {}) };
}
