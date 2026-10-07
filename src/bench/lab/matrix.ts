// Calibration lab (P13.1): the matchup matrix. Every pair of fighters plays
// `seeds` matches in BOTH slot orders with the competent SmartBot on both
// sides, so slot and seed luck cancel. Deterministic: same defs + seeds =>
// same matrix.
import type { Defs } from '../../engine';
import { SmartBot, type SmartOptions } from '../../ai/smart';
import { runMatch, type MatchResult } from './match';

export interface Cell {
  /** matches played by the row fighter against the column fighter */
  games: number;
  wins: number;
  losses: number;
  draws: number;
  damageFor: number;
  damageAgainst: number;
}

export interface FighterSummary {
  id: string;
  games: number;
  winRate: number;
  /** average damage dealt / taken per match */
  dealt: number;
  taken: number;
  /** per-move usage & connect rate across all its matches */
  moves: Record<string, { used: number; hit: number; blocked: number }>;
  /** worst / best matchup win rates (excludes the mirror) */
  worst: { vs: string; winRate: number } | null;
  best: { vs: string; winRate: number } | null;
}

export interface Matrix {
  ids: string[];
  seeds: number;
  bot: SmartOptions;
  cells: Record<string, Record<string, Cell>>;
  fighters: Record<string, FighterSummary>;
  ticks: number;
  ms: number;
}

const blank = (): Cell => ({ games: 0, wins: 0, losses: 0, draws: 0, damageFor: 0, damageAgainst: 0 });

export interface MatrixOptions {
  seeds?: number;
  bot?: Omit<SmartOptions, 'seed'>;
  /** only run rows for these fighters (columns stay the full list) */
  rows?: string[];
  onProgress?: (done: number, total: number) => void;
}

export function runMatrix(defs: Defs, ids: string[], opts: MatrixOptions = {}): Matrix {
  const seeds = opts.seeds ?? 2;
  const bot = opts.bot ?? {};
  const rows = opts.rows ?? ids;
  const cells: Matrix['cells'] = {};
  const moves: Record<string, FighterSummary['moves']> = {};
  for (const a of ids) {
    cells[a] = {};
    moves[a] = {};
    for (const b of ids) cells[a][b] = blank();
  }
  const pairs: [string, string][] = [];
  for (const a of ids) for (const b of ids) if (rows.includes(a) || rows.includes(b)) pairs.push([a, b]);
  const t0 = performance.now();
  let ticks = 0;
  let done = 0;
  const total = pairs.filter(([p1, p2]) => p1 <= p2).length;
  const record = (r: MatchResult, p1: string, p2: string): void => {
    ticks += r.ticks;
    for (const [slot, me, them] of [[0, p1, p2], [1, p2, p1]] as const) {
      const c = cells[me][them];
      c.games++;
      if (r.winner === slot) c.wins++;
      else if (r.winner === null) c.draws++;
      else c.losses++;
      c.damageFor += r.sides[slot].damageDealt;
      c.damageAgainst += r.sides[slot === 0 ? 1 : 0].damageDealt;
      for (const [id, m] of Object.entries(r.sides[slot].moves)) {
        const acc = (moves[me][id] ??= { used: 0, hit: 0, blocked: 0 });
        acc.used += m.used;
        acc.hit += m.hit;
        acc.blocked += m.blocked;
      }
    }
  };
  for (const [p1, p2] of pairs) {
    if (p1 > p2) continue; // each unordered pair once; both slot orders below
    for (let k = 0; k < seeds; k++) {
      const seed = 1 + k;
      // both slot orders, seeds swapped across slots so seed luck cancels
      record(runMatch(defs, p1, p2, [new SmartBot(0, defs, { ...bot, seed }), new SmartBot(1, defs, { ...bot, seed: seed + 1000 })]), p1, p2);
      if (p1 !== p2) record(runMatch(defs, p2, p1, [new SmartBot(0, defs, { ...bot, seed: seed + 1000 }), new SmartBot(1, defs, { ...bot, seed })]), p2, p1);
    }
    opts.onProgress?.(++done, total);
  }
  const fighters: Matrix['fighters'] = {};
  for (const a of ids) {
    let games = 0, wins = 0, dealt = 0, taken = 0;
    let worst: FighterSummary['worst'] = null;
    let best: FighterSummary['best'] = null;
    for (const b of ids) {
      const c = cells[a][b];
      games += c.games;
      wins += c.wins + c.draws / 2;
      dealt += c.damageFor;
      taken += c.damageAgainst;
      if (b === a || !c.games) continue;
      const wr = (c.wins + c.draws / 2) / c.games;
      if (!worst || wr < worst.winRate) worst = { vs: b, winRate: wr };
      if (!best || wr > best.winRate) best = { vs: b, winRate: wr };
    }
    fighters[a] = { id: a, games, winRate: games ? wins / games : 0, dealt: games ? dealt / games : 0, taken: games ? taken / games : 0, moves: moves[a], worst, best };
  }
  return { ids, seeds, bot, cells, fighters, ticks, ms: Math.round(performance.now() - t0) };
}

/** a Markdown report: the overall ladder + the full matchup grid */
export function matrixMarkdown(m: Matrix, title = 'Matchup matrix'): string {
  const pct = (x: number): string => `${Math.round(x * 100)}`;
  const ladder = [...m.ids].sort((a, b) => m.fighters[b].winRate - m.fighters[a].winRate);
  const out = [
    `# ${title}`,
    '',
    `SmartBot vs SmartBot · ${m.seeds} seed(s) × both slots per pair · ${m.ticks.toLocaleString()} ticks in ${(m.ms / 1000).toFixed(1)} s.`,
    '',
    '## Ladder',
    '',
    '| # | Fighter | Win % | Dmg dealt / taken per match | Worst matchup | Best matchup |',
    '|--:|---|--:|--:|---|---|',
    ...ladder.map((id, i) => {
      const f = m.fighters[id];
      return `| ${i + 1} | ${id} | ${pct(f.winRate)} | ${Math.round(f.dealt)} / ${Math.round(f.taken)} | ${f.worst ? `${f.worst.vs} ${pct(f.worst.winRate)}` : '—'} | ${f.best ? `${f.best.vs} ${pct(f.best.winRate)}` : '—'} |`;
    }),
    '',
    '## Grid (row fighter\'s win % vs column)',
    '',
    `| | ${ladder.map((id) => id.slice(0, 4)).join(' | ')} |`,
    `|---|${ladder.map(() => '--:').join('|')}|`,
    ...ladder.map((a) => `| **${a}** | ${ladder.map((b) => {
      const c = m.cells[a][b];
      return c.games ? pct((c.wins + c.draws / 2) / c.games) : '';
    }).join(' | ')} |`),
    '',
  ];
  return out.join('\n');
}
