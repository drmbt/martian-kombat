// The shared event→audio table (SPEC V15 follow-through): both presenters
// play whatever this returns, so each mapping is pinned as data.
import { describe, expect, it } from 'vitest';
import { soundCues } from './soundDirector';
import type { FightEvent } from './tickEvents';

const CHARS: [string, string] = ['vincent', 'yulia'];

const cues = (...events: FightEvent[]) => soundCues(events, CHARS);

describe('soundCues', () => {
  it('maps a plain hit to the crack + the victim voice', () => {
    expect(cues({ type: 'hit', slot: 1, damage: 20, counter: false, heavy: false, comboContinues: false })).toEqual([
      { kind: 'sfx', key: 's-hit' },
      { kind: 'voice', charId: 'yulia', line: 'hurt', volume: 0.7 },
    ]);
  });

  it('layers a counterhit: full-volume crack + whoosh', () => {
    const c = cues({ type: 'hit', slot: 0, damage: 40, counter: true, heavy: true, comboContinues: true });
    expect(c).toContainEqual({ kind: 'sfx', key: 's-hit', volume: 1 });
    expect(c).toContainEqual({ kind: 'sfx', key: 's-whoosh', volume: 0.9 });
    expect(c).toContainEqual({ kind: 'voice', charId: 'vincent', line: 'hurt', volume: 0.7 });
  });

  it('announces round 2 vs the final round, with a track change', () => {
    expect(cues({ type: 'round-intro', round: 2 })).toEqual([
      { kind: 'sfx', key: 'ann-round-2' },
      { kind: 'music', action: 'next' },
    ]);
    expect(cues({ type: 'round-intro', round: 3 })[0]).toEqual({ kind: 'sfx', key: 'ann-final-round' });
  });

  it('round end: time-up beats double-ko beats ko(+delayed perfect)', () => {
    expect(cues({ type: 'round-end', winner: 0, timeUp: true, perfect: false })).toEqual([
      { kind: 'sfx', key: 'ann-time-up' },
    ]);
    expect(cues({ type: 'round-end', winner: null, timeUp: false, perfect: false })).toEqual([
      { kind: 'sfx', key: 'ann-double-ko' },
    ]);
    expect(cues({ type: 'round-end', winner: 1, timeUp: false, perfect: true })).toEqual([
      { kind: 'sfx', key: 'ann-ko', volume: 1 },
      { kind: 'sfx', key: 'ann-perfect', delayMs: 800 },
    ]);
  });

  it('match end: winner name call, delayed victory sting, victory music', () => {
    expect(cues({ type: 'match-end', winner: 1 })).toEqual([
      { kind: 'sfx', key: 'ann-yulia', volume: 1 },
      { kind: 'sfx', key: 'ann-victory', volume: 1, delayMs: 900 },
      { kind: 'music', action: 'victory' },
    ]);
  });

  it('special attack-start adds the kiai on top of the whoosh', () => {
    expect(cues({ type: 'attack-start', slot: 0, moveId: 'sigil-bolt', special: true })).toEqual([
      { kind: 'sfx', key: 's-whoosh', volume: 0.4 },
      { kind: 'voice', charId: 'vincent', line: 'kiai', volume: 0.8 },
    ]);
    expect(cues({ type: 'attack-start', slot: 0, moveId: 'lp', special: false })).toEqual([
      { kind: 'sfx', key: 's-whoosh', volume: 0.4 },
    ]);
  });

  it('covers the one-shot cues: block, jump, dust, projectile, throw, phases', () => {
    expect(cues({ type: 'block', slot: 0 })).toEqual([{ kind: 'sfx', key: 's-block', volume: 0.6 }]);
    expect(cues({ type: 'jump', slot: 1 })).toEqual([{ kind: 'sfx', key: 's-jump', volume: 0.35 }]);
    expect(cues({ type: 'dust', slot: 0 })).toEqual([{ kind: 'sfx', key: 's-hit', volume: 0.3 }]);
    expect(cues({ type: 'projectile-spawn' })).toEqual([{ kind: 'sfx', key: 's-projectile', volume: 0.6 }]);
    expect(cues({ type: 'throw-connect' })).toEqual([{ kind: 'sfx', key: 's-hit', volume: 0.8 }]);
    expect(cues({ type: 'finisher' })).toEqual([{ kind: 'sfx', key: 'ann-finish-them', volume: 1 }]);
    expect(cues({ type: 'fatality-start' })).toEqual([{ kind: 'sfx', key: 'ann-fatality', volume: 1 }]);
    expect(cues({ type: 'fight-start' })).toEqual([{ kind: 'sfx', key: 'ann-fight', volume: 1 }]);
    expect(cues({ type: 'count', n: 3 })).toEqual([{ kind: 'sfx', key: 's-block', volume: 0.35 }]);
    expect(cues({ type: 'taunt', slot: 1 })).toEqual([{ kind: 'voice', charId: 'yulia', line: 'kiai', volume: 0.7 }]);
  });

  it('keeps event order across a mixed batch', () => {
    const c = cues(
      { type: 'attack-start', slot: 0, moveId: 'lp', special: false },
      { type: 'hit', slot: 1, damage: 10, counter: false, heavy: false, comboContinues: false },
    );
    expect(c.map((x) => (x.kind === 'sfx' ? x.key : x.kind))).toEqual(['s-whoosh', 's-hit', 'voice']);
  });
});
