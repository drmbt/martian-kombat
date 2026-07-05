// Center-stage announcement as a PURE function of engine state (no timers,
// no tweens — replay/rollback safe). Shared by both presenters; how the text
// slams/pops/pulses onto the screen is the renderer's business.
import type { Defs, GameState } from '../engine';
import { INTRO_TICKS } from '../engine';

export type BannerVariant = 'pop' | 'slam' | 'count' | 'pulse' | 'shine';

/** `fightEnteredTick` = engine tick when the fight phase last began (phaseFrame
 *  stays 0 during fight, so the FIGHT! flash needs its own clock; pass -1
 *  before the first fight phase). */
export function bannerFor(
  s: GameState,
  defs: Defs,
  fightEnteredTick: number,
): [string, BannerVariant] {
  const introLen = s.roundNumber === 1 ? s.rules.introTicks : INTRO_TICKS;
  switch (s.phase) {
    case 'intro': {
      const left = introLen - s.phaseFrame;
      // long first intro (3D entry gestures): ROUND 1 → READY? → 3-2-1
      if (s.roundNumber === 1 && s.rules.introTicks >= 240) {
        if (left > 180) return [s.phaseFrame < 45 ? `ROUND ${s.roundNumber}` : 'READY?', 'pop'];
        if (left > 120) return ['3', 'count'];
        if (left > 60) return ['2', 'count'];
        return ['1', 'count'];
      }
      // short intro: ROUND N then FIGHT! for the back stretch
      return s.phaseFrame < introLen * 0.6 ? [`ROUND ${s.roundNumber}`, 'pop'] : ['FIGHT!', 'slam'];
    }
    case 'fight':
      return fightEnteredTick >= 0 && s.tick - fightEnteredTick < 55 ? ['FIGHT!', 'slam'] : ['', 'pop'];
    case 'roundEnd': {
      if (s.roundWinner === null) {
        return [s.rules.roundTicks > 0 && s.timer <= 0 ? 'TIME UP' : 'DOUBLE K.O.', 'slam'];
      }
      if (s.rules.roundTicks > 0 && s.timer <= 0) return ['TIME UP', 'slam'];
      const w = s.fighters[s.roundWinner];
      const perfect = w.health === defs[w.charId].health;
      if (perfect && s.phaseFrame >= 60 && s.phaseFrame < 150) return ['PERFECT', 'shine'];
      return s.phaseFrame < 60 ? ['K.O.!', 'slam'] : ['', 'pop'];
    }
    case 'finisher':
      return ['FINISH THEM', 'pulse'];
    case 'fatality':
      return s.phaseFrame < 70 ? ['FATALITY', 'slam'] : ['', 'pop'];
    default:
      return ['', 'pop'];
  }
}
