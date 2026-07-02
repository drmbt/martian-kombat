// Character select: both players pick simultaneously from the 8-Martian grid.
// P1 WASD + F, P2 arrows + K. Locked characters (no sheet yet) can't be picked.
// Once both lock in, a stage-select dialog opens (RANDOM is the default);
// either player's keys drive it.
import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { ROSTER } from '../data/roster';
import { characters } from '../data/characters';
import { STAGES, stageOwner } from '../data/stages';
import { play } from './BootScene';

const COLS = 4;
const CELL = 150;
const GAP = 24;

// stage dialog grid: RANDOM tile + every stage
const SCOLS = 4;
const SCELL_W = 214;
const SCELL_H = 122;
const THUMB_W = 190;
const THUMB_H = 81; // 21:9

export class SelectScene extends Phaser.Scene {
  private idx: [number, number] = [0, 1];
  private confirmed: [boolean, boolean] = [false, false];
  private cursors!: Phaser.GameObjects.Graphics;
  private nameTexts: Phaser.GameObjects.Text[] = [];
  private starting = false;
  private cpu = false;
  private training = false;
  private stageMode = false;
  private stageIdx = 0;
  private stageCursor: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super('Select');
  }

  init(data: { cpu?: boolean; training?: boolean }): void {
    this.cpu = !!data.cpu;
    this.training = !!data.training;
  }

  create(): void {
    this.idx = [0, 1];
    this.confirmed = [false, false];
    this.starting = false;
    this.stageMode = false;
    this.stageIdx = 0;
    this.stageCursor = null;

    if (this.textures.exists('bg-salton')) {
      this.add.image(STAGE_W / 2, STAGE_H / 2, 'bg-salton').setDisplaySize(STAGE_W, STAGE_H).setAlpha(0.35);
    }
    this.add.rectangle(STAGE_W / 2, STAGE_H / 2, STAGE_W, STAGE_H, 0x0c0910, 0.5);
    this.add
      .text(STAGE_W / 2, 48, 'CHOOSE YOUR MARTIAN', {
        fontFamily: 'monospace', fontSize: '34px', fontStyle: 'bold', color: '#ffb347',
        stroke: '#2a0a0a', strokeThickness: 8,
      })
      .setOrigin(0.5);

    ROSTER.forEach((entry, i) => {
      const { x, y } = this.cellXY(i);
      const cellBg = this.add.rectangle(x, y, CELL - 8, CELL - 8, 0x14101a, 0.85).setStrokeStyle(2, 0x594566);
      if (this.textures.exists(`portrait-${entry.id}`)) {
        const img = this.add.image(x, y, `portrait-${entry.id}`).setDisplaySize(CELL - 14, CELL - 14);
        if (!entry.playable) img.setAlpha(0.3).setTint(0x777799);
      }
      this.add
        .text(x, y + CELL / 2 + 12, entry.playable ? entry.name : `${entry.name} · SOON`, {
          fontFamily: 'monospace', fontSize: '13px', color: entry.playable ? '#f5ead9' : '#7a7286',
          stroke: '#000', strokeThickness: 3,
        })
        .setOrigin(0.5);
      // mouse: hovering moves the active cursor here; clicking confirms it
      cellBg.setInteractive({ useHandCursor: entry.playable });
      cellBg.on('pointerover', () => {
        if (this.stageMode) return;
        const p = this.cpu || this.training ? (this.confirmed[0] ? 1 : 0) : 0;
        if (!this.confirmed[p] && !this.starting) this.idx[p] = i;
      });
      cellBg.on('pointerdown', () => {
        if (this.stageMode) return;
        const p = this.cpu || this.training ? (this.confirmed[0] ? 1 : 0) : 0;
        if (this.confirmed[p] || this.starting) return;
        this.idx[p] = i;
        this.confirm(p);
      });
    });

    this.cursors = this.add.graphics();
    this.nameTexts = [
      this.add.text(40, STAGE_H - 46, '', { fontFamily: 'monospace', fontSize: '22px', color: '#58e6d9', stroke: '#000', strokeThickness: 4 }),
      this.add.text(STAGE_W - 40, STAGE_H - 46, '', { fontFamily: 'monospace', fontSize: '22px', color: '#ff5a48', stroke: '#000', strokeThickness: 4 }).setOrigin(1, 0),
    ];

    if (this.cpu || this.training) {
      this.add
        .text(STAGE_W / 2, 84, this.training ? 'TRAINING — pick your fighter, then the dummy' : 'VS CPU — pick your fighter, then your opponent', {
          fontFamily: 'monospace', fontSize: '15px', color: '#e8dcc8', stroke: '#000', strokeThickness: 3,
        })
        .setOrigin(0.5);
    }

    const kb = this.input.keyboard!;
    // in CPU mode, P1's keys drive the P2 cursor after P1 has locked in
    const slotForP1 = (): 0 | 1 => ((this.cpu || this.training) && this.confirmed[0] ? 1 : 0);
    const move = (p: 0 | 1, d: number) => {
      if (this.confirmed[p] || this.starting) return;
      const n = ROSTER.length;
      this.idx[p] = ((this.idx[p] + d) % n + n) % n;
      play(this, 's-blip', 0.5);
    };
    kb.on('keydown-A', () => (this.stageMode ? this.stageMove(-1) : move(slotForP1(), -1)));
    kb.on('keydown-D', () => (this.stageMode ? this.stageMove(1) : move(slotForP1(), 1)));
    kb.on('keydown-W', () => (this.stageMode ? this.stageMove(-SCOLS) : move(slotForP1(), -COLS)));
    kb.on('keydown-S', () => (this.stageMode ? this.stageMove(SCOLS) : move(slotForP1(), COLS)));
    kb.on('keydown-F', () => (this.stageMode ? this.confirmStage() : this.confirm(slotForP1())));
    // arrows/K always work in the stage dialog — it's a shared pick
    kb.on('keydown-LEFT', () => this.stageMode && this.stageMove(-1));
    kb.on('keydown-RIGHT', () => this.stageMode && this.stageMove(1));
    kb.on('keydown-UP', () => this.stageMode && this.stageMove(-SCOLS));
    kb.on('keydown-DOWN', () => this.stageMode && this.stageMove(SCOLS));
    kb.on('keydown-K', () => this.stageMode && this.confirmStage());
    if (!this.cpu && !this.training) {
      kb.on('keydown-LEFT', () => !this.stageMode && move(1, -1));
      kb.on('keydown-RIGHT', () => !this.stageMode && move(1, 1));
      kb.on('keydown-UP', () => !this.stageMode && move(1, -COLS));
      kb.on('keydown-DOWN', () => !this.stageMode && move(1, COLS));
      kb.on('keydown-K', () => !this.stageMode && this.confirm(1));
    }

    this.redraw();
  }

  private cellXY(i: number): { x: number; y: number } {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const gridW = COLS * CELL + (COLS - 1) * GAP;
    return {
      x: STAGE_W / 2 - gridW / 2 + CELL / 2 + col * (CELL + GAP),
      y: 150 + row * (CELL + GAP + 26),
    };
  }

  private confirm(p: 0 | 1): void {
    if (this.confirmed[p] || this.starting) return;
    const entry = ROSTER[this.idx[p]];
    if (!entry.playable) {
      play(this, 's-blip', 0.3);
      return;
    }
    this.confirmed[p] = true;
    play(this, `ann-${entry.id}`, 1);
    this.redraw();
    if (this.confirmed[0] && this.confirmed[1]) {
      this.time.delayedCall(1100, () => this.openStagePick());
    }
  }

  /** RANDOM tile first, then every stage — index space of the dialog. */
  private stageOptions(): { id: string; name: string }[] {
    return [{ id: 'random', name: 'RANDOM' }, ...STAGES];
  }

  private stageCellXY(i: number): { x: number; y: number } {
    const col = i % SCOLS;
    const row = Math.floor(i / SCOLS);
    const gridW = SCOLS * SCELL_W;
    return {
      x: STAGE_W / 2 - gridW / 2 + SCELL_W / 2 + col * SCELL_W,
      y: 128 + row * SCELL_H,
    };
  }

  private openStagePick(): void {
    if (this.stageMode || this.starting) return;
    this.stageMode = true;
    this.stageIdx = 0; // RANDOM is the default
    const picked = [ROSTER[this.idx[0]].id, ROSTER[this.idx[1]].id];

    this.add.rectangle(STAGE_W / 2, STAGE_H / 2, STAGE_W, STAGE_H, 0x0c0910, 1).setDepth(10);
    this.add
      .text(STAGE_W / 2, 52, 'CHOOSE STAGE', {
        fontFamily: 'monospace', fontSize: '30px', fontStyle: 'bold', color: '#ffb347',
        stroke: '#2a0a0a', strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(11);

    const font = { fontFamily: 'monospace', stroke: '#000', strokeThickness: 3 };
    this.stageOptions().forEach((opt, i) => {
      const { x, y } = this.stageCellXY(i);
      const tile = this.add.rectangle(x, y - 8, THUMB_W, THUMB_H, 0x14101a, 1).setStrokeStyle(1, 0x594566).setDepth(11);
      tile.setInteractive({ useHandCursor: true });
      tile.on('pointerover', () => { this.stageIdx = i; });
      tile.on('pointerdown', () => { this.stageIdx = i; this.confirmStage(); });
      if (opt.id === 'random') {
        this.add.text(x, y - 8, '?', { ...font, fontSize: '44px', fontStyle: 'bold', color: '#ffd24a' })
          .setOrigin(0.5).setDepth(12);
      } else if (this.textures.exists(`bg-stage-${opt.id}`)) {
        this.add.image(x, y - 8, `bg-stage-${opt.id}`).setDisplaySize(THUMB_W, THUMB_H).setDepth(12);
      }
      const owner = opt.id === 'random' ? null : stageOwner(opt.id, picked, characters);
      const label = owner ? `${opt.name} · ${characters[owner].name}` : opt.name;
      this.add
        .text(x, y + THUMB_H / 2 - 2, label, {
          ...font, fontSize: '12px', color: owner ? characters[owner].color : '#f5ead9',
        })
        .setOrigin(0.5, 0)
        .setDepth(12);
    });
    this.add
      .text(STAGE_W / 2, STAGE_H - 18, 'MOVE: WASD / ARROWS · CONFIRM: F / K', {
        ...font, fontSize: '12px', color: '#e8dcc8',
      })
      .setOrigin(0.5)
      .setDepth(12);
    this.stageCursor = this.add.graphics().setDepth(13);
    this.redrawStage();
  }

  private stageMove(d: number): void {
    if (this.starting) return;
    const n = this.stageOptions().length;
    this.stageIdx = ((this.stageIdx + d) % n + n) % n;
    play(this, 's-blip', 0.5);
    this.redrawStage();
  }

  private confirmStage(): void {
    if (this.starting) return;
    this.starting = true;
    const pick = this.stageOptions()[this.stageIdx];
    const stage = pick.id === 'random'
      ? STAGES[Math.floor(Math.random() * STAGES.length)].id
      : pick.id;
    play(this, 's-blip', 0.8);
    this.redrawStage();
    this.time.delayedCall(500, () => {
      this.scene.start('Fight', {
        p1: ROSTER[this.idx[0]].id, p2: ROSTER[this.idx[1]].id, cpu: this.cpu, training: this.training, stage,
      });
    });
  }

  private redrawStage(): void {
    const g = this.stageCursor;
    if (!g) return;
    const { x, y } = this.stageCellXY(this.stageIdx);
    g.clear();
    g.lineStyle(this.starting ? 5 : 3, 0x58e6d9, 1);
    g.strokeRect(x - THUMB_W / 2 - 4, y - 8 - THUMB_H / 2 - 4, THUMB_W + 8, THUMB_H + 8);
  }

  update(): void {
    if (this.stageMode) this.redrawStage();
    else this.redraw();
  }

  private redraw(): void {
    const g = this.cursors;
    g.clear();
    for (const p of [0, 1] as const) {
      const { x, y } = this.cellXY(this.idx[p]);
      const color = p === 0 ? 0x58e6d9 : 0xff5a48;
      const inset = p === 0 ? 0 : 6;
      g.lineStyle(this.confirmed[p] ? 5 : 3, color, 1);
      g.strokeRect(x - CELL / 2 + 4 + inset, y - CELL / 2 + 4 + inset, CELL - 8 - inset * 2, CELL - 8 - inset * 2);
      this.nameTexts[p].setText(
        `${p === 0 ? 'P1' : 'P2'}: ${ROSTER[this.idx[p]].name}${this.confirmed[p] ? ' ✓' : ''}`,
      );
    }
  }
}
