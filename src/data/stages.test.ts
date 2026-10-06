// Scrolling-camera arenas (stageArena): a pure function of stage id + the
// build's asset manifest, so both online peers derive identical rules; and
// the camera can never show past the stage art.
import { describe, expect, it } from 'vitest';
import { STAGE_H, STAGE_W, arenaBounds, cameraX, initialState, type GameState } from '../engine';
import { characters } from './characters';
import { CAMERA_MARGIN, STAGES, WIDE_ASPECT, stageArena, stageArtWidth, wideStage } from './stages';

describe('stage arenas (SF2 scrolling camera)', () => {
  it('every stage: arena + margin == the drawn art edges, centred on the screen centre', () => {
    for (const st of STAGES) {
      const a = stageArena(st.id);
      const half = stageArtWidth(st.id) / 2;
      expect(a.camera).toEqual({ width: STAGE_W, margin: CAMERA_MARGIN });
      expect(a.stage.minX - CAMERA_MARGIN).toBeCloseTo(STAGE_W / 2 - half, 0);
      expect(a.stage.maxX + CAMERA_MARGIN).toBeCloseTo(STAGE_W / 2 + half, 0);
    }
  });

  it('wide (outpainted) stages fight on the WIDE_ASPECT band; tall art shows its bottom band', () => {
    for (const st of STAGES) {
      const w = wideStage(st.id);
      if (!w) continue;
      expect(stageArtWidth(st.id)).toBe(Math.round(STAGE_H * WIDE_ASPECT));
      expect(w.tall).toBe(w.h > w.w / WIDE_ASPECT + 1);
    }
  });

  it('the view never shows past the art, at either end of the arena', () => {
    for (const st of STAGES) {
      const s: GameState = initialState('vincent', 'yulia', characters, { roundTicks: 0, ...stageArena(st.id) });
      const half = stageArtWidth(st.id) / 2;
      for (const x of [s.rules.stage.minX, s.rules.stage.maxX]) {
        s.fighters[0].x = x;
        s.fighters[1].x = x;
        const c = cameraX(s);
        expect(c - STAGE_W / 2).toBeGreaterThanOrEqual(STAGE_W / 2 - half - 0.5);
        expect(c + STAGE_W / 2).toBeLessThanOrEqual(STAGE_W / 2 + half + 0.5);
        const b = arenaBounds(s);
        expect(b.minX).toBeGreaterThanOrEqual(s.rules.stage.minX);
        expect(b.maxX).toBeLessThanOrEqual(s.rules.stage.maxX);
      }
    }
  });
});
