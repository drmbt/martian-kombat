// Compressed stylized "world map" for the character-select screen (Street
// Fighter II style overview map above the portrait grid). One-off asset, not
// a per-character or per-stage pipeline: a single top-down/oblique map
// covering the Bombay Beach town grid + Salton Sea shoreline and, to the
// north across open desert, the Mars College campus. Later work will map
// stage locations onto this image (see SPRINTBOARD icebox); this script just
// produces the base art.
//   node tools/gen-worldmap.mjs [--force]

import { join } from 'node:path';
import { ROOT, loadEnv, geminiImage, saveAsset, skip } from './lib.mjs';

const env = loadEnv();
const force = process.argv.includes('--force');

const STYLE_REF = join(ROOT, 'assets/raw/stages/salton.png');

const PROMPT = `A genuine LOW-RESOLUTION 16-BIT ERA VIDEO GAME MAP SCREEN, near-square composition, in the exact visual style of Street Fighter II's world-select map / Super Nintendo overworld maps: rendered as actual chunky, low-res PIXEL ART — hard aliased pixel edges, NO smooth gradients, NO soft photographic blending, NO airbrushed shading. Think native 16x16/32x32 pixel tiles scaled up: flat blocks of color, visible square pixel clusters, simple hatched/checkerboard dithering patterns used for shading instead of smooth blends, a restricted retro console color palette (roughly 32 colors), and clean thin dark outlines around every shape the way SNES-era sprites and tilesets are outlined. The attached reference image is the STYLE/PALETTE guide only (its dusty tan/rust/olive desert color palette and warm low-sun mood) — do NOT copy its painterly brushwork or photographic rendering; instead translate that same color mood into flat retro pixel-art tiles, like the reference scene redrawn as an actual SNES fighting-game stage-select tile map.

STRAIGHT-DOWN TOP-DOWN MAP VIEW (true orthographic top-down like a SNES overworld map, NOT an oblique or angled aerial shot, NOT a ground-level horizon shot): a tile-map of the small desert town of Bombay Beach filling the whole frame. A wide grid of straight dusty-tan street tiles running both directions (roughly 16 north-south avenues crossing 5 east-west streets) divides the map into rectangular city blocks. Each block is tiled with small simple top-down building sprites — low houses and single-wide trailers as flat-colored rectangular roof tiles in a limited retro palette (brick red, faded teal, olive green, sandy beige, pale grey), each with a crisp dark outline, no fine detail beyond a simple roof-line and a door/window pixel or two. Scatter tiny dark pixel-cluster "scrub bush" sprites and a few tiny car-sprite rectangles between blocks.

A single lighter sand-colored dirt-trail tile path cuts through the grid roughly down the middle, jogging once partway down, distinct from the paved street tiles.

Along the bottom edge, the town grid tiles give way to a pale cracked salt-flat tile band meeting a flat solid-color inland-sea tile area (muted blue-grey, flat color with a simple wave-dither pattern, no reflections or gradients), filling the bottom strip of the frame.

No readable text, no labels, no pins, no UI chrome, no watermark, no sky, no smooth photographic shading anywhere — every surface is flat retro pixel-art tiles with hard edges and a limited palette, like a real 16-bit game map screen.`;

const raw = join(ROOT, 'assets/raw/world-map.png');
const final = join(ROOT, 'public/assets/ui/world-map.png');

if (!skip(raw, force)) {
  console.log('generating world map...');
  const buf = await geminiImage({
    apiKey: env.GEMINI_API_KEY,
    model: 'gemini-3-pro-image',
    prompt: PROMPT,
    referencePaths: [STYLE_REF],
    aspectRatio: '1:1',
  });
  saveAsset(raw, buf, PROMPT);
}

const { mkdirSync, copyFileSync } = await import('node:fs');
mkdirSync(join(ROOT, 'public/assets/ui'), { recursive: true });
copyFileSync(raw, final);
console.log(`-> ${final}`);
