// Generate every sprite-sheet keyframe for a character from its canonical
// sheet, using the locked style (tools/style.md). Idempotent; --force regens.
//
//   node tools/gen-frames.mjs --char vincent [--force]
//   node tools/gen-frames.mjs --all

import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { ROOT, loadEnv, geminiImage, saveAsset, skip } from './lib.mjs';
import { CHARACTERS, buildJobs } from './frames-manifest.mjs';

const env = loadEnv();
const force = process.argv.includes('--force');
// pro, not flash: flash drifts the background color toward the character's
// palette (Vincent's all-black kit came back on navy) and fumbles non-standing
// poses; pro respected both in the style tests
const MODEL = 'gemini-3-pro-image';

const STYLE_BASE = `Art style: hand-painted cel-shaded 2D anime fighter (modern Capcom / Arc System Works aesthetic). Bold clean line art, painterly cel shading, confident silhouette, slightly heroic proportions while keeping the person recognizable.`;

const FRAME_RULES = `Same character as the reference image — identical face, hair, outfit, colors, proportions and art style. EXACTLY ONE person in the image: a single figure, drawn once, in the pose described — never a second copy of the character, never an opponent. Correct anatomy is CRITICAL: the character has exactly TWO arms and TWO legs, every limb clearly attached to the body — no extra limbs, no floating or disembodied body parts, no duplicated legs or feet. Full body visible, same scale and camera distance as the reference image, character centered, facing right. The background MUST be EXACTLY the same solid flat bright chroma-key green (#00B140) as the reference image background — completely uniform green, no other background color is acceptable, no cast shadows, no floor, no text, no watermark, no border.`;

async function genChar(charId) {
  const spec = CHARACTERS[charId];
  if (!spec) throw new Error(`unknown character ${charId}`);
  const canonical = join(ROOT, spec.canonical);
  if (!existsSync(canonical)) throw new Error(`missing canonical sheet ${canonical}`);
  const outDir = join(ROOT, 'assets/raw/frames', charId);

  // manifest order (legacy 23-cell or v2 six-button layout)
  const jobs = buildJobs(spec);

  // Low-pose height anchor: the model copies the standing canonical's height
  // for crouch cells no matter what the text says. Passing an existing LOW
  // frame of the same character as a second reference fixes it. (Fresh
  // characters: run the script twice — the sweep/chk cell generates on pass
  // one and anchors the crouch family on pass two.)
  const lowAnchorName = jobs
    .map((j, i) => ({ ...j, i }))
    .find((j) => /(^|-)(chk|sweep)-active$/.test(j.id));
  const lowRefPath = lowAnchorName
    ? join(outDir, `${String(lowAnchorName.i).padStart(2, '0')}-${lowAnchorName.id}.png`)
    : null;
  const LOW_ANCHOR = ` CRITICAL: copy the BODY HEIGHT of the SECOND reference image (the low pose) — the top of the head at that same low height, empty green above.`;
  const isLowCell = (id) => id === 'crouch' || id === 'block-crouch' || /^c[lmh][pk]-/.test(id);

  for (let i = 0; i < jobs.length; i++) {
    const { id, pose } = jobs[i];
    const out = join(outDir, `${String(i).padStart(2, '0')}-${id}.png`);
    if (skip(out, force)) continue;
    const useAnchor = isLowCell(id) && lowRefPath && existsSync(lowRefPath);
    // per-character invariant (e.g. Catherine's bo staff in EVERY frame)
    const always = spec.always ? ` ${spec.always}` : '';
    const prompt = `${STYLE_BASE}\n${FRAME_RULES}${always}\nPose: ${pose}.${useAnchor ? LOW_ANCHOR : ''}`;
    console.log(`[${charId}] ${i + 1}/${jobs.length} ${id}${useAnchor ? ' (low-anchored)' : ''} ...`);
    try {
      const buf = await geminiImage({
        apiKey: env.GEMINI_API_KEY,
        model: MODEL,
        prompt,
        referencePaths: useAnchor ? [canonical, lowRefPath] : [canonical],
        aspectRatio: '3:4',
      });
      saveAsset(out, buf, prompt);
    } catch (e) {
      console.error(`  FAILED ${id}: ${e.message}`);
    }
  }

  // one art file per projectile-throwing special: projectile-<move-id>.png
  for (const [pid, proj] of Object.entries(spec.extra?.projectiles ?? {})) {
    const out = join(outDir, `projectile-${pid}.png`);
    if (skip(out, force)) continue;
    console.log(`[${charId}] projectile ${pid} ...`);
    const buf = await geminiImage({
      apiKey: env.GEMINI_API_KEY,
      model: MODEL,
      prompt: proj.prompt,
      aspectRatio: '1:1',
    });
    saveAsset(out, buf, proj.prompt);
  }
}

const chars = process.argv.includes('--all')
  ? Object.keys(CHARACTERS)
  : [process.argv[process.argv.indexOf('--char') + 1]];
for (const c of chars) await genChar(c);
console.log('done.');
