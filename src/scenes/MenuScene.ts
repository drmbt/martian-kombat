import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { play } from './BootScene';
import { playMusic } from '../audio/music';
import { ROSTER } from '../data/roster';
import { STAGES } from '../data/stages';

/** idle this long on the title -> CPU-vs-CPU attract-mode demo */
const ATTRACT_AFTER_MS = 20_000;

export class MenuScene extends Phaser.Scene {
  private idleMs = 0;
  private menuReady = false;
  private menuReadyAt = -1;
  private menuItems: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text)[] = [];
  private coinText!: Phaser.GameObjects.Text;

  constructor() {
    super('Menu');
  }

  create(): void {
    playMusic('menu');
    this.idleMs = 0;
    this.menuReady = false;
    this.menuReadyAt = -1;
    this.menuItems = [];
    // any human sign of life postpones the attract demo; the first key/click
    // on the title reveals the menu instead of immediately choosing an item.
    this.input.keyboard!.on('keydown', () => this.notePresence());
    this.input.on('pointermove', () => (this.idleMs = 0));
    this.input.on('pointerdown', () => this.notePresence());
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
    const toSettings = () => {
      play(this, 's-blip');
      this.scene.start('Settings');
    };
    const opts: { label: string; act: () => void }[] = [
      { label: '1 · VS CPU', act: () => go(true) },
      { label: '2 · TWO PLAYERS', act: () => go(false) },
      { label: '3 · TRAINING', act: () => go(false, true) },
      { label: '4 · SETTINGS', act: toSettings },
    ];
    opts.forEach((o, i) => {
      const y = 352 + i * 52;
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
      this.menuItems.push(bg, label);
      bg.on('pointerover', () => { bg.setFillStyle(0x3a2b40, 0.95).setStrokeStyle(2, 0xffb347); label.setColor('#ffd24a'); });
      bg.on('pointerout', () => { bg.setFillStyle(0x241b2e, 0.85).setStrokeStyle(2, 0x7a6a86); label.setColor('#f5ead9'); });
      bg.on('pointerdown', () => {
        if (!this.menuReady) return;
        o.act();
      });
    });
    for (const item of this.menuItems) item.setVisible(false);

    this.coinText = this.add
      .text(STAGE_W / 2, 430, 'INSERT COIN', {
        fontFamily: 'monospace', fontSize: '42px', fontStyle: 'bold', color: '#ffb347',
        stroke: '#2a3a7a', strokeThickness: 8,
      })
      .setOrigin(0.5);
    this.time.addEvent({
      delay: 600,
      loop: true,
      callback: () => this.coinText.setVisible(!this.menuReady && !this.coinText.visible),
    });

    this.input.keyboard!.on('keydown-ONE', () => { if (this.canChoose()) go(true); });
    this.input.keyboard!.on('keydown-TWO', () => { if (this.canChoose()) go(false); });
    this.input.keyboard!.on('keydown-THREE', () => { if (this.canChoose()) go(false, true); });
    this.input.keyboard!.on('keydown-FOUR', () => { if (this.canChoose()) toSettings(); });
    this.input.keyboard!.on('keydown-ENTER', () => { if (this.canChoose()) go(false); });
  }

  update(_time: number, delta: number): void {
    // gamepad activity counts as presence too (poll: sticks don't emit events)
    for (const pad of this.input.gamepad?.gamepads ?? []) {
      if (!pad) continue;
      if (pad.buttons.some((b) => b.pressed) || Math.abs(pad.leftStick.x) > 0.5 || Math.abs(pad.leftStick.y) > 0.5) {
        this.notePresence();
      }
    }
    this.idleMs += delta;
    if (this.idleMs >= ATTRACT_AFTER_MS) this.startAttractDemo();
  }

  private notePresence(): void {
    this.idleMs = 0;
    if (!this.menuReady) this.revealMenu();
  }

  private revealMenu(): void {
    this.menuReady = true;
    this.menuReadyAt = this.time.now;
    this.coinText.setVisible(false);
    for (const item of this.menuItems) item.setVisible(true);
    play(this, 's-blip', 0.45);
  }

  private canChoose(): boolean {
    return this.menuReady && this.time.now > this.menuReadyAt;
  }

  /** Arcade attract mode: two random fighters demo the game on a random stage
   *  until any key/click/pad button brings the player back to the title. */
  private startAttractDemo(): void {
    const playable = ROSTER.filter((r) => r.playable).map((r) => r.id);
    const p1 = Phaser.Utils.Array.GetRandom(playable);
    const p2 = Phaser.Utils.Array.GetRandom(playable);
    const stage = Phaser.Utils.Array.GetRandom(STAGES).id;
    this.scene.start('Fight', { p1, p2, stage, demo: true });
  }
}
