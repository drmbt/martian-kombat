// Fatality cutscene panels: full-bleed 16:9 anime action panels generated
// from the character's canonical sheet. Output goes straight to
// public/assets/fatalities/<char>/<fatality-id>-<n>.jpg (committed).
// Idempotent; --force regens.  node tools/gen-fatality.mjs [--char yulia]

import { join } from 'node:path';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ROOT, loadEnv, geminiImage, saveAsset, skip, pool, concurrencyArg } from './lib.mjs';

const env = loadEnv();
const force = process.argv.includes('--force');
const only = process.argv.includes('--char') ? process.argv[process.argv.indexOf('--char') + 1] : null;
// panels are independent (own prompt + ref), so fan them out
const CONCURRENCY = concurrencyArg(4);

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
  freeman: {
    id: 'ego-death',
    canonical: 'assets/raw/canonical/freeman.png',
    panels: [
      `The man from the reference image (bearded, shoulder-length brown hair, cream linen t-shirt, mala prayer beads, barefoot) settling into a serene cross-legged lotus meditation pose, eyes closed, both open palms pressed together at his chest, a blinding WHITE-GOLD halo of chi light swelling around his whole body, while ${HUSK} stands frozen before him. Low dramatic angle, warm white-gold light washing over everything.`,
      `Extreme close-up of the man's eyes SNAPPING open glowing pure white-gold, both open palms thrust forward pressed together, an overwhelming radial bloom of white-gold chi light erupting outward toward the viewer, his expression utterly serene. Maximum contrast, radial white-gold light streaks.`,
      `${HUSK} coming apart from within into a rising storm of luminous WHITE-GOLD lotus petals and drifting motes of light — the charred figure dissolving upward into golden petals streaming into the air — while the man sits calmly with palms open, perfectly still. Side angle, high contrast.`,
      `Only a faint glowing white-gold OUTLINE of the defeated figure remains, frozen seated in a cross-legged lotus pose, as the very last white-gold petals drift away into darkness around it. The man from the reference image sits beside it in serene meditation, eyes closed, a peaceful half-smile. Calm, quiet, final.`,
    ],
  },
};

async function genPanel(charId, spec, i) {
  const raw = join(ROOT, 'assets/raw/fatalities', charId, `${spec.id}-${i + 1}.png`);
  const final = join(ROOT, 'public/assets/fatalities', charId, `${spec.id}-${i + 1}.jpg`);
  try {
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
  } catch (e) {
    console.error(`  FAILED ${charId} ${spec.id} panel ${i + 1}: ${e.message}`);
  }
}

// flatten every panel of every requested fatality into one pooled job list
const jobs = [];
for (const charId of only ? [only] : Object.keys(FATALITIES)) {
  const spec = FATALITIES[charId];
  if (!spec) continue;
  mkdirSync(join(ROOT, 'public/assets/fatalities', charId), { recursive: true });
  for (let i = 0; i < spec.panels.length; i++) jobs.push({ charId, spec, i });
}
await pool(jobs, CONCURRENCY, ({ charId, spec, i }) => genPanel(charId, spec, i));
console.log('done.');
