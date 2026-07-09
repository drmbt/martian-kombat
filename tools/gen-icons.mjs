// Character icons (select screen + health bars) from the straight-on face
// shots in assets/character-inspo/face/. Painted-cel bust on chroma green,
// keyed + scaled into public/assets/portraits/<id>.png (overwrites the old
// canonical head-crops). Idempotent; --force regens.
//
//   node tools/gen-icons.mjs [--force] [--char vincent]

import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ROOT, loadEnv, geminiImage, saveAsset, skip } from './lib.mjs';

const env = loadEnv();
const force = process.argv.includes('--force');
const only = process.argv.includes('--char') ? process.argv[process.argv.indexOf('--char') + 1] : null;
const MODEL = 'gemini-3-pro-image';

const ROSTER = ['catherine', 'flo', 'freeman', 'gene', 'kirby', 'marzipan', 'vincent', 'yulia'];

// per-character prompt adjustments (user-directed)
const TWEAKS = {
  vincent: 'He is wearing his signature small round dark sunglasses.',
  kirby: 'Use the face from the FIRST reference photo, but dress them in the same colorful outfit they wear in the SECOND reference image (their fighting sprite).',
  tao: 'He is in his early 50s — a weathered handsome face with creases at the eyes, grey streaking the temples and stubble (do NOT make him look young). He wears round dark sunglasses and the collar of an ornate embroidered burgundy suit.',
};

const BASE = `Painted cel-shaded 2D fighting game character-select icon portrait of the person in the reference photo: head and shoulders bust, facing the camera STRAIGHT-ON, fierce confident fighting-spirit expression, dramatic even lighting.
Art style: hand-painted cel-shaded anime fighter (modern Capcom / Arc System Works aesthetic), bold clean line art, painterly cel shading — the person must stay clearly recognizable.
Background: solid flat chroma-key green (#00B140), completely uniform, no shadows, no text, no watermark, no border, no frame.`;

async function gen(id) {
  // face shots come in whatever format they were sourced in (tao: -face.png)
  const face = ['.jpg', '.png', '.jpeg', '-face.png', '-face.jpg']
    .map((suffix) => join(ROOT, `assets/character-inspo/face/${id}${suffix}`))
    .find((p) => existsSync(p));
  if (!face) {
    console.warn(`[${id}] no face photo, skipping`);
    return;
  }
  const rawOut = join(ROOT, 'assets/raw/icons', `${id}.png`);
  if (!skip(rawOut, force)) {
    const refs = [face];
    // Kirby: face photo + canonical sprite for the outfit
    if (id === 'kirby') refs.push(join(ROOT, 'assets/raw/canonical/kirby.png'));
    const prompt = `${BASE}\n${TWEAKS[id] ?? ''}`;
    console.log(`[${id}] icon ...`);
    const buf = await geminiImage({
      apiKey: env.GEMINI_API_KEY,
      model: MODEL,
      prompt,
      referencePaths: refs,
      aspectRatio: '1:1',
    });
    saveAsset(rawOut, buf, prompt);
  }
  // key + downscale into the game
  const outDir = join(ROOT, 'public/assets/portraits');
  mkdirSync(outDir, { recursive: true });
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', rawOut,
    '-vf', 'chromakey=0x00B140:0.15:0.06,scale=160:160',
    '-frames:v', '1', join(outDir, `${id}.png`),
  ]);
  console.log(`  -> public/assets/portraits/${id}.png`);
}

for (const id of only ? [only] : ROSTER) await gen(id);
console.log('done.');
