import { describe, expect, it } from 'vitest';
import { EMPTY_INPUT, GameState, InputFrame, initialState, step } from './index';
import type { CharacterDef, Defs } from './index';
import { characters } from '../data/characters';

const inp = (p: Partial<InputFrame> = {}): InputFrame => ({ ...EMPTY_INPUT, ...p });
const run = (s: GameState, chars: Defs, n: number, p1: InputFrame = inp(), p2: InputFrame = inp()): void => {
  for (let i = 0; i < n; i++) step(s, [p1, p2], chars);
};
const fresh = (chars: Defs = characters): GameState => {
  const s = initialState('vincent', 'yulia', chars);
  s.phase = 'fight';
  return s;
};

describe('projectile lifetime', () => {
  it('a projectile keeps flying after the spawning move has fully recovered', () => {
    const s = fresh();
    // far apart so the bolt flies through open space (does not hit P2 early)
    s.fighters[0].x = 300;
    s.fighters[1].x = 1120;
    // qcf + LP → Sigil Bolt
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ right: true }), inp()], characters);
    step(s, [inp({ right: true, lp: true }), inp()], characters);
    // sigil-bolt total ≈ startup13 + active2 + recovery24 = 39 ticks; run past it
    run(s, characters, 45);
    expect(s.fighters[0].action.kind).toBe('idle'); // the move has recovered…
    expect(s.projectiles.some((p) => p.owner === 0)).toBe(true); // …yet the bolt lives on
  });
});

describe('charge motions', () => {
  // inject a sonic-boom (cbf) projectile onto a copy of vincent
  const boomChars: Defs = {
    ...characters,
    vincent: {
      ...(characters.vincent as CharacterDef),
      moves: {
        ...characters.vincent.moves,
        boom: {
          name: 'Boom', input: { motion: 'cbf', button: 'punch' },
          startup: 10, active: 2, recovery: 20, damage: 0, hitstun: 0, blockstun: 0, knockback: 0,
          hitbox: null, height: 'mid',
          projectile: { vx: 8, spawnX: 80, spawnY: -150, box: { x: -20, y: -20, w: 40, h: 40 }, damage: 50, hitstun: 16, blockstun: 10, knockback: 8 },
        },
      },
    } as CharacterDef,
  };

  it('cbf sonic-boom fires after holding BACK then pressing FORWARD + punch', () => {
    const s = fresh(boomChars);
    s.fighters[0].x = 400;
    s.fighters[1].x = 1120; // stays to the right so P1 keeps facing right (back = left)
    run(s, boomChars, 50, inp({ left: true })); // bank the back-charge
    run(s, boomChars, 6, inp({ right: true, lp: true })); // release → forward + punch
    run(s, boomChars, 20); // let it reach the active frame + spawn
    expect(s.projectiles.some((p) => p.owner === 0 && p.moveId === 'boom')).toBe(true);
  });

  it('does NOT fire without the held charge (a quick back→forward is not enough)', () => {
    const s = fresh(boomChars);
    s.fighters[0].x = 400;
    s.fighters[1].x = 1120;
    run(s, boomChars, 3, inp({ left: true })); // only a brief tap of back — no charge
    run(s, boomChars, 6, inp({ right: true, lp: true }));
    run(s, boomChars, 20);
    expect(s.projectiles.some((p) => p.moveId === 'boom')).toBe(false);
  });
});
