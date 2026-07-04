// FBX rig + Mixamo clip FBXs -> public/assets/3d/characters/<id>/<id>.glb
// via headless Blender, with clips renamed to the contract names the 3D
// renderer resolves (src/renderer3d/clipContract.json). Prints a coverage
// report: which contract clips are mapped, which ride a fallback, which are
// missing (SPEC T14/T15/T16).
//
//   npm run gen:mesh -- --char vincent [--force]
//
// Idempotent: skips when the GLB exists (--force to regen). Animation clips all
// live under the canonical public/assets/animations/ library (one Mixamo
// skeleton fits all rigs), searched RECURSIVELY so category and pack subfolders
// resolve by filename with no extra wiring; a character may override any clip
// with its own public/assets/meshes/<char>/animations/. (Source zip packs are
// unzipped into public/assets/animations/ by hand — no in-script extraction.)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, skip } from './lib.mjs';
import { MESHES } from './mesh-manifest.mjs';

const BLENDER = '/Applications/Blender.app/Contents/MacOS/Blender';

const args = process.argv.slice(2);
const force = args.includes('--force');
const charId = args[args.indexOf('--char') + 1];
if (!charId || !MESHES[charId]) {
  console.error(`usage: gen-mesh --char <${Object.keys(MESHES).join('|')}> [--force]`);
  process.exit(1);
}

const cfg = MESHES[charId];
const srcDir = join(ROOT, 'public/assets/meshes', charId);
const animDir = join(ROOT, 'public/assets/animations');
const charAnimDir = join(srcDir, 'animations');
const outDir = join(ROOT, 'public/assets/3d/characters', charId);
const outGlb = join(outDir, `${charId}.glb`);
const outReport = join(outDir, `${charId}.report.json`);

const charJson = JSON.parse(readFileSync(join(ROOT, `src/data/characters/${charId}.json`), 'utf8'));

if (skip(outGlb, force)) process.exit(0);
if (!existsSync(BLENDER)) {
  console.error(`Blender not found at ${BLENDER} — install Blender.app or edit BLENDER in this script`);
  process.exit(1);
}

// -- filename -> path index ----------------------------------------------------
// priority: char-specific override > canonical library (both searched recursively)
const index = new Map();
const addDir = (dir) => {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) addDir(join(dir, e.name));
    else if (e.name.toLowerCase().endsWith('.fbx') && !index.has(e.name.toLowerCase())) {
      index.set(e.name.toLowerCase(), join(dir, e.name));
    }
  }
};
addDir(charAnimDir);
addDir(animDir);

// -- build the blender job ----------------------------------------------------
const jobClips = [];
const missingSources = [];
for (const [name, clip] of Object.entries(cfg.clips)) {
  const path = index.get(clip.file.toLowerCase());
  if (!path) missingSources.push(`${name} <- ${clip.file}`);
  else jobClips.push({ name, file: path, stripY: clip.stripY === true, keepRoot: clip.keepRoot === true });
}
if (missingSources.length) {
  console.warn(`  WARN source fbx not found:\n    ${missingSources.join('\n    ')}`);
}

mkdirSync(outDir, { recursive: true });
const jobPath = join(outDir, `${charId}.job.json`);
writeFileSync(
  jobPath,
  JSON.stringify(
    {
      rig: join(srcDir, cfg.rig),
      basecolor: cfg.basecolor ? join(srcDir, cfg.basecolor) : null,
      out: outGlb,
      report: outReport,
      clips: jobClips,
      // world meters the standing rig must measure — baked into the GLB's
      // armature node so the runtime needs NO per-rig scale guessing
      targetHeight: (charJson.hurtStand.h / 100) * 0.95,
      // rigs authored facing +Z get a baked -90 yaw so every GLB faces +X
      forward: cfg.forward ?? 'x',
      bakeTransform: cfg.bakeTransform === true,
    },
    null,
    1,
  ),
);

console.log(`  blender: ${jobClips.length} clips -> ${outGlb}`);
execFileSync(BLENDER, ['--background', '--factory-startup', '--python', join(ROOT, 'tools/blender_fbx_to_glb.py'), '--', jobPath], {
  stdio: ['ignore', 'inherit', 'inherit'],
});

// -- contract coverage (same data + chain walk as clipContract.ts) -------------
const contract = JSON.parse(readFileSync(join(ROOT, 'src/renderer3d/clipContract.json'), 'utf8'));
const report = JSON.parse(readFileSync(outReport, 'utf8'));
const converted = new Set(report.clips.map((c) => c.name));

const chainFor = (want) => {
  if (want.startsWith('attack/')) {
    const id = want.slice(7);
    if (id.startsWith('j')) return ['attack-air', 'attack-generic'];
    if (id.startsWith('c')) return [`attack/${id.slice(1)}`, 'attack-generic'];
    return ['attack-generic'];
  }
  return contract.fallbacks[want] ?? [];
};

const wanted = [
  ...Object.keys(contract.clips).filter((c) => !c.startsWith('attack')),
  ...Object.keys(charJson.moves).map((m) => `attack/${m}`),
];
const coverage = { mapped: [], fallback: [], missing: [] };
for (const want of wanted) {
  if (converted.has(want)) coverage.mapped.push(want);
  else {
    const alt = chainFor(want).find((a) => converted.has(a));
    if (alt) coverage.fallback.push(`${want} -> ${alt}`);
    else coverage.missing.push(`${want} -> idle`);
  }
}

report.coverage = coverage;
report.missingSources = missingSources;
writeFileSync(outReport, JSON.stringify(report, null, 1));

console.log(`\n  coverage: ${coverage.mapped.length} mapped · ${coverage.fallback.length} fallback · ${coverage.missing.length} missing->idle`);
if (coverage.fallback.length) console.log(`    fallback:\n      ${coverage.fallback.join('\n      ')}`);
if (coverage.missing.length) console.log(`    MISSING:\n      ${coverage.missing.join('\n      ')}`);
for (const w of report.warnings) console.log(`    warn: ${w}`);
console.log(`  report: ${outReport}`);
