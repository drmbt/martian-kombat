// Combat resolution: hurtboxes, blocking, the hit payload, applyHit (damage,
// stun, combo limits P3.8) and resolveAttacks (same-tick trades P3.1).
// Part of the deterministic fight core (split out of step.ts in P3.9).
// Same rules as all of src/engine/: no Phaser, no randomness, no wall clock.

import {
  CharacterDef,
  FighterState,
  GameState,
  InputFrame,
  MoveDef,
} from './types';
import {
  TOSS_KNOCKBACK_MULT,
  TOSS_VY,
  COMBO_SCALE_FLOOR,
  COMBO_SCALE_STEP,
  COUNTER_HITSTOP_BONUS,
  COUNTER_HITSTUN_MULT,
  HITSTOP_HEAVY,
  HITSTOP_LIGHT,
  HITSTOP_MEDIUM,
  HITSTOP_SPECIAL,
  HITSTUN_DECAY_FROM,
  HITSTUN_DECAY_STEP,
  DEFAULT_JUGGLE_COST,
  THROW_TECH_TICKS,
} from './constants';
import { Defs, Rect, worldBox, overlaps, arenaBounds, resolveMove, isInvulnerable, grounded } from './world';
import { holdingBack } from './input';

/** the six crouching normals (the flat move dict's 'c' + button ids) — the
 *  only attacks performed from a crouch. A name prefix is NOT a stance:
 *  `ceremony`, `cartwheel`, `cossack-spiral` are standing specials (P3.3). */
export const CROUCH_NORMALS = new Set(['clp', 'cmp', 'chp', 'clk', 'cmk', 'chk']);

export function defenderHurtRect(f: FighterState, def: CharacterDef): Rect {
  const a = f.action;
  const crouched =
    a.kind === 'crouch' ||
    (a.kind === 'attack' && !!a.moveId && CROUCH_NORMALS.has(a.moveId)) ||
    (a.kind === 'blockstun' && a.guard === 'crouch');
  return worldBox(f, crouched ? def.hurtCrouch : def.hurtStand);
}

export function isBlocking(f: FighterState, i: InputFrame, height: 'mid' | 'low' | 'high'): boolean {
  if (!grounded(f)) return false;
  const k = f.action.kind;
  const guardReady =
    k === 'idle' || k === 'walkF' || k === 'walkB' || k === 'crouch' || k === 'blockstun';
  if (!guardReady || !holdingBack(f, i)) return false;
  const crouchGuard = i.down || k === 'crouch';
  if (height === 'low' && !crouchGuard) return false; // lows need crouch-block
  if (height === 'high' && crouchGuard) return false; // overheads beat crouch-block
  return true;
}

export interface HitPayload {
  damage: number;
  hitstun: number;
  blockstun: number;
  knockback: number;
  height: 'mid' | 'low' | 'high';
  knockdown: boolean;
  /** damage dealt through block (heavies/specials); can never KO */
  chip: number;
  /** a projectile hit: the corner-transfer push never applies to the
   *  shooter (P3.7 — it used to shove a fullscreen fireball thrower) */
  ranged?: boolean;
  /** freeze ticks this contact buys the VICTIM (L short, H long, specials most) */
  hitstop: number;
  /** attacker-side freeze when it differs (asymmetric MUGEN pausetime);
   *  omit to freeze the attacker for `hitstop` */
  attackerHitstop?: number;
  /** block pushback impulse; omit for 80% of knockback */
  blockKnockback?: number;
  /** melee freezes both fighters; projectiles freeze the victim only */
  freezeAttacker: boolean;
  /** defender was clipped during their own attack's startup or recovery:
   *  bonus hitstun + extra victim-side freeze */
  counter: boolean;
  /** command grabs ignore blocking entirely */
  unblockable?: boolean;
  /** throw toss: launch on a long high arc that slams + bounces (SF2 throws) */
  toss?: boolean;
  /** per-move toss arc override; omit for the default TOSS_VY/TOSS_KNOCKBACK_MULT */
  tossArc?: { vy: number; knockbackMult?: number };
}

/** Counterhit test: the defender is mid-attack and NOT in active frames
 *  (active-vs-active the same tick is a trade, not a counter). */
export function isCounterhit(d: FighterState, defs: Defs): boolean {
  const a = d.action;
  if (a.kind !== 'attack' && a.kind !== 'airAttack') return false;
  const m = resolveMove(defs[d.charId].moves[a.moveId!], a.strength);
  return a.frame < m.startup || a.frame >= m.startup + m.active;
}

/** lights are chipless; everything meatier shaves 10% through block */
export const CHIPLESS = new Set(['lp', 'lk', 'clp', 'clk', 'jlp', 'jlk']);

/** Combo damage scaling: hits 1-2 land full, each later hit in the same combo
 *  loses COMBO_SCALE_STEP% (cumulative) down to the COMBO_SCALE_FLOOR%.
 *  Integer math keeps it deterministic; a connecting hit always deals ≥1. */
export function scaleForCombo(damage: number, comboHits: number): number {
  if (damage <= 0) return damage;
  const pct = Math.max(COMBO_SCALE_FLOOR, 100 - COMBO_SCALE_STEP * Math.max(0, comboHits - 2));
  return Math.max(1, Math.floor((damage * pct) / 100));
}

/** Freeze frames for a connecting move: a per-move `hitstop` wins; otherwise
 *  specials hit hardest and the button strength embedded in the move id
 *  ('lp'/'cmk'/'jhk') decides. Returns [attacker, victim]. */
export function hitstopFor(moveId: string, m: MoveDef): [number, number] {
  if (m.hitstop !== undefined) {
    return typeof m.hitstop === 'number' ? [m.hitstop, m.hitstop] : m.hitstop;
  }
  if (m.input) return [HITSTOP_SPECIAL, HITSTOP_SPECIAL];
  const strength = moveId.match(/([lmh])[pk]$/)?.[1];
  const h = strength === 'h' ? HITSTOP_HEAVY : strength === 'm' ? HITSTOP_MEDIUM : HITSTOP_LIGHT;
  return [h, h];
}

/** Damage through block: per-move `chip` wins; lights are chipless; anything
 *  meatier shaves 10%. */
export function chipFor(moveId: string, m: MoveDef): number {
  if (m.chip !== undefined) return m.chip;
  return CHIPLESS.has(moveId) ? 0 : Math.floor(m.damage * 0.1);
}

/** Apply a connected hit or block. attackerFacing pushes the defender. */
export function applyHit(
  s: GameState,
  defSlot: 0 | 1,
  attackerFacing: 1 | -1,
  hit: HitPayload,
  defInput: InputFrame,
): void {
  const d = s.fighters[defSlot];
  const atkSlot = defSlot === 0 ? 1 : 0;

  // per-fighter freeze: the victim always, the attacker only on melee;
  // trades keep the longest via max(); counterhits sting the victim longer
  d.hitstop = Math.max(d.hitstop, hit.hitstop + (hit.counter ? COUNTER_HITSTOP_BONUS : 0));
  if (hit.freezeAttacker) {
    const atk = s.fighters[atkSlot];
    atk.hitstop = Math.max(atk.hitstop, hit.attackerHitstop ?? hit.hitstop);
  }

  if (!hit.unblockable && isBlocking(d, defInput, hit.height)) {
    const guard = d.action.kind === 'crouch' || defInput.down ? 'crouch' : 'stand';
    d.action = { kind: 'blockstun', frame: hit.blockstun, guard };
    d.vx = attackerFacing * (hit.blockKnockback ?? hit.knockback * 0.8);
    if (hit.chip > 0) d.health = Math.max(1, d.health - hit.chip); // chip can't KO
  } else {
    // combo bookkeeping: a hit on an already-reeling victim extends the combo,
    // anything else starts a fresh one; later hits scale down (stun scales
    // with them so long chains can't also be free dizzies)
    const inCombo = d.action.kind === 'hitstun' || d.action.kind === 'airHit';
    d.comboHits = inCombo ? d.comboHits + 1 : 1;
    const damage = scaleForCombo(hit.damage, d.comboHits);
    d.health = Math.max(0, d.health - damage);
    // stun feeds on clean hits only; the punish that lands on a dizzied
    // fighter ends the dizzy instead of stacking toward the next one
    if (d.action.kind === 'dazed') d.stun = 0;
    else d.stun += damage;
    const counter = hit.counter || undefined;
    d.floatGravity = 0; // a hit knocks the float out of them
    if (hit.toss) {
      // SF2 throw toss: sail on a long high arc, then slam + bounce hard
      d.action = { kind: 'airHit', frame: 0, counter, tossed: true };
      d.vx = attackerFacing * hit.knockback * (hit.tossArc?.knockbackMult ?? TOSS_KNOCKBACK_MULT);
      d.vy = hit.tossArc?.vy ?? TOSS_VY;
    } else if (!grounded(d)) {
      d.action = { kind: 'airHit', frame: 0, counter };
      d.vx = attackerFacing * hit.knockback * 0.6;
      d.vy = -5;
    } else if (hit.knockdown) {
      d.action = { kind: 'airHit', frame: 0, counter };
      d.vx = attackerFacing * hit.knockback * 0.6;
      d.vy = -4.5;
    } else {
      const base = hit.counter ? Math.floor(hit.hitstun * COUNTER_HITSTUN_MULT) : hit.hitstun;
      // P3.8 hitstun decay: long ground combos end by themselves
      const decay = Math.max(0, d.comboHits - HITSTUN_DECAY_FROM) * HITSTUN_DECAY_STEP;
      const stun = Math.max(1, base - decay);
      d.action = { kind: 'hitstun', frame: stun, counter };
      d.vx = attackerFacing * hit.knockback;
    }
  }

  // corner transfer: if the defender is pinned on a wall, push the attacker
  // back instead so spacing still changes
  const arena = arenaBounds(s);
  if (!hit.ranged && (d.x <= arena.minX + 1 || d.x >= arena.maxX - 1)) {
    s.fighters[atkSlot].vx = -attackerFacing * hit.knockback * 0.7;
  }
}

export function resolveAttacks(
  s: GameState,
  defs: Defs,
  inputs: [InputFrame, InputFrame],
  frozen: [boolean, boolean],
): void {
  // Two passes so trades work (P3.1): DETECT every connection against the
  // start-of-tick state, THEN apply. Applying inside the loop let slot 0's hit
  // put slot 1 in hitstun before slot 1 was checked — slot 0 (online: the
  // host) always won. Same-tick rules: two strikes both land (a trade); a
  // strike beats a grab (the thrower got hit); two grabs clash and both whiff.
  // `a` is captured: applying the other side's hit REPLACES this fighter's action
  type Conn = { slot: 0 | 1; a: FighterState['action']; m: ReturnType<typeof resolveMove>; grab: boolean; counter: boolean; juggle: number };
  const conns: Conn[] = [];
  for (const slot of [0, 1] as const) {
    const f = s.fighters[slot];
    const a = f.action;
    if (frozen[slot]) continue; // a frozen attacker's hitbox is inert this tick
    if (a.kind !== 'attack' && a.kind !== 'airAttack') continue;
    const m = resolveMove(defs[f.charId].moves[a.moveId!], a.strength);
    // one hit per activation — unless the move rehits (lightning legs):
    // the same activation may connect again every `rehit` ticks
    if (a.hasHit && !(m.rehit && a.frame - (a.lastHitFrame ?? 0) >= m.rehit)) continue;
    if (a.frame < m.startup || a.frame >= m.startup + m.active) continue;

    const d = s.fighters[slot === 0 ? 1 : 0];
    if (isInvulnerable(d)) continue;

    // command grabs: unblockable, range-based, grounded targets only
    if (m.grab) {
      // universal throws also whiff on victims already reeling — throwing a
      // hitstunned/blockstunned/launched opponent would be a free loop
      if (
        m.techable &&
        (s.pendingThrow ||
          d.action.kind === 'hitstun' ||
          d.action.kind === 'blockstun' ||
          d.action.kind === 'airHit')
      ) {
        continue;
      }
      if (grounded(d) && Math.abs(f.x - d.x) <= m.grab.range) conns.push({ slot, a, m, grab: true, counter: false, juggle: 0 });
      continue;
    }

    if (!m.hitbox) continue;
    // P3.8 juggle points: hitting an airborne combo victim costs the move's
    // `juggle`; a pool that can't pay means the hit passes through (MUGEN)
    const juggle = d.action.kind === 'airHit' ? (m.juggle ?? DEFAULT_JUGGLE_COST) : 0;
    if (juggle > d.juggle) continue;
    if (overlaps(worldBox(f, m.hitbox), defenderHurtRect(d, defs[d.charId]))) {
      conns.push({ slot, a, m, grab: false, counter: isCounterhit(d, defs), juggle });
    }
  }

  const grabs = conns.filter((c) => c.grab).length;
  const strikes = conns.length - grabs;
  for (const c of conns) {
    if (c.grab && (strikes > 0 || grabs > 1)) continue; // struck, or a throw clash
    const { slot, m, a } = c;
    const f = s.fighters[slot];
    const defSlot = slot === 0 ? 1 : 0;
    const d = s.fighters[defSlot];
    a.hasHit = true;
    if (c.grab) {
      if (m.techable) {
        // hold the victim through the tech window; damage waits for expiry
        if (d.action.kind === 'dazed') d.stun = 0; // the throw is the dizzy punish
        s.pendingThrow = {
          attacker: slot,
          moveId: a.moveId!,
          strength: a.strength,
          ticksLeft: THROW_TECH_TICKS,
        };
        d.action = { kind: 'hitstun', frame: THROW_TECH_TICKS + 2 };
        d.vx = 0;
        // the grab thunk freezes both for a beat (melee-style)
        f.hitstop = Math.max(f.hitstop, HITSTOP_LIGHT);
        d.hitstop = Math.max(d.hitstop, HITSTOP_LIGHT);
        continue;
      }
      applyHit(s, defSlot, f.facing, {
        damage: m.damage,
        hitstun: m.hitstun,
        blockstun: m.blockstun,
        knockback: m.knockback,
        height: m.height,
        knockdown: true,
        chip: 0,
        hitstop: hitstopFor(a.moveId!, m)[1],
        attackerHitstop: hitstopFor(a.moveId!, m)[0],
        freezeAttacker: true,
        counter: false, // grabs land clean, never as counters
        unblockable: true,
      }, inputs[defSlot]);
      if (m.grabRecoil) f.vx = -f.facing * m.grabRecoil; // 86'd bounce-away
      // kudzu drain: the grab feeds the attacker (Symbiosis)
      if (m.heal) f.health = Math.min(defs[f.charId].health, f.health + m.heal);
      continue;
    }
    a.lastHitFrame = a.frame;
    d.juggle -= c.juggle;
    applyHit(s, defSlot, f.facing, {
      damage: m.damage,
      hitstun: m.hitstun,
      blockstun: m.blockstun,
      knockback: m.knockback,
      height: m.height,
      knockdown: !!m.knockdown,
      chip: chipFor(a.moveId!, m),
      hitstop: hitstopFor(a.moveId!, m)[1],
      attackerHitstop: hitstopFor(a.moveId!, m)[0],
      blockKnockback: m.blockKnockback,
      freezeAttacker: true,
      counter: c.counter,
    }, inputs[defSlot]);
  }
}
