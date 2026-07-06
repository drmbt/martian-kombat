// CorridorKey neural green-screen keyer — self-bootstrapping handler.
// One call does everything: clones the sibling repo if missing, installs the
// uv env (with the MLX extra on Apple Silicon), fetches the right backend
// weights (working around the dead default MLX weights repo), resolves the
// green-checkpoint collision by stashing whichever backend's file isn't in
// use, then batches a character's raw green-screen frames through inference
// and composes straight-alpha PNGs into assets/raw/keyed/<char>/.
// Background + gotchas: docs/CORRIDORKEY.md. Feed results to packing with
//   npm run gen:pack -- --char <name> --keyer corridor
//
//   npm run gen:key -- --char vincent [--force] [--backend mlx|torch]
//   npm run gen:key -- --all
//   npm run gen:key -- --setup-only
//
// Idempotent + resumable: staged inputs/hints are skipped if present, and
// inference runs with --skip-existing. ~12s/frame on MLX (tiled), ~82s/frame
// on torch/MPS — a full 60-cell character is a ~12 min job on an M-series.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib.mjs';
import { CHARACTERS } from './frames-manifest.mjs';

const CK_REPO = 'https://github.com/nikopueringer/CorridorKey.git';
const MLX_WEIGHTS_REPO = 'nikopueringer/corridorkey-mlx'; // default repo in the tool 404s
const MLX_WEIGHTS_TAG = 'v1.0.0'; // no `latest` release published
const MLX_WEIGHTS_SHA256 = '0b6b202768725fda9f7953090a705262d9c9276e241360d15218357a27d95580';
const TORCH_GREEN = 'CorridorKey.safetensors';
const MLX_GREEN = 'corridorkey_mlx.safetensors';
const SHOT_PREFIX = 'mk-'; // our shots in ClipsForInference, so foreign clips are recognizable

// CorridorKey lives as a sibling clone, never a submodule (its checkpoints
// are GBs and its license is NC-flavored — see docs/CORRIDORKEY.md).
function loadOptionalEnv() {
  try {
    const raw = readFileSync(join(ROOT, '.env'), 'utf8');
    const env = {};
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
    return env;
  } catch {
    return {}; // no API keys needed here; .env is optional for keying
  }
}
const env = loadOptionalEnv();
const CK = env.CORRIDORKEY_DIR || join(ROOT, '..', 'CorridorKey');
const CHECKPOINTS = join(CK, 'CorridorKeyModule', 'checkpoints');
const STASH = join(CHECKPOINTS, '.stash');
const CLIPS = join(CK, 'ClipsForInference');
const PY = process.platform === 'win32'
  ? join(CK, '.venv', 'Scripts', 'python.exe')
  : join(CK, '.venv', 'bin', 'python');
const HELPER = join(ROOT, 'tools', 'corridorkey-helper.py');
const KEYED = join(ROOT, 'assets', 'raw', 'keyed');

const force = process.argv.includes('--force');
const setupOnly = process.argv.includes('--setup-only');
const argOf = (flag) =>
  process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : null;
const isAppleSilicon = process.platform === 'darwin' && process.arch === 'arm64';
const backend = argOf('--backend') ?? (isAppleSilicon ? 'mlx' : 'torch');
if (!['mlx', 'torch'].includes(backend)) {
  console.error(`--backend must be mlx or torch (got '${backend}')`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

// Inference env: MPS fallback for ops MLX/MPS lack; OpenEXR for the outputs.
const ckEnv = {
  ...process.env,
  PYTORCH_ENABLE_MPS_FALLBACK: '1',
  OPENCV_IO_ENABLE_OPENEXR: '1',
};

// ---------------------------------------------------------------- setup ---

function ensureClone() {
  if (existsSync(join(CK, 'corridorkey_cli.py'))) return;
  console.log(`CorridorKey clone not found — cloning into ${CK} ...`);
  run('git', ['clone', CK_REPO, CK]);
}

function ensureVenv() {
  if (existsSync(PY)) return;
  console.log('CorridorKey venv not found — running uv sync (first run downloads torch, be patient) ...');
  try {
    execFileSync('uv', ['--version'], { stdio: 'ignore' });
  } catch {
    console.error('`uv` is required to install CorridorKey: https://docs.astral.sh/uv/ (brew install uv)');
    process.exit(1);
  }
  run('uv', ['sync', ...(isAppleSilicon ? ['--extra', 'mlx'] : [])], { cwd: CK });
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function ensureMlxWeights() {
  if (existsSync(join(CHECKPOINTS, MLX_GREEN)) || existsSync(join(STASH, MLX_GREEN))) return;
  console.log(`MLX weights not found — downloading ${MLX_WEIGHTS_REPO}@${MLX_WEIGHTS_TAG} (~380 MB) ...`);
  const dlEnv = { ...ckEnv, CORRIDORKEY_MLX_WEIGHTS_REPO: MLX_WEIGHTS_REPO };
  run(PY, ['-m', 'corridorkey_mlx', 'weights', 'download', '--tag', MLX_WEIGHTS_TAG], { cwd: CK, env: dlEnv });
  const out = execFileSync(
    PY, ['-m', 'corridorkey_mlx', 'weights', 'download', '--tag', MLX_WEIGHTS_TAG, '--print-path'],
    { cwd: CK, env: dlEnv, encoding: 'utf8' },
  );
  const cached = out.split('\n').filter((l) => l.trim().endsWith('.safetensors')).pop()?.trim();
  if (!cached || !existsSync(cached)) {
    console.error(`could not locate downloaded MLX weights in output:\n${out}`);
    process.exit(1);
  }
  mkdirSync(CHECKPOINTS, { recursive: true });
  copyFileSync(cached, join(CHECKPOINTS, MLX_GREEN));
  const digest = sha256(join(CHECKPOINTS, MLX_GREEN));
  if (digest !== MLX_WEIGHTS_SHA256) {
    console.warn(`WARNING: MLX weights sha256 mismatch (got ${digest}) — release may have been republished`);
  }
  console.log(`  wrote ${join(CHECKPOINTS, MLX_GREEN)}`);
}

// The backend can't tell the torch green .safetensors from the MLX one (same
// glob) and refuses to run with both present, so exactly one may live in
// checkpoints/ — the other waits in checkpoints/.stash/ (a subdir is
// invisible to its non-recursive glob).
function ensureCheckpointLayout() {
  mkdirSync(STASH, { recursive: true });
  const want = backend === 'mlx' ? MLX_GREEN : TORCH_GREEN;
  const other = backend === 'mlx' ? TORCH_GREEN : MLX_GREEN;
  if (!existsSync(join(CHECKPOINTS, want)) && existsSync(join(STASH, want))) {
    renameSync(join(STASH, want), join(CHECKPOINTS, want));
    console.log(`  restored ${want} from stash`);
  }
  if (existsSync(join(CHECKPOINTS, other))) {
    renameSync(join(CHECKPOINTS, other), join(STASH, other));
    console.log(`  stashed ${other} (collides with ${backend} checkpoint discovery)`);
  }
  // torch green auto-downloads on first run if absent; mlx must exist by now
  if (backend === 'mlx' && !existsSync(join(CHECKPOINTS, MLX_GREEN))) {
    console.error('MLX weights still missing after setup — see docs/CORRIDORKEY.md');
    process.exit(1);
  }
}

function ensureSetup() {
  ensureClone();
  ensureVenv();
  if (backend === 'mlx') ensureMlxWeights();
  ensureCheckpointLayout();
  console.log(`setup OK — clone ${CK}, backend ${backend}`);
}

// ---------------------------------------------------------------- batch ---

// A frame is keyable if it's on our standard chroma green; projectiles can
// declare a different key color in frames-manifest and those stay on ffmpeg.
function keyableFrames(charId) {
  const inDir = join(ROOT, 'assets', 'raw', 'frames', charId);
  if (!existsSync(inDir)) {
    console.error(`no raw frames at ${inDir} — run npm run gen:frames -- --char ${charId} first`);
    process.exit(1);
  }
  const all = readdirSync(inDir);
  const frames = all.filter((f) => /^\d\d-.*\.png$/.test(f)).sort();
  const projectiles = all.filter((f) => {
    const m = f.match(/^projectile-(.+)\.png$/);
    if (!m) return false;
    const key = CHARACTERS[charId]?.extra?.projectiles?.[m[1]]?.key ?? '0x00B140';
    return key === '0x00B140';
  });
  return { inDir, files: [...frames, ...projectiles] };
}

function stage(charId) {
  const { inDir, files } = keyableFrames(charId);
  const shot = join(CLIPS, `${SHOT_PREFIX}${charId}`);
  if (force) {
    rmSync(shot, { recursive: true, force: true });
    rmSync(join(KEYED, charId), { recursive: true, force: true });
  }
  const input = join(shot, 'Input');
  mkdirSync(input, { recursive: true });
  let staged = 0;
  for (const f of files) {
    const dst = join(input, f);
    if (existsSync(dst)) continue;
    copyFileSync(join(inDir, f), dst);
    staged += 1;
  }
  console.log(`[${charId}] staged ${staged}/${files.length} frames -> ${shot}`);
  run(PY, [HELPER, 'hints', input, join(shot, 'AlphaHint')], { env: ckEnv });
  return { shot, count: files.length };
}

function inference() {
  const foreign = existsSync(CLIPS)
    ? readdirSync(CLIPS).filter((d) => !d.startsWith(SHOT_PREFIX) && !d.startsWith('.'))
    : [];
  if (foreign.length) {
    console.warn(`note: foreign clips in ClipsForInference will also be scanned (complete ones are skipped): ${foreign.join(', ')}`);
  }
  run(
    PY,
    [
      'corridorkey_cli.py', 'run-inference',
      '--backend', backend,
      '--screen-color', 'green',
      '--srgb',
      '--despill', '5',
      '--despeckle', '--despeckle-size', '20',
      '--image-size', '2048', // must be explicit: omitting it crashes headless runs
      '--refiner', '1.0',
      backend === 'mlx' ? '--tile' : '--no-tile', // --tile mandatory on MLX (5s vs 10min/frame)
      '--comp',
      '--skip-existing',
    ],
    { cwd: CK, env: ckEnv },
  );
}

function compose(charId, shot, count) {
  const outDir = join(KEYED, charId);
  run(PY, [HELPER, 'compose', shot, outDir], { env: ckEnv });
  const keyed = readdirSync(outDir).filter((f) => f.endsWith('.png')).length;
  if (keyed < count) {
    console.error(`[${charId}] only ${keyed}/${count} frames keyed — rerun to resume (inference is --skip-existing)`);
    process.exitCode = 1;
  } else {
    console.log(`[${charId}] ${keyed} keyed frames ready — next: npm run gen:pack -- --char ${charId} --keyer corridor`);
  }
}

// ----------------------------------------------------------------- main ---

const chars = process.argv.includes('--all')
  ? Object.keys(CHARACTERS)
  : [argOf('--char')].filter(Boolean);
if (!chars.length && !setupOnly) {
  console.error('usage: npm run gen:key -- --char <name> [--force] [--backend mlx|torch] | --all | --setup-only');
  process.exit(1);
}

ensureSetup();
if (setupOnly) process.exit(0);

const shots = chars.map((c) => ({ charId: c, ...stage(c) }));
const total = shots.reduce((n, s) => n + s.count, 0);
const perFrame = backend === 'mlx' ? 12 : 82;
console.log(`running ${backend} inference on ${total} frames (~${Math.ceil((total * perFrame) / 60)} min) ...`);
inference();
for (const s of shots) compose(s.charId, s.shot, s.count);
