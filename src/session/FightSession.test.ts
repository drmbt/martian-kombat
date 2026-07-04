// SPEC V17/V18 — FightSession must reproduce the exact tick cadence the
// scenes had when they owned their own accumulator loops: fixed timestep,
// delta clamping, KO slow-mo pacing, pause = dropped time (never dropped or
// rewound ticks).
import { describe, expect, it } from 'vitest';
import { EMPTY_INPUT, TICK_MS, initialState, step } from '../engine';
import type { GameState, InputFrame } from '../engine';
import { characters } from '../data/characters';
import { FightSession, koSlowActive } from './FightSession';

const inp = (partial: Partial<InputFrame> = {}): InputFrame => ({ ...EMPTY_INPUT, ...partial });

function fresh(): GameState {
  const s = initialState('vincent', 'yulia', characters);
  s.phase = 'fight';
  return s;
}

// scripted input as a pure function of tick — session and reference loop must
// agree on WHICH tick each frame belongs to, not just how many run
const script = (t: number): [InputFrame, InputFrame] => [
  inp({ right: t % 90 < 45, lp: t % 30 === 0 }),
  inp({ left: t % 70 < 30, lk: t % 25 === 0 }),
];

describe('FightSession', () => {
  it('matches a plain step() loop tick-for-tick (V17: same sim, one driver)', () => {
    const ref = fresh();
    const sess = new FightSession(fresh(), { inputs: (s) => script(s.tick) }, characters);
    // uneven frame deltas — accumulator must carry remainders
    const deltas = [16.7, 33.1, 8.2, 16.6, 50, 12.3, 16.7, 16.7, 100, 5];
    let total = 0;
    for (const d of deltas) total += sess.advance(d);
    for (let i = 0; i < total; i++) step(ref, script(ref.tick), characters);
    expect(sess.state).toEqual(ref);
  });

  it('clamps runaway deltas to 100ms (no spiral of death)', () => {
    const runaway = new FightSession(fresh(), { inputs: () => [inp(), inp()] }, characters);
    const capped = new FightSession(fresh(), { inputs: () => [inp(), inp()] }, characters);
    expect(runaway.advance(5000)).toBe(capped.advance(100));
    expect(runaway.state).toEqual(capped.state);
  });

  it('runs ticks at ~1/3 pace while KO slow-mo is active', () => {
    const s = fresh();
    s.phase = 'roundEnd';
    s.phaseFrame = 10;
    s.fighters[1].health = 0;
    expect(koSlowActive(s)).toBe(true);
    const sess = new FightSession(s, { inputs: () => [inp(), inp()] }, characters);
    // one frame's worth of time scaled by 0.35 banks less than a tick
    expect(sess.advance(TICK_MS)).toBe(0);
    expect(sess.advance(TICK_MS)).toBe(0);
    expect(sess.advance(TICK_MS)).toBe(1);
  });

  it('resetPacing drops banked time without stepping', () => {
    const sess = new FightSession(fresh(), { inputs: () => [inp(), inp()] }, characters);
    sess.advance(TICK_MS - 1); // banked, below threshold
    sess.resetPacing();
    const tickBefore = sess.state.tick;
    expect(sess.advance(1)).toBe(0); // old bank gone: 1ms alone can't tick
    expect(sess.state.tick).toBe(tickBefore);
  });

  it('fires beforeTick/afterTick around every step, in order', () => {
    const calls: string[] = [];
    const sess = new FightSession(
      fresh(),
      {
        inputs: (s) => {
          calls.push(`inputs@${s.tick}`);
          return [inp(), inp()];
        },
        beforeTick: (s) => calls.push(`before@${s.tick}`),
        afterTick: (s) => calls.push(`after@${s.tick}`),
      },
      characters,
    );
    sess.advance(TICK_MS * 2 + 1);
    expect(calls).toEqual(['before@0', 'inputs@0', 'after@1', 'before@1', 'inputs@1', 'after@2']);
  });
});
