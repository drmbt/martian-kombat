#!/usr/bin/env node
// Re-tile a committed sprite sheet whose grid exceeds the 4096 px mobile
// texture limit (P6.5) — WITHOUT repacking from raw frames, so no pixel of any
// cell changes. Cells keep their row-major order (frame i stays frame i: meta
// frames/skeletons are keyed by name and index, both preserved); only
// meta.cols/rows and the sheet layout change. The new grid is fitGrid()'s —
// the same one the packer would pick, so later repacks agree. Idempotent:
// a sheet that already fits is left alone.
//
//   node tools/regrid-sheet.mjs --char ben
//   node tools/regrid-sheet.mjs --all
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { decodePng, encodePng, regrid, zeroTransparentRgb } from './core/png.mjs';
import { fitGrid, MAX_SHEET_PX } from './core/cells.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const SPRITES = join(ROOT, 'public/assets/sprites');
const args = process.argv.slice(2);
const ids = args.includes('--all')
  ? readdirSync(SPRITES).filter((id) => existsSync(join(SPRITES, id, 'meta.json')))
  : [args[args.indexOf('--char') + 1]].filter(Boolean);
if (!ids.length) { console.error('usage: regrid-sheet.mjs --char <id> | --all'); process.exit(1); }

for (const id of ids) {
  const metaPath = join(SPRITES, id, 'meta.json');
  const sheetPath = join(SPRITES, id, 'sheet.png');
  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  const src = decodePng(readFileSync(sheetPath));
  const n = meta.frames.length;
  if (src.width <= MAX_SHEET_PX && src.height <= MAX_SHEET_PX) { console.log(`${id}: ${src.width}x${src.height} fits — unchanged`); continue; }
  const { cols } = fitGrid(n, meta.cols, meta.cellW, meta.cellH);
  const { img, rows } = regrid(src, meta.cellW, meta.cellH, meta.cols, cols, n);
  // verify: every cell is byte-identical to its source cell
  for (let i = 0; i < n; i++) {
    for (let r = 0; r < meta.cellH; r++) {
      const s = ((Math.floor(i / meta.cols) * meta.cellH + r) * src.width + (i % meta.cols) * meta.cellW) * 4;
      const d = ((Math.floor(i / cols) * meta.cellH + r) * img.width + (i % cols) * meta.cellW) * 4;
      if (Buffer.compare(Buffer.from(src.data.subarray(s, s + meta.cellW * 4)), Buffer.from(img.data.subarray(d, d + meta.cellW * 4))) !== 0) {
        throw new Error(`${id}: cell ${i} row ${r} mismatch`);
      }
    }
  }
  zeroTransparentRgb(img);
  writeFileSync(sheetPath, encodePng(img));
  writeFileSync(metaPath, JSON.stringify({ ...meta, cols, rows }, null, 2) + (readFileSync(metaPath, 'utf-8').endsWith('\n') ? '\n' : ''));
  console.log(`${id}: ${src.width}x${src.height} (${meta.cols}x${meta.rows}) → ${img.width}x${img.height} (${cols}x${rows}), ${n} cells verified`);
}
