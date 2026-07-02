// Sprint 2 style test: 3 art-style candidates × 2 characters + 4 stage tests.
// Output goes to assets/raw/style-tests/ (gitignored). The approved style gets
// locked into tools/style.md and drives the real pipeline.
//
//   node tools/gen-style-test.mjs [--force] [--only characters|stages]

import { join } from 'node:path';
import { ROOT, loadEnv, geminiImage, openaiImage, saveAsset, skip } from './lib.mjs';

const env = loadEnv();
const OUT = join(ROOT, 'assets/raw/style-tests');
const force = process.argv.includes('--force');
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

const CHAR_MODEL = 'gemini-3-pro-image';

// ---------- character style candidates ----------

const CHAR_BASE = `Transform the person in the reference photo into a full-body 2D fighting game character.
CRITICAL: preserve their real facial features, hairstyle, skin tone, body type and the outfit they are wearing in the photo — it must be recognizably the same person.
Pose: dynamic side-on martial-arts fighting stance facing right, knees bent, hands up ready to fight, full body visible head to toe with a small margin, centered.
Background: solid flat chroma-key green (#00B140), completely uniform, no shadows cast on the background, no floor, no text, no watermark, no border.`;

const STYLES = {
  'a-digitized': `Art style: 1990s digitized-actor arcade fighter (classic Mortal Kombat aesthetic). Photorealistic digitized-sprite look, slight grain, hard dramatic rim lighting, deep saturated colors, gritty and cinematic.`,
  'b-painted': `Art style: hand-painted cel-shaded 2D anime fighter (modern Capcom / Arc System Works aesthetic). Bold clean line art, painterly cel shading, confident silhouette, slightly heroic proportions while keeping the person recognizable.`,
  'c-pixel': `Art style: detailed 90s arcade pixel-art sprite (CPS-2 / Neo Geo era). Chunky visible pixels, limited vibrant palette, dark outline, crisp dithered shading — rendered large and readable.`,
};

const CHARACTER_FLAVOR = {
  vincent: `Character flavor: "The Cloakwright" — a tai-chi digital wizard. Add a long flowing black cloak over his black outfit and faint teal glowing arcane glyphs orbiting one open palm. Keep his round sunglasses and long dark hair.`,
  yulia: `Character flavor: "Volga Fury" — a tall Russian grappler-yogi. Keep her green paisley bandana over the lower face, tattoos, striped crop top and cream work pants; add a faint smoldering red rage aura around her clenched fists.`,
};

// ---------- stage tests ----------

const STAGE_STYLE = `Painted 2D fighting game stage background, cinematic wide shot, rich color and light, layered composition with parallax-friendly depth (distinct far / mid / near layers). The bottom quarter is a clean, flat, unobstructed ground plane where two fighters will stand — no objects, no people in that strip. No text, no watermark, no UI.`;

const STAGES = [
  {
    id: 'salton-shoreline',
    api: 'openai',
    prompt: `${STAGE_STYLE}
Scene: the Salton Sea shoreline at Bombay Beach, California at burning sunset. Cracked salt-crusted playa beach, a rusted swing set standing in the shallow glassy water, skeletal dead palm, decaying wooden ruins half-sunk in sand, mountains hazy across the water, sun low and molten on the horizon, a scatter of pelicans. Melancholy, beautiful, post-apocalyptic-Americana.`,
  },
  {
    id: 'badlands-canyon',
    api: 'gemini',
    ref: 'assets/stage-inspo/IMG_7866.JPG',
    prompt: `${STAGE_STYLE}
Recreate the location in the reference photo as a stage: golden-hour desert badlands canyon near the Salton Sea — sculpted eroded sandstone walls raked with warm sunlight and long shadows, sandy wash floor with scrubby desert bushes, deep blue sky. Keep the dramatic light/shadow diagonal from the photo.`,
  },
  {
    id: 'range-night-stage',
    api: 'gemini',
    ref: 'assets/stage-inspo/IMG_8157.JPG',
    prompt: `${STAGE_STYLE}
Recreate the location in the reference photo as a stage: "The Range" — a ramshackle desert music venue at night in Slab City. Plywood stage with a hand-painted sign reading "THE RANGE", string of glowing multicolored bucket lights overhead, weathered amps and instruments and a vintage silver trailer at the edges, deep black desert night sky. Warm scrappy festival glow. Leave the front of the stage clear for the fighters.`,
  },
  {
    id: 'rocket-yard',
    api: 'gemini',
    ref: 'assets/stage-inspo/IMG_8072.JPG',
    prompt: `${STAGE_STYLE}
Recreate the moment in the reference photo as a stage: a Bombay Beach salvage yard at dusk, junked cars and beached boats silhouetted, festival lights and a glowing roadside sign, purple-orange gradient sky dominated by a spectacular rocket launch plume arcing across it (like a SpaceX twilight launch), one bright star. Surreal desert-space vibes.`,
  },
];

// ---------- run ----------

async function characters() {
  for (const who of ['vincent', 'yulia']) {
    for (const [styleId, styleText] of Object.entries(STYLES)) {
      const out = join(OUT, `char-${who}-${styleId}.png`);
      if (skip(out, force)) continue;
      const prompt = `${CHAR_BASE}\n${STYLES[styleId] ? styleText : ''}\n${CHARACTER_FLAVOR[who]}`;
      console.log(`gen ${who} / ${styleId} ...`);
      const buf = await geminiImage({
        apiKey: env.GEMINI_API_KEY,
        model: CHAR_MODEL,
        prompt,
        referencePaths: [join(ROOT, `assets/character-inspo/${who}.jpg`)],
        aspectRatio: '3:4',
      });
      saveAsset(out, buf, prompt);
    }
  }
}

async function stages() {
  for (const st of STAGES) {
    const out = join(OUT, `stage-${st.id}.png`);
    if (skip(out, force)) continue;
    console.log(`gen stage ${st.id} (${st.api}) ...`);
    const buf =
      st.api === 'openai'
        ? await openaiImage({ apiKey: env.OPENAI_API_KEY, prompt: st.prompt, size: '1536x1024' })
        : await geminiImage({
            apiKey: env.GEMINI_API_KEY,
            model: CHAR_MODEL,
            prompt: st.prompt,
            referencePaths: st.ref ? [join(ROOT, st.ref)] : [],
            aspectRatio: '16:9',
          });
    saveAsset(out, buf, st.prompt);
  }
}

if (only !== 'stages') await characters();
if (only !== 'characters') await stages();
console.log('done.');
