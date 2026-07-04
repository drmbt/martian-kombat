// SPEC V20/V22 — net wire helpers: packed inputs round-trip losslessly, and
// hashState catches ANY divergence in the numeric core (a desync that hashes
// equal would sail through detection and corrupt a whole match silently).
import { describe, expect, it } from 'vitest';
import { BUTTONS, EMPTY_INPUT, hashState, initialState, packInput, step, unpackInput } from './index';
import type { GameState, InputFrame } from './index';
import { characters } from '../data/characters';

function fresh(): GameState {
  const s = initialState('vincent', 'yulia', characters);
  s.phase = 'fight';
  return s;
}

describe('unpackInput', () => {
  it('round-trips all 1024 button/direction combinations', () => {
    const keys = ['left', 'right', 'up', 'down', ...BUTTONS] as (keyof InputFrame)[];
    for (let n = 0; n < 1024; n++) {
      const frame = { ...EMPTY_INPUT };
      keys.forEach((k, i) => {
        frame[k] = (n & (1 << i)) !== 0;
      });
      expect(packInput(unpackInput(packInput(frame)))).toBe(packInput(frame));
      expect(unpackInput(packInput(frame))).toEqual(frame);
    }
  });
});

describe('hashState', () => {
  it('is stable: same state (and its structuredClone) hash equal', () => {
    const s = fresh();
    step(s, [{ ...EMPTY_INPUT, right: true }, EMPTY_INPUT], characters);
    expect(hashState(s)).toBe(hashState(s));
    expect(hashState(structuredClone(s))).toBe(hashState(s));
  });

  it('two identical sims stay hash-equal tick after tick', () => {
    const a = fresh();
    const b = fresh();
    for (let t = 0; t < 120; t++) {
      const inp: [InputFrame, InputFrame] = [
        { ...EMPTY_INPUT, right: t % 30 < 15, lp: t % 20 === 0 },
        { ...EMPTY_INPUT, left: t % 40 < 10 },
      ];
      step(a, inp, characters);
      step(b, inp, characters);
      expect(hashState(a)).toBe(hashState(b));
    }
  });

  it('flips when any hashed field diverges', () => {
    const base = fresh();
    const h = hashState(base);
    const mutations: ((s: GameState) => void)[] = [
      (s) => s.tick++,
      (s) => (s.phase = 'roundEnd'),
      (s) => (s.timer -= 1),
      (s) => (s.wins[1] = 1),
      (s) => (s.fighters[0].x += 0.0001),
      (s) => (s.fighters[1].health -= 1),
      (s) => (s.fighters[0].vy = -1),
      (s) => (s.fighters[1].action.kind = 'hitstun'),
      (s) => (s.fighters[0].action.frame += 1),
      (s) => (s.fighters[0].facing = -1),
    ];
    for (const mutate of mutations) {
      const s = structuredClone(base);
      mutate(s);
      expect(hashState(s)).not.toBe(h);
    }
  });

  it('sees projectiles (count and motion)', () => {
    const s = fresh();
    const withProj = structuredClone(s);
    withProj.projectiles.push({
      owner: 0, moveId: 'special', x: 300, y: 400, vx: 6, box: { x: 0, y: -40, w: 40, h: 40 },
      damage: 10, hitstun: 12, blockstun: 8, knockback: 6, height: 'mid', ttl: -1, vy: 0,
      gravity: 0, fuse: -1, knockdown: false, field: false, rehit: 0, hitCooldown: 0,
      slowFactor: 0, pull: false,
    });
    expect(hashState(withProj)).not.toBe(hashState(s));
    const moved = structuredClone(withProj);
    moved.projectiles[0].x += 6;
    expect(hashState(moved)).not.toBe(hashState(withProj));
  });
});
