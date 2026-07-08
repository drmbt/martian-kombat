// Dev-only Stage Pin editor. Places each stage on the character-select world
// map: click a stage in the list, click the map to drop its pin, drag pins to
// nudge. SAVE POSTs the normalized (0..1) coords to the dev-server middleware
// (see vite.config.ts editorApi), which rewrites src/data/stage-pins.json — a
// reload then shows them on the select screen. This whole scene only ships in
// dev (the title only offers it under import.meta.env.DEV) and the save
// endpoint only exists while `npm run dev` is running.
import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { play } from './BootScene';
import { STAGES } from '../data/stages';
import { menuNav, navDefer } from '../input/menu-nav';
import initialPins from '../data/stage-pins.json';

const MAP_ASPECT = 3168 / 1344; // world-map.png aspect
const MAP_X = 16;
const MAP_Y = 44;
const MAP_W = 640;
const MAP_H = Math.round(MAP_W / MAP_ASPECT); // ~272

const PANEL_X = MAP_X + MAP_W + 14; // 670
const LIST_TOP = 44;
const LIST_BOTTOM = STAGE_H - 8;

interface Pin { x: number; y: number }

export class StagePinEditorScene extends Phaser.Scene {
  private pins: Record<string, Pin> = {};
  private selIdx = 0;
  private dirty = false;
  private saving = false;

  // list rows
  private rowBgs: Phaser.GameObjects.Rectangle[] = [];
  private rowLabels: Phaser.GameObjects.Text[] = [];
  // pin markers on the map, keyed by stage id
  private dots: Record<string, Phaser.GameObjects.Arc> = {};
  private tags: Record<string, Phaser.GameObjects.Text> = {};
  private statusText!: Phaser.GameObjects.Text;
  private selNameText!: Phaser.GameObjects.Text;

  /** where BACK returns: the studio STAGES module passes its Fight payload
   *  so the pin editor round-trips instead of dumping to the editor menu */
  private returnTo: { scene: string; data?: object } | null = null;

  constructor() {
    super('StagePinEditor');
  }

  init(data: { returnTo?: { scene: string; data?: object } }): void {
    this.returnTo = data?.returnTo ?? null;
  }

  create(): void {
    this.pins = {};
    for (const [id, p] of Object.entries(initialPins as Record<string, Pin>)) {
      this.pins[id] = { x: p.x, y: p.y };
    }
    this.selIdx = 0;
    this.dirty = false;
    this.saving = false;
    this.dots = {};
    this.tags = {};
    this.rowBgs = [];
    this.rowLabels = [];

    this.add.rectangle(STAGE_W / 2, STAGE_H / 2, STAGE_W, STAGE_H, 0x0c0910, 1);
    this.add
      .text(MAP_X, 8, 'STAGE PIN EDITOR', {
        fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold', color: '#7fe3ff',
        stroke: '#08202a', strokeThickness: 6,
      })
      .setOrigin(0, 0);

    // --- world map + click zone ---
    if (this.textures.exists('ui-world-map')) {
      this.add.image(MAP_X + MAP_W / 2, MAP_Y + MAP_H / 2, 'ui-world-map').setDisplaySize(MAP_W, MAP_H);
    } else {
      this.add.rectangle(MAP_X + MAP_W / 2, MAP_Y + MAP_H / 2, MAP_W, MAP_H, 0x223).setStrokeStyle(1, 0x556);
      this.add.text(MAP_X + MAP_W / 2, MAP_Y + MAP_H / 2, '(world-map.png missing)', {
        fontFamily: 'monospace', fontSize: '14px', color: '#889',
      }).setOrigin(0.5);
    }
    this.add.rectangle(MAP_X + MAP_W / 2, MAP_Y + MAP_H / 2, MAP_W, MAP_H).setStrokeStyle(1, 0x3f6070);
    const zone = this.add
      .rectangle(MAP_X + MAP_W / 2, MAP_Y + MAP_H / 2, MAP_W, MAP_H, 0x000000, 0.001)
      .setInteractive();
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => this.placeAtPointer(p));

    // --- stage list (right panel) ---
    this.add
      .text(PANEL_X, 22, `STAGES (${STAGES.length})`, {
        fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', color: '#9fb4be',
      })
      .setOrigin(0, 0.5);
    // pack all stages into the panel height (shrinks as the roster grows)
    const rowH = Math.min(20, (LIST_BOTTOM - LIST_TOP) / STAGES.length);
    const fontPx = Math.max(9, Math.min(12, Math.floor(rowH - 6)));
    STAGES.forEach((st, i) => {
      const y = LIST_TOP + i * rowH + rowH / 2;
      const bg = this.add
        .rectangle(PANEL_X, y, STAGE_W - PANEL_X - 8, rowH - 2, 0x172230, 0.9)
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(PANEL_X + 6, y, st.name, {
          fontFamily: 'monospace', fontSize: `${fontPx}px`, color: '#eaf6fb',
        })
        .setOrigin(0, 0.5);
      bg.on('pointerover', () => { this.selIdx = i; this.refresh(); });
      bg.on('pointerdown', () => { this.selIdx = i; this.refresh(); });
      this.rowBgs.push(bg);
      this.rowLabels.push(label);
    });

    // --- action bar under the map ---
    const barY = MAP_Y + MAP_H + 20;
    this.selNameText = this.add
      .text(MAP_X, barY, '', {
        fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold', color: '#ffd24a',
      })
      .setOrigin(0, 0.5);

    const btnY = barY + 34;
    this.makeButton(MAP_X + 46, btnY, 'SAVE', 0x1c5a2a, () => this.save());
    this.makeButton(MAP_X + 150, btnY, 'CLEAR PIN', 0x5a1c1c, () => this.clearSelected());
    this.makeButton(MAP_X + 280, btnY, 'BACK', 0x3a2b40, () => this.back());

    this.statusText = this.add
      .text(MAP_X, btnY + 30, '', {
        fontFamily: 'monospace', fontSize: '12px', color: '#8fa6b2',
      })
      .setOrigin(0, 0.5);

    this.add
      .text(MAP_X, STAGE_H - 14, 'click stage → click map to drop pin · drag pins to nudge · ↑/↓ select · S save · ESC back', {
        fontFamily: 'monospace', fontSize: '11px', color: '#6f8690',
      })
      .setOrigin(0, 0.5);

    // dragging pins
    this.input.on('drag', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, dragX: number, dragY: number) => {
      const id = obj.getData('stageId') as string | undefined;
      if (!id) return;
      const nx = Phaser.Math.Clamp((dragX - MAP_X) / MAP_W, 0, 1);
      const ny = Phaser.Math.Clamp((dragY - MAP_Y) / MAP_H, 0, 1);
      this.pins[id] = { x: nx, y: ny };
      this.selIdx = STAGES.findIndex((s) => s.id === id);
      this.dirty = true;
      this.refresh();
    });

    const kb = this.input.keyboard!;
    for (const k of ['UP', 'W']) kb.on(`keydown-${k}`, () => this.move(-1));
    for (const k of ['DOWN', 'S']) kb.on(`keydown-${k}`, () => this.move(1));
    kb.on('keydown-BACKSPACE', () => this.clearSelected());
    kb.on('keydown-DELETE', () => this.clearSelected());
    // Ctrl/Cmd+S or plain S when not typing — S also moves down, so use Ctrl+S
    // as the reliable save; the SAVE button is the primary path.
    kb.on('keydown-S', (e: KeyboardEvent) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.save(); } });
    kb.on('keydown-ESC', () => this.back());

    this.refresh();
  }

  private makeButton(x: number, y: number, text: string, color: number, act: () => void): void {
    const w = text.length * 9 + 22;
    const bg = this.add
      .rectangle(x, y, w, 26, color, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.25)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, text, {
        fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold', color: '#f5ffff',
      })
      .setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(color, 1).setScale(1.04));
    bg.on('pointerout', () => bg.setFillStyle(color, 0.95).setScale(1));
    bg.on('pointerdown', act);
  }

  /** Drop or move the selected stage's pin at the clicked map point. */
  private placeAtPointer(p: Phaser.Input.Pointer): void {
    const st = STAGES[this.selIdx];
    if (!st) return;
    const hadPin = !!this.pins[st.id];
    const nx = Phaser.Math.Clamp((p.x - MAP_X) / MAP_W, 0, 1);
    const ny = Phaser.Math.Clamp((p.y - MAP_Y) / MAP_H, 0, 1);
    this.pins[st.id] = { x: nx, y: ny };
    this.dirty = true;
    play(this, 's-blip', 0.4);
    // first placement of a stage auto-advances to the next unplaced one so you
    // can tag the whole roster fast; repositioning an existing pin stays put.
    if (!hadPin) {
      const next = STAGES.findIndex((s, i) => i > this.selIdx && !this.pins[s.id]);
      const wrap = STAGES.findIndex((s) => !this.pins[s.id]);
      const to = next >= 0 ? next : wrap;
      if (to >= 0) this.selIdx = to;
    }
    this.refresh();
  }

  private clearSelected(): void {
    const st = STAGES[this.selIdx];
    if (!st || !this.pins[st.id]) return;
    delete this.pins[st.id];
    this.dirty = true;
    play(this, 's-blip', 0.4);
    this.refresh();
  }

  private move(d: number): void {
    this.selIdx = (this.selIdx + d + STAGES.length) % STAGES.length;
    play(this, 's-blip', 0.35);
    this.refresh();
  }

  private screenX(nx: number): number { return MAP_X + nx * MAP_W; }
  private screenY(ny: number): number { return MAP_Y + ny * MAP_H; }

  /** Reconcile every visual (rows, dots, tags, status) with current state. */
  private refresh(): void {
    const selId = STAGES[this.selIdx]?.id;
    // list rows
    STAGES.forEach((st, i) => {
      const on = i === this.selIdx;
      const placed = !!this.pins[st.id];
      this.rowBgs[i].setFillStyle(on ? 0x24384a : 0x172230, on ? 0.95 : 0.9)
        .setStrokeStyle(on ? 2 : 0, on ? 0x7fe3ff : 0x000000);
      this.rowLabels[i].setColor(placed ? (on ? '#bff0ff' : '#eaf6fb') : (on ? '#ffd24a' : '#7d94a0'));
      this.rowLabels[i].setText(`${placed ? '●' : '○'} ${st.name}`);
    });

    // pin markers
    for (const st of STAGES) {
      const pin = this.pins[st.id];
      if (!pin) {
        this.dots[st.id]?.destroy();
        this.tags[st.id]?.destroy();
        delete this.dots[st.id];
        delete this.tags[st.id];
        continue;
      }
      const on = st.id === selId;
      const x = this.screenX(pin.x);
      const y = this.screenY(pin.y);
      let dot = this.dots[st.id];
      if (!dot) {
        dot = this.add.circle(x, y, 5, 0xff5a48).setStrokeStyle(1.5, 0x000000);
        dot.setData('stageId', st.id);
        dot.setInteractive({ useHandCursor: true, draggable: true });
        dot.on('pointerover', () => { this.selIdx = STAGES.findIndex((s) => s.id === st.id); this.refresh(); });
        this.dots[st.id] = dot;
      }
      dot.setPosition(x, y).setRadius(on ? 7 : 5)
        .setFillStyle(on ? 0x7fe3ff : 0xff5a48).setDepth(on ? 12 : 10);
      let tag = this.tags[st.id];
      if (!tag) {
        tag = this.add.text(x, y - 9, st.id, {
          fontFamily: 'monospace', fontSize: '9px', color: '#fff', stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 1);
        this.tags[st.id] = tag;
      }
      tag.setPosition(x, y - (on ? 11 : 9)).setColor(on ? '#bff0ff' : '#ffffff').setDepth(on ? 13 : 11);
    }

    // status
    const placedCount = Object.keys(this.pins).length;
    const st = STAGES[this.selIdx];
    this.selNameText.setText(st ? `▸ ${st.name}${this.pins[st.id] ? '' : '  (click the map)'}` : '');
    if (!this.saving) {
      this.statusText
        .setText(`${placedCount}/${STAGES.length} placed${this.dirty ? '  ·  unsaved changes' : ''}`)
        .setColor(this.dirty ? '#ffd24a' : '#8fa6b2');
    }
  }

  private async save(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    this.statusText.setText('saving…').setColor('#7fe3ff');
    try {
      const res = await fetch('/__editor/stage-pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.pins, null, 2),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { ok?: boolean; count?: number };
      this.dirty = false;
      this.saving = false;
      this.statusText
        .setText(`saved ${json.count ?? Object.keys(this.pins).length} pins → src/data/stage-pins.json  ·  reload to see on select`)
        .setColor('#6fe36f');
    } catch (err) {
      this.saving = false;
      this.statusText
        .setText(`save failed (${String(err)}) — dev server only`)
        .setColor('#ff7a6a');
    }
  }

  private back(): void {
    play(this, 's-blip');
    if (this.returnTo) this.scene.start(this.returnTo.scene, this.returnTo.data);
    else this.scene.start('EditorMenu');
  }

  update(): void {
    const n = menuNav.poll();
    if (n.up) this.move(-1);
    if (n.down) this.move(1);
    if (n.menu) navDefer(this, () => this.back());
  }
}
