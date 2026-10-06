// Engine-independent units for comparing fighters across engines/scales.
//   CH  — character heights: px ÷ the fighter's standing hurtbox height
//   f   — frames at 60 Hz (MUGEN, IKEMEN GO and our engine all tick at 60)
//   %HP — damage as a percentage of the defender's max health
import { STAGE_MAX_X, STAGE_MIN_X, STAGE_W } from '../engine';

export const FPS = 60;

export const ch = (px: number, height: number): number => px / height;
export const chPerSec = (pxPerTick: number, height: number): number => (pxPerTick * FPS) / height;
export const pct = (damage: number, health: number): number => (damage / health) * 100;

/** our arena in CH for a fighter of `height` px */
export function arena(height: number): { walkableCH: number; screenCH: number } {
  return { walkableCH: (STAGE_MAX_X - STAGE_MIN_X) / height, screenCH: STAGE_W / height };
}

export const median = (xs: number[]): number => {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
