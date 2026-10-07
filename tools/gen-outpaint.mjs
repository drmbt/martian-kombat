// Stage outpainting — widen a 21:9 stage to a wider aspect (default 3.5:1)
// for a scrolling camera (plan D9 / P10.9 E2), within nano-banana's 21:9
// output limit. Two strategies:
//
//   sides  — two passes. Each shows the model 3/4 of the stage plus a solid
//            magenta band (the empty canvas) on one side; only the new band
//            is kept, aligned to the original, colour-corrected and
//            feather-blended. The model regrades the context it repaints, so
//            the correction is (1) a colour map fitted on that repainted
//            context (fitColour) plus (2) the per-row residual at the join,
//            faded out over DECAY px. The original pixels stay untouched.
//   pillar — one pass. The whole stage, shrunk to 2/3, sits in the middle
//            of a magenta 21:9 canvas; the model extends it on ALL sides.
//            The original is composited back over the middle. Yields a
//            wider AND taller frame (`.tall.jpg`, for Marvel vs Capcom-style
//            high-jump stages) plus the wide crop (`.wide.jpg`).
//
//   npm run gen:outpaint -- --stage drive-in --mode sides|pillar [--try 1]
//                           [--aspect 3.5] [--force]
//   npm run gen:outpaint -- --stage chiba-roof --mode sides --try 2 \
//        --src "assets/stages-tall/chiba-roof.png" --width 2520
//   npm run gen:outpaint -- --stage mimos --try 3 --from left=2,right=1
//        # sides mode: every try shares one canvas geometry, so a good side
//        # from an earlier try is reused (copied) and only the rest re-rolls
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
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, geminiImage, loadEnv, pool, saveAsset } from './lib.mjs';
import { DESC, SOURCE_OVERRIDE, STAGE_SOURCES_TALL, TALL_ALIAS } from './stages-wide.mjs';

const OV = 72; // blend overlap (px at stage resolution)
const FIT = 360; // context strip (px) the colour map is fitted on
const DECAY = Number(process.env.MK_OUTPAINT_DECAY ?? 240); // px over which the per-row seam residual fades into the band
const MAGENTA = [255, 0, 255];

const OUTPAINT = (d, where, side) => `TASK: OUTPAINTING a 2D fighting-game stage background.
The attached image is the stage, ${where}. The solid pure-magenta (#FF00FF) area is EMPTY canvas, not part of the scene.
Replace EVERY magenta pixel with a seamless continuation of the scene, so the whole frame reads as one image painted at once.
Do NOT change, move, resize, restyle, recolour or crop the existing (non-magenta) artwork — keep it exactly where it is.
The scene: ${d.scene}.
Match the existing art exactly: ${d.look}. Same pixel-cluster size, same dithering, same palette and light direction, same horizon height and perspective vanishing point.
${(side && d[side]) || d.sides}
Every object in the new area is NEW: never copy, mirror or repeat a sign, mural, building, vehicle or prop that is already in the image.
Keep the existing sky colour, haze and light unchanged all the way to the frame edge — no darkening, no greying, no change of weather or time of day.
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

/**
 * Colour map gen→source fitted on the context the model RE-PAINTED (it
 * regrades the whole frame — tint, contrast, saturation — not just the new
 * band). 8×8 block means make it robust to small misregistration; a scaled
 * ridge pulls it toward identity. Returns M (4×3): out_c = Σ [r g b 1]·M[·][c].
 * Region in source coords [x0,x1); source x maps to gen x + gx, y + gy.
 */
function fitColour(src, sw, gen, gw, gh, x0, x1, gx, gy, B = 8) {
  const X = [];
  const Y = [];
  for (let by = 0; by + B <= gh; by += B) for (let bx = x0; bx + B <= x1; bx += B) {
    const s = [0, 0, 0];
    const g = [0, 0, 0];
    let n = 0;
    for (let y = by; y < by + B; y++) for (let x = bx; x < bx + B; x++) {
      const qx = x + gx;
      const qy = y + gy;
      if (qx < 0 || qy < 0 || qx >= gw || qy >= gh) continue;
      const si = px(src, sw, x, y);
      const gi = px(gen, gw, qx, qy);
      for (let c = 0; c < 3; c++) { s[c] += src[si + c]; g[c] += gen[gi + c]; }
      n++;
    }
    if (n < B * B) continue;
    X.push([g[0] / n, g[1] / n, g[2] / n, 1]);
    Y.push(s.map((v) => v / n));
  }
  // normal equations with a ridge toward identity: (XᵀX + Λ) M = XᵀY + Λ I
  const A = Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => X.reduce((a, r) => a + r[i] * r[j], 0)));
  const R = Array.from({ length: 4 }, (_, i) => [0, 1, 2].map((c) => X.reduce((a, r, k) => a + r[i] * Y[k][c], 0)));
  for (let i = 0; i < 4; i++) {
    const lam = 0.05 * A[i][i];
    A[i][i] += lam;
    if (i < 3) R[i][i] += lam;
  }
  // Gauss-Jordan on [A | R]
  for (let i = 0; i < 4; i++) {
    let p = i;
    for (let r = i + 1; r < 4; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]];
    [R[i], R[p]] = [R[p], R[i]];
    const d = A[i][i] || 1e-9;
    for (let j = 0; j < 4; j++) A[i][j] /= d;
    for (let c = 0; c < 3; c++) R[i][c] /= d;
    for (let r = 0; r < 4; r++) {
      if (r === i) continue;
      const f = A[r][i];
      for (let j = 0; j < 4; j++) A[r][j] -= f * A[i][j];
      for (let c = 0; c < 3; c++) R[r][c] -= f * R[i][c];
    }
  }
  return R;
}
const applyColour = (M, r, g, b) => [0, 1, 2].map((c) => r * M[0][c] + g * M[1][c] + b * M[2][c] + M[3][c]);

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
const all = args.includes('--all');
const only = opt('stage');
const mode = opt('mode', 'sides');
const tryN = Number(opt('try', '1'));
const aspect = Number(opt('aspect', '3.5'));
const force = args.includes('--force');
const ship = args.includes('--ship');
const srcArg = opt('src');
const widthArg = opt('width');
// --from left=2,right=1 → reuse that side's raw pass from an earlier try
const fromTry = Object.fromEntries((opt('from', '') || '').split(',').filter(Boolean).map((kv) => kv.split('=')));
const ids = all ? Object.keys(DESC) : [only];
if ((!all && (!only || !DESC[only])) || !['sides', 'pillar'].includes(mode)) {
  console.error('usage: npm run gen:outpaint -- (--stage <id> | --all) [--mode sides|pillar] [--try N] [--force]');
  console.error('                                 [--src <path>] [--width 2520] [--concurrency 4]');
  console.error('       npm run gen:outpaint -- (--stage <id> | --all) --ship [--try N]   # copy a reviewed try into public/');
  console.error(`stages: ${Object.keys(DESC).join(' ')}`);
  process.exit(1);
}
const env = ship ? {} : loadEnv();

// model-supported aspect ratios (widest first)
const RATIOS = [['21:9', 21 / 9], ['16:9', 16 / 9], ['3:2', 3 / 2], ['4:3', 4 / 3], ['5:4', 5 / 4], ['1:1', 1]];
const SHIP_DIR = join(ROOT, 'public/assets/backgrounds/stages-wide');

/** the art to widen: the TALL version when one exists (png first: lossless) */
function sourceFor(id) {
  if (srcArg) return join(ROOT, srcArg);
  const tall = TALL_ALIAS[id] ?? id;
  for (const ext of ['png', 'jpg']) {
    const p = join(ROOT, STAGE_SOURCES_TALL, `${tall}.${ext}`);
    if (existsSync(p)) return p;
  }
  return join(ROOT, SOURCE_OVERRIDE[id] ?? `public/assets/backgrounds/stages/${id}.jpg`);
}

async function outpaint(id) {
  const SRC = sourceFor(id);
  const OUT = join(ROOT, 'assets/raw/stages-wide', id);
  mkdirSync(OUT, { recursive: true });
  const [W0, H0] = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', SRC])
    .toString().trim().split(',').map(Number);
  const tag = `try${tryN}-${mode}${H0 > W0 / 2 ? '-tall' : ''}`;
  if (ship) {
    const wide = join(OUT, `${tag}.wide.jpg`);
    if (!existsSync(wide)) {
      console.warn(`[${id}] no ${tag}.wide.jpg to ship — run it first`);
      return;
    }
    mkdirSync(SHIP_DIR, { recursive: true });
    const out = join(SHIP_DIR, `${id}.jpg`);
    ff(['-i', wide, '-q:v', '3', out]);
    console.log(`[${id}] shipped ${tag} → ${out}`);
    return;
  }
  const src = readRGB(SRC, W0, H0);
  const d = DESC[id];

  async function gen(name, canvasBuf, where, cw = W0, ratio = '21:9') {
    const input = join(OUT, `${tag}-${name}.input.png`);
    const raw = join(OUT, `${tag}-${name}.png`);
    writeImg(canvasBuf, cw, H0, input);
    if (existsSync(raw) && !force) {
      console.log(`[${id}] ${tag}-${name}: exists, reusing`);
      return raw;
    }
    if (fromTry[name]) {
      const from = join(OUT, `${tag.replace(/^try\d+/, `try${fromTry[name]}`)}-${name}.png`);
      if (!existsSync(from)) throw new Error(`--from ${name}=${fromTry[name]}: no ${from}`);
      copyFileSync(from, raw);
      const side = (f) => f.replace(/\.png$/, '.prompt.txt');
      if (existsSync(side(from))) copyFileSync(side(from), side(raw));
      console.log(`[${id}] ${tag}-${name}: reused try${fromTry[name]}`);
      return raw;
    }
    const prompt = OUTPAINT(d, where, name);
    console.log(`[${id}] ${tag}-${name}: generating ...`);
    const buf = await geminiImage({
      apiKey: env.GEMINI_API_KEY, model: 'gemini-3-pro-image', prompt,
      referencePaths: [input], aspectRatio: ratio, imageSize: '2K',
    });
    saveAsset(raw, buf, prompt);
    return raw;
  }

  const report = { stage: id, source: SRC.replace(`${ROOT}/`, ''), mode, try: tryN, aspect, ...(Object.keys(fromTry).length ? { from: fromTry } : {}) };

  if (mode === 'sides') {
    const W = widthArg ? Number(widthArg) : Math.round((W0 * aspect) / (21 / 9) / 2) * 2;
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
      // 1) global colour map fitted on the re-painted context nearest the band
      const fitX = side === 'left' ? [0, FIT] : [W0 - FIT, W0];
      const M = fitColour(src, W0, g, CW, H0, fitX[0], fitX[1], s2c + a.dx, a.dy);
      // 2) what's left at the seam, per row (±24 rows box filter): faded out
      //    over DECAY px into the band so the join is exact but the far band
      //    keeps the fitted colour
      const rowSum = Array.from({ length: H0 }, () => [0, 0, 0, 0]);
      for (let y = 0; y < H0; y++) for (let k = 0; k < OV; k += 2) {
        const sx = side === 'left' ? k : W0 - OV + k;
        const gx = sx + s2c + a.dx;
        const gy = y + a.dy;
        if (gx < 0 || gx >= CW || gy < 0 || gy >= H0) continue;
        const si = px(src, W0, sx, y);
        const gi = px(g, CW, gx, gy);
        const m = applyColour(M, g[gi], g[gi + 1], g[gi + 2]);
        for (let c = 0; c < 3; c++) rowSum[y][c] += src[si + c] - m[c];
        rowSum[y][3]++;
      }
      const rowRes = rowSum.map((_, y) => {
        const acc = [0, 0, 0];
        let cnt = 0;
        for (let k = Math.max(0, y - 24); k <= Math.min(H0 - 1, y + 24); k++) {
          for (let c = 0; c < 3; c++) acc[c] += rowSum[k][c];
          cnt += rowSum[k][3];
        }
        return acc.map((v) => v / Math.max(1, cnt));
      });
      // seamResidual (diagnostic): RMS over 16-row bands of the per-row
      // correction the fade applies at the join — how far the model's local
      // grade strayed even after the colour map
      let rs = 0;
      let rn = 0;
      for (let y = 8; y < H0; y += 16) for (let c = 0; c < 3; c++) { rs += rowRes[y][c] ** 2; rn++; }
      const seamResidual = Math.sqrt(rs / Math.max(1, rn));
      // write band + overlap into the final frame
      const seam = side === 'left' ? ext : W0 + ext;
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
        const fade = Math.max(0, 1 - Math.abs(fx - seam) / DECAY);
        const m = applyColour(M, g[gi], g[gi + 1], g[gi + 2]);
        for (let c = 0; c < 3; c++) {
          const gv = Math.min(255, Math.max(0, m[c] + rowRes[y][c] * fade));
          out[oi + c] = Math.round(gv * w + out[oi + c] * (1 - w));
        }
      }
      report[side] = {
        shift: [a.dx, a.dy],
        colourOffset: delta.map((v) => +v.toFixed(1)),
        colourMap: M.map((r) => r.map((v) => +v.toFixed(3))),
        seamResidual: +seamResidual.toFixed(1),
        magentaLeft: +magentaLeft(g, CW, side === 'left' ? 0 : P, side === 'left' ? ext : CW, 0, H0).toFixed(4),
      };
    }
    const wide = join(OUT, `${tag}.wide.jpg`);
    writeImg(out, W, H0, wide);
    report.wide = wide;
  } else {
    if (Math.abs(W0 / H0 - 21 / 9) > 0.01) {
      throw new Error('pillar mode needs a 21:9 source (use --mode sides for other sizes)');
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

  // a big global colour shift between the model's copy of the original and
  // the original itself predicts a visible seam (calibrated 2026-10-06: the
  // two rejected stages were 30–35, accepted ones ≤ 9, one borderline 13.6)
  const offs = ['left', 'right'].flatMap((k) => report[k]?.colourOffset ?? []).concat(report.colourOffset ?? []);
  report.maxColourOffset = +Math.max(0, ...offs.map(Math.abs)).toFixed(1);
  // Since 2026-10-06 sides mode CORRECTS that drift (fitted colour map +
  // per-row seam fade), so a flag no longer means a hard seam — it means the
  // model regraded the frame: eyeball the band for haze/gradients. No pixel
  // metric caught the real rejects (cloned props, redrawn edges) — fine
  // pixel-art texture swamps them — so visual review stays the gate.
  report.reviewFlag = report.maxColourOffset > 12;
  if (report.reviewFlag) console.warn(`[${id}] ${tag}: model drift ${report.maxColourOffset} (corrected) — eyeball the band`);
  writeFileSync(join(OUT, `${tag}.report.json`), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
}

const conc = Number(opt('concurrency', '4'));
await pool(ids, ship ? 1 : conc, async (id) => {
  try {
    await outpaint(id);
  } catch (err) {
    console.error(`[${id}] FAILED: ${err.message}`); // log-and-skip; resumable
  }
});
