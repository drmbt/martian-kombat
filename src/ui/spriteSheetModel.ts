// In-browser, non-destructive working model of a character's packed sprite
// sheet, for the Sprite Editor (src/ui/SpriteEditorPanel.ts + FightScene
// spriteEditor mode). Slices the loaded sheet into per-cell canvases, applies
// pixel edits (scale / offset / normalize / swap / clipboard / regen) to those
// canvases in memory, keeps the RTMPose keypoints in lockstep, and mirrors the
// composited result into a Phaser CanvasTexture so the live looping fighter
// shows every edit immediately. Nothing touches disk until WRITE (which POSTs
// exportPngBase64()/exportMeta() to /__editor/sheet).
import Phaser from 'phaser';
import { FLOOR_FRAC } from '../render/coords';

export interface SheetMeta {
  cellW: number;
  cellH: number;
  cols: number;
  rows: number;
  frames: string[];
  skeletons?: Record<string, Record<string, [number, number, number]>>;
}

type Joints = Record<string, [number, number, number]>;

function blankCell(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export class SpriteSheetModel {
  readonly cellW: number;
  readonly cellH: number;
  readonly cols: number;
  readonly rows: number;
  /** physical slot i -> cell name (meta.frames order; the name↔index map the
   *  engine resolves cells by). Editing swaps pixels, not this array. */
  readonly frames: string[];
  readonly texKey: string;
  private slots: HTMLCanvasElement[] = []; // per physical slot, current pixels
  private skeletons: Record<string, Joints>;
  private working: HTMLCanvasElement;
  private wctx: CanvasRenderingContext2D;
  private tex: Phaser.Textures.CanvasTexture;
  private clip: { canvas: HTMLCanvasElement; joints: Joints } | null = null;
  readonly manifest: { op: string; cells: string[]; [k: string]: unknown }[] = [];

  constructor(private scene: Phaser.Scene, private id: string, sheetImg: CanvasImageSource, meta: SheetMeta) {
    this.cellW = meta.cellW;
    this.cellH = meta.cellH;
    this.cols = meta.cols;
    this.rows = meta.rows;
    this.frames = [...meta.frames];
    this.skeletons = structuredClone(meta.skeletons ?? {});
    // slice each physical cell out of the loaded sheet into its own canvas
    for (let i = 0; i < this.frames.length; i++) {
      const c = blankCell(this.cellW, this.cellH);
      c.getContext('2d')!.drawImage(
        sheetImg,
        (i % this.cols) * this.cellW, Math.floor(i / this.cols) * this.cellH, this.cellW, this.cellH,
        0, 0, this.cellW, this.cellH,
      );
      this.slots.push(c);
    }
    this.working = blankCell(this.cols * this.cellW, this.rows * this.cellH);
    this.wctx = this.working.getContext('2d')!;
    this.compositeAll();
    this.texKey = `sheet-${id}-edit`;
    if (this.scene.textures.exists(this.texKey)) this.scene.textures.remove(this.texKey);
    this.tex = this.scene.textures.addCanvas(this.texKey, this.working)!;
    for (let i = 0; i < this.frames.length; i++) {
      this.tex.add(i, 0, (i % this.cols) * this.cellW, Math.floor(i / this.cols) * this.cellH, this.cellW, this.cellH);
    }
    this.tex.refresh();
  }

  // ---- geometry helpers ----
  private slotX(i: number): number {
    return (i % this.cols) * this.cellW;
  }
  private slotY(i: number): number {
    return Math.floor(i / this.cols) * this.cellH;
  }
  slotCanvas(i: number): HTMLCanvasElement {
    return this.slots[i];
  }
  nameAt(i: number): string {
    return this.frames[i];
  }
  jointsFor(name: string): Joints | undefined {
    return this.skeletons[name];
  }

  private composite(i: number): void {
    this.wctx.clearRect(this.slotX(i), this.slotY(i), this.cellW, this.cellH);
    this.wctx.drawImage(this.slots[i], this.slotX(i), this.slotY(i));
  }
  private compositeAll(): void {
    this.wctx.clearRect(0, 0, this.working.width, this.working.height);
    for (let i = 0; i < this.slots.length; i++) this.composite(i);
  }
  private refresh(indices: number[]): void {
    for (const i of indices) this.composite(i);
    this.alphaBoxCache.clear(); // silhouettes changed
    this.tex.refresh();
  }

  // ---- alpha silhouette bbox (cell space) — for the editor's soft outline ----
  private alphaBoxCache = new Map<string, { x0: number; y0: number; x1: number; y1: number } | null>();
  alphaBoxForName(name: string): { x0: number; y0: number; x1: number; y1: number } | null {
    if (this.alphaBoxCache.has(name)) return this.alphaBoxCache.get(name)!;
    const i = this.frames.indexOf(name);
    const box = i >= 0 ? this.computeAlphaBox(this.slots[i]) : null;
    this.alphaBoxCache.set(name, box);
    return box;
  }
  private computeAlphaBox(cv: HTMLCanvasElement): { x0: number; y0: number; x1: number; y1: number } | null {
    const { data } = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height);
    let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        if (data[(y * cv.width + x) * 4 + 3] > 16) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
  }

  // ---- pixel edits (mutate slot canvas + keypoints in lockstep) ----

  /** scale each selected cell's art about its center; keypoints scale to match */
  scaleCells(indices: number[], factor: number): void {
    const cx = this.cellW / 2;
    const cy = this.cellH / 2;
    for (const i of indices) {
      const src = this.slots[i];
      const out = blankCell(this.cellW, this.cellH);
      const ctx = out.getContext('2d')!;
      ctx.translate(cx, cy);
      ctx.scale(factor, factor);
      ctx.drawImage(src, -cx, -cy);
      this.slots[i] = out;
      const j = this.skeletons[this.frames[i]];
      if (j) for (const k in j) j[k] = [cx + (j[k][0] - cx) * factor, cy + (j[k][1] - cy) * factor, j[k][2]];
    }
    this.manifest.push({ op: 'scale', cells: indices.map((i) => this.frames[i]), factor });
    this.refresh(indices);
  }

  /** translate each selected cell's art; keypoints translate to match */
  offsetCells(indices: number[], dx: number, dy: number): void {
    for (const i of indices) {
      const src = this.slots[i];
      const out = blankCell(this.cellW, this.cellH);
      out.getContext('2d')!.drawImage(src, dx, dy);
      this.slots[i] = out;
      const j = this.skeletons[this.frames[i]];
      if (j) for (const k in j) j[k] = [j[k][0] + dx, j[k][1] + dy, j[k][2]];
    }
    this.manifest.push({ op: 'offset', cells: indices.map((i) => this.frames[i]), dx, dy });
    this.refresh(indices);
  }

  /** mirror selected cells in place; keypoints mirror with the pixels. */
  flipCells(indices: number[], axis: 'x' | 'y'): void {
    for (const i of indices) {
      const src = this.slots[i];
      const out = blankCell(this.cellW, this.cellH);
      const ctx = out.getContext('2d')!;
      if (axis === 'x') {
        ctx.translate(this.cellW, 0);
        ctx.scale(-1, 1);
      } else {
        ctx.translate(0, this.cellH);
        ctx.scale(1, -1);
      }
      ctx.drawImage(src, 0, 0);
      this.slots[i] = out;
      const j = this.skeletons[this.frames[i]];
      if (j) {
        for (const k in j) {
          j[k] = axis === 'x'
            ? [this.cellW - j[k][0], j[k][1], j[k][2]]
            : [j[k][0], this.cellH - j[k][1], j[k][2]];
        }
      }
    }
    this.manifest.push({ op: 'flip', cells: indices.map((i) => this.frames[i]), axis });
    this.refresh(indices);
  }

  /** floor-align each selected cell: shift so its lowest opaque row lands on
   *  FLOOR_FRAC*cellH (the in-browser twin of tools/qa/normalize_floor.py) */
  normalizeCells(indices: number[]): void {
    const target = Math.round(FLOOR_FRAC * this.cellH);
    for (const i of indices) {
      const sole = this.soleY(this.slots[i]);
      if (sole == null) continue;
      this.offsetCells([i], 0, target - sole);
    }
  }

  private soleY(cv: HTMLCanvasElement): number | null {
    const { data } = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height);
    for (let y = cv.height - 1; y >= 0; y--) {
      for (let x = 0; x < cv.width; x++) {
        if (data[(y * cv.width + x) * 4 + 3] > 16) return y;
      }
    }
    return null;
  }

  /** swap two cells' art + keypoints (drag-reorder): the cell that draws for a
   *  given move name now shows the other's image */
  swapCells(a: number, b: number): void {
    [this.slots[a], this.slots[b]] = [this.slots[b], this.slots[a]];
    const na = this.frames[a];
    const nb = this.frames[b];
    const ja = this.skeletons[na];
    const jb = this.skeletons[nb];
    if (ja) this.skeletons[nb] = ja;
    else delete this.skeletons[nb];
    if (jb) this.skeletons[na] = jb;
    else delete this.skeletons[na];
    this.manifest.push({ op: 'swap', cells: [na, nb] });
    this.refresh([a, b]);
  }

  copyCell(i: number): void {
    const c = blankCell(this.cellW, this.cellH);
    c.getContext('2d')!.drawImage(this.slots[i], 0, 0);
    this.clip = { canvas: c, joints: structuredClone(this.skeletons[this.frames[i]] ?? {}) };
  }

  pasteInto(indices: number[]): void {
    if (!this.clip) return;
    for (const i of indices) {
      const c = blankCell(this.cellW, this.cellH);
      c.getContext('2d')!.drawImage(this.clip.canvas, 0, 0);
      this.slots[i] = c;
      this.skeletons[this.frames[i]] = structuredClone(this.clip.joints);
    }
    this.manifest.push({ op: 'paste', cells: indices.map((i) => this.frames[i]) });
    this.refresh(indices);
  }

  hasClipboard(): boolean {
    return this.clip !== null;
  }

  /** drop new art (e.g. a nano-banana regen) into a cell; keypoints for that
   *  cell are cleared until re-inferred (Regen keypoints) */
  replaceCellImage(i: number, img: CanvasImageSource): void {
    const c = blankCell(this.cellW, this.cellH);
    c.getContext('2d')!.drawImage(img, 0, 0, this.cellW, this.cellH);
    this.slots[i] = c;
    delete this.skeletons[this.frames[i]];
    this.manifest.push({ op: 'regen-frame', cells: [this.frames[i]] });
    this.refresh([i]);
  }

  // ---- keypoints ----
  /** skeletons the user re-inferred or dragged this session (persisted as an
   *  edit overlay so a later re-pack keeps them) */
  private touchedJoints = new Set<string>();
  setKeypoints(name: string, joints: Joints): void {
    this.skeletons[name] = joints;
    this.touchedJoints.add(name);
  }
  setJoint(name: string, joint: string, x: number, y: number): void {
    const j = (this.skeletons[name] ??= {});
    j[joint] = [x, y, j[joint]?.[2] ?? 1];
    this.touchedJoints.add(name);
  }

  /** the current pixels of a cell as a keyed 288×384 PNG (base64, no prefix) —
   *  for POSTing to /__editor/skeleton-regen or as a gen-frame reference */
  cellPngBase64(i: number): string {
    return this.slots[i].toDataURL('image/png').split(',')[1];
  }

  // ---- export / WRITE ----
  exportPngBase64(): string {
    return this.working.toDataURL('image/png').split(',')[1];
  }
  /** every cell whose PIXELS were edited this session (from the op manifest) —
   *  the overlay set /__editor/sheet persists to assets/raw/edits/<id>/cells/
   *  so tools/core/packer.mjs keeps the edits on a later re-pack */
  exportEditedCells(): { name: string; pngBase64: string }[] {
    const names = new Set(this.manifest.flatMap((m) => m.cells));
    const out: { name: string; pngBase64: string }[] = [];
    for (const name of names) {
      const i = this.frames.indexOf(name);
      if (i >= 0) out.push({ name, pngBase64: this.cellPngBase64(i) });
    }
    return out;
  }
  /** skeletons that must survive a re-pack: dragged/re-inferred joints PLUS
   *  the (auto-shifted) joints of every pixel-edited cell — a re-pack would
   *  otherwise re-bake the stale QA-report joints against the edited pixels */
  exportEditedSkeletons(): Record<string, Joints> {
    const names = new Set([...this.touchedJoints, ...this.manifest.flatMap((m) => m.cells)]);
    const out: Record<string, Joints> = {};
    for (const n of names) if (this.skeletons[n]) out[n] = this.skeletons[n];
    return out;
  }
  exportMeta(): SheetMeta {
    return {
      cellW: this.cellW,
      cellH: this.cellH,
      cols: this.cols,
      rows: this.rows,
      frames: [...this.frames],
      ...(Object.keys(this.skeletons).length ? { skeletons: this.skeletons } : {}),
    };
  }

  dispose(): void {
    if (this.scene.textures.exists(this.texKey)) this.scene.textures.remove(this.texKey);
  }
}
