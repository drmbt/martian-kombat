// P3.3 — the crouching hurtbox used to be chosen by `moveId.startsWith('c')`,
// so specials like chebel `ceremony`, kirby `cartwheel`, yulia
// `cossack-spiral` got the ~100 px shorter crouch box; and crouch-blockstun
// used the STANDING box. Stance now comes from the action itself.
import { describe, expect, it } from 'vitest';
import { characters } from '../data/characters';
import { benchState } from '../bench/sim';
import { defenderHurtRect } from './step';
import type { FighterState } from './index';

const s = benchState(characters, 'chebel', 'yulia', 200);
const chebel = characters.chebel;

function withAction(action: FighterState['action']): FighterState {
  return { ...s.fighters[0], action };
}
const h = (f: FighterState): number => { const r = defenderHurtRect(f, chebel); return r.b - r.t; };

describe('hurtbox stance (P3.3)', () => {
  const stand = h(withAction({ kind: 'idle', frame: 0 }));
  const crouch = h(withAction({ kind: 'crouch', frame: 0 }));

  it('the fixture really has two different boxes', () => {
    expect(crouch).toBeLessThan(stand);
  });

  it('a c-named SPECIAL keeps the standing box', () => {
    expect(h(withAction({ kind: 'attack', frame: 3, moveId: 'ceremony', hasHit: false }))).toBe(stand);
    expect(h(withAction({ kind: 'attack', frame: 3, moveId: 'crescent-moon', hasHit: false }))).toBe(stand);
  });

  it('crouching normals use the crouch box', () => {
    for (const id of ['clp', 'cmp', 'chp', 'clk', 'cmk', 'chk']) {
      expect(h(withAction({ kind: 'attack', frame: 3, moveId: id, hasHit: false })), id).toBe(crouch);
    }
  });

  it('crouch-blockstun keeps the crouch box; stand-blockstun the standing one', () => {
    expect(h(withAction({ kind: 'blockstun', frame: 8, guard: 'crouch' }))).toBe(crouch);
    expect(h(withAction({ kind: 'blockstun', frame: 8, guard: 'stand' }))).toBe(stand);
  });
});
