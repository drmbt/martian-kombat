// Contract between engine actions and GLB animation clips (SPEC V12, V13).
// The data — clip classes, fallback chains, fade table — lives ONCE in
// clipContract.json (tools/gen-mesh.mjs reads the same file for its coverage
// report). Everything here is pure and three-free so vitest covers it.
import type { Action, FighterState } from '../engine';
import contract from './clipContract.json';

export type ClipClass = 'loop' | 'oneshot' | 'window';

const CLIPS = contract.clips as Record<string, { class: ClipClass; syncToWalkSpeed?: boolean }>;
const FALLBACKS = contract.fallbacks as Record<string, string[]>;
const FADES = contract.fadeTicks;
const IMPACT_NORM = contract.impactNorm as Record<string, number>;

/** where in the authored clip the hit visually lands (0..1), if declared */
export function impactNorm(name: string): number | undefined {
  return IMPACT_NORM[name];
}

/**
 * Piecewise time-warp for attack clips (SPEC V13/V5): the clip's pre-impact
 * span plays across the move's STARTUP ticks and the rest across
 * active+recovery — the authored impact frame lands exactly when the engine's
 * active window opens, regardless of clip pacing.
 */
export function attackClipTime(
  actionFrame: number,
  startupTicks: number,
  windowTicks: number,
  clipDuration: number,
  norm: number,
): number {
  const end = Math.max(clipDuration - 1e-4, 0);
  const impactSec = norm * end;
  if (startupTicks > 0 && actionFrame < startupTicks) {
    return (actionFrame / startupTicks) * impactSec;
  }
  const rest = Math.max(windowTicks - startupTicks, 1);
  const p = Math.min((actionFrame - startupTicks) / rest, 1);
  return impactSec + p * (end - impactSec);
}

/** engine action -> the clip the renderer WANTS (before fallback).
 *  `opponent` picks the reaction side: a hit from the side the victim FACES
 *  plays hit-front, from behind plays hit-back. `heavyReel` (latched by the
 *  player at reel START — hitstun counts down, so it can't be re-derived
 *  mid-reel without the clip switching underneath) upgrades to the Large
 *  reaction variants (T28 + heavy reactions). */
export function actionToClipName(
  f: FighterState,
  opponent?: FighterState,
  heavyReel = false,
  bodyReel = false,
): string {
  const a: Action = f.action;
  switch (a.kind) {
    case 'idle':
      return 'idle';
    case 'walkF':
      return 'walk-forward';
    case 'walkB':
      return 'walk-back';
    case 'crouch':
      return 'crouch';
    case 'prejump':
      return 'prejump';
    case 'air':
      return f.vy < 0 ? 'jump' : 'fall';
    case 'attack':
    case 'airAttack':
      return `attack/${a.moveId}`;
    case 'hitstun': {
      if (!opponent) return 'hit';
      if (bodyReel) return heavyReel ? 'hit-body-heavy' : 'hit-body';
      const fromFront = (opponent.x - f.x) * f.facing >= 0;
      const base = fromFront ? 'hit-front' : 'hit-back';
      return heavyReel ? `${base}-heavy` : base;
    }
    case 'airHit':
      return 'hit-air';
    case 'blockstun':
      return a.guard === 'crouch' ? 'block-crouch' : 'block-stand';
    case 'knockdown':
      return 'knockdown';
    case 'getup':
      return 'getup';
    case 'landing':
      return 'landing';
    case 'ko':
      return 'ko';
    case 'dazed':
      return 'dazed';
  }
}

/** fallback chain for a clip name (SPEC V12: exact -> chain -> idle) */
export function fallbackChain(want: string): string[] {
  if (want.startsWith('attack/')) {
    const id = want.slice('attack/'.length);
    if (id.startsWith('j')) return ['attack-air', 'attack-generic'];
    if (id.startsWith('c')) return [`attack/${id.slice(1)}`, 'attack-generic'];
    return ['attack-generic'];
  }
  return FALLBACKS[want] ?? [];
}

export interface ResolvedClip {
  name: string;
  /** true when the wanted clip was missing and a stand-in plays instead */
  placeholder: boolean;
}

/** Walk want -> chain -> idle across the clips actually present in the GLB. */
export function resolveClipName(available: ReadonlySet<string>, want: string): ResolvedClip {
  if (available.has(want)) return { name: want, placeholder: false };
  for (const alt of fallbackChain(want)) {
    if (available.has(alt)) return { name: alt, placeholder: true };
  }
  return { name: 'idle', placeholder: true };
}

export function clipClass(name: string): ClipClass {
  if (name.startsWith('attack/')) return 'window';
  return CLIPS[name]?.class ?? 'oneshot';
}

export function syncToWalkSpeed(name: string): boolean {
  return CLIPS[name]?.syncToWalkSpeed === true;
}

/**
 * Clip playback time in seconds for the current action tick (SPEC V4/V13).
 * - loop: free phase inside the loop, still tick-derived
 * - oneshot: natural speed, clamps on the last frame
 * - window: whole clip stretched over the engine window (startup+active+recovery)
 */
export function clipTimeSec(
  cls: ClipClass,
  actionFrame: number,
  clipDuration: number,
  windowTicks?: number,
): number {
  const t = actionFrame / 60;
  const end = Math.max(clipDuration - 1e-4, 0);
  if (cls === 'loop') return clipDuration > 0 ? t % clipDuration : 0;
  if (cls === 'window' && windowTicks && windowTicks > 0) {
    return Math.min(Math.max(actionFrame / windowTicks, 0), 1) * end;
  }
  return Math.min(t, end);
}

/** Crossfade length in ticks when switching from one clip to another (V13). */
export function fadeTicksFor(prev: string, next: string): number {
  const loco = (n: string): boolean =>
    n === 'idle' || n === 'walk-forward' || n === 'walk-back' || n === 'crouch';
  if (next.startsWith('attack')) return FADES.toAttack;
  if (prev.startsWith('attack')) return FADES.fromAttack;
  if (next === 'hit' || next === 'hit-air') return FADES.toHit;
  if (next.startsWith('block')) return FADES.toBlock;
  if (loco(prev) && loco(next)) return FADES.locomotion;
  return FADES.default;
}
