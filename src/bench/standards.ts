// MKS-1 — the Martian Kombat fighting standard, v1 (2026-10-04).
//
// Every number here is a band on ENGINE-MEASURED frame data (framedata.ts,
// SF convention) — never on raw JSON fields. Bands come from three sources,
// cited per band so a future tune can argue with the right one:
//   genre  — long-standing Street Fighter-series conventions (SuperCombo-style
//            frame data norms: 3–5f jabs, lights roughly even on block,
//            DPs very unsafe, BnBs ~15–30%)
//   kfm    — Kung Fu Man, MUGEN/IKEMEN GO's reference character, measured by
//            this bench through the port in src/bench/reference/
//   roster — our own measured distribution (house style) at adoption time
// Severity: 'error' rules are objectively broken (ratcheted in CI by
// balance.audit.test.ts); 'warn' bands are design smells the bench reports.
// Rationale + the full comparison: docs/FIGHTING_STANDARDS.md.
import type { MoveClass } from './framedata';

export interface Band {
  min?: number;
  max?: number;
  unit: string;
  source: string;
}

export type MoveMetric = 'startup' | 'onBlock' | 'onHit' | 'damagePct' | 'total';

export const MOVE_BANDS: Partial<Record<MoveClass, Partial<Record<MoveMetric, Band>>>> = {
  light: {
    startup: { min: 3, max: 6, unit: 'f', source: 'genre 3–5f jabs; kfm 4–5; roster median 6' },
    onBlock: { min: -4, max: 2, unit: 'f', source: 'genre −2..+2; kfm −4' },
    onHit: { min: 0, max: 6, unit: 'f', source: 'genre +3..+6 (links); kfm +2' },
    damagePct: { min: 2, max: 5, unit: '%HP', source: 'genre ~3%; kfm 2.3–2.8%' },
  },
  medium: {
    startup: { min: 5, max: 10, unit: 'f', source: 'genre 5–8f; kfm 5–10' },
    onBlock: { min: -6, max: 2, unit: 'f', source: 'genre −4..+1; kfm −3..−11' },
    onHit: { min: 0, max: 7, unit: 'f', source: 'genre +2..+6; kfm −1..+1' },
    damagePct: { min: 4.5, max: 8, unit: '%HP', source: 'genre ~6%; kfm 3.7–7.2%' },
  },
  heavy: {
    startup: { min: 7, max: 15, unit: 'f', source: 'genre 8–14f' },
    onBlock: { min: -10, max: 0, unit: 'f', source: 'genre −2..−8 (sweeps −10..−15)' },
    onHit: { min: -2, max: 7, unit: 'f', source: 'genre 0..+6' },
    damagePct: { min: 6.5, max: 12, unit: '%HP', source: 'genre 8–9%' },
  },
  air: {
    startup: { min: 4, max: 12, unit: 'f', source: 'genre 4–10f; kfm 4–7' },
    damagePct: { min: 2, max: 10, unit: '%HP', source: 'kfm 2–7.2%; roster ≤10%' },
  },
  special: {
    startup: { min: 5, max: 20, unit: 'f', source: 'genre; kfm 9–18' },
    onBlock: { min: -16, unit: 'f', source: 'genre: most specials −2..−12; kfm −1..−17' },
    damagePct: { min: 5, max: 14, unit: '%HP', source: 'genre 8–14%; kfm 5.2–12.5%' },
  },
  reversal: {
    startup: { min: 3, max: 8, unit: 'f', source: 'genre DP 3–5f; kfm upper 4–5' },
    onBlock: { max: -10, unit: 'f', source: 'genre: a blocked reversal must be punishable' },
    damagePct: { min: 7, max: 14, unit: '%HP', source: 'genre 10–14%' },
  },
  projectile: {
    startup: { min: 9, max: 22, unit: 'f', source: 'genre 10–16f fireballs' },
    total: { min: 30, max: 55, unit: 'f', source: 'genre ~40–50f: zoning must cost recovery' },
    onBlock: { min: -10, max: 6, unit: 'f', source: 'genre point-blank fireballs ~−4..+2' },
    damagePct: { min: 3, max: 10, unit: '%HP', source: 'genre 5–8%' },
  },
  throw: {
    startup: { min: 2, max: 8, unit: 'f', source: 'genre 5f; kfm 1' },
    damagePct: { min: 7, max: 15, unit: '%HP', source: 'genre 12%; kfm 7.8%' },
  },
};

export interface CharBand extends Band {
  metric: string;
}

export const CHARACTER_BANDS: Record<string, CharBand> = {
  health: { metric: 'max health', min: 900, max: 1150, unit: 'HP', source: 'MUGEN life=1000 default; roster 950–1120' },
  walkFwd: { metric: 'walk forward', min: 0.8, max: 1.8, unit: 'CH/s', source: 'kfm 1.55; roster median 1.0' },
  walkBackRatio: { metric: 'walk back ÷ forward', min: 0.6, max: 1.0, unit: '×', source: 'genre: back-walk slower; kfm 0.92' },
  prejump: { metric: 'prejump', min: 2, max: 6, unit: 'f', source: 'genre 3–4f; kfm 3' },
  airtime: { metric: 'jump airtime', min: 34, max: 50, unit: 'f', source: 'genre ~40f; kfm 37' },
  apex: { metric: 'jump apex', min: 0.6, max: 1.0, unit: 'CH', source: 'kfm 0.86; roster ~0.8' },
  jumpDist: { metric: 'forward jump distance', min: 0.7, max: 1.4, unit: 'CH', source: 'kfm 1.03; roster ~1.0' },
  fastestNormal: { metric: 'fastest ground normal', max: 6, unit: 'f', source: 'genre: every kit needs a ≤5f "get off me" button' },
  bnb: { metric: 'best meterless combo', min: 12, max: 35, unit: '%HP', source: 'genre 15–30%; kfm 18.5%' },
};

/** Hard rules ('error'): objectively broken, ratcheted by the CI audit. */
export const ERROR_RULES = {
  'unreachable': 'a move with no `input` that is not a normal slot (lp…chk, jlp…jhk) — nothing can ever perform it',
  'never-connects': 'strike / throw / projectile never connects vs a standing mirror at any range',
  'throw-out-of-range': 'grab range ≤ push-box separation — the throw can never reach',
  'zero-damage': 'a strike or throw that deals 0 damage',
  'overkill-hit': 'a single hit deals > 25% of max health',
  'safe-reversal': 'invulnerable reversal is ≥ −2 on block (unpunishable)',
  'infinite': 'a repeating chain still combos at 16 moves (midscreen or corner)',
} as const;

export type ErrorRule = keyof typeof ERROR_RULES;
