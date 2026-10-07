// The bench's measurement conventions, pinned with hand-computable fighters.
// If one of these breaks, either the engine's timing semantics changed (then
// docs/FIGHTING_STANDARDS.md §3 and the KFM port need a re-fit) or the
// harness did — never "update the snapshot".
import { describe, expect, it } from 'vitest';
import { GROUND_FRICTION, JUMP_VEL_MULT, type Defs } from '../engine';
import { testChar, testMove } from './fixtures';
import { measureMove, measurePhysics } from './framedata';
import { benchState, run } from './sim';
import { findCombos, routeText, verifyLoop } from './combos';

const one = (lp = testMove(), extra = {}): Defs => ({ t: testChar('t', extra, { lp }) });

describe('frame-data conventions (SF style, engine-measured)', () => {
  // data S/A/R + hitstun N / blockstun B:
  //   startup = S+1 (press = frame 1), total = S+A+R+1 (frames occupied),
  //   recovery = R+1, on hit = N−A−R, on block = B−A−R
  it('maps data fields to SF frame data exactly', () => {
    const m = measureMove(one(testMove({ startup: 3, active: 2, recovery: 6, hitstun: 12, blockstun: 7 })), 't', 'lp');
    expect(m.connects).toBe(true);
    expect(m.startup).toBe(4);
    expect(m.total).toBe(12);
    expect(m.recovery).toBe(7);
    expect(m.onHit).toBe(12 - 2 - 6);
    expect(m.onBlock).toBe(7 - 2 - 6);
  });

  it('symmetric hitstop cancels out; asymmetric shifts advantage by victim − attacker', () => {
    const base = measureMove(one(testMove({ hitstop: 6 })), 't', 'lp');
    const asym = measureMove(one(testMove({ hitstop: [2, 9] })), 't', 'lp');
    expect(base.onHit).toBe(4);
    expect(asym.onHit).toBe(4 + (9 - 2));
    expect(asym.hitstop).toEqual([2, 9]);
  });

  it('flags a hitbox that sits behind the push box as never connecting', () => {
    const m = measureMove(one(testMove({ hitbox: { x: -40, y: -200, w: 50, h: 60 } })), 't', 'lp');
    expect(m.connects).toBe(false);
    expect(m.notes.join(' ')).toMatch(/never connects/);
  });

  it('reports the connect window and the defender-side pushback', () => {
    const m = measureMove(one(testMove({ knockback: 6 })), 't', 'lp');
    expect(m.range?.[0]).toBe(91); // bodies touch at 90 → first tested gap
    // knockback impulse bleeds by GROUND_FRICTION per tick: ≈ v / (1 − f)
    expect(m.pushHit!).toBeGreaterThan(6 / (1 - GROUND_FRICTION) * 0.9);
    expect(m.pushHit!).toBeLessThan(6 / (1 - GROUND_FRICTION) * 1.05);
  });
});

describe('physics measurement', () => {
  it('walk speeds are the JSON px/tick', () => {
    const p = measurePhysics(one(), 't');
    expect(p.walkFwd).toBeCloseTo(5);
    expect(p.walkBack).toBeCloseTo(4);
  });

  it('prejump = prejumpFrames + 1 ticks to leave the ground', () => {
    expect(measurePhysics(one(testMove(), { prejumpFrames: 3 }), 't').prejump).toBe(4);
  });

  it('MUGEN jump physics: a forward jump travels at exactly jumpSpeedX (no takeoff-tick friction)', () => {
    const p = measurePhysics(one(testMove(), { jumpSpeedX: 10 }), 't');
    const v0 = 18 * JUMP_VEL_MULT;
    expect(p.airtime).toBeGreaterThan((2 * v0) / 0.9 - 2);
    // every airborne tick, incl. the landing one, moves the full 10
    // (before 2026-10-06 the takeoff tick ran ground friction → 8.5/tick)
    expect(p.jumpDist).toBeCloseTo(10 * (p.airtime + 1), 5);
  });
});

describe('action buffer survives hitstop (P3.5; was a §6 quirk)', () => {
  // ACTION_BUFFER_TICKS (8) used to keep counting down while the attacker was
  // frozen in hitstop, so a cancel pressed early in a ≥9-tick hitstop was
  // dropped. Now it pauses like IKEMEN's Input.PauseOnHitPause = 1.
  const cancelAfter = (hitstop: number, delay: number): boolean => {
    const defs: Defs = {
      t: testChar('t', {}, {
        hp: testMove({ startup: 5, active: 3, recovery: 16, hitstop, cancel: true, hitstun: 20 }),
        sp: testMove({ name: 'sp', input: { button: 'punch', motion: 'bf' }, startup: 5 }),
      }),
    };
    const s = benchState(defs, 't', 't', 91);
    let contact = -1;
    let began = false;
    run(s, defs, (t) => {
      if (t === 0) return { hp: true };
      if (contact >= 0 && t === contact + delay) return { left: true };
      if (contact >= 0 && t === contact + delay + 1) return { right: true, lp: true };
      return {};
    }, () => ({}), 80, (t, st) => {
      if (contact < 0 && st.fighters[1].action.kind === 'hitstun') contact = t;
      if (st.fighters[0].action.moveId === 'sp') began = true;
    });
    return began;
  };
  it('a cancel input early in a long hitstop still comes out', () => {
    expect(cancelAfter(8, 1)).toBe(true);
    expect(cancelAfter(12, 1)).toBe(true);
    expect(cancelAfter(15, 1)).toBe(true); // KFM-class heavy hitstop (D8)
  });
});

describe('combo finder', () => {
  it('finds and verifies a chain → special-cancel route', () => {
    const defs: Defs = {
      t: testChar('t', {}, {
        lp: testMove({ chains: ['mp'] }),
        mp: testMove({ startup: 5, active: 3, recovery: 12, damage: 60, hitstun: 18, cancel: true }),
        burst: testMove({ name: 'Burst', input: { motion: 'qcf', button: 'punch' }, startup: 6, damage: 100, knockdown: true, hitbox: { x: 20, y: -220, w: 120, h: 100 } }),
      }),
    };
    const c = findCombos(defs, 't');
    expect(c.best).not.toBeNull();
    expect(routeText(c.best!)).toMatch(/lp > mp > burst/);
    expect(c.best!.hits).toBe(3);
  });

  it('the loop verifier flags a chain that outlasts its cap', () => {
    // zero knockback: nothing ever pushes them apart; a cap of 5 sits below
    // where hitstun decay (P3.8) ends it, so the detector itself is exercised
    const defs: Defs = { t: testChar('t', {}, { lp: testMove({ chains: ['lp'], knockback: 0, hitstun: 14 }) }) };
    const c = findCombos(defs, 't');
    expect(c.loops.length).toBeGreaterThan(0);
    expect(verifyLoop(defs, 't', c.loops[0], 5).infinite).toBe(true);
  });

  it('hitstun decay ends even a zero-pushback self-chain (P3.8)', () => {
    const defs: Defs = { t: testChar('t', {}, { lp: testMove({ chains: ['lp'], knockback: 0, hitstun: 14 }) }) };
    const c = findCombos(defs, 't');
    const v = verifyLoop(defs, 't', c.loops[0]);
    expect(v.infinite).toBe(false);
    expect(v.corner).toBeLessThan(16);
  });

  it('pushback ends an ordinary light chain', () => {
    const defs: Defs = { t: testChar('t', {}, { lp: testMove({ chains: ['lp'], knockback: 8 }) }) };
    const c = findCombos(defs, 't');
    const v = c.loops.map((l) => verifyLoop(defs, 't', l));
    expect(v.every((x) => !x.infinite)).toBe(true);
  });
});
