// Isomorphic accessor for the shared sprite-coordinate contract. The values
// live in src/render/coords.json (single source — src/render/coords.ts and
// tools/qa/coords.py read the same file). Import from here in gen scripts,
// the vite middleware, AND browser code reached via tools/core (the JSON
// import attribute works in Node 20.10+ and in Vite/Rollup bundles alike).
// Never re-declare these constants.
import c from '../../src/render/coords.json' with { type: 'json' };

export const CELL_W = c.cellW;
export const CELL_H = c.cellH;
export const FLOOR_FRAC = c.floorFrac;
export const HEADROOM = c.headroom;
export const ART_MARGIN = c.artMargin;
export const SPRITE_FOOT_OFFSET_Y = c.spriteFootOffsetY;
export const ORIGIN_CX = CELL_W / 2;
export const ORIGIN_FEET = FLOOR_FRAC * CELL_H;
export const CHROMA_GREEN = c.chromaGreen;
export const CHROMA_MAGENTA = c.chromaMagenta;
