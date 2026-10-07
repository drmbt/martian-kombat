// P3.4 — normals are edge-triggered: holding a button attacks ONCE (it used
// to re-fire every time the previous attack ended — holding HP gave ~6
// attacks in 3 s). Presses during recovery still come out via the buffer.
import { describe, expect, it } from 'vitest';
import type { Defs } from './index';
import { testChar, testMove } from '../bench/fixtures';
import { benchState, run, type Partial6 } from '../bench/sim';

const defs: Defs = {
  t: testChar('t', {}, {
    hp: testMove({ startup: 6, active: 3, recovery: 20 }),
    chp: testMove({ startup: 5, active: 3, recovery: 15 }),
  }),
};

/** count attack STARTS (action becomes an attack, or the move restarts) */
function attackStarts(p1: (t: number) => Partial6, ticks = 180): string[] {
  const s = benchState(defs, 't', 't', 600); // far apart: nothing connects
  const starts: string[] = [];
  let prevKind = s.fighters[0].action.kind;
  let prevFrame = -1;
  run(s, defs, p1, () => ({}), ticks, (_, st) => {
    const a = st.fighters[0].action;
    if (a.kind === 'attack' && (prevKind !== 'attack' || a.frame < prevFrame)) starts.push(a.moveId!);
    prevKind = a.kind;
    prevFrame = a.kind === 'attack' ? a.frame : -1;
  });
  return starts;
}

describe('normals are edge-triggered (P3.4)', () => {
  it('holding HP for 180 ticks attacks once', () => {
    expect(attackStarts(() => ({ hp: true }))).toEqual(['hp']);
  });

  it('holding down+HP attacks once (crouching normal)', () => {
    expect(attackStarts(() => ({ down: true, hp: true }))).toEqual(['chp']);
  });

  it('separate taps each attack', () => {
    // tap on 0, 60, 120 (each well after the 29-tick move ends)
    expect(attackStarts((t) => (t % 60 === 0 ? { hp: true } : {}))).toEqual(['hp', 'hp', 'hp']);
  });

  it('a tap during recovery is buffered and fires once the move ends', () => {
    // move ends on tick ~29; a tap at 25 (inside the 8-tick buffer) must come out
    expect(attackStarts((t) => (t === 0 || t === 25 ? { hp: true } : {}), 90)).toEqual(['hp', 'hp']);
  });
});
