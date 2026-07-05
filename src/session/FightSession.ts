// FightSession — the ONE fight-loop driver (SPEC V17/V18). Owns the fixed
// timestep accumulator, KO slow-mo pacing, and the step() call; scenes are
// presenters that feed deltaMs + input gathering and hang presentation off the
// tick hooks. Zero Phaser imports — vitest-able, and NetSession (rollback)
// swaps in behind the same surface without scene changes.
import { step, TICK_MS } from '../engine';
import type { Defs, GameState, InputFrame } from '../engine';

export interface SessionHooks {
  /** gather this tick's inputs (keyboard/CPU locally; net session wraps this) */
  inputs: (s: GameState) => [InputFrame, InputFrame];
  /** runs before step() — capture presentation snapshots here */
  beforeTick?: (s: GameState) => void;
  /** runs after step() — presentation diffing, per-scene upkeep */
  afterTick?: (s: GameState, inputs: [InputFrame, InputFrame]) => void;
}

export interface Session {
  readonly state: GameState;
  /** advance the sim by wall-clock deltaMs; returns ticks stepped */
  advance(deltaMs: number): number;
  /** drop banked time (pause, scene handoff) — never skips or rewinds ticks */
  resetPacing(): void;
  /** 0..1 fraction into the next tick (banked accumulator / TICK_MS) — lets the
   *  renderer interpolate between tick-quantized poses so animation stays smooth
   *  above 60Hz / under pacing jitter, without touching the deterministic sim */
  readonly alpha: number;
}

/** KO slow-mo: the round-ending hit plays out at ~1/3 speed — pure
 *  presentation pacing, ticks advance identically, just spaced out. */
export function koSlowActive(s: GameState): boolean {
  return (
    (s.phase === 'roundEnd' || s.phase === 'finisher') &&
    s.phaseFrame < 55 &&
    s.fighters.some((f) => f.health <= 0)
  );
}

export class FightSession implements Session {
  private accumulator = 0;

  constructor(
    readonly state: GameState,
    private readonly hooks: SessionHooks,
    private readonly defs: Defs,
  ) {}

  advance(deltaMs: number): number {
    // fixed timestep: rendering fps may vary, simulation never does
    this.accumulator += Math.min(deltaMs, 100) * (koSlowActive(this.state) ? 0.35 : 1);
    let ticks = 0;
    while (this.accumulator >= TICK_MS) {
      this.hooks.beforeTick?.(this.state);
      const inputs = this.hooks.inputs(this.state);
      step(this.state, inputs, this.defs);
      this.hooks.afterTick?.(this.state, inputs);
      this.accumulator -= TICK_MS;
      ticks++;
    }
    return ticks;
  }

  resetPacing(): void {
    this.accumulator = 0;
  }

  get alpha(): number {
    return Math.min(this.accumulator / TICK_MS, 1);
  }
}
