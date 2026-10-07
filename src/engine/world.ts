// Shared engine helpers: the Defs type, geometry (world boxes, overlap), the
// SF2/MUGEN camera + arena bounds, fighter state queries and move resolution.
// Part of the deterministic fight core (split out of step.ts in P3.9).
// Same rules as all of src/engine/: no Phaser, no randomness, no wall clock.

import {
  Box,
  CharacterDef,
  FighterState,
  GameState,
  MoveDef,
  Strength,
} from './types';
import {
  FLOOR_Y,
  STAGE_W,
} from './constants';

export type Defs = Record<string, CharacterDef>;

export interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}

/** Box (facing-relative, feet origin) -> world rect. */
export function worldBox(f: FighterState, box: Box): Rect {
  const l = f.facing === 1 ? f.x + box.x : f.x - box.x - box.w;
  return { l, t: f.y + box.y, r: l + box.w, b: f.y + box.y + box.h };
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
}

/** Camera centre x in world px. Fixed screen (no `rules.camera`): STAGE_W/2.
 *  Otherwise the fighters' midpoint, clamped so the view stays inside the
 *  stage ± margin. A pure function of state — renderers call it too. */
export function cameraX(s: GameState): number {
  const cam = s.rules.camera;
  if (!cam) return STAGE_W / 2;
  const mid = (s.fighters[0].x + s.fighters[1].x) / 2;
  const lo = s.rules.stage.minX - cam.margin + cam.width / 2;
  const hi = s.rules.stage.maxX + cam.margin - cam.width / 2;
  return lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, mid));
}

/** Where fighters may stand this tick: the stage, narrowed to the camera
 *  view minus its margin (so two fighters can never be further apart than
 *  width − 2·margin, and the "corner" is wherever the view stops). */
export function arenaBounds(s: GameState): { minX: number; maxX: number } {
  const { minX, maxX } = s.rules.stage;
  const cam = s.rules.camera;
  if (!cam) return { minX, maxX };
  const c = cameraX(s);
  return { minX: Math.max(minX, c - cam.width / 2 + cam.margin), maxX: Math.min(maxX, c + cam.width / 2 - cam.margin) };
}

/** Horizontal extent of what's on screen (projectiles die 60px past it). */
export function viewBounds(s: GameState): { lo: number; hi: number } {
  const cam = s.rules.camera;
  if (!cam) return { lo: 0, hi: STAGE_W };
  const c = cameraX(s);
  return { lo: c - cam.width / 2, hi: c + cam.width / 2 };
}

/** Effective move for an action: base numbers + the strength's variant patch.
 *  Exported — the renderer uses the same timings for animation phases. */
export function resolveMove(base: MoveDef, strength?: Strength): MoveDef {
  const patch = strength ? base.variants?.[strength] : undefined;
  if (!patch) return base;
  const { projectile: projPatch, ...rest } = patch;
  const merged: MoveDef = { ...base, ...rest, variants: base.variants };
  if (projPatch && base.projectile) {
    merged.projectile = { ...base.projectile, ...projPatch };
  }
  return merged;
}

/** Sub-phase ticks for a `teleport.mirror` move: each of startup/active/
 *  recovery is halved for the origin side, the fighter blinks at `half`, then
 *  the destination side gets the same three sub-durations back — the renderer
 *  replays the cells in reverse (recovery, active, startup) across it.
 *  Exported so FightScene's cell picker stays in lockstep with the blink tick. */
export function mirrorTeleportPhases(
  m: MoveDef,
): { subStartup: number; subActive: number; subRecovery: number; half: number } {
  const subStartup = Math.round(m.startup / 2);
  const subActive = Math.round(m.active / 2);
  const subRecovery = Math.round(m.recovery / 2);
  return { subStartup, subActive, subRecovery, half: subStartup + subActive + subRecovery };
}

export const ACTIONABLE = new Set(['idle', 'walkF', 'walkB', 'crouch']);

/** States where a fresh button press waits in the action buffer instead of
 *  being dropped: your own attack's tail, every reel, wakeup, prejump, and
 *  landing recovery. ('air' is absent — pickAirAttack consumes air presses.) */
export const BUFFERABLE = new Set([
  'attack', 'airAttack', 'hitstun', 'blockstun', 'knockdown', 'getup', 'prejump', 'landing', 'dazed',
]);

export function canAct(f: FighterState): boolean {
  return ACTIONABLE.has(f.action.kind);
}

export function isInvulnerable(f: FighterState): boolean {
  const a = f.action;
  if (a.kind === 'attack') {
    const from = a.invulnFrom ?? 0;
    if (a.frame >= from && a.frame < from + (a.invuln ?? 0)) return true; // reversal i-frames
  }
  if (a.kind === 'airHit' && a.bounced) return true; // rebounding off the floor = already down
  const k = a.kind;
  // 'dazed' is NOT here: a dizzied fighter is fully vulnerable (the finisher-
  // window daze doesn't care — nothing resolves attacks in that phase)
  return k === 'knockdown' || k === 'getup' || k === 'ko';
}

export function grounded(f: FighterState): boolean {
  return f.y >= FLOOR_Y;
}

/** Can this player fire a projectile? (classic one-fireball-on-screen rule;
 *  visual fields like smoke don't count) */
export function ownsLiveProjectile(s: GameState, slot: 0 | 1): boolean {
  return s.projectiles.some((p) => p.owner === slot && !p.field);
}

/** One airborne physics tick: gravity, then position (the order every air
 *  state shared before P3.9 deduped it). Returns true once at/below the floor. */
export function airStep(f: FighterState, gravity: number): boolean {
  f.vy += gravity;
  f.y += f.vy;
  f.x += f.vx;
  return f.y >= FLOOR_Y;
}

/** Plant on the floor and stop. */
export function settle(f: FighterState): void {
  f.y = FLOOR_Y;
  f.vy = 0;
  f.vx = 0;
}

/** A fresh attack action for a move (+ its strength variant's invuln). */
export function startAttack(def: CharacterDef, id: string, strength?: Strength): FighterState['action'] {
  const res = resolveMove(def.moves[id], strength);
  return {
    kind: 'attack',
    frame: 0,
    moveId: id,
    strength,
    hasHit: false,
    invuln: res.invuln ?? 0,
    invulnFrom: res.invulnFrom ?? 0,
  };
}

/** The KO pop: launched up and pushed `dir` (±1) so the fall arc plays. */
export function koPop(f: FighterState, dir: number): void {
  f.action = { kind: 'ko', frame: 0 };
  f.vy = -6;
  f.vx = dir * 3.5;
  f.y -= 1; // lift off the floor so the KO arc plays
}
