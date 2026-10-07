// P3.1 — same-tick connections resolve against the start-of-tick state, so
// neither slot wins by evaluation order (online, slot 0 is the host).
import { describe, expect, it } from 'vitest';
import { characters } from './__fixtures__/characters';
import { benchState, run } from '../bench/sim';
import type { GameState } from './index';

const both = (s: GameState, p: Record<string, boolean>, ticks = 30): void => {
  run(s, characters, (t) => (t === 0 ? p : {}), (t) => (t === 0 ? p : {}), ticks);
};

describe('trades (P3.1)', () => {
  it('Yulia mirror: both LP on the same tick → both take damage', () => {
    const s = benchState(characters, 'yulia', 'yulia', 91);
    const hp = s.fighters.map((f) => f.health);
    both(s, { lp: true });
    expect(s.fighters[0].health).toBeLessThan(hp[0]);
    expect(s.fighters[1].health).toBeLessThan(hp[1]);
    expect(s.fighters[0].health).toBe(s.fighters[1].health); // symmetric
  });

  it('the result does not depend on which slot is which', () => {
    // same mirror, but only one side presses: the other side must be hit
    for (const slot of [0, 1] as const) {
      const s = benchState(characters, 'yulia', 'yulia', 91);
      const start = s.fighters[1 - slot].health;
      const press = (t: number) => (t === 0 ? { lp: true } : {});
      const idle = () => ({});
      run(s, characters, slot === 0 ? press : idle, slot === 0 ? idle : press, 30);
      expect(s.fighters[1 - slot].health).toBeLessThan(start);
    }
  });

  it('two throws on the same tick clash: nobody is thrown', () => {
    const s = benchState(characters, 'yulia', 'yulia', 91);
    const hp = s.fighters.map((f) => f.health);
    both(s, { lp: true, lk: true }, 60);
    expect(s.pendingThrow).toBeFalsy();
    expect(s.fighters.map((f) => f.health)).toEqual(hp);
  });
});
