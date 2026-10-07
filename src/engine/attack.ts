// The per-fighter state machine: what one fighter does this tick (walk,
// jump, dash, attacks, specials, reels, getup) given its input and state.
// Part of the deterministic fight core (split out of step.ts in P3.9).
// Same rules as all of src/engine/: no Phaser, no randomness, no wall clock.

import {
  CharacterDef,
  GameState,
  InputFrame,
  Strength,
} from './types';
import {
  BOUNCE_VY,
  TOSS_BOUNCE_VY,
  JUMP_SPEED_MULT,
  JUMP_VEL_MULT,
  CANCEL_WINDOW_TICKS,
  DIZZY_TICKS,
  TAUNT_TICKS,
  FLOOR_Y,
  GETUP_TICKS,
  GROUND_FRICTION,
  LANDING_TICKS,
  LANDING_WHIFF_TICKS,
  KNOCKDOWN_TICKS,
  STUN_THRESHOLD,
} from './constants';
import { arenaBounds, resolveMove, mirrorTeleportPhases, grounded, ownsLiveProjectile, airStep, settle, startAttack } from './world';
import { BIT, freshPress, motionDone, comboPress, throwChord, holdingBack, holdingForward, doubleTapped, AttackPick, pickAttack, pickAirAttack } from './input';

// Initial impulse; ground friction (0.85) bleeds it, so total travel is
// ~speed/(1-0.85) ≈ speed×6.7. At 9 a dash cleared <1 char width (80–100u) and
// read as a limp step — 17 gives a ~113u burst, a real dash of ~1.3 char widths.
export const DASH_SPEED = 17;

export const BACKDASH_SPEED = 12;

export function updateFighter(
  s: GameState,
  slot: 0 | 1,
  def: CharacterDef,
  input: InputFrame,
): void {
  const f = s.fighters[slot];
  const a = f.action;

  switch (a.kind) {
    case 'attack': {
      // chains & special cancels: once this move has CONTACTED (hit or block —
      // a.hasHit is set on either; whiffs never cancel), a buffered press may
      // cut its recovery short inside the cancel window. Chains are data
      // (`chains` on the move lists legal targets); `cancel: true` normals
      // may cancel into any motion special (grabs excluded — canceling into
      // a command grab on a reeling victim would be degenerate).
      let canceled = false;
      if (a.hasHit && f.buffered) {
        const cm = resolveMove(def.moves[a.moveId!], a.strength);
        if (a.frame <= cm.startup + cm.active + CANCEL_WINDOW_TICKS) {
          const target = def.moves[f.buffered.id];
          const isChain = !!target && !!cm.chains?.includes(f.buffered.id);
          const isSpecialCancel = !!target && !!cm.cancel && !!target.input && !target.grab;
          if (
            (isChain || isSpecialCancel) &&
            // one-fireball rule re-checked at cancel time
            !(target.projectile && !target.projectile.field && ownsLiveProjectile(s, slot))
          ) {
            f.action = startAttack(def, f.buffered.id, f.buffered.strength);
            f.buffered = null;
            canceled = true;
          }
        }
      }
      // early chord upgrade: a lone button that becomes a 2-button chord
      // within the first few frames kara-cancels into the PPP/KKK/LPLK
      // special (nobody can hit two keys on the same 60hz tick).
      // Single-button SPECIALS upgrade too — dp+2P lands one tick apart and
      // the qcf-tail special would otherwise steal the input (Gene's
      // Diffusion vs Hallucination) — but chord specials never re-upgrade.
      const cur = def.moves[a.moveId!];
      const curIsChord =
        cur.input?.button === 'PPP' || cur.input?.button === 'KKK' || cur.input?.button === 'LPLK';
      if (!canceled && !curIsChord && a.frame < 4) {
        for (const [id, mv] of Object.entries(def.moves)) {
          const btn = mv.input?.button;
          if (btn !== 'PPP' && btn !== 'KKK' && btn !== 'LPLK') continue;
          const chord = btn === 'LPLK' ? throwChord(f) : comboPress(f, btn === 'PPP' ? 'punch' : 'kick');
          if (!chord) continue;
          if (mv.input!.motion && !motionDone(f, mv.input!.motion)) continue;
          const str: Strength = btn === 'LPLK' ? 'l' : 'm';
          f.action = startAttack(def, id, str);
          break;
        }
      }
      const act = f.action;
      const m = resolveMove(def.moves[act.moveId!], act.strength);
      act.frame++;
      if (m.forwardVel && act.frame <= m.startup + m.active) {
        f.x += f.facing * m.forwardVel;
      }
      // teleports blink at the first active frame (Diffusion); `mirror`
      // teleports (Matrix Teleport) blink at the halfway point instead, so
      // the full startup/active/recovery cell cycle plays once per side
      if (m.teleport && act.frame === (m.teleport.mirror ? mirrorTeleportPhases(m).half : m.startup)) {
        const o = s.fighters[slot === 0 ? 1 : 0];
        const b = arenaBounds(s);
        if (m.teleport.mode === 'behind') {
          f.x = o.x + (f.x <= o.x ? 90 : -90);
        } else {
          f.x = f.facing === 1 ? b.minX + 40 : b.maxX - 40;
        }
        f.x = Math.min(b.maxX, Math.max(b.minX, f.x));
      }
      // shoryuken leaps: rise while the attack stays out
      if (m.leap) {
        if (act.frame === m.startup) {
          f.vy = -m.leap.vy;
          f.vx = f.facing * m.leap.vx;
          f.y -= 1;
        }
        if (!grounded(f) && airStep(f, def.gravity)) settle(f);
      }
      // vaults launch airborne at the first active frame (Staff Vault)
      if (m.vault && act.frame === m.startup) {
        f.vy = -m.vault.vy;
        f.vx = f.facing * m.vault.vx;
        f.y -= 1;
        f.action = { kind: 'air', frame: 0 };
        break;
      }
      // yoga float: launch high, then drift down under reduced gravity
      // (cleared on touchdown or on getting hit) — air normals stay live
      if (m.float && act.frame === m.startup) {
        f.vy = -m.float.vy;
        f.vx = f.facing * (m.float.vx ?? 0);
        f.floatGravity = m.float.gravity;
        f.y -= 1;
        f.action = { kind: 'air', frame: 0 };
        break;
      }
      // projectiles spawn on the first active frame (fans spawn several)
      if (m.projectile && act.frame === m.startup) {
        const p = m.projectile;
        for (let n = 0; n < (p.count ?? 1); n++) {
          s.projectiles.push({
            owner: slot,
            moveId: act.moveId!,
            x: f.x + f.facing * p.spawnX,
            y: f.y + p.spawnY + n * (p.spreadY ?? 0),
            vx: f.facing * (p.vx + n * (p.spreadVX ?? 0)),
            box: p.box,
            damage: p.damage,
            hitstun: p.hitstun,
            blockstun: p.blockstun,
            knockback: p.knockback,
            height: p.height ?? 'mid',
            ttl: p.ttl ?? -1,
            vy: p.vy ?? 0,
            gravity: p.gravity ?? 0,
            fuse: p.fuse ?? -1,
            knockdown: p.knockdown ?? false,
            field: p.field ?? false,
            detonate: p.detonate,
            rehit: p.rehit ?? 0,
            hitCooldown: 0,
            slowFactor: p.slowFactor ?? 0,
            pull: p.pull ?? false,
          });
        }
      }
      if (act.frame >= m.startup + m.active + m.recovery) {
        // a leap that ends airborne falls the rest of the way
        f.action = grounded(f) ? { kind: 'idle', frame: 0 } : { kind: 'air', frame: 0 };
      }
      break;
    }
    case 'prejump': {
      a.frame++;
      if (a.frame >= def.prejumpFrames) {
        // jump higher (air time for aerials) and, on a forward/back jump,
        // COVER GROUND — horizontal speed is a multiple of walk, not walk
        // itself (walk-speed jumps read floaty). Direction is locked at
        // takeoff, SF2-style: no air steering.
        f.vy = -def.jumpVel * JUMP_VEL_MULT;
        const jumpX = def.jumpSpeedX ?? def.walkSpeed * JUMP_SPEED_MULT;
        f.vx = ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * jumpX;
        f.action = { kind: 'air', frame: 0 };
      }
      break;
    }
    case 'air':
    case 'airHit': {
      // a float only slows a controlled fall — getting hit ends it (applyHit
      // clears it too, but knockdowns re-enter here as airHit)
      if (airStep(f, a.kind === 'air' && f.floatGravity > 0 ? f.floatGravity : def.gravity)) {
        f.floatGravity = 0;
        if (a.kind === 'airHit' && !a.bounced) {
          // ground-impact bounce: pop back off the floor once (invulnerable —
          // you're already down), then the next contact settles for real.
          // A throw toss slams harder, so it rebounds higher and keeps more
          // of its horizontal — the body skips further across the floor.
          f.vy = -(a.tossed ? TOSS_BOUNCE_VY : BOUNCE_VY);
          f.vx *= a.tossed ? 0.7 : 0.5;
          f.y = FLOOR_Y - 1; // lift so the rebound arc plays
          a.bounced = true;
        } else {
          f.y = FLOOR_Y;
          f.vy = 0;
          f.vx = 0;
          f.action =
            a.kind === 'airHit'
              ? { kind: 'knockdown', frame: 0 }
              : { kind: 'landing', frame: LANDING_TICKS };
        }
      } else if (a.kind === 'air') {
        const id = pickAirAttack(f, def, input);
        if (id) f.action = { kind: 'airAttack', frame: 0, moveId: id, hasHit: false };
      }
      break;
    }
    case 'airAttack': {
      const m = def.moves[a.moveId!];
      a.frame++;
      if (airStep(f, f.floatGravity > 0 ? f.floatGravity : def.gravity)) {
        // landing interrupts the air normal — a whiff eats extra recovery
        f.floatGravity = 0;
        settle(f);
        f.action = { kind: 'landing', frame: a.hasHit ? LANDING_TICKS : LANDING_WHIFF_TICKS };
      } else if (a.frame >= m.startup + m.active + m.recovery) {
        f.action = { kind: 'air', frame: 0 };
      }
      break;
    }
    case 'landing': {
      a.frame--;
      if (a.frame <= 0) f.action = { kind: 'idle', frame: 0 };
      break;
    }
    case 'hitstun':
    case 'blockstun': {
      a.frame--;
      if (a.frame <= 0) {
        // stun past the threshold converts the reel into a dizzy (never off a block)
        f.action =
          a.kind === 'hitstun' && f.stun >= STUN_THRESHOLD
            ? { kind: 'dazed', frame: 0 }
            : { kind: 'idle', frame: 0 };
      }
      break;
    }
    case 'knockdown': {
      a.frame++;
      if (a.frame >= KNOCKDOWN_TICKS) f.action = { kind: 'getup', frame: 0 };
      break;
    }
    case 'getup': {
      a.frame++;
      if (a.frame >= GETUP_TICKS) {
        f.action =
          f.stun >= STUN_THRESHOLD ? { kind: 'dazed', frame: 0 } : { kind: 'idle', frame: 0 };
      }
      break;
    }
    case 'dazed': {
      // dizzy: helpless, counting up to recovery. (The finisher-window daze
      // never reaches here — updateFighter isn't called for the loser then.)
      a.frame++;
      if (a.frame >= DIZZY_TICKS) {
        f.stun = 0;
        f.action = { kind: 'idle', frame: 0 };
      }
      break;
    }
    case 'ko': {
      if (!grounded(f) && airStep(f, def.gravity)) settle(f);
      break;
    }
    case 'taunt': {
      // committed flavor pose (standing hurtbox, no invuln — a hit drops it to
      // hitstun in combat resolution); auto-returns to idle after TAUNT_TICKS
      if (a.frame + 1 >= TAUNT_TICKS) f.action = { kind: 'idle', frame: 0 };
      else a.frame++;
      break;
    }
    default: {
      // idle / walkF / walkB / crouch — fully actionable
      const stance = input.down ? 'crouch' : 'stand';
      // a buffered press (wakeup reversal, landing buffer, tap during a reel
      // or recovery) fires on this first actionable frame; consumed either
      // way — one press never triggers twice
      let attack: AttackPick | null = null;
      if (f.buffered) {
        const mv = def.moves[f.buffered.id];
        // re-check the one-fireball rule at execution time
        if (mv && !(mv.projectile && !mv.projectile.field && ownsLiveProjectile(s, slot))) {
          attack = { id: f.buffered.id, strength: f.buffered.strength };
        }
        f.buffered = null;
      }
      if (!attack) attack = pickAttack(s, slot, def, input, stance);
      if (attack) {
        f.action = startAttack(def, attack.id, attack.strength);
      } else if (input.up) {
        f.action = { kind: 'prejump', frame: 0 };
      } else if (input.down) {
        f.action = { kind: 'crouch', frame: 0 };
      } else if (holdingForward(f, input)) {
        // double-tap forward = dash: an impulse the ground friction bleeds
        // off — gated by the stock pool so it can't be spammed
        if (doubleTapped(f, 'f') && f.dashStocks > 0) {
          f.dashStocks--;
          f.vx = f.facing * DASH_SPEED;
        }
        f.action = { kind: 'walkF', frame: 0 };
        f.x += f.facing * def.walkSpeed;
      } else if (holdingBack(f, input)) {
        if (doubleTapped(f, 'b') && f.dashStocks > 0) {
          f.dashStocks--;
          f.vx = -f.facing * BACKDASH_SPEED;
        }
        f.action = { kind: 'walkB', frame: 0 };
        f.x -= f.facing * def.backSpeed;
      } else if (freshPress(f, BIT.taunt)) {
        // flavor taunt: only from a standing idle (movement/attacks all win
        // above), committed for TAUNT_TICKS. Deterministic → net-synced for free.
        f.action = { kind: 'taunt', frame: 0 };
      } else {
        f.action = { kind: 'idle', frame: 0 };
      }
      break;
    }
  }

  // knockback slide + friction for anyone on the ground (walk speed above is
  // positional, vx is purely impulse from hits/blocks). Checked against the
  // action AFTER this tick's update: a fighter who just took off (prejump →
  // air) is not sliding — MUGEN applies no ground friction on the takeoff tick
  const k = f.action.kind;
  if (grounded(f) && k !== 'air' && k !== 'airHit' && k !== 'airAttack' &&
      a.kind !== 'air' && a.kind !== 'airHit' && a.kind !== 'airAttack') {
    f.x += f.vx;
    f.vx *= GROUND_FRICTION;
    if (Math.abs(f.vx) < 0.05) f.vx = 0;
  }
}
