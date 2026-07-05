// bannerFor is the ONE source of center-stage announcements for both
// renderers — pure state in, [text, variant] out.
import { describe, expect, it } from 'vitest';
import { characters } from '../data/characters';
import { initialState } from '../engine';
import type { GameState } from '../engine';
import { bannerFor } from './banner';

const state = (rules?: Parameters<typeof initialState>[3]): GameState =>
  initialState('vincent', 'yulia', characters, rules);

describe('bannerFor short intro (2D default)', () => {
  it('shows ROUND N then FIGHT! across the 90-tick intro', () => {
    const s = state();
    s.phaseFrame = 10;
    expect(bannerFor(s, characters, -1)).toEqual(['ROUND 1', 'pop']);
    s.phaseFrame = 60; // past the 60% mark
    expect(bannerFor(s, characters, -1)).toEqual(['FIGHT!', 'slam']);
  });
});

describe('bannerFor long intro (3D entry gestures)', () => {
  it('runs ROUND 1 → READY? → 3-2-1', () => {
    const s = state({ introTicks: 240 });
    s.phaseFrame = 10;
    expect(bannerFor(s, characters, -1)[0]).toBe('ROUND 1');
    s.phaseFrame = 50;
    expect(bannerFor(s, characters, -1)[0]).toBe('READY?');
    s.phaseFrame = 70; // 170 left
    expect(bannerFor(s, characters, -1)).toEqual(['3', 'count']);
    s.phaseFrame = 130;
    expect(bannerFor(s, characters, -1)).toEqual(['2', 'count']);
    s.phaseFrame = 190;
    expect(bannerFor(s, characters, -1)).toEqual(['1', 'count']);
  });
});

describe('bannerFor fight + round end', () => {
  it('slams FIGHT! for a beat after entering the fight phase', () => {
    const s = state();
    s.phase = 'fight';
    s.tick = 100;
    expect(bannerFor(s, characters, 90)).toEqual(['FIGHT!', 'slam']);
    s.tick = 150; // 60 ticks in — flash over
    expect(bannerFor(s, characters, 90)).toEqual(['', 'pop']);
    expect(bannerFor(s, characters, -1)).toEqual(['', 'pop']); // never entered
  });

  it('K.O., then PERFECT shine for an untouched winner', () => {
    const s = state();
    s.phase = 'roundEnd';
    s.roundWinner = 0;
    s.fighters[1].health = 0;
    s.phaseFrame = 10;
    expect(bannerFor(s, characters, -1)).toEqual(['K.O.!', 'slam']);
    s.phaseFrame = 90;
    expect(bannerFor(s, characters, -1)).toEqual(['PERFECT', 'shine']);
    s.fighters[0].health -= 1; // no longer perfect
    expect(bannerFor(s, characters, -1)).toEqual(['', 'pop']);
  });

  it('TIME UP and DOUBLE K.O. take precedence', () => {
    const s = state();
    s.phase = 'roundEnd';
    s.roundWinner = 0;
    s.timer = 0;
    expect(bannerFor(s, characters, -1)).toEqual(['TIME UP', 'slam']);
    s.timer = 100;
    s.roundWinner = null;
    expect(bannerFor(s, characters, -1)).toEqual(['DOUBLE K.O.', 'slam']);
  });

  it('FINISH THEM pulses; FATALITY slams then clears', () => {
    const s = state();
    s.phase = 'finisher';
    expect(bannerFor(s, characters, -1)).toEqual(['FINISH THEM', 'pulse']);
    s.phase = 'fatality';
    s.phaseFrame = 10;
    expect(bannerFor(s, characters, -1)).toEqual(['FATALITY', 'slam']);
    s.phaseFrame = 80;
    expect(bannerFor(s, characters, -1)).toEqual(['', 'pop']);
  });
});
