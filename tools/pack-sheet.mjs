// Chroma-key the generated frames, scale them to cell size, and pack them
// into a sprite sheet + meta.json under public/assets/sprites/<char>/.
// Requires ffmpeg on PATH.
//
//   node tools/pack-sheet.mjs --char vincent
//   node tools/pack-sheet.mjs --all

import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { ROOT } from './lib.mjs';
import { CELL_W, CELL_H, COLS, ROWS, CHARACTERS } from './frames-manifest.mjs';

// chromakey (YUV) at low similarity, NO despill: despill bleaches the whole
// sprite (green bandanas, dark hair), and 0.2+ similarity eats wardrobe greens
const KEY = 'chromakey=0x00B140:0.15:0.06';

function ff(args) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
}

function pack(charId) {
  const inDir = join(ROOT, 'assets/raw/frames', charId);
  const outDir = join(ROOT, 'public/assets/sprites', charId);
  const tmp = join(inDir, 'keyed');
  mkdirSync(tmp, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  const frames = readdirSync(inDir)
    .filter((f) => /^\d\d-.*\.png$/.test(f))
    .sort();
  if (frames.length !== COLS * ROWS - 1 && frames.length !== COLS * ROWS) {
    console.warn(`[${charId}] expected ${COLS * ROWS - 1} frames, found ${frames.length}`);
  }

  frames.forEach((f, i) => {
    ff([
      '-i', join(inDir, f),
      '-vf', `${KEY},scale=${CELL_W}:${CELL_H}:force_original_aspect_ratio=decrease,pad=${CELL_W}:${CELL_H}:(ow-iw)/2:oh-ih:color=0x00000000`,
      '-frames:v', '1',
      join(tmp, `cell-${String(i).padStart(2, '0')}.png`),
    ]);
  });
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
  writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));

  const proj = join(inDir, 'projectile.png');
  if (existsSync(proj)) {
    ff(['-i', proj, '-vf', `${KEY},scale=96:96`, '-frames:v', '1', join(outDir, 'projectile.png')]);
  }

  rmSync(tmp, { recursive: true });
  console.log(`[${charId}] packed ${frames.length} frames -> ${join(outDir, 'sheet.png')}`);
}

const chars = process.argv.includes('--all')
  ? Object.keys(CHARACTERS)
  : [process.argv[process.argv.indexOf('--char') + 1]];
for (const c of chars) pack(c);
