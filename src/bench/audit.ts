// MKS-1 audit: measure a character and grade it against src/bench/standards.ts.
// Findings are keyed `char:move[strength]:rule` so the CI ratchet
// (balance.audit.test.ts + baseline.json) can tell new breakage from known debt.
import type { Defs } from '../engine';
import { chainCycles, findCombos, routeText, verifyLoop, type ComboRoute, type LoopVerdict } from './combos';
import { measureCharacter, type CharacterMeasure, type MoveMeasure } from './framedata';
import { touchGap } from './sim';
import { CHARACTER_BANDS, MOVE_BANDS, type Band, type ErrorRule, type MoveMetric } from './standards';
import { chPerSec, ch } from './units';

export interface Finding {
  key: string;
  severity: 'error' | 'warn';
  char: string;
  move?: string;
  rule: string;
  message: string;
}

export interface AuditResult {
  measure: CharacterMeasure;
  bnb: ComboRoute | null;
  loops: LoopVerdict[];
  findings: Finding[];
}

/** the button-slot ids the engine fires without an `input` (pickAttack /
 *  pickAirAttack): stand, crouch (c-) and air (j-) × lp mp hp lk mk hk */
const NORMAL_SLOTS = /^[cj]?[lmh][pk]$/;

const fmt = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(2));
const tag = (m: MoveMeasure): string => `${m.id}${m.strength ? `[${m.strength}]` : ''}`;

function outside(v: number, b: Band): string | null {
  if (b.min !== undefined && v < b.min) return `${fmt(v)}${b.unit} < ${b.min}`;
  if (b.max !== undefined && v > b.max) return `${fmt(v)}${b.unit} > ${b.max}`;
  return null;
}

export function auditCharacter(
  defs: Defs,
  charId: string,
  /** `opponents`: ids whose push boxes a throw must reach past (default: mirror only) */
  opts: { combos?: boolean; opponents?: string[] } = {},
): AuditResult {
  const def = defs[charId];
  const measure = measureCharacter(defs, charId);
  const findings: Finding[] = [];
  const add = (severity: Finding['severity'], rule: string, message: string, move?: string): void => {
    findings.push({ key: `${charId}:${move ?? '*'}:${rule}`, severity, char: charId, move, rule, message });
  };
  const err = (rule: ErrorRule, message: string, move?: string): void => add('error', rule, message, move);

  const gap = touchGap(def, def);
  for (const m of measure.moves) {
    const t = tag(m);
    const raw = def.moves[m.id];
    if (!raw.input && !NORMAL_SLOTS.test(m.id)) {
      err('unreachable', `no \`input\` and '${m.id}' is not a normal slot — it can never be performed`, t);
      continue;
    }
    if (m.cls === 'utility') continue;
    if (!m.connects && m.total !== null) {
      if (m.cls === 'throw' && raw.grab) {
        const range = raw.variants?.[m.strength ?? 'm']?.grab?.range ?? raw.grab.range;
        if (range <= gap) err('throw-out-of-range', `grab range ${range}px ≤ push-box separation ${gap}px (mirror)`, t);
        else err('never-connects', 'throw never connects vs a standing mirror', t);
      } else {
        err('never-connects', `${m.cls} never connects vs a standing mirror (hitbox reach ${fmt(m.reach)}px, bodies touch at ${gap}px)`, t);
      }
    }
    // a fused projectile carries its damage in the detonation (Fork Bomb)
    const proj = raw.projectile;
    const dmg = m.cls === 'projectile' ? Math.max(proj?.damage ?? 0, proj?.detonate?.damage ?? 0) : m.damage;
    if (dmg <= 0 && (m.cls !== 'projectile' || !raw.projectile?.field)) err('zero-damage', `${m.cls} deals 0 damage`, t);
    if (dmg > def.health * 0.25) err('overkill-hit', `one hit = ${fmt((dmg / def.health) * 100)}% HP`, t);
    if (m.cls === 'reversal' && m.onBlock !== null && m.onBlock >= -2) {
      err('safe-reversal', `invulnerable reversal is ${m.onBlock} on block`, t);
    }
    const bands = MOVE_BANDS[m.cls];
    if (!bands) continue;
    const values: Record<MoveMetric, number | null> = {
      startup: m.startup,
      onBlock: m.onBlock,
      onHit: m.knockdown ? null : m.onHit,
      damagePct: m.connects ? (dmg / def.health) * 100 : null,
      total: m.total,
    };
    for (const [metric, band] of Object.entries(bands) as [MoveMetric, Band][]) {
      const v = values[metric];
      if (v === null || v === undefined) continue;
      // chain/cancel normals legitimately trade block frames for pressure
      if (metric === 'onBlock' && (raw.cancel || raw.chains?.length) && m.cls !== 'light') continue;
      const o = outside(v, band);
      if (o) add('warn', `band:${metric}`, `${m.cls} ${metric} ${o} (${band.source})`, t);
    }
  }

  // ---- throw reach across matchups: bodies stop at front + front, so a
  // grab shorter than that can never reach THAT opponent ----
  for (const [id, raw] of Object.entries(def.moves)) {
    if (!raw.grab) continue;
    const strengths = raw.input?.button === 'LPLK' ? ['l'] : ['l', 'm', 'h'];
    for (const st of strengths) {
      const range = raw.variants?.[st as 'l' | 'm' | 'h']?.grab?.range ?? raw.grab.range;
      const t = raw.input?.button === 'LPLK' || strengths.length === 1 ? id : `${id}[${st}]`;
      if (range <= gap) continue; // mirror already flagged above
      const short = (opts.opponents ?? [])
        .filter((o) => o !== charId && defs[o])
        .map((o) => ({ o, sep: touchGap(def, defs[o]) }))
        .filter((x) => range <= x.sep);
      if (short.length) {
        err('throw-out-of-range', `grab range ${range}px can't reach ${short.map((x) => `${x.o} (${x.sep}px)`).join(', ')}`, t);
      }
    }
  }

  // ---- character-level bands ----
  const H = measure.height;
  const p = measure.physics;
  const charVals: Record<string, number> = {
    health: def.health,
    walkFwd: chPerSec(p.walkFwd, H),
    walkBackRatio: p.walkBack / p.walkFwd,
    prejump: p.prejump,
    airtime: p.airtime,
    apex: ch(p.apex, H),
    jumpDist: ch(p.jumpDist, H),
    fastestNormal: Math.min(...measure.moves.filter((m) => ['light', 'medium', 'heavy'].includes(m.cls) && m.connects && m.startup !== null).map((m) => m.startup as number)),
  };
  // infinites: every short cycle in the chain/link graph, verified by sim
  // (cheap — always on); the best-combo search is the slow part (opt-out)
  let bnb: ComboRoute | null = null;
  const loops: LoopVerdict[] = [];
  const seen = new Set<string>();
  for (const l of chainCycles(defs, charId, measure.moves)) {
    const v = verifyLoop(defs, charId, l);
    if (seen.has(v.cycle)) continue;
    seen.add(v.cycle);
    loops.push(v);
    if (v.infinite) err('infinite', `[${v.cycle}] still combos at 16 moves (midscreen ${v.midscreen}, corner ${v.corner}) — e.g. ${routeText(l)}`, v.cycle.replace(/ > /g, '>'));
  }
  if (opts.combos !== false) {
    bnb = findCombos(defs, charId, 4, measure.moves).best;
    if (bnb) charVals.bnb = bnb.pct;
  }
  for (const [k, band] of Object.entries(CHARACTER_BANDS)) {
    const v = charVals[k];
    if (v === undefined || !Number.isFinite(v)) continue;
    const o = outside(v, band);
    if (o) add('warn', `band:${k}`, `${band.metric} ${o} (${band.source})`);
  }
  return { measure, bnb, loops, findings };
}
