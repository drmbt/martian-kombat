// Loads every asset up front (missing files 404 harmlessly — the game
// degrades to capsules/silence), then hands off to the menu.
import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { ROSTER } from '../data/roster';

const CELL_W = 288;
const CELL_H = 384;

const ANNOUNCER = [
  'round-1', 'round-2', 'final-round', 'fight', 'ko', 'time-up',
  'double-ko', 'perfect', 'victory', ...ROSTER.map((r) => r.id),
];
const VOICES = ['vincent-kiai', 'vincent-hurt', 'yulia-kiai', 'yulia-hurt'];
const SFX = ['hit', 'block', 'whoosh', 'jump', 'projectile', 'blip'];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const bar = this.add.graphics();
    this.load.on('progress', (p: number) => {
      bar.clear();
      bar.fillStyle(0xff5a48, 1).fillRect(STAGE_W / 4, STAGE_H / 2 - 6, (STAGE_W / 2) * p, 12);
    });

    this.load.image('bg-salton', 'assets/backgrounds/salton-shoreline.jpg');
    for (const { id } of ROSTER) {
      this.load.spritesheet(`sheet-${id}`, `assets/sprites/${id}/sheet.png`, {
        frameWidth: CELL_W,
        frameHeight: CELL_H,
      });
      this.load.image(`proj-${id}`, `assets/sprites/${id}/projectile.png`);
      this.load.image(`portrait-${id}`, `assets/portraits/${id}.png`);
    }
    for (const a of ANNOUNCER) this.load.audio(`ann-${a}`, `assets/audio/announcer/${a}.mp3`);
    for (const v of VOICES) this.load.audio(`v-${v}`, `assets/audio/voice/${v}.mp3`);
    for (const s of SFX) this.load.audio(`s-${s}`, `assets/audio/sfx/${s}.mp3`);
  }

  create(): void {
    this.scene.start('Menu');
  }
}

/** Play a sound if it loaded; silently skip if the asset doesn't exist. */
export function play(scene: Phaser.Scene, key: string, volume = 0.8): void {
  if (scene.cache.audio.exists(key)) scene.sound.play(key, { volume });
}
