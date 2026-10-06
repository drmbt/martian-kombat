// P2.1: a persisted 3D render mode must not strand a player build in 3D
// (no roster entry has a mesh, so every fighter would be locked).
import { describe, expect, it } from 'vitest';
import { sanitize } from './settings';

describe('render3d settings migration', () => {
  it('a saved render3d:true boots 2D when 3D is not allowed (player build)', () => {
    expect(sanitize({ render3d: true }, false).render3d).toBe(false);
  });
  it('keeps the saved choice where 3D is allowed (DEV / ?3d=1)', () => {
    expect(sanitize({ render3d: true }, true).render3d).toBe(true);
    expect(sanitize({}, true).render3d).toBe(false);
  });
});
