// Dash stocks (SPEC/engine): dashes are a limited resource so the impulse
// can't be spammed into a permanent speed boost — each double-tap spends a
// stock, stocks regen one at a time on a fixed clock. WHY: unlimited dashes
// broke neutral (corner-to-corner in under a second) and made zoning moot.
import { describe, expect, it } from 'vitest';
import { DASH_REGEN_TICKS, DASH_STOCKS, EMPTY_INPUT, GameState, InputFrame, initialState, step } from './index';
import { characters } from '../data/characters';

function inp(partial: Partial<InputFrame> = {}): InputFrame {
  return { ...EMPTY_INPUT, ...partial };
}

function fresh(): GameState {
  const s = initialState('vincent', 'yulia', characters);
  s.phase = 'fight';
  return s;
}

/** P1 faces right: tap, two-tick release, tap = forward dash (the release
 *  gap must be old enough to sit inside doubleTapped's scan window) */
function doubleTapForward(s: GameState): void {
  step(s, [inp({ right: true }), inp()], characters);
  step(s, [inp(), inp()], characters);
  step(s, [inp(), inp()], characters);
  step(s, [inp({ right: true }), inp()], characters);
}

describe('dash stocks', () => {
  it('spends a stock per dash and applies the impulse', () => {
    const s = fresh();
    doubleTapForward(s);
    expect(s.fighters[0].dashStocks).toBe(DASH_STOCKS - 1);
    expect(s.fighters[0].vx).toBeGreaterThan(0);
  });

  it('blocks the dash once the pool is empty — walk still works', () => {
    const s = fresh();
    for (let i = 0; i < DASH_STOCKS; i++) {
      doubleTapForward(s);
      // let the impulse bleed off so the next double-tap is clean
      for (let t = 0; t < 30; t++) step(s, [inp(), inp()], characters);
    }
    expect(s.fighters[0].dashStocks).toBe(0);
    const xBefore = s.fighters[0].x;
    doubleTapForward(s);
    expect(s.fighters[0].vx).toBe(0); // no impulse granted
    expect(s.fighters[0].x).toBeGreaterThan(xBefore); // plain walk unaffected
  });

  it('regens one stock after DASH_REGEN_TICKS, capped at DASH_STOCKS', () => {
    const s = fresh();
    doubleTapForward(s);
    expect(s.fighters[0].dashStocks).toBe(DASH_STOCKS - 1);
    for (let t = 0; t < DASH_REGEN_TICKS; t++) step(s, [inp(), inp()], characters);
    expect(s.fighters[0].dashStocks).toBe(DASH_STOCKS);
    // full pool: the clock must not bank a phantom stock
    for (let t = 0; t < DASH_REGEN_TICKS * 2; t++) step(s, [inp(), inp()], characters);
    expect(s.fighters[0].dashStocks).toBe(DASH_STOCKS);
  });

  it('backdash draws from the same pool', () => {
    const s = fresh();
    step(s, [inp({ left: true }), inp()], characters);
    step(s, [inp(), inp()], characters);
    step(s, [inp(), inp()], characters);
    step(s, [inp({ left: true }), inp()], characters);
    expect(s.fighters[0].dashStocks).toBe(DASH_STOCKS - 1);
    expect(s.fighters[0].vx).toBeLessThan(0);
  });
});
