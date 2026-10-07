// P13.4 stage A — hitboxes from the ART. For an attack's active cell, find
// the opaque pixels that stick out IN FRONT of the fighter's resting
// silhouette (row by row, vs idle / crouch / jump), and box them. That is the
// drawn limb, prop or effect — what a player believes the attack reaches.
// (The same idea P4.0 used by hand; props like Catherine's staff are
// included because they're drawn, which the skeleton method could not see.)
//
// Node-only (reads the packed sheet). Returns boxes in the character JSON's
// UNSCALED units (applyScale multiplies box and hurtStand together at load),
// using the exact cell→world math of src/render/geometry.ts.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Box } from '../../engine';
import { decodePng } from '../../../tools/core/png.mjs';
import { ART_MARGIN, CELL_H, CELL_W, FLOOR_FRAC } from '../../render/coords';

interface Sheet {
  w: number;
  data: Uint8Array;
  cols: number;
  cellW: number;
  cellH: number;
  frames: string[];
}

const ROOT = join(import.meta.dirname ?? '.', '..', '..', '..');
const sheets = new Map<string, Sheet | null>();

function sheet(id: string): Sheet | null {
  if (sheets.has(id)) return sheets.get(id)!;
  const dir = join(ROOT, 'public/assets/sprites', id);
  if (!existsSync(join(dir, 'sheet.png')) || !existsSync(join(dir, 'meta.json'))) {
    sheets.set(id, null);
    return null;
  }
  const img = decodePng(readFileSync(join(dir, 'sheet.png')));
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as { cols: number; cellW: number; cellH: number; frames: string[] };
  const s: Sheet = { w: img.width, data: img.data, cols: meta.cols, cellW: meta.cellW, cellH: meta.cellH, frames: meta.frames };
  sheets.set(id, s);
  return s;
}

const ALPHA = 128;

/** per-row front edge (max opaque x, cell px) of a cell; -1 = empty row */
function frontEdges(s: Sheet, idx: number): Int16Array {
  const out = new Int16Array(s.cellH).fill(-1);
  const ox = (idx % s.cols) * s.cellW;
  const oy = Math.floor(idx / s.cols) * s.cellH;
  for (let y = 0; y < s.cellH; y++) {
    for (let x = s.cellW - 1; x >= 0; x--) {
      if (s.data[((oy + y) * s.w + ox + x) * 4 + 3] >= ALPHA) {
        out[y] = x;
        break;
      }
    }
  }
  return out;
}

export interface ArtBox {
  /** proposed move.hitbox in the JSON's unscaled units */
  box: Box;
  /** forward-pixel count (confidence) */
  pixels: number;
  cell: string;
}

/** The drawn strike of `moveId` as a hitbox, or null when the art shows no
 *  forward extension (or the fighter has no sheet / no such cell). */
export function artHitbox(id: string, moveId: string, hurtStandH: number): ArtBox | null {
  const s = sheet(id);
  if (!s) return null;
  const air = /^j[lmh][pk]$/.test(moveId);
  const crouch = /^c[lmh][pk]$/.test(moveId);
  const cell = air ? moveId : `${moveId}-active`;
  const idx = s.frames.indexOf(cell);
  const refName = air ? 'jump' : crouch ? 'crouch' : 'idle-a';
  const ref = s.frames.indexOf(refName);
  if (idx < 0 || ref < 0) return null;
  const refFront = frontEdges(s, ref);
  // the resting body's furthest front (used where a row is empty at rest)
  let restFront = 0;
  for (const v of refFront) restFront = Math.max(restFront, v);
  const ox = (idx % s.cols) * s.cellW;
  const oy = Math.floor(idx / s.cols) * s.cellH;
  let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1, n = 0;
  for (let y = 0; y < s.cellH; y++) {
    const edge = refFront[y] >= 0 ? refFront[y] : restFront;
    for (let x = edge + 6; x < s.cellW; x++) {
      if (s.data[((oy + y) * s.w + ox + x) * 4 + 3] >= ALPHA) {
        n++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (n < 40) return null; // nothing meaningfully sticks out
  // start a little inside the body so a point-blank hit still connects
  const start = Math.max(0, x0 - 18);
  const pad = 4;
  const cx = 0.5 * (s.cellW || CELL_W);
  const cy = FLOOR_FRAC * (s.cellH || CELL_H);
  const cellBox: Box = { x: start - cx, y: y0 - pad - cy, w: x1 + pad - start, h: y1 - y0 + 2 * pad };
  const rs = (hurtStandH * ART_MARGIN) / (s.cellH || CELL_H);
  return {
    box: { x: Math.round(cellBox.x * rs), y: Math.round(cellBox.y * rs), w: Math.round(cellBox.w * rs), h: Math.round(cellBox.h * rs) },
    pixels: n,
    cell,
  };
}
