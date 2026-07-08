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

/** photo → canonical fighter sheet (the pipeline CHAR_BASE language) */
export const canonicalFromPhoto = (flavor = '') =>
  'Transform the person in the reference photo into a full-body 2D fighting game character.\n' +
  'CRITICAL: preserve their real facial features, hairstyle, skin tone, body type and the outfit they are wearing in the photo — it must be recognizably the same person.\n' +
  'Pose: dynamic side-on martial-arts fighting stance facing right, knees bent, hands up ready to fight, full body visible head to toe with a small margin, centered.\n' +
  `${flavor ? flavor + '\n' : ''}${CHROMA_BG}\n${STYLE_ART}`;

/** description → canonical (the creator's text-seeded variant; reference
 *  photos still ride along as image refs) */
export const canonicalFromDescription = (desc) =>
  `Full-body fighting-game character sheet of ${desc}. Neutral confident standing pose, arms relaxed, facing right. ` +
  'If reference photos are provided, CRITICAL: preserve the real person\'s facial features, hairstyle, skin tone and body type — recognizably the same person. ' +
  `Full body head to toe with a small margin, centered. ${CHROMA_BG} ${STYLE_ART}`;

/** tight select-icon bust (must NOT inherit the full-body rules) */
export const portraitPrompt = (name, desc) =>
  `Tight head-and-shoulders BUST portrait of ${name}${desc ? ` (${desc})` : ''} for a fighting-game character-select icon. ` +
  'ONLY the head and shoulders fill the frame — face straight-on toward the viewer, direct gaze, neutral confident expression, ' +
  'top of the head near the top edge, shoulders cropped at the bottom edge. This is a close-up: do NOT show a full body, ' +
  `do NOT show the torso below the chest, hands, legs or feet, do NOT zoom out. ${STYLE_ART} ${CHROMA_BG}`;

/** beaten-and-bloodied defeated bust (post-match loser portrait) */
export const defeatPrompt = () =>
  'Head-and-shoulders BUST portrait of the same person as the reference (preserve their real face, hairstyle, skin tone and outfit), ' +
  'but they have just LOST a brutal fight: face bruised and swollen, blackened puffy eye, split bleeding lip, a trickle of blood down the cheek, ' +
  'sweat-matted hair, dirt smudges, dazed and downcast defeated expression with the head tilted slightly down. Head and shoulders only, centered, filling the frame.\n' +
  `${CHROMA_BG} ${STYLE_ART}`;

/** IMAGE_SAFETY-safe fallback for defeatPrompt — gemini sometimes rejects the
 *  bloody variant (first seen: cat, 2026-07-04); retry with this instead of
 *  aborting the batch. */
export const defeatPromptSoft = () =>
  'Head-and-shoulders BUST portrait of the same person as the reference (preserve their real face, hairstyle, skin tone and outfit), ' +
  'but they have just lost a cartoon martial-arts match: exhausted and dazed, comic swirl of dizziness, messy sweat-matted hair, ' +
  'a small bruise on the cheek, dirt smudges, defeated downcast expression with the head tilted slightly down. No blood. ' +
  `Head and shoulders only, centered, filling the frame.\n${CHROMA_BG} ${STYLE_ART}`;

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
