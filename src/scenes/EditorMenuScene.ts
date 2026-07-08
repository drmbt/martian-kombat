// Dev-only editor hub. Reached from the title screen's "DEV EDITOR" item (only
// shown in `npm run dev`). Lists the available authoring tools; today just the
// Stage Pin editor. Add a row to TOOLS to grow it (e.g. a future character
// creator). Mouse + keyboard + gamepad, mirroring the main menu.
import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { play } from './BootScene';
import { menuNav, navDefer, attackKeyCodes } from '../input/menu-nav';

interface Tool {
  label: string;
  desc: string;
  act: (scene: EditorMenuScene) => void;
}

// The individual tools are separately-addressable MODULES of the Character
// Studio (one implementation, many doors — docs/CHARACTER_STUDIO.md §2.1):
// Move Tuner / Sprite Editor deep-link into the studio at their module.
const TOOLS: Tool[] = [
  {
    label: 'CHARACTER STUDIO',
    desc: 'roster manager: new · edit · online/offline · import/export · delete',
    act: (s) => s.go('StudioSelect'),
  },
  {
    label: 'CHARACTER CREATOR',
    desc: 'zero → hero wizard, hosted in the studio over a live fight',
    // straight into the studio (no fighter pick needed to CREATE one)
    act: (s) => s.go('Fight', { p1: 'vincent', p2: 'yulia', cpu: false, training: true, studio: true, module: 'creator', stage: 'chiba', render3d: false }),
  },
  {
    label: 'STAGE PINS',
    desc: 'place each stage on the select-screen world map',
    act: (s) => s.go('StagePinEditor'),
  },
  {
    label: 'MOVE TUNER',
    desc: 'studio, opened at the MOVES module (frame data · drivers)',
    act: (s) => s.go('Select', { cpu: false, training: true, studio: true, module: 'moves', render3d: false }),
  },
  {
    label: 'SPRITE EDITOR',
    desc: 'studio, opened at the SPRITES module (cells · skeleton · regen)',
    act: (s) => s.go('Select', { cpu: false, training: true, studio: true, module: 'sprites', render3d: false }),
  },
];

export class EditorMenuScene extends Phaser.Scene {
  private buttons: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; act: () => void }[] = [];
  private selIdx = 0;

  constructor() {
    super('EditorMenu');
  }

  create(): void {
    this.buttons = [];
    this.selIdx = 0;

    this.add.rectangle(STAGE_W / 2, STAGE_H / 2, STAGE_W, STAGE_H, 0x0c0910, 1);
    this.add
      .text(STAGE_W / 2, 74, 'DEV EDITOR', {
        fontFamily: 'monospace', fontSize: '52px', fontStyle: 'bold', color: '#7fe3ff',
        stroke: '#08202a', strokeThickness: 10,
      })
      .setOrigin(0.5);
    this.add
      .text(STAGE_W / 2, 118, 'local dev tools · writes to src/data', {
        fontFamily: 'monospace', fontSize: '15px', color: '#9fb4be', stroke: '#000', strokeThickness: 3,
      })
      .setOrigin(0.5);

    // one row per tool, plus a BACK row at the end
    const rows: { label: string; desc: string; act: () => void }[] = [
      ...TOOLS.map((t) => ({ label: t.label, desc: t.desc, act: () => t.act(this) })),
      { label: 'BACK', desc: 'return to the title screen', act: () => this.go('Menu') },
    ];

    const top = 176;
    const step = 64;
    rows.forEach((r, i) => {
      const y = top + i * step;
      const bg = this.add
        .rectangle(STAGE_W / 2, y, 460, 52, 0x172230, 0.9)
        .setStrokeStyle(2, 0x3f6070)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(STAGE_W / 2, y - 8, r.label, {
          fontFamily: 'monospace', fontSize: '24px', fontStyle: 'bold', color: '#eaf6fb',
          stroke: '#000', strokeThickness: 5,
        })
        .setOrigin(0.5);
      this.add
        .text(STAGE_W / 2, y + 15, r.desc, {
          fontFamily: 'monospace', fontSize: '12px', color: '#8fa6b2', stroke: '#000', strokeThickness: 2,
        })
        .setOrigin(0.5);
      this.buttons.push({ bg, label, act: r.act });
      bg.on('pointerover', () => { this.selIdx = i; this.highlight(); });
      bg.on('pointerdown', () => { this.selIdx = i; r.act(); });
    });
    this.highlight();

    this.add
      .text(STAGE_W / 2, STAGE_H - 22, 'W/S+pad move · ENTER/click select · ESC/SELECT back', {
        fontFamily: 'monospace', fontSize: '13px', color: '#7d94a0', stroke: '#000', strokeThickness: 3,
      })
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    for (const k of ['UP', 'W']) kb.on(`keydown-${k}`, () => this.move(-1));
    for (const k of ['DOWN', 'S']) kb.on(`keydown-${k}`, () => this.move(1));
    for (const k of ['ENTER', 'SPACE']) kb.on(`keydown-${k}`, () => this.activate());
    kb.on('keydown-ESC', () => this.go('Menu'));
    const atk = attackKeyCodes();
    kb.on('keydown', (e: KeyboardEvent) => { if (atk.has(e.keyCode)) this.activate(); });
  }

  go(key: string, data?: object): void {
    play(this, 's-blip');
    this.scene.start(key, data);
  }

  private move(d: number): void {
    this.selIdx = (this.selIdx + d + this.buttons.length) % this.buttons.length;
    this.highlight();
    play(this, 's-blip', 0.4);
  }

  private activate(): void {
    this.buttons[this.selIdx]?.act();
  }

  private highlight(): void {
    this.buttons.forEach(({ bg, label }, i) => {
      const on = i === this.selIdx;
      bg.setFillStyle(on ? 0x24384a : 0x172230, on ? 0.95 : 0.9).setStrokeStyle(2, on ? 0x7fe3ff : 0x3f6070);
      label.setColor(on ? '#bff0ff' : '#eaf6fb');
    });
  }

  update(): void {
    const n = menuNav.poll();
    if (n.up) this.move(-1);
    if (n.down) this.move(1);
    if (n.confirm || n.start) navDefer(this, () => this.activate());
    if (n.menu) navDefer(this, () => this.go('Menu'));
  }
}
