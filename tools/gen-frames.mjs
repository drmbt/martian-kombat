// Generate every sprite-sheet keyframe for a character from its canonical
// sheet, using the locked style (tools/style.md). Idempotent; --force regens.
//
//   node tools/gen-frames.mjs --char vincent [--force]
//   node tools/gen-frames.mjs --all

import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { ROOT, loadEnv, geminiImage, saveAsset, skip } from './lib.mjs';
import { CELLS, MOVES, CHARACTERS } from './frames-manifest.mjs';

const env = loadEnv();
const force = process.argv.includes('--force');
// pro, not flash: flash drifts the background color toward the character's
// palette (Vincent's all-black kit came back on navy) and fumbles non-standing
// poses; pro respected both in the style tests
const MODEL = 'gemini-3-pro-image';

const STYLE_BASE = `Art style: hand-painted cel-shaded 2D anime fighter (modern Capcom / Arc System Works aesthetic). Bold clean line art, painterly cel shading, confident silhouette, slightly heroic proportions while keeping the person recognizable.`;

const FRAME_RULES = `Same character as the reference image — identical face, hair, outfit, colors, proportions and art style. EXACTLY ONE person in the image: a single figure, drawn once, in the pose described — never a second copy of the character, never an opponent. Full body visible, same scale and camera distance as the reference image, character centered, facing right. The background MUST be EXACTLY the same solid flat bright chroma-key green (#00B140) as the reference image background — completely uniform green, no other background color is acceptable, no cast shadows, no floor, no text, no watermark, no border.`;

async function genChar(charId) {
  const spec = CHARACTERS[charId];
  if (!spec) throw new Error(`unknown character ${charId}`);
  const canonical = join(ROOT, spec.canonical);
  if (!existsSync(canonical)) throw new Error(`missing canonical sheet ${canonical}`);
  const outDir = join(ROOT, 'assets/raw/frames', charId);

  // shared cells 0-10, then move phases 11-22 in manifest order
  const jobs = CELLS.map((c) => ({ id: c.id, pose: c.pose }));
  for (const move of MOVES) {
    for (const phase of ['startup', 'active', 'recovery']) {
      jobs.push({ id: `${move}-${phase}`, pose: spec.moves[move][phase] });
    }
  }

  for (let i = 0; i < jobs.length; i++) {
    const { id, pose } = jobs[i];
    const out = join(outDir, `${String(i).padStart(2, '0')}-${id}.png`);
    if (skip(out, force)) continue;
    const prompt = `${STYLE_BASE}\n${FRAME_RULES}\nPose: ${pose}.`;
    console.log(`[${charId}] ${i + 1}/${jobs.length} ${id} ...`);
    try {
      const buf = await geminiImage({
        apiKey: env.GEMINI_API_KEY,
        model: MODEL,
        prompt,
        referencePaths: [canonical],
        aspectRatio: '3:4',
      });
      saveAsset(out, buf, prompt);
    } catch (e) {
      console.error(`  FAILED ${id}: ${e.message}`);
    }
  }

  if (spec.extra?.projectile) {
    const out = join(outDir, 'projectile.png');
    if (!skip(out, force)) {
      console.log(`[${charId}] projectile ...`);
      const buf = await geminiImage({
        apiKey: env.GEMINI_API_KEY,
        model: MODEL,
        prompt: spec.extra.projectile,
        aspectRatio: '1:1',
      });
      saveAsset(out, buf, spec.extra.projectile);
    }
  }
}

const chars = process.argv.includes('--all')
  ? Object.keys(CHARACTERS)
  : [process.argv[process.argv.indexOf('--char') + 1]];
for (const c of chars) await genChar(c);
console.log('done.');
