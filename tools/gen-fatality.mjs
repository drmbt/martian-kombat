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
    id: 'burn-one',
    canonical: 'assets/raw/canonical/flo.png',
    panels: [
      `The man from the reference image (very tall and lanky, long blond hair, reddish beard, black t-shirt, brown cargo pants) flicking open a battered brass lighter with one hand, the flame catching, while ${HUSK} stands frozen before him. Low dramatic angle, the tiny flame the only warm light source, his scowling face underlit.`,
      `${HUSK} fully ABLAZE in a roaring column of orange fire, collapsing in on itself into a neat cone of fine grey ash, while the man watches unimpressed with his arms crossed, firelight flickering across his face. Side angle, embers spiraling upward.`,
      `Extreme close-up of the man's hands expertly rolling the fine grey ash into a giant cigarette with king-size rolling paper, tongue at the corner of his mouth in concentration, the last embers of the ash pile glowing between his fingers. Warm low light.`,
      `The man leaning back taking a long satisfied drag of the enormous ash cigarette, exhaling a thick mushroom cloud of grey smoke that curls into a skull shape above him, eyes closed in bliss. He does not look back at the small scorch mark where the husk stood.`,
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
  kirby: {
    id: 'hot-yoga',
    canonical: 'assets/raw/canonical/kirby.png',
    panels: [
      `The woman from the reference image (long wavy dark-brown hair, athletic flexible build, colorful splatter-print top, barefoot yoga wear) dropping into an impossibly deep flexible backbend lunge, chest swelling as she draws an ENORMOUS breath, bright orange embers and heat-shimmer gathering at her lips, while ${HUSK} stands frozen before her. Low dramatic angle, orange firelight beginning to wash over everything.`,
      `Extreme close-up of the woman's face as she UNLEASHES a colossal torrent of roaring orange-and-red fire from her mouth, cheeks full, a raging inferno erupting forward and engulfing the frame, ${HUSK} a black silhouette swallowed in the blaze. Maximum contrast, radial firelight streaks.`,
      `The woman from the reference image cartwheeling gracefully THROUGH a swirling firestorm, body inverted mid-handspring, legs whipping overhead, as ${HUSK} curls and blackens, coming apart into a rising vortex of orange cinders and ash around her. Dynamic dutch angle, embers everywhere.`,
      `The woman from the reference image landing serene in a one-handed bridge pose amid smoldering embers, blowing a single wisp of smoke off a fingertip with a smug smile, as the last cinders of the husk scatter into the dark behind her. She does not look back. Warm dying-ember glow, quiet and final.`,
    ],
  },
  cat: {
    id: 'still-life',
    canonical: 'assets/raw/canonical/cat.png',
    panels: [
      `The woman from the reference image (long dark wavy hair, white sundress splashed with vivid orange, magenta and blue paint, barefoot) flinging a huge sweeping arc of living orange-magenta-blue paint from her fingertips that splashes across and engulfs ${HUSK} frozen before her. Dynamic side angle, ribbons of wet paint trailing in streaks, no green paint.`,
      `${HUSK} pinned spread-eagle and dripping against an enormous blank white canvas, thick wet orange, magenta and blue paint running down it, while the woman from the reference image steps up brandishing a loaded paintbrush and a wooden palette, one eye narrowed appraising her subject. Low dramatic angle.`,
      `Extreme close-up of the woman painting FURIOUSLY, brush a blur, as ${HUSK} dissolves brushstroke by brushstroke into swirling wet smears of orange, magenta and blue paint — half charred figure, half melting portrait — streaming off the canvas. Maximum contrast, radial paint-streak motion lines.`,
      `The woman from the reference image standing beside a finished framed portrait on a wooden easel — a deliberately unflattering, lumpy caricature of the defeated fighter in bright paint — signing the bottom corner with a flourish and blowing a kiss to camera, while only a small paint-splattered scorch mark remains where the husk stood. She does not look at it. Bright, smug, final.`,
    ],
  },
  chebel: {
    id: 'the-reversed',
    canonical: 'assets/raw/canonical/chebel.png',
    panels: [
      `The woman from the reference image (long dark wavy hair, brown crop top, oxblood-red shorts, strap sandals) sliding a single glowing tarot card off her hip deck and holding it up between two fingers, its face blazing with AMBER-GOLD and VIOLET light, while ${HUSK} stands frozen before her. Low dramatic angle, warm gold and violet light washing over everything, never any green.`,
      `The card FLARING as an enormous translucent AMBER-GOLD and VIOLET animal-spirit — a great leaping cat-like apparition — erupts from it and lunges at ${HUSK}, spectral claws raking through the charred figure in a shower of gold sparks. Dynamic diagonal angle, violet and gold spirit-light streaking outward.`,
      `Extreme close-up as the spirit-cat's jaws clamp over ${HUSK} and wrench it upside-down, the burnt figure inverted and flailing while the tarot card hovers spinning, now shown REVERSED — a huge AMBER-GOLD constellation flare radiating behind it. Maximum contrast, radial gold star-streak motion lines, her expression calm and certain.`,
      `The woman lowering the card and sliding it calmly back into her hip deck, taking a slow sip from a small glowing teacup, while the defeated fighter hangs suspended upside-down in a fading violet spirit-halo behind her, then drops as a charred heap. She does not look back. Calm, warm amber-and-violet light fading, final.`,
    ],
  },
  ygor: {
    id: 'final-render',
    canonical: 'assets/raw/canonical/ygor.png',
    panels: [
      `The man from the reference image (worn cap over shaggy hair, yellow tee with red leopard-print, dark work pants, vintage camera on a neck strap) raising both hands as they blaze with CYAN and MAGENTA projector-light, casting a wide beam that pins ${HUSK} in a harsh flickering projection. Low dramatic angle, cyan and magenta light washing over everything, never any green.`,
      `A swarm of glowing hand-drawn CYAN and MAGENTA cartoon creatures pouring out of his projected beam and swarming over ${HUSK}, biting and dragging at the charred figure, the whole scene strobing like a glitching projector. Dynamic side angle, magenta scanlines and cyan light-streaks slashing across the frame.`,
      `Extreme close-up as the projection OVERLOADS — ${HUSK} pixel-sorting apart into cascading CYAN and MAGENTA scanline fragments and drawn-creature shards, dissolving row by row into pure projected light. Maximum contrast, radial magenta motion streaks, his face lit cyan and unbothered.`,
      `The man tipping his cap and exhaling a slow breath of colored smoke as the last CYAN and MAGENTA fragments of the husk scatter and wink out behind him, a tiny drawn creature hopping onto his shoulder. He does not look back. Calm, cyan-and-magenta light fading, final.`,
    ],
  },
  bodhi: {
    id: 'full-realignment',
    canonical: 'assets/raw/canonical/bodhi.png',
    panels: [
      `The man from the reference image (bearded, maroon knit beanie, open mustard-yellow fur-hooded parka over a tan tank top, yellow shorts, black high-top sneakers) calmly rolling his shoulders and spreading two strong open hands, cracking his knuckles, as warm GOLD zodiac constellations of star-dots and thin lines blaze into being in a ring around him, while ${HUSK} stands frozen before him. Low dramatic angle, warm gold starlight washing over everything, never any green.`,
      `The man from the reference image having seized ${HUSK} in a full-body bear-hug from behind and bending it backward into an impossibly deep spinal backbend, the charred figure's spine arching far past the breaking point, bursts of GOLD sparks popping at every cracking joint, his own face serene and focused. Dynamic side angle, embers and gold star-motes spiraling upward.`,
      `Extreme close-up as the man presses one final calm adjustment with both palms, folding ${HUSK} into an impossible knotted pretzel of charred limbs — the burnt figure contorted into a neat geometric knot — while an enormous GOLD constellation flare radiates outward from his hands. Maximum contrast, radial gold star-streak motion lines, his expression utterly peaceful.`,
      `The man from the reference image wiping his palms together and studying a small glowing circular astrologer's ephemeris wheel of amber zodiac constellations and star-symbols hovering above one open hand — a delicate wheel of stars, NOT a coin, NO text, NO letters, NO words anywhere — nodding once with quiet professional satisfaction, while the defeated fighter is left as a neatly folded impossible knot of char on the cracked desert ground beside him. He does not look back. Calm, warm amber starlight fading, final.`,
    ],
  },
  rapha: {
    id: 'scrap-compactor',
    canonical: 'assets/raw/canonical/rapha.png',
    panels: [
      `The man from the reference image (black cap, dusty black t-shirt, faded camo cargo pants, barefoot, trimmed dark beard, a chain of shiny aluminium pop-tabs on his belt) calmly snapping his fingers and pointing down, while a squat yellow plastic storage-tub robot with a single mechanical claw arm scuttles in and clamps its claw around ${HUSK}, hoisting the charred figure off the ground. Low dramatic angle, cold industrial light, his expression bored and unbothered.`,
      `The squat yellow one-clawed tub robot raising ${HUSK} high overhead in its clamped claw, the hinged lid of a big yellow storage tub flipping open on the ground below, while the man from the reference image watches with his arms crossed, completely calm, a single fresh pop-tab held ready between two fingers. Dynamic side angle.`,
      `The yellow robot dropping ${HUSK} down into the yellow storage tub and the lid SLAMMING shut, the whole tub violently rattling and jerking with a muffled crunch, bolts and springs popping loose and flying out the seams, while the man from the reference image stands unbothered with hands in his pockets. Maximum contrast, motion-streak shake lines, scattered tin debris.`,
      `The man from the reference image crouched calmly threading a single shiny new pop-tab onto the chain on his belt, the squat yellow one-clawed robot idling contentedly beside him, while the now-still yellow tub sits quiet with one small charred scrap poking out of the seam. He does not look at it. Cold quiet light, final.`,
    ],
  },
  vanessa: {
    id: 'fired-and-glazed',
    canonical: 'assets/raw/canonical/vanessa.png',
    panels: [
      `The woman from the reference image (pink-and-teal geometric zip dress with a pink center stripe, wild curly auburn hair) raising both hands in a slow ceremonial gesture, a faint moonlit-silver light gathering at her palms (silver, never green), while a generic defeated opponent fighter stands frozen rigid before her — the opponent's skin beginning to turn pale matte grey like wet unfired clay. Low dramatic angle, ceremonial candle-light.`,
      `The opponent now fully transformed into a pale grey UNFIRED CLAY statue (greenware) of a frozen fighter, rigid and lifeless, as a glossy ceramic GLAZE washes down over the clay from above in a shining wet sheet, the woman from the reference image extending one hand calmly. Side angle.`,
      `The glazed clay statue of the opponent inside a glowing kiln-orange furnace heat, its hardening ceramic surface laced with spreading hairline CRACKS, steam and heat-shimmer rising, the woman from the reference image watching serenely with a soft moonlit-silver glow around her. Close angle on the cracking fired ceramic.`,
      `The fired ceramic statue SHATTERING into scattered pottery shards across a kiln floor, the woman from the reference image placing a small pale clay round-headed Little Martian idol figurine atop the pile of broken shards like an offering, a soft moonbeam falling from above. She does not look back. Final, reverent.`,
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
