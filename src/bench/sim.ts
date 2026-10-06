// Bench harness: drive the REAL deterministic engine with scripted inputs.
// Everything in src/bench/ measures behaviour by simulation — frame data is
// what step() actually does, never what the JSON claims. Pure TS (no Phaser,
// no Math.random), so it runs in vitest, the bench CLI and the browser alike.
import {
  CHARGE_TICKS,
  EMPTY_INPUT,
  STAGE_MAX_X,
  STAGE_MIN_X,
  initialState,
  step,
  type CharacterDef,
  type Defs,
  type FighterState,
  type GameState,
  type InputFrame,
  type SpecialInput,
  type Strength,
} from '../engine';

/** action kinds from which a fighter can start something new next tick */
export const ACTIONABLE = new Set(['idle', 'walkF', 'walkB', 'crouch']);
export const REELING = new Set(['hitstun', 'blockstun', 'airHit']);

/** effectively infinite health so measurement never ends the round */
export const BENCH_HEALTH = 1_000_000;

export type Partial6 = Partial<InputFrame>;

export function input(p: Partial6 = {}): InputFrame {
  return { ...EMPTY_INPUT, ...p };
}

/** A fight-phase state with both fighters grounded, `gap` px apart (centers),
 *  slot 0 on the left facing right. No round clock, effectively infinite HP. */
export function benchState(defs: Defs, a: string, b: string, gap: number, x0 = 260, wide = false): GameState {
  // `wide` lifts the walls far away (physics runs: walks/jumps/dashes never
  // clamp); combat runs keep the real stage so projectiles stay in bounds
  const s = initialState(a, b, defs, {
    roundTicks: 0,
    introTicks: 0,
    stage: wide ? { minX: -20000, maxX: 20000 } : { minX: STAGE_MIN_X, maxX: STAGE_MAX_X },
  });
  s.phase = 'fight';
  s.phaseFrame = 0;
  s.fighters[0].x = x0;
  s.fighters[1].x = x0 + gap;
  for (const f of s.fighters) f.health = BENCH_HEALTH;
  return s;
}

/** Facing-relative direction keys for slot 0 (faces right) / slot 1 (left). */
export function dirs(facing: 1 | -1): { fwd: 'left' | 'right'; back: 'left' | 'right' } {
  return facing === 1 ? { fwd: 'right', back: 'left' } : { fwd: 'left', back: 'right' };
}

const BTN: Record<'punch' | 'kick', Record<Strength, keyof InputFrame>> = {
  punch: { l: 'lp', m: 'mp', h: 'hp' },
  kick: { l: 'lk', m: 'mk', h: 'hk' },
};

/** The button(s) a special's input class presses at strength `s`. */
export function buttonsFor(inp: SpecialInput, s: Strength): Partial6 {
  switch (inp.button) {
    case 'PPP': return { lp: true, mp: true };
    case 'KKK': return { lk: true, mk: true };
    case 'LPLK': return { lp: true, lk: true };
    default: return { [BTN[inp.button][s]]: true };
  }
}

/** Frame-by-frame inputs that perform a special (motion + button), ending on
 *  the press frame (mash: a sustained mash). Charges hold CHARGE_TICKS + 2. */
export function specialFrames(inp: SpecialInput, s: Strength, facing: 1 | -1): Partial6[] {
  const { fwd, back } = dirs(facing);
  const b = buttonsFor(inp, s);
  if (inp.mash) {
    // keep mashing well past `mash` presses: the first press fires a normal,
    // and the buffered special only lands once that normal recovers
    const out: Partial6[] = [];
    for (let i = 0; i < Math.max(24, inp.mash); i++) out.push(b, {});
    out.pop();
    return out;
  }
  const hold = (p: Partial6, n: number): Partial6[] => Array.from({ length: n }, () => p);
  switch (inp.motion) {
    case 'qcf': return [{ down: true }, { down: true, [fwd]: true }, { [fwd]: true, ...b }];
    case 'qcb': return [{ down: true }, { down: true, [back]: true }, { [back]: true, ...b }];
    case 'dp': return [{ [fwd]: true }, { down: true }, { down: true, [fwd]: true, ...b }];
    case 'hcf': return [{ [back]: true }, { [back]: true, down: true }, { down: true }, { down: true, [fwd]: true }, { [fwd]: true, ...b }];
    case 'hcb': return [{ [fwd]: true }, { [fwd]: true, down: true }, { down: true }, { down: true, [back]: true }, { [back]: true, ...b }];
    case 'bf': return [{ [back]: true }, { [fwd]: true, ...b }];
    // MUGEN charge: hold ≥ CHARGE_TICKS, then the opposite direction + button.
    // Back-charge is held as DOWN-back (4-way `$B`) so the shooter crouches in
    // place instead of walking away — how players charge, and it keeps the
    // measured distance at point blank
    case 'cbf': return [...hold({ [back]: true, down: true }, CHARGE_TICKS + 2), { [fwd]: true, ...b }];
    case 'du': return [...hold({ down: true }, CHARGE_TICKS + 2), { up: true, ...b }];
    case '360': return [{ [back]: true }, { down: true }, { [fwd]: true, ...b }];
    default: return [b];
  }
}

/** Inputs for any move id: a special's motion, or a (crouching) normal press.
 *  Air normals return null — they need a jump (see framedata air handling). */
export function moveFrames(def: CharacterDef, id: string, s: Strength, facing: 1 | -1): Partial6[] | null {
  const m = def.moves[id];
  if (!m) return null;
  if (m.input) return specialFrames(m.input, s, facing);
  if (id.startsWith('j')) return null;
  const crouch = id.startsWith('c') && id.length === 3;
  const btn = (crouch ? id.slice(1) : id) as keyof InputFrame;
  return [crouch ? { down: true, [btn]: true } : { [btn]: true }];
}

export interface Tick {
  t: number;
  f: [FighterState, FighterState];
}

/** Step `ticks` times, feeding per-tick inputs from two script functions. The
 *  observer sees the state after each step; returning true stops early. */
export function run(
  s: GameState,
  defs: Defs,
  p1: (t: number, s: GameState) => Partial6,
  p2: (t: number, s: GameState) => Partial6,
  ticks: number,
  observe?: (t: number, s: GameState) => boolean | void,
): GameState {
  for (let t = 0; t < ticks; t++) {
    step(s, [input(p1(t, s)), input(p2(t, s))], defs);
    if (observe?.(t, s)) break;
  }
  return s;
}

/** min center distance at which two fighters' push boxes touch */
export function touchGap(a: CharacterDef, b: CharacterDef): number {
  return a.bodyBox.x + a.bodyBox.w + (b.bodyBox.x + b.bodyBox.w);
}
