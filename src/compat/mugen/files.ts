// Character DEF, stage DEF and SFF (sprite archive) HEADER parsers.
// SFF pixel decoding (RLE8/RLE5/LZ5/PNG) is roadmap work — see
// docs/FIGHTING_STANDARDS.md §8 Phase C; the header + sprite directory
// already answer "how many sprites / which standard groups does it ship".
import { findSection, get, nums, parseIni, toRecord, unquote } from './ini';

export interface CharDef {
  name: string;
  displayName: string;
  author: string;
  mugenVersion: string;
  /** IKEMEN-authored characters declare this; MUGEN-era ones do not (it
   *  changes HitDef defaults — see port.ts guard.hittime) */
  ikemenVersion?: string;
  localcoord: [number, number];
  files: Record<string, string>;
}

export function parseCharDef(text: string): CharDef {
  const secs = parseIni(text);
  const info = findSection(secs, 'info');
  const lc = nums(get(info, 'localcoord'));
  return {
    name: unquote(get(info, 'name')) ?? '',
    displayName: unquote(get(info, 'displayname')) ?? unquote(get(info, 'name')) ?? '',
    author: unquote(get(info, 'author')) ?? '',
    mugenVersion: get(info, 'mugenversion') ?? '',
    ikemenVersion: get(info, 'ikemenversion'),
    localcoord: lc.length >= 2 && !lc.some(Number.isNaN) ? [lc[0], lc[1]] : [320, 240],
    files: Object.fromEntries(
      Object.entries(toRecord(findSection(secs, 'files'))).map(([k, v]) => [k, unquote(v) ?? v]),
    ),
  };
}

export interface StageDef {
  name: string;
  localcoord: [number, number];
  /** camera scroll limits (stage x of the screen CENTER) */
  boundLeft: number;
  boundRight: number;
  p1StartX: number;
  p2StartX: number;
  /** players can't get closer than this to a screen edge */
  screenLeft: number;
  screenRight: number;
  /** floor line in screen pixels from the top */
  zoffset: number;
  /** number of [BG …] layer sections */
  bgLayers: number;
}

export function parseStageDef(text: string): StageDef {
  const secs = parseIni(text);
  const info = findSection(secs, 'info');
  const cam = findSection(secs, 'camera');
  const pi = findSection(secs, 'playerinfo');
  const bound = findSection(secs, 'bound');
  const si = findSection(secs, 'stageinfo');
  const lc = nums(get(si, 'localcoord'));
  const n = (v: string | undefined, d: number): number => (v === undefined || Number.isNaN(Number(v)) ? d : Number(v));
  return {
    name: unquote(get(info, 'name')) ?? '',
    localcoord: lc.length >= 2 && !lc.some(Number.isNaN) ? [lc[0], lc[1]] : [320, 240],
    boundLeft: n(get(cam, 'boundleft'), 0),
    boundRight: n(get(cam, 'boundright'), 0),
    p1StartX: n(get(pi, 'p1startx'), -70),
    p2StartX: n(get(pi, 'p2startx'), 70),
    screenLeft: n(get(bound, 'screenleft'), 15),
    screenRight: n(get(bound, 'screenright'), 15),
    zoffset: n(get(si, 'zoffset'), 200),
    bgLayers: secs.filter((s) => /^bg\s/i.test(s.name)).length,
  };
}

export interface SffSprite {
  group: number;
  image: number;
  width: number;
  height: number;
  axisX: number;
  axisY: number;
  /** v2 compression: 0 raw, 2 RLE8, 3 RLE5, 4 LZ5, 10 PNG8, 11 PNG24, 12 PNG32; v1 = PCX (-1) */
  format: number;
}

export interface SffInfo {
  version: string;
  spriteCount: number;
  paletteCount: number;
  sprites: SffSprite[];
}

/** Read an SFF v1 (PCX subfiles) or v2 header + sprite directory. */
export function parseSff(buf: Uint8Array): SffInfo {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const sig = new TextDecoder().decode(buf.subarray(0, 11));
  if (sig !== 'ElecbyteSpr') throw new Error('not an SFF file');
  const [lo3, lo2, lo1, hi] = [buf[12], buf[13], buf[14], buf[15]];
  const version = `${hi}.${lo1}${lo2}${lo3}`;
  const sprites: SffSprite[] = [];
  if (hi === 1) {
    const count = dv.getUint32(20, true);
    let off = dv.getUint32(24, true);
    for (let i = 0; i < count && off > 0 && off + 32 <= buf.byteLength; i++) {
      sprites.push({
        group: dv.getUint16(off + 12, true),
        image: dv.getUint16(off + 14, true),
        width: 0,
        height: 0,
        axisX: dv.getInt16(off + 8, true),
        axisY: dv.getInt16(off + 10, true),
        format: -1,
      });
      off = dv.getUint32(off, true);
    }
    return { version, spriteCount: count, paletteCount: 0, sprites };
  }
  const listOff = dv.getUint32(36, true);
  const count = dv.getUint32(40, true);
  const palCount = dv.getUint32(48, true);
  for (let i = 0; i < count; i++) {
    const o = listOff + i * 28;
    if (o + 28 > buf.byteLength) break;
    sprites.push({
      group: dv.getUint16(o, true),
      image: dv.getUint16(o + 2, true),
      width: dv.getUint16(o + 4, true),
      height: dv.getUint16(o + 6, true),
      axisX: dv.getInt16(o + 8, true),
      axisY: dv.getInt16(o + 10, true),
      format: buf[o + 14],
    });
  }
  return { version, spriteCount: count, paletteCount: palCount, sprites };
}
