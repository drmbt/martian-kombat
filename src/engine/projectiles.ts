// Projectiles: movement, fields/slow zones, detonation, clashes and hits.
// Part of the deterministic fight core (split out of step.ts in P3.9).
// Same rules as all of src/engine/: no Phaser, no randomness, no wall clock.

import {
  GameState,
  InputFrame,
  Projectile,
} from './types';
import {
  FLOOR_Y,
  HITSTOP_LIGHT,
  HITSTOP_SPECIAL,
} from './constants';
import { Defs, Rect, overlaps, arenaBounds, viewBounds, resolveMove, isInvulnerable } from './world';
import { defenderHurtRect, isCounterhit, applyHit } from './combat';

/** Armed and waiting (lobbed bomb in flight or fuse ticking) — hits nobody,
 *  but CAN still clash with enemy projectiles (interceptable bombs, and
 *  Hallucination clones that pop real fireballs). */
export function isDormant(p: Projectile): boolean {
  return p.fuse > 0;
}

export function projRect(p: Projectile): Rect {
  return { l: p.x + p.box.x, t: p.y + p.box.y, r: p.x + p.box.x + p.box.w, b: p.y + p.box.y + p.box.h };
}

export function updateProjectiles(s: GameState, defs: Defs, inputs: [InputFrame, InputFrame]): void {
  const slowFields = s.projectiles.filter((q) => q.field && q.slowFactor > 0);
  const slowBy = (p: Projectile): number => {
    const zone = slowFields.find((q) => q.owner !== p.owner && overlaps(projRect(p), projRect(q)));
    return zone ? zone.slowFactor : 1;
  };
  for (const p of s.projectiles) {
    p.x += p.vx * (p.field ? 1 : slowBy(p));
    // lobbed arc: fall, then stick to the floor and start the fuse
    if (p.gravity > 0) {
      p.vy += p.gravity;
      p.y += p.vy;
      if (p.y >= FLOOR_Y) {
        p.y = FLOOR_Y;
        p.vx = 0;
        p.vy = 0;
        p.gravity = 0;
      }
    }
    if (p.fuse > 0 && p.gravity === 0) p.fuse--;
    if (p.hitCooldown > 0) p.hitCooldown--;
    if (p.fuse === 0 && p.detonate) {
      const d = p.detonate;
      p.vx = 0; // walking clones stop where they pop
      p.box = d.box;
      p.damage = d.damage;
      p.hitstun = d.hitstun;
      p.blockstun = d.blockstun;
      p.knockback = d.knockback;
      p.height = d.height ?? 'mid';
      p.ttl = d.ttl;
      p.knockdown = true;
      p.moveId = `${p.moveId}-burst`; // renderer swaps to the blast art
      p.fuse = -1;
      p.detonate = undefined;
    }
    if (p.ttl > 0) p.ttl--;
  }

  // slow fields also drag the opposing fighter's ground impulses (dash/knockback)
  for (const zone of slowFields) {
    const foe = s.fighters[zone.owner === 0 ? 1 : 0];
    if (overlaps(projRect(zone), defenderHurtRect(foe, defs[foe.charId]))) {
      foe.vx *= zone.slowFactor;
    }
  }

  // projectile vs projectile: clash and both die (smoke/slow fields don't
  // participate; dormant bombs and clones DO — they're interceptable)
  const dead = new Set<Projectile>();
  for (const p of s.projectiles) {
    for (const q of s.projectiles) {
      if (p.field || q.field) continue;
      if (p.owner !== q.owner && !dead.has(p) && !dead.has(q)) {
        const pr = projRect(p);
        const qr = { l: q.x + q.box.x, t: q.y + q.box.y, r: q.x + q.box.x + q.box.w, b: q.y + q.box.y + q.box.h };
        if (overlaps(pr, qr)) {
          dead.add(p);
          dead.add(q);
        }
      }
    }
  }

  const view = viewBounds(s);
  for (const p of s.projectiles) {
    if (dead.has(p)) continue;
    if (p.x < view.lo - 60 || p.x > view.hi + 60 || p.ttl === 0) {
      dead.add(p);
      continue;
    }
    if (p.field || isDormant(p)) continue; // smoke / armed bombs never hit
    if (p.hitCooldown > 0) continue; // tick-damage cloud between hits
    const defSlot = p.owner === 0 ? 1 : 0;
    const d = s.fighters[defSlot];
    if (isInvulnerable(d)) continue;
    const pr = projRect(p);
    // reflectors bounce it back at the sender; lariats phase through it
    const da = d.action;
    if (da.kind === 'attack') {
      const dm = resolveMove(defs[d.charId].moves[da.moveId!], da.strength);
      const inWindow = da.frame < dm.startup + dm.active;
      if (dm.reflect && inWindow && overlaps(pr, defenderHurtRect(d, defs[d.charId]))) {
        p.owner = defSlot;
        p.vx = -p.vx;
        continue;
      }
      if (dm.projImmune && inWindow) continue;
    }
    if (overlaps(pr, defenderHurtRect(d, defs[d.charId]))) {
      // knockback follows the projectile's travel; a stationary blast (vx 0)
      // pushes the victim AWAY from where it sits (P3.7: it always pushed left)
      const pushDir: 1 | -1 = p.vx > 0 ? 1 : p.vx < 0 ? -1 : d.x >= p.x ? 1 : -1;
      applyHit(s, defSlot, pushDir, {
        damage: p.damage,
        hitstun: p.hitstun,
        blockstun: p.blockstun,
        knockback: p.knockback,
        height: p.height,
        knockdown: p.knockdown,
        // projectiles are special-born; lingering tick-clouds stay light so
        // rehit damage doesn't stutter the whole match
        hitstop: p.rehit > 0 ? HITSTOP_LIGHT : HITSTOP_SPECIAL,
        freezeAttacker: false, // SF fireballs never freeze the shooter
        ranged: true, // no corner pushback onto a fullscreen shooter
        counter: isCounterhit(d, defs),
        chip: Math.floor(p.damage * 0.1),
      }, inputs[defSlot]);
      // "get over here": an UNBLOCKED hit reels the victim in — dropped at
      // the owner's feet mid-launch, the knockdown lands them right there
      // (a blocked spear is plain blockstun + pushback, no drag)
      if (p.pull && d.action.kind !== 'blockstun') {
        const owner = s.fighters[p.owner];
        const side = d.x >= owner.x ? 1 : -1;
        const b = arenaBounds(s);
        d.x = Math.min(b.maxX, Math.max(b.minX, owner.x + side * 85));
        d.vx = 0;
      }
      // lingering clouds survive their hits and re-hit on a cooldown
      if (p.rehit > 0) p.hitCooldown = p.rehit;
      else dead.add(p);
    }
  }

  if (dead.size) s.projectiles = s.projectiles.filter((p) => !dead.has(p));
}
