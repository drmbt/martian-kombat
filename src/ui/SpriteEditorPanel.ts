// Dev-only Sprite Editor inspector (FightScene spriteEditor mode). Center
// column = sprite grid + selected-cell preview; right sidebar = Sprite/Moves
// tabs. All edits are non-destructive in browser memory (SpriteSheetModel +
// in-place mutation of the live `characters` def) until an explicit WRITE:
//   WRITE MOVES → /__editor/character   WRITE SHEET → /__editor/sheet
// The looping fighter on the left is FightScene rendering the same model +
// def, so every edit shows live. Skeleton/hitbox drag happen on that canvas
// (FightScene); this panel drives selection, sliders, batch ops, and gen.
import type { Box, CharacterDef, MoveDef, SpecialInput } from '../engine';
import type { SpriteSheetModel } from './spriteSheetModel';
import { hitboxFromSkeleton, strikeKind } from './hitboxFromSkeleton';
import { writeCharacterMoves, writeFlattenedCharacter } from './moveWriteback';
import { setCharacterScale, resetScaleBase } from '../data/characterScale';
import { FLOOR_FRAC } from '../render/coords';
import { renderScale } from '../render/geometry';

/** what the panel needs from FightScene (structural — FightScene satisfies it) */
export interface SpriteEditorHost {
  loopMove(moveId: string): void;
  manualControl(): void;
  pauseLoop(paused: boolean): void;
  setLoopInterval(pauseTicks: number): void;
  setEditorMove(moveId: string): void;
  setShowSkeleton(on: boolean): void;
  setShowHitbox(on: boolean): void;
  /** convert an origin-relative CELL-space box (as hitboxFromSkeleton returns)
   *  into an engine move.hitbox that draws (worldBox) exactly over the art —
   *  uses the sprite's render scale + y offset, NOT the character scale */
  cellBoxToHitbox(box: Box): Box;
}

const POSE_IDLE = '__idle__';
const POSE_WALK = '__walk__';

const THUMB_W = 54;
const THUMB_H = 72;

export class SpriteEditorPanel {
  private el: HTMLDivElement;
  private gridEl!: HTMLDivElement;
  private previewCanvas!: HTMLCanvasElement;
  private sideEl!: HTMLDivElement;
  private statusEl!: HTMLDivElement;
  private tab: 'sprite' | 'moves' = 'moves';
  private selection = new Set<number>();
  private primary = 0;
  private moveId: string;
  private showSkeleton = true;
  private showHitbox = true;
  private dragFrom: number | null = null;
  private thumbs: HTMLCanvasElement[] = [];
  private genPrompt = '';
  private genUseOriginal = true;
  /** preview control mode: keyboard, loop the edit move, or a pose */
  private ctrl: 'manual' | 'loop' | 'idle' | 'walk' = 'loop';
  private loopPaused = false;
  private loopMs = 400;
  private gridWrap!: HTMLDivElement;
  private centerEl!: HTMLDivElement;
  private topRow!: HTMLDivElement;
  private sideWrap!: HTMLDivElement;
  private gridH = 300;
  private previewW = 150;
  private sideW = 300;
  private gridCollapsed = false;
  private sideCollapsed = false;
  /** the grid slot a range-select (shift+click) extends FROM */
  private anchor = 0;
  private writeMovesWanted = true;
  private writeSheetWanted = true;
  private flattenWanted = false;

  constructor(
    host: HTMLElement,
    private def: CharacterDef,
    private model: SpriteSheetModel,
    private scene: SpriteEditorHost,
  ) {
    this.moveId = Object.keys(def.moves)[0] ?? '';
    this.el = document.createElement('div');
    // bottom:10% leaves the lower-right corner clear so the (canvas-rendered,
    // always-behind-DOM) volume/mute overlay stays visible + clickable
    this.el.style.cssText =
      'position:absolute;left:34%;right:0;top:0;bottom:10%;display:flex;gap:8px;pointer-events:none;' +
      'font:12px monospace;color:#eaf6fb;z-index:8;padding:8px;box-sizing:border-box;';
    host.appendChild(this.el);

    // center column: [grid header] then a row of [preview | width-handle | grid]
    this.centerEl = document.createElement('div');
    this.centerEl.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:4px;pointer-events:auto;min-width:0;';
    this.centerEl.appendChild(this.collapseHeader('SPRITE GRID', () => this.gridCollapsed, (v) => this.setGridCollapsed(v)));

    this.topRow = document.createElement('div');
    this.topRow.style.cssText = `display:flex;align-items:flex-start;gap:4px;height:${this.gridH}px;`;
    // selected-cell preview, stuck to the upper-left beside the grid
    this.previewCanvas = document.createElement('canvas');
    this.previewCanvas.width = this.model.cellW / 2;
    this.previewCanvas.height = this.model.cellH / 2;
    this.previewCanvas.style.cssText =
      `flex:none;width:${this.previewW}px;height:auto;background:rgba(10,14,18,.7);border:1px solid #3f6070;border-radius:4px;`;
    this.topRow.appendChild(this.previewCanvas);
    // width handle: drag to resize the preview, moving the grid's left edge
    this.topRow.appendChild(this.resizeHandle('ew', (dx) => this.setPreviewW(this.previewW + dx)));
    // grid (fills the rest of the row; its own bottom handle resizes height)
    this.gridWrap = document.createElement('div');
    this.gridWrap.style.cssText = 'flex:1;min-width:0;height:100%;display:flex;flex-direction:column;';
    this.gridEl = document.createElement('div');
    this.gridEl.style.cssText =
      'flex:1;overflow-y:auto;display:flex;flex-wrap:wrap;gap:3px;align-content:flex-start;' +
      'background:rgba(10,14,18,.55);border:1px solid #2a3a44;border-radius:4px;padding:6px;';
    this.gridWrap.appendChild(this.gridEl);
    this.gridWrap.appendChild(this.resizeHandle('ns', (dy) => this.setGridH(this.gridH + dy)));
    this.topRow.appendChild(this.gridWrap);
    this.centerEl.appendChild(this.topRow);
    this.el.appendChild(this.centerEl);

    // right sidebar, with a drag-to-resize handle on its left edge
    const sideWrap = document.createElement('div');
    sideWrap.style.cssText = `width:${this.sideW}px;display:flex;pointer-events:auto;`;
    sideWrap.appendChild(this.resizeHandle('ew', (dx) => this.setSideW(this.sideW - dx)));
    this.sideEl = document.createElement('div');
    this.sideEl.style.cssText =
      'flex:1;overflow-y:auto;background:rgba(10,14,18,.72);' +
      'border:1px solid #3f6070;border-radius:4px;padding:10px;box-sizing:border-box;min-width:0;';
    sideWrap.appendChild(this.sideEl);
    this.el.appendChild(sideWrap);
    this.sideWrap = sideWrap;

    document.addEventListener('keydown', this.onKey);
    this.el.addEventListener('keydown', this.stopFormKeys, true);
    this.el.addEventListener('keyup', this.stopFormKeys, true);
    this.scene.setShowHitbox(this.showHitbox);
    this.scene.setShowSkeleton(this.showSkeleton);
    this.scene.setEditorMove(this.moveId);
    this.scene.loopMove(this.moveId);
    this.select(0);
    this.renderGrid();
    this.renderSide();
  }

  dispose(): void {
    document.removeEventListener('keydown', this.onKey);
    this.el.removeEventListener('keydown', this.stopFormKeys, true);
    this.el.removeEventListener('keyup', this.stopFormKeys, true);
    this.el.remove();
  }

  // ---------- resize / collapse ----------
  private resizeHandle(orient: 'ns' | 'ew', onDelta: (d: number) => void): HTMLDivElement {
    const ns = orient === 'ns';
    const h = document.createElement('div');
    h.style.cssText = ns
      ? 'height:7px;cursor:ns-resize;background:#2a3a44;border-radius:3px;margin-top:2px;flex:none;'
      : 'width:7px;cursor:ew-resize;background:#2a3a44;border-radius:3px;flex:none;';
    h.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      let last = ns ? e.clientY : e.clientX;
      const move = (ev: PointerEvent) => {
        const cur = ns ? ev.clientY : ev.clientX;
        onDelta(cur - last);
        last = cur;
      };
      const up = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });
    return h;
  }

  private collapseHeader(title: string, get: () => boolean, set: (v: boolean) => void): HTMLDivElement {
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;color:#7fe3ff;font-weight:bold;user-select:none;';
    const caret = document.createElement('span');
    const label = document.createElement('span');
    label.textContent = title;
    const sync = () => (caret.textContent = get() ? '▸' : '▾');
    sync();
    bar.appendChild(caret);
    bar.appendChild(label);
    bar.addEventListener('click', () => {
      set(!get());
      sync();
    });
    return bar;
  }

  private setGridCollapsed(v: boolean): void {
    this.gridCollapsed = v;
    this.gridWrap.style.display = v ? 'none' : 'flex';
  }
  private setGridH(h: number): void {
    this.gridH = Math.max(80, Math.min(620, h));
    this.topRow.style.height = `${this.gridH}px`;
  }
  private setPreviewW(w: number): void {
    this.previewW = Math.max(60, Math.min(360, w));
    this.previewCanvas.style.width = `${this.previewW}px`;
  }
  private setSideW(w: number): void {
    this.sideW = Math.max(180, Math.min(680, w));
    if (!this.sideCollapsed) this.sideWrap.style.width = `${this.sideW}px`;
  }
  private setSideCollapsed(v: boolean): void {
    this.sideCollapsed = v;
    this.sideWrap.style.width = v ? '24px' : `${this.sideW}px`;
    this.renderSide();
  }

  // ---------- grid ----------
  private renderGrid(): void {
    this.gridEl.innerHTML = '';
    this.thumbs = [];
    for (let i = 0; i < this.model.frames.length; i++) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:' + THUMB_W + 'px;';
      const cv = document.createElement('canvas');
      cv.width = THUMB_W;
      cv.height = THUMB_H;
      cv.draggable = true;
      cv.style.cssText = 'border:2px solid ' + (this.selection.has(i) ? '#7fe3ff' : '#2a3a44') + ';border-radius:3px;cursor:pointer;background:#0b0e12;';
      cv.getContext('2d')!.drawImage(this.model.slotCanvas(i), 0, 0, THUMB_W, THUMB_H);
      const label = document.createElement('div');
      label.textContent = this.model.nameAt(i);
      label.style.cssText = 'font-size:8px;color:#8fa6b2;max-width:' + THUMB_W + 'px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      cv.addEventListener('click', (e) => {
        if (e.shiftKey) this.selectRange(i);
        else if (e.ctrlKey || e.metaKey) this.toggle(i);
        else this.select(i);
      });
      cv.addEventListener('dragstart', () => (this.dragFrom = i));
      cv.addEventListener('dragover', (e) => e.preventDefault());
      cv.addEventListener('drop', (e) => {
        e.preventDefault();
        if (this.dragFrom != null && this.dragFrom !== i) {
          this.model.swapCells(this.dragFrom, i);
          this.renderGrid();
          this.updatePreview();
        }
        this.dragFrom = null;
      });
      wrap.appendChild(cv);
      wrap.appendChild(label);
      this.gridEl.appendChild(wrap);
      this.thumbs.push(cv);
    }
  }

  private redrawThumb(i: number): void {
    const cv = this.thumbs[i];
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, THUMB_W, THUMB_H);
    ctx.drawImage(this.model.slotCanvas(i), 0, 0, THUMB_W, THUMB_H);
  }

  private select(i: number): void {
    this.selection = new Set([i]);
    this.primary = i;
    this.anchor = i;
    this.syncSelectionBorders();
    this.updatePreview();
    if (this.tab === 'sprite') this.renderSide();
  }
  /** shift+click: select the contiguous range from the anchor to i */
  private selectRange(i: number): void {
    const lo = Math.min(this.anchor, i);
    const hi = Math.max(this.anchor, i);
    this.selection = new Set();
    for (let k = lo; k <= hi; k++) this.selection.add(k);
    this.primary = i;
    this.syncSelectionBorders();
    this.updatePreview();
    if (this.tab === 'sprite') this.renderSide();
  }
  private toggle(i: number): void {
    if (this.selection.has(i)) this.selection.delete(i);
    else this.selection.add(i);
    this.primary = i;
    this.syncSelectionBorders();
    this.updatePreview();
    if (this.tab === 'sprite') this.renderSide();
  }
  private syncSelectionBorders(): void {
    this.thumbs.forEach((cv, i) => (cv.style.borderColor = this.selection.has(i) ? '#7fe3ff' : '#2a3a44'));
  }

  private updatePreview(): void {
    const ctx = this.previewCanvas.getContext('2d')!;
    const w = this.previewCanvas.width;
    const h = this.previewCanvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.model.slotCanvas(this.primary), 0, 0, w, h);
    // floor inset line
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 1;
    const fy = Math.round(FLOOR_FRAC * h);
    ctx.beginPath();
    ctx.moveTo(0, fy);
    ctx.lineTo(w, fy);
    ctx.stroke();
  }

  // ---------- sidebar ----------
  private renderSide(): void {
    this.sideEl.innerHTML = '';
    if (this.sideCollapsed) {
      const b = this.button('◀', '#7fe3ff', () => this.setSideCollapsed(false));
      b.style.cssText += 'writing-mode:vertical-rl;padding:8px 2px;';
      b.title = 'expand inspector';
      this.sideEl.appendChild(b);
      return;
    }

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;';
    head.appendChild(this.h(`SPRITE EDITOR · ${this.def.id}`, 14, '#7fe3ff'));
    const collapse = this.button('▶', '#8fa6b2', () => this.setSideCollapsed(true));
    collapse.title = 'collapse inspector';
    head.appendChild(collapse);
    this.sideEl.appendChild(head);

    const tabs = document.createElement('div');
    tabs.style.cssText = 'display:flex;gap:8px;margin:8px 0;';
    for (const t of ['moves', 'sprite'] as const) {
      tabs.appendChild(this.radio('tab', t, this.tab === t, () => {
        this.tab = t;
        this.renderSide();
      }));
    }
    this.sideEl.appendChild(tabs);

    this.sideEl.appendChild(this.toggleRow());

    // character scale — resizes the whole fighter (art + hurt/hit boxes +
    // joints + projectiles) live; written back with the moves
    this.sideEl.appendChild(this.h('character scale', 11, '#8fa6b2'));
    this.sideEl.appendChild(
      this.slider('scale', 0.5, 2, 0.01, this.def.scale ?? 1, (n) => {
        setCharacterScale(this.def, n);
        // re-scale keeps the same box object refs (in place), so the open
        // move's hitbox sliders stay live — no full re-render needed
      }),
    );

    if (this.tab === 'moves') this.renderMovesTab();
    else this.renderSpriteTab();

    this.statusEl = document.createElement('div');
    this.statusEl.style.cssText = 'margin-top:8px;color:#8fa6b2;white-space:normal;';
    this.sideEl.appendChild(this.statusEl);
  }

  /** apply the current preview control mode to the fighter */
  private applyCtrl(): void {
    if (this.ctrl === 'manual') this.scene.manualControl();
    else if (this.ctrl === 'idle') this.scene.loopMove(POSE_IDLE);
    else if (this.ctrl === 'walk') this.scene.loopMove(POSE_WALK);
    else this.scene.loopMove(this.moveId);
  }

  private toggleRow(): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:12px;margin:4px 0 8px;';
    row.appendChild(this.checkbox('skeleton', this.showSkeleton, (on) => {
      this.showSkeleton = on;
      this.scene.setShowSkeleton(on);
    }));
    row.appendChild(this.checkbox('hitboxes', this.showHitbox, (on) => {
      this.showHitbox = on;
      this.scene.setShowHitbox(on);
    }));
    return row;
  }

  private renderMovesTab(): void {
    const move = this.def.moves[this.moveId];
    const sel = document.createElement('select');
    sel.style.cssText = 'width:100%;background:#172230;color:#eaf6fb;border:1px solid #3f6070;padding:3px;margin-bottom:6px;';
    for (const id of Object.keys(this.def.moves)) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = id + (this.def.moves[id].name ? ` · ${this.def.moves[id].name}` : '');
      sel.appendChild(o);
    }
    sel.value = this.moveId;
    sel.addEventListener('change', () => {
      this.moveId = sel.value;
      this.scene.setEditorMove(this.moveId);
      if (this.ctrl === 'loop') this.scene.loopMove(this.moveId);
      this.renderSide();
    });
    this.sideEl.appendChild(sel);

    // preview control: keyboard, loop the edit move, or idle/walk pose
    this.sideEl.appendChild(this.h('preview', 11, '#8fa6b2'));
    const ctrlRow = document.createElement('div');
    ctrlRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:2px 0;';
    for (const m of ['manual', 'loop', 'idle', 'walk'] as const) {
      ctrlRow.appendChild(this.radio('ctrl', m, this.ctrl === m, () => {
        this.ctrl = m;
        this.applyCtrl();
        this.renderSide();
      }));
    }
    this.sideEl.appendChild(ctrlRow);
    if (this.ctrl === 'loop' || this.ctrl === 'idle' || this.ctrl === 'walk') {
      const loopRow = document.createElement('div');
      loopRow.style.cssText = 'display:flex;gap:6px;align-items:center;margin:2px 0;';
      const pause = this.button(this.loopPaused ? 'resume' : 'pause', '#ffd24a', () => {
        this.loopPaused = !this.loopPaused;
        this.scene.pauseLoop(this.loopPaused);
        this.renderSide();
      });
      loopRow.appendChild(pause);
      this.sideEl.appendChild(loopRow);
      this.sideEl.appendChild(this.slider('timer ms', 0, 2000, 20, this.loopMs, (n) => {
        this.loopMs = n;
        this.scene.setLoopInterval(Math.round((n / 1000) * 60));
      }));
    }

    if (move.input) {
      this.sideEl.appendChild(this.h('special input', 11, '#8fa6b2'));
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;margin:2px 0 6px;';
      const motion = document.createElement('select');
      motion.style.cssText = 'flex:1;background:#172230;color:#eaf6fb;border:1px solid #3f6070;padding:3px;';
      for (const m of ['', 'qcf', 'qcb', 'bf', 'cbf', 'dp', 'hcb', 'hcf', '360', 'du']) {
        const o = document.createElement('option');
        o.value = m;
        o.textContent = m || 'no motion';
        motion.appendChild(o);
      }
      motion.value = move.input.motion ?? '';
      motion.addEventListener('change', () => {
        if (motion.value) move.input!.motion = motion.value as SpecialInput['motion'];
        else delete move.input!.motion;
      });
      const btn = document.createElement('select');
      btn.style.cssText = 'flex:1;background:#172230;color:#eaf6fb;border:1px solid #3f6070;padding:3px;';
      for (const b of ['punch', 'kick', 'PPP', 'KKK', 'LPLK'] as const) {
        const o = document.createElement('option');
        o.value = b;
        o.textContent = b;
        btn.appendChild(o);
      }
      btn.value = move.input.button;
      btn.addEventListener('change', () => (move.input!.button = btn.value as SpecialInput['button']));
      row.append(motion, btn);
      this.sideEl.appendChild(row);
    }

    this.sideEl.appendChild(this.h('timing', 11, '#8fa6b2'));
    for (const f of ['startup', 'active', 'recovery'] as const) {
      this.sideEl.appendChild(this.slider(f, 1, 60, 1, move[f], (n) => ((move as unknown as Record<string, number>)[f] = n)));
    }

    if (move.hitbox) {
      this.sideEl.appendChild(this.h('hitbox', 11, '#8fa6b2'));
      const ranges: Record<string, [number, number]> = { x: [-200, 260], y: [-360, 20], w: [4, 300], h: [4, 300] };
      for (const f of ['x', 'y', 'w', 'h'] as const) {
        this.sideEl.appendChild(this.slider(f, ranges[f][0], ranges[f][1], 1, move.hitbox[f], (n) => (move.hitbox![f] = n)));
      }
    } else {
      const none = document.createElement('div');
      none.textContent = 'no hitbox (projectile / utility move)';
      none.style.cssText = 'color:#8fa6b2;margin:4px 0;';
      this.sideEl.appendChild(none);
    }

    const autoRow = document.createElement('div');
    autoRow.style.cssText = 'display:flex;gap:6px;margin:6px 0;';
    autoRow.appendChild(this.button('auto hitbox', '#ffd24a', () => this.autoHitbox([this.moveId])));
    autoRow.appendChild(this.button('auto ALL', '#ffd24a', () => this.autoHitbox(Object.keys(this.def.moves))));
    this.sideEl.appendChild(autoRow);

    this.renderWriteBatch();
  }

  private renderSpriteTab(): void {
    const info = document.createElement('div');
    info.textContent = `${this.selection.size} selected · primary: ${this.model.nameAt(this.primary)}`;
    info.style.cssText = 'margin:4px 0;color:#bff0ff;';
    this.sideEl.appendChild(info);

    this.sideEl.appendChild(this.h('transform (selected)', 11, '#8fa6b2'));
    const sel = () => [...this.selection];
    const scaleRow = document.createElement('div');
    scaleRow.style.cssText = 'display:flex;gap:6px;margin:2px 0;flex-wrap:wrap;';
    scaleRow.appendChild(this.button('scale −', '#eaf6fb', () => { this.model.scaleCells(sel(), 0.95); this.afterEdit(); }));
    scaleRow.appendChild(this.button('scale +', '#eaf6fb', () => { this.model.scaleCells(sel(), 1.0526); this.afterEdit(); }));
    scaleRow.appendChild(this.button('normalize', '#eaf6fb', () => { this.model.normalizeCells(sel()); this.afterEdit(); }));
    scaleRow.appendChild(this.button('flip X', '#eaf6fb', () => { this.model.flipCells(sel(), 'x'); this.afterEdit(); }));
    scaleRow.appendChild(this.button('flip Y', '#eaf6fb', () => { this.model.flipCells(sel(), 'y'); this.afterEdit(); }));
    this.sideEl.appendChild(scaleRow);
    const offRow = document.createElement('div');
    offRow.style.cssText = 'display:flex;gap:6px;margin:2px 0;flex-wrap:wrap;';
    for (const [lbl, dx, dy] of [['◀', -4, 0], ['▶', 4, 0], ['▲', 0, -4], ['▼', 0, 4]] as const) {
      offRow.appendChild(this.button(lbl, '#eaf6fb', () => { this.model.offsetCells(sel(), dx, dy); this.afterEdit(); }));
    }
    this.sideEl.appendChild(offRow);

    this.sideEl.appendChild(this.h('cells', 11, '#8fa6b2'));
    const clipRow = document.createElement('div');
    clipRow.style.cssText = 'display:flex;gap:6px;margin:2px 0;';
    clipRow.appendChild(this.button('copy (C)', '#eaf6fb', () => this.model.copyCell(this.primary)));
    clipRow.appendChild(this.button('paste (V)', '#eaf6fb', () => (this.model.pasteInto(sel()), this.afterEdit())));
    clipRow.appendChild(this.button('select all', '#eaf6fb', () => this.selectAll()));
    this.sideEl.appendChild(clipRow);
    const hint = document.createElement('div');
    hint.textContent = 'shift+click range · ctrl/⌘+click toggle · shift+A all · drag→swap';
    hint.style.cssText = 'font-size:10px;color:#6f818c;margin:2px 0 6px;';
    this.sideEl.appendChild(hint);

    this.sideEl.appendChild(this.h('skeleton', 11, '#8fa6b2'));
    this.sideEl.appendChild(this.wideButton('regen keypoints (selected · DWPose)', '#ffd24a', () => this.regenKeypoints()));

    this.sideEl.appendChild(this.h('regenerate frame (nano-banana)', 11, '#8fa6b2'));
    const ta = document.createElement('textarea');
    ta.value = this.genPrompt;
    ta.placeholder = 'pose / change to generate…';
    ta.style.cssText = 'width:100%;height:52px;background:#172230;color:#eaf6fb;border:1px solid #3f6070;box-sizing:border-box;';
    ta.addEventListener('input', () => (this.genPrompt = ta.value));
    this.sideEl.appendChild(ta);
    this.sideEl.appendChild(this.checkbox('use original as reference', this.genUseOriginal, (on) => (this.genUseOriginal = on)));
    this.sideEl.appendChild(this.wideButton('GENERATE → replace selected', '#ff8adf', () => this.regenFrame()));

    this.renderWriteBatch();
  }

  private renderWriteBatch(): void {
    this.sideEl.appendChild(this.h('write changes', 11, '#8fa6b2'));
    const box = document.createElement('div');
    box.style.cssText = 'border:1px solid #2a3a44;border-radius:4px;padding:6px;margin-top:4px;background:rgba(11,14,18,.55);';
    box.appendChild(this.checkbox('moves → character.json', this.writeMovesWanted, (on) => (this.writeMovesWanted = on)));
    box.appendChild(this.checkbox('sheet → sheet.png/meta', this.writeSheetWanted, (on) => (this.writeSheetWanted = on)));
    box.appendChild(this.checkbox('commit scale/offset identity', this.flattenWanted, (on) => {
      this.flattenWanted = on;
      if (on) {
        this.writeMovesWanted = false;
        this.writeSheetWanted = false;
        this.renderSide();
      }
    }));
    const note = document.createElement('div');
    note.textContent = 'One submit writes selected changes before Vite refreshes the page.';
    note.style.cssText = 'font-size:10px;color:#6f818c;margin:4px 0;';
    box.appendChild(note);
    box.appendChild(this.wideButton('APPLY SELECTED WRITES', '#6fe36f', () => this.applyWrites()));
    this.sideEl.appendChild(box);
  }

  private afterEdit(): void {
    for (const i of this.selection) this.redrawThumb(i);
    this.updatePreview();
  }

  private selectAll(): void {
    this.selection = new Set(this.model.frames.map((_, i) => i));
    this.syncSelectionBorders();
    if (this.tab === 'sprite') this.renderSide();
  }

  // ---------- actions ----------
  private autoHitbox(moveIds: string[]): void {
    let done = 0;
    let skipped = 0;
    for (const mid of moveIds) {
      const move = this.def.moves[mid];
      if (!move.hitbox) continue; // projectile/utility — leave alone
      const cell = this.model.jointsFor(`${mid}-active`) ?? this.model.jointsFor(mid);
      if (!cell) {
        skipped++;
        continue;
      }
      const box = hitboxFromSkeleton(cell, strikeKind(mid, move));
      if (!box) {
        skipped++;
        continue;
      }
      // box is in origin-relative CELL space; the host converts it to an engine
      // hitbox at the sprite's RENDER scale so it draws over the art (the
      // character scale is a separate collision multiplier — see cellBoxToHitbox)
      move.hitbox = this.scene.cellBoxToHitbox(box);
      done++;
    }
    if (this.tab === 'moves') this.renderSide();
    this.status(`auto hitbox: ${done} set, ${skipped} skipped (no keypoints)`, '#6fe36f');
  }

  private async regenKeypoints(): Promise<void> {
    const cells = [...this.selection].map((i) => ({ name: this.model.nameAt(i), pngBase64: this.model.cellPngBase64(i) }));
    if (!cells.length) return;
    this.status('inferring keypoints…', '#7fe3ff');
    try {
      const res = await fetch('/__editor/skeleton-regen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: this.def.id, cells }),
      });
      const json = (await res.json()) as { ok?: boolean; keypoints?: Record<string, Record<string, [number, number, number]>>; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      for (const [name, kp] of Object.entries(json.keypoints ?? {})) this.model.setKeypoints(name, kp);
      this.status(`keypoints refreshed for ${Object.keys(json.keypoints ?? {}).length} cells`, '#6fe36f');
    } catch (err) {
      this.status(`regen failed (${String(err)})`, '#ff7a6a');
    }
  }

  private async regenFrame(): Promise<void> {
    if (!this.genPrompt.trim()) return this.status('enter a prompt first', '#ff7a6a');
    const targets = [...this.selection];
    this.status(`generating ${targets.length} frame(s)…`, '#7fe3ff');
    for (const i of targets) {
      try {
        const refs = this.genUseOriginal ? [this.model.cellPngBase64(i)] : [];
        const res = await fetch('/__editor/gen-frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: this.def.id, cellName: this.model.nameAt(i), prompt: this.genPrompt, referenceBase64: refs }),
        });
        const json = (await res.json()) as { ok?: boolean; pngBase64?: string; error?: string };
        if (!res.ok || !json.ok || !json.pngBase64) throw new Error(json.error ?? `HTTP ${res.status}`);
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('decode'));
          img.src = 'data:image/png;base64,' + json.pngBase64;
        });
        this.model.replaceCellImage(i, img);
        this.redrawThumb(i);
        this.updatePreview();
      } catch (err) {
        this.status(`gen failed for ${this.model.nameAt(i)} (${String(err)})`, '#ff7a6a');
        return;
      }
    }
    this.status(`generated ${targets.length} frame(s) — WRITE SHEET to keep`, '#6fe36f');
  }

  private async writeMoves(): Promise<void> {
    this.status('saving moves…', '#7fe3ff');
    try {
      const n = await writeCharacterMoves(this.def);
      this.status(`saved ${n} moves → src/data/characters/${this.def.id}.json`, '#6fe36f');
    } catch (err) {
      this.status(`save failed (${String(err)}) — dev server only`, '#ff7a6a');
    }
  }

  /** POST the current composited sheet + meta; throws on failure. */
  private async postSheet(): Promise<string> {
    const res = await fetch('/__editor/sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: this.def.id,
        pngBase64: this.model.exportPngBase64(),
        meta: this.model.exportMeta(),
        manifest: this.model.manifest,
        // edit overlays: persisted server-side so a later gen:pack (which
        // rebuilds from assets/raw/frames) keeps these edits instead of
        // silently clobbering them
        editedCells: this.model.exportEditedCells(),
        editedSkeletons: this.model.exportEditedSkeletons(),
      }),
    });
    const json = (await res.json()) as { ok?: boolean; backup?: string; error?: string };
    if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    return json.backup ?? '';
  }

  private async writeSheet(): Promise<void> {
    this.status('writing sheet…', '#7fe3ff');
    try {
      const backup = await this.postSheet();
      this.status(`sheet written · backup ${backup} · reload to re-slice`, '#6fe36f');
    } catch (err) {
      this.status(`sheet write failed (${String(err)})`, '#ff7a6a');
    }
  }

  private async applyWrites(): Promise<void> {
    if (!this.writeMovesWanted && !this.writeSheetWanted && !this.flattenWanted) {
      this.status('choose at least one write action', '#ff7a6a');
      return;
    }
    if (this.flattenWanted) {
      await this.flatten();
      return;
    }
    this.status('applying selected writes…', '#7fe3ff');
    try {
      let msg = '';
      // Sheet first: src/data writes tend to trigger Vite reload fastest.
      if (this.writeSheetWanted) {
        const backup = await this.postSheet();
        msg += `sheet ok (${backup})`;
      }
      if (this.writeMovesWanted) {
        const n = await writeCharacterMoves(this.def);
        msg += `${msg ? ' · ' : ''}${n} moves ok`;
      }
      this.status(msg || 'nothing written', '#6fe36f');
    } catch (err) {
      this.status(`write failed (${String(err)})`, '#ff7a6a');
    }
  }

  /** Bake-down / flatten: commit the tuned character `scale` + `spriteOffsetY`
   *  into the committed data with an IDENTITY transform — the fighter looks the
   *  same, but scale=1 and spriteOffsetY=0. Scale is folded into the persisted
   *  geometry (hurtStand drives render size, so no pixel change is needed for it);
   *  spriteOffsetY is baked into the sheet pixels (every cell shifted) then zeroed.
   *  Overwrites sheet.png + meta + character.json. */
  private async flatten(): Promise<void> {
    const S = this.def.scale ?? 1;
    const oy = this.def.spriteOffsetY ?? 0;
    if (S === 1 && oy === 0 && this.model.manifest.length === 0) {
      this.status('already flat — nothing to bake (scale 1, offset 0, no edits)', '#8fa6b2');
      return;
    }
    this.status('flattening scale + offset → identity…', '#7fe3ff');
    try {
      // bake spriteOffsetY (render-only, world px) into the sheet by shifting
      // every cell by offset / renderScale cell-px (src/render/geometry)
      if (oy !== 0) {
        const dy = Math.round(oy / renderScale(this.def));
        if (dy !== 0) this.model.offsetCells(this.model.frames.map((_, i) => i), 0, dy);
      }
      await this.postSheet(); // baked pixels (+ shifted keypoints) → sheet.png/meta
      const n = await writeFlattenedCharacter(this.def); // scaled geometry, scale=1, offset=0
      // reflect the identity transform in the live def so the editor stays consistent
      this.def.scale = 1;
      this.def.spriteOffsetY = 0;
      resetScaleBase(this.def);
      this.status(`flattened ${n} moves → scale=1, offset=0 · sheet overwritten · reload to re-slice`, '#6fe36f');
    } catch (err) {
      this.status(`flatten failed (${String(err)}) — dev server only`, '#ff7a6a');
    }
  }

  private onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (e.shiftKey && (e.key === 'A' || e.key === 'a')) {
      e.preventDefault();
      this.selectAll();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
      this.model.copyCell(this.primary);
      this.status('copied', '#8fa6b2');
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
      this.model.pasteInto([...this.selection]);
      this.afterEdit();
    }
  };

  private stopFormKeys = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) {
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  };

  private status(msg: string, color: string): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = msg;
    this.statusEl.style.color = color;
  }

  // ---------- DOM helpers ----------
  private h(text: string, size: number, color: string): HTMLDivElement {
    const d = document.createElement('div');
    d.textContent = text;
    d.style.cssText = `font-size:${size}px;font-weight:bold;color:${color};margin:6px 0 2px;`;
    return d;
  }
  private button(label: string, color: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = `background:#172230;color:${color};border:1px solid #3f6070;border-radius:3px;padding:5px 7px;font:12px monospace;cursor:pointer;`;
    b.addEventListener('click', onClick);
    return b;
  }
  private wideButton(label: string, color: string, onClick: () => void): HTMLButtonElement {
    const b = this.button(label, color, onClick);
    b.style.width = '100%';
    b.style.marginTop = '6px';
    return b;
  }
  private radio(name: string, label: string, checked: boolean, onChange: () => void): HTMLLabelElement {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.checked = checked;
    input.addEventListener('change', onChange);
    wrap.appendChild(input);
    wrap.appendChild(document.createTextNode(label));
    return wrap;
  }
  private checkbox(label: string, checked: boolean, onChange: (on: boolean) => void): HTMLLabelElement {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;margin:2px 0;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    wrap.appendChild(input);
    wrap.appendChild(document.createTextNode(label));
    return wrap;
  }
  private slider(label: string, min: number, max: number, step: number, value: number, onChange: (n: number) => void): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:2px 0;';
    const l = document.createElement('span');
    l.textContent = label;
    l.style.cssText = 'width:56px;color:#8fa6b2;';
    const range = document.createElement('input');
    range.type = 'range';
    range.min = String(min);
    range.max = String(max);
    range.step = String(step);
    range.value = String(value);
    range.style.cssText = 'flex:1;min-width:0;';
    const num = document.createElement('input');
    num.type = 'number';
    num.value = String(value);
    num.style.cssText = 'width:56px;background:#172230;color:#eaf6fb;border:1px solid #3f6070;';
    const apply = (n: number) => {
      range.value = String(n);
      num.value = String(n);
      onChange(n);
    };
    range.addEventListener('input', () => apply(Number(range.value)));
    num.addEventListener('change', () => apply(Number(num.value) || 0));
    row.appendChild(l);
    row.appendChild(range);
    row.appendChild(num);
    return row;
  }
}
