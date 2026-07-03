// Ultra-wide (21:9) fighting stages from the inspo folders in
// assets/stage-inspo/. Every image in a folder is passed as a reference and
// the prompt asks for one composite location. Raw gen goes to
// assets/raw/stages/ (gitignored); the packed 1680x720 jpg lands in
// public/assets/backgrounds/stages/<id>.jpg (committed).
// The `salton` stage is special-cased: it has no inspo folder (its old
// 16:9 render is its own reference) and packs to the legacy path
// public/assets/backgrounds/salton-shoreline.jpg.
// Stages generate concurrently through pool() (--concurrency N, default 4).
// Idempotent; --force regens, --stage <id> for one stage.
//   node tools/gen-stage.mjs [--stage the-range] [--force] [--concurrency N]

import { join, extname } from 'node:path';
import { readdirSync, statSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ROOT, loadEnv, geminiImage, saveAsset, skip, pool, concurrencyArg } from './lib.mjs';

const env = loadEnv();
const force = process.argv.includes('--force');
const only = process.argv.includes('--stage') ? process.argv[process.argv.indexOf('--stage') + 1] : null;
const concurrency = concurrencyArg(4);

const INSPO = join(ROOT, 'assets/stage-inspo');
const REF_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']); // gemini-accepted formats

// Style anchor passed as the FIRST reference for every stage: the approved
// Salton Shoreline render whose retro look all stages must match.
const STYLE_REF = join(INSPO, 'style-ref-salton.jpg');

// Locked stage style: gritty retro pixel-art (the salton-shoreline look), not
// cel-shaded cartoon. Plus the ultra-wide / walkable-floor contract.
const STAGE_STYLE = `Detailed retro pixel-art fighting game stage background in the style of 16-bit era arcade fighters (SNK Neo Geo, Street Fighter II, King of Fighters backgrounds), ultra-wide cinematic 21:9 shot. THE FIRST REFERENCE IMAGE IS THE STYLE GUIDE — match its art style exactly: dense hand-placed pixel detail, dithered color gradients, weathered textures, moody naturalistic light, muted earthy palette. NOT cartoony: no thick outlines, no cel shading, no clean vector shapes, no glossy modern digital painting.
Layered composition with parallax-friendly depth (distinct far / mid / near layers).
FLOOR CONTRACT (critical): the bottom quarter of the image is walkable ground — a continuous, textured floor plane (dirt, sand, gravel, wood, concrete — whatever fits the scene) running the FULL width of the frame, edge to edge, and extending all the way DOWN to the very bottom edge of the image. Fighters must be able to stand anywhere along it, including at the far left and far right edges. No objects, props, furniture or people anywhere in that strip; no blank/solid-color bands, no empty dead space, no borders, no vignette at the bottom — the ground texture itself must touch the bottom edge of the frame.
No people anywhere in the scene. No readable text unless specified, no watermark, no UI.`;

const COMPOSITE = `Use ALL remaining attached reference photos of this real location: composite their recognizable landmarks and features into ONE coherent wide scene, keeping the palette and mood of those references while translating everything into the pixel-art style of the first reference image.`;

// Scene lines per stage id (folder name, lowercased, spaces -> dashes).
const SCENES = {
  altar: `A makeshift ritual altar set up in the open desert under a moody overcast sky: a large white ground-cloth laid over the sand with bright orange fabric runners, crowded with ornate silver ceremonial vessels and tiered stupa-like ornaments, big overflowing bouquets of pink, red and white flowers in buckets and vases, a single sunflower, a small plywood pyramid — all backed by a row of large tilted solar panels leaning like a wall, dry desert mountains across the horizon behind them, soft grey-and-gold evening light breaking through the clouds. The altar arrangement sits in the middle distance; the open sandy desert ground in front of it fills the entire foreground where the fighters stand.`,
  van: `A lone graffiti-bombed sprinter van parked CENTERED in the middle distance on the open scrubby desert playa at sundown: the van shown as a COMPLETE vehicle nose to tail — invent the front end (windshield, hood, headlights, front bumper) that the reference photo crops off — angled three-quarter so its graffiti-covered side faces mostly toward the camera, every panel covered in vivid multicolor graffiti letters and tags, the sun just touching the horizon at the far left casting long golden light, enormous sky with streaked wispy clouds fading from warm gold at the horizon to deep blue overhead, sparse dry scrub bushes and a low pile of dark debris off to the sides, hazy flat horizon. The rutted sandy playa dirt, catching the low light, fills the entire foreground where the fighters stand. IMPORTANT: redraw EVERYTHING — the van, its graffiti, the ground, the sky — as chunky hand-placed pixel art with visible pixel clusters and dithered gradients exactly like the first reference image; do NOT reproduce smooth photographic detail anywhere.`,
  salton: `The Salton Sea shoreline at Bombay Beach, California at burning sunset. Cracked salt-crusted playa beach filling the whole foreground, a rusted swing set standing in the shallow glassy water, skeletal dead palm, decaying wooden ruins half-sunk in sand, mountains hazy across the water, sun low and molten on the horizon, a scatter of pelicans. Melancholy, beautiful, post-apocalyptic-Americana. Recreate the reference image faithfully, extended to the wider 21:9 frame.`,
  bbac: `The Bombay Beach Arts & Culture center sculpture garden: the giant scrap-metal fish sculpture (rusted rebar ribs, chain-link fins, salvaged car-part scales and mirror shards) suspended overhead on its pedestal as the centerpiece, the low white community café building behind it, a red vintage food truck, teal patio umbrellas, café tables, leaning bicycles, desert palms, junk-art sculptures, and a wide empty gravel yard in front of everything, bright desert daylight.`,
  chiba: `Interior of a scrappy DIY desert hackerspace amphitheater at night: multi-level tiered seating and mezzanines built from raw plywood and orange industrial pallet racking pushed back into the MIDDLE DISTANCE, warm bare-bulb string lights criss-crossing under an exposed plywood joist ceiling, a painted plywood mural panel on the back wall, cozy golden light against deep shadow. The entire foreground is a wide open plywood floor spanning the full frame width where the tiers do NOT intrude — fighters can walk from the far left edge to the far right edge unobstructed.`,
  'drive-in': `The Bombay Beach Drive-In: a junkyard of rusted-out retro cars (a faded orange coupe front and center) parked in rows on white gravel, a weathered vintage arrow marquee sign on wooden posts at the left (letters aged and illegible), a distant white movie screen on the horizon, trailers and telephone poles behind, dramatic sunset clouds. The cars sit in the middle distance. The ENTIRE lot — between the car rows, around the cars, and across the whole open foreground down to the bottom edge of the frame — is ONE continuous white-gravel surface with the same color and texture everywhere; no color break, no separate strip or band, the foreground gravel is simply the near part of the same lot.`,
  estates: `The ruins of "Bombay Beach Estates": a row of low abandoned motel buildings completely covered in vivid graffiti murals, a freestanding painted concrete sign block out front (art washed-out and illegible), cracked dirt lot with dry desert scrub filling the foreground, telephone poles and wires, blazing blue desert sky with puffy clouds.`,
  institute: `The Bombay Beach Institute compound: turquoise-blue trailers and a matching blue school bus among a lush desert art-garden — purple prickly-pear cactus in big planters, agaves, a tall polished-metal angel-wing sculpture spinning on a pole, a weathered leather armchair sitting outdoors as art, a rusty radio mast, bright cloudless day. The foreground is a wide clear gravel path running the full width of the frame.`,
  mars: `The Mars College campus alone on the open desert playa: a two-story open-frame structure of orange pallet racking and raw plywood decorated with big painted panels in reds and oranges, a large tilted solar-panel array leaning against it, a cluster of RVs, campers and a school bus around it, a hazy mountain range across the horizon, enormous sky in molten sunset color, open cracked playa dirt filling the foreground.`,
  mimos: `MIMOS, the ramshackle off-grid desert café-lounge, harsh bright midday: an open-fronted shanty of sun-bleached weathered orange-red painted pallet racking and scuffed splintery plywood, everything dusty and lived-in and a little falling-apart. A big sagging canopy of faded hot-pink star-printed fabric droops across the left bay, wrinkled and wind-worn. A crooked hand-cut white "MIMOS" sign on the roof edge. Warm red interior walls plastered with colorful hand-printed love posters (stylized lettering like "MAIS AMOR", "INFINITO"), edges peeling. A jumble of mismatched thrifted couches and sagging armchairs with worn upholstery, a battered little red table, threadbare patterned rugs over the rough plywood deck, cluttered with backpacks, dropped bags, mugs, scattered junk and camp gear piled around. A messy coffee-bar corner crammed with kettles, a moka pot and stacked paper cups. Tangled string lights sagging along the eaves, a dusty leaning bicycle at the right, a scraggly desert tree behind, pale hazy blue sky. A weathered blue ping-pong table sits off at the far left edge in the middle distance. The scuffed white gravel-and-dirt yard in front, littered with pebbles and a few stray objects near the deck edge, fills the entire foreground where the fighters stand. Render with the same gritty weathered heavily-dithered pixel texture, dense grain, and dustier muted palette as the reference — NOT clean flat vector shapes; distressed, sun-faded, and grungy.`,
  neptune: `A surreal desert junk-art colossus: a towering assemblage sculpture crowned with a giant grinning clown head (red nose, black-and-white face), built from scrap metal, appliances and salvaged signs, with a chrome skeleton figure riding it; behind it a graffiti-bombed bus and desert shacks, brilliant blue sky with scattered puffy clouds, a cracked dirt lot spreading open across the whole foreground.`,
  saturn: `A dreamlike courtyard of enormous indigo-and-white trompe-l'oeil murals: painted panels of impossible white stone arches, colonnades, spiral staircases and checkerboard floors in deep ultramarine blue, arranged as walls around a gravel clearing, the painted architecture seeming to recede into real depth, string lights above, twilight sky, the gravel clearing itself filling the foreground edge to edge.`,
  shipwreck: `The Bombay Beach shoreline ruin field at dusk: the skeletal wreck of a wooden ship sculpture beached on pale sand, a huge empty rusted-steel cube frame standing over debris, driftwood ruins and a lone bell-tower silhouette, the flat Salton Sea stretching to the horizon behind, melancholy pastel sunset clouds. The foreground ground plane is cracked salt-crusted sand with footprints and pebbles, continuing the beach — NOT a flat solid color band.`,
  'chiba-roof': `The rooftop deck of the Chiba tower at sunset, where people do yoga: a flat open-air roof floored in white-painted weathered plywood planks, thin metal-pipe safety railings running along the roof's far edge and extending off BOTH sides of the frame, the setting sun centered on the horizon behind a hazy desert mountain range, the flat desert playa spread out far below, enormous glowing sunset sky with streaked clouds, a few yoga mats resting near the railing in the background. The white textured wood decking fills the entire foreground edge to edge — that is the fighting surface.`,
  dodecahedron: `Open desert playa at blue-hour dusk just after sunset: a large intact skeletal wooden dodecahedron sculpture stands centered in the middle distance, its clean geometric strut frame silhouetted dark against a luminous gradient sky (pale glowing horizon rising into deep blue), a great horned owl perched on its top edge in silhouette, the distant Mars College camp — low buildings with warm lit windows, trailers, tiny vehicles — strung along the horizon at left, a hazy mountain range low at the far left, first stars appearing high in the sky. Quiet, still, cold-evening mood. The dark open playa dirt fills the entire foreground where the fighters stand.`,
  dome: `Open desert playa under a bright blue sky with scattered clouds: in the middle distance stands the decrepit wreck of a large wooden dome sculpture — geometric timber struts snapped and sagging, half collapsed, shredded white and faded-red fabric panels wind-decimated and flapping off the frame, debris half-buried in sand at its base — the flat cracked desert stretching to hazy mountains on the horizon behind it, a distant trailer and telephone poles tiny on the horizon. Wide open scene; the cracked sandy desert dirt fills the entire foreground where the fighters stand.`,
  'painted-canyon': `Deep inside Painted Canyon at night during a secret desert rave: towering ridged badlands canyon walls rising on both sides, flood-lit in vivid magenta, purple, electric blue and red, glowing green computer-terminal code and live-coding text projected huge across one canyon rock face, a narrow strip of starry night sky above the canyon rim, the far canyon walls receding in layered silhouette. The flat sandy canyon wash floor, catching spills of the colored light, fills the entire foreground.`,
  'ski-inn': `The Ski Inn, Bombay Beach's legendary dive bar, on a dusty desert street at golden hour: a two-story building with a bold orange-and-white vertically striped upper floor, red-brick lower walls under a rust-tiled awning, its weathered vintage marquee sign reading "SKI INN" atop a tall wooden pole at the left, tall palms behind the building, telephone poles and sagging wires, a couple of rusted beater cars parked off at the sides, red patio umbrellas and string lights peeking from the back patio, deep blue desert sky. The wide dusty gravel-and-cracked-asphalt street fills the entire foreground.`,
  'the-range': `"The Range", the open-air desert music venue at night: a low wooden stage built of weathered plywood and pallets with a hand-painted sign reading "THE RANGE", drum kit, amps, stools and mic stands on stage, a string of rainbow-colored bucket lights hanging overhead, a silver vintage Airstream trailer at the right, starry black desert night sky. The fighters stand on the packed dirt in front of the stage — that dirt fills the whole foreground.`,
};

function idFor(folder) {
  return folder.toLowerCase().replace(/\s+/g, '-');
}

function refsFor(folder) {
  return readdirSync(join(INSPO, folder))
    .filter((f) => REF_EXT.has(extname(f).toLowerCase()))
    .map((f) => join(INSPO, folder, f));
}

const folders = readdirSync(INSPO).filter(
  (f) => !f.startsWith('.') && !f.startsWith('_') && statSync(join(INSPO, f)).isDirectory(),
);

// salton has no inspo folder: its own previous render is the only reference,
// and it packs to the legacy top-level path the game already loads.
const jobs = [
  { id: 'salton', refs: [], final: join(ROOT, 'public/assets/backgrounds/salton-shoreline.jpg') },
  ...folders.map((folder) => ({
    id: idFor(folder),
    refs: refsFor(folder),
    final: join(ROOT, 'public/assets/backgrounds/stages', `${idFor(folder)}.jpg`),
  })),
].filter((j) => !only || only === j.id);

await pool(jobs, concurrency, async ({ id, refs, final }) => {
  const scene = SCENES[id];
  if (!scene) {
    console.warn(`[${id}] no scene prompt in SCENES — skipping (add one to tools/gen-stage.mjs)`);
    return;
  }
  const raw = join(ROOT, 'assets/raw/stages', `${id}.png`);
  try {
    if (!skip(raw, force)) {
      const prompt = `${STAGE_STYLE}\n${COMPOSITE}\nScene: ${scene}`;
      console.log(`[${id}] generating from ${refs.length + 1} reference(s) ...`);
      const buf = await geminiImage({
        apiKey: env.GEMINI_API_KEY,
        model: 'gemini-3-pro-image',
        prompt,
        referencePaths: [STYLE_REF, ...refs],
        aspectRatio: '21:9',
      });
      saveAsset(raw, buf, prompt);
    }
    mkdirSync(join(ROOT, 'public/assets/backgrounds/stages'), { recursive: true });
    // cover-scale + center-crop so a slightly-off aspect gen never distorts
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-vf',
      'scale=1680:720:force_original_aspect_ratio=increase,crop=1680:720', '-q:v', '3', final]);
    console.log(`  -> ${final}`);
  } catch (err) {
    console.error(`[${id}] FAILED: ${err.message}`); // log-and-skip; resumable
  }
});
console.log('done.');
