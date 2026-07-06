// SPEC V15: diffTick is the single detection point both presenters trust —
// a wrong event here means a missing sound/spark/blood burst in BOTH
// renderers, so the transitions that matter are pinned down as data.
import { describe, expect, it } from 'vitest';
import { characters } from '../data/characters';
import { initialState } from '../engine';
import type { GameState } from '../engine';
import { diffTick, snapTick } from './tickEvents';

const state = (): GameState => initialState('vincent', 'yulia', characters);

const fight = (s: GameState): GameState => {
  s.phase = 'fight';
  return s;
};

describe('diffTick', () => {
  it('emits hit with damage, combo continuation, and heavy for specials', () => {
    const s = fight(state());
    const prev = snapTick(s);
    prev.kinds[1] = 'hitstun'; // defender was already reeling
    s.fighters[1].health -= 30;
    s.fighters[1].action = { kind: 'hitstun', frame: 10, counter: true };
    s.fighters[0].action = { kind: 'attack', frame: 8, moveId: 'sigil-bolt' };
    expect(diffTick(prev, s, characters)).toContainEqual({
      type: 'hit',
      slot: 1,
      damage: 30,
      counter: true,
      heavy: true, // sigil-bolt is a special
      comboContinues: true,
    });
  });

  it('emits block only on entering blockstun, not while staying in it', () => {
    const s = fight(state());
    const prev = snapTick(s);
    s.fighters[0].action = { kind: 'blockstun', frame: 6 };
    expect(diffTick(prev, s, characters)).toContainEqual({ type: 'block', slot: 0 });
    expect(diffTick(snapTick(s), s, characters)).not.toContainEqual({ type: 'block', slot: 0 });
  });

  it('emits attack-start when the move changes mid-string', () => {
    const s = fight(state());
    s.fighters[0].action = { kind: 'attack', frame: 2, moveId: 'lp' };
    const prev = snapTick(s);
    s.fighters[0].action = { kind: 'attack', frame: 1, moveId: 'mp' };
    expect(diffTick(prev, s, characters)).toContainEqual({
      type: 'attack-start',
      slot: 0,
      moveId: 'mp',
      special: false,
      voiceLine: false,
    });
  });

  it('flags a perfect round for an untouched winner', () => {
    const s = fight(state());
    const prev = snapTick(s);
    s.phase = 'roundEnd';
    s.roundWinner = 0;
    s.fighters[1].health = 0;
    const [e] = diffTick(prev, s, characters).filter((x) => x.type === 'round-end');
    expect(e).toEqual({ type: 'round-end', winner: 0, timeUp: false, perfect: true });
  });

  it('emits dust exactly once when settling into knockdown', () => {
    const s = fight(state());
    const prev = snapTick(s);
    s.fighters[1].action = { kind: 'knockdown', frame: 0 };
    expect(diffTick(prev, s, characters)).toContainEqual({ type: 'dust', slot: 1 });
    expect(diffTick(snapTick(s), s, characters)).not.toContainEqual({ type: 'dust', slot: 1 });
  });

  it('emits projectile-spawn when the pool grows', () => {
    const s = fight(state());
    const prev = snapTick(s);
    s.projectiles.push({} as GameState['projectiles'][number]);
    expect(diffTick(prev, s, characters)).toContainEqual({ type: 'projectile-spawn' });
  });
});
