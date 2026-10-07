// npm run lab                          full matchup matrix (SmartBot vs SmartBot, every pair, both slots)
// npm run lab -- --seeds 4             more seeds per pair (default 2)
// npm run lab -- --chars vincent,yulia only those fighters' rows (columns = whole roster)
// npm run lab -- --reaction 8          bot reaction ticks (default 10); --mistake 0.1
//
// The calibration lab (02-PLAN P13.1). Writes assets/raw/lab/<stamp>/matrix.json
// + report.md (gitignored) and prints the ladder. Deterministic: the same
// data + options reproduce the same matrix.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { characters } from '../../src/data/characters';
import { ROSTER } from '../../src/data/roster';
import { matrixMarkdown, runMatrix } from '../../src/bench/lab/matrix';

const args = process.argv.slice(2);
const opt = (n: string): string | undefined => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const ids = ROSTER.filter((r) => r.playable).map((r) => r.id);
const rows = opt('chars')?.split(',').map((s) => s.trim());
const seeds = Number(opt('seeds') ?? 2);
const bot = { reaction: Number(opt('reaction') ?? 10), mistake: Number(opt('mistake') ?? 0.1) };

const m = runMatrix(characters, ids, {
  seeds,
  bot,
  rows,
  onProgress: (d, t) => process.stdout.write(`\r  ${d}/${t} pairs`),
});
process.stdout.write('\n');
const md = matrixMarkdown(m);
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = join('assets/raw/lab', stamp);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'matrix.json'), JSON.stringify(m, null, 2));
writeFileSync(join(dir, 'report.md'), md);
console.log(md.split('## Grid')[0]);
console.log(`→ ${dir}/report.md`);
