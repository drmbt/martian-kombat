// P13.4 — the calibrator. Proposes a tuned variant of every fighter:
//   feel     the chosen global feel profile (D8 or current)            [P13.3]
//   art      hitboxes snapped to the drawn strike where they disagree  [A]
//   bands    out-of-band MKS-1 metrics moved to the nearest band edge  [B]
//   balance  damage/health nudged on the SmartBot matchup matrix       [C]
// with a change budget (a fighter keeps its identity) and hard gates (no new
// MKS-1 error — a stage that adds one is reverted for that fighter). Works on
// RAW JSON (what gets written back on approval); bakes to measure.
import type { MoveDef, Strength, VariantPatch } from '../../engine';
import { measureCharacter } from '../framedata';
import { MOVE_BANDS, CHARACTER_BANDS } from '../standards';
import { auditCharacter } from '../audit';
import { runMatrix, type Matrix } from './matrix';
import { artHitbox } from './art';
import { applyFeel, type FeelProfile } from './feel';
import { bake, cloneRaw, type RawDefs } from './raw';

export type Stage = 'feel' | 'art' | 'bands' | 'balance';

export interface Change {
  char: string;
  stage: Stage;
  move?: string;
  strength?: Strength;
  field: string;
  from: unknown;
  to: unknown;
  why: string;
}

export interface CalibrateOptions {
  feel?: FeelProfile;
  seeds?: number;
  /** balance-loop rounds */
  rounds?: number;
  /** target win-rate window for the balance loop */
  window?: [number, number];
  /** fighters whose hitboxes stay hand-tuned (weapon reach the art method can't read) */
  artSkip?: string[];
  /** world px (unscaled) of reach disagreement before the art box replaces a hitbox */
  artTolerance?: number;
  onLog?: (line: string) => void;
}

export interface CalibrateResult {
  raw: RawDefs;
  changes: Change[];
  before: Matrix;
  after: Matrix;
  rejected: string[];
}

type Key = 'startup' | 'active' | 'recovery' | 'damage' | 'hitstun' | 'blockstun';

function getF(m: MoveDef, s: Strength | undefined, k: Key): number {
  const v = s ? (m.variants?.[s] as VariantPatch | undefined)?.[k] : undefined;
  return (v ?? m[k]) as number;
}
/** set where the value actually comes from: the strength's variant patch if
 *  it overrides the key, else the base move */
function setF(m: MoveDef, s: Strength | undefined, k: Key, v: number): void {
  const patch = s ? (m.variants?.[s] as VariantPatch | undefined) : undefined;
  if (patch && patch[k] !== undefined) patch[k] = v;
  else (m as unknown as Record<Key, number>)[k] = v;
}

const clamp = (v: number, lo = -Infinity, hi = Infinity): number => Math.min(hi, Math.max(lo, v));

export function calibrate(original: RawDefs, ids: string[], opts: CalibrateOptions = {}): CalibrateResult {
  const log = opts.onLog ?? ((): void => undefined);
  const seeds = opts.seeds ?? 2;
  const [lo, hi] = opts.window ?? [0.42, 0.58];
  const artSkip = new Set(opts.artSkip ?? ['catherine']);
  const tol = opts.artTolerance ?? 20;
  const changes: Change[] = [];
  const rejected: string[] = [];
  const errorsOf = (raw: RawDefs, id: string): number =>
    auditCharacter(bake(raw), id, { combos: true }).findings.filter((f) => f.severity === 'error').length;

  log('baseline matrix (original data, current feel)…');
  const before = runMatrix(bake(original), ids, { seeds });
  let raw = cloneRaw(original);

  // ---- feel (global profile)
  if (opts.feel && opts.feel !== 'current') {
    const felt = applyFeel(raw, opts.feel) as RawDefs;
    for (const id of ids) {
      for (const [mid, m] of Object.entries(felt[id].moves)) {
        const o = raw[id].moves[mid];
        for (const k of ['hitstop', 'hitstun', 'blockstun'] as const) {
          if (JSON.stringify(o[k]) !== JSON.stringify(m[k])) changes.push({ char: id, stage: 'feel', move: mid, field: k, from: o[k], to: m[k], why: `feel profile ${opts.feel}` });
        }
      }
      for (const k of ['walkSpeed', 'backSpeed'] as const) {
        if (raw[id][k] !== felt[id][k]) changes.push({ char: id, stage: 'feel', field: k, from: raw[id][k], to: felt[id][k], why: `feel profile ${opts.feel}` });
      }
    }
    raw = cloneRaw(felt);
  }

  // a stage that introduces an MKS-1 error for a fighter is reverted for it
  const gate = (stage: Stage, prev: RawDefs): void => {
    for (const id of ids) {
      if (errorsOf(raw, id) > errorsOf(prev, id)) {
        raw[id] = JSON.parse(JSON.stringify(prev[id]));
        for (let i = changes.length - 1; i >= 0; i--) if (changes[i].char === id && changes[i].stage === stage) changes.splice(i, 1);
        rejected.push(`${id}: ${stage} stage reverted (it introduced an MKS-1 error)`);
        log(`  ✗ ${id}: ${stage} reverted (new MKS-1 error)`);
      }
    }
  };

  // ---- A: hitboxes from the art
  log('stage A: hitboxes from the art…');
  let prev = cloneRaw(raw);
  for (const id of ids) {
    if (artSkip.has(id)) continue;
    const def = raw[id];
    for (const [mid, m] of Object.entries(def.moves)) {
      if (!m.hitbox || m.grab || m.projectile || (m as { comment?: string }).comment) continue;
      const art = artHitbox(id, mid, def.hurtStand.h);
      if (!art) continue;
      const cur = m.hitbox.x + m.hitbox.w;
      const prop = art.box.x + art.box.w;
      if (Math.abs(prop - cur) <= tol) continue;
      changes.push({ char: id, stage: 'art', move: mid, field: 'hitbox', from: m.hitbox, to: art.box, why: `drawn reach ${prop} px vs box ${cur} px (${art.cell})` });
      m.hitbox = art.box;
    }
  }
  gate('art', prev);

  // ---- B: bands (two passes: shared base fields can move several strengths)
  log('stage B: MKS-1 bands…');
  prev = cloneRaw(raw);
  for (let pass = 0; pass < 2; pass++) {
    const baked = bake(raw);
    for (const id of ids) {
      const def = raw[id];
      const meas = measureCharacter(baked, id);
      const H = baked[id].health;
      for (const mm of meas.moves) {
        const band = MOVE_BANDS[mm.cls];
        const m = def.moves[mm.id];
        if (!band || !m) continue;
        const s = mm.strength;
        const edit = (k: Key, to: number, why: string): void => {
          const from = getF(m, s, k);
          if (from === to) return;
          setF(m, s, k, to);
          changes.push({ char: id, stage: 'bands', move: mm.id, strength: s, field: k, from, to, why });
        };
        if (band.startup && mm.startup !== null) {
          const t = clamp(mm.startup, band.startup.min, band.startup.max);
          if (t !== mm.startup) edit('startup', Math.max(1, getF(m, s, 'startup') + t - mm.startup), `startup ${mm.startup}f → ${t}f (${mm.cls} band)`);
        }
        if (band.onBlock && mm.onBlock !== null) {
          const t = clamp(mm.onBlock, band.onBlock.min, band.onBlock.max);
          if (t !== mm.onBlock) edit('blockstun', Math.max(0, getF(m, s, 'blockstun') + t - mm.onBlock), `on block ${mm.onBlock} → ${t} (${mm.cls} band)`);
        }
        if (band.onHit && mm.onHit !== null && !mm.knockdown) {
          const t = clamp(mm.onHit, band.onHit.min, band.onHit.max);
          if (t !== mm.onHit) edit('hitstun', Math.max(1, getF(m, s, 'hitstun') + t - mm.onHit), `on hit ${mm.onHit} → ${t} (${mm.cls} band)`);
        }
        if (band.damagePct && mm.damage > 0) {
          const pct = (mm.damage / H) * 100;
          const t = clamp(pct, band.damagePct.min, band.damagePct.max);
          if (Math.abs(t - pct) > 0.05) edit('damage', Math.max(1, Math.round((getF(m, s, 'damage') * t) / pct)), `damage ${pct.toFixed(1)}% → ${t.toFixed(1)}% HP (${mm.cls} band)`);
        }
        if (band.total && mm.total !== null) {
          const t = clamp(mm.total, band.total.min, band.total.max);
          if (t !== mm.total) edit('recovery', Math.max(1, getF(m, s, 'recovery') + t - mm.total), `total ${mm.total}f → ${t}f (${mm.cls} band)`);
        }
      }
      // character bands: walk speed (CH/s), back-walk ratio, health
      const ch = meas.height;
      const wf = (meas.physics.walkFwd * 60) / ch;
      const wb = CHARACTER_BANDS.walkFwd;
      if (wf < (wb.min ?? 0) || wf > (wb.max ?? 99)) {
        const to = Math.round(((clamp(wf, wb.min, wb.max) * ch) / 60) * 100) / 100;
        changes.push({ char: id, stage: 'bands', field: 'walkSpeed', from: def.walkSpeed, to, why: `walk ${wf.toFixed(2)} → ${clamp(wf, wb.min, wb.max).toFixed(2)} CH/s` });
        def.walkSpeed = to;
      }
      const ratio = meas.physics.walkBack / Math.max(0.01, meas.physics.walkFwd);
      const rb = CHARACTER_BANDS.walkBackRatio;
      if (ratio < (rb.min ?? 0) || ratio > (rb.max ?? 99)) {
        const to = Math.round(def.walkSpeed * clamp(ratio, rb.min, rb.max) * 100) / 100;
        changes.push({ char: id, stage: 'bands', field: 'backSpeed', from: def.backSpeed, to, why: `back-walk ratio ${ratio.toFixed(2)} → ${clamp(ratio, rb.min, rb.max).toFixed(2)}` });
        def.backSpeed = to;
      }
      const hb = CHARACTER_BANDS.health;
      const hp = clamp(def.health, hb.min, hb.max);
      if (hp !== def.health) {
        changes.push({ char: id, stage: 'bands', field: 'health', from: def.health, to: hp, why: 'health band' });
        def.health = hp;
      }
    }
  }
  gate('bands', prev);

  // ---- C: balance loop on the matrix
  const rounds = opts.rounds ?? 5;
  const mult: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 1]));
  /** reach lever (big outliers only): horizontal hitbox extent, budget 0.85–1.15 */
  const reach: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 1]));
  let after = before;
  for (let r = 0; r < rounds; r++) {
    log(`stage C: balance round ${r + 1}/${rounds} (matrix)…`);
    after = runMatrix(bake(raw), ids, { seeds });
    const off = ids.filter((id) => after.fighters[id].winRate < lo || after.fighters[id].winRate > hi);
    log(`  win-rate spread ${Math.round(100 * Math.min(...ids.map((i) => after.fighters[i].winRate)))}–${Math.round(100 * Math.max(...ids.map((i) => after.fighters[i].winRate)))}% · ${off.length} outside ${Math.round(lo * 100)}–${Math.round(hi * 100)}%`);
    if (!off.length) break;
    prev = cloneRaw(raw);
    for (const id of off) {
      const wr = after.fighters[id].winRate;
      // proportional step, capped at 8% per round; cumulative budget 0.75–1.30
      const step = clamp((0.5 - wr) * 0.3, -0.08, 0.08);
      const next = clamp(mult[id] * (1 + step), 0.75, 1.3);
      const f = next / mult[id];
      mult[id] = next;
      const def = raw[id];
      for (const [mid, m] of Object.entries(def.moves)) {
        const scaleDmg = (from: number, s?: Strength): void => {
          const to = Math.max(1, Math.round(from * f));
          if (to === from) return;
          changes.push({ char: id, stage: 'balance', move: mid, strength: s, field: 'damage', from, to, why: `win rate ${Math.round(wr * 100)}% → damage ×${f.toFixed(3)}` });
          if (s) (m.variants![s] as VariantPatch).damage = to;
          else m.damage = to;
        };
        if (m.damage > 0) scaleDmg(m.damage);
        for (const s of ['l', 'm', 'h'] as const) {
          const v = m.variants?.[s] as VariantPatch | undefined;
          if (v?.damage !== undefined && v.damage > 0) scaleDmg(v.damage, s);
        }
      }
      // far from even (or damage budget spent): also scale forward reach
      const farOff = Math.abs(wr - 0.5) > 0.15 || Math.abs(f - 1) < 0.01;
      const nextReach = farOff ? clamp(reach[id] * (1 + Math.sign(0.5 - wr) * 0.03), 0.85, 1.15) : reach[id];
      const rf = nextReach / reach[id];
      if (Math.abs(rf - 1) > 0.001) {
        reach[id] = nextReach;
        const scaleBoxReach = (b: { x: number; w: number }): { x: number; w: number } => {
          const far = b.x + b.w;
          return { ...b, w: Math.max(8, Math.round(far * rf - b.x)) };
        };
        for (const [mid, m] of Object.entries(def.moves)) {
          if (!m.hitbox || m.grab || m.hitbox.x + m.hitbox.w <= 0) continue;
          const to = { ...m.hitbox, ...scaleBoxReach(m.hitbox) };
          changes.push({ char: id, stage: 'balance', move: mid, field: 'hitbox', from: m.hitbox, to, why: `win rate ${Math.round(wr * 100)}% → reach ×${rf.toFixed(3)}` });
          m.hitbox = to;
        }
      }
      const hp = clamp(Math.round(def.health * (1 + (f - 1) * 0.5)), CHARACTER_BANDS.health.min, CHARACTER_BANDS.health.max);
      if (hp !== def.health) {
        changes.push({ char: id, stage: 'balance', field: 'health', from: def.health, to: hp, why: `win rate ${Math.round(wr * 100)}%` });
        def.health = hp;
      }
    }
    gate('balance', prev);
  }
  log('final matrix…');
  after = runMatrix(bake(raw), ids, { seeds });
  return { raw, changes, before, after, rejected };
}
