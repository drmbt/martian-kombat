// Minimal, dependency-free PNG codec for the sprite pipeline: decode any
// non-interlaced 8-bit PNG (gray / RGB / palette / gray+alpha / RGBA) to RGBA,
// and encode RGBA back as an optimised 8-bit RGBA PNG (per-row adaptive filter
// + zlib level 9). Used by the packer's alpha-clean step and the one-time
// tools/clean-alpha.mjs / regrid passes (P6.3 / P6.5) — node:zlib only, so the
// default pack path stays free of Python/ImageMagick.
import { deflateSync, inflateSync } from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** @returns {{width:number, height:number, data:Uint8Array}} RGBA, 4 B/px */
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
  let off = 8;
  let width = 0, height = 0, depth = 0, ctype = 0, interlace = 0;
  let palette = null, trns = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      depth = body[8]; ctype = body[9]; interlace = body[12];
    } else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') trns = body;
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8) throw new Error(`unsupported bit depth ${depth}`);
  if (interlace) throw new Error('interlaced PNG unsupported');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  if (!ch) throw new Error(`unsupported color type ${ctype}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  const px = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    const prev = dst - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[dst + x - ch] : 0;
      const b = y > 0 ? px[prev + x] : 0;
      const c = x >= ch && y > 0 ? px[prev + x - ch] : 0;
      let v = raw[src + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[dst + x] = v & 0xff;
    }
  }
  if (ctype === 6) return { width, height, data: px };
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    let r, g, b, a = 255;
    if (ctype === 0) { r = g = b = px[i]; if (trns && trns.readUInt16BE(0) === r) a = 0; }
    else if (ctype === 4) { r = g = b = px[i * 2]; a = px[i * 2 + 1]; }
    else if (ctype === 2) {
      r = px[i * 3]; g = px[i * 3 + 1]; b = px[i * 3 + 2];
      if (trns && trns.readUInt16BE(0) === r && trns.readUInt16BE(2) === g && trns.readUInt16BE(4) === b) a = 0;
    } else {
      const k = px[i];
      r = palette[k * 3]; g = palette[k * 3 + 1]; b = palette[k * 3 + 2];
      a = trns && k < trns.length ? trns[k] : 255;
    }
    out.set([r, g, b, a], i * 4);
  }
  return { width, height, data: out };
}

function chunk(type, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

/** RGBA → PNG (color type 6). Per row, picks the filter with the smallest sum
 *  of absolute residuals (libpng's heuristic), then deflates at level 9. */
export function encodePng({ width, height, data }) {
  const stride = width * 4;
  const out = Buffer.alloc((stride + 1) * height);
  const cand = Array.from({ length: 5 }, () => Buffer.alloc(stride));
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    const prev = row - stride;
    let best = 0, bestSum = Infinity;
    for (let f = 0; f < 5; f++) {
      const c = cand[f];
      let sum = 0;
      for (let x = 0; x < stride; x++) {
        const v = data[row + x];
        const a = x >= 4 ? data[row + x - 4] : 0;
        const b = y > 0 ? data[prev + x] : 0;
        const cc = x >= 4 && y > 0 ? data[prev + x - 4] : 0;
        let r;
        if (f === 0) r = v;
        else if (f === 1) r = v - a;
        else if (f === 2) r = v - b;
        else if (f === 3) r = v - ((a + b) >> 1);
        else {
          const p = a + b - cc, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - cc);
          r = v - (pa <= pb && pa <= pc ? a : pb <= pc ? b : cc);
        }
        r &= 0xff;
        c[x] = r;
        sum += r < 128 ? r : 256 - r;
        if (sum >= bestSum) break;
      }
      if (sum < bestSum) { bestSum = sum; best = f; }
    }
    // the early-exit above may have left the winner's buffer partial: refill it
    const c = cand[best];
    for (let x = 0; x < stride; x++) {
      const v = data[row + x];
      const a = x >= 4 ? data[row + x - 4] : 0;
      const b = y > 0 ? data[prev + x] : 0;
      const cc = x >= 4 && y > 0 ? data[prev + x - 4] : 0;
      let r;
      if (best === 0) r = v;
      else if (best === 1) r = v - a;
      else if (best === 2) r = v - b;
      else if (best === 3) r = v - ((a + b) >> 1);
      else {
        const p = a + b - cc, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - cc);
        r = v - (pa <= pb && pa <= pc ? a : pb <= pc ? b : cc);
      }
      c[x] = r & 0xff;
    }
    out[y * (stride + 1)] = best;
    c.copy(out, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(out, { level: 9, memLevel: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Zero RGB wherever alpha is 0 (in place). Chroma-key leftovers under fully
 *  transparent pixels are invisible but cost ~45% of a sheet's bytes.
 *  @returns {number} pixels changed */
export function zeroTransparentRgb(img) {
  const d = img.data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0 && (d[i] | d[i + 1] | d[i + 2])) { d[i] = d[i + 1] = d[i + 2] = 0; n++; }
  }
  return n;
}

/** Throw unless `b` is `a` with only RGB-under-alpha-0 changed: identical
 *  size, identical alpha everywhere, identical RGB wherever alpha > 0. */
export function assertVisiblyIdentical(a, b, label = 'image') {
  if (a.width !== b.width || a.height !== b.height) throw new Error(`${label}: size changed`);
  const x = a.data, y = b.data;
  for (let i = 0; i < x.length; i += 4) {
    if (x[i + 3] !== y[i + 3]) throw new Error(`${label}: alpha differs at px ${i / 4}`);
    if (x[i + 3] > 0 && (x[i] !== y[i] || x[i + 1] !== y[i + 1] || x[i + 2] !== y[i + 2])) {
      throw new Error(`${label}: visible RGB differs at px ${i / 4}`);
    }
  }
}

/** Re-tile a sheet's cells into a new column count, preserving row-major cell
 *  order (cell i stays frame i). Unused trailing cells are transparent. */
export function regrid(img, cellW, cellH, cols, newCols, nCells) {
  const oldRows = Math.ceil(img.height / cellH);
  const n = nCells ?? cols * oldRows;
  const newRows = Math.ceil(n / newCols);
  const out = { width: newCols * cellW, height: newRows * cellH, data: new Uint8Array(newCols * cellW * newRows * cellH * 4) };
  for (let i = 0; i < n; i++) {
    const sx = (i % cols) * cellW, sy = Math.floor(i / cols) * cellH;
    const dx = (i % newCols) * cellW, dy = Math.floor(i / newCols) * cellH;
    for (let r = 0; r < cellH; r++) {
      const s = ((sy + r) * img.width + sx) * 4;
      const d = ((dy + r) * out.width + dx) * 4;
      out.data.set(img.data.subarray(s, s + cellW * 4), d);
    }
  }
  return { img: out, rows: newRows };
}

/** decode → zero hidden RGB → encode → decode-and-verify. Throws if the result
 *  is not visibly identical to the input. */
export function cleanSheetFile(buf, label = 'sheet') {
  const a = decodePng(buf);
  const b = { width: a.width, height: a.height, data: new Uint8Array(a.data) };
  const changed = zeroTransparentRgb(b);
  const out = encodePng(b);
  assertVisiblyIdentical(a, decodePng(out), label);
  return { out, changed };
}

/** best-effort clean for writers that receive an already-encoded sheet (the
 *  dev editor endpoints): the cleaned bytes when smaller and verified, else
 *  the input unchanged. Never throws. */
export function cleanPngBuffer(buf) {
  try {
    const { out } = cleanSheetFile(buf);
    return out.length < buf.length ? out : buf;
  } catch {
    return buf;
  }
}
