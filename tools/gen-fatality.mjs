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
  vincent: {
    id: 'blue-screen',
    canonical: 'assets/raw/style-tests/char-vincent-b-painted.png',
    panels: [
      `The man from the reference image (long dark hair, round dark sunglasses, long black cloak) tracing an enormous glowing teal arcane sigil circle in the air with one finger, while ${HUSK} stands frozen before him. Low dramatic angle.`,
      `The completed teal sigil circle FLASHING between them — ${HUSK} beginning to disintegrate, the top of its head and shoulders dissolving into rising teal wireframe mesh and code fragments. Side angle.`,
      `${HUSK} half-gone — dissolving row by row from the top into cascading teal wireframe lattice and glyph characters streaming upward, the man's palm extended calmly. Close angle on the dissolution.`,
      `The man turning away, cloak sweeping, sunglasses catching teal light, as the last few rows of the husk's legs rain upward into scattered teal pixels behind him. He does not look back.`,
    ],
  },
  catherine: {
    id: 'dinner-service',
    canonical: 'assets/raw/canonical/catherine.png',
    panels: [
      `The woman from the reference image (blonde ponytail, glasses, white apron, knife bandolier, bo staff) flinging a fan of gleaming kitchen knives that pin ${HUSK} in place mid-flight. Dynamic side angle, knives trailing streaks.`,
      `Extreme close-up of her hands in professional chef mode, tweezers delicately placing a sprig of garnish, plating with total concentration, knife bandolier visible, warm kitchen-pass lighting.`,
      `A beautiful fine-dining plate presented to camera: a tiny charred-husk arrangement plated like a tasting-menu course, sauce swoosh, micro-greens, elegant and absurd. She stands behind it with quiet pride, staff in hand.`,
      `A small scruffy terrier dog proudly dragging the entire plate off-screen by the rim, she wipes her hands on her apron looking satisfied, a single knife still quivering in the ground.`,
    ],
  },
  flo: {
    id: 'rm-rf',
    canonical: 'assets/raw/canonical/flo.png',
    panels: [
      `The man from the reference image (very tall and lanky, long blond hair, reddish beard, thin spliff in the corner of his mouth, black t-shirt, brown cargo pants) conjuring an ENORMOUS translucent amber holographic terminal window in the air with one raised hand, while ${HUSK} stands frozen before him. Low dramatic angle, amber glow washing over everything.`,
      `Extreme close-up of the man's hands typing FURIOUSLY on the floating amber holographic terminal, grey spliff smoke curling through the amber light, glowing glyphs reflected in his narrowed scowling eyes, the terminal cursor blazing at the end of a typed line of unreadable glyphs.`,
      `${HUSK} dissolving from the feet UPWARD into cascading waterfalls of amber directory-listing text — dense unreadable file-tree lines streaming down and scrolling away — while the man's finger hovers over one final glowing key. Side angle, high contrast.`,
      `The man turning away exhaling a long stream of spliff smoke, casually flicking the amber terminal window closed behind him with two fingers, as the very last scrolling amber text lines of the husk fade to nothing. He does not look back.`,
    ],
  },
  marzipan: {
    id: 'compost',
    canonical: 'assets/raw/canonical/marzipan.png',
    panels: [
      `The person from the reference image (grey dreadlocks under a red beanie, grey beard, glasses, plaid jacket over a tie-dye shirt, dark olive vines with yellow leaves around both forearms) raising both arms slowly like a conductor, as thick dark olive-brown woody vines erupt from the cracked ground and coil around the legs of ${HUSK}. Low dramatic angle.`,
      `The vines GENTLY drawing ${HUSK} down into soft dark tilled soil — the husk half-sunk, sinking peacefully, pink petals drifting through the air — while the person from the reference image watches with calm folded hands. Side angle, warm light.`,
      `The closed earth: a smooth fresh mound of dark soil where the husk once stood, and a single delicate desert flower sprouting from its center in a shaft of warm light, the person from the reference image kneeling beside it tenderly. Close angle.`,
      `The person from the reference image standing over the mound, watering the little desert flower with a small tin watering can, soft sparkling droplets falling onto the petals. THIS FINAL PANEL IS CALM: soft warm radial light rays instead of aggressive speed lines, NO creatures, NO monsters, NO vines in the air, NO fighting — just the person, the watering can, and the flower. Total serenity. Peaceful wide angle.`,
    ],
  },
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
