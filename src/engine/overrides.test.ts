// Per-move contact overrides (MUGEN-parity seams, Sprint 28): `hitstop`
// (pausetime, incl. asymmetric [attacker, victim]), `chip` (guard damage) and
// `blockKnockback` (guard.velocity). Omitted = the strength/80% defaults.
import { describe, expect, it } from 'vitest';
import { EMPTY_INPUT, HITSTOP_LIGHT, initialState, step, type Defs, type GameState, type InputFrame, type MoveDef } from './index';
import { testChar, testMove } from '../bench/fixtures';

const inp = (p: Partial<InputFrame> = {}): InputFrame => ({ ...EMPTY_INPUT, ...p });

function setup(lp: Partial<MoveDef>): { s: GameState; defs: Defs } {
  const defs: Defs = { a: testChar('a', {}, { lp: testMove(lp) }), b: testChar('b') };
  const s = initialState('a', 'b', defs);
  s.phase = 'fight';
  s.fighters[0].x = 400;
  s.fighters[1].x = 491; // bodies touch at 90
  return { s, defs };
}

/** press lp on tick 0, then step until contact; returns the contact state */
function strike(s: GameState, defs: Defs, block = false): GameState {
  const guard = block ? inp({ right: true }) : inp();
  step(s, [inp({ lp: true }), guard], defs);
  for (let t = 0; t < 20; t++) {
    const d = s.fighters[1];
    if (d.action.kind === 'hitstun' || d.action.kind === 'blockstun') return s;
    step(s, [inp(), guard], defs);
  }
  throw new Error('no contact');
}

describe('per-move contact overrides', () => {
  it('default: a light freezes both sides HITSTOP_LIGHT and chips nothing', () => {
    const { s, defs } = setup({});
    strike(s, defs);
    expect(s.fighters[0].hitstop).toBe(HITSTOP_LIGHT);
    expect(s.fighters[1].hitstop).toBe(HITSTOP_LIGHT);
    const b = setup({});
    strike(b.s, b.defs, true);
    expect(b.s.fighters[1].health).toBe(1000);
  });

  it('hitstop: N freezes both sides N', () => {
    const { s, defs } = setup({ hitstop: 11 });
    strike(s, defs);
    expect(s.fighters[0].hitstop).toBe(11);
    expect(s.fighters[1].hitstop).toBe(11);
  });

  it('hitstop: [attacker, victim] is asymmetric (MUGEN pausetime = p1, p2)', () => {
    const { s, defs } = setup({ hitstop: [4, 8] });
    strike(s, defs);
    expect(s.fighters[0].hitstop).toBe(4);
    expect(s.fighters[1].hitstop).toBe(8);
  });

  it('chip: overrides guard damage, even on a light', () => {
    const { s, defs } = setup({ chip: 7 });
    strike(s, defs, true);
    expect(s.fighters[1].action.kind).toBe('blockstun');
    expect(s.fighters[1].health).toBe(993);
  });

  it('blockKnockback: overrides the 80%-of-knockback block push', () => {
    const def = setup({ knockback: 10 });
    strike(def.s, def.defs, true);
    expect(def.s.fighters[1].vx).toBeCloseTo(8);
    const o = setup({ knockback: 10, blockKnockback: 3 });
    strike(o.s, o.defs, true);
    expect(o.s.fighters[1].vx).toBeCloseTo(3);
    // the HIT push is untouched by blockKnockback
    const h = setup({ knockback: 10, blockKnockback: 3 });
    strike(h.s, h.defs);
    expect(h.s.fighters[1].vx).toBeCloseTo(10);
  });
});
