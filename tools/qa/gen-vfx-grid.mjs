// EXPERIMENT: can nano-banana emit a clean NxN grid of sequential VFX animation
// frames in a single pass? Generates 8 greyscale hit-spark grids on magenta
// (some 3x3=9 frames, some 4x4=16). Raw -> assets/raw/vfx/grid-tests/<id>.png.
// Post-processing (slice/key/centroid/gif) is deterministic, in vfx_grid.py.
//   node tools/qa/gen-vfx-grid.mjs [--force] [--concurrency N]
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { ROOT, loadEnv, geminiImage, saveAsset, skip, pool, concurrencyArg } from '../lib.mjs';

const env = loadEnv();
const force = process.argv.includes('--force');
const CONCURRENCY = concurrencyArg(4);

const grid = (n) => {
  const s = Math.sqrt(n);
  return `A clean ${s}x${s} grid sprite sheet of ${n} SEQUENTIAL ANIMATION FRAMES read left-to-right then top-to-bottom: frame 1 is the very first instant of the effect and each following cell is the NEXT moment in time, through the peak and fading to nothing by the final cell. The ${n} cells are evenly spaced and identical in a perfect grid — NO drawn gridlines, borders, or frame numbers. CRITICAL STYLE: each effect is SPARSE and ASYMMETRIC — NOT a symmetric radial burst — off-center, uneven, gestural, with plenty of empty NEGATIVE SPACE, jagged and hand-drawn. It stays within the central ~65% of the cell with margin so it NEVER touches or crosses a cell edge. STRICTLY GREYSCALE: blazing pure-white cores, grey mid-tones, dark grey edges, absolutely NO color (tinted per character in-game). Solid FLAT MAGENTA #FF00FF background filling the entire image. Anime / DBZ ink-and-energy VFX: sharp jagged SLASHES, ragged torn edges, gritty NOISE and grain, scattered uneven SPARKS, high contrast, dynamic. No characters, no ground, no scenery, no text, no watermark.`;
};

// batch 3: sparse + asymmetric — slashes, noise, spark bursts, jagged. 4x9, 4x16.
const SPARKS = [
  { id: 'diag-slash', frames: 9, flavor: 'a single sharp diagonal SLASH streak cutting across at an angle — a thin bright gestural blade-cut with a ragged trailing edge, very asymmetric, lots of empty space around it' },
  { id: 'cross-slash', frames: 9, flavor: 'two crossing slash gashes at DIFFERENT angles forming a rough uneven X — jagged blade cuts, one longer than the other, asymmetric and off-center' },
  { id: 'ember-flick', frames: 9, flavor: 'a very sparse flick of a few embers and sparks thrown asymmetrically off to ONE side — scattered uneven dots and short streaks, mostly empty negative space' },
  { id: 'splinter-shard', frames: 9, flavor: 'a burst of jagged splinters and shards flung mostly in ONE direction — angular sparse fragments, asymmetric spray, ragged and sharp' },
  { id: 'claw-rake', frames: 16, flavor: 'three parallel diagonal CLAW-RAKE slash streaks tearing across at an angle — uneven lengths, ragged glowing edges, asymmetric, sparse' },
  { id: 'spark-spit', frames: 16, flavor: 'a sparse asymmetric SPIT of sparks flicking off to one side from an impact point — uneven scattered sparks and short streaks with heavy negative space, not radial' },
  { id: 'jagged-tear', frames: 16, flavor: 'a jagged torn energy GASH ripping open off-center — a ragged asymmetric slash of light with rough splintered edges and a few stray sparks, gritty' },
  { id: 'noise-fizz', frames: 16, flavor: 'a sparse grainy NOISE fizz — scattered uneven specks, grain and dust flickering asymmetrically, gritty static texture with lots of empty space, no clean shape' },
];

const outDir = join(ROOT, 'assets/raw/vfx/grid-tests');
mkdirSync(outDir, { recursive: true });

await pool(SPARKS, CONCURRENCY, async (s) => {
  const raw = join(outDir, `${s.id}.png`);
  if (skip(raw, force)) return;
  const prompt = `${grid(s.frames)}\nThe effect in every cell: ${s.flavor}.`;
  console.log(`[vfx-grid] ${s.id} (${s.frames} frames) ...`);
  try {
    const buf = await geminiImage({ apiKey: env.GEMINI_API_KEY, model: 'gemini-3-pro-image', prompt, aspectRatio: '1:1' });
    saveAsset(raw, buf, prompt);
  } catch (e) {
    console.error(`  FAILED ${s.id}: ${e.message}`);
  }
});
console.log('done.');
