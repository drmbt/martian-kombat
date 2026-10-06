// npm run mugen:sprites -- --def assets/raw/mugen/chars/kfm720/kfm720.def --id kfm
//
// Turns a MUGEN character's REAL art into our game format (D-KFM, 2026-10-06:
// the user chose to ship Kung Fu Man's actual sprites as an unlockable):
//   public/assets/sprites/<id>/sheet.png + meta.json  (our named cells)
//   public/assets/portraits/<id>.png / -bust.png / -ko.png
//   src/data/characters/<id>.json  (the bench port's frame data + presentation)
//
// The frame data is NOT re-derived here — it comes from the committed bench
// port (src/bench/reference/<id>.port.json, kept at 100% parity), and each
// move's MUGEN animation number from <id>.ref.json. This tool only maps
// animations → our cell names and composites the sprites at the scale the
// port used, so the art sits exactly over the ported hurt/hit boxes.
//
// Scale: the port maps the reference build's stand height (ref.standHeight
// px at ref.localcoord) to hurtStand.h world px. A different build of the
// same character (kfm720 = 4× kfm's localcoord) scales by the localcoord
// ratio. World → cell px via the render scale (src/render/geometry).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { parseAir, type AirAction, type AirElement } from '../../src/compat/mugen/air';
import { parseCharDef } from '../../src/compat/mugen/files';
import { findSprite, readSffV2, spriteRgba, type SffV2 } from '../../src/compat/mugen/sff';
import { CELL_H, CELL_W, FLOOR_FRAC, HEADROOM, ORIGIN_FEET } from '../../src/render/coords';
import { renderScale } from '../../src/render/geometry';

const args = process.argv.slice(2);
const opt = (n: string, d?: string): string | undefined => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const defPath = opt('def');
const id = opt('id');
if (!defPath || !id) {
  console.error('usage: npm run mugen:sprites -- --def <char.def> --id <id>   (needs src/bench/reference/<id>.port.json + .ref.json)');
  process.exit(1);
}
const ROOT = process.cwd();
const port = JSON.parse(readFileSync(join(ROOT, `src/bench/reference/${id}.port.json`), 'utf8'));
const ref = JSON.parse(readFileSync(join(ROOT, `src/bench/reference/${id}.ref.json`), 'utf8'));
const dir = dirname(defPath);
const def = parseCharDef(readFileSync(defPath, 'latin1'));
const air = parseAir(readFileSync(join(dir, def.files.anim), 'latin1'));
const sff = readSffV2(new Uint8Array(readFileSync(join(dir, def.files.sprite))));

// HD sprite px → world px → cell px
const worldPerPx = port.hurtStand.h / (ref.standHeight * (def.localcoord[0] / ref.localcoord[0]));
const k = worldPerPx / renderScale(port);
console.log(`[${id}] ${def.displayName}: ${sff.sprites.length} sprites, ${air.size} actions, ${worldPerPx.toFixed(4)} world/px, ${k.toFixed(4)} cell/px`);

// ---------------------------------------------------------------- picking --

type Pick = { anim: number; elem: AirElement };
const act = (n: number): AirAction | undefined => air.get(n);
/** element shown at fraction f (0..1) of the action's first loop */
function at(n: number, f = 0): Pick | null {
  const a = act(n);
  if (!a || !a.elements.length) return null;
  return { anim: n, elem: a.elements[Math.min(a.elements.length - 1, Math.floor(f * a.elements.length))] };
}
/** startup / active / recovery elements: the first element carrying an attack
 *  box (Clsn1) is the active pose, the one before it the windup, the first
 *  one after the last Clsn1 element the recovery. Grabs (no Clsn1) split by
 *  thirds. */
function phases(n: number): [Pick, Pick, Pick] | null {
  const a = act(n);
  if (!a || !a.elements.length) return null;
  const el = a.elements;
  const hits = el.map((e, i) => (e.clsn1.length ? i : -1)).filter((i) => i >= 0);
  const first = hits.length ? hits[0] : Math.floor(el.length / 3);
  const last = hits.length ? hits[hits.length - 1] : Math.floor((2 * el.length) / 3);
  const p = (i: number): Pick => ({ anim: n, elem: el[Math.max(0, Math.min(el.length - 1, i))] });
  return [p(first - 1), p(first), p(last + 1)];
}

// our cell name → MUGEN pose (common states: the MUGEN standard anim numbers)
const cells = new Map<string, Pick>();
const put = (name: string, p: Pick | null): void => { if (p) cells.set(name, p); };
put('idle-a', at(0, 0));
put('idle-b', at(0, 0.5));
put('walk-a', at(20, 0));
put('walk-b', at(20, 0.5));
put('crouch', at(11, 0));
put('jump', at(41, 0.5) ?? at(40, 0.5));
put('hit', at(5000, 0.5));
put('block', at(130, 0) ?? at(120, 0));
put('block-crouch', at(131, 0) ?? at(121, 0));
put('fall', at(5030, 0) ?? at(5050, 0));
put('down', at(5110, 0) ?? at(5170, 0));
put('win', at(181, 0.6) ?? at(180, 0.6));
put('taunt', at(195, 0.5));

const animOf = new Map<string, number>();
for (const m of ref.moves as { id: string; strength?: string; anim: number }[]) {
  if (!animOf.has(m.id) || m.strength === 'l') animOf.set(m.id, m.anim);
}
for (const [moveId, mv] of Object.entries(port.moves as Record<string, { input?: unknown }>)) {
  const anim = animOf.get(moveId);
  const ph = anim === undefined ? null : phases(anim);
  if (!ph) { console.warn(`[${id}] ${moveId}: no animation found — falls back to idle`); continue; }
  if (moveId.startsWith('j') && !mv.input) put(moveId, ph[1]);
  else if (moveId.startsWith('c') && !mv.input) { put(`${moveId}-active`, ph[1]); put(`${moveId}-recovery`, ph[2]); }
  else (['startup', 'active', 'recovery'] as const).forEach((p, i) => put(`${moveId}-${p}`, ph[i]));
}

// ------------------------------------------------------------- compositing --

const decoded = new Map<number, { width: number; height: number; rgba: Uint8Array }>();
function sprite(g: number, i: number): { s: SffV2['sprites'][number]; px: { width: number; height: number; rgba: Uint8Array } } | null {
  const n = findSprite(sff, g, i);
  if (n < 0) return null;
  if (!decoded.has(n)) decoded.set(n, spriteRgba(sff, n));
  return { s: sff.sprites[n], px: decoded.get(n)! };
}

// cell width: MUGEN art reaches much further forward than our 288-wide cells
// hold (KFM's palm ~190 px past centre). Size the cell to the widest pose,
// body centred, in 16-px steps; the game reads it from the character's cellW.
let half = CELL_W / 2;
for (const p of cells.values()) {
  const sp = sprite(p.elem.group, p.elem.image);
  if (!sp) continue;
  const flip = p.elem.flipH ? -1 : 1;
  for (const sx of [0, sp.px.width]) half = Math.max(half, Math.abs((sx - sp.s.axisX) * flip + p.elem.x) * k + 8);
}
const cellW = Math.max(CELL_W, Math.ceil((2 * half) / 16) * 16);
const OX = cellW / 2;
console.log(`[${id}] cell ${cellW}×${CELL_H} (standard ${CELL_W}) — widest pose reaches ${Math.round(half - 8)} cell px from centre`);

/** one cellW×384 cell: the sprite's axis on our feet origin, scaled by k
 *  (bilinear on premultiplied alpha — no dark fringes) */
function cell(p: Pick): Uint8Array {
  const out = new Uint8Array(cellW * CELL_H * 4);
  const sp = sprite(p.elem.group, p.elem.image);
  if (!sp) { console.warn(`[${id}] missing sprite ${p.elem.group},${p.elem.image} (anim ${p.anim})`); return out; }
  const { s, px } = sp;
  const flip = p.elem.flipH ? -1 : 1;
  for (let y = 0; y < CELL_H; y++) {
    for (let x = 0; x < cellW; x++) {
      // cell → sprite px (inverse of: cell = origin + (spritePx - axis + elemOffset) * k)
      const fx = ((x + 0.5 - OX) / k) * flip - p.elem.x * flip + s.axisX - 0.5;
      const fy = (y + 0.5 - ORIGIN_FEET) / k - p.elem.y + s.axisY - 0.5;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const ax = fx - x0;
      const ay = fy - y0;
      let r = 0, g = 0, b = 0, a = 0;
      for (const [dx, dy, w] of [[0, 0, (1 - ax) * (1 - ay)], [1, 0, ax * (1 - ay)], [0, 1, (1 - ax) * ay], [1, 1, ax * ay]] as const) {
        const sx = x0 + dx;
        const sy = y0 + dy;
        if (sx < 0 || sy < 0 || sx >= px.width || sy >= px.height || w === 0) continue;
        const i = (sy * px.width + sx) * 4;
        const al = (px.rgba[i + 3] / 255) * w;
        r += px.rgba[i] * al; g += px.rgba[i + 1] * al; b += px.rgba[i + 2] * al; a += al;
      }
      if (a <= 0.004) continue;
      const o = (y * cellW + x) * 4;
      out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a);
      out[o + 3] = Math.round(a * 255);
    }
  }
  return out;
}

const writePng = (rgba: Uint8Array, w: number, h: number, file: string, vf?: string): void => {
  mkdirSync(dirname(file), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', 'pipe:0',
    ...(vf ? ['-vf', vf] : []), '-pix_fmt', 'rgba', file], { input: Buffer.from(rgba), maxBuffer: 1 << 30 });
};

const names = [...cells.keys()];
// ≤ 4096 px wide: the max texture size on many mobile GPUs (plan P6.5)
const COLS = Math.max(1, Math.min(8, Math.floor(4096 / cellW)));
const rows = Math.ceil(names.length / COLS);
if (rows * CELL_H > 4096) console.warn(`[${id}] sheet is ${rows * CELL_H}px tall — over the 4096 mobile texture limit`);
const sheet = new Uint8Array(COLS * cellW * rows * CELL_H * 4);
names.forEach((name, i) => {
  const c = cell(cells.get(name)!);
  const ox = (i % COLS) * cellW;
  const oy = Math.floor(i / COLS) * CELL_H;
  for (let y = 0; y < CELL_H; y++) sheet.set(c.subarray(y * cellW * 4, (y + 1) * cellW * 4), ((oy + y) * COLS * cellW + ox) * 4);
});
const spriteDir = join(ROOT, 'public/assets/sprites', id);
writePng(sheet, COLS * cellW, rows * CELL_H, join(spriteDir, 'sheet.png'));
writeFileSync(join(spriteDir, 'meta.json'), `${JSON.stringify({
  version: 2, cellW, cellH: CELL_H, cols: COLS, rows, floorFrac: FLOOR_FRAC, headroom: HEADROOM,
  normalized: true, frames: names, skeletons: {},
  _source: `${port._source} Sprites converted from ${def.files.sprite} by tools/fg/mugen-sprites.ts.`,
}, null, 2)}\n`);
console.log(`[${id}] sheet: ${names.length} cells (${COLS}×${rows}) → ${spriteDir}`);

// --------------------------------------------------------------- portraits --
// SFF 9000,1 = the large select portrait, 9000,0 the small one (MUGEN standard)
const portraitDir = join(ROOT, 'public/assets/portraits');
const pp = sprite(9000, 1) ?? sprite(9000, 0);
if (pp) {
  const sq = `scale=160:160:force_original_aspect_ratio=decrease:flags=lanczos,pad=160:160:(ow-iw)/2:(oh-ih)/2:color=0x00000000`;
  writePng(pp.px.rgba, pp.px.width, pp.px.height, join(portraitDir, `${id}.png`), sq);
  writePng(pp.px.rgba, pp.px.width, pp.px.height, join(portraitDir, `${id}-bust.png`), sq);
  // defeated bust: no generated beaten art for a reference fighter — a dark,
  // desaturated, reddened take on the portrait reads as "lost"
  writePng(pp.px.rgba, pp.px.width, pp.px.height, join(portraitDir, `${id}-ko.png`),
    `${sq},hue=s=0.25,colorchannelmixer=rr=0.8:gg=0.45:bb=0.45`);
  console.log(`[${id}] portraits (9000,${sprite(9000, 1) ? 1 : 0}) → ${portraitDir}/${id}{,-bust,-ko}.png`);
} else console.warn(`[${id}] no 9000,x portrait sprite`);

// -------------------------------------------------------------- character --
// the bench port (frame data, boxes, moves) + the presentation fields a
// playable character carries. Re-running this re-syncs it to the port.
const overlayPath = join(ROOT, `src/bench/reference/${id}.unlock.json`);
const overlay = existsSync(overlayPath) ? JSON.parse(readFileSync(overlayPath, 'utf8')) : {};
const charPath = join(ROOT, 'src/data/characters', `${id}.json`);
const { _source, ...rest } = port;
writeFileSync(charPath, `${JSON.stringify({ _source: `${_source} Playable copy written by tools/fg/mugen-sprites.ts — edit ${id}.unlock.json, not this file.`, ...rest, ...overlay, ...(cellW !== CELL_W ? { cellW } : {}) }, null, 2)}\n`);
console.log(`[${id}] character → ${charPath}`);
