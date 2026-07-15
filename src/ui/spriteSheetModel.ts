// In-browser, non-destructive working model of a character's packed sprite
// sheet, for the Sprite Editor (src/ui/SpriteEditorPanel.ts + FightScene
// spriteEditor mode). Slices the loaded sheet into per-cell PRISTINE canvases;
// geometric edits (scale / offset / flip / normalize) accumulate into a per-cell
// transform and the slot is RE-RENDERED from pristine each time — ONE resample,
// so scale-down-then-up returns to the sharp original instead of compounding
// blur, and the baked export is single-resample too. Pixel-replacing edits
// (regen / paste / swap) rewrite pristine and reset the transform. RTMPose
// keypoints stay in lockstep (derived from pristine joints under the same
// transform). The composited result mirrors into a Phaser CanvasTexture so the
// live looping fighter shows every edit immediately. Nothing touches disk until
// WRITE (POSTs exportPngBase64()/exportMeta() to /__editor/sheet).
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

/** accumulated per-cell geometric transform, applied to the pristine slice:
 *  flip → scale-about-cell-center → translate. Composes losslessly (only the
 *  final render resamples), which is what kills the scale-down/up blur. */
interface CellXf {
  s: number;
  dx: number;
  dy: number;
  fx: boolean;
  fy: boolean;
}

const IDENTITY = (): CellXf => ({ s: 1, dx: 0, dy: 0, fx: false, fy: false });

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
  private slots: HTMLCanvasElement[] = []; // per physical slot, RENDERED pixels
  private pristine: HTMLCanvasElement[] = []; // per slot, never resampled
  private xf: CellXf[] = []; // per slot, accumulated geometric transform
  private pristineSkel: Record<string, Joints>; // joints of the pristine art
  private skeletons: Record<string, Joints>; // derived: pristine joints under xf
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
    this.pristineSkel = structuredClone(this.skeletons);
    // slice each physical cell into a PRISTINE canvas; slots render from it
    for (let i = 0; i < this.frames.length; i++) {
      const c = blankCell(this.cellW, this.cellH);
      c.getContext('2d')!.drawImage(
        sheetImg,
        (i % this.cols) * this.cellW, Math.floor(i / this.cols) * this.cellH, this.cellW, this.cellH,
        0, 0, this.cellW, this.cellH,
      );
      this.pristine.push(c);
      this.xf.push(IDENTITY());
      this.slots.push(blankCell(this.cellW, this.cellH));
      this.renderSlot(i);
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

  /** re-render slot i from its pristine art under the accumulated transform
   *  (flip → scale-about-center → translate) in a SINGLE resample, and derive
   *  the cell's live keypoints from the pristine joints under the same map. */
  private renderSlot(i: number): void {
    const cx = this.cellW / 2;
    const cy = this.cellH / 2;
    const t = this.xf[i];
    const ctx = this.slots[i].getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cellW, this.cellH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(t.dx, t.dy);
    ctx.translate(cx, cy);
    ctx.scale(t.s, t.s);
    if (t.fx) ctx.scale(-1, 1);
    if (t.fy) ctx.scale(1, -1);
    ctx.drawImage(this.pristine[i], -cx, -cy);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const pj = this.pristineSkel[this.frames[i]];
    if (pj) {
      const out: Joints = {};
      for (const k in pj) out[k] = this.xformJoint(pj[k], t);
      this.skeletons[this.frames[i]] = out;
    }
  }

  /** map a pristine joint through a cell transform (matches renderSlot pixels) */
  private xformJoint(j: [number, number, number], t: CellXf): [number, number, number] {
    const cx = this.cellW / 2;
    const cy = this.cellH / 2;
    let x = j[0];
    let y = j[1];
    if (t.fx) x = this.cellW - x;
    if (t.fy) y = this.cellH - y;
    x = cx + (x - cx) * t.s;
    y = cy + (y - cy) * t.s;
    return [x + t.dx, y + t.dy, j[2]];
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

  // ---- geometric edits (accumulate transform, re-render from pristine) ----

  /** scale each selected cell's art about its center; keypoints scale to match.
   *  Composes with prior scales, so ×0.95 then ×1.0526 lands back on ×1.0 —
   *  the art is re-rendered from pristine, NOT the already-scaled raster. */
  scaleCells(indices: number[], factor: number): void {
    for (const i of indices) {
      this.xf[i].s *= factor;
      this.renderSlot(i);
    }
    this.manifest.push({ op: 'scale', cells: indices.map((i) => this.frames[i]), factor });
    this.refresh(indices);
  }

  /** translate each selected cell's art; keypoints translate to match */
  offsetCells(indices: number[], dx: number, dy: number): void {
    for (const i of indices) {
      this.xf[i].dx += dx;
      this.xf[i].dy += dy;
      this.renderSlot(i);
    }
    this.manifest.push({ op: 'offset', cells: indices.map((i) => this.frames[i]), dx, dy });
    this.refresh(indices);
  }

  /** mirror selected cells about the cell center; keypoints mirror with them. */
  flipCells(indices: number[], axis: 'x' | 'y'): void {
    for (const i of indices) {
      if (axis === 'x') this.xf[i].fx = !this.xf[i].fx;
      else this.xf[i].fy = !this.xf[i].fy;
      this.renderSlot(i);
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

  /** swap two cells' pristine art + transform + keypoints (drag-reorder): the
   *  cell that draws for a given move name now shows the other's image */
  swapCells(a: number, b: number): void {
    [this.pristine[a], this.pristine[b]] = [this.pristine[b], this.pristine[a]];
    [this.xf[a], this.xf[b]] = [this.xf[b], this.xf[a]];
    const na = this.frames[a];
    const nb = this.frames[b];
    for (const map of [this.skeletons, this.pristineSkel]) {
      const ja = map[na];
      const jb = map[nb];
      if (jb) map[na] = jb; else delete map[na];
      if (ja) map[nb] = ja; else delete map[nb];
    }
    this.renderSlot(a);
    this.renderSlot(b);
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
      this.pristine[i] = c; // pasted pixels become the new pristine art
      this.xf[i] = IDENTITY();
      this.pristineSkel[this.frames[i]] = structuredClone(this.clip.joints);
      this.renderSlot(i);
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
    this.pristine[i] = c; // regenerated pixels become the new pristine art
    this.xf[i] = IDENTITY();
    delete this.skeletons[this.frames[i]];
    delete this.pristineSkel[this.frames[i]];
    this.renderSlot(i);
    this.manifest.push({ op: 'regen-frame', cells: [this.frames[i]] });
    this.refresh([i]);
  }

  // ---- keypoints ----
  /** skeletons the user re-inferred or dragged this session (persisted as an
   *  edit overlay so a later re-pack keeps them) */
  private touchedJoints = new Set<string>();
  setKeypoints(name: string, joints: Joints): void {
    this.skeletons[name] = joints;
    this.pristineSkel[name] = structuredClone(joints); // re-inferred on current pixels
    const i = this.frames.indexOf(name);
    if (i >= 0) this.xf[i] = IDENTITY(); // joints are in the CURRENT frame, so pristine == current
    this.touchedJoints.add(name);
  }
  setJoint(name: string, joint: string, x: number, y: number): void {
    const j = (this.skeletons[name] ??= {});
    j[joint] = [x, y, j[joint]?.[2] ?? 1];
    const p = (this.pristineSkel[name] ??= {});
    p[joint] = [x, y, p[joint]?.[2] ?? 1];
    const i = this.frames.indexOf(name);
    if (i >= 0) this.xf[i] = IDENTITY();
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
   *  so tools/core/packer.mjs keeps the edits on a later re-pack. Single-resample
   *  now (rendered from pristine), so the baked overlay is sharp. */
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
