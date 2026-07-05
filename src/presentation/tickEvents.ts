// Pure presentation-event detection (SPEC T17, V15): diff engine state
// before/after a tick into typed events. No Phaser, no Three, no side
// effects — both presenters (2D FightScene post-Sprint-19, 3D FightScene3D
// now) map these to their own sounds/vfx. Mirrors FightScene.presentTick's
// detection logic; that scene migrates onto this module after Sprint 19.
import type { Defs, GameState, Phase } from '../engine';
import { INTRO_TICKS } from '../engine';

export interface TickSnap {
  phase: Phase;
  kinds: [string, string];
  moveIds: [string | undefined, string | undefined];
  healths: [number, number];
  bounced: [boolean, boolean];
  projectiles: number;
  pendingThrow: boolean;
}

export function snapTick(s: GameState): TickSnap {
  const [a, b] = s.fighters;
  return {
    phase: s.phase,
    kinds: [a.action.kind, b.action.kind],
    moveIds: [a.action.moveId, b.action.moveId],
    healths: [a.health, b.health],
    bounced: [a.action.bounced === true, b.action.bounced === true],
    projectiles: s.projectiles.length,
    pendingThrow: s.pendingThrow !== null,
  };
}

export type FightEvent =
  | { type: 'round-intro'; round: number }
  /** READY? 3-2-1 countdown pips on long first intros (n = 3, 2, 1) */
  | { type: 'count'; n: number }
  | { type: 'fight-start' }
  | { type: 'round-end'; winner: 0 | 1 | null; timeUp: boolean; perfect: boolean }
  | { type: 'match-end'; winner: 0 | 1 }
  | { type: 'finisher' }
  | { type: 'fatality-start' }
  /** `slot` = the fighter that got hurt; `comboContinues` = they never left stun */
  | { type: 'hit'; slot: 0 | 1; damage: number; counter: boolean; heavy: boolean; comboContinues: boolean }
  | { type: 'block'; slot: 0 | 1 }
  | { type: 'attack-start'; slot: 0 | 1; moveId: string; special: boolean }
  | { type: 'jump'; slot: 0 | 1 }
  | { type: 'taunt'; slot: 0 | 1 }
  /** ground-impact dust: airHit floor bounce or settling into knockdown */
  | { type: 'dust'; slot: 0 | 1 }
  | { type: 'projectile-spawn' }
  | { type: 'throw-connect' };

export function diffTick(prev: TickSnap, s: GameState, defs: Defs): FightEvent[] {
  const events: FightEvent[] = [];

  // phase cues
  if (s.phase === 'intro' && s.phaseFrame === 1 && s.tick > 1) {
    events.push({ type: 'round-intro', round: s.roundNumber });
  }
  const introLen = s.roundNumber === 1 ? s.rules.introTicks : INTRO_TICKS;
  if (s.phase === 'intro' && introLen >= 240) {
    for (const n of [3, 2, 1]) {
      if (s.phaseFrame === introLen - n * 60) events.push({ type: 'count', n });
    }
  }
  if (s.phase === 'intro' && s.phaseFrame === introLen - Math.ceil(INTRO_TICKS * 0.4)) {
    events.push({ type: 'fight-start' });
  }
  if (prev.phase === 'fight' && s.phase === 'roundEnd') {
    const w = s.roundWinner;
    events.push({
      type: 'round-end',
      winner: w,
      timeUp: s.rules.roundTicks > 0 && s.timer <= 0,
      perfect: w !== null && s.fighters[w].health === defs[s.fighters[w].charId].health,
    });
  }
  if ((prev.phase === 'roundEnd' || prev.phase === 'fatality') && s.phase === 'matchEnd' && s.roundWinner !== null) {
    events.push({ type: 'match-end', winner: s.roundWinner });
  }
  if (prev.phase === 'fight' && s.phase === 'finisher') events.push({ type: 'finisher' });
  if (prev.phase === 'finisher' && s.phase === 'fatality') events.push({ type: 'fatality-start' });

  // per-fighter transitions
  for (const slot of [0, 1] as const) {
    const f = s.fighters[slot];
    const other = s.fighters[slot === 0 ? 1 : 0];
    const kind = f.action.kind;
    const was = prev.kinds[slot];

    if (f.health < prev.healths[slot]) {
      const atkAction = other.action;
      const atkMove =
        atkAction.kind === 'attack' || atkAction.kind === 'airAttack'
          ? defs[other.charId].moves[atkAction.moveId!]
          : undefined;
      const damage = prev.healths[slot] - f.health;
      events.push({
        type: 'hit',
        slot,
        damage,
        counter: f.action.counter === true,
        heavy: !!atkMove?.input || /h[pk]$/.test(atkAction.moveId ?? '') || damage >= 55,
        comboContinues: was === 'hitstun' || was === 'airHit',
      });
    }
    if (kind === 'blockstun' && was !== 'blockstun') events.push({ type: 'block', slot });
    if (kind === 'taunt' && was !== 'taunt') events.push({ type: 'taunt', slot });
    if (
      (kind === 'attack' || kind === 'airAttack') &&
      (was !== kind || prev.moveIds[slot] !== f.action.moveId)
    ) {
      events.push({
        type: 'attack-start',
        slot,
        moveId: f.action.moveId!,
        special: !!defs[f.charId].moves[f.action.moveId!]?.input,
      });
    }
    if (kind === 'air' && was === 'prejump') events.push({ type: 'jump', slot });
    const bouncedNow = kind === 'airHit' && f.action.bounced === true;
    if ((bouncedNow && !prev.bounced[slot]) || (kind === 'knockdown' && was !== 'knockdown')) {
      events.push({ type: 'dust', slot });
    }
  }

  if (s.projectiles.length > prev.projectiles) events.push({ type: 'projectile-spawn' });
  if (s.pendingThrow !== null && !prev.pendingThrow) events.push({ type: 'throw-connect' });

  return events;
}
