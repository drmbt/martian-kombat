// Sprint 27 Phase 2 — the atomic floor/skeleton migration (one-shot, local
// compute only). Re-packs every playable fighter from raw frames with floor
// normalization ON and FRESH RTMPose skeletons inferred from the exact packed
// cells, then strips the per-character `spriteOffsetY` render nudges the
// normalize replaces. Run AFTER src/render/coords.json spriteFootOffsetY -> 0.
//
//   node tools/migrate-floor.mjs [--char <id>] [--skip-json]
//
// Idempotent: re-running re-packs (same result) and re-stripping is a no-op.
import { join } from 'node:path';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ROOT } from './lib.mjs';
import { resolvePython } from './qa/resolve-python.mjs';
import { CHARACTERS, buildJobs, gridFor } from './frames-manifest.mjs';
import { packCharacter } from './core/packer.mjs';

const only = process.argv.includes('--char') ? process.argv[process.argv.indexOf('--char') + 1] : null;
const skipJson = process.argv.includes('--skip-json');

const python = resolvePython(); // rtmlib + onnxruntime + cv2 (normalize + inference)

const rosterIds = readdirSync(join(ROOT, 'src/data/characters'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''));

const report = [];
for (const id of rosterIds) {
  if (only && id !== only) continue;
  const framesDir = join(ROOT, 'assets/raw/frames', id);
  if (!existsSync(framesDir)) {
    report.push({ id, ok: false, note: 'NO RAW FRAMES — cannot migrate' });
    continue;
  }
  const nFrames = readdirSync(framesDir).filter((f) => /^\d\d-.*\.png$/.test(f)).length;
  const spec = CHARACTERS[id];
  let grid;
  let expected;
  if (spec) {
    grid = gridFor(spec);
    expected = buildJobs(spec).length;
  } else {
    // creator-made character: derive the grid from the current meta
    const metaPath = join(ROOT, 'public/assets/sprites', id, 'meta.json');
    const cols = existsSync(metaPath) ? (JSON.parse(readFileSync(metaPath, 'utf-8')).cols ?? 6) : 6;
    grid = { cols, rows: Math.ceil(nFrames / cols) };
    expected = nFrames;
  }
  console.log(`\n=== ${id} (${nFrames} frames, ${grid.cols}x${grid.rows}) ===`);
  try {
    const r = packCharacter(id, {
      root: ROOT, spec, grid, expected,
      normalize: true, inferSkeletons: true, python,
    });
    const skel = Object.keys(r.meta.skeletons ?? {}).length;
    report.push({ id, ok: true, frames: r.frames, expected, skeletons: skel });
  } catch (err) {
    report.push({ id, ok: false, note: String(err).slice(0, 200) });
  }
}

// strip the legacy per-character render nudges the normalize replaces
if (!skipJson) {
  for (const id of rosterIds) {
    if (only && id !== only) continue;
    const p = join(ROOT, 'src/data/characters', `${id}.json`);
    const def = JSON.parse(readFileSync(p, 'utf-8'));
    if ('spriteOffsetY' in def) {
      delete def.spriteOffsetY;
      writeFileSync(p, JSON.stringify(def, null, 2) + '\n');
      console.log(`[${id}] spriteOffsetY stripped`);
    }
  }
}

console.log('\n── migration report ──');
for (const r of report) {
  console.log(
    r.ok
      ? `  ${r.id}: OK · ${r.frames}/${r.expected} frames · ${r.skeletons} skeletons`
      : `  ${r.id}: FAILED — ${r.note}`,
  );
}
const bad = report.filter((r) => !r.ok || (r.expected != null && r.frames !== r.expected));
if (bad.length) {
  console.log(`\n${bad.length} character(s) need attention (missing frames / failures above).`);
}
