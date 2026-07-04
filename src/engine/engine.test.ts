import { describe, expect, it } from 'vitest';
import {
  COUNTER_HITSTOP_BONUS,
  COUNTER_HITSTUN_MULT,
  DIZZY_TICKS,
  EMPTY_INPUT,
  FLOOR_Y,
  GETUP_TICKS,
  GameState,
  HITSTOP_HEAVY,
  HITSTOP_LIGHT,
  HITSTOP_SPECIAL,
  InputFrame,
  LANDING_TICKS,
  LANDING_WHIFF_TICKS,
  ROUND_TICKS,
  STUN_THRESHOLD,
  initialState,
  resolveMove,
  step,
} from './index';
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

describe('named specials with per-move motions', () => {
  it("QCF+P fires vincent's Sigil Bolt projectile", () => {
    const s = fresh();
    s.fighters[0].x = 300;
    s.fighters[1].x = 700;
    fireSpecial(s);
    expect(s.fighters[0].action.moveId).toBe('sigil-bolt');
    run(s, 90);
    expect(s.fighters[1].health).toBe(
      characters[P2].health - characters[P1].moves['sigil-bolt'].projectile!.damage,
    );
    expect(s.projectiles).toHaveLength(0);
  });

  it("QCB+K triggers vincent's Cloud Hands; QCB+P his Redirect", () => {
    const s = fresh();
    closeRange(s);
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ left: true }), inp()], characters); // P1 faces right: back = left
    step(s, [inp({ left: true, mk: true }), inp()], characters);
    expect(s.fighters[0].action.moveId).toBe('cloud-hands');

    const s2 = fresh();
    closeRange(s2);
    step(s2, [inp({ down: true }), inp()], characters);
    step(s2, [inp({ down: true }), inp()], characters);
    step(s2, [inp({ left: true }), inp()], characters);
    step(s2, [inp({ left: true, mp: true }), inp()], characters);
    expect(s2.fighters[0].action.moveId).toBe('redirect');
  });

  it('L and H Cossack Spiral trade travel for damage (SFII variants)', () => {
    const runSpiral = (btn: 'lk' | 'hk') => {
      const s = fresh();
      s.fighters[0].x = 800; // park P1 away; watch P2's spiral
      s.fighters[1].x = 400;
      const e = inp();
      // P2 (at 400) faces RIGHT toward P1 (parked at 800): back = left, fwd = right
      step(s, [e, inp({ left: true })], characters);
      step(s, [e, inp({ left: true })], characters);
      step(s, [e, inp({ right: true })], characters);
      step(s, [e, inp({ right: true, [btn]: true })], characters);
      expect(s.fighters[1].action.moveId).toBe('cossack-spiral');
      const m = resolveMove(characters[P2].moves['cossack-spiral'], s.fighters[1].action.strength);
      const x0 = s.fighters[1].x;
      run(s, 40);
      return { travel: s.fighters[1].x - x0, damage: m.damage };
    };
    const light = runSpiral('lk');
    const heavy = runSpiral('hk');
    expect(light.travel).toBeGreaterThan(heavy.travel + 50);
    expect(heavy.damage).toBeGreaterThan(light.damage);
  });

  it('Rising Glyph leaps like a shoryuken: airborne with the attack out, then lands', () => {
    const s = fresh();
    closeRange(s);
    step(s, [inp({ right: true }), inp()], characters);
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ right: true, down: true, hp: true }), inp()], characters);
    expect(s.fighters[0].action.moveId).toBe('rising-glyph');
    run(s, 10); // into the active window
    expect(s.fighters[0].action.kind).toBe('attack'); // still attacking...
    expect(s.fighters[0].y).toBeLessThan(FLOOR_Y);    // ...while rising
    run(s, 90);
    expect(s.fighters[0].y).toBe(FLOOR_Y);            // back down
    expect(['idle', 'air', 'walkF', 'walkB']).toContain(s.fighters[0].action.kind);
  });

  it('dp+P fires Rising Glyph and its i-frames beat a meaty jab', () => {
    const s = fresh();
    closeRange(s);
    // P2 starts a jab that will be active while P1 reverses
    step(s, [inp(), inp({ lp: true })], characters);
    // P1: dp = forward, down, forward+punch
    step(s, [inp({ right: true }), inp()], characters);
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ right: true, down: true, hp: true }), inp()], characters);
    expect(s.fighters[0].action.moveId).toBe('rising-glyph');
    run(s, 6);
    expect(s.fighters[0].health).toBe(characters[P1].health); // i-frames held
  });

  it('360+P Volga Piledriver grabs even a blocking opponent', () => {
    const s = fresh();
    s.fighters[0].x = 500;
    s.fighters[1].x = 580;
    const guard = inp({ left: true }); // P1 blocks (back = left... P1 faces right, so back is left)
    // P2 faces left: 360 simplified = down + back(right) + fwd(left) seen
    step(s, [guard, inp({ down: true })], characters);
    step(s, [guard, inp({ right: true })], characters);
    step(s, [guard, inp({ left: true })], characters);
    step(s, [guard, inp({ mp: true })], characters);
    expect(s.fighters[1].action.moveId).toBe('volga-piledriver');
    run(s, 12, guard, inp());
    expect(s.fighters[0].health).toBeLessThan(characters[P1].health - 100); // unblockable
  });

  it("Redirect reflects a projectile back at its owner", () => {
    const s = fresh();
    s.fighters[0].x = 300;
    s.fighters[1].x = 700;
    // P2 (yulia) has no projectile; use catherine vs vincent instead
    const s2 = initialState('catherine', 'vincent', characters);
    s2.phase = 'fight';
    s2.fighters[0].x = 300;
    s2.fighters[1].x = 700;
    // catherine throws H knives (3, full speed toward vincent)
    step(s2, [inp({ down: true }), inp()], characters);
    step(s2, [inp({ down: true }), inp()], characters);
    step(s2, [inp({ right: true }), inp()], characters);
    step(s2, [inp({ right: true, hp: true }), inp()], characters);
    for (let i = 0; i < 16; i++) step(s2, [inp(), inp()], characters); // ride out H startup
    expect(s2.projectiles.length).toBe(3);
    // vincent holds Redirect (H = long stance) as they arrive; qcb for P2 = down then back(right)
    for (let i = 0; i < 8; i++) step(s2, [inp(), inp()], characters);
    step(s2, [inp(), inp({ down: true })], characters);
    step(s2, [inp(), inp({ down: true })], characters);
    step(s2, [inp(), inp({ right: true })], characters);
    step(s2, [inp(), inp({ right: true, hp: true })], characters);
    expect(s2.fighters[1].action.moveId).toBe('redirect');
    let reflected = false;
    for (let i = 0; i < 60; i++) {
      step(s2, [inp(), inp()], characters);
      if (s2.projectiles.some((p) => p.owner === 1)) reflected = true;
    }
    expect(reflected).toBe(true);
  });

  it('Mise en Place knife count follows the button: L=1, H=3', () => {
    const throwKnives = (btn: 'lp' | 'hp') => {
      const s = initialState('catherine', P2, characters);
      s.phase = 'fight';
      s.fighters[0].x = 200;
      s.fighters[1].x = 860;
      step(s, [inp({ down: true }), inp()], characters);
      step(s, [inp({ down: true }), inp()], characters);
      step(s, [inp({ right: true }), inp()], characters);
      step(s, [inp({ right: true, [btn]: true }), inp()], characters);
      run(s, 15);
      return s.projectiles.length;
    };
    expect(throwKnives('lp')).toBe(1);
    expect(throwKnives('hp')).toBe(3);
  });

  it('Staff Vault launches Catherine airborne', () => {
    const s = initialState('catherine', P2, characters);
    s.phase = 'fight';
    // dp+K: forward, down, forward+kick
    step(s, [inp({ right: true }), inp()], characters);
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ right: true, down: true, mk: true }), inp()], characters);
    expect(s.fighters[0].action.moveId).toBe('staff-vault');
    run(s, 10);
    expect(s.fighters[0].y).toBeLessThan(FLOOR_Y);
    expect(s.fighters[0].action.kind).toBe('air');
  });

  it("back-forward + K triggers yulia's Cossack Spiral", () => {
    const s = fresh();
    closeRange(s);
    const e = inp();
    // P2 faces left: back = right, forward = left
    step(s, [e, inp({ right: true })], characters);
    step(s, [e, inp({ right: true })], characters);
    step(s, [e, inp({ left: true })], characters);
    step(s, [e, inp({ left: true, mk: true })], characters);
    expect(s.fighters[1].action.moveId).toBe('cossack-spiral');
  });

  it("QCB+K Backbend Guillotine is an overhead: beats crouch-block", () => {
    const s = fresh();
    s.fighters[0].x = 560;
    s.fighters[1].x = 640;
    const guard = inp({ left: true, down: true }); // P1 crouch-blocks (back = left... P1 faces right, back is left)
    // P2 faces left: qcb = down then back(right)
    step(s, [guard, inp({ down: true })], characters);
    step(s, [guard, inp({ down: true })], characters);
    step(s, [guard, inp({ right: true })], characters);
    step(s, [guard, inp({ right: true, hk: true })], characters);
    expect(s.fighters[1].action.moveId).toBe('backbend-guillotine');
    run(s, 25, guard, inp());
    expect(s.fighters[0].health).toBeLessThan(characters[P1].health - 20);
  });

  it('Braid Lariat (PPP) triggers with two punches a few ticks apart', () => {
    const s = fresh();
    closeRange(s);
    // human-realistic chord: mp lands 3 ticks after lp, both held
    step(s, [inp(), inp({ lp: true })], characters);
    step(s, [inp(), inp({ lp: true })], characters);
    step(s, [inp(), inp({ lp: true })], characters);
    step(s, [inp(), inp({ lp: true, mp: true })], characters);
    expect(s.fighters[1].action.moveId).toBe('braid-lariat');
  });

  it('punch without the motion does NOT fire a special', () => {
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

describe('fatality flow', () => {
  /** yulia (slot 1) lands the match-deciding KO on vincent */
  function decideMatch(): GameState {
    const s = fresh();
    s.wins = [0, 1];
    closeRange(s);
    s.fighters[0].health = 10;
    // P2 faces left: jab P1 out
    step(s, [inp(), inp({ lp: true })], characters);
    run(s, 6);
    return s;
  }

  it('match-deciding KO by a fatality-holder opens the finisher window', () => {
    const s = decideMatch();
    expect(s.phase).toBe('finisher');
    expect(s.fighters[0].action.kind).toBe('dazed');
    expect(s.wins[1]).toBe(2);
  });

  it('fatality input in range starts the cutscene, then matchEnd', () => {
    const s = decideMatch();
    // yulia: Heart Breaker = QCB+P; she faces left so back = right
    step(s, [inp(), inp({ down: true })], characters);
    step(s, [inp(), inp({ down: true })], characters);
    step(s, [inp(), inp({ right: true })], characters);
    step(s, [inp(), inp({ right: true, hp: true })], characters);
    expect(s.phase).toBe('fatality');
    expect(s.fatality).toEqual({ owner: 1, id: 'heart-breaker' });
    run(s, 470);
    expect(s.phase).toBe('matchEnd');
  });

  it('letting the window expire collapses the loser and ends the match', () => {
    const s = decideMatch();
    run(s, 380); // FINISHER_TICKS
    expect(['roundEnd', 'matchEnd']).toContain(s.phase);
    run(s, 200);
    expect(s.phase).toBe('matchEnd');
    expect(s.fatality).toBeNull();
  });

  it('a fighter with no fatality defined KOs straight to the normal round end', () => {
    // every roster fighter now owns a fatality, so strip one to exercise the
    // no-finisher KO branch (winner = kirby here)
    const defs = { ...characters, kirby: { ...characters.kirby, fatality: undefined } };
    const s = initialState('kirby', P2, defs);
    s.phase = 'fight';
    s.wins = [1, 0];
    closeRange(s);
    s.fighters[1].health = 10;
    step(s, [inp({ lp: true }), inp()], defs);
    for (let i = 0; i < 6; i++) step(s, [inp(), inp()], defs);
    expect(s.phase).toBe('roundEnd');
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

  it("catherine's Jazzper (QCB+P) hits low: standing block loses, crouch block holds", () => {
    const setup = () => {
      const s = initialState('catherine', P2, characters);
      s.phase = 'fight';
      s.fighters[0].x = 300;
      s.fighters[1].x = 620;
      return s;
    };
    // catherine faces right: QCB = ↓ then ← (back)
    const sendDog = (s: GameState, guard: InputFrame) => {
      step(s, [inp({ down: true }), guard], characters);
      step(s, [inp({ down: true }), guard], characters);
      step(s, [inp({ left: true }), guard], characters);
      step(s, [inp({ left: true, hp: true }), guard], characters);
      expect(s.fighters[0].action.moveId).toBe('order-up');
    };
    const stand = setup();
    const standGuard = inp({ right: true });
    sendDog(stand, standGuard);
    for (let i = 0; i < 90; i++) step(stand, [inp(), standGuard], characters);
    expect(stand.fighters[1].health).toBeLessThan(characters[P2].health - 10);

    const crouch = setup();
    const crouchGuard = inp({ right: true, down: true });
    sendDog(crouch, crouchGuard);
    for (let i = 0; i < 90; i++) step(crouch, [inp(), crouchGuard], characters);
    expect(crouch.fighters[1].health).toBe(
      characters[P2].health - Math.floor(characters.catherine.moves['order-up'].projectile!.damage * 0.1),
    );
  });

  it("catherine's Mise en Place (QCF+P) throws the knife fan as a mid", () => {
    const s = initialState('catherine', P2, characters);
    s.phase = 'fight';
    s.fighters[0].x = 300;
    s.fighters[1].x = 700;
    fireSpecial(s);
    expect(s.fighters[0].action.moveId).toBe('mise-en-place');
    run(s, 70);
    expect(s.fighters[1].health).toBe(
      characters[P2].health - characters.catherine.moves['mise-en-place'].projectile!.damage,
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
    run(s, 620); // finisher window (360) + collapse roundEnd (150) + margin
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

describe('match rules', () => {
  it('defaults to the classic 99s / best-of-3 rules', () => {
    const s = initialState(P1, P2, characters);
    expect(s.rules).toEqual({ roundTicks: ROUND_TICKS, winsNeeded: 2 });
    expect(s.timer).toBe(ROUND_TICKS);
  });

  it('custom round length counts down and carries into the next round', () => {
    const s = initialState(P1, P2, characters, { roundTicks: 5 });
    s.phase = 'fight';
    s.fighters[1].health = 400;
    run(s, 10);
    expect(s.phase).toBe('roundEnd');
    expect(s.roundWinner).toBe(0); // healthier fighter takes the time-up
    run(s, 200); // roundEnd -> next round
    expect(s.roundNumber).toBe(2);
    expect(s.timer).toBe(5);
  });

  it('roundTicks 0 disables the clock: no countdown, no time-up', () => {
    const s = initialState(P1, P2, characters, { roundTicks: 0 });
    s.phase = 'fight';
    run(s, 300);
    expect(s.timer).toBe(0);
    expect(s.phase).toBe('fight'); // still going — only a KO can end it
  });

  it('winsNeeded 1 ends the match after a single KO', () => {
    const s = initialState(P1, P2, characters, { winsNeeded: 1 });
    s.phase = 'fight';
    closeRange(s);
    s.fighters[1].health = 10;
    step(s, [inp({ lp: true }), inp()], characters);
    run(s, 620); // finisher window + collapse roundEnd + margin
    expect(s.phase).toBe('matchEnd');
    expect(s.wins[0]).toBe(1);
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

describe('flo: kernel panic kit (traps, fields, charge)', () => {
  function freshFlo(): GameState {
    const s = initialState('flo', 'yulia', characters);
    s.phase = 'fight';
    return s;
  }

  /** P1 half-circle-forward + punch (back, down, forward+LP) */
  function fireHcfPunch(s: GameState): void {
    step(s, [inp({ left: true }), inp()], characters);
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ right: true }), inp()], characters);
    step(s, [inp({ right: true, lp: true }), inp()], characters);
  }

  /** P1 quarter-circle-back + punch (down, back, back+LP) */
  function fireQcbPunch(s: GameState): void {
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ left: true }), inp()], characters);
    step(s, [inp({ left: true, lp: true }), inp()], characters);
  }

  it('hcf+P fires sudo kill, not Fork Bomb (longer motion wins by declaration order)', () => {
    const s = freshFlo();
    fireHcfPunch(s);
    expect(s.fighters[0].action.moveId).toBe('sudo-kill');
  });

  it('Fork Bomb arcs, lies dormant, then detonates into a damaging burst', () => {
    const s = freshFlo();
    fireSpecial(s); // qcf+LP
    expect(s.fighters[0].action.moveId).toBe('fork-bomb');
    run(s, 15); // past startup: the laptop is out
    const p = s.projectiles[0];
    expect(p.moveId).toBe('fork-bomb');
    expect(p.gravity).toBeGreaterThan(0);

    run(s, 30); // still in flight / armed on the ground
    expect(s.fighters[1].health).toBe(characters.yulia.health); // dormant: no contact damage

    run(s, 120); // landing + fuse + burst
    expect(s.fighters[1].health).toBe(characters.yulia.health - 90);
  });

  it('Smokescreen is a harmless field and does not block Fork Bomb (one-projectile rule exemption)', () => {
    const s = freshFlo();
    fireQcbPunch(s);
    expect(s.fighters[0].action.moveId).toBe('smokescreen');
    run(s, 20); // past startup
    expect(s.projectiles).toHaveLength(1);
    expect(s.projectiles[0].field).toBe(true);
    expect(s.projectiles[0].damage).toBe(0);

    run(s, 25); // recover, then throw the bomb through the smoke
    fireSpecial(s);
    run(s, 15);
    expect(s.projectiles).toHaveLength(2); // smoke + laptop coexist
    expect(s.fighters[1].health).toBe(characters.yulia.health); // smoke never hit anyone
  });

  it('Root Access needs a banked down-charge, then pops the opponent up', () => {
    const s = freshFlo();
    run(s, 50, inp({ down: true }), inp()); // bank the charge
    step(s, [inp({ up: true, lk: true }), inp()], characters);
    expect(s.fighters[0].action.moveId).toBe('root-access');

    run(s, 15); // past startup: the cable trap is out (L version: 140 in front)
    const trap = s.projectiles[0];
    expect(trap.moveId).toBe('root-access');
    expect(trap.vx).toBe(0);

    // the opponent walks into the snare and gets launched
    run(s, 60, inp(), inp({ left: true }));
    expect(s.fighters[1].health).toBe(characters.yulia.health - 70);
    const kind = s.fighters[1].action.kind;
    expect(['airHit', 'knockdown', 'getup'].includes(kind)).toBe(true);
  });

  it('down-up without enough charge is just a kick', () => {
    const s = freshFlo();
    run(s, 5, inp({ down: true }), inp()); // nowhere near CHARGE_TICKS
    step(s, [inp({ up: true, lk: true }), inp()], characters);
    expect(s.fighters[0].action.moveId).toBe('lk');
  });

  it('the charge bleeds away after releasing down', () => {
    const s = freshFlo();
    run(s, 50, inp({ down: true }), inp());
    run(s, 10, inp(), inp()); // idle: charge decays fast
    step(s, [inp({ up: true, lk: true }), inp()], characters);
    expect(s.fighters[0].action.moveId).not.toBe('root-access');
  });
});

describe('flo fatality: Burn One', () => {
  it('qcb+P in the finisher fires the fatality even though Smokescreen shares the input', () => {
    const s = initialState('flo', 'yulia', characters);
    s.phase = 'fight';
    s.wins = [1, 0];
    s.fighters[0].x = 450;
    s.fighters[1].x = 520;
    s.fighters[1].health = 10;
    step(s, [inp({ lp: true }), inp()], characters);
    run(s, 8);
    expect(s.phase).toBe('finisher');

    // flo faces right: qcb = down, left; punch finishes it
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ left: true }), inp()], characters);
    step(s, [inp({ left: true, hp: true }), inp()], characters);
    expect(s.phase).toBe('fatality');
    expect(s.fatality).toEqual({ owner: 0, id: 'burn-one' });
  });
});

describe('marzipan: photosynthesizer kit (delayed traps, tick clouds, drain grab)', () => {
  function freshMarz(): GameState {
    const s = initialState('marzipan', 'yulia', characters);
    s.phase = 'fight';
    return s;
  }

  it('Overgrowth plants a dormant seed that erupts into a vine column and pops the opponent', () => {
    const s = freshMarz();
    // qcf + HP: the H seed lands at 360 in front — right on P2's spawn (660)
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ right: true }), inp()], characters);
    step(s, [inp({ right: true, hp: true }), inp()], characters);
    expect(s.fighters[0].action.moveId).toBe('overgrowth');

    run(s, 16); // past startup: seed planted, fuse ticking
    expect(s.projectiles[0].moveId).toBe('overgrowth');
    run(s, 10); // fuse (30) not yet done
    expect(s.fighters[1].health).toBe(characters.yulia.health); // dormant seed is harmless

    run(s, 40); // fuse expires -> vine column burst
    expect(s.fighters[1].health).toBe(characters.yulia.health - 85);
    expect(['airHit', 'knockdown', 'getup']).toContain(s.fighters[1].action.kind);
  });

  it('Spore Bloom lingers and ticks damage more than once', () => {
    const s = freshMarz();
    closeRange(s);
    // qcb + LP (no forward input, so the hcb grab cannot steal it)
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ left: true }), inp()], characters);
    step(s, [inp({ left: true, lp: true }), inp()], characters);
    expect(s.fighters[0].action.moveId).toBe('spore-bloom');

    run(s, 130);
    // at least two ticks of 18 landed and the cloud survived its hits
    expect(s.fighters[1].health).toBeLessThanOrEqual(characters.yulia.health - 36);
  });

  it('Symbiosis grab drains the victim and heals marzipan', () => {
    const s = freshMarz();
    closeRange(s);
    s.fighters[0].health = 500;
    // hcb + HP: forward, down, back, punch
    step(s, [inp({ right: true }), inp()], characters);
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ left: true }), inp()], characters);
    step(s, [inp({ left: true, hp: true }), inp()], characters);
    expect(s.fighters[0].action.moveId).toBe('symbiosis');

    run(s, 15);
    expect(s.fighters[1].health).toBe(characters.yulia.health - 140); // H variant
    expect(s.fighters[0].health).toBe(560); // +60 kudzu drain
  });

  it('the heal never overfills max health', () => {
    const s = freshMarz();
    closeRange(s);
    step(s, [inp({ right: true }), inp()], characters);
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ left: true }), inp()], characters);
    step(s, [inp({ left: true, lp: true }), inp()], characters);
    run(s, 15);
    expect(s.fighters[0].health).toBe(characters.marzipan.health); // was already full
  });
});

describe('gene: prompt injection kit (teleports, slow field, fake clone)', () => {
  function freshGene(): GameState {
    const s = initialState('gene', 'yulia', characters);
    s.phase = 'fight';
    return s;
  }

  /** P1 dragon punch motion: forward, down, forward (+ buttons on the last) */
  function dpMotion(s: GameState, last: Partial<InputFrame>): void {
    step(s, [inp({ right: true }), inp()], characters);
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ right: true, ...last }), inp()], characters);
  }

  it('Diffusion (dp+2P chord) blinks behind the opponent with i-frames', () => {
    const s = freshGene();
    dpMotion(s, { lp: true });
    step(s, [inp({ right: true, lp: true, mp: true }), inp()], characters);
    expect(s.fighters[0].action.moveId).toBe('diffusion-strike');
    const before = s.fighters[0].x;
    run(s, 16); // past startup: the blink happened
    expect(s.fighters[0].x).toBeGreaterThan(s.fighters[1].x); // crossed to the far side
    expect(s.fighters[0].x).not.toBe(before);
  });

  it('Diffusion escape (dp+2K) retreats to his own corner', () => {
    const s = freshGene();
    dpMotion(s, { lk: true });
    step(s, [inp({ right: true, lk: true, mk: true }), inp()], characters);
    expect(s.fighters[0].action.moveId).toBe('diffusion-escape');
    run(s, 14);
    expect(s.fighters[0].x).toBeLessThan(100); // back wall (faces right -> retreats left)
  });

  it('Rate Limit field slows enemy projectiles inside it', () => {
    // gene (P2, faces left) drops the field; yulia-side P1 is vincent for a fireball
    const s = initialState('vincent', 'gene', characters);
    s.phase = 'fight';
    // gene: qcb+P — he faces left, so back = right
    step(s, [inp(), inp({ down: true })], characters);
    step(s, [inp(), inp({ right: true })], characters);
    step(s, [inp(), inp({ right: true, lp: true })], characters);
    expect(s.fighters[1].action.moveId).toBe('rate-limit');
    run(s, 16); // field out
    const field = s.projectiles.find((p) => p.field);
    expect(field?.slowFactor).toBe(0.35);

    // vincent fires sigil bolt into the field
    fireSpecial(s);
    run(s, 16); // past sigil-bolt startup
    const bolt = s.projectiles.find((p) => !p.field);
    expect(bolt).toBeDefined();
    const x0 = bolt!.x;
    run(s, 10);
    const insideSpeed = (bolt!.x - x0) / 10;
    expect(Math.abs(insideSpeed)).toBeLessThan(Math.abs(bolt!.vx) * 0.6); // crawling
  });

  it('Hallucination clone walks harmlessly, then pops for damage', () => {
    const s = freshGene();
    s.fighters[1].x = 560; // stand where the clone pops (~500 + margin)
    fireSpecial(s); // qcf+LP -> L clone, vx 1.5
    expect(s.fighters[0].action.moveId).toBe('hallucination');
    run(s, 20);
    const clone = s.projectiles[0];
    expect(clone.moveId).toBe('hallucination');
    run(s, 20); // mid-walk: dormant, no contact damage even overlapping
    expect(s.fighters[1].health).toBe(characters.yulia.health);
    run(s, 60); // fuse (55) expires -> pop
    expect(s.fighters[1].health).toBe(characters.yulia.health - 60);
  });

  it('a real projectile clashes the dormant clone out of existence', () => {
    const s = initialState('gene', 'vincent', characters);
    s.phase = 'fight';
    fireSpecial(s); // gene qcf+LP: clone out
    run(s, 16);
    expect(s.projectiles).toHaveLength(1);
    // vincent (faces left): qcf = down, left; fire sigil bolt at the clone
    step(s, [inp(), inp({ down: true })], characters);
    step(s, [inp(), inp({ down: true })], characters);
    step(s, [inp(), inp({ left: true })], characters);
    step(s, [inp(), inp({ left: true, lp: true })], characters);
    run(s, 40);
    // both died in the clash: clone never popped, bolt never reached gene
    expect(s.projectiles).toHaveLength(0);
    expect(s.fighters[0].health).toBe(characters.gene.health);
  });
});

describe('hitstop (per-fighter, sprint 18)', () => {
  /** step until the defender's health drops; returns ticks waited */
  function stepUntilContact(s: GameState, p1: InputFrame = inp()): number {
    const before = s.fighters[1].health;
    for (let t = 0; t < 60; t++) {
      step(s, [p1, inp()], characters);
      if (s.fighters[1].health < before) return t;
    }
    throw new Error('no contact within 60 ticks');
  }

  it('a melee hit freezes BOTH fighters for HITSTOP_LIGHT ticks', () => {
    const s = fresh();
    closeRange(s);
    step(s, [inp({ lp: true }), inp()], characters);
    stepUntilContact(s);
    expect(s.fighters[0].hitstop).toBe(HITSTOP_LIGHT);
    expect(s.fighters[1].hitstop).toBe(HITSTOP_LIGHT);

    // frozen: nobody moves, stun doesn't tick down, the clock holds
    const x0 = s.fighters[0].x;
    const stun = s.fighters[1].action.frame;
    const timer = s.timer;
    step(s, [inp({ right: true }), inp()], characters); // held walk is ignored
    expect(s.fighters[0].x).toBe(x0);
    expect(s.fighters[1].action.frame).toBe(stun);
    expect(s.timer).toBe(timer);
    expect(s.fighters[1].hitstop).toBe(HITSTOP_LIGHT - 1);

    // thaw: the world resumes (stun ticks again)
    run(s, HITSTOP_LIGHT - 1);
    expect(s.fighters[1].hitstop).toBe(0);
    step(s, [inp(), inp()], characters);
    expect(s.fighters[1].action.frame).toBe(stun - 1);
  });

  it('scales with button strength: heavy freezes longer than light', () => {
    const s = fresh();
    closeRange(s);
    step(s, [inp({ hp: true }), inp()], characters);
    stepUntilContact(s);
    expect(s.fighters[1].hitstop).toBe(HITSTOP_HEAVY);
    expect(HITSTOP_HEAVY).toBeGreaterThan(HITSTOP_LIGHT);
  });

  it('a projectile freezes the VICTIM only — the shooter keeps moving', () => {
    const s = fresh();
    s.fighters[0].x = 300;
    s.fighters[1].x = 700;
    fireSpecial(s); // vincent qcf+LP -> sigil bolt
    // ride out the attack recovery, then walk while the bolt travels
    const before = s.fighters[1].health;
    let landed = false;
    for (let t = 0; t < 90 && !landed; t++) {
      step(s, [inp({ right: true }), inp()], characters);
      landed = s.fighters[1].health < before;
    }
    expect(landed).toBe(true);
    expect(s.fighters[1].hitstop).toBe(HITSTOP_SPECIAL);
    expect(s.fighters[0].hitstop).toBe(0);
    expect(HITSTOP_SPECIAL).toBeGreaterThan(HITSTOP_HEAVY);

    // during the victim's freeze the shooter still walks; the victim's
    // hitstun clock holds
    const x0 = s.fighters[0].x;
    const reel = s.fighters[1].action.frame;
    run(s, 2, inp({ right: true }), inp());
    expect(s.fighters[0].x).toBeGreaterThan(x0);
    expect(s.fighters[1].action.frame).toBe(reel);
  });

  it('a second hit never SHORTENS an existing freeze (trades keep the longest)', () => {
    const s = fresh();
    closeRange(s);
    s.fighters[1].hitstop = 20; // pretend a meatier freeze is already running
    step(s, [inp({ lp: true }), inp()], characters);
    run(s, 10);
    // the jab's light freeze must not clobber the longer one
    expect(s.fighters[1].hitstop).toBeGreaterThan(HITSTOP_LIGHT);
  });

  it('blocked contact freezes too, and resetRound clears any leftover freeze', () => {
    const s = fresh();
    closeRange(s);
    const guard = inp({ right: true }); // P2 faces left: back = right
    step(s, [inp({ hp: true }), guard], characters);
    for (let t = 0; t < 60 && s.fighters[1].action.kind !== 'blockstun'; t++) {
      step(s, [inp(), guard], characters);
    }
    expect(s.fighters[1].action.kind).toBe('blockstun');
    expect(s.fighters[1].hitstop).toBe(HITSTOP_HEAVY);

    // KO into round reset: the next round starts unfrozen
    run(s, 40); // let the freeze + blockstun + pushback settle
    closeRange(s);
    s.fighters[1].health = 1;
    s.fighters[0].hitstop = 0;
    s.fighters[1].hitstop = 0;
    step(s, [inp({ hp: true }), inp()], characters);
    stepUntilContact(s);
    expect(s.phase).toBe('roundEnd');
    expect(s.fighters[1].hitstop).toBe(HITSTOP_HEAVY); // the KO hit still lands its freeze
    run(s, 400); // freeze + roundEnd beat + reset
    expect(s.phase).not.toBe('roundEnd');
    expect(s.fighters[0].hitstop).toBe(0);
    expect(s.fighters[1].hitstop).toBe(0);
  });
});

describe('universal throw (LP+LK)', () => {
  const chord = inp({ lp: true, lk: true });

  it('LP+LK on the same tick picks the throw, not a normal', () => {
    const s = fresh();
    closeRange(s);
    step(s, [chord, inp()], characters);
    expect(s.fighters[0].action.moveId).toBe('throw');
  });

  it('staggered LP then LP+LK upgrades the jab into the throw', () => {
    const s = fresh();
    closeRange(s);
    step(s, [inp({ lp: true }), inp()], characters);
    expect(s.fighters[0].action.moveId).toBe('lp');
    step(s, [chord, inp()], characters);
    expect(s.fighters[0].action.moveId).toBe('throw');
  });

  it('throws through block: unblockable damage + knockdown', () => {
    const s = fresh();
    closeRange(s);
    // crouch-block: guards everything blockable without walking backward
    // (a back-WALKING blocker legitimately retreats out of throw range)
    const guard = inp({ right: true, down: true });
    step(s, [chord, guard], characters);
    run(s, 45, inp(), guard);
    expect(s.fighters[1].health).toBe(
      characters[P2].health - characters[P1].moves.throw.damage,
    );
    expect(['airHit', 'knockdown', 'getup']).toContain(s.fighters[1].action.kind);
  });

  it('whiffs at full-screen range', () => {
    const s = fresh();
    step(s, [chord, inp()], characters);
    run(s, 40);
    expect(s.pendingThrow).toBeNull();
    expect(s.fighters[1].health).toBe(characters[P2].health);
  });

  it('whiffs against an airborne opponent', () => {
    const s = fresh();
    closeRange(s);
    run(s, 6, inp(), inp({ up: true })); // P2 leaves the ground
    expect(s.fighters[1].y).toBeLessThan(FLOOR_Y);
    step(s, [chord, inp()], characters);
    run(s, 10);
    expect(s.pendingThrow).toBeNull();
    expect(s.fighters[1].health).toBe(characters[P2].health);
  });

  it('whiffs against a victim already in hitstun', () => {
    const s = fresh();
    closeRange(s);
    s.fighters[1].action = { kind: 'hitstun', frame: 40 };
    step(s, [chord, inp()], characters);
    run(s, 12);
    expect(s.pendingThrow).toBeNull();
    expect(s.fighters[1].health).toBe(characters[P2].health);
  });

  it('victim LP+LK inside the window techs: no damage, both bounce apart', () => {
    const s = fresh();
    closeRange(s);
    for (let i = 0; i < 12 && !s.pendingThrow; i++) step(s, [chord, inp()], characters);
    expect(s.pendingThrow).not.toBeNull();
    const x0 = s.fighters[0].x;
    const x1 = s.fighters[1].x;
    // victim mashes the chord (press/release alternating beats holding)
    for (let i = 0; i < 20 && s.pendingThrow; i++) {
      step(s, [inp(), i % 2 ? inp() : chord], characters);
    }
    expect(s.pendingThrow).toBeNull();
    run(s, 15);
    expect(s.fighters[0].health).toBe(characters[P1].health);
    expect(s.fighters[1].health).toBe(characters[P2].health);
    expect(s.fighters[0].x).toBeLessThan(x0); // attacker bounced back
    expect(s.fighters[1].x).toBeGreaterThan(x1); // victim pushed away
  });

  it('no tech input: the window expires and the throw lands', () => {
    const s = fresh();
    closeRange(s);
    for (let i = 0; i < 12 && !s.pendingThrow; i++) step(s, [chord, inp()], characters);
    expect(s.pendingThrow).not.toBeNull();
    run(s, 40);
    expect(s.pendingThrow).toBeNull();
    expect(s.fighters[1].health).toBeLessThan(characters[P2].health);
  });

  it('throw inputs are deterministic: same script → identical states', () => {
    const script = (t: number): [InputFrame, InputFrame] => [
      inp({
        right: t % 50 < 20,
        lp: t % 23 === 0 || t % 23 === 1,
        lk: t % 23 === 1 || t % 29 === 0,
      }),
      inp({
        left: t % 40 < 15,
        lp: t % 31 === 0,
        lk: t % 31 === 0,
        down: t % 77 < 6,
      }),
    ];
    const a = initialState(P1, P2, characters);
    const b = initialState(P1, P2, characters);
    const snapA: string[] = [];
    const snapB: string[] = [];
    for (let t = 0; t < 1500; t++) {
      step(a, script(t), characters);
      if (t % 100 === 0) snapA.push(JSON.stringify(a));
    }
    for (let t = 0; t < 1500; t++) {
      step(b, script(t), characters);
      if (t % 100 === 0) snapB.push(JSON.stringify(b));
    }
    expect(snapA).toEqual(snapB);
  });
});

describe('dizzy/stun', () => {
  it('connecting hits build stun; blocked hits do not', () => {
    const s = fresh();
    closeRange(s);
    step(s, [inp({ lp: true }), inp()], characters);
    run(s, 8);
    expect(s.fighters[1].stun).toBeGreaterThan(0);

    const s2 = fresh();
    closeRange(s2);
    const guard = inp({ right: true });
    step(s2, [inp({ lp: true }), guard], characters);
    run(s2, 8, inp(), guard);
    expect(s2.fighters[1].stun).toBe(0);
  });

  it('stun decays back to zero over time', () => {
    const s = fresh();
    closeRange(s);
    step(s, [inp({ lp: true }), inp()], characters);
    run(s, 8);
    const peak = s.fighters[1].stun;
    run(s, 60);
    expect(s.fighters[1].stun).toBeLessThan(peak);
    run(s, 200);
    expect(s.fighters[1].stun).toBe(0);
  });

  it('crossing the threshold dizzies when the reel ends; the daze expires and resets stun', () => {
    const s = fresh();
    closeRange(s);
    s.fighters[1].stun = STUN_THRESHOLD; // one jab from dizzy
    step(s, [inp({ lp: true }), inp()], characters);
    run(s, 25); // hitstun runs out inside this
    expect(s.fighters[1].action.kind).toBe('dazed');
    run(s, DIZZY_TICKS + 5);
    expect(s.fighters[1].action.kind).toBe('idle');
    expect(s.fighters[1].stun).toBe(0);
  });

  it('a dazed fighter cannot block and the punish ends the dizzy without re-triggering', () => {
    const s = fresh();
    closeRange(s);
    s.fighters[1].action = { kind: 'dazed', frame: 0 };
    s.fighters[1].stun = STUN_THRESHOLD + 50; // stale meter from the trigger
    const hp = s.fighters[1].health;
    const guard = inp({ right: true }); // held back does nothing while dazed
    step(s, [inp({ lp: true }), guard], characters);
    run(s, 10, inp(), guard);
    expect(s.fighters[1].health).toBeLessThan(hp); // fully vulnerable
    expect(s.fighters[1].stun).toBe(0); // the punish resets the meter
    run(s, 30);
    expect(s.fighters[1].action.kind).toBe('idle'); // no instant second dizzy
  });

  it('a dizzied opponent can be thrown (the dizzy punish path)', () => {
    const s = fresh();
    closeRange(s);
    s.fighters[1].action = { kind: 'dazed', frame: 0 };
    s.fighters[1].stun = STUN_THRESHOLD + 50;
    const chord = inp({ lp: true, lk: true });
    for (let i = 0; i < 12 && !s.pendingThrow; i++) step(s, [chord, inp()], characters);
    expect(s.pendingThrow).not.toBeNull();
    run(s, 40);
    expect(s.fighters[1].health).toBe(
      characters[P2].health - characters[P1].moves.throw.damage,
    );
    run(s, 80); // land + knockdown + getup
    expect(s.fighters[1].action.kind).not.toBe('dazed'); // stun was reset by the throw
  });
});

describe('action input buffer (sprint 18)', () => {
  /** step until a predicate holds; throws if it never does */
  function until(
    s: GameState,
    pred: (s: GameState) => boolean,
    max: number,
    p1: InputFrame = inp(),
    p2: InputFrame = inp(),
  ): void {
    for (let t = 0; t < max; t++) {
      if (pred(s)) return;
      step(s, [p1, p2], characters);
    }
    if (!pred(s)) throw new Error(`predicate never held within ${max} ticks`);
  }

  it('a press during blockstun comes out on the first actionable frame', () => {
    const s = fresh();
    closeRange(s);
    const guard = inp({ right: true }); // P2 faces left: back = right
    step(s, [inp({ lp: true }), guard], characters);
    // ride into the tail of P2's blockstun (inside the buffer window)
    until(
      s,
      (st) => st.fighters[1].action.kind === 'blockstun'
        && st.fighters[1].action.frame <= 5 && st.fighters[1].hitstop === 0,
      60, inp(), guard,
    );
    // one tap, then nothing but held guard — the press must survive the reel
    step(s, [inp(), inp({ right: true, lp: true })], characters);
    until(s, (st) => st.fighters[1].action.kind === 'attack', 12, inp(), guard);
    expect(s.fighters[1].action.moveId).toBe('lp');
  });

  it('the buffered press fires once, never twice', () => {
    const s = fresh();
    closeRange(s);
    const guard = inp({ right: true });
    step(s, [inp({ lp: true }), guard], characters);
    until(
      s,
      (st) => st.fighters[1].action.kind === 'blockstun'
        && st.fighters[1].action.frame <= 5 && st.fighters[1].hitstop === 0,
      60, inp(), guard,
    );
    step(s, [inp(), inp({ lp: true })], characters);
    // count P2 attack starts across the whole aftermath
    let starts = 0;
    let wasAttack = false;
    for (let t = 0; t < 90; t++) {
      step(s, [inp(), inp()], characters);
      const isAttack = s.fighters[1].action.kind === 'attack';
      if (isAttack && !wasAttack) starts++;
      wasAttack = isAttack;
    }
    expect(starts).toBe(1);
  });

  it('a press too far ahead of the actionable frame expires unconsumed', () => {
    const s = fresh();
    closeRange(s);
    step(s, [inp({ down: true, hk: true }), inp()], characters); // sweep P2 down
    until(s, (st) => st.fighters[1].action.kind === 'knockdown', 90);
    // tap at the very START of the knockdown — way more than the buffer ahead
    step(s, [inp(), inp({ lp: true })], characters);
    let attacked = false;
    for (let t = 0; t < 120; t++) {
      step(s, [inp(), inp()], characters);
      if (s.fighters[1].action.kind === 'attack') attacked = true;
    }
    expect(attacked).toBe(false);
  });

  it('wakeup reversal: dp+P buffered during getup fires on the first actionable frame', () => {
    const s = fresh();
    closeRange(s);
    s.fighters[0].action = { kind: 'getup', frame: 0 };
    // feed the dp motion so the punch press lands late in the getup
    run(s, GETUP_TICKS - 6);
    step(s, [inp({ right: true }), inp()], characters);
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ right: true, down: true, hp: true }), inp()], characters);
    expect(s.fighters[0].action.kind).toBe('getup'); // still waking up
    until(s, (st) => st.fighters[0].action.kind === 'attack', 12);
    expect(s.fighters[0].action.moveId).toBe('rising-glyph'); // the reversal, not a plain HP
  });

  it('landing buffer: a press during landing recovery attacks the moment it ends', () => {
    const s = fresh();
    step(s, [inp({ up: true }), inp()], characters);
    until(s, (st) => st.fighters[0].action.kind === 'landing', 120);
    step(s, [inp({ lp: true }), inp()], characters);
    expect(s.fighters[0].action.kind).toBe('landing'); // no attack mid-landing
    until(s, (st) => st.fighters[0].action.kind === 'attack', LANDING_TICKS + 3);
    expect(s.fighters[0].action.moveId).toBe('lp');
  });
});

describe('counterhits (sprint 18)', () => {
  /** P1 jabs P2 out of P2's own HP startup; returns state at contact */
  function counterJab(): GameState {
    const s = fresh();
    closeRange(s);
    // both press together: P1's jab is faster than P2's heavy
    step(s, [inp({ lp: true }), inp({ hp: true })], characters);
    const before = s.fighters[1].health;
    for (let t = 0; t < 20 && s.fighters[1].health === before; t++) {
      step(s, [inp(), inp()], characters);
    }
    expect(s.fighters[1].health).toBeLessThan(before);
    return s;
  }

  it('a defender clipped during their attack startup eats bonus hitstun and the counter flag', () => {
    const s = counterJab();
    const d = s.fighters[1];
    expect(d.action.kind).toBe('hitstun');
    expect(d.action.counter).toBe(true);
    expect(d.action.frame).toBe(
      Math.floor(characters[P1].moves.lp.hitstun * COUNTER_HITSTUN_MULT),
    );
  });

  it('the counter adds bonus hitstop to the victim only', () => {
    const s = counterJab();
    expect(s.fighters[1].hitstop).toBe(HITSTOP_LIGHT + COUNTER_HITSTOP_BONUS);
    expect(s.fighters[0].hitstop).toBe(HITSTOP_LIGHT); // attacker keeps the base freeze
  });

  it('a neutral hit is NOT a counter', () => {
    const s = fresh();
    closeRange(s);
    step(s, [inp({ lp: true }), inp()], characters);
    const before = s.fighters[1].health;
    for (let t = 0; t < 20 && s.fighters[1].health === before; t++) {
      step(s, [inp(), inp()], characters);
    }
    const d = s.fighters[1];
    expect(d.action.counter).toBeUndefined();
    expect(d.action.frame).toBe(characters[P1].moves.lp.hitstun);
    expect(d.hitstop).toBe(HITSTOP_LIGHT);
  });
});

describe('landing recovery (sprint 18)', () => {
  it('an empty jump lands with LANDING_TICKS of recovery before idle', () => {
    const s = fresh();
    step(s, [inp({ up: true }), inp()], characters);
    let sawLanding = false;
    for (let t = 0; t < 120 && !sawLanding; t++) {
      step(s, [inp(), inp()], characters);
      if (s.fighters[0].action.kind === 'landing') sawLanding = true;
    }
    expect(sawLanding).toBe(true);
    expect(s.fighters[0].action.frame).toBe(LANDING_TICKS);
    run(s, LANDING_TICKS);
    expect(s.fighters[0].action.kind).toBe('idle');
  });

  it('a whiffed air normal eats the longer landing recovery', () => {
    const s = fresh(); // full-screen: the air kick hits nothing
    step(s, [inp({ up: true }), inp()], characters);
    // wait until falling and close to the floor, then swing
    for (let t = 0; t < 120; t++) {
      const f = s.fighters[0];
      if (f.action.kind === 'air' && f.vy > 0 && f.y > FLOOR_Y - 80) break;
      step(s, [inp(), inp()], characters);
    }
    step(s, [inp({ hk: true }), inp()], characters);
    expect(s.fighters[0].action.kind).toBe('airAttack');
    let sawLanding = false;
    for (let t = 0; t < 60 && !sawLanding; t++) {
      step(s, [inp(), inp()], characters);
      if (s.fighters[0].action.kind === 'landing') sawLanding = true;
    }
    expect(sawLanding).toBe(true);
    expect(s.fighters[0].action.frame).toBe(LANDING_WHIFF_TICKS);
  });

  it('an air normal that CONNECTED lands with only the short recovery', () => {
    const s = fresh();
    // defender near the corner (same shape as the jump-in block tests)
    s.fighters[0].x = 800;
    s.fighters[1].x = 880;
    const guard = inp({ right: true }); // stand-blocks the overhead
    step(s, [inp({ up: true, right: true }), guard], characters);
    for (let t = 0; t < 25; t++) step(s, [inp(), guard], characters);
    step(s, [inp({ hk: true }), guard], characters);
    expect(s.fighters[0].action.kind).toBe('airAttack');
    let sawLanding = false;
    for (let t = 0; t < 90 && !sawLanding; t++) {
      step(s, [inp(), guard], characters);
      if (s.fighters[0].action.kind === 'landing') sawLanding = true;
    }
    expect(sawLanding).toBe(true);
    expect(s.fighters[0].action.frame).toBe(LANDING_TICKS);
  });
});

describe('ground-impact bounce (sprint 18)', () => {
  it('a knockdown rebounds off the floor once before settling', () => {
    const s = fresh();
    closeRange(s);
    step(s, [inp({ down: true, hk: true }), inp()], characters); // sweep
    // ride until the victim has bounced (flag set at first floor contact)
    let bounceTick = -1;
    for (let t = 0; t < 90; t++) {
      step(s, [inp(), inp()], characters);
      const a = s.fighters[1].action;
      if (a.kind === 'airHit' && a.bounced) {
        bounceTick = t;
        break;
      }
    }
    expect(bounceTick).toBeGreaterThan(-1);
    step(s, [inp(), inp()], characters);
    expect(s.fighters[1].y).toBeLessThan(FLOOR_Y); // back off the floor
    // ...and the second contact settles into the knockdown
    let kind = s.fighters[1].action.kind as string;
    for (let t = 0; t < 60 && kind !== 'knockdown'; t++) {
      step(s, [inp(), inp()], characters);
      kind = s.fighters[1].action.kind;
    }
    expect(kind).toBe('knockdown');
    expect(s.fighters[1].y).toBe(FLOOR_Y);
  });

  it('the victim is invulnerable during the bounce', () => {
    const s = fresh();
    closeRange(s);
    step(s, [inp({ down: true, hk: true }), inp()], characters);
    for (let t = 0; t < 90; t++) {
      step(s, [inp(), inp()], characters);
      const a = s.fighters[1].action;
      if (a.kind === 'airHit' && a.bounced) break;
    }
    const hp = s.fighters[1].health;
    step(s, [inp({ lp: true }), inp()], characters);
    run(s, 10);
    expect(s.fighters[1].health).toBe(hp); // the jab whiffed through the bounce
  });

  it('a thrown victim bounces too', () => {
    const s = fresh();
    closeRange(s);
    const chord = inp({ lp: true, lk: true });
    for (let i = 0; i < 12 && !s.pendingThrow; i++) step(s, [chord, inp()], characters);
    expect(s.pendingThrow).not.toBeNull();
    let bounced = false;
    for (let t = 0; t < 120 && !bounced; t++) {
      step(s, [inp(), inp()], characters);
      const a = s.fighters[1].action;
      bounced = a.kind === 'airHit' && a.bounced === true;
    }
    expect(bounced).toBe(true);
  });
});

describe('cancels & chains (Sprint 19)', () => {
  /** step until P1's current attack has contacted (hit or block) */
  function runUntilContact(s: GameState, p2: InputFrame = inp(), max = 30): void {
    for (let i = 0; i < max && !s.fighters[0].action.hasHit; i++) {
      step(s, [inp(), p2], characters);
    }
    expect(s.fighters[0].action.hasHit).toBe(true);
  }

  /** true once P1 is in a fresh attack with the given move (a cancel resets
   *  frame + hasHit, so this can only follow a cancel mid-string) */
  function inFreshAttack(s: GameState, moveId: string): boolean {
    const a = s.fighters[0].action;
    return a.kind === 'attack' && a.moveId === moveId && !a.hasHit;
  }

  it('a light chains into a light on hit', () => {
    const s = fresh();
    closeRange(s);
    step(s, [inp({ lp: true }), inp()], characters);
    runUntilContact(s);
    step(s, [inp({ lp: true }), inp()], characters); // second tap: chain
    let chained = false;
    for (let i = 0; i < 8 && !chained; i++) {
      chained = inFreshAttack(s, 'lp');
      if (!chained) step(s, [inp(), inp()], characters);
    }
    expect(chained).toBe(true);
    run(s, 20); // both jabs land clean, hits 1-2 unscaled
    expect(s.fighters[1].health).toBe(characters[P2].health - 2 * characters[P1].moves.lp.damage);
  });

  it('a light chains on block too', () => {
    const s = fresh();
    closeRange(s);
    const guard = inp({ right: true }); // P2 faces left: back = right
    step(s, [inp({ lp: true }), guard], characters);
    runUntilContact(s, guard);
    step(s, [inp({ lp: true }), guard], characters);
    let chained = false;
    for (let i = 0; i < 8 && !chained; i++) {
      chained = inFreshAttack(s, 'lp');
      if (!chained) step(s, [inp(), guard], characters);
    }
    expect(chained).toBe(true);
  });

  it('a whiffed light never chains (frame counts through uninterrupted)', () => {
    const s = fresh(); // full-screen: the jab whiffs
    step(s, [inp({ lp: true }), inp()], characters);
    run(s, 2);
    step(s, [inp({ lp: true }), inp()], characters); // tap during the whiff
    let lastFrame = s.fighters[0].action.frame;
    while (s.fighters[0].action.kind === 'attack') {
      step(s, [inp(), inp()], characters);
      const a = s.fighters[0].action;
      if (a.kind === 'attack') {
        expect(a.frame).toBeGreaterThan(lastFrame); // no reset = no cancel
        lastFrame = a.frame;
      }
    }
  });

  it('lights do not special-cancel (chains only)', () => {
    const s = fresh();
    closeRange(s);
    step(s, [inp({ lp: true }), inp()], characters);
    runUntilContact(s);
    // qcf+P buffered during the jab
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ right: true }), inp()], characters);
    step(s, [inp({ right: true, lp: true }), inp()], characters);
    let sawSpecialMidMove = false;
    for (let i = 0; i < 10; i++) {
      if (s.fighters[0].action.kind !== 'attack') break;
      if (s.fighters[0].action.moveId === 'sigil-bolt') sawSpecialMidMove = true;
      step(s, [inp(), inp()], characters);
    }
    expect(sawSpecialMidMove).toBe(false);
  });

  it('a medium special-cancels into a fireball on hit', () => {
    const s = fresh();
    closeRange(s);
    step(s, [inp({ mp: true }), inp()], characters);
    runUntilContact(s);
    fireSpecial(s); // qcf+P during the mp — buffered, then canceled into
    let canceled = false;
    for (let i = 0; i < 10 && !canceled; i++) {
      canceled = s.fighters[0].action.kind === 'attack' && s.fighters[0].action.moveId === 'sigil-bolt';
      if (!canceled) step(s, [inp(), inp()], characters);
    }
    expect(canceled).toBe(true);
    run(s, 60); // the canceled-into bolt comes out and combos
    expect(s.fighters[1].health).toBeLessThan(characters[P2].health - characters[P1].moves.mp.damage);
  });

  it('a medium special-cancels on block', () => {
    const s = fresh();
    closeRange(s);
    const guard = inp({ right: true });
    step(s, [inp({ mp: true }), guard], characters);
    runUntilContact(s, guard);
    step(s, [inp({ down: true }), guard], characters);
    step(s, [inp({ down: true }), guard], characters);
    step(s, [inp({ right: true }), guard], characters);
    step(s, [inp({ right: true, lp: true }), guard], characters);
    let canceled = false;
    for (let i = 0; i < 10 && !canceled; i++) {
      canceled = s.fighters[0].action.kind === 'attack' && s.fighters[0].action.moveId === 'sigil-bolt';
      if (!canceled) step(s, [inp(), guard], characters);
    }
    expect(canceled).toBe(true);
  });

  it('a whiffed medium never cancels (buffer expires before the move ends)', () => {
    const s = fresh(); // full-screen whiff
    step(s, [inp({ mp: true }), inp()], characters);
    fireSpecial(s); // qcf+P early in the whiff
    let sawBolt = false;
    for (let i = 0; i < 45; i++) {
      if (s.fighters[0].action.moveId === 'sigil-bolt') sawBolt = true;
      step(s, [inp(), inp()], characters);
    }
    expect(sawBolt).toBe(false);
    expect(s.projectiles.length).toBe(0);
  });
});

describe('combo damage scaling (Sprint 19)', () => {
  /** mash jab: alternate press/release so every other tick is a fresh press —
   *  chains keep the string true as long as the victim stays reeling */
  function mash(t: number): InputFrame {
    return inp({ lp: t % 2 === 0 });
  }

  it('hits 1-2 land full, later hits scale down 10% per hit', () => {
    const s = fresh();
    closeRange(s);
    const deltas: number[] = [];
    let hp = s.fighters[1].health;
    for (let t = 0; t < 90; t++) {
      step(s, [mash(t), inp()], characters);
      if (s.fighters[1].health < hp) {
        deltas.push(hp - s.fighters[1].health);
        hp = s.fighters[1].health;
      }
    }
    const jab = characters[P1].moves.lp.damage; // 45
    expect(deltas.length).toBeGreaterThanOrEqual(5);
    expect(deltas.slice(0, 5)).toEqual([
      jab,
      jab,
      Math.floor(jab * 0.9),
      Math.floor(jab * 0.8),
      Math.floor(jab * 0.7),
    ]);
  });

  it('scaling floors at 30%', () => {
    const s = fresh();
    closeRange(s);
    // seed a deep combo: victim mid-reel, nine hits already eaten
    s.fighters[1].action = { kind: 'hitstun', frame: 300 };
    s.fighters[1].comboHits = 9;
    const hp = s.fighters[1].health;
    step(s, [inp({ lp: true }), inp()], characters);
    run(s, 10);
    const jab = characters[P1].moves.lp.damage;
    expect(s.fighters[1].health).toBe(hp - Math.floor(jab * 0.3)); // hit 10: floored
    expect(s.fighters[1].comboHits).toBe(10);
  });

  it('dropping the combo resets scaling to full', () => {
    const s = fresh();
    closeRange(s);
    let hp = s.fighters[1].health;
    let hits = 0;
    for (let t = 0; t < 90 && hits < 4; t++) {
      step(s, [mash(t), inp()], characters);
      if (s.fighters[1].health < hp) {
        hits++;
        hp = s.fighters[1].health;
      }
    }
    expect(hits).toBe(4); // a real scaled string happened
    // let the victim fully recover — the combo drops
    run(s, 60);
    expect(s.fighters[1].action.kind).not.toBe('hitstun');
    closeRange(s);
    hp = s.fighters[1].health;
    step(s, [inp({ lp: true }), inp()], characters);
    run(s, 15);
    expect(s.fighters[1].health).toBe(hp - characters[P1].moves.lp.damage); // full again
  });

  it('chained strings stay deterministic', () => {
    const script = (t: number): [InputFrame, InputFrame] => [
      inp({
        lp: t % 2 === 0 && t % 90 < 40,
        down: t % 90 >= 40 && t % 90 < 46,
        right: t % 90 >= 46 && t % 90 < 52,
        mp: t % 90 === 52,
      }),
      inp({ left: t % 60 < 20, lk: t % 2 === 1 && t % 70 < 30 }),
    ];
    const a = initialState(P1, P2, characters);
    const b = initialState(P1, P2, characters);
    a.phase = 'fight';
    b.phase = 'fight';
    for (let t = 0; t < 1200; t++) step(a, script(t), characters);
    for (let t = 0; t < 1200; t++) step(b, script(t), characters);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('personality specials (Sprint 20)', () => {
  describe('mash input (Cat Scratch)', () => {
    it('five quick punch presses trigger the mash special', () => {
      const s = initialState('kirby', 'yulia', characters);
      s.phase = 'fight';
      let saw = false;
      for (let t = 0; t < 60 && !saw; t++) {
        step(s, [inp({ lp: t % 2 === 0 }), inp()], characters);
        saw = s.fighters[0].action.moveId === 'cat-scratch';
      }
      expect(saw).toBe(true);
    });

    it('a single press stays a plain jab', () => {
      const s = initialState('kirby', 'yulia', characters);
      s.phase = 'fight';
      step(s, [inp({ lp: true }), inp()], characters);
      expect(s.fighters[0].action.moveId).toBe('lp');
      let saw = false;
      for (let t = 0; t < 40; t++) {
        step(s, [inp(), inp()], characters);
        if (s.fighters[0].action.moveId === 'cat-scratch') saw = true;
      }
      expect(saw).toBe(false);
    });
  });

  describe('melee rehit (multi-hit activations)', () => {
    it('one Cat Scratch activation hits several times, scaling as a combo', () => {
      const s = initialState('kirby', 'yulia', characters);
      s.phase = 'fight';
      closeRange(s);
      s.fighters[0].action = { kind: 'attack', frame: 0, moveId: 'cat-scratch', hasHit: false };
      const deltas: number[] = [];
      let hp = s.fighters[1].health;
      for (let t = 0; t < 90; t++) {
        step(s, [inp(), inp()], characters);
        if (s.fighters[1].health < hp) {
          deltas.push(hp - s.fighters[1].health);
          hp = s.fighters[1].health;
        }
      }
      const dmg = characters.kirby.moves['cat-scratch'].damage;
      expect(deltas.length).toBeGreaterThanOrEqual(3); // one press, many hits
      expect(deltas[0]).toBe(dmg);
      expect(deltas[2]).toBeLessThan(dmg); // combo scaling kicks in on hit 3
    });

    it('a rehit move chips through block repeatedly', () => {
      const s = initialState('kirby', 'yulia', characters);
      s.phase = 'fight';
      closeRange(s);
      s.fighters[0].action = { kind: 'attack', frame: 0, moveId: 'cat-scratch', hasHit: false };
      const guard = inp({ right: true });
      let drops = 0;
      let brokeGuard = false;
      let hp = s.fighters[1].health;
      for (let t = 0; t < 90; t++) {
        step(s, [inp(), guard], characters);
        if (s.fighters[1].health < hp) {
          drops++;
          hp = s.fighters[1].health;
        }
        const k = s.fighters[1].action.kind;
        if (k === 'hitstun' || k === 'airHit') brokeGuard = true;
      }
      expect(drops).toBeGreaterThanOrEqual(2); // repeated chip ticks
      expect(brokeGuard).toBe(false); // the guard held throughout
    });
  });

  describe('pull projectile (Vine Spear)', () => {
    /** P1 marzipan fires vine spear: back, back, forward, forward+P */
    function spear(s: GameState, p2: InputFrame = inp()): void {
      step(s, [inp({ left: true }), p2], characters);
      step(s, [inp({ left: true }), p2], characters);
      step(s, [inp({ right: true }), p2], characters);
      step(s, [inp({ right: true, lp: true }), p2], characters);
    }

    it('an unblocked spear drags the victim to the owner and knocks down', () => {
      const s = initialState('marzipan', 'yulia', characters);
      s.phase = 'fight';
      s.fighters[0].x = 200;
      s.fighters[1].x = 700;
      spear(s);
      expect(s.fighters[0].action.moveId).toBe('vine-spear');
      run(s, 60);
      expect(Math.abs(s.fighters[1].x - s.fighters[0].x)).toBeLessThanOrEqual(110);
      expect(['airHit', 'knockdown', 'getup']).toContain(s.fighters[1].action.kind);
      expect(s.fighters[1].health).toBeLessThan(characters.yulia.health);
    });

    it('a blocked spear does not drag', () => {
      const s = initialState('marzipan', 'yulia', characters);
      s.phase = 'fight';
      s.fighters[0].x = 200;
      s.fighters[1].x = 700;
      const guard = inp({ right: true }); // P2 faces left: back = right
      spear(s, guard);
      run(s, 60, inp(), guard);
      expect(s.fighters[1].x).toBeGreaterThan(500); // stayed far away
      expect(s.fighters[1].action.kind).not.toBe('knockdown');
    });
  });

  describe('yoga float (slow-fall)', () => {
    /** P1 freeman floats: down, down, back, back+P (qcb) */
    function float(s: GameState): void {
      step(s, [inp({ down: true }), inp()], characters);
      step(s, [inp({ down: true }), inp()], characters);
      step(s, [inp({ left: true }), inp()], characters);
      step(s, [inp({ left: true, lp: true }), inp()], characters);
    }

    function airTicks(s: GameState, launch: () => void): number {
      launch();
      let ticks = 0;
      // wait for liftoff (startup), then count airborne ticks
      for (let t = 0; t < 40 && s.fighters[0].action.kind !== 'air'; t++) {
        step(s, [inp(), inp()], characters);
      }
      while (s.fighters[0].y < FLOOR_Y && ticks < 600) {
        step(s, [inp(), inp()], characters);
        ticks++;
      }
      return ticks;
    }

    it('floats far longer than a normal jump and lands clean', () => {
      const a = initialState('freeman', 'yulia', characters);
      a.phase = 'fight';
      const floatTicks = airTicks(a, () => float(a));
      expect(a.fighters[0].floatGravity).toBe(0); // cleared on touchdown

      const b = initialState('freeman', 'yulia', characters);
      b.phase = 'fight';
      const jumpTicks = airTicks(b, () => step(b, [inp({ up: true }), inp()], characters));
      expect(floatTicks).toBeGreaterThan(jumpTicks * 1.5);
    });

    it('getting hit knocks the float out', () => {
      const s = initialState('freeman', 'yulia', characters);
      s.phase = 'fight';
      closeRange(s);
      float(s);
      for (let t = 0; t < 40 && s.fighters[0].action.kind !== 'air'; t++) {
        step(s, [inp(), inp()], characters);
      }
      expect(s.fighters[0].floatGravity).toBeGreaterThan(0);
      // yulia anti-airs him out of the float
      let hit = false;
      for (let t = 0; t < 120 && !hit; t++) {
        step(s, [inp(), inp({ hp: true })], characters);
        hit = s.fighters[0].action.kind === 'airHit';
        step(s, [inp(), inp()], characters);
        hit = hit || s.fighters[0].action.kind === 'airHit';
      }
      expect(hit).toBe(true);
      expect(s.fighters[0].floatGravity).toBe(0);
    });
  });

  describe('matrix teleport', () => {
    it('vincent reappears behind the opponent', () => {
      const s = fresh(); // vincent vs yulia
      s.fighters[0].x = 300;
      s.fighters[1].x = 600;
      // qcf+K
      step(s, [inp({ down: true }), inp()], characters);
      step(s, [inp({ down: true }), inp()], characters);
      step(s, [inp({ right: true }), inp()], characters);
      step(s, [inp({ right: true, lk: true }), inp()], characters);
      expect(s.fighters[0].action.moveId).toBe('matrix-teleport');
      run(s, 20);
      expect(s.fighters[0].x).toBeGreaterThan(s.fighters[1].x); // crossed to the far side
    });
  });
});

describe('cat kit (wet paint)', () => {
  function freshCat(): GameState {
    const s = initialState('cat', 'yulia', characters);
    s.phase = 'fight';
    s.fighters[0].x = 450;
    s.fighters[1].x = 600;
    return s;
  }
  // P1 faces right: back = left, forward = right
  function hcfPunch(s: GameState): void {
    step(s, [inp({ left: true }), inp()], characters);
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ right: true }), inp()], characters);
    step(s, [inp({ right: true, lp: true }), inp()], characters);
  }
  function qcfPunch(s: GameState): void {
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ right: true }), inp()], characters);
    step(s, [inp({ right: true, lp: true }), inp()], characters);
  }
  function qcbPunch(s: GameState): void {
    step(s, [inp({ down: true }), inp()], characters);
    step(s, [inp({ left: true }), inp()], characters);
    step(s, [inp({ left: true, lp: true }), inp()], characters);
  }

  it('hcf+P fires D. Catarina, not Flour Bomb (longer motion wins by declaration order)', () => {
    const s = freshCat();
    hcfPunch(s);
    expect(s.fighters[0].action.moveId).toBe('d-catarina');
  });

  it('qcf+P lays a Flour Bomb slow-field puddle (no-damage field)', () => {
    const s = freshCat();
    qcfPunch(s);
    expect(s.fighters[0].action.moveId).toBe('flour-bomb');
    run(s, 15);
    const p = s.projectiles[0];
    expect(p.moveId).toBe('flour-bomb');
    expect(p.field).toBe(true);
    expect(p.slowFactor).toBeGreaterThan(0);
    expect(p.damage).toBe(0);
  });

  it('qcb+P lashes Thread of Life — a knockdown projectile that damages', () => {
    const s = freshCat();
    s.fighters[1].x = 980; // out of reach so the lash is still airborne when inspected
    qcbPunch(s);
    expect(s.fighters[0].action.moveId).toBe('thread-of-life');
    run(s, 16);
    const p = s.projectiles[0];
    expect(p.moveId).toBe('thread-of-life');
    expect(p.knockdown).toBe(true);
    expect(p.field).toBe(false);
    expect(p.damage).toBeGreaterThan(0);
  });

  it('cat vs cat is deterministic across a scripted string', () => {
    const script = (t: number): [InputFrame, InputFrame] => [
      inp({ right: t % 40 < 20, down: t % 30 < 6, lp: t % 17 === 0, mk: t % 23 === 0 }),
      inp({ left: t % 33 < 15, down: t % 41 < 9, hp: t % 19 === 0 }),
    ];
    const a = initialState('cat', 'cat', characters);
    const b = initialState('cat', 'cat', characters);
    for (let t = 0; t < 600; t++) step(a, script(t), characters);
    for (let t = 0; t < 600; t++) step(b, script(t), characters);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });
});
