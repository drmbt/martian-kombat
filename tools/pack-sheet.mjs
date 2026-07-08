// Chroma-key the generated frames, scale them to cell size, and pack them
// into a sprite sheet + meta.json under public/assets/sprites/<char>/.
// Requires ffmpeg on PATH.
//
//   node tools/pack-sheet.mjs --char vincent
//   node tools/pack-sheet.mjs --all
//
// --keyer corridor packs from the CorridorKey-keyed straight-alpha frames in
// assets/raw/keyed/<char>/ (produced by `npm run gen:key -- --char <name>`)
// instead of ffmpeg chromakey — the release-quality bake for effect-heavy
// sprites (flames/smoke/glow). ffmpeg stays the fast iteration default.
//
// This is a thin CLI over tools/core/packer.mjs — the SAME packCharacter()
// the vite dev-editor middleware runs, so there is exactly one pack path.

import { ROOT } from './lib.mjs';
import { resolvePython } from './qa/resolve-python.mjs';
import { CHARACTERS, buildJobs, gridFor } from './frames-manifest.mjs';
import { packCharacter } from './core/packer.mjs';

const keyer = process.argv.includes('--keyer')
  ? process.argv[process.argv.indexOf('--keyer') + 1]
  : 'ffmpeg';
if (!['ffmpeg', 'corridor'].includes(keyer)) {
  console.error(`--keyer must be ffmpeg or corridor (got '${keyer}')`);
  process.exit(1);
}

// Floor normalization: shift every keyed cell by one constant delta so the
// character's drawn floor lands on the engine origin plane (see
// tools/qa/normalize_floor.py). Opt-in — existing sheets are untouched.
const NORMALIZE = process.argv.includes('--normalize');

const charArg = process.argv.indexOf('--char');
const chars = process.argv.includes('--all')
  ? Object.keys(CHARACTERS)
  : charArg >= 0
    ? [process.argv[charArg + 1]]
    : [];
if (!chars.length || chars.some((c) => !c || !CHARACTERS[c])) {
  console.error('usage: node tools/pack-sheet.mjs --char <id> | --all  [--normalize] [--keyer ffmpeg|corridor]');
  process.exit(2);
}

for (const c of chars) {
  const spec = CHARACTERS[c];
  packCharacter(c, {
    root: ROOT,
    spec,
    grid: gridFor(spec),
    expected: buildJobs(spec).length,
    keyer,
    normalize: NORMALIZE,
    python: NORMALIZE ? resolvePython('numpy') : undefined,
  });
}
