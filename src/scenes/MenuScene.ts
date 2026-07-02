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
    const prompt = this.add
      .text(STAGE_W / 2, 392, '1 · VS CPU\n\n2 · TWO PLAYERS\n\n3 · TRAINING', {
        fontFamily: 'monospace', fontSize: '26px', fontStyle: 'bold', color: '#f5ead9',
        stroke: '#000', strokeThickness: 6, align: 'center',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });

    const go = (cpu: boolean, training = false) => {
      play(this, 's-blip');
      this.scene.start('Select', { cpu, training });
    };
    this.input.keyboard!.on('keydown-ONE', () => go(true));
    this.input.keyboard!.on('keydown-TWO', () => go(false));
    this.input.keyboard!.on('keydown-THREE', () => go(false, true));
    this.input.keyboard!.on('keydown-ENTER', () => go(false));
  }
}
