#!/usr/bin/env node
// Scans public/assets/ for the OPTIONAL, drift-prone art/audio that BootScene
// would otherwise blind-load and 404 on — writing src/data/assetManifest.json
// so the loader only ever requests files that exist. Static hosting can't list
// directories, and a 404'd mp3 throws an uncaught EncodingError (not harmless),
// so keeping this manifest fresh is the fix for "console errors on boot".
//
//   node tools/gen-asset-manifest.mjs   # rescan -> src/data/assetManifest.json
//
// Runs automatically via predev/prebuild (like gen-music). Categories:
//   stageVo    — stages with a name call-out (audio/announcer/stage-<id>.mp3)
//   legacyProj — chars with the legacy single projectile (sprites/<id>/projectile.png)
//   moveProj   — "<char>/<move>" with per-move projectile art
//   moveBurst  — "<char>/<move>" with a detonation-burst sprite
//   moveVfx    — "<char>/<move>" with per-move impact VFX art
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PUB = join(ROOT, 'public', 'assets');
const OUT = join(ROOT, 'src', 'data', 'assetManifest.json');

const ls = (dir) => (existsSync(dir) ? readdirSync(dir) : []);

// stage name VOs
const stageVo = ls(join(PUB, 'audio', 'announcer'))
  .filter((f) => f.startsWith('stage-') && f.endsWith('.mp3'))
  .map((f) => f.slice('stage-'.length, -'.mp3'.length))
  .sort();

// per-character sprite art
const legacyProj = [];
const moveProj = [];
const moveBurst = [];
const moveVfx = [];
for (const id of ls(join(PUB, 'sprites'))) {
  const dir = join(PUB, 'sprites', id);
  const files = ls(dir);
  if (!files.length) continue;
  if (files.includes('projectile.png')) legacyProj.push(id);
  for (const f of files) {
    if (!f.endsWith('.png')) continue;
    let m;
    if ((m = /^projectile-(.+)-burst\.png$/.exec(f))) moveBurst.push(`${id}/${m[1]}`);
    else if ((m = /^projectile-(.+)\.png$/.exec(f))) moveProj.push(`${id}/${m[1]}`);
    else if ((m = /^vfx-(.+)\.png$/.exec(f))) moveVfx.push(`${id}/${m[1]}`);
  }
}

const manifest = {
  stageVo,
  legacyProj: legacyProj.sort(),
  moveProj: moveProj.sort(),
  moveBurst: moveBurst.sort(),
  moveVfx: moveVfx.sort(),
};
writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n');
console.log(
  `[asset-manifest] ${stageVo.length} stage VOs · ${legacyProj.length} legacy proj · ` +
    `${moveProj.length} move proj · ${moveBurst.length} bursts · ${moveVfx.length} vfx`,
);
