#!/usr/bin/env node
// Headless auto-pilot: run the full asset DAG for one fighter through the
// same job runner + steps the studio's /__editor/jobs endpoints use
// (docs/CHARACTER_STUDIO.md §2.4 — CLI ⇄ studio parity).
//
//   npm run studio:run -- --char <id> [--mock] [--force] [--only canonical,frames]
//                         [--concurrency N] [--yes]
//
// --mock runs the whole DAG at $0 (MK_GEN_MOCK placeholders). Without --yes,
// a real run prints the estimated API-call count and asks for confirmation —
// no auto-fire spends (§2.8).
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { ROOT, concurrencyArg } from './lib.mjs';
import { JobRunner } from './core/jobs.mjs';
import { WORKERS, buildCharacterDag, dagPrereqs, estimateDag } from './core/pipeline.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const has = (name) => process.argv.includes(name);

const charId = arg('--char');
if (!charId) {
  console.error('usage: npm run studio:run -- --char <id> [--mock] [--force] [--only a,b] [--concurrency N] [--yes]');
  process.exit(1);
}
const mock = has('--mock');
const only = arg('--only')?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;

const missing = dagPrereqs(charId);
if (missing.length && !only) {
  console.error(`✕ ${charId} is missing prerequisites for the asset DAG:\n  - ${missing.join('\n  - ')}`);
  process.exit(1);
}

const specs = buildCharacterDag(charId, { mock, only, force: has('--force') });
const est = estimateDag(specs);
console.log(`studio:run — ${charId} · ${specs.length} jobs${mock ? ' · MOCK ($0)' : ''}`);
for (const s of specs) console.log(`  ${s.key.padEnd(10)} ${s.deps.length ? '← ' + s.deps.join(', ') : ''}`);
if (!mock) {
  const parts = Object.entries(est).map(([k, v]) => `~${v} ${k}`);
  console.log(`estimated spend: ${parts.join(' + ') || 'local compute only'} (idempotent steps skip existing files)`);
  if (!has('--yes')) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((res) => rl.question('fire? [y/N] ', res));
    rl.close();
    if (!/^y(es)?$/i.test(answer.trim())) {
      console.log('aborted — nothing spent.');
      process.exit(0);
    }
  }
}

const runner = new JobRunner({
  dir: join(ROOT, 'assets/raw/jobs'),
  workers: WORKERS,
  concurrency: concurrencyArg(2),
});
runner.subscribe((ev) => {
  if (ev.type === 'log') console.log(`  [${ev.id}] ${ev.line}`);
  if (ev.type === 'job') {
    const j = ev.job;
    const mark = { queued: '·', running: '◐', done: '✓', error: '✕', skipped: '⤼', cancelled: '⊘' }[j.status] ?? '?';
    console.log(`${mark} ${j.label} (${j.status}${j.error ? ': ' + j.error : ''})`);
  }
});
const jobs = runner.enqueueDag(specs);
await runner.idle();

const byStatus = (s) => jobs.filter((j) => j.status === s).length;
const failed = byStatus('error') + byStatus('skipped');
console.log(`\ndone: ${byStatus('done')}/${jobs.length} ok · ${byStatus('error')} error · ${byStatus('skipped')} skipped`);
const cost = jobs.reduce((n, j) => n + (j.cost.assetsWritten ?? 0), 0);
console.log(`assets written this run: ${cost}`);
process.exit(failed ? 1 : 0);
