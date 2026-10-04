// Synthetic test fighters with hand-computable frame data. Used by the bench
// and engine-override tests so their expectations are arithmetic, not
// snapshots of whatever a roster JSON happens to say today.
import type { CharacterDef, MoveDef } from '../engine';

export function testMove(p: Partial<MoveDef> = {}): MoveDef {
  return {
    startup: 3,
    active: 2,
    recovery: 6,
    damage: 40,
    hitstun: 12,
    blockstun: 7,
    knockback: 6,
    hitbox: { x: 20, y: -200, w: 90, h: 60 },
    height: 'mid',
    ...p,
  };
}

/** A plain 280px-tall fighter: one jab, overridable everything. */
export function testChar(id: string, p: Partial<CharacterDef> = {}, moves: Record<string, MoveDef> = {}): CharacterDef {
  return {
    id,
    name: id.toUpperCase(),
    color: '#fff',
    health: 1000,
    walkSpeed: 5,
    backSpeed: 4,
    jumpVel: 18,
    gravity: 0.9,
    prejumpFrames: 3,
    bodyBox: { x: -45, y: -260, w: 90, h: 260 },
    hurtStand: { x: -55, y: -280, w: 110, h: 280 },
    hurtCrouch: { x: -55, y: -180, w: 110, h: 180 },
    ...p,
    moves: { lp: testMove(), ...moves },
  };
}
