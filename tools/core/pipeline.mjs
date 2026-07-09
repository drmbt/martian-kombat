// tools/core/pipeline.mjs — the auto-pilot DAG over the existing gen:*
// scripts (docs/CHARACTER_STUDIO.md §2.4). The CLI pipeline IS the headless
// pipeline: every step is an idempotent, resumable script, so a job that
// dies mid-way simply re-runs and skips what exists. One DAG serves both
// front doors: `npm run studio:run` (in-process runner) and the studio's
// /__editor/jobs endpoints (dev-server runner) — CLI ⇄ studio parity.
//
// v1 scope: the ASSET auto-pilot for a fighter whose character JSON +
// frames-manifest entry + inspo photo already exist (canon fighters and
// studio-scaffolded ones). The SEED/design scaffold for a brand-new name
// stays in the studio wizard for now.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../lib.mjs';

/** the pipeline steps, in dependency order. `est` feeds the cost UI
 *  (approximate API calls; a v2 fighter is ~70 images + ~20 TTS total). */
export const STEPS = [
  { key: 'canonical', label: 'canonical sheet + KO bust', args: ['tools/gen-canonical.mjs'], deps: [], est: { images: 3 } },
  { key: 'frames', label: 'pose keyframes', args: ['tools/gen-frames.mjs'], deps: ['canonical'], est: { images: 56 } },
  { key: 'pack', label: 'key + pack + skeletons', args: ['tools/pack-sheet.mjs', '--normalize'], deps: ['frames'], est: {} },
  { key: 'icons', label: 'selector icon', args: ['tools/gen-icons.mjs'], deps: ['canonical'], est: { images: 1 } },
  { key: 'busts', label: 'pose-centered bust crops', args: ['tools/qa/run.mjs', 'portrait_crop.py', '--all'], deps: ['canonical'], perChar: false, est: {} },
  { key: 'audio', label: 'announcer + VO + SFX', args: ['tools/gen-audio.mjs'], deps: [], est: { tts: 18, sfx: 3 } },
  { key: 'fatality', label: 'fatality panels', args: ['tools/gen-fatality.mjs'], deps: ['canonical'], est: { images: 4 } },
  { key: 'manifest', label: 'asset manifest rescan', args: ['tools/gen-asset-manifest.mjs'], deps: ['pack', 'icons', 'busts', 'audio', 'fatality'], perChar: false, est: {} },
];

/** the job specs for one fighter (JobRunner.enqueueDag input).
 *  `only`: restrict to these step keys (deps outside the set are dropped). */
export function buildCharacterDag(charId, { mock = false, only = null, force = false } = {}) {
  const keep = only ? new Set(only) : null;
  const steps = keep ? STEPS.filter((s) => keep.has(s.key)) : STEPS;
  return steps.map((s) => ({
    key: s.key,
    kind: 'cli',
    label: `${s.key} · ${charId}`,
    char: charId,
    deps: s.deps.filter((d) => !keep || keep.has(d)),
    estCost: mock ? {} : s.est,
    payload: {
      args: [...s.args, ...(s.perChar === false ? [] : ['--char', charId]), ...(force ? ['--force'] : [])],
      mock,
    },
  }));
}

/** what a fighter needs on disk before the asset DAG can run */
export function dagPrereqs(charId) {
  const missing = [];
  if (!existsSync(join(ROOT, `assets/character-inspo/${charId}.jpg`))) missing.push(`assets/character-inspo/${charId}.jpg`);
  if (!existsSync(join(ROOT, `src/data/characters/${charId}.json`))) missing.push(`src/data/characters/${charId}.json (scaffold in the studio first)`);
  return missing;
}

/** the one worker v1 needs: spawn a repo script, stream its output into the
 *  job log, count written assets (each "wrote <path>" line ≈ one API call in
 *  a real run). MK_GEN_MOCK rides the env so mock runs cost $0. */
export function cliWorker(job, api) {
  return new Promise((resolve, reject) => {
    const { args, mock } = job.payload;
    api.log(`$ node ${args.join(' ')}${mock ? '   [MK_GEN_MOCK=1]' : ''}`);
    const child = spawn(process.execPath, args.map(String), {
      cwd: ROOT,
      env: { ...process.env, ...(mock ? { MK_GEN_MOCK: '1' } : {}) },
    });
    api.onCancel(() => child.kill('SIGTERM'));
    let buf = '';
    const onChunk = (chunk) => {
      buf += chunk.toString();
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trimEnd();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        api.log(line);
        if (/^\s*wrote /.test(line)) api.cost({ assetsWritten: 1 });
      }
    };
    child.stdout.on('data', onChunk);
    child.stderr.on('data', onChunk);
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (buf.trim()) api.log(buf.trim());
      if (api.isCancelled()) return resolve();
      if (code === 0) return resolve();
      const tail = job.log.slice(-4).join(' | ');
      reject(new Error(`exit ${code ?? signal}: ${tail}`));
    });
  });
}

export const WORKERS = { cli: cliWorker };

/** total estimated API calls for a DAG (the "say so before firing" number) */
export function estimateDag(specs) {
  const total = {};
  for (const s of specs) {
    for (const [k, v] of Object.entries(s.estCost ?? {})) total[k] = (total[k] ?? 0) + v;
  }
  return total;
}
