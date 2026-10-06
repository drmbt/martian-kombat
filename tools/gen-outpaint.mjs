// Stage outpainting — widen a 21:9 stage to a wider aspect (default 3.5:1)
// for a scrolling camera (plan D9 / P10.9 E2), within nano-banana's 21:9
// output limit. Two strategies:
//
//   sides  — two passes. Each shows the model 3/4 of the stage plus a solid
//            magenta band (the empty canvas) on one side; only the new band
//            is kept, aligned to the original, colour-matched on an overlap
//            strip and feather-blended. The original pixels stay untouched.
//   pillar — one pass. The whole stage, shrunk to 2/3, sits in the middle
//            of a magenta 21:9 canvas; the model extends it on ALL sides.
//            The original is composited back over the middle. Yields a
//            wider AND taller frame (`.tall.jpg`, for Marvel vs Capcom-style
//            high-jump stages) plus the wide crop (`.wide.jpg`).
//
//   npm run gen:outpaint -- --stage drive-in --mode sides|pillar [--try 1]
//                           [--aspect 3.5] [--force]
//   npm run gen:outpaint -- --stage chiba-roof --mode sides --try 2 \
//        --src "public/assets/backgrounds/stages tall/chiba-roof.png" --width 2520
//
// `sides` works on ANY source size (e.g. the 1680×1440 "stages tall" set):
// each pass's canvas uses the widest model-supported aspect ratio that fits
// band + context (21:9 for normal stages, 4:3 for the tall ones).
//
// Raw gens, inputs, prompt sidecars and composites go to the gitignored
// assets/raw/stages-wide/<id>/. Nothing in public/ is touched. Per-stage
// prompt descriptions live in DESC (written after LOOKING at each image —
// stage styles vary, so the prompt must describe the actual picture).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, geminiImage, loadEnv, saveAsset } from './lib.mjs';

const OV = 72; // blend overlap (px at stage resolution)
const MAGENTA = [255, 0, 255];

// What each stage actually looks like + how its sides should continue.
const DESC = {
  'chiba-roof': {
    look: 'crisp, clean 16-bit pixel art with hard pixel clusters and fine ordered dithering in the sky; a cool-to-hot palette of indigo, violet, crimson, molten orange and warm off-white',
    scene: 'a flat rooftop deck at sunset: weathered white-painted plywood planks in strong one-point perspective converging toward the centre, a thin rusty metal-pipe safety railing running along the roof edge, a calm reflective lake / desert playa glowing orange far below, a layered hazy violet mountain range on the horizon, and a huge dramatic sunset sky of streaked crimson, orange and deep indigo clouds with the sun glowing at the centre',
    sides: 'Continue the plank deck outward with the SAME one-point perspective (planks angle more steeply toward the outer edges), keep the railing running along the roof edge at the same height (it may bend toward the viewer at the roof corners), continue the glowing water, the mountain silhouettes and the streaked clouds naturally — the sky gets slightly darker and cooler toward the outer edges.',
  },
  'drive-in': {
    look: 'dense, gritty 16-bit pixel art with heavy rust and grime texture, dithered gradients and a dusty sunset palette of mauve, burnt orange, amber, faded teal and off-white',
    scene: 'an abandoned desert drive-in theatre at dusk: rows of rusted-out 1970s sedans and faded vintage camper trailers parked on a lot of loose white gravel with a few dark cracks, telephone poles with sagging wires, a low chain-link fence along the back, low purple mountains on the horizon, a blank white movie screen in the distance and a dramatic sunset sky of mauve and orange clouds',
    sides: 'Continue the junkyard outward: more rusted cars and camper trailers parked BACK in the middle distance, more telephone poles and sagging wires, the fence and mountains continuing along the horizon. Do NOT add any new signs, lettering or readable text. The white gravel lot continues as ONE continuous surface with the same colour and texture across the entire foreground, edge to edge and down to the bottom of the frame — no props in the front strip.',
  },
};

const OUTPAINT = (d, where) => `TASK: OUTPAINTING a 2D fighting-game stage background.
The attached image is the stage, ${where}. The solid pure-magenta (#FF00FF) area is EMPTY canvas, not part of the scene.
Replace EVERY magenta pixel with a seamless continuation of the scene, so the whole frame reads as one image painted at once.
Do NOT change, move, resize, restyle, recolour or crop the existing (non-magenta) artwork — keep it exactly where it is.
The scene: ${d.scene}.
Match the existing art exactly: ${d.look}. Same pixel-cluster size, same dithering, same palette and light direction, same horizon height and perspective vanishing point.
${d.sides}
FLOOR CONTRACT: the bottom quarter of the frame is walkable ground running the full width, edge to edge, touching the bottom edge of the image — no objects, props or people in that strip, no blank bands.
No magenta left anywhere. No seams, borders, frames, vignettes or colour shifts. No people, no text, no UI, no watermark.`;

// ---------------------------------------------------------------- pixels --

const ff = (args, input) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { input, maxBuffer: 1 << 30 });

/** Decode any image to rgb24, cover-scaled + centre-cropped to w×h. */
function readRGB(path, w, h) {
  return ff(['-i', path, '-vf', `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h}`,
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']);
}
function writeImg(buf, w, h, out) {
  ff(['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-i', 'pipe:0',
    ...(out.endsWith('.jpg') ? ['-q:v', '2'] : []), out], buf);
}
function canvas(w, h) {
  const b = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) b.set(MAGENTA, i * 3);
  return b;
}
/** copy src rect (sx,sy,cw,ch) of a sw-wide image into dst at (dx,dy) */
function blit(src, sw, sx, sy, cw, ch, dst, dw, dx, dy) {
  for (let y = 0; y < ch; y++) {
    src.copy(dst, ((dy + y) * dw + dx) * 3, ((sy + y) * sw + sx) * 3, ((sy + y) * sw + sx + cw) * 3);
  }
}
const px = (b, w, x, y) => (y * w + x) * 3;

/** Best (dx,dy) in ±r so gen(x+dx,y+dy) ≈ ref(x,y) over a region (SAD). */
function align(gen, gw, gh, ref, rw, region, r = 10) {
  let best = { dx: 0, dy: 0, e: Infinity };
  for (let dy = -r; dy <= r; dy += 2) {
    for (let dx = -r; dx <= r; dx += 2) {
      let e = 0;
      for (let y = region.y; y < region.y + region.h; y += 3) {
        for (let x = region.x; x < region.x + region.w; x += 3) {
          const gx = x + region.gx + dx;
          const gy = y + region.gy + dy;
          if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) { e += 255; continue; }
          const a = px(ref, rw, x, y);
          const g = px(gen, gw, gx, gy);
          e += Math.abs(ref[a] - gen[g]) + Math.abs(ref[a + 1] - gen[g + 1]) + Math.abs(ref[a + 2] - gen[g + 2]);
        }
      }
      if (e < best.e) best = { dx, dy, e };
    }
  }
  return best;
}

function magentaLeft(buf, w, x0, x1, y0, y1) {
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = px(buf, w, x, y);
    if (buf[i] > 200 && buf[i + 1] < 90 && buf[i + 2] > 200) n++;
  }
  return n / ((x1 - x0) * (y1 - y0));
}

// ------------------------------------------------------------------ main --

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const id = opt('stage');
const mode = opt('mode', 'sides');
const tryN = Number(opt('try', '1'));
const aspect = Number(opt('aspect', '3.5'));
const force = args.includes('--force');
const srcArg = opt('src');
const widthArg = opt('width');
if (!id || !DESC[id] || !['sides', 'pillar'].includes(mode)) {
  console.error(`usage: npm run gen:outpaint -- --stage <${Object.keys(DESC).join('|')}> --mode sides|pillar [--try N] [--aspect 3.5] [--force]`);
  process.exit(1);
}
const env = loadEnv();
const SRC = srcArg ? join(ROOT, srcArg) : join(ROOT, 'public/assets/backgrounds/stages', `${id}.jpg`);
const OUT = join(ROOT, 'assets/raw/stages-wide', id);
mkdirSync(OUT, { recursive: true });
const [W0, H0] = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', SRC])
  .toString().trim().split(',').map(Number);
const src = readRGB(SRC, W0, H0);
const d = DESC[id];
const tag = `try${tryN}-${mode}${H0 > W0 / 2 ? '-tall' : ''}`;

// model-supported aspect ratios (widest first)
const RATIOS = [['21:9', 21 / 9], ['16:9', 16 / 9], ['3:2', 3 / 2], ['4:3', 4 / 3], ['5:4', 5 / 4], ['1:1', 1]];

async function gen(name, canvasBuf, where, cw = W0, ratio = '21:9') {
  const input = join(OUT, `${tag}-${name}.input.png`);
  const raw = join(OUT, `${tag}-${name}.png`);
  writeImg(canvasBuf, cw, H0, input);
  if (existsSync(raw) && !force) {
    console.log(`[${id}] ${tag}-${name}: exists, reusing`);
    return raw;
  }
  const prompt = OUTPAINT(d, where);
  console.log(`[${id}] ${tag}-${name}: generating ...`);
  const buf = await geminiImage({
    apiKey: env.GEMINI_API_KEY, model: 'gemini-3-pro-image', prompt,
    referencePaths: [input], aspectRatio: ratio, imageSize: '2K',
  });
  saveAsset(raw, buf, prompt);
  return raw;
}

const report = { stage: id, mode, try: tryN, aspect };

if (mode === 'sides') {
  const W = widthArg ? Number(widthArg) : Math.round((H0 * aspect) / 2) * 2;
  const ext = (W - W0) / 2;
  // pass canvas: [band ext | P px of source]; widest supported ratio that
  // fits, keeping at least half the source as context
  const [ratio, r] = RATIOS.find(([, rr]) => rr * H0 <= ext + W0 && rr * H0 - ext >= W0 / 2) ?? RATIOS[0];
  const CW = Math.round(r * H0);
  const P = CW - ext;
  report.canvas = { ratio, width: CW, context: P, band: ext };
  const left = canvas(CW, H0);
  blit(src, W0, 0, 0, P, H0, left, CW, ext, 0);
  const right = canvas(CW, H0);
  blit(src, W0, W0 - P, 0, P, H0, right, CW, 0, 0);
  const pct = Math.round((ext / CW) * 100);
  const [lRaw, rRaw] = await Promise.all([
    gen('left', left, `with an empty magenta band on its LEFT side (the left ${pct}% of the frame)`, CW, ratio),
    gen('right', right, `with an empty magenta band on its RIGHT side (the right ${pct}% of the frame)`, CW, ratio),
  ]);
  const out = Buffer.alloc(W * H0 * 3);
  blit(src, W0, 0, 0, W0, H0, out, W, ext, 0);
  for (const side of ['left', 'right']) {
    const g = readRGB(side === 'left' ? lRaw : rRaw, CW, H0);
    // canvas→final x: left canvas x == final x; right canvas x + (ext + W0 − P)
    const off = side === 'left' ? 0 : ext + W0 - P;
    // src x → canvas x: left +ext; right −(W0 − P)
    const s2c = side === 'left' ? ext : -(W0 - P);
    const refX = side === 'left' ? OV : W0 - OV - 240; // src coords next to the band
    const a = align(g, CW, H0, src, W0, { x: refX, y: 40, w: 240, h: H0 - 80, gx: s2c, gy: 0 });
    // colour offset measured on the overlap strip
    const sum = [0, 0, 0];
    let n = 0;
    for (let y = 0; y < H0; y += 2) for (let k = 0; k < OV; k += 2) {
      const sx = side === 'left' ? k : W0 - OV + k;
      const gx = sx + s2c + a.dx;
      const gy = y + a.dy;
      if (gx < 0 || gx >= CW || gy < 0 || gy >= H0) continue;
      const si = px(src, W0, sx, y);
      const gi = px(g, CW, gx, gy);
      for (let c = 0; c < 3; c++) sum[c] += src[si + c] - g[gi + c];
      n++;
    }
    const delta = sum.map((v) => v / Math.max(1, n));
    // write band + overlap into the final frame
    const fx0 = side === 'left' ? 0 : W0 + ext - OV;
    const fx1 = side === 'left' ? ext + OV : W;
    for (let y = 0; y < H0; y++) for (let fx = fx0; fx < fx1; fx++) {
      const gx = Math.min(CW - 1, Math.max(0, fx - off + a.dx));
      const gy = Math.min(H0 - 1, Math.max(0, y + a.dy));
      const gi = px(g, CW, gx, gy);
      const oi = px(out, W, fx, y);
      // weight of the generated pixel: 1 in the band, ramps to 0 over the overlap
      const w = side === 'left'
        ? (fx < ext ? 1 : 1 - (fx - ext) / OV)
        : (fx >= W0 + ext ? 1 : (fx - (W0 + ext - OV)) / OV);
      for (let c = 0; c < 3; c++) {
        const gv = Math.min(255, Math.max(0, g[gi + c] + delta[c]));
        out[oi + c] = Math.round(gv * w + out[oi + c] * (1 - w));
      }
    }
    report[side] = {
      shift: [a.dx, a.dy],
      colourOffset: delta.map((v) => +v.toFixed(1)),
      magentaLeft: +magentaLeft(g, CW, side === 'left' ? 0 : P, side === 'left' ? ext : CW, 0, H0).toFixed(4),
    };
  }
  const wide = join(OUT, `${tag}.wide.jpg`);
  writeImg(out, W, H0, wide);
  report.wide = wide;
} else {
  if (Math.abs(W0 / H0 - 21 / 9) > 0.01) {
    console.error('pillar mode needs a 21:9 source (use --mode sides for other sizes)');
    process.exit(1);
  }
  // pillar: the stage at 1/s scale in the middle of the canvas, s = aspect / (21/9)
  const s = aspect / (W0 / H0);
  const iw = Math.round(W0 / s / 2) * 2;
  const ih = Math.round(H0 / s / 2) * 2;
  const small = readRGB(SRC, iw, ih);
  const c = canvas(W0, H0);
  const ox = (W0 - iw) / 2;
  const oy = (H0 - ih) / 2;
  blit(small, iw, 0, 0, iw, ih, c, W0, ox, oy);
  const raw = await gen('all', c, `shrunk into the middle of the frame with an empty magenta border on ALL four sides (left, right, top and bottom)`);
  const TW = Math.round((W0 * s) / 2) * 2;
  const TH = Math.round((H0 * s) / 2) * 2;
  const g = readRGB(raw, TW, TH);
  const px0 = Math.round((TW - W0) / 2);
  const py0 = Math.round((TH - H0) / 2);
  const a = align(g, TW, TH, src, W0, { x: 200, y: 60, w: W0 - 400, h: H0 - 120, gx: px0, gy: py0 });
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = 0; y < H0; y += 3) for (let x = 0; x < W0; x += 3) {
    if (x > OV && x < W0 - OV && y > OV && y < H0 - OV) continue; // border ring only
    const gi = px(g, TW, x + px0 + a.dx, y + py0 + a.dy);
    const si = px(src, W0, x, y);
    for (let k = 0; k < 3; k++) sum[k] += src[si + k] - g[gi + k];
    n++;
  }
  const delta = sum.map((v) => v / Math.max(1, n));
  const out = Buffer.alloc(TW * TH * 3);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const gx = Math.min(TW - 1, Math.max(0, x + a.dx));
    const gy = Math.min(TH - 1, Math.max(0, y + a.dy));
    const gi = px(g, TW, gx, gy);
    const oi = px(out, TW, x, y);
    for (let k = 0; k < 3; k++) out[oi + k] = Math.min(255, Math.max(0, Math.round(g[gi + k] + delta[k])));
  }
  // original back over the middle, feathered on its border
  for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
    const edge = Math.min(x, W0 - 1 - x, y, H0 - 1 - y);
    const w = Math.min(1, edge / OV);
    const oi = px(out, TW, x + px0, y + py0);
    const si = px(src, W0, x, y);
    for (let k = 0; k < 3; k++) out[oi + k] = Math.round(src[si + k] * w + out[oi + k] * (1 - w));
  }
  const tall = join(OUT, `${tag}.tall.jpg`);
  writeImg(out, TW, TH, tall);
  const wideBuf = Buffer.alloc(TW * H0 * 3);
  blit(out, TW, 0, py0, TW, H0, wideBuf, TW, 0, 0);
  const wide = join(OUT, `${tag}.wide.jpg`);
  writeImg(wideBuf, TW, H0, wide);
  report.shift = [a.dx, a.dy];
  report.colourOffset = delta.map((v) => +v.toFixed(1));
  report.magentaLeft = +magentaLeft(g, TW, 0, TW, 0, TH).toFixed(4);
  report.tall = tall;
  report.wide = wide;
}
writeFileSync(join(OUT, `${tag}.report.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
