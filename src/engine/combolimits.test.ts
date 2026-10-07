// P3.8 — combos end on their own, even with broken data (MKS-1 C2):
// ground hitstun decay after HITSTUN_DECAY_FROM hits, and MUGEN juggle points
// for hits on an airborne combo victim.
import { describe, expect, it } from 'vitest';
import type { Defs } from './index';
import { DEFAULT_JUGGLE_COST, HITSTUN_DECAY_FROM, HITSTUN_DECAY_STEP, JUGGLE_POINTS } from './index';
import { testChar, testMove } from '../bench/fixtures';
import { benchState, run, type Partial6 } from '../bench/sim';

/** mash LP every other tick at point blank; count consecutive combo hits */
function longestCombo(defs: Defs, press: (t: number) => Partial6, ticks = 600): number {
  const s = benchState(defs, 't', 't', 90);
  let best = 0;
  run(s, defs, press, () => ({}), ticks, (_, st) => { best = Math.max(best, st.fighters[1].comboHits); });
  return best;
}

describe('ground hitstun decay (P3.8)', () => {
  it('a zero-pushback self-chain that never ended now drops', () => {
    // lp chains into itself, never pushes, and links with plenty to spare
    const defs: Defs = { t: testChar('t', {}, { lp: testMove({ startup: 2, active: 2, recovery: 6, hitstun: 16, knockback: 0, chains: ['lp'] }) }) };
    const n = longestCombo(defs, (t) => (t % 2 === 0 ? { lp: true } : {}));
    expect(n).toBeGreaterThan(HITSTUN_DECAY_FROM); // the first hits are untouched…
    expect(n).toBeLessThan(16); // …but it ends
  });

  it('decays STEP ticks per hit after FROM hits', () => {
    const defs: Defs = { t: testChar('t', {}, { lp: testMove({ startup: 2, active: 2, recovery: 6, hitstun: 30, knockback: 0, chains: ['lp'] }) }) };
    const s = benchState(defs, 't', 't', 90);
    const stunAtHit = new Map<number, number>();
    run(s, defs, (t) => (t % 2 === 0 ? { lp: true } : {}), () => ({}), 200, (_, st) => {
      const v = st.fighters[1];
      if (v.action.kind === 'hitstun' && !stunAtHit.has(v.comboHits)) stunAtHit.set(v.comboHits, v.action.frame);
    });
    expect(HITSTUN_DECAY_STEP).toBeGreaterThan(0);
    expect(stunAtHit.get(HITSTUN_DECAY_FROM)).toBe(30);
    expect(stunAtHit.get(HITSTUN_DECAY_FROM + 1)).toBe(30 - HITSTUN_DECAY_STEP);
    expect(stunAtHit.get(HITSTUN_DECAY_FROM + 2)).toBe(30 - 2 * HITSTUN_DECAY_STEP);
    expect(stunAtHit.get(HITSTUN_DECAY_FROM + 2)!).toBeLessThan(30);
  });
});

describe('juggle points (P3.8)', () => {
  it('an air juggle ends when the pool cannot pay', () => {
    // a launcher, then an anti-air that could juggle forever (huge active,
    // tiny recovery) — juggle points must cap the airborne hits
    const defs: Defs = {
      t: testChar('t', {}, {
        hp: testMove({ startup: 3, active: 3, recovery: 4, knockdown: true, knockback: 0, chains: ['lp'] }),
        lp: testMove({ startup: 1, active: 2, recovery: 2, knockback: 0, chains: ['lp'], hitbox: { x: 0, y: -400, w: 160, h: 400 } }),
      }),
    };
    const s = benchState(defs, 't', 't', 90);
    let airHits = 0;
    let wasAir = false;
    let prevCombo = 0;
    let poolLeft = -1;
    run(s, defs, (t) => (t === 0 ? { hp: true } : t % 2 === 0 ? { lp: true } : {}), () => ({}), 300, (_, st) => {
      const v = st.fighters[1];
      if (v.action.kind === 'airHit' && v.comboHits > prevCombo && wasAir) airHits++;
      if (v.action.kind === 'airHit') poolLeft = v.juggle;
      wasAir = v.action.kind === 'airHit';
      prevCombo = v.comboHits;
    });
    // MUGEN numbers (Kung Fu Man): pool 15, cost 4 → exactly 3 airborne hits,
    // 3 points left that can't pay for a 4th (literals on purpose: a test that
    // derived them from the constants would pass with the rule switched off)
    expect([JUGGLE_POINTS, DEFAULT_JUGGLE_COST]).toEqual([15, 4]);
    expect(airHits).toBe(3);
    expect(poolLeft).toBe(3);
  });

  it('the pool refills once the combo ends', () => {
    const defs: Defs = { t: testChar('t', {}, { lp: testMove() }) };
    const s = benchState(defs, 't', 't', 90);
    s.fighters[1].juggle = 3; // spent in some earlier combo
    run(s, defs, () => ({}), () => ({}), 2);
    expect(s.fighters[1].juggle).toBe(JUGGLE_POINTS);
  });
});
