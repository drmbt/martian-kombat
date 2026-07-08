// The ONE cell↔world transform. Previously hand-rolled (and drifted) in
// FightScene.editorCellTransform/cellToWorld/cellBoxToHitbox, the Character
// Creator's autoHitboxesFromSkeleton, and the Sprite Editor's flatten — every
// tool now imports these so the render-scale/foot-offset math cannot diverge.
//
// TWO different scales exist — do not conflate them:
//  - renderScale(def): sizes the ART (and anything drawn over it: skeleton,
//    auto-hitboxes, silhouette box). Derived from hurtStand.h.
//  - def.scale: the COLLISION multiplier characterScale.ts bakes into boxes.
import type { Box } from '../engine';
import { ART_MARGIN, CELL_H, CELL_W, FLOOR_FRAC, SPRITE_FOOT_OFFSET_Y } from './coords';

/** the minimal slice of CharacterDef the transforms need */
export interface RenderableDef {
  hurtStand: { h: number };
  spriteOffsetY?: number;
}

/** art draw scale: cell px → world px */
export function renderScale(def: RenderableDef): number {
  return (def.hurtStand.h * ART_MARGIN) / CELL_H;
}

/** vertical render offset between the collision feet (f.y) and the drawn feet */
export function footOffset(def: { spriteOffsetY?: number }): number {
  return SPRITE_FOOT_OFFSET_Y + (def.spriteOffsetY ?? 0);
}

/** cell-space point → world, for a fighter at (fx, fy); mirror −1 = facing left */
export function cellToWorld(
  def: RenderableDef,
  fx: number,
  fy: number,
  jx: number,
  jy: number,
  mirror: 1 | -1 = 1,
): [number, number] {
  const s = renderScale(def);
  return [fx + mirror * (jx - 0.5 * CELL_W) * s, fy + footOffset(def) + (jy - FLOOR_FRAC * CELL_H) * s];
}

/** world point → cell space (facing right) */
export function worldToCell(def: RenderableDef, fx: number, fy: number, wx: number, wy: number): [number, number] {
  const s = renderScale(def);
  return [0.5 * CELL_W + (wx - fx) / s, FLOOR_FRAC * CELL_H + (wy - (fy + footOffset(def))) / s];
}

/** An origin-relative CELL-space box (hitboxFromSkeleton output: x from center,
 *  y from feet) → an engine move.hitbox that worldBox draws exactly over the
 *  art. Uses the RENDER scale + foot offset — NOT the collision `scale`. */
export function cellBoxToHitbox(def: RenderableDef, b: Box): Box {
  const s = renderScale(def);
  const foot = footOffset(def);
  return {
    x: Math.round(b.x * s),
    y: Math.round(b.y * s + foot),
    w: Math.round(b.w * s),
    h: Math.round(b.h * s),
  };
}
