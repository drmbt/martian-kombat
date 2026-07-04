// SPEC V18 — the loopback pair is the test double every NetSession vitest
// stands on; if its latency/jitter/loss model drifts from "adversarial but
// deterministic", rollback tests stop meaning anything.
import { describe, expect, it } from 'vitest';
import { createLoopbackPair, type NetMsg } from './transport';

const input = (tick: number): NetMsg => ({ t: 'input', tick, frames: [0] });

describe('LoopbackTransport', () => {
  it('delivers after the configured latency, in order when jitter is off', () => {
    const { a, b, tick, run } = createLoopbackPair({ latency: 3 });
    const got: number[] = [];
    b.onMessage((m) => m.t === 'input' && got.push(m.tick));
    a.send(input(1));
    a.send(input(2));
    tick();
    tick();
    expect(got).toEqual([]); // still in flight
    run(1);
    expect(got).toEqual([1, 2]);
  });

  it('is deterministic for a fixed seed (jitter + loss reproduce exactly)', () => {
    const deliver = (seed: number): number[] => {
      const { a, b, run } = createLoopbackPair({ latency: 2, jitter: 2, loss: 0.3, seed });
      const got: number[] = [];
      b.onMessage((m) => m.t === 'input' && got.push(m.tick));
      for (let t = 0; t < 40; t++) a.send(input(t));
      run(10);
      return got;
    };
    expect(deliver(7)).toEqual(deliver(7));
    expect(deliver(7)).not.toEqual(deliver(8)); // seed actually matters
  });

  it('drops packets under loss but never corrupts survivors', () => {
    const { a, b, run } = createLoopbackPair({ latency: 1, loss: 0.5, seed: 42 });
    const got: number[] = [];
    b.onMessage((m) => m.t === 'input' && got.push(m.tick));
    for (let t = 0; t < 100; t++) a.send(input(t));
    run(5);
    expect(got.length).toBeGreaterThan(10);
    expect(got.length).toBeLessThan(90);
    // survivors intact and unduplicated
    expect(new Set(got).size).toBe(got.length);
  });

  it('sender-side mutation after send cannot reach the receiver', () => {
    const { a, b, run } = createLoopbackPair({ latency: 1 });
    let got: NetMsg | null = null;
    b.onMessage((m) => (got = m));
    const msg: NetMsg = { t: 'input', tick: 5, frames: [1, 2, 3] };
    a.send(msg);
    msg.frames.push(999);
    run(2);
    expect(got).toEqual({ t: 'input', tick: 5, frames: [1, 2, 3] });
  });

  it('close notifies both ends and stops delivery', () => {
    const { a, b, run } = createLoopbackPair({ latency: 1 });
    const status: string[] = [];
    b.onStatus((s) => status.push(s));
    a.onStatus(() => undefined);
    a.send(input(1));
    a.close();
    const got: NetMsg[] = [];
    b.onMessage((m) => got.push(m));
    run(3);
    expect(status).toEqual(['open', 'closed']);
    expect(got).toEqual([]);
  });
});
