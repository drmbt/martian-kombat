// P3.7 — small engine fixes found by the 2026-10-04 audit.
import { describe, expect, it } from 'vitest';
import type { Defs, FatalityDef, FighterState } from './index';
import { hashState } from './index';
import { fatalityInputDone } from './step';
import { testChar, testMove } from '../bench/fixtures';
import { benchState, run, type Partial6 } from '../bench/sim';

const proj = (vx: number, spawnX: number) => ({
  vx, spawnX, spawnY: -150, box: { x: -100, y: -60, w: 200, h: 120 },
  damage: 50, hitstun: 20, blockstun: 10, knockback: 9,
});

describe('stationary blast pushes AWAY from the blast (P3.7)', () => {
  // the shooter faces right; a vx=0 blast spawned PAST the victim used to
  // shove the victim left (toward and through the blast) — it must push the
  // victim away from where the blast sits
  // 300 px apart: out of the move's own melee reach, so only the blast connects
  it.each([
    ['victim beyond the blast → pushed right', 230, 1],
    ['victim before the blast → pushed left', 380, -1],
  ])('%s', (_label, spawnX, sign) => {
    const defs: Defs = { t: testChar('t', {}, { blast: testMove({ input: { button: 'punch' }, projectile: proj(0, spawnX) }) }) };
    const s = benchState(defs, 't', 't', 300);
    let vxOnHit: number | null = null;
    run(s, defs, (t) => (t === 0 ? { lp: true } : {}), () => ({}), 60, (_, st) => {
      const v = st.fighters[1];
      if (vxOnHit === null && v.action.kind === 'hitstun') vxOnHit = v.vx;
    });
    expect(vxOnHit, 'the blast connected').not.toBeNull();
    expect(Math.sign(vxOnHit!)).toBe(sign);
  });
});

describe('corner pushback is melee-only (P3.7)', () => {
  it('a fireball into a cornered victim does not shove the shooter', () => {
    const defs: Defs = { t: testChar('t', {}, { fireball: testMove({ input: { button: 'punch' }, projectile: proj(8, 60) }) }) };
    // fixed screen: the victim starts at the right wall (holding back keeps it
    // there), the shooter 500 px away — far out of any melee range
    const s = benchState(defs, 't', 't', 500, 400);
    const shooterVx: number[] = [];
    let hit = false;
    run(s, defs, (t) => (t === 0 ? { lp: true } : {}), () => ({ right: true }), 150, (_, st) => {
      const k = st.fighters[1].action.kind;
      if (k === 'hitstun' || k === 'blockstun') hit = true; // holding back = it blocks
      shooterVx.push(st.fighters[0].vx);
    });
    expect(hit).toBe(true);
    expect(Math.min(...shooterVx)).toBeGreaterThanOrEqual(0); // never pushed backward
  });
});

describe('fatality input parsing (P3.7)', () => {
  const winner = (frames: Partial6[]): FighterState => {
    const defs: Defs = { t: testChar('t', {}, {}) };
    const s = benchState(defs, 't', 't', 100);
    run(s, defs, (t) => frames[t] ?? {}, () => ({}), frames.length);
    return s.fighters[0];
  };
  const fat = (input: FatalityDef['input']): FatalityDef => ({ id: 'x', name: 'X', input, panels: 4 } as FatalityDef);

  it('an LPLK fatality does not throw and needs the chord', () => {
    expect(() => fatalityInputDone(winner([{}, {}, { lp: true, lk: true }]), fat({ button: 'LPLK' }))).not.toThrow();
    expect(fatalityInputDone(winner([{}, {}, { lp: true, lk: true }]), fat({ button: 'LPLK' }))).toBe(true);
    expect(fatalityInputDone(winner([{}, {}, { lp: true }]), fat({ button: 'LPLK' }))).toBe(false);
  });

  it('a mash fatality needs the mash count', () => {
    const taps: Partial6[] = [];
    for (let i = 0; i < 8; i++) taps.push({ lp: true }, {});
    taps.push({ lp: true });
    expect(fatalityInputDone(winner(taps), fat({ button: 'punch', mash: 5 }))).toBe(true);
    expect(fatalityInputDone(winner([{}, { lp: true }]), fat({ button: 'punch', mash: 5 }))).toBe(false);
  });

  it('a plain punch fatality still works', () => {
    expect(fatalityInputDone(winner([{}, { hp: true }]), fat({ button: 'punch' }))).toBe(true);
  });
});

describe('hashState covers every action kind (P3.7)', () => {
  it('taunt hashes differently from every other kind', () => {
    const defs: Defs = { t: testChar('t', {}, {}) };
    const base = benchState(defs, 't', 't', 100);
    const hashWith = (kind: FighterState['action']['kind']): number => {
      const s = structuredClone(base);
      s.fighters[0].action = { kind, frame: 0 } as FighterState['action'];
      return hashState(s);
    };
    const taunt = hashWith('taunt');
    for (const k of ['idle', 'ko', 'dazed', 'landing'] as const) expect(hashWith(k)).not.toBe(taunt);
  });
});
