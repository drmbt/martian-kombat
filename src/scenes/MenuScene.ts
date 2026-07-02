import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { play } from './BootScene';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    if (this.textures.exists('bg-salton')) {
      this.add.image(STAGE_W / 2, STAGE_H / 2, 'bg-salton').setDisplaySize(STAGE_W, STAGE_H).setAlpha(0.55);
    }
    this.add.rectangle(STAGE_W / 2, STAGE_H / 2, STAGE_W, STAGE_H, 0x0c0910, 0.35);

    this.add
      .text(STAGE_W / 2, 170, 'MARTIAN\nKOMBAT', {
        fontFamily: 'monospace', fontSize: '84px', fontStyle: 'bold', color: '#ffb347',
        stroke: '#2a0a0a', strokeThickness: 12, align: 'center',
      })
      .setOrigin(0.5);
    this.add
      .text(STAGE_W / 2, 300, 'a Mars College fighting game · Bombay Beach, CA', {
        fontFamily: 'monospace', fontSize: '16px', color: '#e8dcc8', stroke: '#000', strokeThickness: 3,
      })
      .setOrigin(0.5);
    const go = (cpu: boolean, training = false) => {
      play(this, 's-blip');
      this.scene.start('Select', { cpu, training });
    };

    // clickable menu buttons (mouse) — also 1/2/3 hotkeys + ENTER
    const opts: { label: string; act: () => void }[] = [
      { label: '1 · VS CPU', act: () => go(true) },
      { label: '2 · TWO PLAYERS', act: () => go(false) },
      { label: '3 · TRAINING', act: () => go(false, true) },
    ];
    opts.forEach((o, i) => {
      const y = 370 + i * 56;
      const bg = this.add
        .rectangle(STAGE_W / 2, y, 340, 46, 0x241b2e, 0.85)
        .setStrokeStyle(2, 0x7a6a86)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(STAGE_W / 2, y, o.label, {
          fontFamily: 'monospace', fontSize: '24px', fontStyle: 'bold', color: '#f5ead9',
          stroke: '#000', strokeThickness: 5,
        })
        .setOrigin(0.5);
      bg.on('pointerover', () => { bg.setFillStyle(0x3a2b40, 0.95).setStrokeStyle(2, 0xffb347); label.setColor('#ffd24a'); });
      bg.on('pointerout', () => { bg.setFillStyle(0x241b2e, 0.85).setStrokeStyle(2, 0x7a6a86); label.setColor('#f5ead9'); });
      bg.on('pointerdown', o.act);
    });

    this.input.keyboard!.on('keydown-ONE', () => go(true));
    this.input.keyboard!.on('keydown-TWO', () => go(false));
    this.input.keyboard!.on('keydown-THREE', () => go(false, true));
    this.input.keyboard!.on('keydown-ENTER', () => go(false));
  }
}
