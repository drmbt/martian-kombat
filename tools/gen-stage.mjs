// Ultra-wide (21:9) fighting stages from the inspo folders in
// assets/stage-inspo/. Every image in a folder is passed as a reference and
// the prompt asks for one composite location. Raw gen goes to
// assets/raw/stages/ (gitignored); the packed 1680x720 jpg lands in
// public/assets/backgrounds/stages/<id>.jpg (committed).
// Idempotent; --force regens, --stage <id> for one stage.
//   node tools/gen-stage.mjs [--stage the-range] [--force]

import { join, extname } from 'node:path';
import { readdirSync, statSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ROOT, loadEnv, geminiImage, saveAsset, skip } from './lib.mjs';

const env = loadEnv();
const force = process.argv.includes('--force');
const only = process.argv.includes('--stage') ? process.argv[process.argv.indexOf('--stage') + 1] : null;

const INSPO = join(ROOT, 'assets/stage-inspo');
const REF_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']); // gemini-accepted formats

// Locked stage style (tools/style.md) + the ultra-wide/parallax contract.
const STAGE_STYLE = `Painted 2D fighting game stage background, ultra-wide cinematic 21:9 shot, hand-painted cel-shaded style (modern Capcom / Arc System Works aesthetic), rich color and light, layered composition with parallax-friendly depth (distinct far / mid / near layers). The bottom quarter of the image is a clean, flat, unobstructed ground plane running the FULL width, where two fighters will stand — no objects, no people in that strip. No people anywhere in the scene. No readable text unless specified, no watermark, no UI, no borders.`;

const COMPOSITE = `Use ALL attached reference photos of this real location: composite their recognizable landmarks and features into ONE coherent wide scene, keeping the palette and mood of the references while translating everything into the painted game-art style.`;

// Scene lines per stage id (folder name, lowercased, spaces -> dashes).
const SCENES = {
  bbac: `The Bombay Beach Arts & Culture center sculpture garden: the giant scrap-metal fish sculpture (rusted rebar ribs, chain-link fins, salvaged car-part scales and mirror shards) suspended overhead on its pedestal as the centerpiece, the low white community café building behind it, a red vintage food truck, teal patio umbrellas, café tables, leaning bicycles, desert palms, junk-art sculptures, gravel yard, bright desert daylight.`,
  chiba: `Interior of a scrappy DIY desert hackerspace amphitheater at night: multi-level tiered seating and mezzanines built from raw plywood and orange industrial pallet racking, warm bare-bulb string lights criss-crossing under an exposed plywood joist ceiling, a painted plywood mural panel on the back wall, cozy golden light against deep shadow, the open floor in front of the tiers.`,
  'drive-in': `The Bombay Beach Drive-In: a junkyard of rusted-out retro cars (a faded orange coupe front and center) parked in rows on white gravel, a weathered vintage arrow marquee sign on wooden posts at the left (letters aged and illegible), a distant white movie screen on the horizon, trailers and telephone poles behind, dramatic sunset clouds.`,
  estates: `The ruins of "Bombay Beach Estates": a row of low abandoned motel buildings completely covered in vivid graffiti murals, a freestanding painted concrete sign block out front (art washed-out and illegible), cracked dirt lot with dry desert scrub, telephone poles and wires, blazing blue desert sky with puffy clouds.`,
  institute: `The Bombay Beach Institute compound: turquoise-blue trailers and a matching blue school bus among a lush desert art-garden — purple prickly-pear cactus in big planters, agaves, a tall polished-metal angel-wing sculpture spinning on a pole, a weathered leather armchair sitting outdoors as art, a rusty radio mast, gravel paths, bright cloudless day.`,
  mars: `The Mars College campus alone on the open desert playa: a two-story open-frame structure of orange pallet racking and raw plywood decorated with big painted panels in reds and oranges, a large tilted solar-panel array leaning against it, a cluster of RVs, campers and a school bus around it, a hazy mountain range across the horizon, enormous sky in molten sunset color.`,
  neptune: `A surreal desert junk-art colossus: a towering assemblage sculpture crowned with a giant grinning clown head (red nose, black-and-white face), built from scrap metal, appliances and salvaged signs, with a chrome skeleton figure riding it; behind it a graffiti-bombed bus and desert shacks, cracked dirt lot, brilliant blue sky with scattered puffy clouds.`,
  saturn: `A dreamlike courtyard of enormous indigo-and-white trompe-l'oeil murals: painted panels of impossible white stone arches, colonnades, spiral staircases and checkerboard floors in deep ultramarine blue, arranged as walls around a gravel clearing, the painted architecture seeming to recede into real depth, string lights above, twilight sky.`,
  shipwreck: `The Bombay Beach shoreline ruin field at dusk: the skeletal wreck of a wooden ship sculpture beached on pale sand, a huge empty rusted-steel cube frame standing over debris, driftwood ruins and a lone bell-tower silhouette, the flat Salton Sea stretching to the horizon behind, melancholy pastel sunset clouds. The foreground ground plane is painted cracked salt-crusted sand with footprints and pebbles, continuing the beach — NOT a flat solid color band.`,
  'the-range': `"The Range", the open-air desert music venue at night: a low wooden stage built of weathered plywood and pallets with a hand-painted sign reading "THE RANGE", drum kit, amps, stools and mic stands on stage, a string of rainbow-colored bucket lights hanging overhead, a silver vintage Airstream trailer at the right, starry black desert night sky. Match the painted mood of the stylized reference exactly; the fighters stand on the packed dirt in front of the stage.`,
};

function idFor(folder) {
  return folder.toLowerCase().replace(/\s+/g, '-');
}

const folders = readdirSync(INSPO).filter(
  (f) => !f.startsWith('.') && statSync(join(INSPO, f)).isDirectory(),
);

for (const folder of folders) {
  const id = idFor(folder);
  if (only && only !== id) continue;
  const refs = readdirSync(join(INSPO, folder))
    .filter((f) => REF_EXT.has(extname(f).toLowerCase()))
    .map((f) => join(INSPO, folder, f));
  const scene = SCENES[id];
  if (!scene) {
    console.warn(`[${id}] no scene prompt in SCENES — skipping (add one to tools/gen-stage.mjs)`);
    continue;
  }
  if (refs.length === 0) {
    console.warn(`[${id}] no usable reference images — skipping`);
    continue;
  }
  const raw = join(ROOT, 'assets/raw/stages', `${id}.png`);
  const final = join(ROOT, 'public/assets/backgrounds/stages', `${id}.jpg`);
  if (!skip(raw, force)) {
    const prompt = `${STAGE_STYLE}\n${COMPOSITE}\nScene: ${scene}`;
    console.log(`[${id}] generating from ${refs.length} reference(s) ...`);
    const buf = await geminiImage({
      apiKey: env.GEMINI_API_KEY,
      model: 'gemini-3-pro-image',
      prompt,
      referencePaths: refs,
      aspectRatio: '21:9',
    });
    saveAsset(raw, buf, prompt);
  }
  mkdirSync(join(ROOT, 'public/assets/backgrounds/stages'), { recursive: true });
  // cover-scale + center-crop so a slightly-off aspect gen never distorts
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-vf',
    'scale=1680:720:force_original_aspect_ratio=increase,crop=1680:720', '-q:v', '3', final]);
  console.log(`  -> ${final}`);
}
console.log('done.');
