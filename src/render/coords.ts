// THE sprite-coordinate contract — single source of truth for every constant
// that used to be hand-copied across FightScene/SelectScene/SpriteEditorPanel/
// spriteSheetModel/hitboxFromSkeleton/CharacterCreatorPanel and the tools/QA
// pipeline with "MUST match" comments. The values live in ./coords.json, which
// tools/core/coords.mjs (Node gen scripts + vite middleware) and
// tools/qa/coords.py (Python QA) read as well — change the JSON, everything
// follows. Do NOT re-declare any of these anywhere.
import c from './coords.json';

/** packed sprite-sheet cell size (px) */
export const CELL_W: number = c.cellW;
export const CELL_H: number = c.cellH;
/** fraction of cell height where a normalized fighter's feet sit */
export const FLOOR_FRAC: number = c.floorFrac;
/** pack-time safe-zone: art is scaled so feet land HEADROOM px above the cell
 *  bottom (pack-sheet SCALE_PAD ↔ pose_qa load_raw_cells) */
export const HEADROOM: number = c.headroom;
/** the art has margin around the body: render height = hurtStand.h × this */
export const ART_MARGIN: number = c.artMargin;
/** legacy global render gap between collision feet (f.y) and drawn feet —
 *  goes to 0 in the Sprint 27 Phase 2 floor migration */
export const SPRITE_FOOT_OFFSET_Y: number = c.spriteFootOffsetY;
/** cell-space origin: horizontal center + feet line */
export const ORIGIN_CX: number = CELL_W / 2;
export const ORIGIN_FEET: number = FLOOR_FRAC * CELL_H;
/** chroma-key colors (hex, no #) */
export const CHROMA_GREEN: string = c.chromaGreen;
export const CHROMA_MAGENTA: string = c.chromaMagenta;
