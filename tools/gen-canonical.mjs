// Generate canonical painted-cel character sheets (locked style, tools/style.md)
// for the whole roster into assets/raw/canonical/, then crop head-and-shoulders
// portraits into public/assets/portraits/. Also generates a beaten-and-bloodied
// "defeated" bust per character (public/assets/portraits/<id>-ko.png) for the
// post-match win-quote screen. Vincent & Yulia reuse their approved style-test
// canon. Requires ffmpeg.  node tools/gen-canonical.mjs [--char <id>] [--force]

import { join } from 'node:path';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ROOT, loadEnv, geminiImage, saveAsset, skip } from './lib.mjs';

const env = loadEnv();
const force = process.argv.includes('--force');
const only = process.argv.includes('--char')
  ? process.argv[process.argv.indexOf('--char') + 1]
  : null;
const MODEL = 'gemini-3-pro-image';
const CANON = join(ROOT, 'assets/raw/canonical');
const PORTRAITS = join(ROOT, 'public/assets/portraits');

const CHAR_BASE = `Transform the person in the reference photo into a full-body 2D fighting game character.
CRITICAL: preserve their real facial features, hairstyle, skin tone, body type and the outfit they are wearing in the photo — it must be recognizably the same person.
Pose: dynamic side-on martial-arts fighting stance facing right, knees bent, hands up ready to fight, full body visible head to toe with a small margin, centered.
Background: solid flat chroma-key green (#00B140), completely uniform, no shadows cast on the background, no floor, no text, no watermark, no border.`;

const STYLE = `Art style: hand-painted cel-shaded 2D anime fighter (modern Capcom / Arc System Works aesthetic). Bold clean line art, painterly cel shading, confident silhouette, slightly heroic proportions while keeping the person recognizable.`;

// Defeated bust for the post-match win-quote screen (SFII-style loser portrait).
const DEFEAT = `Head-and-shoulders BUST portrait of the same person as the reference (preserve their real face, hairstyle, skin tone and outfit), but they have just LOST a brutal fight: face bruised and swollen, blackened puffy eye, split bleeding lip, a trickle of blood down the cheek, sweat-matted hair, dirt smudges, dazed and downcast defeated expression with the head tilted slightly down. Head and shoulders only, centered, filling the frame.
Background: solid flat chroma-key green (#00B140), completely uniform, no shadows on the background, no floor, no text, no watermark, no border.`;

const FLAVOR = {
  catherine: `Character flavor: "The Chef de Guerre" — a warrior chef. She holds a wooden bo staff in a ready grip and wears a chef's apron over her outfit with a bandolier of kitchen knives across the chest. Her small scruffy dog Jazzper stands alert at her feet, also facing right.`,
  // glyphs must be AMBER, never green — green-on-green dies in the chroma key
  // (same lesson as Vincent's teal rune)
  flo: `Character flavor: "Kernel Panic" — a very tall, lanky, permanently annoyed German hacker. Keep his scowl. A thin smoking spliff hangs from the corner of his mouth, and faint glowing AMBER-ORANGE terminal-code glyphs float around one clenched fist (never green glyphs).`,
  freeman: `Character flavor: "The Still Point" — a serene warrior yogi. Loose comfortable clothes, mala beads around the neck or wrist, barefoot, calm centered half-smile, weight perfectly balanced in a meditative fighting stance.`,
  gene: `Character flavor: "Prompt Injection" — an AI-startup hacker. Keep his outfit from the photo; add subtle AR glasses with a faint HUD glow and glitchy digital pixel artifacts trailing from one open hand.`,
  kirby: `Character flavor: "Spill the Tea" — a flexible fire-breathing yogi gossip. One hand balances a steaming teacup effortlessly; a faint ember glow flickers at the lips. Relaxed, smug, dangerous.`,
  marzipan: `Character flavor: "Photosynthesizer" — a dreadlocked vegan biologist druid. Keep the long dreads; earth-tone clothes, barefoot, a small seed pouch on the belt, and thin green vines with tiny leaves curling around both forearms.`,
};

// approved style-test canon doubles as canonical for the first two fighters
const REUSE = {
  vincent: 'assets/raw/style-tests/char-vincent-b-painted.png',
  yulia: 'assets/raw/style-tests/char-yulia-b-painted.png',
};

mkdirSync(CANON, { recursive: true });
mkdirSync(PORTRAITS, { recursive: true });

for (const [id, src] of Object.entries(REUSE)) {
  const dst = join(CANON, `${id}.png`);
  // style-test raws are gitignored and may be gone on a fresh checkout
  if (!existsSync(dst) && existsSync(join(ROOT, src))) copyFileSync(join(ROOT, src), dst);
}

for (const [id, flavor] of Object.entries(FLAVOR)) {
  if (only && id !== only) continue;
  const out = join(CANON, `${id}.png`);
  if (skip(out, force)) continue;
  console.log(`canonical ${id} ...`);
  const prompt = `${CHAR_BASE}\n${STYLE}\n${flavor}`;
  const buf = await geminiImage({
    apiKey: env.GEMINI_API_KEY,
    model: MODEL,
    prompt,
    referencePaths: [join(ROOT, `assets/character-inspo/${id}.jpg`)],
    aspectRatio: '3:4',
  });
  saveAsset(out, buf, prompt);
}

// head-and-shoulders portraits: upper-center crop of the canonical sheet
for (const id of [...Object.keys(REUSE), ...Object.keys(FLAVOR)]) {
  const src = join(CANON, `${id}.png`);
  const out = join(PORTRAITS, `${id}.png`);
  if (!existsSync(src) || skip(out, force)) continue;
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', src,
    '-vf', 'chromakey=0x00B140:0.15:0.06,crop=in_w*0.46:in_w*0.46:in_w*0.27:in_h*0.02,scale=160:160',
    '-frames:v', '1', out,
  ]);
  console.log(`  portrait ${id}`);
}

// beaten-and-bloodied defeated busts -> public/assets/portraits/<id>-ko.png
const KORAW = join(CANON, 'ko'); // raw busts (gitignored with the rest of assets/raw)
mkdirSync(KORAW, { recursive: true });
for (const id of [...Object.keys(REUSE), ...Object.keys(FLAVOR)]) {
  if (only && id !== only) continue;
  const canonical = join(CANON, `${id}.png`);
  const inspo = join(ROOT, `assets/character-inspo/${id}.jpg`);
  if (!existsSync(canonical)) continue; // need the canon as the identity/style anchor
  const raw = join(KORAW, `${id}.png`);
  if (!skip(raw, force)) {
    console.log(`ko-portrait ${id} ...`);
    const prompt = `${DEFEAT}\n${STYLE}`;
    const refs = [canonical, ...(existsSync(inspo) ? [inspo] : [])];
    const buf = await geminiImage({
      apiKey: env.GEMINI_API_KEY,
      model: MODEL,
      prompt,
      referencePaths: refs,
      aspectRatio: '1:1',
    });
    saveAsset(raw, buf, prompt);
  }
  const out = join(PORTRAITS, `${id}-ko.png`);
  if (existsSync(raw) && !skip(out, force)) {
    // bust is already square-ish and centered — just key the green and scale
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-i', raw,
      '-vf', 'chromakey=0x00B140:0.15:0.06,scale=160:160',
      '-frames:v', '1', out,
    ]);
    console.log(`  ko-portrait ${id}`);
  }
}
console.log('done.');
