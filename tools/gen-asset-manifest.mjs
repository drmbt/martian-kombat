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
//   stageWide  — { <stage id>: [w, h] } ultra-wide stage art in
//                backgrounds/stages-wide/ (scrolling-camera arenas; h > w/3.5
//                means a TALL stage whose bottom band is shown)
//   versions   — { "assets/<path>": <sha8> } content hash of every media file
//                the game requests; src/data/assetUrl.ts appends it as ?v= so
//                public/_headers can cache media `immutable` (P6.6)
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PUB = join(ROOT, 'public', 'assets');
const OUT = join(ROOT, 'src', 'data', 'assetManifest.json');

// list a directory's entries, skipping macOS/editor junk (.DS_Store etc.) and
// anything that isn't itself a directory-safe name — a stray .DS_Store FILE in
// sprites/ otherwise gets treated as a character folder and readdir throws
const ls = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith('.')) : []);

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
const spritesRoot = join(PUB, 'sprites');
const spriteDirs = existsSync(spritesRoot)
  ? readdirSync(spritesRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  : [];
for (const id of spriteDirs) {
  const dir = join(spritesRoot, id);
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

/** [w, h] from a JPEG's SOF header — no ffprobe (the CI/Cloudflare build has none) */
function jpegSize(path) {
  const b = readFileSync(path);
  for (let i = 2; i + 9 < b.length; ) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}
const stageWide = {};
const wideDir = join(PUB, 'backgrounds', 'stages-wide');
for (const f of ls(wideDir).filter((x) => x.endsWith('.jpg')).sort()) {
  const size = jpegSize(join(wideDir, f));
  if (size) stageWide[f.slice(0, -4)] = size;
}

// content versions for every media file under public/assets (3D GLBs excluded:
// the frozen 3D mode loads them unversioned). Sorted so the file diffs cleanly.
const MEDIA = /\.(png|jpe?g|webp|mp3|ogg|json)$/i;
const versions = {};
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (MEDIA.test(e.name)) {
      const rel = relative(join(ROOT, 'public'), p).split('\\').join('/');
      // the music manifest is re-fetched (no-cache) and must keep a stable URL
      if (rel === 'assets/audio/music/manifest.json') continue;
      versions[rel] = createHash('sha1').update(readFileSync(p)).digest('hex').slice(0, 8);
    }
  }
};
for (const e of existsSync(PUB) ? readdirSync(PUB, { withFileTypes: true }) : []) {
  if (e.isDirectory() && e.name !== '3d') walk(join(PUB, e.name));
}

const manifest = {
  stageVo,
  legacyProj: legacyProj.sort(),
  moveProj: moveProj.sort(),
  moveBurst: moveBurst.sort(),
  moveVfx: moveVfx.sort(),
  stageWide,
  versions: Object.fromEntries(Object.entries(versions).sort(([a], [b]) => a.localeCompare(b))),
};
writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n');
console.log(
  `[asset-manifest] ${stageVo.length} stage VOs · ${legacyProj.length} legacy proj · ` +
    `${moveProj.length} move proj · ${moveBurst.length} bursts · ${moveVfx.length} vfx · ` +
    `${Object.keys(stageWide).length} wide stages · ${Object.keys(versions).length} versioned files`,
);
