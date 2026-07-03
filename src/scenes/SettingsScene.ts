// Settings: master/music/SFX volume, round clock, match length. Values
// persist to localStorage (src/settings.ts) and apply immediately — volume
// changes are audible live, rule changes apply from the next match.
// Fully mouse-driven: faders are draggable, choice rows step by dragging
// left/right (or click to cycle), arrows nudge. Keyboard: W/S row, A/D
// change, ESC back.
import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { play } from './BootScene';
import { applyMusicVolume } from '../audio/volume';
import {
  getSettings,
  resetSettings,
  ROUND_SECONDS_CHOICES,
  updateSettings,
  WINS_NEEDED_CHOICES,
} from '../settings';

interface FaderRow {
  kind: 'fader';
  label: string;
  get: () => number;
  set: (v: number) => void;
  /** fires once per keyboard nudge / drag release (sfx preview) */
  commit?: () => void;
}

interface StepperRow {
  kind: 'stepper';
  label: string;
  value: () => string;
  adjust: (dir: -1 | 1) => void;
}

type Row = FaderRow | StepperRow;

const cycle = <T>(choices: readonly T[], cur: T, dir: -1 | 1): T => {
  const i = choices.indexOf(cur);
  return choices[(i + dir + choices.length) % choices.length];
};

// layout
const CX = STAGE_W / 2;
const ROW0_Y = 132;
const ROW_H = 58;
const TRACK_X = CX + 40;
const TRACK_W = 240;
const TRACK_H = 16;
const DRAG_STEP_PX = 56; // horizontal drag distance per stepper increment

export class SettingsScene extends Phaser.Scene {
  private rows: Row[] = [];
  private rowIdx = 0;
  private labelTexts: Phaser.GameObjects.Text[] = [];
  private valueTexts: Phaser.GameObjects.Text[] = [];
  private faderGfx: (Phaser.GameObjects.Graphics | null)[] = [];
  private faderDrag: number | null = null; // row index being dragged
  private stepDrag: { row: number; anchorX: number; moved: boolean } | null = null;

  constructor() {
    super('Settings');
  }

  create(): void {
    this.rowIdx = 0;
    this.labelTexts = [];
    this.valueTexts = [];
    this.faderGfx = [];
    this.faderDrag = null;
    this.stepDrag = null;

    if (this.textures.exists('bg-salton')) {
      this.add.image(CX, STAGE_H / 2, 'bg-salton').setDisplaySize(STAGE_W, STAGE_H).setAlpha(0.35);
    }
    this.add.rectangle(CX, STAGE_H / 2, STAGE_W, STAGE_H, 0x0c0910, 0.6);
    this.add
      .text(CX, 62, 'SETTINGS', {
        fontFamily: 'monospace', fontSize: '40px', fontStyle: 'bold', color: '#ffb347',
        stroke: '#2a0a0a', strokeThickness: 10,
      })
      .setOrigin(0.5);

    const volume = (key: 'masterVolume' | 'musicVolume' | 'sfxVolume', live: boolean): FaderRow => ({
      kind: 'fader',
      label: { masterVolume: 'MASTER VOLUME', musicVolume: 'MUSIC VOLUME', sfxVolume: 'SFX VOLUME' }[key],
      get: () => getSettings()[key],
      set: (v) => {
        updateSettings({ [key]: Math.round(Math.max(0, Math.min(1, v)) * 20) / 20 });
        if (live) applyMusicVolume();
      },
      commit: live ? undefined : () => play(this, 's-hit'), // audible sfx preview
    });

    this.rows = [
      volume('masterVolume', true),
      volume('musicVolume', true),
      volume('sfxVolume', false),
      {
        kind: 'stepper',
        label: 'ROUND TIME',
        value: () => (getSettings().roundSeconds === 0 ? 'OFF' : `${getSettings().roundSeconds} SECONDS`),
        adjust: (dir) =>
          updateSettings({ roundSeconds: cycle(ROUND_SECONDS_CHOICES, getSettings().roundSeconds, dir) }),
      },
      {
        kind: 'stepper',
        label: 'MATCH LENGTH',
        value: () => `BEST OF ${getSettings().winsNeeded * 2 - 1}`,
        adjust: (dir) =>
          updateSettings({ winsNeeded: cycle(WINS_NEEDED_CHOICES, getSettings().winsNeeded, dir) }),
      },
      {
        kind: 'stepper',
        label: 'RESET DEFAULTS',
        value: () => '◄ ►',
        adjust: () => {
          resetSettings();
          applyMusicVolume();
          play(this, 's-blip');
        },
      },
    ];

    this.rows.forEach((row, i) => {
      const y = ROW0_Y + i * ROW_H;
      this.labelTexts.push(
        this.add.text(CX - 60, y, row.label, {
          fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold', color: '#f5ead9',
          stroke: '#000', strokeThickness: 4,
        }).setOrigin(1, 0.5),
      );

      if (row.kind === 'fader') {
        // static track; the moving fill + handle live in faderGfx
        this.add.rectangle(TRACK_X + TRACK_W / 2, y, TRACK_W, TRACK_H, 0x0c0910, 1).setStrokeStyle(1, 0x7a6a86);
        this.faderGfx.push(this.add.graphics());
        this.valueTexts.push(
          this.add.text(TRACK_X + TRACK_W + 16, y, '', {
            fontFamily: 'monospace', fontSize: '20px', color: '#58e6d9', stroke: '#000', strokeThickness: 4,
          }).setOrigin(0, 0.5),
        );
      } else {
        this.faderGfx.push(null);
        this.valueTexts.push(
          this.add.text(CX + 60, y, '', {
            fontFamily: 'monospace', fontSize: '22px', color: '#58e6d9', stroke: '#000', strokeThickness: 4,
          }).setOrigin(0, 0.5),
        );
      }

      // whole value strip is grabbable: drag faders, drag/click steppers
      this.add
        .zone(CX + 24, y, 380, ROW_H - 10)
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', (p: Phaser.Input.Pointer) => {
          this.rowIdx = i;
          if (row.kind === 'fader') {
            this.faderDrag = i;
            this.setFader(row, p.x);
          } else {
            this.stepDrag = { row: i, anchorX: p.x, moved: false };
          }
          this.redraw();
        });

      // arrows still work for taps
      for (const [dx, dir, glyph] of [[10, -1, '◀'], [434, 1, '▶']] as const) {
        this.add
          .text(CX + dx, y, glyph, {
            fontFamily: 'monospace', fontSize: '20px', color: '#7a6a86', stroke: '#000', strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => { this.rowIdx = i; this.adjust(dir); });
      }
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      if (this.faderDrag !== null) {
        const row = this.rows[this.faderDrag];
        if (row.kind === 'fader') this.setFader(row, p.x);
      } else if (this.stepDrag) {
        const row = this.rows[this.stepDrag.row];
        if (row.kind !== 'stepper') return;
        while (Math.abs(p.x - this.stepDrag.anchorX) >= DRAG_STEP_PX) {
          const dir = p.x > this.stepDrag.anchorX ? 1 : -1;
          row.adjust(dir);
          play(this, 's-blip', 0.4);
          this.stepDrag.anchorX += dir * DRAG_STEP_PX;
          this.stepDrag.moved = true;
        }
        this.redraw();
      }
    });
    this.input.on('pointerup', () => {
      if (this.faderDrag !== null) {
        const row = this.rows[this.faderDrag];
        if (row.kind === 'fader') row.commit?.();
        this.faderDrag = null;
      } else if (this.stepDrag) {
        // a still click (no drag) cycles the value forward
        if (!this.stepDrag.moved) this.adjust(1);
        this.stepDrag = null;
      }
    });

    this.add
      .text(CX, STAGE_H - 26, 'drag faders/values · W/S row · A/D change · ESC back', {
        fontFamily: 'monospace', fontSize: '14px', color: '#9a8fa8', stroke: '#000', strokeThickness: 3,
      })
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    const move = (d: number) => {
      this.rowIdx = (this.rowIdx + d + this.rows.length) % this.rows.length;
      play(this, 's-blip', 0.4);
      this.redraw();
    };
    for (const k of ['W', 'UP']) kb.on(`keydown-${k}`, () => move(-1));
    for (const k of ['S', 'DOWN']) kb.on(`keydown-${k}`, () => move(1));
    for (const k of ['A', 'LEFT']) kb.on(`keydown-${k}`, () => this.adjust(-1));
    for (const k of ['D', 'RIGHT']) kb.on(`keydown-${k}`, () => this.adjust(1));
    for (const k of ['ESC', 'ENTER']) kb.on(`keydown-${k}`, () => this.scene.start('Menu'));

    this.redraw();
  }

  private setFader(row: FaderRow, pointerX: number): void {
    row.set((pointerX - TRACK_X) / TRACK_W);
    this.redraw();
  }

  private adjust(dir: -1 | 1): void {
    const row = this.rows[this.rowIdx];
    if (row.kind === 'fader') {
      row.set(row.get() + dir * 0.1);
      row.commit?.();
    } else {
      row.adjust(dir);
    }
    this.redraw();
  }

  update(): void {
    // settings can change under us (the quick-volume overlay); text updates
    // are no-ops when nothing changed, so a per-frame redraw stays cheap
    this.redraw();
  }

  private redraw(): void {
    this.rows.forEach((row, i) => {
      const active = i === this.rowIdx;
      this.labelTexts[i].setColor(active ? '#ffd24a' : '#f5ead9');
      const color = active ? '#ffd24a' : '#58e6d9';
      if (row.kind === 'fader') {
        const y = ROW0_Y + i * ROW_H;
        const v = row.get();
        const g = this.faderGfx[i]!;
        g.clear();
        g.fillStyle(active ? 0xffd24a : 0x58e6d9, 1).fillRect(TRACK_X, y - TRACK_H / 2, TRACK_W * v, TRACK_H);
        // fader handle
        g.fillStyle(0xf5ead9, 1).fillRect(TRACK_X + TRACK_W * v - 3, y - TRACK_H / 2 - 4, 6, TRACK_H + 8);
        this.valueTexts[i].setText(`${Math.round(v * 100)}%`).setColor(color);
      } else {
        this.valueTexts[i].setText(row.value()).setColor(color);
      }
    });
  }
}
