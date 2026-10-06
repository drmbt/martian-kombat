// Per-stage outpainting prompts for tools/gen-outpaint.mjs — written after
// LOOKING at each stage, because the art style varies stage to stage (crisp
// 16-bit pixel art, painterly pixel art, neon interiors…). Each entry:
//   look  — the image's own rendering style + palette (copied, never imposed)
//   scene — what the picture shows (condensed from tools/gen-stage.mjs SCENES)
//   sides — how the scene should CONTINUE past the left/right edges
// Import-safe data module (no side effects).

export const STAGE_SOURCES_TALL = 'public/assets/backgrounds/stages tall';

/** tall-art filename overrides (folder names that don't match the id) */
export const TALL_ALIAS = { 'ai-kitchen': 'ai-kitchn' };

/** source art for stages registered outside public/assets/backgrounds/stages */
export const SOURCE_OVERRIDE = { salton: 'public/assets/backgrounds/salton-shoreline.jpg' };

const FLOOR_SIDES = 'The walkable ground in the bottom quarter continues as ONE continuous surface, same colour and texture, edge to edge and down to the bottom of the frame — nothing in that strip.';

export const DESC = {
  salton: {
    look: 'soft, painterly pixel art with heavy hand-placed texture and a molten orange, rust and brown palette',
    scene: 'the Salton Sea shoreline at burning sunset: a cracked salt-crusted playa foreground, a rusted swing set standing in shallow glassy water, decaying wooden ruins and skeletal dead palms on the left, white salt-tufa formations and pelicans on the right, hazy mountains across the water and a molten sun low on the horizon',
    sides: `Left: more half-sunk wooden ruins, broken fences and dead palm trunks along the shore. Right: more white salt formations, driftwood and a few pelicans at the waterline, the glassy water and hazy mountains continuing. ${FLOOR_SIDES}`,
  },
  'ai-kitchen': {
    look: 'clean, detailed cartoon pixel art with warm honey-wood tones, soft interior light and crisp outlines',
    scene: 'the inside of a plywood off-grid kitchen: steel wire shelving stacked with jars, cans and bottles, a long prep counter with pots and utensils, a pegboard of hanging pans, a big window looking out to a sunny desert with RVs, warm string lights along an orange-painted beam, and a wide wooden plank floor',
    sides: `Continue the kitchen walls outward: more plywood wall panels with steel shelving units, pantry jars, water jugs, a fridge or cooler, coat hooks, the orange beam and string lights running across; at the far right an open doorway to the bright desert. The wooden plank floor continues with the same perspective. ${FLOOR_SIDES}`,
  },
  altar: {
    look: 'fine, near-realistic painted pixel art with soft overcast light and a muted sand, grey and orange palette',
    scene: 'a ritual altar on the open desert under an overcast sky: a white ground-cloth with bright orange runners, silver vessels, stupa ornaments, buckets of pink and red flowers, a plywood pyramid and a row of tilted solar panels, dry mountains on the horizon',
    sides: `Keep the altar arrangement centred — do NOT duplicate it. The white ground-cloth and orange runner may trail off to the right; beyond it, open desert sand, scattered stones and dry scrub, the mountain range and overcast clouds continuing on both sides. ${FLOOR_SIDES}`,
  },
  bbac: {
    look: 'crisp, detailed painted pixel art in bright midday light with a saturated blue sky, sandy beige and rust palette',
    scene: 'the Bombay Beach arts centre sculpture garden: a giant scrap-metal fish sculpture on a pedestal, a low white café with teal umbrellas, a red food truck, palms, cacti, junk-art figures, power poles and a wide gravel yard',
    sides: `Left: more small desert-town houses, cacti, rusty junk-art sculptures and bicycles. Right: more power poles with sagging wires, low buildings, parked vehicles and scrap art. No second fish sculpture. ${FLOOR_SIDES}`,
  },
  chiba: {
    look: 'warm, detailed pixel art at night: amber bare-bulb light on raw plywood against deep black-blue shadows',
    scene: 'a scrappy DIY hackerspace amphitheatre at night: tiered plywood seating and mezzanines framed by dark steel pallet-racking columns, bare-bulb string lights under an exposed joist ceiling, a wide open plywood floor in front',
    sides: `Continue the warehouse interior outward: more steel racking columns and plywood walls, the joist ceiling and string lights receding with the same perspective, darker shadowy corners and stored lumber at the far ends. ${FLOOR_SIDES}`,
  },
  'chiba-roof': {
    look: 'crisp, clean 16-bit pixel art with hard pixel clusters and fine ordered dithering; indigo, violet, crimson, molten orange and warm off-white',
    scene: 'a flat rooftop deck at sunset: weathered white plywood planks in strong one-point perspective, a thin rusty pipe railing along the roof edge, a calm reflective lake far below, a violet mountain range and a huge streaked sunset sky',
    sides: 'Continue the plank deck outward with the SAME one-point perspective (planks angle more steeply toward the outer edges), keep the railing running along the roof edge at the same height (it may bend toward the viewer at the roof corners), continue the glowing water, the mountain silhouettes and the clouds — slightly darker and cooler toward the outer edges.',
  },
  dodecahedron: {
    look: 'smooth, quiet digital pixel art with long soft gradients — deep blue sky fading to a pale glowing horizon over a dark playa',
    scene: 'open desert playa at blue-hour dusk: a skeletal wooden dodecahedron sculpture with an owl on top in the middle distance, the distant Mars College camp lights strung along the horizon on the left, first stars appearing',
    sides: `Continue the flat dark playa and the glowing horizon line; a few more tiny distant camp lights and low hills along the horizon on the left, open emptiness on the right; more stars in the sky. Keep it calm and sparse. ${FLOOR_SIDES}`,
  },
  dojo: {
    look: 'clean, bright cartoon pixel art with warm wood, red-orange beams and green steel columns',
    scene: 'a plywood desert dojo: wooden wall panels between green steel columns under red-orange beams, a curtain and a large brass gong, pinned paper notes, a small flower altar, skylights above, open doorways to the bright desert at both ends, and a grey foam-mat floor',
    sides: `Continue the dojo hall outward: more plywood wall bays between green columns, red-orange beams and skylights, an open doorway to the bright desert at the far ends. NOTHING stands on the floor — no weapon racks, furniture or props anywhere in the lower half; anything decorative hangs ON THE WALL. The grey foam-mat floor continues all the way to the left and right edges of the frame with the same perspective. ${FLOOR_SIDES}`,
  },
  dome: {
    look: 'bright, clean pixel art with a vivid blue sky, white puffy clouds and pale sandy desert',
    scene: 'open playa under a blue sky: the collapsed wreck of a wooden dome sculpture with shredded white and red fabric in the middle distance, flat cracked desert stretching to hazy mountains, a distant trailer and telephone poles',
    sides: `Continue the flat cracked desert and hazy mountains; a few tiny distant poles, a far-off trailer or scattered debris on the horizon, more puffy clouds. Keep the dome wreck single and centred. ${FLOOR_SIDES}`,
  },
  'drive-in': {
    look: 'dense, gritty 16-bit pixel art with heavy rust and grime texture, dithered gradients and a dusty sunset palette of mauve, burnt orange, amber, faded teal and off-white',
    scene: 'an abandoned desert drive-in at dusk: rusted-out 1970s sedans and faded camper trailers on a lot of loose white gravel, telephone poles with sagging wires, a chain-link fence, purple mountains, a blank white screen in the distance and a mauve-and-orange sunset sky',
    sides: 'Continue the junkyard outward: more rusted cars and camper trailers parked BACK in the middle distance, more telephone poles and sagging wires, the fence and mountains continuing along the horizon. Do NOT add any new signs, lettering or readable text. The white gravel lot continues as ONE continuous surface with the same colour and texture across the entire foreground, edge to edge and down to the bottom of the frame — no props in the front strip.',
  },
  escapes: {
    look: 'chunky, gritty pixel art with graffiti colour, a bright blue sky with streaky clouds and dusty tan ground',
    scene: '"The Escapes": a derelict graffiti-covered open-fronted shed and a half-collapsed structure with a weathered sign, a leaning telephone pole with sagging wires, a powder-blue box trailer, a dark-red truck and green pallet racking on the left, hazy mountains',
    sides: `Left: more abandoned shacks, a rusty fence and scattered salvage set back in the middle distance. Right: more graffiti-covered ruins, poles and wires, scrub. No new readable words. ${FLOOR_SIDES}`,
  },
  estates: {
    look: 'busy, colourful pixel art with vivid graffiti murals, a deep blue sky with bright clouds and dusty orange ground',
    scene: 'the ruins of Bombay Beach Estates: a row of low abandoned motel buildings covered in graffiti murals, a painted concrete sign block out front, palms, telephone poles and wires, cracked dirt lot with dry scrub',
    sides: `Continue the row of graffiti-covered ruined buildings, fences, palms and poles outward, all set back in the middle distance. No new readable words. ${FLOOR_SIDES}`,
  },
  hyperion: {
    look: 'moody neon pixel art: dark corrugated-metal interior lit by vivid green and magenta LED strips, glossy reflective floor',
    scene: 'a dark corrugated-metal workshop shed lit with green and magenta LED strips: workbenches with electronics, shelving, cables, a projector, a lantern, glossy reflective concrete floor',
    sides: `Continue the shed interior outward: more corrugated walls and arched roof trusses with neon strips, shelving with gear and tools, cables; the glossy floor reflects the neon and continues with the same perspective. ${FLOOR_SIDES}`,
  },
  institute: {
    look: 'bright, saturated pixel art in hard midday sun: turquoise, sage green and dusty sand',
    scene: 'the Bombay Beach Institute: turquoise trailers and a blue school bus behind a lush desert garden of prickly pear, agaves and succulents, a polished angel-wing sculpture on a pole, a leather armchair outdoors, a radio mast, a gravel path',
    sides: `Continue the desert garden outward: more cacti, agaves and succulents, small sculptures, another trailer or shed set back; the gravel path continues. ${FLOOR_SIDES}`,
  },
  'last-resort': {
    look: 'warm, dusty pixel art with a hazy amber sky, brown desert and sun-faded colours',
    scene: 'a desert roadside: a big weathered billboard on posts, telephone poles and sagging wires, a rusty blue pickup, vintage camper trailers, dead trees and dry scrub, hazy mountains',
    sides: `Continue the roadside outward: more telephone poles and wires, dry dead trees and scrub, a distant trailer or shack, the hazy mountains. No new billboards or readable text. ${FLOOR_SIDES}`,
  },
  mars: {
    look: 'warm sunset pixel art with orange-red sky, purple mountains and dusty tan playa',
    scene: 'the Mars College campus on open playa: a two-storey open frame of orange pallet racking and plywood with painted panels, a tilted solar array, RVs, campers and a school bus around it, mountains and a molten sunset',
    sides: `Continue the camp outward: more RVs, campers, small shacks and pallets set back in the middle distance, the mountains and sunset sky continuing. ${FLOOR_SIDES}`,
  },
  mimos: {
    look: 'gritty, sun-faded pixel art with dense grain, warm reds and pinks against a pale hazy sky',
    scene: 'MIMOS, a ramshackle off-grid café-lounge of orange-red pallet racking and plywood under a sagging pink star-print canopy, thrifted couches, love posters, a coffee bar, a bicycle, a ping-pong table, a Joshua tree, scuffed white gravel yard',
    sides: `Left: open desert, more Joshua trees and scrub, the mountains. Right: the lounge structure may end in a weathered wall; beyond it scattered camp gear and the open desert. No new readable signs. ${FLOOR_SIDES}`,
  },
  museum: {
    look: 'bright, clean pixel art with a vivid blue sky, sandy white ground and a warm sunset glow low on the horizon',
    scene: 'the Bombay Beach museum: two stacked shipping containers (yellow and grey) with a painted fish, a red container, a collapsed wooden shack half-buried in sand, an old upright piano and an office chair, striped poles, telephone poles',
    sides: `Continue the open beach lot: more telephone poles, a few scattered junk objects and dunes set back, the horizon glow continuing. No new readable text. ${FLOOR_SIDES}`,
  },
  neptune: {
    look: 'detailed, crunchy pixel art with a bright blue sky full of small puffy clouds and dusty tan desert',
    scene: 'a junk-art colossus with a giant grinning clown head built from scrap, a graffiti bus and desert shacks behind, broken wooden ruins on the left, a cracked dirt lot',
    sides: `Continue the junk town outward: more shacks, scrap piles, broken fences and poles set back in the middle distance, more small clouds. No second colossus. ${FLOOR_SIDES}`,
  },
  'painted-canyon': {
    look: 'moody night pixel art with vivid neon-lit rock: magenta, purple, electric blue and red on dark canyon walls, green terminal-code glow',
    scene: 'deep inside a canyon during a secret desert rave: towering ridged canyon walls flood-lit magenta, purple and blue, glowing green code projected on the rock, a strip of starry sky above, a sandy wash floor',
    sides: `Continue the canyon walls outward on both sides with the same coloured flood-light and ridged rock texture, the wash floor widening slightly, a few more desert shrubs. ${FLOOR_SIDES}`,
  },
  saturn: {
    look: 'graphic pixel art dominated by deep ultramarine and white trompe-l\'oeil murals, warm dusk sky with string lights',
    scene: 'a courtyard of enormous indigo-and-white trompe-l\'oeil mural panels of impossible arches and staircases, string lights overhead, palms and a twilight sky, a gravel clearing',
    sides: `Continue the line of mural panels outward with NEW indigo-and-white painted architecture compositions (each panel different from every panel already shown), more string lights and palms; the gravel clearing continues. Same warm dusk sky to the frame edge. No readable words. ${FLOOR_SIDES}`,
    // the left pass cloned the SATURN / staircase panels twice — name new subjects
    left: `Left: ONE new mural panel in the same indigo-and-white brushwork but a DIFFERENT subject — a crescent moon over a domed observatory hall — then the panel wall ends with its plain timber bracing; beyond it the gravel clearing continues to a low adobe wall, palms and the dusk mountains under the string lights. Do NOT paint another SATURN sign or a copy of any staircase, arch or tunnel panel already in the image. ${FLOOR_SIDES}`,
  },
  shipwreck: {
    look: 'warm dusk pixel art with pastel mauve sky, muted rust browns and cracked pale sand',
    scene: 'a shoreline ruin field at dusk: a beached wooden shipwreck sculpture, a huge rusted steel cube frame, driftwood and a bell tower silhouette, the flat sea on the horizon',
    sides: `Continue the ruin field outward: more driftwood, broken posts and small wrecks set back near the waterline, the flat sea and pastel clouds continuing. ${FLOOR_SIDES}`,
  },
  'ski-inn': {
    look: 'warm golden-hour pixel art with deep blue sky, orange-striped buildings and dusty asphalt',
    scene: 'the Ski Inn dive bar on a dusty desert street: an orange-and-white striped two-storey building, a vintage marquee sign on a pole, palms, telephone poles, parked beater cars, red patio umbrellas, a cracked asphalt and gravel street',
    sides: `Continue the street outward: more low buildings, palms, telephone poles and parked cars set back along the street. No new readable signs. ${FLOOR_SIDES}`,
    // the left pass cloned the Ski Inn sign, then the striped building
    left: `Left: the street continues past the sign to a low tan cinder-block bait shop with a flat roof and a faded blank awning, a chain-link fence, a dirt lot with an old pickup truck, one palm and telephone poles. Do NOT paint another Ski Inn sign, marquee or street sign, and no orange-and-white striped building. ${FLOOR_SIDES}`,
  },
  'star-beach': {
    look: 'pale, sun-bleached pixel art with a hazy white-blue sky, harsh sun and bright cracked salt flats',
    scene: 'a star-shaped concrete sculpture with rebar spikes on bright cracked salt flats by the sea, steel power pylons, a hazy sun, distant mountains across the water',
    sides: `Continue the bright salt flats, the sea and hazy mountains; more power pylons and wires marching toward the horizon. ${FLOOR_SIDES}`,
  },
  'the-range': {
    look: 'dark night pixel art with a starry black sky, warm stage light and rainbow bucket lights',
    scene: 'an open-air desert music venue at night: a low wooden stage with a hand-painted sign, drum kit, amps and mic stands, rainbow bucket lights overhead, a silver Airstream trailer, cacti and dark hills',
    sides: `Continue the night desert outward: dark scrub, cacti, low hills and stars; perhaps a stack of pallets or a parked trailer set back. No new readable signs. ${FLOOR_SIDES}`,
  },
  tvs: {
    look: 'bright, colourful pixel art with a clean blue sky, sandy desert and saturated TV-screen colours',
    scene: 'a wall of stacked old TVs showing colourful art under a corrugated-roof shelter with graffiti, palms, telephone poles, an American flag, desert mountains',
    sides: `Continue the open desert outward: more telephone poles, palms and distant scrub; at most a few old TVs set FAR BACK near the horizon line. NOTHING in the lower third of the frame at the edges — no tires, wood, TVs or debris in front. No new readable text. ${FLOOR_SIDES}`,
  },
  van: {
    look: 'chunky pixel art with visible pixel clusters and dithered gradients; golden sunset light, deep blue and purple sky',
    scene: 'a graffiti-covered sprinter van parked on the open scrubby desert playa at sundown, the sun on the horizon at the left, streaked clouds, sparse dry bushes and a low pile of dark debris, rutted sandy ground',
    sides: `Continue the open playa outward: rutted sandy ground, sparse dry bushes, low hazy horizon and streaked sunset clouds. No second van. ${FLOOR_SIDES}`,
  },
};
