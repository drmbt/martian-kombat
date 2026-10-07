// npm run calibrate:apply -- --chars vincent,kirby   apply approved proposals
// npm run calibrate:apply -- --all                    apply every proposal
// npm run calibrate:apply -- --chars rj --feel d8     (default feel d8)
//
// 02-PLAN P13.6: copies the APPROVED calibrated variants from
// src/data/calibration/<feel>/<id>.json over src/data/characters/<id>.json.
// Afterwards: npm run bench -- --update-baseline && npm run bench -- --md,
// then npx vitest run. Only run this with the user's explicit approval.
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROSTER } from '../../src/data/roster';

const args = process.argv.slice(2);
const opt = (n: string): string | undefined => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const feel = opt('feel') ?? 'd8';
const playable = ROSTER.filter((r) => r.playable).map((r) => r.id);
const chars = args.includes('--all') ? playable : (opt('chars')?.split(',').map((s) => s.trim()) ?? []);
if (!chars.length) {
  console.error('usage: npm run calibrate:apply -- --chars a,b | --all [--feel d8|current]');
  process.exit(1);
}
for (const id of chars) {
  const src = join('src/data/calibration', feel, `${id}.json`);
  if (!playable.includes(id) || !existsSync(src)) {
    console.error(`✕ ${id}: no proposal at ${src}`);
    process.exitCode = 1;
    continue;
  }
  copyFileSync(src, join('src/data/characters', `${id}.json`));
  console.log(`✓ ${id} ← ${src}`);
}
console.log('next: npm run bench -- --update-baseline && npm run bench -- --md && npx vitest run');
