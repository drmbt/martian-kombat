// Node accessor for the shared sprite-coordinate contract. The values live in
// src/render/coords.json (single source — the browser imports it directly and
// tools/qa/coords.py reads it for Python). Import from here in gen scripts and
// the vite middleware; never re-declare these constants.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const c = JSON.parse(readFileSync(join(ROOT, 'src', 'render', 'coords.json'), 'utf8'));

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
