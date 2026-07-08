// Sprint 27 — VO text recovery + persistence. The kiai/hurt/victory line
// TEXTS (and per-move call-out texts) were never stored in the character
// JSONs: they lived in tools/gen-audio.mjs tables (canon roster), creator
// draft states (dogfooded fighters), and .prompt.txt sidecars next to the
// mp3s. This one-shot writes a `vo` block + per-move `voiceText` into every
// character JSON so the texts SURVIVE and repopulate the studio editor.
//
// Source priority (freshest wins):
//   1. assets/raw/creator/<id>/state.json  (draft.vo — the dogfooded edits)
//   2. tools/gen-audio.mjs voiceLines[id]  (the committed pipeline tables)
//   3. public/assets/audio/voice/<id>-<cat>-<n>.prompt.txt sidecars
//
//   node tools/migrate-vo.mjs [--dry]
import { join } from 'node:path';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ROOT } from './lib.mjs';
import { voiceLines } from './gen-audio.mjs';

const dry = process.argv.includes('--dry');
const VOICE_DIR = join(ROOT, 'public/assets/audio/voice');

const sidecar = (name) => {
  const p = join(VOICE_DIR, `${name}.prompt.txt`);
  return existsSync(p) ? readFileSync(p, 'utf-8').trim() : null;
};

const ids = readdirSync(join(ROOT, 'src/data/characters'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''));

for (const id of ids) {
  const jsonPath = join(ROOT, 'src/data/characters', `${id}.json`);
  const def = JSON.parse(readFileSync(jsonPath, 'utf-8'));

  // ── source 1: creator draft state ──
  let draftVo = null;
  const statePath = join(ROOT, 'assets/raw/creator', id, 'state.json');
  if (existsSync(statePath)) {
    try {
      draftVo = JSON.parse(readFileSync(statePath, 'utf-8'))?.draft?.vo ?? null;
    } catch { /* bad state — fall through */ }
  }
  // ── source 2: the pipeline tables ──
  const table = voiceLines[id] ?? null;
  // ── source 3: prompt sidecars ──
  const fromSidecars = (cat, n) => {
    const out = [];
    for (let i = 1; i <= n; i++) {
      const t = sidecar(`${id}-${cat}-${i}`);
      if (t) out.push(t);
    }
    return out.length ? out : null;
  };

  // a stale draft can hold the makeDraft TEMPLATE lines — never let those
  // outrank the real pipeline table (the gene/catherine/rapha lesson)
  const TEMPLATE_KIAI = ['Hah!', 'Rrragh!', 'Take this!', 'Come on!', 'Hyah!', 'Now!'];
  const draftIsTemplate = JSON.stringify(draftVo?.kiai) === JSON.stringify(TEMPLATE_KIAI);
  const pick = (cat, n) =>
    draftVo?.[cat]?.length && !draftIsTemplate ? draftVo[cat] : table?.[cat] ?? fromSidecars(cat, n);
  const kiai = pick('kiai', 6);
  const hurt = pick('hurt', 6);
  const victory = pick('victory', 4);
  const changes = [];
  if ((kiai || hurt || victory) && !def.vo) {
    def.vo = { ...(kiai ? { kiai } : {}), ...(hurt ? { hurt } : {}), ...(victory ? { victory } : {}) };
    changes.push(`vo(${[kiai && 'kiai', hurt && 'hurt', victory && 'victory'].filter(Boolean).join('/')})`);
  }

  // per-move call-out texts: pipeline table `moves` dict + sidecars for every
  // move that opted in with voice:true
  for (const [moveId, move] of Object.entries(def.moves ?? {})) {
    if (!move.voice || move.voiceText) continue;
    const text = table?.moves?.[moveId] ?? sidecar(`${id}-move-${moveId}`);
    if (text) {
      move.voiceText = text;
      changes.push(`voiceText:${moveId}`);
    }
  }

  if (changes.length && !dry) writeFileSync(jsonPath, JSON.stringify(def, null, 2) + '\n');
  console.log(`[${id}] ${changes.length ? changes.join(', ') : 'no recoverable texts / already present'}${dry ? ' (dry)' : ''}`);
}
