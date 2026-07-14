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

// prompt craft now lives in tools/core/prompts.mjs (shared with the Character
// Creator). DEFEAT_SOFT is the automatic IMAGE_SAFETY fallback (first seen:
// cat, 2026-07-04) so the batch still gets a usable loser portrait.
import { STYLE_ART, canonicalFromPhoto, defeatPrompt, defeatPromptSoft } from './core/prompts.mjs';
const DEFEAT = defeatPrompt();
const DEFEAT_SOFT = defeatPromptSoft();

const FLAVOR = {
  catherine: `Character flavor: "The Chef de Guerre" — a warrior chef. She holds a wooden bo staff in a ready grip and wears a chef's apron over her outfit with a bandolier of kitchen knives across the chest. Her small scruffy dog Jazzper stands alert at her feet, also facing right.`,
  // glyphs must be AMBER, never green — green-on-green dies in the chroma key
  // (same lesson as Vincent's teal rune)
  flo: `Character flavor: "Kernel Panic" — a very tall, lanky, permanently annoyed German hacker. Keep his scowl. A thin smoking spliff hangs from the corner of his mouth, and faint glowing AMBER-ORANGE terminal-code glyphs float around one clenched fist (never green glyphs).`,
  freeman: `Character flavor: "The Still Point" — a serene warrior yogi. Loose comfortable clothes, mala beads around the neck or wrist, barefoot, calm centered half-smile, weight perfectly balanced in a meditative fighting stance.`,
  gene: `Character flavor: "Prompt Injection" — an AI-startup hacker. Keep his outfit from the photo; add subtle AR glasses with a faint HUD glow and glitchy digital pixel artifacts trailing from one open hand.`,
  kirby: `Character flavor: "Firebreather" — an extremely flexible, acrobatic fire-breathing yogi. Barefoot in fitted athletic yoga wear, lithe and limber, with a smug confident smile. She holds NO teacup and has NOTHING in her mouth (no cup, no match, no cigarette) — instead a faint orange ember heat-shimmer flickers at her lips. Poised, playful, dangerous.`,
  marzipan: `Character flavor: "Photosynthesizer" — a dreadlocked vegan biologist druid. Keep the long dreads; earth-tone clothes, barefoot, a small seed pouch on the belt, and thin green vines with tiny leaves curling around both forearms.`,
  // Wave 2 (2026-07-04). Effects stay AMBER/MAGENTA/GOLD/etc — NEVER green
  // (chroma lesson); wardrobe greens/teals are fine (chromakey, not despill).
  bodhi: `Character flavor: "The Alignment" — a Thai-bodywork master grappler. Keep the mustard-yellow parka with fur-trimmed hood worn open over the tan tank top, yellow shorts, maroon knit beanie and black high-top sneakers from the photo. Relaxed confident grin, strong open hands ready to grab, faint glowing warm golden-orange zodiac constellations — abstract star-dots joined by thin lines, strictly no letters or words — arcing behind one shoulder (never green).`,
  cat: `Character flavor: "Wet Paint" — a barefoot painter-dancer trickster. Keep her white sundress but splashed with vivid wet ORANGE, MAGENTA and BLUE paint (no green paint), long dark wavy hair in motion, barefoot with a dancer's poise mid-step, one hand flinging an arc of colorful paint droplets.`,
  chebel: `Character flavor: "The Spirit Deck" — a Brazilian mystic kick-fighter. Keep her brown crop top, oxblood red shorts, strap sandals and long dark hair mid-whip from the photo. One leg chambered for a high kick; her other hand fans out glowing golden tarot cards, a faint translucent PURPLE-GOLD jaguar spirit curling behind her (never green).`,
  earl: `Character flavor: "The Madd Wikkid" — a psychedelic sound wizard. Keep the enormous silver-grey afro, paisley patterned shirt, grey goatee and heart-shaped sunglasses from the photo. Visible AMBER-ORANGE sine-wave sound ripples radiate from one raised hand (never green), the afro caught mid-groove.`,
  // haidai removed 2026-07-08: never built as a fighter; their orphan
  // portraits were swept in Sprint 27 Phase 0 (an unscoped portrait pass
  // once resurrected one from stale raws). Re-add deliberately if haidai
  // becomes a fighter (flavor text lives in git history).
  // THE SUB-BOSS — RJ (Tao's first hench goon; the Sagat analog): Bombay
  // Beach ghost artist (World's Tallest Ghost), bird fosterer, BB-gun
  // plinker, excavator rider. FX ghost-WHITE/SILVER + AMBER, never green.
  rj: `Character flavor: "The Living Skeleton" — Bombay Beach's ghost artist and the Biennale's first hench goon, a weathered desert raconteur who talks like a dusty dictionary. Keep his real face from the photos and a full DARK BROWN beard (NOT red or ginger), shoulder-length dark brown hair under a woven STRAW COWBOY HAT, an off-white henley shirt under an open black waistcoat with sleeves pushed up, dark jeans, black work boots, a thin cord necklace and beaded bracelets. Bare empty hands raised in a relaxed boxing guard — NO weapon, NO gun of any kind, and absolutely NO ghosts, wraiths, spirits, or floating figures anywhere in the frame. Weathered, unhurried, deadpan and faintly amused. Clean solid chroma-green background, no props or extra objects.`,
  // THE END BOSS (arcade mode's M. Bison analog — see CLAUDE.md arcade note)
  tao: `Character flavor: "The Patron Prince" — the END BOSS: an Italian aristocrat turned desert art patron, imperious and effortlessly charming, a man in his early 50s — a lived-in, weathered-handsome face with creases at the eyes, grey streaking the temples of the wild swept-up hair and flecking the stubble (do NOT make him look young). Keep the ornate embroidered burgundy-maroon suit with pale filigree patterns, the matching wide-leg trousers, tan leather cowboy boots and round sunglasses from the photo. A commanding, theatrical fighting stance — weight back, chin high, both hands in a loose conductor's guard held CLOSE to the chest; faint GOLD filigree light traces curling between the fingers (never green).`,
  // Tubs (his robot) is deliberately NOT in the canonical — he's a separate
  // assist entity generated as his own chroma cell (Jazzper pattern), and
  // overlapping the fighter in the reference hurts frame-gen leg anatomy.
  rapha: `Character flavor: "The TabBastard" — a laconic toymaker puppet-fighter. Keep the black cap, black t-shirt, camo pants and bare feet from the photo, calm unbothered stare, hands up in a loose practical guard. A long glinting chain of aluminum can pop-tabs swings from his belt. He is ALONE in the frame — no robot, no other figure.`,
  vanessa: `Character flavor: "The High Priestess" — a Mars high-priestess summoner. Keep her pink-and-teal geometric patterned zip-front dress with the pink center stripe, black sock-sneakers and wild curly hair from the photo. Confident ceremonial stance; three small floating terracotta CLAY figurines (round-headed little idols) orbit one raised hand with a faint SILVER moonlight glow (never green).`,
  ygor: `Character flavor: "Suave" — a psychedelic projection artist. Keep the worn cap, yellow t-shirt with red leopard print, dark work pants and the vintage film camera on its neck strap from the photo. Playful grin; one open hand projects a beam of RAINBOW light with a small hand-drawn glowing MAGENTA-ORANGE cartoon creature leaping out of it (never green).`,
};

// optional extra face-shot reference merged into the canonical prompt for
// sharper facial fidelity (used when a clean head-on face photo exists)
const FACE = {
  kirby: 'assets/character-inspo/face/kirby.jpg',
  bodhi: 'assets/character-inspo/face/bodhi.jpg',
  cat: 'assets/character-inspo/face/cat.jpg',
  chebel: 'assets/character-inspo/face/chebel.jpg',
  earl: 'assets/character-inspo/face/earl.jpg',
  rapha: 'assets/character-inspo/face/rapha.jpg',
  tao: 'assets/character-inspo/face/tao-face.png',
  rj: 'assets/character-inspo/face/rj-face.png',
  vanessa: 'assets/character-inspo/face/vanessa.jpg',
  ygor: 'assets/character-inspo/face/ygor.jpg',
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

// --char <id> works for NEW fighters too: an id with an inspo photo but no
// FLAVOR entry gets a flavorless canonical (the studio's design draft is
// where flavor lives for creator-built fighters).
const canonicalIds = only ? [only] : Object.keys(FLAVOR);
for (const id of canonicalIds) {
  if (REUSE[id]) continue; // approved style-test canon already copied above
  const inspo = join(ROOT, `assets/character-inspo/${id}.jpg`);
  if (!existsSync(inspo)) { console.warn(`  canonical ${id} SKIPPED — no ${inspo}`); continue; }
  const out = join(CANON, `${id}.png`);
  if (skip(out, force)) continue;
  console.log(`canonical ${id} ...`);
  const prompt = canonicalFromPhoto(FLAVOR[id] ?? '');
  const faceRef = FACE[id] && existsSync(join(ROOT, FACE[id])) ? [join(ROOT, FACE[id])] : [];
  const buf = await geminiImage({
    apiKey: env.GEMINI_API_KEY,
    model: MODEL,
    prompt,
    referencePaths: [inspo, ...faceRef],
    aspectRatio: '3:4',
  });
  saveAsset(out, buf, prompt);
}

// head-and-shoulders portraits: upper-center crop of the canonical sheet
for (const id of [...Object.keys(REUSE), ...Object.keys(FLAVOR), ...(only ? [only] : [])]) {
  if (only && id !== only) continue; // --char scopes EVERY pass (an unscoped
  // portrait loop once resurrected a deleted orphan portrait from stale raws)
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
for (const id of new Set([...Object.keys(REUSE), ...Object.keys(FLAVOR), ...(only ? [only] : [])])) {
  if (only && id !== only) continue;
  const canonical = join(CANON, `${id}.png`);
  const inspo = join(ROOT, `assets/character-inspo/${id}.jpg`);
  if (!existsSync(canonical)) continue; // need the canon as the identity/style anchor
  const raw = join(KORAW, `${id}.png`);
  if (!skip(raw, force)) {
    console.log(`ko-portrait ${id} ...`);
    // the straight-on select portrait is the cleanest, keyed, canon-correct face
    // — use it as the PRIMARY reference so the KO matches the shipped portrait,
    // then the canonical for the outfit/style anchor.
    const portrait = join(PORTRAITS, `${id}.png`);
    const refs = [
      ...(existsSync(portrait) ? [portrait] : []),
      canonical,
      ...(existsSync(inspo) ? [inspo] : []),
    ];
    // log-and-skip on failure (pipeline rule: never abort the batch); retry
    // IMAGE_SAFETY rejections once with the bloodless fallback prompt
    let done = false;
    for (const variant of [DEFEAT, DEFEAT_SOFT]) {
      const prompt = `${variant}\n${STYLE_ART}`;
      try {
        const buf = await geminiImage({
          apiKey: env.GEMINI_API_KEY,
          model: MODEL,
          prompt,
          referencePaths: refs,
          aspectRatio: '1:1',
        });
        saveAsset(raw, buf, prompt);
        done = true;
        break;
      } catch (err) {
        console.warn(`  ko-portrait ${id} rejected (${variant === DEFEAT ? 'gory' : 'soft'} variant): ${String(err.message).slice(0, 120)}`);
      }
    }
    if (!done) console.warn(`  ko-portrait ${id} SKIPPED — rerun later or hand-make`);
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
