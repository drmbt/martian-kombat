// SPEC V19/V20/V22/V25 — the rollback core, tested entirely over the
// deterministic loopback transport. The heart of it is V25: whatever the
// network did (latency, jitter, loss, rollbacks), the confirmed timeline must
// be bit-identical to a plain offline step() replay of the same input log.
import { describe, expect, it } from 'vitest';
import { EMPTY_INPUT, hashState, initialState, step, unpackInput } from '../engine';
import type { GameState, InputFrame } from '../engine';
import { characters } from '../data/characters';
import { createLoopbackPair, type LoopbackOptions } from '../net/transport';
import { NetSession } from './NetSession';

const FRAME = 1000 / 60;
/** heads within a few ticks of each other counts as converged */
const SYNC_TOLERANCE = 4;

function fresh(): GameState {
  const s = initialState('vincent', 'yulia', characters);
  s.phase = 'fight';
  return s;
}

/** deterministic per-slot input scripts — busy enough to cause mispredicts */
const scripts: [(t: number) => Partial<InputFrame>, (t: number) => Partial<InputFrame>] = [
  (t) => ({ right: t % 50 < 20, down: t % 37 < 5, lp: t % 23 === 0, hk: t % 61 === 0 }),
  (t) => ({ left: t % 44 < 18, up: t % 97 === 0, mk: t % 31 === 0, lp: t % 17 === 0 }),
];

function makePair(net: LoopbackOptions, opts: { delay?: number; window?: number; hashInterval?: number } = {}) {
  const wire = createLoopbackPair(net);
  const sessions = ([0, 1] as const).map((slot) => {
    const state = fresh();
    return new NetSession(
      state,
      { inputs: (s) => [{ ...EMPTY_INPUT, ...scripts[slot](s.tick) }, { ...EMPTY_INPUT, ...scripts[slot](s.tick) }] },
      characters,
      { transport: slot === 0 ? wire.a : wire.b, localSlot: slot, ...opts },
    );
  });
  return { host: sessions[0], guest: sessions[1], wire };
}

/** run both peers frame-by-frame, pumping the network between frames */
function runFrames(pair: ReturnType<typeof makePair>, frames: number): void {
  for (let i = 0; i < frames; i++) {
    pair.host.advance(FRAME);
    pair.guest.advance(FRAME);
    pair.wire.tick();
  }
}

/** let in-flight traffic land and both peers reconcile without adding time */
function settle(pair: ReturnType<typeof makePair>): void {
  pair.wire.run(64);
  pair.host.advance(0);
  pair.guest.advance(0);
}

describe('NetSession rollback', () => {
  it('perfect network: peers stay in lockstep with zero rollbacks', () => {
    const pair = makePair({ latency: 0 }, { delay: 2 });
    runFrames(pair, 240);
    settle(pair);
    expect(pair.host.stats().rollbacks).toBe(0);
    expect(pair.guest.stats().rollbacks).toBe(0);
    expect(hashState(pair.host.state)).toBe(hashState(pair.guest.state));
    expect(pair.host.stats().halted).toBeNull();
  });

  it('laggy jittery lossy network: rollbacks happen, timelines still converge', () => {
    const pair = makePair({ latency: 4, jitter: 2, loss: 0.15, seed: 11 }, { delay: 2, window: 12 });
    runFrames(pair, 600);
    settle(pair);
    const hs = pair.host.stats();
    const gs = pair.guest.stats();
    expect(hs.rollbacks + gs.rollbacks).toBeGreaterThan(0); // the mechanism actually ran
    expect(hs.halted).toBeNull();
    expect(gs.halted).toBeNull();
    // both heads fully confirmed after settling → must be the same timeline
    expect(pair.host.state.tick).toBe(pair.guest.state.tick);
    expect(hashState(pair.host.state)).toBe(hashState(pair.guest.state));
  });

  it('V25: confirmed timeline ≡ offline step() replay of the same input log', () => {
    const pair = makePair({ latency: 3, jitter: 1, loss: 0.1, seed: 5 }, { delay: 2 });
    runFrames(pair, 300);
    settle(pair);
    const head = pair.host.state.tick;
    // replay offline: both scripts delayed by the session's input delay, the
    // first `delay` ticks empty — exactly what the peers agreed on
    const replay = fresh();
    const delayed = (slot: 0 | 1, t: number): InputFrame =>
      t > 2 ? { ...EMPTY_INPUT, ...scripts[slot](t - 1 - 2) } : { ...EMPTY_INPUT };
    for (let k = 1; k <= head; k++) {
      step(replay, [delayed(0, k), delayed(1, k)], characters);
    }
    expect(hashState(replay)).toBe(hashState(pair.host.state));
  });

  it('stalls instead of predicting past the window when the peer goes silent', () => {
    const pair = makePair({ latency: 0 }, { delay: 2, window: 8 });
    runFrames(pair, 60);
    settle(pair);
    // guest stops advancing entirely; host keeps rendering frames
    for (let i = 0; i < 120; i++) {
      pair.host.advance(FRAME);
      pair.wire.tick();
    }
    // the actual invariant: the head never predicts past the window
    expect(pair.host.stats().ahead).toBeLessThanOrEqual(8);
    expect(pair.host.stats().stalls).toBeGreaterThan(0);
    expect(pair.host.stats().halted).toBeNull(); // stalled ≠ dead
  });

  it('V20: a divergent state halts both peers loudly within a hash interval', () => {
    const pair = makePair({ latency: 1 }, { delay: 2, hashInterval: 30 });
    const issues: string[] = [];
    pair.host.onIssue((i) => issues.push(`host:${i.kind}`));
    pair.guest.onIssue((i) => issues.push(`guest:${i.kind}`));
    runFrames(pair, 30);
    // simulate a real desync: the guest's timeline silently corrupts
    pair.guest.state.fighters[0].health -= 1;
    runFrames(pair, 200);
    expect(issues).toContain('host:desync');
    expect(issues).toContain('guest:desync');
    // halted sessions refuse to advance
    const t = pair.host.state.tick;
    pair.host.advance(FRAME * 10);
    expect(pair.host.state.tick).toBe(t);
  });

  it('V24: presentation hooks fire exactly once per tick despite rollbacks', () => {
    const seen = new Map<number, number>();
    const wire = createLoopbackPair({ latency: 4, jitter: 2, seed: 3 });
    const host = new NetSession(
      fresh(),
      {
        inputs: (s) => {
          const f = { ...EMPTY_INPUT, ...scripts[0](s.tick) };
          return [f, f];
        },
        afterTick: (s) => seen.set(s.tick, (seen.get(s.tick) ?? 0) + 1),
      },
      characters,
      { transport: wire.a, localSlot: 0 },
    );
    const guest = new NetSession(
      fresh(),
      {
        inputs: (s) => {
          const f = { ...EMPTY_INPUT, ...scripts[1](s.tick) };
          return [f, f];
        },
      },
      characters,
      { transport: wire.b, localSlot: 1 },
    );
    for (let i = 0; i < 300; i++) {
      host.advance(FRAME);
      guest.advance(FRAME);
      wire.tick();
    }
    expect(host.stats().rollbacks).toBeGreaterThan(0);
    for (const [tick, count] of seen) {
      expect(count, `tick ${tick} presented ${count}×`).toBe(1);
    }
    // and every simulated tick presented — none swallowed by rollbacks
    expect(seen.size).toBe(host.state.tick);
  });

  it('V26 timesync: a peer that started ahead eases back so heads converge', () => {
    const pair = makePair({ latency: 2 }, { delay: 2 });
    // simulate a launch skew: the host runs ~15 frames before the guest exists
    for (let i = 0; i < 15; i++) {
      pair.host.advance(FRAME);
      pair.wire.tick();
    }
    const skew = pair.host.state.tick - pair.guest.state.tick;
    expect(skew).toBeGreaterThan(8); // genuinely out of sync to start

    // now both run together; timesync should pull their heads together
    runFrames(pair, 300);
    const drift = Math.abs(pair.host.state.tick - pair.guest.state.tick);
    expect(skew).toBeGreaterThan(drift); // measurably closer than the start skew
    expect(drift).toBeLessThanOrEqual(SYNC_TOLERANCE); // converged
    expect(pair.host.stats().syncSkips).toBeGreaterThan(0); // the ahead peer eased
    expect(pair.host.stats().halted).toBeNull();
    expect(pair.guest.stats().halted).toBeNull();
  });

  it('disconnect: peer close surfaces as an issue, session halts', () => {
    const pair = makePair({ latency: 1 }, { delay: 2 });
    const issues: string[] = [];
    pair.guest.onIssue((i) => issues.push(i.kind));
    runFrames(pair, 60);
    pair.host.close('rage quit');
    pair.wire.run(4);
    expect(issues).toContain('disconnect');
    expect(pair.guest.advance(FRAME * 4)).toBe(0);
  });
});
