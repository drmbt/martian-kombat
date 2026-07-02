import { describe, expect, it } from 'vitest';
import { EMPTY_INPUT, FLOOR_Y, GameState, InputFrame, ROUND_TICKS, initialState, step } from './index';
import { characters } from '../data/characters';

const P1 = 'vincent';
const P2 = 'yulia';

function inp(partial: Partial<InputFrame> = {}): InputFrame {
  return { ...EMPTY_INPUT, ...partial };
}

function fresh(): GameState {
  const s = initialState(P1, P2, characters);
  s.phase = 'fight'; // skip intro in unit tests
  return s;
}

function run(s: GameState, ticks: number, p1: InputFrame = inp(), p2: InputFrame = inp()): void {
  for (let i = 0; i < ticks; i++) step(s, [p1, p2], characters);
}

/** stand the fighters at close range */
function closeRange(s: GameState): void {
  s.fighters[0].x = 450;
  s.fighters[1].x = 520;
}

/** P1 quarter-circle-forward + punch (P1 faces right in every test setup) */
function fireSpecial(s: GameState, p2: InputFrame = inp()): void {
  step(s, [inp({ down: true }), p2], characters);
  step(s, [inp({ down: true }), p2], characters);
  step(s, [inp({ right: true }), p2], characters);
  step(s, [inp({ right: true, lp: true }), p2], characters);
}

describe('determinism', () => {
  // scripted input as a pure function of tick — includes stray QCF shapes
  const script = (t: number): [InputFrame, InputFrame] => [
    inp({
      right: t % 90 < 45,
      down: t % 88 < 8,
      lp: t % 37 === 0,
      hk: t % 61 === 0,
      up: t % 173 === 0,
    }),
    inp({
      left: t % 70 < 30,
      down: t % 50 < 10,
      hp: t % 43 === 0,
      mk: t % 29 === 0,
    }),
  ];

  it('same inputs produce identical states', () => {
    const a = initialState(P1, P2, characters);
    const b = initialState(P1, P2, characters);
    const snapshotsA: string[] = [];
    const snapshotsB: string[] = [];
    for (let t = 0; t < 1200; t++) {
      step(a, script(t), characters);
      if (t % 100 === 0) snapshotsA.push(JSON.stringify(a));
    }
    for (let t = 0; t < 1200; t++) {
      step(b, script(t), characters);
      if (t % 100 === 0) snapshotsB.push(JSON.stringify(b));
    }
    expect(snapshotsA).toEqual(snapshotsB);
  });
});

describe('strikes', () => {
  it('jab (LP) connects at close range and causes damage', () => {
    const s = fresh();
    closeRange(s);
    step(s, [inp({ lp: true }), inp()], characters);
    run(s, 10);
    expect(s.fighters[1].health).toBe(characters[P2].health - characters[P1].moves.lp.damage);
  });

  it('heavier button wins when two are pressed together', () => {
    const s = fresh();
    closeRange(s);
    step(s, [inp({ lp: true, hp: true }), inp()], characters);
    expect(s.fighters[0].action.moveId).toBe('hp');
  });

  it('jab whiffs at full-screen range', () => {
    const s = fresh();
    step(s, [inp({ lp: true }), inp()], characters);
    run(s, 10);
    expect(s.fighters[1].health).toBe(characters[P2].health);
  });

  it('holding back blocks a mid and takes no damage', () => {
    const s = fresh();
    closeRange(s);
    const guard = inp({ right: true }); // P2 faces left, so back = right
    step(s, [inp({ lp: true }), guard], characters);
    run(s, 10, inp(), guard);
    expect(s.fighters[1].health).toBe(characters[P2].health);
    expect(s.fighters[1].x).toBeGreaterThan(520);
  });

  it('crouching HK sweep hits a standing blocker (lows must be crouch-blocked)', () => {
    const s = fresh();
    closeRange(s);
    const guard = inp({ right: true });
    step(s, [inp({ down: true, hk: true }), guard], characters);
    expect(s.fighters[0].action.moveId).toBe('chk');
    run(s, 15, inp(), guard);
    expect(s.fighters[1].health).toBeLessThan(characters[P2].health);
  });

  it('crouch-block stops the sweep (only chip damage gets through)', () => {
    const s = fresh();
    closeRange(s);
    const guard = inp({ right: true, down: true });
    step(s, [inp({ down: true, hk: true }), guard], characters);
    run(s, 15, inp(), guard);
    const chip = Math.floor(characters[P1].moves.chk.damage * 0.1);
    expect(s.fighters[1].health).toBe(characters[P2].health - chip);
  });

  it('sweep knocks down: defender becomes invulnerable while down', () => {
    const s = fresh();
    closeRange(s);
    step(s, [inp({ down: true, hk: true }), inp()], characters);
    run(s, 30);
    expect(['airHit', 'knockdown']).toContain(s.fighters[1].action.kind);
    const hpAfterKnockdown = s.fighters[1].health;
    step(s, [inp({ lp: true }), inp()], characters);
    run(s, 10);
    expect(s.fighters[1].health).toBe(hpAfterKnockdown);
  });

  it('crouching LP comes out while holding down and connects', () => {
    const s = fresh();
    closeRange(s);
    step(s, [inp({ down: true, lp: true }), inp()], characters);
    expect(s.fighters[0].action.moveId).toBe('clp');
    run(s, 10);
    expect(s.fighters[1].health).toBe(characters[P2].health - characters[P1].moves.clp.damage);
  });
});

describe('air attacks', () => {
  function jumpAndHk(guard: InputFrame): GameState {
    const s = fresh();
    // defender near the corner so holding back can't walk them out of range
    s.fighters[0].x = 800;
    s.fighters[1].x = 880;
    step(s, [inp({ up: true }), guard], characters);
    run(s, 25, inp(), guard); // past the apex, falling toward the defender
    step(s, [inp({ hk: true }), guard], characters); // fresh press mid-air
    expect(s.fighters[0].action.kind).toBe('airAttack');
    expect(s.fighters[0].action.moveId).toBe('jhk');
    run(s, 15, inp(), guard);
    return s;
  }

  it('air HK is an overhead: crouch-block does NOT stop it', () => {
    const s = jumpAndHk(inp({ right: true, down: true }));
    expect(s.fighters[1].health).toBeLessThan(characters[P2].health - 20);
  });

  it('air HK is blocked standing (chip only)', () => {
    const s = jumpAndHk(inp({ right: true }));
    const chip = Math.floor(characters[P1].moves.jhk.damage * 0.1);
    expect(s.fighters[1].health).toBe(characters[P2].health - chip);
  });

  it('landing cancels an air attack back to idle', () => {
    const s = fresh();
    step(s, [inp({ up: true }), inp()], characters);
    run(s, 13);
    step(s, [inp({ lk: true }), inp()], characters);
    run(s, 120);
    expect(s.fighters[0].y).toBe(FLOOR_Y);
    expect(['idle', 'walkF', 'walkB']).toContain(s.fighters[0].action.kind);
  });
});

describe('specials (quarter-circle-forward + punch)', () => {
  it('QCF+P fires the projectile', () => {
    const s = fresh();
    s.fighters[0].x = 300;
    s.fighters[1].x = 700;
    fireSpecial(s);
    expect(s.fighters[0].action.moveId).toBe('special');
    run(s, 90);
    expect(s.fighters[1].health).toBe(
      characters[P2].health - characters[P1].moves.special.projectile!.damage,
    );
    expect(s.projectiles).toHaveLength(0);
  });

  it('punch without the motion does NOT fire the special', () => {
    const s = fresh();
    s.fighters[0].x = 300;
    s.fighters[1].x = 700;
    step(s, [inp({ lp: true }), inp()], characters);
    expect(s.fighters[0].action.moveId).toBe('lp');
    expect(s.projectiles).toHaveLength(0);
  });

  it('only one projectile alive per owner (fireball rule)', () => {
    const s = fresh();
    s.fighters[0].x = 100;
    s.fighters[1].x = 860;
    for (let cycle = 0; cycle < 10; cycle++) fireSpecial(s);
    expect(s.projectiles.filter((p) => p.owner === 0).length).toBeLessThanOrEqual(1);
  });
});

describe('sprint 4 mechanics', () => {
  it('heavies chip through block; chip cannot KO', () => {
    const s = fresh();
    closeRange(s);
    const guard = inp({ right: true });
    step(s, [inp({ hp: true }), guard], characters);
    run(s, 20, inp(), guard);
    const expectedChip = Math.floor(characters[P1].moves.hp.damage * 0.1);
    expect(s.fighters[1].health).toBe(characters[P2].health - expectedChip);

    run(s, 40, inp(), guard);
    closeRange(s);
    s.fighters[1].health = 2;
    step(s, [inp({ hp: true }), guard], characters);
    run(s, 20, inp(), guard);
    expect(s.fighters[1].health).toBe(1); // floored, no chip KO
    expect(s.phase).toBe('fight');
  });

  it("catherine's Jazzper hits low: standing block loses, crouch block holds", () => {
    const setup = () => {
      const s = initialState('catherine', P2, characters);
      s.phase = 'fight';
      s.fighters[0].x = 300;
      s.fighters[1].x = 620;
      return s;
    };
    const stand = setup();
    const standGuard = inp({ right: true });
    fireSpecial(stand, standGuard);
    for (let i = 0; i < 80; i++) step(stand, [inp(), standGuard], characters);
    expect(stand.fighters[1].health).toBeLessThan(characters[P2].health - 10);

    const crouch = setup();
    const crouchGuard = inp({ right: true, down: true });
    fireSpecial(crouch, crouchGuard);
    for (let i = 0; i < 80; i++) step(crouch, [inp(), crouchGuard], characters);
    expect(crouch.fighters[1].health).toBe(
      characters[P2].health - Math.floor(characters.catherine.moves.special.projectile!.damage * 0.1),
    );
  });

  it("kirby's fire breath expires at short range (ttl)", () => {
    const s = initialState('kirby', P2, characters);
    s.phase = 'fight';
    s.fighters[0].x = 150;
    s.fighters[1].x = 800;
    fireSpecial(s);
    let maxProjectiles = 0;
    for (let i = 0; i < 60; i++) {
      step(s, [inp(), inp()], characters);
      maxProjectiles = Math.max(maxProjectiles, s.projectiles.length);
    }
    expect(maxProjectiles).toBe(1);
    expect(s.projectiles).toHaveLength(0);
    expect(s.fighters[1].health).toBe(characters[P2].health);
  });
});

describe('round flow', () => {
  it('KO ends the round and awards a win', () => {
    const s = fresh();
    closeRange(s);
    s.fighters[1].health = 10;
    step(s, [inp({ lp: true }), inp()], characters);
    run(s, 10);
    expect(s.phase).toBe('roundEnd');
    expect(s.wins[0]).toBe(1);
    expect(s.roundWinner).toBe(0);
    expect(s.fighters[1].action.kind).toBe('ko');
  });

  it('after a non-final round, a new round starts with reset health', () => {
    const s = fresh();
    closeRange(s);
    s.fighters[1].health = 10;
    step(s, [inp({ lp: true }), inp()], characters);
    run(s, 200);
    expect(s.phase).toBe('intro');
    expect(s.roundNumber).toBe(2);
    expect(s.fighters[1].health).toBe(characters[P2].health);
    expect(s.wins).toEqual([1, 0]);
  });

  it('second KO wins the match', () => {
    const s = fresh();
    s.wins = [1, 0];
    closeRange(s);
    s.fighters[1].health = 10;
    step(s, [inp({ lp: true }), inp()], characters);
    run(s, 400);
    expect(s.phase).toBe('matchEnd');
    expect(s.wins[0]).toBe(2);
  });

  it('time-up awards the round to the healthier fighter', () => {
    const s = fresh();
    s.timer = 5;
    s.fighters[1].health = 400;
    run(s, 10);
    expect(s.phase).toBe('roundEnd');
    expect(s.roundWinner).toBe(0);
  });

  it('timer only runs during fight phase', () => {
    const s = initialState(P1, P2, characters); // intro
    run(s, 30);
    expect(s.timer).toBe(ROUND_TICKS);
  });
});

describe('movement', () => {
  it('walking forward moves toward the opponent', () => {
    const s = fresh();
    const x0 = s.fighters[0].x;
    run(s, 20, inp({ right: true }), inp());
    expect(s.fighters[0].x).toBeGreaterThan(x0);
  });

  it('jump leaves the ground and lands back on the floor', () => {
    const s = fresh();
    step(s, [inp({ up: true }), inp()], characters);
    run(s, 10);
    expect(s.fighters[0].y).toBeLessThan(FLOOR_Y);
    run(s, 120);
    expect(s.fighters[0].y).toBe(FLOOR_Y);
    expect(s.fighters[0].action.kind).toBe('idle');
  });

  it('double-tap forward dashes farther than walking', () => {
    const walk = fresh();
    run(walk, 30, inp({ right: true }), inp());

    const dash = fresh();
    run(dash, 2, inp({ right: true }), inp());
    run(dash, 2, inp(), inp());
    run(dash, 26, inp({ right: true }), inp());

    expect(dash.fighters[0].x).toBeGreaterThan(walk.fighters[0].x + 20);
  });

  it('fighters cannot walk through each other (body push)', () => {
    const s = fresh();
    closeRange(s);
    run(s, 120, inp({ right: true }), inp());
    expect(s.fighters[0].x).toBeLessThan(s.fighters[1].x);
  });
});
