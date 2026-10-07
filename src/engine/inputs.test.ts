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

// P3.6 — when one input satisfies several specials, the stronger motion wins
// (360/mash > dp > hcf/hcb > qcf/qcb > charge > bf > chords), then strength,
// then JSON key order. It used to be JSON key order alone, so a DP with the
// usual overshoot (f, d, df, f+P — which also completes qcf) threw the
// fireball for vincent, chebel, rj, vanessa and ben.
import { characters } from '../data/characters';

/** f, d, df, f+P for a fighter facing right, held 2 ticks each */
const DP_OVERSHOOT: Partial6[] = [
  { right: true }, { right: true }, { down: true }, { down: true },
  { down: true, right: true }, { down: true, right: true }, { right: true, lp: true },
];

function firstSpecial(d: Defs, id: string, seq: Partial6[]): string | undefined {
  const s = benchState(d, id, id, 300);
  let got: string | undefined;
  run(s, d, (t) => seq[t] ?? {}, () => ({}), seq.length + 4, (_, st) => {
    const a = st.fighters[0].action;
    if (!got && a.kind === 'attack') got = a.moveId;
  });
  return got;
}

describe('special priority (P3.6)', () => {
  it('a DP with overshoot beats a qcf listed first in the JSON', () => {
    const d: Defs = {
      t: testChar('t', {}, {
        fireball: testMove({ input: { motion: 'qcf', button: 'punch' } }),
        uppercut: testMove({ input: { motion: 'dp', button: 'punch' } }),
      }),
    };
    expect(firstSpecial(d, 't', DP_OVERSHOOT)).toBe('uppercut');
  });

  it('a plain qcf still throws the fireball', () => {
    const d: Defs = {
      t: testChar('t', {}, {
        fireball: testMove({ input: { motion: 'qcf', button: 'punch' } }),
        uppercut: testMove({ input: { motion: 'dp', button: 'punch' } }),
      }),
    };
    const qcf: Partial6[] = [{ down: true }, { down: true }, { down: true, right: true }, { down: true, right: true }, { right: true, lp: true }];
    expect(firstSpecial(d, 't', qcf)).toBe('fireball');
  });

  it.each(['vincent', 'chebel', 'rj', 'vanessa', 'ben'])('%s: f,d,df,f+P gives the DP', (id) => {
    const dp = Object.entries(characters[id].moves).find(([, m]) => m.input?.motion === 'dp' && m.input.button === 'punch')?.[0];
    expect(dp, `${id} has a punch DP`).toBeTruthy();
    expect(firstSpecial(characters, id, DP_OVERSHOOT)).toBe(dp);
  });
});
