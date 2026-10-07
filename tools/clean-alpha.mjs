#!/usr/bin/env node
// One-time (idempotent) P6.3 pass over the COMMITTED sprite sheets: zero the
// RGB of every fully transparent pixel and re-encode. Chroma-key garbage under
// alpha = 0 is invisible but roughly doubles a sheet's PNG size. The packer
// now does this on every pack (tools/core/packer.mjs); this cleans what's
// already shipped. Lossless where it matters — asserted per file: identical
// size + alpha everywhere, identical RGB wherever alpha > 0.
//
//   node tools/clean-alpha.mjs                 # every public/assets/sprites/*/sheet.png
//   node tools/clean-alpha.mjs --char ben      # one fighter
//   node tools/clean-alpha.mjs --dry           # measure only, write nothing
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { cleanSheetFile } from './core/png.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const SPRITES = join(ROOT, 'public/assets/sprites');
const args = process.argv.slice(2);
const only = args.includes('--char') ? args[args.indexOf('--char') + 1] : null;
const dry = args.includes('--dry');

const ids = (only ? [only] : readdirSync(SPRITES)).filter((id) => existsSync(join(SPRITES, id, 'sheet.png')));
let before = 0, after = 0;
for (const id of ids) {
  const p = join(SPRITES, id, 'sheet.png');
  const src = readFileSync(p);
  const r = cleanSheetFile(src, `${id}/sheet.png`);
  before += src.length;
  const kept = r.out.length < src.length ? r.out : src; // never grow a file
  after += kept.length;
  if (!dry && kept !== src) writeFileSync(p, kept);
  console.log(
    `${id.padEnd(10)} ${(src.length / 1e6).toFixed(2).padStart(6)} → ${(kept.length / 1e6).toFixed(2).padStart(6)} MB` +
      `  (${r.changed} hidden px zeroed${kept === src ? ', kept original' : ''})`,
  );
}
console.log(`total ${(before / 1e6).toFixed(1)} → ${(after / 1e6).toFixed(1)} MB${dry ? ' (dry run)' : ''}`);
