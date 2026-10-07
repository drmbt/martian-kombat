// The deterministic fight core: step(state, inputs, defs) advances exactly one
// 60hz tick. Same state + same inputs => same result, always. No Phaser, no
// randomness, no wall clock — this is what makes replay/rollback possible.
//
// P3.9 split the 1,600-line tick into modules: world (geometry, camera, state
// queries), input (motions, chords, attack picking), attack (the per-fighter
// state machine), combat (hits, blocks, trades, combo limits), projectiles,
// phases (construction + round flow). This file is the tick itself plus the
// historical re-exports.

import {
  GameState,
  InputFrame,
} from './types';
import {
  ACTION_BUFFER_TICKS,
  CHARGE_RELEASE_TICKS,
  CHARGE_TICKS,
  DASH_REGEN_TICKS,
  DASH_STOCKS,
  FATALITY_RANGE,
  FATALITY_TICKS,
  FINISHER_TICKS,
  INPUT_BUFFER_LEN,
  JUGGLE_POINTS,
  INTRO_TICKS,
  ROUND_END_TICKS,
  STUN_DECAY,
  THROW_TECH_PUSH,
  THROW_TECH_RECOIL,
} from './constants';
import { Defs, worldBox, overlaps, cameraX, arenaBounds, resolveMove, mirrorTeleportPhases, BUFFERABLE, canAct, isInvulnerable, grounded, koPop } from './world';
import { BIT, packInput, unpackInput, throwChord, fatalityInputDone, anyFreshButton, pickAttack, cleanSocd } from './input';
import { updateFighter } from './attack';
import { defenderHurtRect, hitstopFor, applyHit, resolveAttacks } from './combat';
import { updateProjectiles } from './projectiles';
import { initialState, resetRound, endRound, passivePhysics } from './phases';

// historical surface (index.ts and a few tests import these from './step')
export type { Defs } from './world';
export { worldBox, cameraX, arenaBounds, resolveMove, mirrorTeleportPhases } from './world';
export { BIT, packInput, unpackInput, cleanSocd, fatalityInputDone } from './input';
export { defenderHurtRect } from './combat';
export { initialState } from './phases';

export function step(s: GameState, rawInputs: [InputFrame, InputFrame], defs: Defs): GameState {
  s.tick++;
  const inputs: [InputFrame, InputFrame] = [cleanSocd(rawInputs[0]), cleanSocd(rawInputs[1])];

  for (const slot of [0, 1] as const) {
    const f = s.fighters[slot];
    const buf = f.inputBuffer;
    buf.push(packInput(inputs[slot]));
    if (buf.length > INPUT_BUFFER_LEN) buf.shift();
    // MUGEN charge: count the hold streak (4-way — down counts whatever the
    // horizontal, back counts whatever the vertical); releasing a streak that
    // reached CHARGE_TICKS banks it for CHARGE_RELEASE_TICKS, a short one
    // is simply gone (no bleed)
    f.chargeWindow = Math.max(0, f.chargeWindow - 1);
    f.backChargeWindow = Math.max(0, f.backChargeWindow - 1);
    if (inputs[slot].down) f.charge = Math.min(f.charge + 1, 600);
    else {
      if (f.charge >= CHARGE_TICKS) f.chargeWindow = CHARGE_RELEASE_TICKS;
      f.charge = 0;
    }
    const backHeld = f.facing === 1 ? inputs[slot].left : inputs[slot].right;
    if (backHeld) f.backCharge = Math.min(f.backCharge + 1, 600);
    else {
      if (f.backCharge >= CHARGE_TICKS) f.backChargeWindow = CHARGE_RELEASE_TICKS;
      f.backCharge = 0;
    }
    // dash stock regen: one at a time, only while short (see DASH_STOCKS)
    if (f.dashStocks < DASH_STOCKS && ++f.dashRegen >= DASH_REGEN_TICKS) {
      f.dashStocks++;
      f.dashRegen = 0;
    }
    // action buffer: a button tapped while unactionable (or frozen in
    // hitstop) resolves its attack pick NOW — motions and chords are read at
    // press time so wakeup reversals keep their input window — and fires on
    // the first actionable frame. Newest press wins; TTL drops stale ones.
    // The TTL pauses while this fighter is frozen in hitstop (IKEMEN
    // Input.PauseOnHitPause) — otherwise a cancel pressed early in a long
    // hitstop expired before the freeze ended (P3.5).
    if (f.buffered && f.hitstop <= 0 && --f.buffered.ticksLeft <= 0) f.buffered = null;
    if (
      s.phase === 'fight' &&
      (BUFFERABLE.has(f.action.kind) || f.hitstop > 0) &&
      anyFreshButton(f)
    ) {
      const pick = pickAttack(s, slot, defs[f.charId], inputs[slot], inputs[slot].down ? 'crouch' : 'stand');
      if (pick) f.buffered = { id: pick.id, strength: pick.strength, ticksLeft: ACTION_BUFFER_TICKS };
    }
  }

  // outside the fight phase, any leftover freeze stops the whole world — the
  // KO hit's dramatic pause carries into roundEnd/finisher exactly as before.
  // (Inputs keep buffering above so motions finished mid-freeze still count.)
  if (s.phase !== 'fight' && (s.fighters[0].hitstop > 0 || s.fighters[1].hitstop > 0)) {
    for (const f of s.fighters) if (f.hitstop > 0) f.hitstop--;
    return s;
  }

  if (s.phase === 'intro') {
    const introLen = s.roundNumber === 1 ? s.rules.introTicks : INTRO_TICKS;
    s.phaseFrame++;
    if (s.phaseFrame >= introLen) {
      s.phase = 'fight';
      s.phaseFrame = 0;
    }
    return s;
  }

  if (s.phase === 'roundEnd') {
    s.phaseFrame++;
    for (const slot of [0, 1] as const) {
      passivePhysics(s.fighters[slot], defs[s.fighters[slot].charId], arenaBounds(s));
    }
    if (s.phaseFrame >= ROUND_END_TICKS) {
      if (s.roundWinner !== null && s.wins[s.roundWinner] >= s.rules.winsNeeded) {
        s.phase = 'matchEnd';
        s.phaseFrame = 0;
      } else {
        resetRound(s, defs);
      }
    }
    return s;
  }

  if (s.phase === 'finisher') {
    s.phaseFrame++;
    const w = s.roundWinner as 0 | 1;
    const loser = w === 0 ? 1 : 0;
    const winner = s.fighters[w];
    const winnerDef = defs[winner.charId];

    // winner stays controllable (walk into range, style on them); nothing
    // can deal damage anymore
    updateFighter(s, w, winnerDef, inputs[w]);
    s.projectiles = [];
    const wb = arenaBounds(s);
    winner.x = Math.min(wb.maxX, Math.max(wb.minX, winner.x));
    if (canAct(winner) && grounded(winner)) {
      winner.facing = s.fighters[loser].x >= winner.x ? 1 : -1;
    }

    const fat = winnerDef.fatality;
    if (
      fat &&
      fatalityInputDone(winner, fat) &&
      Math.abs(winner.x - s.fighters[loser].x) <= (fat.range ?? FATALITY_RANGE)
    ) {
      s.phase = 'fatality';
      s.phaseFrame = 0;
      s.fatality = { owner: w, id: fat.id };
      winner.action = { kind: 'idle', frame: 0 };
      return s;
    }

    // Fumbled fatality (MK behavior): if the winner instead just lands a normal
    // attack on the dazed loser, they collapse and the round ends — no fatality.
    // (The clean fatality input above already got first refusal this tick.)
    const wa = winner.action;
    if ((wa.kind === 'attack' || wa.kind === 'airAttack') && wa.moveId && !wa.hasHit) {
      const m = resolveMove(winnerDef.moves[wa.moveId], wa.strength);
      const active = wa.frame >= m.startup && wa.frame < m.startup + m.active;
      const l = s.fighters[loser];
      if (
        active &&
        m.hitbox &&
        overlaps(worldBox(winner, m.hitbox), defenderHurtRect(l, defs[l.charId]))
      ) {
        wa.hasHit = true;
        koPop(l, winner.facing); // knocked away from the winner
        s.phase = 'roundEnd';
        s.phaseFrame = 0;
        return s;
      }
    }

    if (s.phaseFrame >= FINISHER_TICKS) {
      // mercy: no fatality input — the loser just collapses
      const l = s.fighters[loser];
      koPop(l, -l.facing);
      s.phase = 'roundEnd';
      s.phaseFrame = 0;
    }
    return s;
  }

  if (s.phase === 'fatality') {
    s.phaseFrame++;
    if (s.phaseFrame >= FATALITY_TICKS) {
      s.phase = 'matchEnd';
      s.phaseFrame = 0;
    }
    return s;
  }

  if (s.phase === 'matchEnd') {
    s.phaseFrame++;
    return s;
  }

  // --- phase: fight ---
  const [f1, f2] = s.fighters;

  // per-fighter hitstop: a frozen fighter skips their update entirely this
  // tick (no action frames, no physics, no stun decay); the other side keeps
  // moving — that's the SF fireball asymmetry. Projectiles keep flying.
  const frozen: [boolean, boolean] = [f1.hitstop > 0, f2.hitstop > 0];
  for (const f of s.fighters) if (f.hitstop > 0) f.hitstop--;

  // universal throw mid-hold: the victim's own LP+LK inside the window techs
  // it (both bounce back, no damage); expiry lands the unblockable knockdown.
  // The grab thunk's freeze pauses the tech window along with everything else.
  if (s.pendingThrow && !frozen[s.pendingThrow.attacker]) {
    const pt = s.pendingThrow;
    const atk = s.fighters[pt.attacker];
    const vicSlot = pt.attacker === 0 ? 1 : 0;
    const vic = s.fighters[vicSlot];
    if (atk.action.kind !== 'attack' || atk.action.moveId !== pt.moveId) {
      // attacker interrupted mid-throw (stray projectile) — release the victim
      vic.action = { kind: 'idle', frame: 0 };
      s.pendingThrow = null;
    } else if (throwChord(vic)) {
      // teched: both bounce apart, nobody takes damage. The brief recoil
      // (blockstun shape) stops the victim's still-held chord from firing an
      // instant counter-throw on this very tick
      vic.action = { kind: 'blockstun', frame: THROW_TECH_RECOIL, guard: 'stand' };
      atk.action = { kind: 'blockstun', frame: THROW_TECH_RECOIL, guard: 'stand' };
      vic.vx = atk.facing * THROW_TECH_PUSH;
      atk.vx = -atk.facing * THROW_TECH_PUSH;
      s.pendingThrow = null;
    } else if (--pt.ticksLeft <= 0) {
      const m = resolveMove(defs[atk.charId].moves[pt.moveId], pt.strength);
      applyHit(s, vicSlot, atk.facing, {
        damage: m.damage,
        hitstun: m.hitstun,
        blockstun: m.blockstun,
        knockback: m.knockback,
        height: m.height,
        knockdown: true,
        chip: 0,
        hitstop: hitstopFor(pt.moveId, m)[1],
        attackerHitstop: hitstopFor(pt.moveId, m)[0],
        freezeAttacker: true,
        counter: false,
        unblockable: true,
        toss: true, // SF2 toss: sail + slam + bounce
        tossArc: m.tossArc,
      }, inputs[vicSlot]);
      if (m.grabRecoil) atk.vx = -atk.facing * m.grabRecoil;
      if (m.heal) atk.health = Math.min(defs[atk.charId].health, atk.health + m.heal);
      s.pendingThrow = null;
    }
  }

  // dizzy meter bleeds off a little every live tick (poking can't stun-lock;
  // a frozen fighter's meter holds — freeze is time standing still for them)
  for (const slot of [0, 1] as const) {
    const f = s.fighters[slot];
    if (!frozen[slot] && f.stun > 0 && f.action.kind !== 'dazed') {
      f.stun = Math.max(0, f.stun - STUN_DECAY);
    }
    // the combo drops the moment its victim stops reeling (hitstop pauses the
    // reel, so a frozen victim keeps the count)
    const k = f.action.kind;
    if (k !== 'hitstun' && k !== 'airHit') {
      f.comboHits = 0;
      f.juggle = JUGGLE_POINTS;
    }
  }

  if (!frozen[0]) updateFighter(s, 0, defs[f1.charId], inputs[0]);
  if (!frozen[1]) updateFighter(s, 1, defs[f2.charId], inputs[1]);

  // face the opponent whenever actionable
  for (const slot of [0, 1] as const) {
    const f = s.fighters[slot];
    const o = s.fighters[slot === 0 ? 1 : 0];
    if (!frozen[slot] && canAct(f) && grounded(f)) {
      if (o.x > f.x) f.facing = 1;
      else if (o.x < f.x) f.facing = -1;
    }
  }

  // body push: grounded fighters can't overlap (skipped while either side is
  // frozen so the freeze frame actually holds still)
  if (!frozen[0] && !frozen[1] && grounded(f1) && grounded(f2) && !isInvulnerable(f1) && !isInvulnerable(f2)) {
    const r1 = worldBox(f1, defs[f1.charId].bodyBox);
    const r2 = worldBox(f2, defs[f2.charId].bodyBox);
    if (overlaps(r1, r2)) {
      const ox = Math.min(r1.r, r2.r) - Math.max(r1.l, r2.l);
      const dir = f1.x <= f2.x ? 1 : -1;
      f1.x -= (dir * ox) / 2;
      f2.x += (dir * ox) / 2;
    }
  }

  updateProjectiles(s, defs, inputs);
  resolveAttacks(s, defs, inputs, frozen);

  // the arena is computed ONCE from this tick's positions, then both are
  // held inside it (with a camera: the view follows their midpoint, so a
  // pair trying to separate too far gets pinned at the view's edges)
  const arena = arenaBounds(s);
  for (const slot of [0, 1] as const) {
    const f = s.fighters[slot];
    f.x = Math.min(arena.maxX, Math.max(arena.minX, f.x));
  }

  // the round clock holds its breath with the freeze frames
  if (s.rules.roundTicks > 0 && !frozen[0] && !frozen[1]) s.timer--;

  // KO / time-up (no time-up when the round clock is off)
  const ko1 = f1.health <= 0;
  const ko2 = f2.health <= 0;
  if (ko1 || ko2) {
    endRound(s, ko1 && ko2 ? null : ko1 ? 1 : 0, defs);
  } else if (s.rules.roundTicks > 0 && s.timer <= 0) {
    endRound(s, f1.health > f2.health ? 0 : f2.health > f1.health ? 1 : null, defs);
  }

  return s;
}
