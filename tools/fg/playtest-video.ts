// npm run playtest:video -- [--stage chiba-roof] [--wide assets/raw/stages-wide/chiba-roof/try1-sides.wide.jpg]
//                           [--p1 vincent] [--p2 yulia] [--out assets/raw/playtest/<stage>-camera.mp4]
//
// Fixed-screen vs scrolling-camera comparison (plan D9). Two engine states run
// in LOCKSTEP on the same scripted inputs — top: today's fixed screen (stage =
// screen, background parallax-slides like FightScene); bottom: the MUGEN /
// SF2-style camera (MatchRules.camera) over a wider stage. Rendered offline
// from the real engine + real sprite sheets + real stage art (no HUD/VFX),
// so the only difference between the halves is the camera rule.
// Each half carries a label and a minimap: stage extent, camera window and
// both fighters. Output: 960×1080 H.264 (gitignored assets/raw/playtest/).
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  EMPTY_INPUT,
  FLOOR_Y,
  STAGE_H,
  STAGE_W,
  cameraX,
  initialState,
  mirrorTeleportPhases,
  resolveMove,
  step,
  type FighterState,
  type GameState,
  type InputFrame,
  type MatchRules,
} from '../../src/engine';
import { characters } from '../../src/data/characters';
import { renderScale, footOffset } from '../../src/render/geometry';
import { CELL_H, CELL_W, FLOOR_FRAC } from '../../src/render/coords';

const args = process.argv.slice(2);
const opt = (n: string, d?: string): string | undefined => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const STAGE = opt('stage', 'chiba-roof')!;
const P1 = opt('p1', 'vincent')!;
const P2 = opt('p2', 'yulia')!;
const WIDE = opt('wide', `assets/raw/stages-wide/${STAGE}/try1-sides.wide.jpg`)!;
const OUT = opt('out', `assets/raw/playtest/${STAGE}-camera.mp4`)!;
const W = STAGE_W;
const H = STAGE_H;

// ------------------------------------------------------------ images ------

const ff = (a: string[]): Buffer => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { maxBuffer: 1 << 30 });
function probe(path: string): [number, number] {
  return execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path])
    .toString().trim().split(',').map(Number) as [number, number];
}
/** image scaled to height h → rgb24 */
function bgAtHeight(path: string, h: number): { buf: Buffer; w: number } {
  const [iw, ih] = probe(path);
  const w = Math.round((iw * h) / ih / 2) * 2;
  return { buf: ff(['-i', path, '-vf', `scale=${w}:${h}:flags=lanczos`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']), w };
}

interface Sheet { rgba: Buffer; w: number; cols: number; cells: Map<string, number> }
function loadSheet(id: string): Sheet {
  const dir = join('public/assets/sprites', id);
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as { frames: string[]; cols: number };
  const [w] = probe(join(dir, 'sheet.png'));
  return {
    rgba: ff(['-i', join(dir, 'sheet.png'), '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1']),
    w,
    cols: meta.cols,
    cells: new Map(meta.frames.map((n, i) => [n, i])),
  };
}

// ------------------------------------------------ cell choice (FightScene) --

const PHASE = ['startup', 'active', 'recovery'] as const;
function cellIndex(sheet: Sheet, cands: string[]): number {
  for (const c of cands) {
    const i = sheet.cells.get(c);
    if (i !== undefined) return i;
  }
  return 0;
}
function cellFor(sheet: Sheet, f: FighterState, tick: number): number {
  const a = f.action;
  const def = characters[f.charId];
  switch (a.kind) {
    case 'idle': return cellIndex(sheet, [(tick >> 4) % 2 ? 'idle-b' : 'idle-a']);
    case 'walkF': case 'walkB': return cellIndex(sheet, [(tick >> 3) % 2 ? 'walk-b' : 'walk-a']);
    case 'crouch': case 'prejump': case 'landing': case 'getup': return cellIndex(sheet, ['crouch']);
    case 'air': return cellIndex(sheet, ['jump']);
    case 'attack': case 'airAttack': {
      const base = def.moves[a.moveId!];
      const m = resolveMove(base, a.strength);
      let phase = a.frame < m.startup ? 0 : a.frame < m.startup + m.active ? 1 : 2;
      if (base.teleport?.mirror) phase = a.frame < mirrorTeleportPhases(m).half ? phase : 2 - phase;
      const id = a.moveId!;
      if (base.input) return cellIndex(sheet, [`${id}-${PHASE[phase]}`, `special-${PHASE[phase]}`]);
      if (id.startsWith('j')) return cellIndex(sheet, [id, 'jump']);
      if (id.startsWith('c')) return cellIndex(sheet, [`${id}-${phase === 2 ? 'recovery' : 'active'}`, 'crouch']);
      return cellIndex(sheet, [`${id}-${PHASE[phase]}`]);
    }
    case 'hitstun': case 'dazed': return cellIndex(sheet, ['hit']);
    case 'blockstun': return cellIndex(sheet, [a.guard === 'crouch' ? 'block-crouch' : 'block']);
    case 'airHit': return cellIndex(sheet, ['fall']);
    case 'knockdown': return cellIndex(sheet, ['down']);
    default: return cellIndex(sheet, ['idle-a']);
  }
}

// ---------------------------------------------------------------- draw ----

function blend(dst: Buffer, di: number, r: number, g: number, b: number, a: number): void {
  dst[di] = (r * a + dst[di] * (255 - a)) / 255;
  dst[di + 1] = (g * a + dst[di + 1] * (255 - a)) / 255;
  dst[di + 2] = (b * a + dst[di + 2] * (255 - a)) / 255;
}

/** draw fighter f with its sheet cell into the frame (screen offset ox) */
function drawFighter(frame: Buffer, fy0: number, sheet: Sheet, f: FighterState, tick: number, ox: number): void {
  const def = characters[f.charId];
  const s = renderScale(def);
  const idx = cellFor(sheet, f, tick);
  const cx0 = (idx % sheet.cols) * CELL_W;
  const cy0 = Math.floor(idx / sheet.cols) * CELL_H;
  const left = f.x - 0.5 * CELL_W * s - ox;
  const top = f.y + footOffset(def) - FLOOR_FRAC * CELL_H * s;
  const dw = Math.ceil(CELL_W * s);
  const dh = Math.ceil(CELL_H * s);
  for (let y = 0; y < dh; y++) {
    const sy = Math.floor(top + y);
    if (sy < 0 || sy >= H) continue;
    const cy = Math.min(CELL_H - 1, Math.floor(y / s));
    for (let x = 0; x < dw; x++) {
      const sx = Math.floor(left + x);
      if (sx < 0 || sx >= W) continue;
      let cx = Math.min(CELL_W - 1, Math.floor(x / s));
      if (f.facing === -1) cx = CELL_W - 1 - cx;
      const si = ((cy0 + cy) * sheet.w + cx0 + cx) * 4;
      const a = sheet.rgba[si + 3];
      if (a < 8) continue;
      blend(frame, ((fy0 + sy) * W + sx) * 3, sheet.rgba[si], sheet.rgba[si + 1], sheet.rgba[si + 2], a);
    }
  }
}

function shadow(frame: Buffer, fy0: number, cx: number, airborne: number): void {
  const rx = 62 - airborne * 0.08;
  const ry = 11;
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
    if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1) continue;
    const sx = Math.round(cx + x);
    const sy = FLOOR_Y + y;
    if (sx < 0 || sx >= W) continue;
    blend(frame, ((fy0 + sy) * W + sx) * 3, 0, 0, 0, 80);
  }
}

// 5×7 bitmap font for labels (this ffmpeg build has no drawtext)
const FONT: Record<string, string> = {
  A: '0111010001100011111110001100011000110001', B: '1111010001100011111010001100011000111110', C: '0111010001100001000010000100001000101110',
  D: '1111010001100011000110001100011000111110', E: '1111110000100001111010000100001000011111', F: '1111110000100001111010000100001000010000',
  G: '0111010001100001011110001100011000101111', H: '1000110001100011111110001100011000110001', I: '0111000100001000010000100001000010001110',
  K: '1000110010101001100010100100101000110001', L: '1000010000100001000010000100001000011111', M: '1000111011101011010110001100011000110001',
  N: '1000111001101011001110001100011000110001', O: '0111010001100011000110001100011000101110', P: '1111010001100011111010000100001000010000',
  R: '1111010001100011111010100100101000110001', S: '0111110000100000111000001000010000111110', T: '1111100100001000010000100001000010000100',
  U: '1000110001100011000110001100011000101110', V: '1000110001100011000110001010100101000100', W: '1000110001100011010110101101011010101010',
  X: '1000110001010100010001010100011000110001', Y: '1000110001010100010000100001000010000100', Z: '1111100001000100010001000100001000011111',
  '0': '0111010001100111010111001100011000101110', '1': '0010001100001000010000100001000010001110', '2': '0111010001000010001000100010001000011111',
  '3': '1111000001000010111000001000011000101110', '5': '1111110000111100000100001000011000101110', '9': '0111010001100010111100001000011000101110',
  '.': '0000000000000000000000000000000110001100', ':': '0000001100011000000000110001100000000000', '-': '0000000000000001111100000000000000000000',
  '/': '0000100010000100010001000010001000010000', '(': '0001000100010000100001000001000001000010', ')': '0100000100000100001000010001000100001000',
  ' ': '0000000000000000000000000000000000000000',
};
function text(frame: Buffer, fy0: number, x0: number, y0: number, str: string, scale = 2): void {
  let x = x0;
  for (const ch of str.toUpperCase()) {
    const g = FONT[ch] ?? FONT[' '];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 5; c++) {
      if (g[r * 5 + c] !== '1') continue;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const sx = x + c * scale + dx;
        const sy = y0 + r * scale + dy;
        if (sx >= 0 && sx < W && sy >= 0 && sy < H) {
          const i = ((fy0 + sy) * W + sx) * 3;
          frame[i] = 255; frame[i + 1] = 255; frame[i + 2] = 255;
        }
      }
    }
    x += 6 * scale;
  }
}
function rect(frame: Buffer, fy0: number, x: number, y: number, w: number, h: number, rgb: [number, number, number], a = 255): void {
  for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) for (let xx = Math.max(0, Math.round(x)); xx < Math.min(W, Math.round(x + w)); xx++) {
    blend(frame, ((fy0 + yy) * W + xx) * 3, rgb[0], rgb[1], rgb[2], a);
  }
}

// ------------------------------------------------------------- variants ---

interface Variant {
  label: string;
  state: GameState;
  bg: { buf: Buffer; w: number };
  /** bg x (world px of the image's left edge) for this tick */
  bgLeft: (s: GameState) => number;
  /** world x of the screen's left edge */
  viewLeft: (s: GameState) => number;
  stageExtent: [number, number];
}

const defs = characters;
function makeState(rules: Partial<MatchRules>): GameState {
  const s = initialState(P1, P2, defs, { roundTicks: 0, introTicks: 0, ...rules });
  s.phase = 'fight';
  return s;
}

const normal = bgAtHeight(join('public/assets/backgrounds/stages', `${STAGE}.jpg`), H);
const wide = bgAtHeight(WIDE, H);
const fixedState = makeState({});
const overhang = (normal.w - W) / 2;
const wideHalf = wide.w / 2;
const margin = 50;
const scrollRules = { stage: { minX: W / 2 - wideHalf + margin, maxX: W / 2 + wideHalf - margin }, camera: { width: W, margin } };
const variants: Variant[] = [
  {
    label: 'FIXED SCREEN (TODAY)',
    state: fixedState,
    bg: normal,
    // FightScene: the oversized bg slides by up to its overhang as the
    // fighters' midpoint moves (fake depth; the fighters never leave the screen)
    bgLeft: (s) => {
      const mid = (s.fighters[0].x + s.fighters[1].x) / 2;
      const t = Math.max(-1, Math.min(1, (mid - W / 2) / (W / 2)));
      return W / 2 - t * overhang - normal.w / 2;
    },
    viewLeft: () => 0,
    stageExtent: [0, W],
  },
  {
    label: `SCROLLING CAMERA - ${(wide.w / H).toFixed(1)}:1 OUTPAINTED STAGE`,
    state: makeState(scrollRules),
    bg: wide,
    bgLeft: () => W / 2 - wideHalf,
    viewLeft: (s) => cameraX(s) - W / 2,
    stageExtent: [W / 2 - wideHalf, W / 2 + wideHalf],
  },
];

// -------------------------------------------------------------- script ----
// P1 starts left facing right. "fwd" for P1 = right; for P2 = left.
function script(t: number): [Partial<InputFrame>, Partial<InputFrame>] {
  if (t < 40) return [{}, {}];
  if (t < 170) return [{ left: true }, { right: true }]; // walk apart: the view's width
  if (t < 200) return [{}, {}];
  if (t < 470) return [{ right: true }, { right: true }]; // P1 chases P2 to the right
  if (t === 480 || t === 500) return [{ lp: true }, { right: true }];
  if (t === 520) return [{ hk: true }, { right: true }];
  if (t < 600) return [{}, { right: true }]; // corner pressure, P2 blocks
  if (t < 630) return [{}, {}];
  if (t < 900) {
    if (t >= 760 && t < 766) return [{ left: true }, { up: true, left: true }]; // jump-in
    return [{ left: true }, { left: true }]; // P2 chases P1 to the left
  }
  if (t < 980) return [{}, {}];
  return [{}, {}];
}
const TICKS = 1000;

// -------------------------------------------------------------- render ----

const sheets = new Map([[P1, loadSheet(P1)], [P2, loadSheet(P2)]]);
mkdirSync(dirname(OUT), { recursive: true });
const FH = H * 2 + 6;
const enc = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${FH}`, '-r', '60', '-i', 'pipe:0',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
const write = (b: Buffer): Promise<void> => new Promise((res) => (enc.stdin.write(b) ? res() : enc.stdin.once('drain', () => res())));

const frame = Buffer.alloc(W * FH * 3);
for (let t = 0; t < TICKS; t++) {
  const [i1, i2] = script(t);
  frame.fill(0);
  for (let v = 0; v < variants.length; v++) {
    const V = variants[v];
    step(V.state, [{ ...EMPTY_INPUT, ...i1 }, { ...EMPTY_INPUT, ...i2 }], defs);
    const fy0 = v * (H + 6);
    const view = V.viewLeft(V.state);
    const bgL = Math.round(V.bgLeft(V.state) - view);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const bx = x - bgL;
        const di = ((fy0 + y) * W + x) * 3;
        if (bx < 0 || bx >= V.bg.w) { frame[di] = frame[di + 1] = frame[di + 2] = 12; continue; }
        const si = (y * V.bg.w + bx) * 3;
        frame[di] = V.bg.buf[si]; frame[di + 1] = V.bg.buf[si + 1]; frame[di + 2] = V.bg.buf[si + 2];
      }
    }
    for (const f of V.state.fighters) shadow(frame, fy0, f.x - view, FLOOR_Y - f.y);
    // draw the one further from camera first (P2 under P1 when overlapping)
    for (const f of [V.state.fighters[1], V.state.fighters[0]]) drawFighter(frame, fy0, sheets.get(f.charId)!, f, V.state.tick, view);
    // label + minimap
    rect(frame, fy0, 0, 0, W, 30, [0, 0, 0], 150);
    text(frame, fy0, 12, 8, V.label);
    const [e0, e1] = V.stageExtent;
    const mx = 280;
    const mw = 400;
    const my = H - 22;
    const scale = mw / (variants[1].stageExtent[1] - variants[1].stageExtent[0]);
    const toMap = (wx: number): number => mx + (wx - variants[1].stageExtent[0]) * scale;
    rect(frame, fy0, mx - 4, my - 6, mw + 8, 20, [0, 0, 0], 150);
    rect(frame, fy0, toMap(e0), my, (e1 - e0) * scale, 8, [90, 90, 110]);
    rect(frame, fy0, toMap(view), my - 3, W * scale, 2, [255, 255, 255]);
    rect(frame, fy0, toMap(view), my + 9, W * scale, 2, [255, 255, 255]);
    rect(frame, fy0, toMap(V.state.fighters[0].x) - 3, my - 1, 6, 10, [80, 220, 255]);
    rect(frame, fy0, toMap(V.state.fighters[1].x) - 3, my - 1, 6, 10, [255, 150, 60]);
  }
  frame.fill(255, H * W * 3, (H + 6) * W * 3); // divider between the halves
  await write(frame);
}
enc.stdin.end();
await new Promise((res) => enc.on('close', res));
console.log(`wrote ${OUT} (${TICKS} frames @60fps, ${W}x${FH})`);
console.log(`fixed: P1 ${fixedState.fighters[0].x.toFixed(0)} P2 ${fixedState.fighters[1].x.toFixed(0)} · scroll stage ${scrollRules.stage.minX}..${scrollRules.stage.maxX}`);
