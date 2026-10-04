// npm run bench                      roster MKS-1 audit summary + roster-vs-reference medians
// npm run bench -- --char vincent    one fighter: measured frame-data table + findings
// npm run bench -- --md              regenerate docs/FRAME_DATA.md (measured, every fighter)
// npm run bench -- --parity kfm      parity scorecard: a ported reference in OUR engine vs its source
// npm run bench -- --update-baseline rewrite src/bench/baseline.json (the CI ratchet) from current errors
//
// Everything is measured by running the deterministic engine (src/bench/);
// see docs/FIGHTING_STANDARDS.md for conventions, units (CH, f, %HP) and bands.
import { writeFileSync } from 'node:fs';
import { characters } from '../../src/data/characters';
import { ROSTER } from '../../src/data/roster';
import { REFERENCES } from '../../src/bench/reference';
import { auditCharacter, type AuditResult } from '../../src/bench/audit';
import { routeText } from '../../src/bench/combos';
import { formatParity, parityReport } from '../../src/bench/parity';
import { median, chPerSec, ch } from '../../src/bench/units';
import type { Defs } from '../../src/engine';

const args = process.argv.slice(2);
const opt = (n: string): string | undefined => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (n: string): boolean => args.includes(`--${n}`);

const defs: Defs = { ...characters };
for (const [id, r] of Object.entries(REFERENCES)) defs[id] = r.def;
const roster = ROSTER.filter((r) => r.playable).map((r) => r.id);

const f = (v: number | null | undefined, d = 0): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : (v > 0 && d === 0 ? `+${v}` : v.toFixed(d));
const plain = (v: number | null | undefined, d = 0): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(d);

function moveTable(a: AuditResult): string[] {
  const rows = ['| Move | Class | Startup | Active | Recovery | Total | On hit | On block | Dmg | Hitstop | Push hit/blk (CH) |', '|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|'];
  const H = a.measure.height;
  for (const m of a.measure.moves) {
    const name = `${m.name === m.id ? m.id : `${m.name} (${m.id})`}${m.strength ? ` ${m.strength.toUpperCase()}` : ''}`;
    const push = `${m.pushHit === null ? '—' : ch(m.pushHit, H).toFixed(2)} / ${m.pushBlock === null ? '—' : ch(m.pushBlock, H).toFixed(2)}`;
    rows.push(
      `| ${name}${m.connects || m.cls === 'utility' ? '' : ' ⚠'} | ${m.cls} | ${plain(m.startup)} | ${m.active} | ${plain(m.recovery)} | ${plain(m.total)} | ${m.knockdown ? 'KD' : f(m.onHit)} | ${f(m.onBlock)} | ${m.damage} | ${m.hitstop ? m.hitstop[1] : '—'} | ${push} |`,
    );
  }
  return rows;
}

function summaryRow(a: AuditResult): string {
  const p = a.measure.physics;
  const H = a.measure.height;
  const fastest = Math.min(...a.measure.moves.filter((m) => ['light', 'medium', 'heavy'].includes(m.cls) && m.connects && m.startup !== null).map((m) => m.startup as number));
  const worst = [...a.loops].sort((x, y) => Math.max(y.midscreen, y.corner) - Math.max(x.midscreen, x.corner))[0];
  const errs = a.findings.filter((x) => x.severity === 'error').length;
  const warns = a.findings.filter((x) => x.severity === 'warn').length;
  return `| ${a.measure.id} | ${a.measure.health} | ${chPerSec(p.walkFwd, H).toFixed(2)} | ${p.airtime} | ${ch(p.jumpDist, H).toFixed(2)} | ${fastest} | ${a.bnb ? `${a.bnb.pct.toFixed(1)}%` : '—'} | ${worst ? `${Math.max(worst.midscreen, worst.corner)}${worst.infinite ? ' ∞' : ''}` : '—'} | ${errs} | ${warns} |`;
}

const SUMMARY_HEAD = [
  '| Fighter | HP | Walk (CH/s) | Jump air (f) | Jump dist (CH) | Fastest normal (f) | Best combo | Longest chain loop | Errors | Warnings |',
  '|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|',
];

function classMedians(results: AuditResult[]): Map<string, Record<string, number>> {
  const by = new Map<string, Record<string, number[]>>();
  for (const a of results) {
    for (const m of a.measure.moves) {
      const b = by.get(m.cls) ?? {};
      const push = (k: string, v: number | null): void => {
        if (v !== null && Number.isFinite(v)) (b[k] ??= []).push(v);
      };
      push('startup', m.startup);
      push('onHit', m.knockdown ? null : m.onHit);
      push('onBlock', m.onBlock);
      push('hitstop', m.hitstop?.[1] ?? null);
      push('dmg', m.connects ? (m.damage / a.measure.health) * 100 : null);
      by.set(m.cls, b);
    }
  }
  const out = new Map<string, Record<string, number>>();
  for (const [k, v] of by) out.set(k, Object.fromEntries(Object.entries(v).map(([kk, xs]) => [kk, median(xs)])));
  return out;
}

function compareTable(ours: AuditResult[], ref: AuditResult): string[] {
  const a = classMedians(ours);
  const b = classMedians([ref]);
  const rows = [
    `| Class | Startup ours / ${ref.measure.id} | On hit | On block | Hitstop | Damage %HP |`,
    '|---|--:|--:|--:|--:|--:|',
  ];
  for (const cls of ['light', 'medium', 'heavy', 'air', 'special', 'reversal', 'projectile', 'throw']) {
    const x = a.get(cls);
    if (!x) continue;
    const y = b.get(cls) ?? {};
    const pair = (k: string, d = 0): string => `${plain(x[k], d)} / ${plain(y[k], d)}`;
    rows.push(`| ${cls} | ${pair('startup')} | ${pair('onHit')} | ${pair('onBlock')} | ${pair('hitstop')} | ${pair('dmg', 1)} |`);
  }
  return rows;
}

// ---------------------------------------------------------------------------
if (opt('parity')) {
  const id = opt('parity')!;
  const r = REFERENCES[id];
  if (!r) {
    console.error(`no reference '${id}' (have: ${Object.keys(REFERENCES).join(', ')})`);
    process.exit(1);
  }
  console.log(formatParity(parityReport(r.def, r.ref)));
  process.exit(0);
}

if (opt('char')) {
  const id = opt('char')!;
  if (!defs[id]) {
    console.error(`unknown character '${id}'`);
    process.exit(1);
  }
  const a = auditCharacter(defs, id, { opponents: roster });
  console.log(`\n${a.measure.name} — measured frame data (SF convention; ⚠ = never connects)\n`);
  console.log(moveTable(a).join('\n'));
  console.log(`\n${SUMMARY_HEAD.join('\n')}\n${summaryRow(a)}`);
  if (a.bnb) console.log(`\nbest meterless combo: ${a.bnb.pct.toFixed(1)}% (${a.bnb.hits} hits) — ${routeText(a.bnb)}`);
  for (const l of a.loops) console.log(`chain loop [${l.cycle}]: midscreen ${l.midscreen}, corner ${l.corner}${l.infinite ? '  ← INFINITE' : ''}`);
  console.log('\nfindings:');
  for (const x of a.findings) console.log(`  ${x.severity === 'error' ? '✗' : '~'} ${x.move ?? '*'} ${x.rule}: ${x.message}`);
  process.exit(0);
}

const t0 = Date.now();
const results = roster.map((id) => auditCharacter(defs, id, { opponents: roster }));
const refResults = Object.keys(REFERENCES).map((id) => auditCharacter(defs, id));

if (flag('update-baseline')) {
  const errors = results.flatMap((a) => a.findings.filter((x) => x.severity === 'error').map((x) => x.key)).sort();
  writeFileSync(
    'src/bench/baseline.json',
    `${JSON.stringify({ _note: 'MKS-1 known errors (grandfathered). The CI ratchet fails on any error NOT listed here and on listed errors that are fixed. Regenerate: npm run bench -- --update-baseline', errors }, null, 2)}\n`,
  );
  console.log(`baseline: ${errors.length} known errors written to src/bench/baseline.json`);
}

if (flag('md')) {
  const out: string[] = [
    '# Frame Data (measured)',
    '',
    '> **Generated** by `npm run bench -- --md` — do not hand-edit. Every number is',
    '> measured by running the deterministic engine (`src/bench/`), not read from',
    '> the JSON. SF convention: startup = first active frame (press = frame 1),',
    '> total = frames occupied, on hit / on block = attacker advantage at point',
    '> blank vs a mirror (KD = knockdown). Push in CH (character heights).',
    '> Standards + bands: `docs/FIGHTING_STANDARDS.md`. ⚠ = never connects.',
    '',
    '## Roster summary',
    '',
    ...SUMMARY_HEAD,
    ...results.map(summaryRow),
    ...refResults.map((r) => summaryRow(r).replace(/^\| (\w+)/, '| *$1 (reference)*')),
    '',
    '## Roster vs reference (class medians)',
    '',
    ...compareTable(results, refResults[0]),
    '',
  ];
  for (const a of [...results, ...refResults]) {
    out.push(`## ${a.measure.name}${REFERENCES[a.measure.id] ? ' (benchmark reference)' : ''}`, '');
    out.push(...moveTable(a), '');
    if (a.bnb) out.push(`Best meterless combo: **${a.bnb.pct.toFixed(1)}%** (${a.bnb.hits} hits) — \`${routeText(a.bnb)}\``, '');
    const errs = a.findings.filter((x) => x.severity === 'error');
    if (errs.length) out.push(...errs.map((x) => `- ✗ **${x.move ?? '*'}** ${x.rule}: ${x.message}`), '');
  }
  writeFileSync('docs/FRAME_DATA.md', `${out.join('\n')}\n`);
  console.log('wrote docs/FRAME_DATA.md');
}

console.log(`\nMKS-1 roster audit (${roster.length} fighters, ${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
console.log([...SUMMARY_HEAD, ...results.map(summaryRow), ...refResults.map(summaryRow)].join('\n'));
console.log(`\nclass medians — roster / ${refResults[0]?.measure.id}\n`);
console.log(compareTable(results, refResults[0]).join('\n'));
const errors = results.flatMap((a) => a.findings.filter((x) => x.severity === 'error'));
console.log(`\nERRORS (${errors.length})`);
for (const x of errors) console.log(`  ✗ ${x.char}:${x.move ?? '*'} ${x.rule} — ${x.message}`);
const warnCounts = new Map<string, number>();
for (const a of results) for (const x of a.findings) if (x.severity === 'warn') warnCounts.set(x.rule, (warnCounts.get(x.rule) ?? 0) + 1);
console.log(`\nWARNINGS by band: ${[...warnCounts].sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ×${v}`).join(', ')}`);
console.log('(npm run bench -- --char <id> for a fighter\'s full table + findings)');
