// Dev-only move tuner inspector — a real interactive DOM sidebar (mirrors the
// StagePinEditorScene precedent: fetch() POST to a Vite dev-middleware route,
// see vite.config.ts editorApi). Mounted into the shared UiLayer only when
// FightScene's `tuner` flag is set (src/scenes/FightScene.ts). Edits mutate
// the live `characters` registry in place — same reference the engine, the
// CpuDriver, and the hitbox-debug overlay already read every tick, so a
// number-input edit is visible next frame with zero extra plumbing.
import type { Box, CharacterDef, MoveDef } from '../engine';
import { DIFFICULTIES, type Difficulty } from '../ai/difficulty';
import { writeCharacterMoves } from './moveWriteback';
import { setCharacterScale } from '../data/characterScale';

/** the subset of FightScene the panel needs — avoids importing the whole
 *  scene class (structural typing: FightScene satisfies this for free) */
export interface TunerHost {
  setControlMode(
    slot: 0 | 1,
    mode: 'manual' | 'cpu' | 'loop',
    opts?: { difficulty?: Difficulty; moveId?: string; pauseTicks?: number; attack?: boolean },
  ): void;
  setLoopPaused(slot: 0 | 1, paused: boolean): void;
  setHoldActive(slot: 0 | 1, on: boolean): void;
  setPreviewBox(slot: 0 | 1, box: Box | null): void;
}

const NUM_FIELDS: (keyof MoveDef)[] = ['startup', 'active', 'recovery', 'damage', 'hitstun', 'blockstun', 'knockback'];
const BOX_FIELDS = ['x', 'y', 'w', 'h'] as const;

const MIN_WIDTH = 240;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 340;

export class MoveTunerPanel {
  private el: HTMLDivElement;
  private resizeHandle: HTMLDivElement;
  private toggleBtn: HTMLButtonElement;
  private visible = true;
  private width = DEFAULT_WIDTH;
  private inspectSlot: 0 | 1 = 0;
  private controlMode: [ 'manual' | 'cpu' | 'loop', 'manual' | 'cpu' | 'loop' ] = ['manual', 'manual'];
  private loopPaused: [boolean, boolean] = [false, false];
  private statusEl!: HTMLDivElement;
  private movesEl!: HTMLDivElement;

  constructor(
    host: HTMLElement,
    private defs: Record<string, CharacterDef>,
    private chars: [string, string],
    private scene: TunerHost,
  ) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      // bottom:10% leaves the lower-right clear for the canvas volume/mute overlay
      `position:absolute;right:0;top:0;bottom:10%;width:${this.width}px;overflow-y:auto;box-sizing:border-box;` +
      'background:rgba(10,14,18,.62);border-left:2px solid #3f6070;padding:10px;pointer-events:auto;' +
      'font:12px monospace;color:#eaf6fb;z-index:8;';
    host.appendChild(this.el);

    // drag-to-resize: a thin strip tracking the panel's left edge. Kept as a
    // sibling (not a child of `el`) since render() clears el's innerHTML.
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.style.cssText =
      `position:absolute;right:${this.width}px;top:0;bottom:0;width:8px;margin-left:-4px;` +
      'cursor:ew-resize;pointer-events:auto;z-index:9;background:transparent;';
    host.appendChild(this.resizeHandle);
    this.resizeHandle.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = this.width;
      const onMove = (ev: PointerEvent) => {
        this.width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth - (ev.clientX - startX)));
        this.el.style.width = `${this.width}px`;
        this.resizeHandle.style.right = `${this.width}px`;
        if (this.visible) this.toggleBtn.style.right = `${this.width}px`;
      };
      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });

    // show/hide tab — stays put (outside el) so it's reachable while hidden
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.style.cssText =
      `position:absolute;right:${this.width}px;top:50%;transform:translateY(-50%);pointer-events:auto;z-index:9;` +
      'background:#172230;color:#7fe3ff;border:1px solid #3f6070;border-radius:3px 0 0 3px;' +
      'padding:10px 4px;font:12px monospace;cursor:pointer;writing-mode:vertical-rl;';
    this.toggleBtn.textContent = 'TUNER ▶';
    this.toggleBtn.addEventListener('click', () => this.setVisible(!this.visible));
    host.appendChild(this.toggleBtn);

    this.render();
  }

  private setVisible(v: boolean): void {
    this.visible = v;
    this.el.style.display = v ? 'block' : 'none';
    this.resizeHandle.style.display = v ? 'block' : 'none';
    this.toggleBtn.style.right = v ? `${this.width}px` : '0';
    this.toggleBtn.textContent = v ? 'TUNER ▶' : 'TUNER ◀';
  }

  dispose(): void {
    this.el.remove();
    this.resizeHandle.remove();
    this.toggleBtn.remove();
  }

  private render(): void {
    this.el.innerHTML = '';
    this.el.appendChild(this.h('MOVE TUNER', 16, '#7fe3ff'));

    // which character's moves the list below shows
    const inspectRow = document.createElement('div');
    inspectRow.style.cssText = 'margin:8px 0;display:flex;gap:10px;';
    for (const slot of [0, 1] as const) {
      inspectRow.appendChild(
        this.radio(`inspect`, `${this.chars[slot]} (P${slot + 1})`, this.inspectSlot === slot, () => {
          this.inspectSlot = slot;
          this.render();
        }),
      );
    }
    this.el.appendChild(inspectRow);

    // character scale — uniformly resizes the inspected fighter (art + hurt/hit
    // boxes + projectiles) live; saved with the moves on WRITE
    const def = this.defs[this.chars[this.inspectSlot]];
    this.el.appendChild(
      this.numField('scale', def.scale ?? 1, (n) => setCharacterScale(def, Math.max(0.3, n))),
    );

    // per-side control mode
    for (const slot of [0, 1] as const) this.el.appendChild(this.controlSection(slot));

    this.el.appendChild(this.h(`MOVES — ${this.chars[this.inspectSlot]}`, 13, '#7fe3ff'));
    this.movesEl = document.createElement('div');
    this.el.appendChild(this.movesEl);
    this.renderMoves();

    const writeBtn = this.button('WRITE TO DISK', '#6fe36f', () => this.write());
    writeBtn.style.marginTop = '10px';
    writeBtn.style.width = '100%';
    this.el.appendChild(writeBtn);
    this.statusEl = document.createElement('div');
    this.statusEl.style.cssText = 'margin-top:6px;color:#8fa6b2;';
    this.el.appendChild(this.statusEl);
  }

  private renderMoves(): void {
    this.movesEl.innerHTML = '';
    // rows always start collapsed on a rebuild — drop any stale marker
    this.scene.setPreviewBox(this.inspectSlot, null);
    const def = this.defs[this.chars[this.inspectSlot]];
    for (const [id, move] of Object.entries(def.moves)) {
      this.movesEl.appendChild(this.moveRow(id, move));
    }
  }

  private moveRow(id: string, move: MoveDef): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'border:1px solid #2a3a44;border-radius:4px;margin:6px 0;';
    const head = document.createElement('div');
    head.textContent = `${id}${move.name ? '  ·  ' + move.name : ''}`;
    head.style.cssText = 'padding:6px 8px;cursor:pointer;color:#bff0ff;user-select:none;';
    const body = document.createElement('div');
    body.style.cssText = 'display:none;padding:6px 8px;border-top:1px solid #2a3a44;';
    head.addEventListener('click', () => {
      const opening = body.style.display === 'none';
      body.style.display = opening ? 'block' : 'none';
      // soft marker: shows where the box sits at rest, without firing the
      // move — whichever row was last opened/closed drives it (simple, not
      // exclusive across simultaneously-open rows)
      this.scene.setPreviewBox(this.inspectSlot, opening ? move.hitbox ?? null : null);
    });

    for (const field of NUM_FIELDS) {
      const v = move[field];
      if (typeof v !== 'number') continue;
      body.appendChild(this.numField(field, v, (n) => ((move as unknown as Record<string, number>)[field] = n)));
    }
    if (move.hitbox) {
      body.appendChild(this.h('hitbox', 11, '#8fa6b2'));
      for (const f of BOX_FIELDS) {
        body.appendChild(this.numField(f, move.hitbox[f], (n) => (move.hitbox![f] = n)));
      }
    }
    if (move.projectile) {
      body.appendChild(this.h('projectile', 11, '#8fa6b2'));
      for (const field of ['vx', 'damage', 'hitstun', 'blockstun', 'knockback'] as const) {
        body.appendChild(this.numField(field, move.projectile[field], (n) => (move.projectile![field] = n)));
      }
      body.appendChild(this.h('projectile box', 11, '#8fa6b2'));
      for (const f of BOX_FIELDS) {
        body.appendChild(this.numField(f, move.projectile.box[f], (n) => (move.projectile!.box[f] = n)));
      }
    }
    wrap.appendChild(head);
    wrap.appendChild(body);
    return wrap;
  }

  private controlSection(slot: 0 | 1): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'border:1px solid #2a3a44;border-radius:4px;padding:6px 8px;margin:6px 0;';
    wrap.appendChild(this.h(`P${slot + 1} — ${this.chars[slot]}`, 12, '#eaf6fb'));

    const modeRow = document.createElement('div');
    modeRow.style.cssText = 'display:flex;gap:8px;margin:4px 0;';
    for (const mode of ['manual', 'cpu', 'loop'] as const) {
      modeRow.appendChild(
        this.radio(`mode${slot}`, mode, this.controlMode[slot] === mode, () => {
          this.controlMode[slot] = mode;
          this.applyMode(slot);
          this.render();
        }),
      );
    }
    wrap.appendChild(modeRow);

    if (this.controlMode[slot] === 'cpu') {
      const sel = document.createElement('select');
      sel.style.cssText = 'width:100%;background:#172230;color:#eaf6fb;border:1px solid #3f6070;padding:3px;';
      for (const d of DIFFICULTIES) {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        sel.appendChild(opt);
      }
      sel.value = this.difficulty[slot];
      sel.addEventListener('change', () => {
        this.difficulty[slot] = sel.value as Difficulty;
        this.applyMode(slot);
      });
      wrap.appendChild(sel);
    }

    if (this.controlMode[slot] === 'loop') {
      const moveSel = document.createElement('select');
      moveSel.style.cssText = 'width:100%;background:#172230;color:#eaf6fb;border:1px solid #3f6070;padding:3px;margin-bottom:4px;';
      for (const id of Object.keys(this.defs[this.chars[slot]].moves)) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = id;
        moveSel.appendChild(opt);
      }
      moveSel.value = this.loopMove[slot];
      moveSel.addEventListener('change', () => {
        this.loopMove[slot] = moveSel.value;
        this.applyMode(slot);
      });
      wrap.appendChild(moveSel);

      const toggleRow = document.createElement('div');
      toggleRow.style.cssText = 'display:flex;gap:12px;margin-bottom:4px;';
      const attackCb = this.checkbox('attack', this.attackOn[slot], (on) => {
        this.attackOn[slot] = on;
        this.applyMode(slot);
      });
      const holdCb = this.checkbox('hold active', this.holdActive[slot], (on) => {
        this.holdActive[slot] = on;
        this.scene.setHoldActive(slot, on);
      });
      toggleRow.appendChild(attackCb);
      toggleRow.appendChild(holdCb);
      wrap.appendChild(toggleRow);

      const pauseRow = document.createElement('div');
      pauseRow.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:4px;';
      const label = document.createElement('span');
      label.textContent = 'pause (ms)';
      const input = document.createElement('input');
      input.type = 'number';
      input.value = String(this.loopPauseMs[slot]);
      input.style.cssText = 'width:70px;background:#172230;color:#eaf6fb;border:1px solid #3f6070;';
      input.addEventListener('change', () => {
        this.loopPauseMs[slot] = Number(input.value) || 0;
        this.applyMode(slot);
      });
      pauseRow.appendChild(label);
      pauseRow.appendChild(input);
      wrap.appendChild(pauseRow);

      const pauseBtn = this.button(this.loopPaused[slot] ? 'RESUME' : 'PAUSE', '#ffd24a', () => {
        this.loopPaused[slot] = !this.loopPaused[slot];
        this.scene.setLoopPaused(slot, this.loopPaused[slot]);
        this.render();
      });
      pauseBtn.style.width = '100%';
      wrap.appendChild(pauseBtn);
    }

    return wrap;
  }

  private difficulty: [Difficulty, Difficulty] = ['medium', 'medium'];
  private loopMove: [string, string] = ['lp', 'lp'];
  private loopPauseMs: [number, number] = [500, 500];
  /** loop mode: off (default) = the move fires in place on a timer, no
   *  approach/retreat — for dialing in a move's length without needing to
   *  reach/hit anyone */
  private attackOn: [boolean, boolean] = [false, false];
  private holdActive: [boolean, boolean] = [false, false];

  private applyMode(slot: 0 | 1): void {
    const mode = this.controlMode[slot];
    if (mode === 'manual') return this.scene.setControlMode(slot, 'manual');
    if (mode === 'cpu') return this.scene.setControlMode(slot, 'cpu', { difficulty: this.difficulty[slot] });
    this.loopPaused[slot] = false;
    this.scene.setControlMode(slot, 'loop', {
      moveId: this.loopMove[slot],
      pauseTicks: Math.round((this.loopPauseMs[slot] / 1000) * 60),
      attack: this.attackOn[slot],
    });
  }

  private async write(): Promise<void> {
    const id = this.chars[this.inspectSlot];
    this.statusEl.textContent = 'saving…';
    this.statusEl.style.color = '#7fe3ff';
    try {
      const moveCount = await writeCharacterMoves(this.defs[id]);
      const json = { moveCount };
      this.statusEl.textContent = `saved ${json.moveCount ?? '?'} moves → src/data/characters/${id}.json`;
      this.statusEl.style.color = '#6fe36f';
    } catch (err) {
      this.statusEl.textContent = `save failed (${String(err)}) — dev server only`;
      this.statusEl.style.color = '#ff7a6a';
    }
  }

  // --- small DOM helpers ---

  private h(text: string, size: number, color: string): HTMLDivElement {
    const d = document.createElement('div');
    d.textContent = text;
    d.style.cssText = `font-size:${size}px;font-weight:bold;color:${color};margin:4px 0 2px;`;
    return d;
  }

  private button(label: string, color: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText =
      `background:#172230;color:${color};border:1px solid #3f6070;border-radius:3px;` +
      'padding:5px 8px;font:12px monospace;cursor:pointer;';
    b.addEventListener('click', onClick);
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
    wrap.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    wrap.appendChild(input);
    wrap.appendChild(document.createTextNode(label));
    return wrap;
  }

  private numField(label: string, value: number, onChange: (n: number) => void): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:6px;margin:2px 0;';
    const l = document.createElement('span');
    l.textContent = label;
    l.style.color = '#8fa6b2';
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(value);
    input.style.cssText = 'width:70px;background:#172230;color:#eaf6fb;border:1px solid #3f6070;';
    input.addEventListener('change', () => onChange(Number(input.value) || 0));
    row.appendChild(l);
    row.appendChild(input);
    return row;
  }
}
