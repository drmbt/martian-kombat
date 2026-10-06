// SFF v2 PIXEL decoder (Node-only: node:zlib) — the sprite-archive half that
// files.ts's header parser left as roadmap. Decodes a sprite to RGBA with its
// SFF palette applied (palette index 0 = transparent, MUGEN's rule).
//
// Formats: PNG8 (10; kfm720 uses it for all 281 sprites), raw (0) and RLE8 (2).
// RLE5 (3) / LZ5 (4) / PNG24/32 throw "unsupported" rather than guess — add
// them from IKEMEN GO's image.go (MIT) when a reference needs them.
// Layout per IKEMEN GO src/image.go (MIT) + the Elecbyte SFF v2 spec.
import { inflateSync } from 'node:zlib';

export interface SffV2Sprite {
  group: number;
  image: number;
  width: number;
  height: number;
  axisX: number;
  axisY: number;
  format: number;
  /** index of the sprite this one reuses (data length 0) */
  linked: number;
  dataOffset: number;
  dataLength: number;
  palette: number;
}

export interface SffV2 {
  sprites: SffV2Sprite[];
  /** RGBA palettes (index 0 transparent) */
  palettes: Uint8Array[];
  buf: Uint8Array;
}

export function readSffV2(buf: Uint8Array): SffV2 {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (new TextDecoder().decode(buf.subarray(0, 11)) !== 'ElecbyteSpr') throw new Error('not an SFF file');
  if (buf[15] !== 2) throw new Error(`SFF v${buf[15]} — only v2 pixels are decoded`);
  const sprOff = dv.getUint32(36, true);
  const sprCount = dv.getUint32(40, true);
  const palOff = dv.getUint32(44, true);
  const palCount = dv.getUint32(48, true);
  const ldata = dv.getUint32(52, true);
  const tdata = dv.getUint32(60, true);

  const palRaw: { cols: number; linked: number; ofs: number; len: number }[] = [];
  for (let i = 0; i < palCount; i++) {
    const o = palOff + i * 16;
    palRaw.push({ cols: dv.getUint16(o + 4, true), linked: dv.getUint16(o + 6, true), ofs: dv.getUint32(o + 8, true), len: dv.getUint32(o + 12, true) });
  }
  const palettes: Uint8Array[] = [];
  for (let i = 0; i < palRaw.length; i++) {
    const p = palRaw[i].len === 0 ? palRaw[palRaw[i].linked] : palRaw[i];
    const rgba = new Uint8Array(256 * 4);
    for (let c = 0; c < Math.min(256, p.cols); c++) {
      const s = ldata + p.ofs + c * 4;
      rgba.set([buf[s], buf[s + 1], buf[s + 2], c === 0 ? 0 : 255], c * 4);
    }
    palettes.push(rgba);
  }

  const sprites: SffV2Sprite[] = [];
  for (let i = 0; i < sprCount; i++) {
    const o = sprOff + i * 28;
    const flags = dv.getUint16(o + 26, true);
    sprites.push({
      group: dv.getUint16(o, true),
      image: dv.getUint16(o + 2, true),
      width: dv.getUint16(o + 4, true),
      height: dv.getUint16(o + 6, true),
      axisX: dv.getInt16(o + 8, true),
      axisY: dv.getInt16(o + 10, true),
      linked: dv.getUint16(o + 12, true),
      format: buf[o + 14],
      dataOffset: (flags & 1 ? tdata : ldata) + dv.getUint32(o + 16, true),
      dataLength: dv.getUint32(o + 20, true),
      palette: dv.getUint16(o + 24, true),
    });
  }
  return { sprites, palettes, buf };
}

/** 8-bit indexed PNG → palette indices (w*h). Only what SFF PNG8 uses:
 *  colour type 3, bit depth 8, no interlace. */
export function decodePng8(png: Uint8Array): { width: number; height: number; idx: Uint8Array } {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  if (png[0] !== 0x89 || png[1] !== 0x50) throw new Error('not a PNG');
  let off = 8;
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  while (off + 8 <= png.length) {
    const len = dv.getUint32(off);
    const type = String.fromCharCode(...png.subarray(off + 4, off + 8));
    const data = png.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = dv.getUint32(off + 8);
      height = dv.getUint32(off + 12);
      if (data[8] !== 8 || data[9] !== 3 || data[12] !== 0) {
        throw new Error(`PNG8 expected (depth ${data[8]}, colour ${data[9]}, interlace ${data[12]})`);
      }
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const idx = new Uint8Array(width * height);
  const stride = width;
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const a = x > 0 ? cur[x - 1] : 0;
      const b = prev[x];
      const c = x > 0 ? prev[x - 1] : 0;
      let v = line[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
    idx.set(cur, y * width);
    prev = cur;
  }
  return { width, height, idx };
}

function rle8(src: Uint8Array, size: number): Uint8Array {
  const out = new Uint8Array(size);
  let i = 0;
  let j = 0;
  while (i < src.length && j < size) {
    const b = src[i++];
    if ((b & 0xc0) === 0x40) {
      const c = src[i++];
      for (let n = b & 0x3f; n > 0 && j < size; n--) out[j++] = c;
    } else out[j++] = b;
  }
  return out;
}

/** Decode sprite `n` to RGBA (width*height*4), palette applied. */
export function spriteRgba(sff: SffV2, n: number): { width: number; height: number; rgba: Uint8Array } {
  let s = sff.sprites[n];
  const own = s;
  if (s.dataLength === 0) s = sff.sprites[s.linked]; // linked: reuse pixels, keep own axis
  const data = sff.buf.subarray(s.dataOffset, s.dataOffset + s.dataLength);
  let idx: Uint8Array;
  const size = s.width * s.height;
  if (s.format === 0) idx = data.slice(0, size);
  else if (s.format === 2) idx = rle8(data.subarray(4), size);
  else if (s.format === 10) {
    // PNG8: 4-byte uncompressed size, then the PNG stream
    const png = decodePng8(data.subarray(4));
    if (png.width !== s.width || png.height !== s.height) throw new Error(`sprite ${own.group},${own.image}: PNG ${png.width}x${png.height} ≠ ${s.width}x${s.height}`);
    idx = png.idx;
  } else throw new Error(`sprite ${own.group},${own.image}: SFF format ${s.format} unsupported (see header)`);
  const pal = sff.palettes[s.palette] ?? sff.palettes[0];
  const rgba = new Uint8Array(size * 4);
  for (let p = 0; p < size; p++) rgba.set(pal.subarray(idx[p] * 4, idx[p] * 4 + 4), p * 4);
  return { width: s.width, height: s.height, rgba };
}

/** sprite index by (group, image) */
export function findSprite(sff: SffV2, group: number, image: number): number {
  return sff.sprites.findIndex((s) => s.group === group && s.image === image);
}
