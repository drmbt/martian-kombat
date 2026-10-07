// Live-roster smoke test (P3.0). The engine's behaviour tests run on FROZEN
// fixtures (./__fixtures__); this one keeps the shipped roster honest: every
// playable fighter can fight a scripted match without throwing, stays in
// bounds, and replays deterministically.
import { describe, expect, it } from 'vitest';
import { characters } from '../data/characters';
import { ROSTER } from '../data/roster';
import { EMPTY_INPUT, hashState, initialState, step, arenaBounds, type InputFrame } from './index';

/** a busy, deterministic input script: walks, jumps, crouches, every button */
function script(t: number, slot: 0 | 1): InputFrame {
  const k = (t * 7 + slot * 13) % 23;
  return {
    ...EMPTY_INPUT,
    right: k % 5 === 0 || k % 7 === 1,
    left: k % 9 === 2,
    up: k === 11,
    down: k % 4 === 3,
    lp: k === 1, mp: k === 4, hp: k === 8, lk: k === 12, mk: k === 16, hk: k === 20,
  };
}

function play(p1: string, p2: string, ticks: number): number {
  const s = initialState(p1, p2, characters);
  for (let t = 0; t < ticks; t++) step(s, [script(t, 0), script(t, 1)], characters);
  const { minX, maxX } = arenaBounds(s);
  for (const f of s.fighters) {
    expect(Number.isFinite(f.x) && Number.isFinite(f.y)).toBe(true);
    expect(f.x).toBeGreaterThanOrEqual(minX - 1);
    expect(f.x).toBeLessThanOrEqual(maxX + 1);
    expect(f.health).toBeGreaterThanOrEqual(0);
  }
  return hashState(s);
}

const playable = ROSTER.filter((r) => r.playable).map((r) => r.id);

describe('live roster smoke (P3.0)', () => {
  it.each(playable)('%s fights a scripted match and replays identically', (id) => {
    const a = play(id, 'yulia', 900);
    const b = play(id, 'yulia', 900);
    expect(a).toBe(b);
  });
});
