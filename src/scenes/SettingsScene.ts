// Settings: music/SFX volume, round clock, match length. Values persist to
// localStorage (src/settings.ts) and apply immediately — volume changes are
// audible live, rule changes apply from the next match. W/S or arrows pick a
// row, A/D or left/right adjust, ESC backs out; mouse works on the arrows.
import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { play } from './BootScene';
import { setMusicVolume } from '../audio/music';
import {
  getSettings,
  resetSettings,
  ROUND_SECONDS_CHOICES,
  updateSettings,
  WINS_NEEDED_CHOICES,
} from '../settings';

interface Row {
  label: string;
  value: () => string;
  adjust: (dir: -1 | 1) => void;
}

const cycle = <T>(choices: readonly T[], cur: T, dir: -1 | 1): T => {
  const i = choices.indexOf(cur);
  return choices[(i + dir + choices.length) % choices.length];
};

const volumeBar = (v: number): string => {
  const n = Math.round(v * 10);
  return `${'█'.repeat(n)}${'░'.repeat(10 - n)} ${n * 10}%`;
};

export class SettingsScene extends Phaser.Scene {
  private rows: Row[] = [];
  private rowIdx = 0;
  private labelTexts: Phaser.GameObjects.Text[] = [];
  private valueTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('Settings');
  }

  create(): void {
    this.rowIdx = 0;
    this.labelTexts = [];
    this.valueTexts = [];

    if (this.textures.exists('bg-salton')) {
      this.add.image(STAGE_W / 2, STAGE_H / 2, 'bg-salton').setDisplaySize(STAGE_W, STAGE_H).setAlpha(0.35);
    }
    this.add.rectangle(STAGE_W / 2, STAGE_H / 2, STAGE_W, STAGE_H, 0x0c0910, 0.6);
    this.add
      .text(STAGE_W / 2, 64, 'SETTINGS', {
        fontFamily: 'monospace', fontSize: '40px', fontStyle: 'bold', color: '#ffb347',
        stroke: '#2a0a0a', strokeThickness: 10,
      })
      .setOrigin(0.5);

    const nudgeVolume = (key: 'musicVolume' | 'sfxVolume', dir: -1 | 1): number => {
      const v = Math.round(Math.max(0, Math.min(1, getSettings()[key] + dir * 0.1)) * 10) / 10;
      updateSettings({ [key]: v });
      return v;
    };

    this.rows = [
      {
        label: 'MUSIC VOLUME',
        value: () => volumeBar(getSettings().musicVolume),
        adjust: (dir) => setMusicVolume(nudgeVolume('musicVolume', dir)),
      },
      {
        label: 'SFX VOLUME',
        value: () => volumeBar(getSettings().sfxVolume),
        adjust: (dir) => {
          nudgeVolume('sfxVolume', dir);
          play(this, 's-hit'); // audible preview at the new level
        },
      },
      {
        label: 'ROUND TIME',
        value: () => (getSettings().roundSeconds === 0 ? 'OFF' : `${getSettings().roundSeconds} SECONDS`),
        adjust: (dir) =>
          updateSettings({ roundSeconds: cycle(ROUND_SECONDS_CHOICES, getSettings().roundSeconds, dir) }),
      },
      {
        label: 'MATCH LENGTH',
        value: () => `BEST OF ${getSettings().winsNeeded * 2 - 1}`,
        adjust: (dir) =>
          updateSettings({ winsNeeded: cycle(WINS_NEEDED_CHOICES, getSettings().winsNeeded, dir) }),
      },
      {
        label: 'RESET DEFAULTS',
        value: () => '◄ ►',
        adjust: () => {
          resetSettings();
          setMusicVolume(getSettings().musicVolume);
          play(this, 's-blip');
          this.redraw();
        },
      },
    ];

    this.rows.forEach((row, i) => {
      const y = 150 + i * 62;
      this.labelTexts.push(
        this.add.text(STAGE_W / 2 - 60, y, row.label, {
          fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold', color: '#f5ead9',
          stroke: '#000', strokeThickness: 4,
        }).setOrigin(1, 0.5),
      );
      this.valueTexts.push(
        this.add.text(STAGE_W / 2 + 60, y, '', {
          fontFamily: 'monospace', fontSize: '22px', color: '#58e6d9', stroke: '#000', strokeThickness: 4,
        }).setOrigin(0, 0.5),
      );
      // mouse: click the row's left/right halves of the value area to adjust
      for (const [dx, dir, glyph] of [[10, -1, '◀'], [370, 1, '▶']] as const) {
        this.add
          .text(STAGE_W / 2 + dx, y, glyph, {
            fontFamily: 'monospace', fontSize: '20px', color: '#7a6a86', stroke: '#000', strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => { this.rowIdx = i; this.adjust(dir); });
      }
    });

    this.add
      .text(STAGE_W / 2, STAGE_H - 28, 'W/S · row    A/D · change    ESC · back', {
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

  private adjust(dir: -1 | 1): void {
    this.rows[this.rowIdx].adjust(dir);
    this.redraw();
  }

  private redraw(): void {
    this.rows.forEach((row, i) => {
      const active = i === this.rowIdx;
      this.labelTexts[i].setColor(active ? '#ffd24a' : '#f5ead9');
      this.valueTexts[i].setText(row.value()).setColor(active ? '#ffd24a' : '#58e6d9');
    });
  }
}
