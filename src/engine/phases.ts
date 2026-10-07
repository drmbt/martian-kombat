// Match construction and round flow: initial state, round reset, round end
// and the physics that run outside the fight phase.
// Part of the deterministic fight core (split out of step.ts in P3.9).
// Same rules as all of src/engine/: no Phaser, no randomness, no wall clock.

import {
  CharacterDef,
  FighterState,
  GameState,
  MatchRules,
} from './types';
import {
  DASH_STOCKS,
  FLOOR_Y,
  GROUND_FRICTION,
  JUGGLE_POINTS,
  INTRO_TICKS,
  ROUND_TICKS,
  SPAWN_OFFSET,
  STAGE_MAX_X,
  STAGE_MIN_X,
  STAGE_W,
  WINS_NEEDED,
} from './constants';
import { Defs, grounded, airStep, settle, koPop } from './world';

export function initFighter(charId: string, def: CharacterDef, slot: 0 | 1): FighterState {
  return {
    charId,
    x: STAGE_W / 2 + (slot === 0 ? -SPAWN_OFFSET : SPAWN_OFFSET),
    y: FLOOR_Y,
    vx: 0,
    vy: 0,
    facing: slot === 0 ? 1 : -1,
    health: def.health,
    action: { kind: 'idle', frame: 0 },
    inputBuffer: [],
    charge: 0,
    backCharge: 0,
    chargeWindow: 0,
    backChargeWindow: 0,
    stun: 0,
    hitstop: 0,
    buffered: null,
    dashStocks: DASH_STOCKS,
    dashRegen: 0,
    comboHits: 0,
    juggle: JUGGLE_POINTS,
    floatGravity: 0,
  };
}

export function initialState(
  charA: string,
  charB: string,
  defs: Defs,
  rules?: Partial<MatchRules>,
): GameState {
  const r: MatchRules = {
    roundTicks: rules?.roundTicks ?? ROUND_TICKS,
    winsNeeded: rules?.winsNeeded ?? WINS_NEEDED,
    stage: rules?.stage ?? { minX: STAGE_MIN_X, maxX: STAGE_MAX_X },
    introTicks: rules?.introTicks ?? INTRO_TICKS,
    ...(rules?.camera ? { camera: rules.camera } : {}),
  };
  return {
    tick: 0,
    phase: 'intro',
    phaseFrame: 0,
    roundNumber: 1,
    rules: r,
    timer: r.roundTicks,
    fighters: [initFighter(charA, defs[charA], 0), initFighter(charB, defs[charB], 1)],
    projectiles: [],
    wins: [0, 0],
    roundWinner: null,
    fatality: null,
    pendingThrow: null,
  };
}

export function resetRound(s: GameState, defs: Defs): void {
  const [a, b] = s.fighters;
  s.fighters = [initFighter(a.charId, defs[a.charId], 0), initFighter(b.charId, defs[b.charId], 1)];
  s.projectiles = [];
  s.timer = s.rules.roundTicks;
  s.roundNumber++;
  s.roundWinner = null;
  s.phase = 'intro';
  s.phaseFrame = 0;
  s.pendingThrow = null;
}

export function endRound(s: GameState, winner: 0 | 1 | null, defs: Defs): void {
  s.roundWinner = winner;
  if (winner !== null) s.wins[winner]++;

  // match-deciding KO by a fighter with a fatality: open the finisher window
  // instead of the normal KO — the loser stands dazed, awaiting their fate
  if (winner !== null && s.wins[winner] >= s.rules.winsNeeded) {
    const loser = winner === 0 ? 1 : 0;
    const winnerDef = defs[s.fighters[winner].charId];
    if (winnerDef.fatality && s.fighters[loser].health <= 0) {
      s.phase = 'finisher';
      s.phaseFrame = 0;
      s.projectiles = [];
      s.fighters[loser].action = { kind: 'dazed', frame: 0 };
      s.fighters[loser].vx = 0;
      return;
    }
  }

  s.phase = 'roundEnd';
  s.phaseFrame = 0;
  for (const slot of [0, 1] as const) {
    const f = s.fighters[slot];
    if (f.health <= 0) koPop(f, -f.facing);
  }
}

export function passivePhysics(f: FighterState, def: CharacterDef, stage: { minX: number; maxX: number }): void {
  if (!grounded(f) || f.action.kind === 'ko') {
    if (airStep(f, def.gravity)) settle(f);
  } else {
    f.x += f.vx;
    f.vx *= GROUND_FRICTION;
    if (Math.abs(f.vx) < 0.05) f.vx = 0;
  }
  f.x = Math.min(stage.maxX, Math.max(stage.minX, f.x));
}
