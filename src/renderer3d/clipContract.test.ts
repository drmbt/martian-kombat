// SPEC V12: a missing clip must resolve through the declared chain and end at
// idle — never crash, never T-pose. SPEC V4/V13: clip time is a pure function
// of the action tick, and attack clips stretch to the engine's move window so
// impacts stay on engine active frames no matter how long the authored clip is.
import { describe, expect, it } from 'vitest';
import {
  actionToClipName,
  attackClipTime,
  clipTimeSec,
  fadeTicksFor,
  fallbackChain,
  resolveClipName,
} from './clipContract';
import type { FighterState } from '../engine';

const fighter = (kind: string, extra: Partial<FighterState['action']> = {}, vy = 0): FighterState =>
  ({ vy, action: { kind, frame: 0, ...extra } }) as FighterState;

describe('actionToClipName', () => {
  it('splits air into jump (rising) and fall (descending)', () => {
    expect(actionToClipName(fighter('air', {}, -5))).toBe('jump');
    expect(actionToClipName(fighter('air', {}, 3))).toBe('fall');
  });

  it('picks the reaction side from the attacker position vs victim facing', () => {
    const victim = { ...fighter('hitstun'), x: 400, facing: 1 } as FighterState;
    const inFront = { x: 500 } as FighterState;
    const behind = { x: 300 } as FighterState;
    expect(actionToClipName(victim, inFront)).toBe('hit-front');
    expect(actionToClipName(victim, behind)).toBe('hit-back');
    // heavy latch upgrades to the Large reaction variants
    expect(actionToClipName(victim, inFront, true)).toBe('hit-front-heavy');
    expect(actionToClipName(victim, behind, true)).toBe('hit-back-heavy');
  });

  it('routes attacks to their move id and blocks to the guard stance', () => {
    expect(actionToClipName(fighter('attack', { moveId: 'sigil-bolt' }))).toBe('attack/sigil-bolt');
    expect(actionToClipName(fighter('blockstun', { guard: 'crouch' }))).toBe('block-crouch');
  });
});

describe('resolveClipName (V12 fallback chain)', () => {
  const available = new Set(['idle', 'attack/lp', 'attack-generic', 'block-stand', 'crouch']);

  it('returns the exact clip when present, unflagged', () => {
    expect(resolveClipName(available, 'attack/lp')).toEqual({ name: 'attack/lp', placeholder: false });
  });

  it('walks crouch normals to the standing normal before the generic', () => {
    expect(fallbackChain('attack/clp')).toEqual(['attack/lp', 'attack-generic']);
    expect(resolveClipName(available, 'attack/clp')).toEqual({ name: 'attack/lp', placeholder: true });
  });

  it('sends air normals to the air generic', () => {
    expect(resolveClipName(available, 'attack/jhk')).toEqual({ name: 'attack-generic', placeholder: true });
  });

  it('falls through block-crouch -> block-stand and flags the stand-in', () => {
    expect(resolveClipName(available, 'block-crouch')).toEqual({ name: 'block-stand', placeholder: true });
  });

  it('ends every chain at idle instead of crashing on unknown clips', () => {
    expect(resolveClipName(new Set(['idle']), 'no-such-clip')).toEqual({ name: 'idle', placeholder: true });
  });
});

describe('clipTimeSec (V4/V13 time mapping)', () => {
  it('loops phase inside the clip, derived from the tick', () => {
    // 90 ticks = 1.5s into a 1s loop -> 0.5s
    expect(clipTimeSec('loop', 90, 1)).toBeCloseTo(0.5);
  });

  it('clamps oneshots on their final frame instead of wrapping', () => {
    expect(clipTimeSec('oneshot', 600, 2)).toBeCloseTo(2, 3);
  });

  it('stretches window clips across the engine move window', () => {
    // a 2s authored clip over a 30-tick move: halfway through the move
    // plays the middle of the clip, and the window end pins the clip end
    expect(clipTimeSec('window', 15, 2, 30)).toBeCloseTo(1, 3);
    expect(clipTimeSec('window', 30, 2, 30)).toBeCloseTo(2, 3);
  });
});

describe('attackClipTime (V5 impactNorm warp)', () => {
  // 2s clip, impact authored at 50%; move: 6 startup + 24 active+recovery
  it('lands the authored impact frame exactly at the first active tick', () => {
    expect(attackClipTime(6, 6, 30, 2, 0.5)).toBeCloseTo(1, 3);
  });

  it('stretches pre-impact across startup and the rest across the window end', () => {
    expect(attackClipTime(3, 6, 30, 2, 0.5)).toBeCloseTo(0.5, 2); // mid-startup
    expect(attackClipTime(30, 6, 30, 2, 0.5)).toBeCloseTo(2, 2); // window end
  });
});

describe('fadeTicksFor (V13 crossfades)', () => {
  it('cuts into attacks faster than it blends locomotion', () => {
    expect(fadeTicksFor('idle', 'attack/lp')).toBeLessThan(fadeTicksFor('idle', 'walk-forward'));
  });
});
