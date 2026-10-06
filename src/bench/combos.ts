// Combo-route finder: what is this character's best CONFIRMED meterless
// combo (the "BnB")? Routes are built from the kit's own grammar — `chains`,
// `cancel` (normal → any non-grab special) and LINKS (a normal whose on-hit
// advantage covers the next normal's startup) — and every route is VERIFIED
// by simulation: it only counts if each move lands on a still-reeling victim
// (engine comboHits). Damage includes the engine's combo scaling.
import { ACTIONABLE, benchState, moveFrames, run, touchGap, type Partial6 } from './sim';
import { measureMove, type MoveMeasure } from './framedata';
import { STAGE_MAX_X, type Defs, type Strength } from '../engine';

export interface RouteStep {
  id: string;
  strength: Strength;
  via: 'start' | 'chain' | 'cancel' | 'link';
}

export interface ComboRoute {
  steps: RouteStep[];
  damage: number;
  /** % of the victim's max health */
  pct: number;
  hits: number;
}

const GROUND_NORMALS = ['lp', 'mp', 'hp', 'lk', 'mk', 'hk', 'clp', 'cmp', 'chp', 'clk', 'cmk', 'chk'];

const label = (s: RouteStep): string => `${s.id}${s.via === 'start' || s.via === 'chain' || s.via === 'link' ? '' : `(${s.strength})`}`;
export const routeText = (r: ComboRoute): string =>
  r.steps.map((s, i) => (i === 0 ? label(s) : `${s.via === 'link' ? ',' : '>'} ${label(s)}`)).join(' ');

/** Run a route at `gap`; returns null when any step fails to combo. */
export function simulateRoute(defs: Defs, charId: string, steps: RouteStep[], gap: number, corner = false): ComboRoute | null {
  return runRoute(defs, charId, steps, gap, corner).route;
}

/** Run a route; `landed` = how many leading steps comboed before it broke. */
export function runRoute(
  defs: Defs,
  charId: string,
  steps: RouteStep[],
  gap: number,
  corner = false,
): { route: ComboRoute | null; landed: number } {
  const def = defs[charId];
  // corner: the victim starts pinned on the right wall
  const s = benchState(defs, charId, charId, gap, corner ? STAGE_MAX_X - gap : 260);
  const queue: Partial6[] = [...(moveFrames(def, steps[0].id, steps[0].strength, 1) ?? [])];
  let idx = 0;
  let contacted = false;
  let waitTicks = 0;
  let maxCombo = 0;
  let failed = false;
  let lastContactAt = -1;
  let landed = 0;
  const hp0 = s.fighters[1].health;
  let hpAtStep = hp0;
  run(
    s,
    defs,
    () => queue.shift() ?? {},
    () => ({}),
    600,
    (t, st) => {
      const [a, d] = st.fighters;
      maxCombo = Math.max(maxCombo, d.comboHits);
      const cur = steps[idx];
      const inCur = a.action.kind === 'attack' && a.action.moveId === cur.id;
      if (!contacted) {
        const hit = (inCur && a.action.hasHit) || d.health < hpAtStep;
        if (hit) {
          contacted = true;
          lastContactAt = t;
          waitTicks = 0;
          if (idx === 0 || d.comboHits >= idx + 1) landed = idx + 1;
          else {
            failed = true; // connected, but the victim had already recovered
            return true;
          }
        } else if (++waitTicks > 120) {
          failed = true;
          return true;
        }
        return false;
      }
      if (idx === steps.length - 1) {
        // let the last move finish its hits, then stop
        return t - lastContactAt > 40 || ACTIONABLE.has(d.action.kind);
      }
      const next = steps[idx + 1];
      if (queue.length === 0 && !(a.action.kind === 'attack' && a.action.moveId === next.id)) {
        const ready = next.via === 'link' ? ACTIONABLE.has(a.action.kind) : a.hitstop === 0;
        if (ready) queue.push(...(moveFrames(def, next.id, next.strength, 1) ?? []));
      }
      if (a.action.kind === 'attack' && a.action.moveId === next.id && a.action.frame <= 1) {
        idx++;
        contacted = false;
        waitTicks = 0;
        hpAtStep = d.health;
        return false;
      }
      if (++waitTicks > 60) {
        failed = true;
        return true;
      }
      return false;
    },
  );
  if (failed || idx !== steps.length - 1 || !contacted || maxCombo < steps.length) return { route: null, landed };
  const damage = hp0 - s.fighters[1].health;
  return { route: { steps, damage, pct: (damage / def.health) * 100, hits: maxCombo }, landed };
}

export interface ComboSearch {
  best: ComboRoute | null;
  /** best route per starter (verified) */
  routes: ComboRoute[];
  /** routes that hit the depth cap while still growing (possible loops) */
  loops: ComboRoute[];
}

/** Bounded DFS over chains / cancels / links, depth ≤ maxDepth moves. */
export function findCombos(defs: Defs, charId: string, maxDepth = 4, measured?: MoveMeasure[]): ComboSearch {
  const def = defs[charId];
  const gap = touchGap(def, def) + 1;
  const meas = new Map<string, MoveMeasure>();
  for (const id of GROUND_NORMALS) {
    if (!def.moves[id]) continue;
    meas.set(id, measured?.find((m) => m.id === id && !m.strength) ?? measureMove(defs, charId, id));
  }
  const specials = Object.entries(def.moves)
    .filter(([, m]) => m.input && !m.grab && !m.projectile?.field && (m.damage > 0 || m.projectile))
    .map(([id]) => id);

  const nextSteps = (prev: RouteStep): RouteStep[] => {
    const pm = def.moves[prev.id];
    const out: RouteStep[] = [];
    if (pm.input) {
      for (const c of pm.chains ?? []) if (def.moves[c]) out.push({ id: c, strength: 'm', via: 'chain' });
      return out;
    }
    for (const c of pm.chains ?? []) if (def.moves[c] && !def.moves[c].input) out.push({ id: c, strength: 'm', via: 'chain' });
    if (pm.cancel) for (const sp of specials) for (const st of ['l', 'm', 'h'] as Strength[]) out.push({ id: sp, strength: st, via: 'cancel' });
    const pmm = meas.get(prev.id);
    if (pmm?.onHit !== null && pmm?.onHit !== undefined) {
      for (const [id, mm] of meas) {
        if (mm.startup !== null && mm.connects && pmm.onHit >= mm.startup - 1 && !(pm.chains ?? []).includes(id)) {
          out.push({ id, strength: 'm', via: 'link' });
        }
      }
    }
    return out;
  };

  const routes: ComboRoute[] = [];
  const loops: ComboRoute[] = [];
  let starterBest: ComboRoute | null = null;
  const dfs = (steps: RouteStep[], verified: ComboRoute): void => {
    if (!starterBest || verified.damage > starterBest.damage) starterBest = verified;
    const last = def.moves[steps.at(-1)!.id];
    if (steps.length >= maxDepth) {
      // still comboing at the cap with a repeated normal = a possible loop
      const ids = steps.map((st) => st.id);
      if (new Set(ids).size < ids.length && !last.input) loops.push(verified);
      return;
    }
    if (last.input && !last.chains?.length) return; // specials end routes
    for (const nx of nextSteps(steps.at(-1)!)) {
      const r = simulateRoute(defs, charId, [...steps, nx], gap);
      if (r) dfs([...steps, nx], r);
    }
  };
  for (const [id, mm] of meas) {
    if (!mm.connects) continue;
    const start: RouteStep[] = [{ id, strength: 'm', via: 'start' }];
    const r = simulateRoute(defs, charId, start, gap);
    if (!r) continue;
    starterBest = null;
    dfs(start, r);
    if (starterBest) routes.push(starterBest);
  }
  routes.sort((x, y) => y.damage - x.damage);
  return { best: routes[0] ?? null, routes, loops };
}

export interface LoopVerdict {
  cycle: string;
  /** longest verified repetition (moves) midscreen / in the corner */
  midscreen: number;
  corner: number;
  /** still comboing at the cap in either position */
  infinite: boolean;
}

/** How long does a repeating chain cycle actually combo before pushback (or
 *  the light-chain grammar) ends it? `cap` moves = treated as infinite. */
export function verifyLoop(defs: Defs, charId: string, loop: ComboRoute, cap = 16): LoopVerdict {
  const def = defs[charId];
  const gap = touchGap(def, def) + 1;
  const ids = loop.steps.map((st) => st.id);
  const first = ids.findIndex((id, i) => ids.indexOf(id) !== i);
  const start = ids.indexOf(ids[first]);
  // canonical rotation so lk>clp and clp>lk are the same loop
  const raw = loop.steps.slice(start, first);
  const rot = raw.map((_, i) => [...raw.slice(i), ...raw.slice(0, i)]);
  const cycle = rot.sort((x, y) => x.map((c) => c.id).join('>').localeCompare(y.map((c) => c.id).join('>')))[0];
  // one simulation per position: run the cycle out to `cap` moves and read
  // how many landed before pushback (or anything) broke it
  const longest = (corner: boolean): number => {
    const steps: RouteStep[] = Array.from({ length: cap }, (_, i) => ({
      ...cycle[i % cycle.length],
      via: i === 0 ? 'start' : cycle[i % cycle.length].via === 'start' ? 'chain' : cycle[i % cycle.length].via,
    }));
    return runRoute(defs, charId, steps, gap, corner).landed;
  };
  const midscreen = longest(false);
  const corner = longest(true);
  return { cycle: cycle.map((c) => c.id).join(' > '), midscreen, corner, infinite: midscreen >= cap || corner >= cap };
}

/** Every simple cycle (length ≤ 3) in the normals' chain + link graph — the
 *  only shapes that can loop forever (specials end routes). Cheap: no DFS
 *  simulation, each candidate is then checked with verifyLoop. */
export function chainCycles(defs: Defs, charId: string, measured: MoveMeasure[]): ComboRoute[] {
  const def = defs[charId];
  const meas = new Map(measured.filter((m) => !m.strength && GROUND_NORMALS.includes(m.id)).map((m) => [m.id, m]));
  const edges = new Map<string, { to: string; via: RouteStep['via'] }[]>();
  for (const [id, mm] of meas) {
    const out: { to: string; via: RouteStep['via'] }[] = [];
    for (const c of def.moves[id].chains ?? []) if (meas.has(c)) out.push({ to: c, via: 'chain' });
    if (mm.onHit !== null && !mm.knockdown) {
      for (const [to, tm] of meas) {
        if (tm.startup !== null && tm.connects && mm.onHit >= tm.startup - 1 && !out.some((e) => e.to === to)) out.push({ to, via: 'link' });
      }
    }
    edges.set(id, out);
  }
  const found = new Map<string, ComboRoute>();
  const walk = (path: RouteStep[]): void => {
    const last = path.at(-1)!.id;
    for (const e of edges.get(last) ?? []) {
      if (e.to === path[0].id) {
        const cyc = [...path, { id: e.to, strength: 'm' as Strength, via: e.via }];
        const ids = cyc.slice(0, -1).map((x) => x.id);
        const key = ids.map((_, i) => [...ids.slice(i), ...ids.slice(0, i)].join('>')).sort()[0];
        if (!found.has(key)) found.set(key, { steps: cyc, damage: 0, pct: 0, hits: 0 });
      } else if (path.length < 3 && !path.some((x) => x.id === e.to)) {
        walk([...path, { id: e.to, strength: 'm', via: e.via }]);
      }
    }
  };
  for (const id of meas.keys()) if (meas.get(id)!.connects) walk([{ id, strength: 'm', via: 'start' }]);
  return [...found.values()];
}
