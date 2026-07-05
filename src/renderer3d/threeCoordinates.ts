// Engine-pixel -> Three-world mapping for the 3D presentation spike.
// Pure math, no three imports — unit-tested in threeCoordinates.test.ts.
//
// Contract (SPEC §I.coords):
//   engine X            -> Three X (stage-centered)
//   engine floor        -> Three Y = 0
//   engine vertical up  -> Three +Y
//   combat lane         -> Three Z = 0
import { FLOOR_Y, STAGE_W } from '../engine';

/** meters per engine pixel */
export const WORLD_SCALE = 0.01;

/** half-depth of debug cuboids around the combat lane, in meters */
export const LANE_DEPTH = 0.18;

/** engine world position (x, feet-y in screen pixels) -> Three world [x, y] */
export function engineToWorld(x: number, y: number): [number, number] {
  return [(x - STAGE_W / 2) * WORLD_SCALE, (FLOOR_Y - y) * WORLD_SCALE];
}

export interface WorldCuboid {
  /** center */
  cx: number;
  cy: number;
  /** full extents in meters */
  w: number;
  h: number;
  d: number;
}

/** worldBox() screen-space rect {l,r,t,b} -> centered Three cuboid on the lane */
export function rectToCuboid(rect: { l: number; r: number; t: number; b: number }): WorldCuboid {
  const [xMin, yMin] = engineToWorld(rect.l, rect.b);
  const [xMax, yMax] = engineToWorld(rect.r, rect.t);
  return {
    cx: (xMin + xMax) / 2,
    cy: (yMin + yMax) / 2,
    w: xMax - xMin,
    h: yMax - yMin,
    d: LANE_DEPTH * 2,
  };
}
