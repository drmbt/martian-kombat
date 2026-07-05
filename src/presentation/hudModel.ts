// Shared per-tick HUD bookkeeping (pure — no Phaser, no DOM): the SF2 ghost
// health bar (trails real health, holds a beat, then drains red) and the
// combo counter. Both presenters feed it the tick's events and read plain
// numbers back; how the bars/labels are drawn stays renderer-side.
import type { Defs, GameState } from '../engine';
import type { FightEvent } from './tickEvents';

/** ticks a fresh wound lingers before the ghost bar starts draining */
const GHOST_HOLD_TICKS = 32;
/** drain per tick, as a fraction of max health (matches the 2D feel) */
const GHOST_DRAIN = 0.008;
/** ticks the combo counter stays alive after the last hit */
const COMBO_TICKS = 90;

export class HudModel {
  /** ghost bar values, in health points (starts full) */
  ghost: [number, number];
  comboHits = 0;
  /** slot that DEALT the last combo hit (the counter anchors near them) */
  comboAttacker: 0 | 1 = 0;
  private holdUntil: [number, number] = [0, 0];
  private comboTicks = 0;

  constructor(
    private defs: Defs,
    charIds: [string, string],
  ) {
    this.ghost = [defs[charIds[0]].health, defs[charIds[1]].health];
  }

  /** call once per engine tick with that tick's diffTick events */
  tick(events: FightEvent[], s: GameState): void {
    for (const e of events) {
      if (e.type !== 'hit') continue;
      this.holdUntil[e.slot] = s.tick + GHOST_HOLD_TICKS;
      this.comboHits = e.comboContinues ? this.comboHits + 1 : 1;
      this.comboTicks = COMBO_TICKS;
      this.comboAttacker = e.slot === 0 ? 1 : 0;
    }
    for (const slot of [0, 1] as const) {
      const f = s.fighters[slot];
      // refills / round resets snap the ghost up instantly
      if (f.health > this.ghost[slot]) this.ghost[slot] = f.health;
      else if (f.health < this.ghost[slot] && s.tick >= this.holdUntil[slot]) {
        this.ghost[slot] = Math.max(f.health, this.ghost[slot] - this.defs[f.charId].health * GHOST_DRAIN);
      }
    }
    if (this.comboTicks > 0 && --this.comboTicks === 0) this.comboHits = 0;
  }

  /** "N HITS" while a 2+ combo is fresh, else '' (renderers hide on empty) */
  get comboLabel(): string {
    return this.comboHits >= 2 && this.comboTicks > 0 ? `${this.comboHits} HITS` : '';
  }

  /** fade-out alpha for the combo counter's last half second */
  get comboAlpha(): number {
    return Math.min(1, this.comboTicks / 30);
  }
}
