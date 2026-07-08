// THE ffmpeg chroma-key / scale / pad filter strings — shared by
// tools/pack-sheet.mjs, the vite dev-editor middleware (/__editor/gen-frame,
// /__editor/creator/gen), and tools/qa (pose_qa builds the same filter from
// coords.py). Before this module the vite copy silently omitted HEADROOM, so
// editor/creator-generated cells sat ~24px lower (and slightly larger) than
// pipeline-packed cells — the C1 coordinate-contract bug in
// docs/CHARACTER_STUDIO.md. One string, one convention.
import { CELL_W, CELL_H, HEADROOM, CHROMA_GREEN } from './coords.mjs';

/** chromakey (YUV) at low similarity, NO despill: despill bleaches wardrobe
 *  greens/dark hair, and 0.2+ similarity eats them */
export const chromaKey = (color = CHROMA_GREEN) => `chromakey=0x${color}:0.15:0.06`;

/** cell scale/pad WITH the pack-time safe zone: art scaled into
 *  CELL_H − 2·HEADROOM, feet landing HEADROOM px above the cell bottom —
 *  identical to what pose_qa measures keypoints/hitboxes on */
export const SCALE_PAD =
  `scale=${CELL_W}:${CELL_H - 2 * HEADROOM}:force_original_aspect_ratio=decrease,` +
  `pad=${CELL_W}:${CELL_H}:(ow-iw)/2:${CELL_H - HEADROOM}-ih:color=0x00000000`;

/** key + cell pad in one -vf string (the raw-gen → cell-space transform) */
export const KEY_PAD_CELL = `${chromaKey()},${SCALE_PAD}`;

/** square portrait key + center pad (select icon / KO bust aspect) */
export const keyPadSquare = (size = 512) =>
  `${chromaKey()},scale=${size}:${size}:force_original_aspect_ratio=decrease,` +
  `pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`;

/** stage backgrounds — NO key; cover-crop to the 21:9 fight aspect */
export const STAGE_COVER = 'scale=1680:720:force_original_aspect_ratio=increase,crop=1680:720';
