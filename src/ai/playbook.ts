// Playbook: what a competent player knows about a fighter, derived from the
// MKS-1 bench (engine-MEASURED frame data, not the JSON). The smart bot
// (smart.ts) plays from it; the calibration lab (P13) rebuilds it whenever a
// fighter's data changes, so the bot always plays the fighter as it is.
import type { Defs, MoveDef, Strength } from '../engine';
import { measureCharacter, type MoveMeasure } from '../bench/framedata';
import { findCombos, type RouteStep } from '../bench/combos';

export interface PlayMove {
  id: string;
  strength: Strength;
  startup: number;
  /** total ticks start → actionable */
  total: number;
  onBlock: number | null;
  onHit: number | null;
  damage: number;
  /** center-distance window [min, max] px where it connects (vs a mirror) */
  range: [number, number];
  height: MoveDef['height'];
  knockdown: boolean;
  invuln: number;
  projectile: boolean;
  grab: boolean;
  crouching: boolean;
}

export interface Playbook {
  charId: string;
  /** fast, safe-ish ground buttons for neutral, longest reach first */
  pokes: PlayMove[];
  /** everything that hits, fastest first (punish table) */
  punishers: PlayMove[];
  /** invulnerable reversals / rising moves for anti-air, fastest first */
  antiAirs: PlayMove[];
  projectiles: PlayMove[];
  throws: PlayMove[];
  /** jump-in air normals, best reach first */
  airs: string[];
  /** verified combo routes, most damage first */
  combos: RouteStep[][];
  /** the furthest any poke reaches (px, center distance) */
  pokeReach: number;
  walkFwd: number;
  /** startup of this fighter's fastest overhead (99 = none) */
  fastestHigh: number;
}

const GROUND_NORMAL = /^c?[lmh][pk]$/;

function toPlay(m: MoveMeasure, def: MoveDef | undefined): PlayMove | null {
  if (!def || !m.connects || m.startup === null || !m.range) return null;
  return {
    id: m.id,
    strength: m.strength ?? 'm',
    startup: m.startup,
    total: m.total ?? m.startup + m.active + (m.recovery ?? 0),
    onBlock: m.onBlock,
    onHit: m.onHit,
    damage: m.damage,
    range: m.range,
    height: m.height,
    knockdown: m.knockdown,
    invuln: m.invuln,
    projectile: m.cls === 'projectile',
    grab: m.cls === 'throw',
    crouching: m.id.startsWith('c') && GROUND_NORMAL.test(m.id),
  };
}

// keyed by the CharacterDef object: a calibrated variant is a new object, so
// it gets its own playbook (never mutate a def in place and reuse it)
let cache = new WeakMap<object, Playbook>();

/** Build (or reuse) the playbook for `charId` under `defs`. */
export function playbookFor(defs: Defs, charId: string): Playbook {
  const def = defs[charId];
  const hit = cache.get(def);
  if (hit) return hit;
  const meas = measureCharacter(defs, charId);
  const all = meas.moves
    .map((m) => toPlay(m, def.moves[m.id]))
    .filter((m): m is PlayMove => m !== null)
    .filter((m) => !m.id.startsWith('j')); // air normals need a jump
  // floats / leaps into the air and utility moves aren't ground offense
  const ground = all.filter((m) => !m.grab && !def.moves[m.id]?.float && meas.moves.find((x) => x.id === m.id)?.cls !== 'utility');

  const pokes = ground
    .filter((m) => !m.projectile && GROUND_NORMAL.test(m.id) && m.startup <= 12)
    .sort((a, b) => b.range[1] - a.range[1]);
  const punishers = ground.filter((m) => !m.projectile).sort((a, b) => a.startup - b.startup || b.damage - a.damage);
  const antiAirs = ground
    .filter((m) => !m.projectile && (m.invuln > 0 || def.moves[m.id]?.leap) && m.startup <= 10)
    .sort((a, b) => a.startup - b.startup);
  const projectiles = ground.filter((m) => m.projectile).sort((a, b) => a.startup - b.startup);
  const throws = all.filter((m) => m.grab).sort((a, b) => b.damage - a.damage);
  const airs = meas.moves
    .filter((m) => m.id.startsWith('j') && m.connects)
    .sort((a, b) => b.reach - a.reach)
    .map((m) => m.id);
  let combos: RouteStep[][] = [];
  try {
    const found = findCombos(defs, charId, 3, meas.moves);
    combos = found.routes.sort((a, b) => b.damage - a.damage).map((r) => r.steps);
  } catch {
    combos = [];
  }
  // fastest overhead the fighter has (decides an opponent's default guard height)
  const fastestHigh = Math.min(99, ...all.filter((m) => m.height === 'high' && !m.grab).map((m) => m.startup));
  const pb: Playbook = {
    fastestHigh,
    charId,
    pokes,
    punishers,
    antiAirs,
    projectiles,
    throws,
    airs,
    combos,
    pokeReach: pokes[0]?.range[1] ?? 100,
    walkFwd: meas.physics.walkFwd,
  };
  cache.set(def, pb);
  return pb;
}

export function clearPlaybookCache(): void {
  cache = new WeakMap();
}
