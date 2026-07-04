// FBX rig + Mixamo clip FBXs -> public/assets/3d/characters/<id>/<id>.glb
// via headless Blender, with clips renamed to the contract names the 3D
// renderer resolves (src/renderer3d/clipContract.json). Prints a coverage
// report: which contract clips are mapped, which ride a fallback, which are
// missing (SPEC T14/T15/T16).
//
//   npm run gen:mesh -- --char vincent [--force]
//
// Idempotent: skips when the GLB exists (--force to regen). Zip packs under
// public/assets/meshes/<char>/animations/ are extracted once into
// assets/raw/mesh-clips/<char>/ (gitignored).
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
const animDir = join(srcDir, 'animations');
const rawDir = join(ROOT, 'assets/raw/mesh-clips', charId);
const outDir = join(ROOT, 'public/assets/3d/characters', charId);
const outGlb = join(outDir, `${charId}.glb`);
const outReport = join(outDir, `${charId}.report.json`);

if (skip(outGlb, force)) process.exit(0);
if (!existsSync(BLENDER)) {
  console.error(`Blender not found at ${BLENDER} — install Blender.app or edit BLENDER in this script`);
  process.exit(1);
}

// -- extract zip packs (once) ------------------------------------------------
for (const zip of readdirSync(animDir).filter((f) => f.endsWith('.zip'))) {
  const dest = join(rawDir, zip.replace(/\.zip$/, '').toLowerCase().replace(/\s+/g, '-'));
  if (existsSync(dest)) continue;
  mkdirSync(dest, { recursive: true });
  console.log(`  unzip ${zip}`);
  execFileSync('unzip', ['-o', '-q', join(animDir, zip), '-d', dest]);
}

// -- filename -> path index (loose files beat pack files) ---------------------
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
addDir(animDir);
addDir(rawDir);

// -- build the blender job ----------------------------------------------------
const jobClips = [];
const missingSources = [];
for (const [name, clip] of Object.entries(cfg.clips)) {
  const path = index.get(clip.file.toLowerCase());
  if (!path) missingSources.push(`${name} <- ${clip.file}`);
  else jobClips.push({ name, file: path, stripY: clip.stripY === true });
}
if (missingSources.length) {
  console.warn(`  WARN source fbx not found:\n    ${missingSources.join('\n    ')}`);
}

mkdirSync(outDir, { recursive: true });
mkdirSync(rawDir, { recursive: true });
const jobPath = join(rawDir, 'job.json');
writeFileSync(
  jobPath,
  JSON.stringify(
    {
      rig: join(srcDir, cfg.rig),
      basecolor: cfg.basecolor ? join(srcDir, cfg.basecolor) : null,
      out: outGlb,
      report: outReport,
      clips: jobClips,
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
const charJson = JSON.parse(readFileSync(join(ROOT, `src/data/characters/${charId}.json`), 'utf8'));
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
