// Fatality cutscene panels: full-bleed 16:9 anime action panels generated
// from the character's canonical sheet. Output goes straight to
// public/assets/fatalities/<char>/<fatality-id>-<n>.jpg (committed).
// Idempotent; --force regens.  node tools/gen-fatality.mjs [--char yulia]

import { join } from 'node:path';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ROOT, loadEnv, geminiImage, saveAsset, skip } from './lib.mjs';

const env = loadEnv();
const force = process.argv.includes('--force');
const only = process.argv.includes('--char') ? process.argv[process.argv.indexOf('--char') + 1] : null;

const PANEL_STYLE = `Full-bleed anime fight-scene cutscene panel, painted cel-shaded style (modern Arc System Works cinematic super-move aesthetic). Extreme dynamic angle, dramatic anime speed lines and radial motion streaks OBSCURING any background — no scenery visible, just motion-line energy. High contrast, saturated rim light. No text, no watermark, no speech bubbles, no panel borders.`;

const HUSK = `a completely charred, burnt-black featureless husk silhouette of a defeated fighter — smoldering, cracked with ember-orange seams, no recognizable face or clothing (a generic burnt figure, NOT a specific person)`;

const FATALITIES = {
  yulia: {
    id: 'heart-breaker',
    canonical: 'assets/raw/style-tests/char-yulia-b-painted.png',
    panels: [
      `The woman from the reference image (same face, green paisley bandana over her mouth, striped crop top, tattooed arm), her fist engulfed in raging red flame, PLUNGING that flaming fist into the chest of ${HUSK}. Extreme close low angle, embers exploding outward.`,
      `The woman from the reference image raising a ripped-out, still-burning human heart high overhead in triumph, red flame licking up her arm, her eyes fierce, while ${HUSK} collapses in the lower corner. Heroic low angle.`,
      `The woman from the reference image hurling the burning heart down toward the ground, arm fully extended downward in a violent throw, heart trailing fire and motion streaks below her scowling face. High angle.`,
      `The boot of the woman from the reference image STOMPING down on the burning heart on cracked desert ground, a burst of embers and red shockwave from the impact, her standing victorious above it, arms flexed. Dramatic dutch angle from ground level.`,
    ],
  },
};

async function gen(charId) {
  const spec = FATALITIES[charId];
  if (!spec) return;
  const outDir = join(ROOT, 'public/assets/fatalities', charId);
  mkdirSync(outDir, { recursive: true });
  for (let i = 0; i < spec.panels.length; i++) {
    const raw = join(ROOT, 'assets/raw/fatalities', charId, `${spec.id}-${i + 1}.png`);
    const final = join(outDir, `${spec.id}-${i + 1}.jpg`);
    if (!skip(raw, force)) {
      const prompt = `${PANEL_STYLE}\n${spec.panels[i]}`;
      console.log(`[${charId}] ${spec.id} panel ${i + 1}/${spec.panels.length} ...`);
      const buf = await geminiImage({
        apiKey: env.GEMINI_API_KEY,
        model: 'gemini-3-pro-image',
        prompt,
        referencePaths: [join(ROOT, spec.canonical)],
        aspectRatio: '16:9',
      });
      saveAsset(raw, buf, prompt);
    }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-vf', 'scale=1280:720', '-q:v', '3', final]);
    console.log(`  -> ${final}`);
  }
}

for (const id of only ? [only] : Object.keys(FATALITIES)) await gen(id);
console.log('done.');
