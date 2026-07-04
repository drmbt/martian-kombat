// SPEC V2/I.coords: the engine's screen-pixel space must map onto the Three
// world exactly — floor at Y=0, stage centered on X=0 — or every mesh and
// debug cuboid drifts from the deterministic gameplay boxes they visualize.
import { describe, expect, it } from 'vitest';
import { FLOOR_Y, STAGE_W } from '../engine';
import { engineToWorld, rectToCuboid, LANE_DEPTH, WORLD_SCALE } from './threeCoordinates';

describe('engineToWorld', () => {
  it('maps the stage center on the floor to the world origin', () => {
    expect(engineToWorld(STAGE_W / 2, FLOOR_Y)).toEqual([0, 0]);
  });

  it('maps engine X left/right symmetrically around 0', () => {
    const [xl] = engineToWorld(STAGE_W / 2 - 100, FLOOR_Y);
    const [xr] = engineToWorld(STAGE_W / 2 + 100, FLOOR_Y);
    expect(xl).toBeCloseTo(-1);
    expect(xr).toBeCloseTo(1);
  });

  it('maps screen-up (smaller engine y) to world +Y', () => {
    const [, y] = engineToWorld(0, FLOOR_Y - 200);
    expect(y).toBeCloseTo(200 * WORLD_SCALE);
  });
});

describe('rectToCuboid', () => {
  // a 100x150 box sitting on the floor, its left edge 50px left of center
  const rect = {
    l: STAGE_W / 2 - 50,
    r: STAGE_W / 2 + 50,
    t: FLOOR_Y - 150,
    b: FLOOR_Y,
  };

  it('centers the cuboid on the rect and keeps positive extents', () => {
    const c = rectToCuboid(rect);
    expect(c.cx).toBeCloseTo(0);
    expect(c.cy).toBeCloseTo(0.75); // half of 150px height
    expect(c.w).toBeCloseTo(1);
    expect(c.h).toBeCloseTo(1.5);
    expect(c.w).toBeGreaterThan(0);
    expect(c.h).toBeGreaterThan(0);
  });

  it('straddles the combat lane by LANE_DEPTH on each side', () => {
    expect(rectToCuboid(rect).d).toBeCloseTo(LANE_DEPTH * 2);
  });

  it('keeps a floor-touching rect bottom at world Y=0', () => {
    const c = rectToCuboid(rect);
    expect(c.cy - c.h / 2).toBeCloseTo(0);
  });
});
