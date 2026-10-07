// Calibration lab (P13.1): run a full headless match between two bots through
// the real step(), and record what happened. Deterministic — same defs, bots
// and seed => same result — so a matchup matrix is reproducible.
import { initialState, step, type Defs, type GameState, type InputFrame, type MatchRules } from '../../engine';
import { stageArena } from '../../data/stages';

export interface Bot {
  poll(s: GameState): InputFrame;
}

export interface MoveStats {
  used: number;
  /** activations that connected (hit or block) */
  connected: number;
  hit: number;
  blocked: number;
}

export interface SideStats {
  charId: string;
  roundsWon: number;
  damageDealt: number;
  hitsLanded: number;
  blocks: number;
  /** times this side was hit while recovering from its own attack */
  punished: number;
  moves: Record<string, MoveStats>;
}

export interface MatchResult {
  winner: 0 | 1 | null;
  ticks: number;
  rounds: number;
  sides: [SideStats, SideStats];
}

/** the arena every lab match uses: a wide stage with the SF2 camera, like a
 *  real fight (stage art width only changes the walls, not the rules) */
export const LAB_STAGE = 'dojo';

export function labRules(): Partial<MatchRules> {
  return { ...stageArena(LAB_STAGE), introTicks: 0 };
}

const side = (charId: string): SideStats => ({ charId, roundsWon: 0, damageDealt: 0, hitsLanded: 0, blocks: 0, punished: 0, moves: {} });

/** Play one match to its end (or `maxTicks`). */
export function runMatch(
  defs: Defs,
  p1: string,
  p2: string,
  bots: [Bot, Bot],
  maxTicks = 60 * 60 * 6,
): MatchResult {
  const s = initialState(p1, p2, defs, labRules());
  const sides: [SideStats, SideStats] = [side(p1), side(p2)];
  const prev = s.fighters.map((f) => ({ health: f.health, kind: f.action.kind, frame: f.action.frame, moveId: f.action.moveId, hasHit: !!f.action.hasHit }));
  let rounds = 1;
  let lastRound = s.roundNumber;
  let t = 0;
  for (; t < maxTicks && s.phase !== 'matchEnd'; t++) {
    step(s, [bots[0].poll(s), bots[1].poll(s)], defs);
    if (s.roundNumber !== lastRound) {
      rounds++;
      lastRound = s.roundNumber;
    }
    for (const slot of [0, 1] as const) {
      const f = s.fighters[slot];
      const o = sides[slot === 0 ? 1 : 0];
      const me = sides[slot];
      const p = prev[slot];
      const a = f.action;
      // a new attack activation
      if (a.kind === 'attack' && a.moveId && (p.kind !== 'attack' || a.moveId !== p.moveId || a.frame < p.frame)) {
        (me.moves[a.moveId] ??= { used: 0, connected: 0, hit: 0, blocked: 0 }).used++;
      }
      if (a.kind === 'attack' && a.moveId && a.hasHit && !p.hasHit) me.moves[a.moveId] && me.moves[a.moveId].connected++;
      // this fighter took damage → the other side dealt it
      if (f.health < p.health) o.damageDealt += p.health - f.health;
      // reel starts (credited to the attacker's current move)
      const other = s.fighters[slot === 0 ? 1 : 0];
      const om = other.action.kind === 'attack' ? other.action.moveId : undefined;
      if ((a.kind === 'hitstun' || a.kind === 'airHit') && p.kind !== a.kind) {
        o.hitsLanded++;
        if (om && o.moves[om]) o.moves[om].hit++;
        if (p.kind === 'attack') me.punished++;
      }
      if (a.kind === 'blockstun' && p.kind !== 'blockstun') {
        me.blocks++;
        if (om && o.moves[om]) o.moves[om].blocked++;
      }
      prev[slot] = { health: f.health, kind: a.kind, frame: a.frame, moveId: a.moveId, hasHit: !!a.hasHit };
    }
  }
  sides[0].roundsWon = s.wins[0];
  sides[1].roundsWon = s.wins[1];
  const winner = s.wins[0] > s.wins[1] ? 0 : s.wins[1] > s.wins[0] ? 1 : null;
  return { winner, ticks: t, rounds, sides };
}
