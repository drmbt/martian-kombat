// P3.2 — SOCD: holding left+right used to walk forward AND block at once
// (measured: advanced 192 px while blocking 6/6 MPs). Cleaned in the engine:
// L+R → neutral, U+D → up.
import { describe, expect, it } from 'vitest';
import { characters } from './__fixtures__/characters';
import { benchState, run } from '../bench/sim';
import { EMPTY_INPUT, cleanSocd } from './index';

describe('SOCD cleaning (P3.2)', () => {
  it('L+R → neutral, U+D → up, other frames untouched', () => {
    expect(cleanSocd({ ...EMPTY_INPUT, left: true, right: true, lp: true })).toEqual({ ...EMPTY_INPUT, lp: true });
    expect(cleanSocd({ ...EMPTY_INPUT, up: true, down: true })).toEqual({ ...EMPTY_INPUT, up: true });
    const f = { ...EMPTY_INPUT, left: true, down: true };
    expect(cleanSocd(f)).toBe(f);
  });

  it('holding L+R under MP pressure: no advance, no block', () => {
    const s = benchState(characters, 'yulia', 'yulia', 91);
    const x0 = s.fighters[0].x;
    let blocked = 0;
    let hit = 0;
    run(s, characters,
      () => ({ left: true, right: true }),
      (t) => (t % 40 === 0 ? { mp: true } : {}),
      240,
      (_, st) => {
        const k = st.fighters[0].action.kind;
        if (k === 'blockstun') blocked++;
        if (k === 'hitstun') hit++;
      });
    expect(blocked).toBe(0);
    expect(hit).toBeGreaterThan(0);
    // facing right, so "forward" is +x; knockback only ever pushes back
    expect(s.fighters[0].x).toBeLessThanOrEqual(x0);
  });
});
