// Shared ghost-bar + combo bookkeeping — the same numbers drive the Phaser
// HUD and the DOM HUD, so hold/drain/snap and combo lifetime are pinned here.
import { describe, expect, it } from 'vitest';
import { characters } from '../data/characters';
import { initialState } from '../engine';
import type { GameState } from '../engine';
import { HudModel } from './hudModel';
import type { FightEvent } from './tickEvents';

const CHARS: [string, string] = ['vincent', 'yulia'];
const FULL = characters.vincent.health;

const state = (): GameState => {
  const s = initialState(CHARS[0], CHARS[1], characters);
  s.phase = 'fight';
  return s;
};

const hit = (slot: 0 | 1, comboContinues = false): FightEvent => ({
  type: 'hit', slot, damage: 30, counter: false, heavy: false, comboContinues,
});

describe('HudModel ghost bar', () => {
  it('holds after a hit, then drains toward live health', () => {
    const m = new HudModel(characters, CHARS);
    const s = state();
    s.fighters[0].health -= 200;
    m.tick([hit(0)], s);
    expect(m.ghost[0]).toBe(FULL); // fresh wound: bar hangs
    // inside the hold window nothing moves
    for (let i = 0; i < 31; i++) {
      s.tick++;
      m.tick([], s);
    }
    expect(m.ghost[0]).toBe(FULL);
    // past the hold it drains, clamped at live health
    s.tick++;
    m.tick([], s);
    expect(m.ghost[0]).toBeLessThan(FULL);
    for (let i = 0; i < 300; i++) {
      s.tick++;
      m.tick([], s);
    }
    expect(m.ghost[0]).toBe(s.fighters[0].health);
  });

  it('snaps up instantly on refill / round reset', () => {
    const m = new HudModel(characters, CHARS);
    const s = state();
    s.fighters[1].health -= 400;
    m.tick([hit(1)], s);
    for (let i = 0; i < 200; i++) {
      s.tick++;
      m.tick([], s);
    }
    s.fighters[1].health = characters.yulia.health; // round reset
    m.tick([], s);
    expect(m.ghost[1]).toBe(characters.yulia.health);
  });
});

describe('HudModel combo counter', () => {
  it('counts continuing hits and anchors on the attacker', () => {
    const m = new HudModel(characters, CHARS);
    const s = state();
    m.tick([hit(1, false)], s);
    expect(m.comboLabel).toBe(''); // one hit is not a combo
    m.tick([hit(1, true)], s);
    expect(m.comboLabel).toBe('2 HITS');
    expect(m.comboAttacker).toBe(0);
    m.tick([hit(1, true)], s);
    expect(m.comboLabel).toBe('3 HITS');
  });

  it('resets when the defender escaped stun', () => {
    const m = new HudModel(characters, CHARS);
    const s = state();
    m.tick([hit(0, false)], s);
    m.tick([hit(0, true)], s);
    expect(m.comboLabel).toBe('2 HITS');
    m.tick([hit(0, false)], s); // fresh opener
    expect(m.comboLabel).toBe('');
  });

  it('expires after its lifetime and fades near the end', () => {
    const m = new HudModel(characters, CHARS);
    const s = state();
    m.tick([hit(1, false)], s);
    m.tick([hit(1, true)], s);
    expect(m.comboAlpha).toBe(1);
    for (let i = 0; i < 88; i++) m.tick([], s);
    expect(m.comboLabel).toBe('2 HITS');
    expect(m.comboAlpha).toBeLessThan(1); // fading out
    m.tick([], s);
    expect(m.comboLabel).toBe('');
  });
});
