// THE prompt library — the battle-hardened image-prompt craft that used to be
// split (and diverging) between tools/gen-frames.mjs / gen-canonical.mjs (the
// canon roster) and src/ui/creatorModel.ts (creator fighters). Both front
// doors now compose prompts from here, so a lesson learned once (unkeyable
// green FX, idle flicker, feet-height copying, edge trailing…) improves every
// future generation. See the sprite-generation skill for the craft notes.
import { CHROMA_GREEN } from './coords.mjs';

/** the locked painted-cel art style (approved 2026-07-01) */
export const STYLE_ART =
  'Art style: hand-painted cel-shaded 2D anime fighter (modern Capcom / Arc System Works aesthetic). ' +
  'Bold clean line art, painterly cel shading, confident silhouette, slightly heroic proportions while keeping the person recognizable.';

/** the chroma-key background contract (every keyable asset) */
export const CHROMA_BG =
  `The background MUST be EXACTLY solid flat bright chroma-key green (#${CHROMA_GREEN}) — completely uniform green, ` +
  'no other background color is acceptable, no cast shadows, no floor, no text, no watermark, no border.';

/** full-body frame rules for sprite cells: identity, anatomy, framing, margin,
 *  chroma. The gen-frames FRAME_RULES + the creator's same-size clause. */
export const FRAME_RULES =
  'Same character as the reference image — identical face, hair, outfit, colors, proportions and art style. ' +
  'EXACTLY ONE person in the image: a single figure, drawn once, in the pose described — never a second copy of the character, never an opponent. ' +
  'Correct anatomy is CRITICAL: the character has exactly TWO arms and TWO legs, every limb clearly attached to the body — no extra limbs, no floating or disembodied body parts, no duplicated legs or feet. ' +
  'Full body visible, drawn at EXACTLY the same scale and camera distance as the reference image (do NOT zoom in or out, do NOT resize the character between frames), character centered, facing right. ' +
  'The ENTIRE figure and everything attached to it (limbs, props, hair, clothing, effects) must fit comfortably INSIDE the frame with clear green margin on every side — nothing may touch or be cropped by any frame edge (cut-off content leaves hard lines when the sprite is keyed). ' +
  CHROMA_BG;

/** one sprite cell: pose + per-character invariant (`always`) + the rules */
export const spritePrompt = (pose, always = '') =>
  `${pose}${always ? ` ${always}` : ''} ${FRAME_RULES} ${STYLE_ART}`;

/** the canonical-stance arm contract (§2.9 gate, now IN the prompt): every
 *  generated frame copies the canonical's stance, so an arm extended far
 *  forward/out/up kills the visual reach of every punch built from it. */
export const COMPACT_GUARD =
  'BOTH hands held in a COMPACT guard close to the body and chin, elbows tucked — ' +
  'NEVER an arm extended far forward, stretched out to the side, or raised high overhead ' +
  '(every animation frame is generated FROM this stance; an extended arm ruins the reach of every punch).';

/** photo → canonical fighter sheet (the pipeline CHAR_BASE language) */
export const canonicalFromPhoto = (flavor = '') =>
  'Transform the person in the reference photo into a full-body 2D fighting game character.\n' +
  'CRITICAL: preserve their real facial features, hairstyle, skin tone, body type and the outfit they are wearing in the photo — it must be recognizably the same person.\n' +
  `Pose: dynamic side-on martial-arts fighting stance facing right, knees bent, ${COMPACT_GUARD} Full body visible head to toe with a small margin, centered.\n` +
  `${flavor ? flavor + '\n' : ''}${CHROMA_BG}\n${STYLE_ART}`;

/** description → canonical (the creator's text-seeded variant; reference
 *  photos still ride along as image refs) */
export const canonicalFromDescription = (desc) =>
  `Full-body fighting-game character sheet of ${desc}. Neutral confident standing pose facing right, ${COMPACT_GUARD} ` +
  'If reference photos are provided, CRITICAL: preserve the real person\'s facial features, hairstyle, skin tone and body type — recognizably the same person. ' +
  `Full body head to toe with a small margin, centered. ${CHROMA_BG} ${STYLE_ART}`;

/** tight select-icon bust (must NOT inherit the full-body rules) */
export const portraitPrompt = (name, desc) =>
  `SQUARE straight-on HEADSHOT of ${name}${desc ? ` (${desc})` : ''} for a fighting-game character-select icon. ` +
  'A square 1:1 composition: ONLY the head and shoulders fill the frame — the face square-on toward the viewer (no three-quarter turn, no profile), ' +
  'direct gaze into the camera, neutral confident expression, head centered, ' +
  'top of the head near the top edge, shoulders cropped at the bottom edge. This is a close-up: do NOT show a full body, ' +
  `do NOT show the torso below the chest, hands, legs or feet, do NOT zoom out. ${STYLE_ART} ${CHROMA_BG}`;

/** beaten-and-bloodied defeated bust (post-match loser portrait) */
export const defeatPrompt = () =>
  'SQUARE HEADSHOT of the same person as the reference (preserve their real face, hairstyle, skin tone and outfit), ' +
  'but they have just LOST a brutal fight: face bruised and swollen, blackened puffy eye, split bleeding lip, a trickle of blood down the cheek, ' +
  'sweat-matted hair, dirt smudges, dazed defeated expression. A square 1:1 composition: head and shoulders only, ' +
  'the head clearly TILTED and lolling to ONE SIDE with the chin dropped toward one shoulder (beaten and dazed, NOT upright and square-on), ' +
  'a three-quarter view toward the viewer — never a full side profile — head centered filling the frame.\n' +
  `${CHROMA_BG} ${STYLE_ART}`;

/** IMAGE_SAFETY-safe fallback for defeatPrompt — gemini sometimes rejects the
 *  bloody variant (first seen: cat, 2026-07-04); retry with this instead of
 *  aborting the batch. */
export const defeatPromptSoft = () =>
  'SQUARE HEADSHOT of the same person as the reference (preserve their real face, hairstyle, skin tone and outfit), ' +
  'but they have just lost a cartoon martial-arts match: exhausted and dazed, comic swirl of dizziness, messy sweat-matted hair, ' +
  'a small bruise on the cheek, dirt smudges, defeated expression. No blood. A square 1:1 composition: head and shoulders only, ' +
  'the head clearly TILTED and lolling to ONE SIDE with the chin dropped toward one shoulder (dazed, NOT upright and square-on), ' +
  `a three-quarter view toward the viewer — never a full side profile — head centered filling the frame.\n${CHROMA_BG} ${STYLE_ART}`;

/** the 4 default fatality panel BEATS (the editable half of each cutscene
 *  panel prompt — the endpoint wraps each in the cinematic frame). One copy;
 *  creatorModel and the /creator/fatality endpoint both read it. */
export const fatalityBeats = (name, fatalityName) => {
  const N = (name || 'the fighter').toUpperCase();
  const F = fatalityName || 'the finisher';
  return [
    `${N} seizes the dazed, beaten opponent and begins the finishing move "${F}" — the opponent recoiling in terror`,
    `mid-execution of "${F}", ${N} unleashing the move at full force, the opponent's body contorting`,
    `the brutal peak of "${F}", dramatic impact, the opponent breaking apart, stylized gore`,
    `the aftermath — ${N} standing victorious over the destroyed opponent, a smouldering husk`,
  ];
};

/** the creator/auto-pilot DESIGN-DRAFT prompt — one copy for the vite
 *  endpoint (/__editor/creator/design) and headless scripts. Returns strict
 *  JSON (see the shape inside); pair with geminiText responseMimeType json. */
export const designPrompt = (name, description, lore) => `
You are the narrative designer and fighting-game kit designer for Martian Kombat, a weird, affectionate SF2/MK-style fighter about real Mars College / Bombay Beach people.

Task: turn the user's seed material into a playable, on-theme character draft. Preserve the person's specific jokes, contradictions, skills, places, and verbal texture. Do not genericize them into a trope.

INPUT
Name: ${name}
One-line description: ${description || '(none provided)'}
Lore/backstory notes: ${lore || '(none provided)'}

ENGINE-CONSTRAINTS
Return only buildable special moves. Supported archetypes and sensible controls:
- projectile: qcf+P, qcf+K, hcf+P
- sonic-boom: cbf+P, cbf+K
- short-range-flame: qcb+P, qcf+P
- lob-projectile: qcb+P, qcb+K
- lingering-cloud: qcf+K, qcb+K
- fuse-detonate: qcb+P, hcf+P
- stationary-trap: qcb+K, qcf+K
- slow-field: qcf+P, qcb+P
- pull-projectile: hcf+P, qcf+P
- multi-projectile: hcf+P, qcf+P
- anti-air-dp: dp+P, dp+K
- flash-kick: du+K, du+P
- advancing-rush: qcf+K, hcf+K
- horizontal-rush: bf+P, bf+K
- mash: mash+P, mash+K
- melee-rehit: qcf+P, PPP, KKK
- command-grab: hcb+P, 360+P
- heal-grab: hcb+P, 360+P
- grab-recoil: hcb+K, 360+K
- techable-throw: LPLK
- teleport: qcb+K, qcf+K
- mirror-teleport: qcb+K, qcf+K
- reversal: qcb+P, qcb+K
- reflector: qcb+P, hcb+P
- projectile-immune: PPP, qcf+P, qcf+K
- vault: qcf+K, hcf+K
- leaping-strike: dp+K, qcf+K
- yoga-float: qcb+P, qcb+K
Do NOT invent unbuilt mechanics like installs, stances, armor, rekka chains, air throws, or forward-forward specials.

STYLE RULES
- The kit should read as the actual person through concrete props, habits, phrases, and lore.
- Keep move names short enough for UI buttons: 1-4 words.
- Descriptions should be vivid pose/art prompts and gameplay flavor, not mechanical JSON.
- VO barks should be short enough for fighting-game audio, punchy, character-specific, and not mean-spirited unless the lore supports dry humor.
- Kiai lines are attack exertions. Hurt lines are clipped pain/annoyance. Victory lines are post-round one-liners.
- Stage prompt must describe a 21:9 gritty 16-bit pixel-art fight stage with a clear bottom-quarter walkable floor.
- Music prompt must describe a loopable instrumental stage battle theme.

ARCADE STORY WORLD (for the "arcade" block)
The arcade ladder is a journey: the fighter moves through the Off Grid world of Mars College, into the town of Bombay Beach, fighting the other Martians one by one, then RJ (Tao's first hench goon — the Sagat of this world), and finally TAO RUSPOLI himself — the end boss (the M. Bison analog): aristocrat-turned-desert-patron, co-founder of the Bombay Beach Biennale. Winning makes the character Champion of the Bombay Beach Biennale. The "motivation" is the SF2-style attract/intro blurb: why THIS person sets out on that journey. The "ending" is their post-credits scene after defeating Tao — specific, funny or heartfelt, like classic SF2 endings.

Return STRICT JSON with exactly this shape:
{
  "color": "hsl(H 55% 62%)",
  "archetype": "zoner|grappler|rushdown|all-rounder|trickster",
  "lore": {
    "tagline": "one sentence character-select hook",
    "personality": "one compact paragraph derived from the one-line description",
    "backstory": "one arcade backstory paragraph derived from the lore"
  },
  "winQuotes": ["exactly 3 short victory quotes"],
  "vo": {
    "kiai": ["exactly 6 attack barks"],
    "hurt": ["exactly 6 hurt barks"],
    "victory": ["exactly 4 voice victory barks"]
  },
  "specials": [
    { "id": "slug", "name": "Move Name", "controls": "qcf+P", "archetype": "projectile", "description": "visual/gameplay prompt", "voiceLine": "1-4 word call-out shouted when the move fires (lore-specific, not the move name)" }
  ],
  "specialPool": [
    { "id": "slug", "name": "Move Name", "controls": "qcb+K", "archetype": "teleport", "description": "visual/gameplay prompt", "voiceLine": "1-4 word call-out" }
  ],
  "physics": { "health": 1000, "walkSpeed": 3.3, "backSpeed": 3.4, "jumpVel": 18, "gravity": 0.9, "prejumpFrames": 4 },
  "fatality": { "id": "slug", "name": "Fatality Name", "input": "hcb+P" },
  "arcade": {
    "motivation": "2-3 sentence arcade-mode intro blurb: why this character journeys to challenge the Biennale",
    "ending": "2-4 sentence post-credits scene after they defeat Tao and become Champion of the Bombay Beach Biennale"
  },
  "stagePrompt": "stage art prompt",
  "musicPrompt": "music prompt"
}

Cardinality requirements:
- specials: exactly 4, each a different tactical role when possible.
- specialPool: exactly 8 alternate buildable specials.
- Use lowercase kebab-case ids.
- Make controls match the archetype.
- Return JSON only; no markdown, no commentary.`;
