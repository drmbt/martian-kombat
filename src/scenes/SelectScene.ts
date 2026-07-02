// Character select: both players pick simultaneously from the 8-Martian grid.
// P1 WASD + F, P2 arrows + K. Locked characters (no sheet yet) can't be picked.
import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { ROSTER } from '../data/roster';
import { play } from './BootScene';

const COLS = 4;
const CELL = 150;
const GAP = 24;

export class SelectScene extends Phaser.Scene {
  private idx: [number, number] = [0, 1];
  private confirmed: [boolean, boolean] = [false, false];
  private cursors!: Phaser.GameObjects.Graphics;
  private nameTexts: Phaser.GameObjects.Text[] = [];
  private starting = false;

  constructor() {
    super('Select');
  }

  create(): void {
    this.idx = [0, 1];
    this.confirmed = [false, false];
    this.starting = false;

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
      this.add.rectangle(x, y, CELL - 8, CELL - 8, 0x14101a, 0.85).setStrokeStyle(2, 0x594566);
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
    });

    this.cursors = this.add.graphics();
    this.nameTexts = [
      this.add.text(40, STAGE_H - 46, '', { fontFamily: 'monospace', fontSize: '22px', color: '#58e6d9', stroke: '#000', strokeThickness: 4 }),
      this.add.text(STAGE_W - 40, STAGE_H - 46, '', { fontFamily: 'monospace', fontSize: '22px', color: '#ff5a48', stroke: '#000', strokeThickness: 4 }).setOrigin(1, 0),
    ];

    const kb = this.input.keyboard!;
    const move = (p: 0 | 1, d: number) => {
      if (this.confirmed[p] || this.starting) return;
      const n = ROSTER.length;
      this.idx[p] = ((this.idx[p] + d) % n + n) % n;
      play(this, 's-blip', 0.5);
    };
    kb.on('keydown-A', () => move(0, -1));
    kb.on('keydown-D', () => move(0, 1));
    kb.on('keydown-W', () => move(0, -COLS));
    kb.on('keydown-S', () => move(0, COLS));
    kb.on('keydown-LEFT', () => move(1, -1));
    kb.on('keydown-RIGHT', () => move(1, 1));
    kb.on('keydown-UP', () => move(1, -COLS));
    kb.on('keydown-DOWN', () => move(1, COLS));
    kb.on('keydown-F', () => this.confirm(0));
    kb.on('keydown-K', () => this.confirm(1));

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
      this.starting = true;
      this.time.delayedCall(1100, () => {
        this.scene.start('Fight', { p1: ROSTER[this.idx[0]].id, p2: ROSTER[this.idx[1]].id });
      });
    }
  }

  update(): void {
    this.redraw();
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
