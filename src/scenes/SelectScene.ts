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
import { playMusic } from '../audio/music';

const COLS = 4;
const CELL = 150;
const GAP = 24;

// stage dialog: the grid sizes itself to the option count (RANDOM + every
// stage) so a growing roster keeps fitting the 960x540 canvas — see
// layoutStageGrid, which picks the column count giving the largest 21:9 thumb.
const SGRID_TOP = 84; // below the CHOOSE STAGE title
const SGRID_BOTTOM = STAGE_H - 34; // above the controls hint
const SLABEL_H = 26; // thumb->label gap + label line
const SMARGIN_X = 32;
const STHUMB_MAX_W = 190;

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
  // stage-dialog layout, computed by layoutStageGrid for the current count
  private scols = 4;
  private sThumbW = STHUMB_MAX_W;
  private sThumbH = Math.round((STHUMB_MAX_W * 9) / 21);
  private sCellW = STHUMB_MAX_W + 24;
  private sCellH = Math.round((STHUMB_MAX_W * 9) / 21) + SLABEL_H;
  private sFirstRowY = 128;

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
    // the menu theme carries through character select (no-op if already playing)
    playMusic('menu');

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
      // mouse: hovering moves the active cursor here; clicking confirms it.
      // The mouse always drives the first unconfirmed slot — in every mode it
      // picks P1 first, then (once P1 locks) P2 / the CPU opponent / the dummy.
      cellBg.setInteractive({ useHandCursor: entry.playable });
      cellBg.on('pointerover', () => {
        if (this.stageMode) return;
        const p = this.confirmed[0] ? 1 : 0;
        if (!this.confirmed[p] && !this.starting) this.idx[p] = i;
      });
      cellBg.on('pointerdown', () => {
        if (this.stageMode) return;
        const p = this.confirmed[0] ? 1 : 0;
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
    kb.on('keydown-W', () => (this.stageMode ? this.stageMove(-this.scols) : move(slotForP1(), -COLS)));
    kb.on('keydown-S', () => (this.stageMode ? this.stageMove(this.scols) : move(slotForP1(), COLS)));
    kb.on('keydown-F', () => (this.stageMode ? this.confirmStage() : this.confirm(slotForP1())));
    // arrows/K always work in the stage dialog — it's a shared pick
    kb.on('keydown-LEFT', () => this.stageMode && this.stageMove(-1));
    kb.on('keydown-RIGHT', () => this.stageMode && this.stageMove(1));
    kb.on('keydown-UP', () => this.stageMode && this.stageMove(-this.scols));
    kb.on('keydown-DOWN', () => this.stageMode && this.stageMove(this.scols));
    kb.on('keydown-K', () => this.stageMode && this.confirmStage());
    // ENTER confirms in sequence: P1's pick, then P2's, then the stage
    kb.on('keydown-ENTER', () => {
      if (this.stageMode) this.confirmStage();
      else this.confirm(this.confirmed[0] ? 1 : 0);
    });
    if (!this.cpu && !this.training) {
      kb.on('keydown-LEFT', () => !this.stageMode && move(1, -1));
      kb.on('keydown-RIGHT', () => !this.stageMode && move(1, 1));
      kb.on('keydown-UP', () => !this.stageMode && move(1, -COLS));
      kb.on('keydown-DOWN', () => !this.stageMode && move(1, COLS));
      kb.on('keydown-K', () => !this.stageMode && this.confirm(1));
    }
    // ESC backs out: stage dialog -> character pick, character pick -> main menu
    kb.on('keydown-ESC', () => {
      if (this.starting) return;
      play(this, 's-blip', 0.5);
      if (this.stageMode) this.scene.restart({ cpu: this.cpu, training: this.training });
      else this.scene.start('Menu');
    });

    this.add
      .text(STAGE_W / 2, STAGE_H - 20, 'ESC · back', {
        fontFamily: 'monospace', fontSize: '13px', color: '#9a8fa8', stroke: '#000', strokeThickness: 3,
      })
      .setOrigin(0.5);

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

  /**
   * Size the dialog grid to the option count: pick the column count (4..10)
   * that yields the largest 21:9 thumbnail fitting both the canvas width and
   * the vertical band between title and controls hint, then center the rows.
   */
  private layoutStageGrid(n: number): void {
    let best = { cols: 4, tw: 0 };
    for (let cols = 4; cols <= 10; cols++) {
      const rows = Math.ceil(n / cols);
      const byWidth = Math.floor((STAGE_W - SMARGIN_X) / cols) - 16;
      const byHeight = Math.floor(((SGRID_BOTTOM - SGRID_TOP) / rows - SLABEL_H) * (21 / 9));
      const tw = Math.min(STHUMB_MAX_W, byWidth, byHeight);
      if (tw > best.tw) best = { cols, tw };
    }
    this.scols = best.cols;
    this.sThumbW = best.tw;
    this.sThumbH = Math.round((best.tw * 9) / 21);
    this.sCellW = best.tw + 16;
    this.sCellH = this.sThumbH + SLABEL_H;
    const rows = Math.ceil(n / this.scols);
    const slack = Math.max(0, SGRID_BOTTOM - SGRID_TOP - rows * this.sCellH);
    this.sFirstRowY = SGRID_TOP + Math.round(slack / 2) + Math.round(this.sCellH / 2);
  }

  private stageCellXY(i: number): { x: number; y: number } {
    const col = i % this.scols;
    const row = Math.floor(i / this.scols);
    const gridW = this.scols * this.sCellW;
    return {
      x: STAGE_W / 2 - gridW / 2 + this.sCellW / 2 + col * this.sCellW,
      y: this.sFirstRowY + row * this.sCellH,
    };
  }

  private openStagePick(): void {
    if (this.stageMode || this.starting) return;
    this.stageMode = true;
    this.stageIdx = 0; // RANDOM is the default
    this.layoutStageGrid(this.stageOptions().length);
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
    const tw = this.sThumbW;
    const th = this.sThumbH;
    const labelSize = tw < 130 ? '10px' : '12px';
    this.stageOptions().forEach((opt, i) => {
      const { x, y } = this.stageCellXY(i);
      const ty = y - SLABEL_H / 2; // thumb center; label sits below it
      const tile = this.add.rectangle(x, ty, tw, th, 0x14101a, 1).setStrokeStyle(1, 0x594566).setDepth(11);
      tile.setInteractive({ useHandCursor: true });
      tile.on('pointerover', () => { this.stageIdx = i; });
      tile.on('pointerdown', () => { this.stageIdx = i; this.confirmStage(); });
      if (opt.id === 'random') {
        this.add.text(x, ty, '?', { ...font, fontSize: `${Math.round(th * 0.55)}px`, fontStyle: 'bold', color: '#ffd24a' })
          .setOrigin(0.5).setDepth(12);
      } else if (this.textures.exists(`bg-stage-${opt.id}`)) {
        this.add.image(x, ty, `bg-stage-${opt.id}`).setDisplaySize(tw, th).setDepth(12);
      }
      const owner = opt.id === 'random' ? null : stageOwner(opt.id, picked, characters);
      const label = owner ? `${opt.name} · ${characters[owner].name}` : opt.name;
      this.add
        .text(x, ty + th / 2 + 3, label, {
          ...font, fontSize: labelSize, color: owner ? characters[owner].color : '#f5ead9',
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
      this.scene.start('Versus', {
        p1: ROSTER[this.idx[0]].id, p2: ROSTER[this.idx[1]].id, cpu: this.cpu, training: this.training, stage,
      });
    });
  }

  private redrawStage(): void {
    const g = this.stageCursor;
    if (!g) return;
    const { x, y } = this.stageCellXY(this.stageIdx);
    const ty = y - SLABEL_H / 2;
    g.clear();
    g.lineStyle(this.starting ? 5 : 3, 0x58e6d9, 1);
    g.strokeRect(x - this.sThumbW / 2 - 4, ty - this.sThumbH / 2 - 4, this.sThumbW + 8, this.sThumbH + 8);
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
