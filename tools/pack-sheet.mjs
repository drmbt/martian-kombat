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

import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { ROOT } from './lib.mjs';
import { CELL_W, CELL_H, CHARACTERS, buildJobs, gridFor } from './frames-manifest.mjs';

// chromakey (YUV) at low similarity, NO despill: despill bleaches the whole
// sprite (green bandanas, dark hair), and 0.2+ similarity eats wardrobe greens
const KEY = 'chromakey=0x00B140:0.15:0.06';

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

function ff(args) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
}

function pack(charId) {
  const inDir = join(ROOT, 'assets/raw/frames', charId);
  const outDir = join(ROOT, 'public/assets/sprites', charId);
  const tmp = join(inDir, 'keyed');
  mkdirSync(tmp, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  const spec = CHARACTERS[charId];
  const { cols: COLS, rows: ROWS } = gridFor(spec);
  const frames = readdirSync(inDir)
    .filter((f) => /^\d\d-.*\.png$/.test(f))
    .sort();
  const expected = buildJobs(spec).length;
  if (frames.length !== expected) {
    console.warn(`[${charId}] expected ${expected} frames, found ${frames.length}`);
  }

  // corridor mode: frames are already straight-alpha, so only scale/pad. A
  // missing keyed frame is an incomplete gen:key run — fail rather than
  // silently mixing halo'd chromakey cells into a release bake.
  const keyedDir = join(ROOT, 'assets/raw/keyed', charId);
  if (keyer === 'corridor') {
    const missing = frames.filter((f) => !existsSync(join(keyedDir, f)));
    if (missing.length) {
      console.error(`[${charId}] ${missing.length} frames not keyed (${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''}) — run: npm run gen:key -- --char ${charId}`);
      process.exit(1);
    }
  }
  const SCALE_PAD = `scale=${CELL_W}:${CELL_H}:force_original_aspect_ratio=decrease,pad=${CELL_W}:${CELL_H}:(ow-iw)/2:oh-ih:color=0x00000000`;

  frames.forEach((f, i) => {
    ff([
      '-i', join(keyer === 'corridor' ? keyedDir : inDir, f),
      '-vf', keyer === 'corridor' ? SCALE_PAD : `${KEY},${SCALE_PAD}`,
      '-frames:v', '1',
      join(tmp, `cell-${String(i).padStart(2, '0')}.png`),
    ]);
  });

  // opt-in floor normalization on the keyed cells, before tiling
  if (NORMALIZE) {
    const names = frames.map((f) => f.replace(/^\d\d-/, '').replace(/\.png$/, ''));
    execFileSync('python3', [
      join(ROOT, 'tools/qa/normalize_floor.py'),
      '--dir', tmp,
      '--frames', names.join(','),
    ], { stdio: 'inherit' });
  }

  // pad the grid with blank cells so tile always gets COLS*ROWS inputs
  for (let i = frames.length; i < COLS * ROWS; i++) {
    ff(['-f', 'lavfi', '-i', `color=black@0.0:s=${CELL_W}x${CELL_H},format=rgba`, '-frames:v', '1', join(tmp, `cell-${String(i).padStart(2, '0')}.png`)]);
  }

  ff([
    '-framerate', '1',
    '-i', join(tmp, 'cell-%02d.png'),
    '-filter_complex', `tile=${COLS}x${ROWS}`,
    '-frames:v', '1',
    join(outDir, 'sheet.png'),
  ]);

  const meta = {
    cellW: CELL_W,
    cellH: CELL_H,
    cols: COLS,
    rows: ROWS,
    frames: frames.map((f) => f.replace(/^\d\d-/, '').replace(/\.png$/, '')),
  };

  // Optional: bake the DWPose keypoints tools/qa/pose_qa.py already measured
  // (assets/raw/qa/<char>/report.json, cells.<name>.kp) into meta.json as a
  // 2D skeleton overlay source — see src/scenes/FightScene.ts drawSkeleton().
  // Purely additive: no report.json (or an older one predating the `cells`
  // key) just means no `skeletons` in meta.json, same as any other
  // not-yet-generated optional asset.
  const qaReportPath = join(ROOT, 'assets/raw/qa', charId, 'report.json');
  if (existsSync(qaReportPath)) {
    const report = JSON.parse(readFileSync(qaReportPath, 'utf-8'));
    if (report.cells) {
      const dyPath = join(tmp, 'dy.json');
      const dy = existsSync(dyPath) ? JSON.parse(readFileSync(dyPath, 'utf-8')).dy : 0;
      const skeletons = {};
      for (const name of meta.frames) {
        const kp = report.cells[name]?.kp;
        if (!kp) continue;
        skeletons[name] = Object.fromEntries(
          Object.entries(kp).map(([joint, [x, y, conf]]) => [joint, [x, y + dy, conf]]),
        );
      }
      if (Object.keys(skeletons).length) meta.skeletons = skeletons;
    }
  }

  writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));

  for (const [pid, projSpec] of Object.entries(CHARACTERS[charId]?.extra?.projectiles ?? {})) {
    const proj = join(inDir, `projectile-${pid}.png`);
    if (!existsSync(proj)) continue;
    const projKey = projSpec.key ?? '0x00B140';
    // CorridorKey only keys chroma green — custom-key projectiles (magenta
    // etc.) stay on ffmpeg even in corridor mode
    const keyedProj = join(keyedDir, `projectile-${pid}.png`);
    if (keyer === 'corridor' && projKey === '0x00B140' && existsSync(keyedProj)) {
      ff(['-i', keyedProj, '-vf', 'scale=96:96', '-frames:v', '1', join(outDir, `projectile-${pid}.png`)]);
    } else {
      ff(['-i', proj, '-vf', `chromakey=${projKey}:0.15:0.06,scale=96:96`, '-frames:v', '1', join(outDir, `projectile-${pid}.png`)]);
    }
  }

  rmSync(tmp, { recursive: true });
  console.log(`[${charId}] packed ${frames.length} frames -> ${join(outDir, 'sheet.png')}`);
}

const chars = process.argv.includes('--all')
  ? Object.keys(CHARACTERS)
  : [process.argv[process.argv.indexOf('--char') + 1]];
for (const c of chars) pack(c);
