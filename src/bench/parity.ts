// Parity bench: does a ported character play like its source?
//
// `parityReport` measures the port IN OUR ENGINE (framedata.ts) and diffs it
// against the reference table the porter computed with MUGEN/IKEMEN semantics
// (src/compat/mugen/port.ts). Distances compare in CH (character heights) so
// localcoord 320x240 and our 960x540 world line up; frames compare 1:1 (both
// engines tick at 60 Hz).
//
// `fitPort` is the "tweak the cloned table until it plays the same" loop:
// it nudges the port's per-move timings/pushback and physics until the
// measured numbers land on the reference, and logs every change. Whatever it
// CANNOT fit is an engine-semantics gap (and goes on the parity backlog).
import { JUMP_VEL_MULT, type CharacterDef, type Defs, type MoveDef, type Strength, type VariantPatch } from '../engine';
import type { RefMove, RefTable } from '../compat/mugen/port';
import { measureMove, measurePhysics, type MoveMeasure, type PhysicsMeasure } from './framedata';

export interface ParityRow {
  scope: string;
  metric: string;
  ref: number | null;
  ours: number | null;
  /** within tolerance (null when one side is n/a) */
  ok: boolean | null;
  tol: string;
}

export interface ParityResult {
  id: string;
  rows: ParityRow[];
  /** fraction of comparable rows within tolerance, 0..1 */
  score: number;
  measured: { physics: PhysicsMeasure; moves: MoveMeasure[] };
}

const defsOf = (def: CharacterDef): Defs => ({ [def.id]: def });

function row(scope: string, metric: string, ref: number | null, ours: number | null, absTol: number, relTol = 0): ParityRow {
  const comparable = ref !== null && ours !== null && Number.isFinite(ref) && Number.isFinite(ours);
  const tol = Math.max(absTol, Math.abs(ref ?? 0) * relTol);
  return {
    scope,
    metric,
    ref: ref === null ? null : +ref.toFixed(3),
    ours: ours === null ? null : +ours.toFixed(3),
    ok: comparable ? Math.abs((ref as number) - (ours as number)) <= tol + 1e-9 : null,
    tol: relTol ? `±${absTol} / ${relTol * 100}%` : `±${absTol}`,
  };
}

/** the ref move(s) our port can be measured against */
function comparableRefs(def: CharacterDef, ref: RefTable): RefMove[] {
  return ref.moves.filter((m) => def.moves[m.id] && m.kind !== 'air');
}

export function parityReport(def: CharacterDef, ref: RefTable): ParityResult {
  const defs = defsOf(def);
  const CH = def.hurtStand.h;
  const rch = (px: number): number => px / ref.standHeight;
  const och = (px: number): number => px / CH;
  const rows: ParityRow[] = [];
  const phys = measurePhysics(defs, def.id);
  const rp = ref.physics;
  rows.push(row('physics', 'walk fwd (CH/s)', rch(rp.walkFwd * 60), och(phys.walkFwd * 60), 0.05, 0.05));
  rows.push(row('physics', 'walk back (CH/s)', rch(rp.walkBack * 60), och(phys.walkBack * 60), 0.05, 0.05));
  rows.push(row('physics', 'prejump (f)', rp.prejump, phys.prejump, 1));
  rows.push(row('physics', 'jump airtime (f)', rp.airtime, phys.airtime, 1.5));
  rows.push(row('physics', 'jump apex (CH)', rch(rp.apex), och(phys.apex), 0.05, 0.05));
  rows.push(row('physics', 'fwd jump distance (CH)', rch(rp.jumpDistFwd), och(phys.jumpDist), 0.05, 0.05));
  rows.push(row('physics', 'landing (f)', rp.landing, phys.landing, 1));
  rows.push(row('physics', 'health', ref.health, def.health, 0));

  const moves: MoveMeasure[] = [];
  for (const rm of comparableRefs(def, ref)) {
    const strength: Strength = rm.strength ?? 'm';
    const mm = measureMove(defs, def.id, rm.id, strength);
    moves.push(mm);
    const scope = `${rm.id}${rm.strength ? `[${rm.strength}]` : ''}`;
    rows.push(row(scope, 'startup (f)', rm.startup, mm.startup, 1));
    rows.push(row(scope, 'total (f)', rm.total, mm.total, 1));
    rows.push(row(scope, 'damage', rm.damage, mm.damage, 0));
    if (rm.kind === 'throw') {
      rows.push(row(scope, 'throw range (CH)', rm.throwRange !== undefined ? rch(rm.throwRange) : null, def.moves[rm.id].grab ? och(def.moves[rm.id].grab!.range) : null, 0.03));
      continue;
    }
    rows.push(row(scope, 'hitstop victim (f)', rm.hitstop[1], mm.hitstop?.[1] ?? null, 0));
    rows.push(row(scope, 'on hit (f)', rm.onHit, mm.onHit, 1));
    rows.push(row(scope, 'on block (f)', rm.onBlock, mm.onBlock, 1));
    rows.push(row(scope, 'pushback hit (CH)', rm.onHit === null ? null : rch(rm.pushHit), mm.pushHit === null ? null : och(mm.pushHit), 0.03, 0.15));
    rows.push(row(scope, 'pushback block (CH)', rch(rm.pushBlock), mm.pushBlock === null ? null : och(mm.pushBlock), 0.03, 0.15));
  }
  const comparable = rows.filter((r) => r.ok !== null);
  const score = comparable.length ? comparable.filter((r) => r.ok).length / comparable.length : 0;
  return { id: def.id, rows, score, measured: { physics: phys, moves } };
}

/** where a ref move's numbers live in the port: the base move, or a variant */
function slotFor(def: CharacterDef, rm: RefMove): { get: () => MoveDef; patch: (p: Partial<VariantPatch>) => void } {
  const base = def.moves[rm.id];
  const s = rm.strength;
  const v = s ? base.variants?.[s] : undefined;
  if (s && v) {
    return {
      get: () => ({ ...base, ...v } as MoveDef),
      patch: (p) => Object.assign(base.variants![s]!, p),
    };
  }
  return { get: () => base, patch: (p) => Object.assign(base, p) };
}

export interface FitResult {
  def: CharacterDef;
  log: string[];
  before: number;
  after: number;
}

/** Iteratively fit the port's table to the reference (3 passes). Mutates a
 *  deep copy; returns the fitted def + a human-readable change log. */
export function fitPort(input: CharacterDef, ref: RefTable): FitResult {
  const def: CharacterDef = structuredClone(input);
  const log: string[] = [];
  const before = parityReport(def, ref).score;
  const CH = def.hurtStand.h;
  const k = CH / ref.standHeight;

  // physics are closed-form in our engine: set them exactly
  const rp = ref.physics;
  const set = <K extends keyof CharacterDef>(key: K, v: CharacterDef[K], why: string): void => {
    if (JSON.stringify(def[key]) === JSON.stringify(v)) return;
    log.push(`${String(key)}: ${JSON.stringify(def[key])} → ${JSON.stringify(v)} (${why})`);
    def[key] = v;
  };
  set('walkSpeed', +(rp.walkFwd * k).toFixed(3), 'walk.fwd');
  set('backSpeed', +(rp.walkBack * k).toFixed(3), 'walk.back');
  set('gravity', +(rp.gravity * k).toFixed(4), 'yaccel');
  set('jumpVel', +((rp.jumpVy * k) / JUMP_VEL_MULT).toFixed(4), 'jump.neu y (÷ engine JUMP_VEL_MULT)');
  set('jumpSpeedX', +(rp.jumpVxFwd * k).toFixed(3), 'jump.fwd');

  for (let pass = 0; pass < 4; pass++) {
    const defs = defsOf(def);
    const phys = measurePhysics(defs, def.id);
    if (phys.prejump !== rp.prejump) set('prejumpFrames', Math.max(1, def.prejumpFrames + (rp.prejump - phys.prejump)), 'anim 40 length');
    // jump distance is NOT closed-form here: the takeoff tick still runs
    // ground friction on the fresh jump vx (engine quirk, see
    // docs/FIGHTING_STANDARDS.md §6) — fit it by measured ratio
    const refDist = (rp.jumpDistFwd / ref.standHeight) * CH;
    if (phys.jumpDist > 0 && Math.abs(phys.jumpDist - refDist) > 2) {
      set('jumpSpeedX', +((def.jumpSpeedX ?? def.walkSpeed) * (refDist / phys.jumpDist)).toFixed(3), 'jump distance (measured)');
    }
    for (const rm of comparableRefs(def, ref)) {
      const slot = slotFor(def, rm);
      const mm = measureMove(defsOf(def), def.id, rm.id, rm.strength ?? 'm');
      const cur = slot.get();
      const tag = `${rm.id}${rm.strength ? `[${rm.strength}]` : ''}`;
      const patch: Partial<VariantPatch> = {};
      if (mm.startup !== null && mm.startup !== rm.startup) patch.startup = Math.max(0, cur.startup + rm.startup - mm.startup);
      if (mm.total !== null && mm.total !== rm.total && patch.startup === undefined) {
        patch.recovery = Math.max(0, cur.recovery + rm.total - mm.total);
      }
      if (rm.kind !== 'throw') {
        if (rm.onHit !== null && mm.onHit !== null && mm.onHit !== rm.onHit) patch.hitstun = Math.max(1, cur.hitstun + rm.onHit - mm.onHit);
        if (rm.onBlock !== null && mm.onBlock !== null && mm.onBlock !== rm.onBlock) patch.blockstun = Math.max(1, cur.blockstun + rm.onBlock - mm.onBlock);
        const refHit = (rm.pushHit / ref.standHeight) * CH;
        if (rm.onHit !== null && mm.pushHit && Math.abs(mm.pushHit - refHit) > 1 && refHit > 0) {
          patch.knockback = +(cur.knockback * (refHit / mm.pushHit)).toFixed(3);
        }
        const refBlk = (rm.pushBlock / ref.standHeight) * CH;
        if (mm.pushBlock && Math.abs(mm.pushBlock - refBlk) > 1 && refBlk > 0) {
          const curBk = (cur as MoveDef).blockKnockback ?? cur.knockback * 0.8;
          (patch as { blockKnockback?: number }).blockKnockback = +(curBk * (refBlk / mm.pushBlock)).toFixed(3);
        }
      }
      if (Object.keys(patch).length) {
        log.push(`pass ${pass + 1} ${tag}: ${Object.entries(patch).map(([kk, v]) => `${kk} ${JSON.stringify((cur as unknown as Record<string, unknown>)[kk])}→${JSON.stringify(v)}`).join(', ')}`);
        slot.patch(patch);
      }
    }
  }
  const after = parityReport(def, ref).score;
  return { def, log, before, after };
}

export function formatParity(p: ParityResult): string {
  const lines: string[] = [];
  const pct = (p.score * 100).toFixed(1);
  lines.push(`PARITY ${p.id}: ${pct}% of comparable metrics within tolerance`);
  lines.push('scope                      metric                   ref      ours     ok');
  for (const r of p.rows) {
    const f = (v: number | null): string => (v === null ? 'n/a' : String(v)).padStart(8);
    lines.push(`${r.scope.padEnd(26)} ${r.metric.padEnd(22)} ${f(r.ref)} ${f(r.ours)}   ${r.ok === null ? '·' : r.ok ? '✓' : `✗ (${r.tol})`}`);
  }
  return lines.join('\n');
}
