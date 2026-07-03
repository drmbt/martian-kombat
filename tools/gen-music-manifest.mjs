#!/usr/bin/env node
// Scans public/assets/audio/music/ for mp3s and writes manifest.json mapping
// each subfolder (context) to its track list. Static hosting can't list
// directories, so the game reads this manifest to know what music exists.
//
//   node tools/gen-music-manifest.mjs             # rescan -> manifest.json
//   node tools/gen-music-manifest.mjs --scaffold  # also create the named
//                                                 # context folders (.gitkeep)
//
// Contexts the game plays (see src/audio/music.ts):
//   menu/               title + main menu + character select (one looping theme)
//   versus/             pre-fight VS screen (menu theme fades out on entry)
//   victory/            post-match win-quote screen (fades in from stage music)
//   stages/<stage-id>/  per-stage fight music (falls back to stages/default/)
//   stages/default/     any stage without its own folder
// (fatalities will be video cutscenes with baked-in audio — no music context)
//
// Multiple mp3s in one folder = the game picks one at random per visit and
// shuffles to another when it ends. Idempotent; run after adding/removing
// tracks (npm run gen:music — also runs automatically via predev/prebuild).
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const MUSIC_DIR = join(ROOT, 'public', 'assets', 'audio', 'music');
const STAGES_TS = join(ROOT, 'src', 'data', 'stages.ts');
const scaffold = process.argv.includes('--scaffold');

if (scaffold) {
  // stage ids from src/data/stages.ts: stage('id', ...) or { id: 'id', ... }
  const src = readFileSync(STAGES_TS, 'utf8');
  const ids = [...src.matchAll(/(?:stage\(|\{ id: )'([a-z0-9-]+)'/g)].map((m) => m[1]);
  const dirs = [
    'menu',
    'versus',
    'victory',
    'stages/default',
    ...ids.map((id) => `stages/${id}`),
  ];
  for (const d of dirs) {
    const p = join(MUSIC_DIR, d);
    mkdirSync(p, { recursive: true });
    writeFileSync(join(p, '.gitkeep'), '');
  }
  console.log(`scaffolded ${dirs.length} context folders under public/assets/audio/music/`);
}

/** Recursively collect { 'folder/relative/path': ['a.mp3', ...] }. */
function scan(dir, base) {
  const out = {};
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // music dir doesn't exist yet -> empty manifest
  }
  const files = [];
  for (const name of entries.sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      Object.assign(out, scan(full, base));
    } else if (/\.mp3$/i.test(name)) {
      files.push(name);
    }
  }
  if (files.length) out[relative(base, dir).split(sep).join('/')] = files;
  return out;
}

mkdirSync(MUSIC_DIR, { recursive: true });
const manifest = scan(MUSIC_DIR, MUSIC_DIR);
writeFileSync(join(MUSIC_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const nCtx = Object.keys(manifest).length;
const nTracks = Object.values(manifest).reduce((n, f) => n + f.length, 0);
console.log(`manifest.json: ${nTracks} track(s) across ${nCtx} context(s)`);
