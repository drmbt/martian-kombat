import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { play } from './BootScene';
import { playMusic } from '../audio/music';
import { ROSTER } from '../data/roster';
import { STAGES } from '../data/stages';
import { menuNav, navDefer, attackKeyCodes } from '../input/menu-nav';

/** idle this long on the title -> CPU-vs-CPU attract-mode demo */
const ATTRACT_AFTER_MS = 20_000;

export class MenuScene extends Phaser.Scene {
  private idleMs = 0;
  private menuReady = false;
  private menuItems: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text)[] = [];
  private coinText!: Phaser.GameObjects.Text;
  // keyboard/gamepad selection cursor over the menu buttons (mouse hover overrides)
  private buttons: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; act: () => void }[] = [];
  private selIdx = 0;
  /** when the menu was revealed — the revealing press must not also select */
  private revealedAt = -1;
  /** 3D render mode: left/right (or click) on the title toggles it; the flag
   *  rides through Select → Versus → Fight3D. Purely a presenter swap. */
  private render3d = false;
  private renderChip!: Phaser.GameObjects.Text;

  constructor() {
    super('Menu');
  }

  create(): void {
    playMusic('menu');
    this.idleMs = 0;
    this.menuReady = false;
    this.menuItems = [];
    this.buttons = [];
    this.selIdx = 0;
    this.revealedAt = -1;
    this.render3d = false;
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
      this.scene.start('Select', { cpu, training, render3d: this.render3d });
    };

    // Render-mode chip in the bottom-left corner: ◄ / ► (or click) flips
    // 2D ⇄ 3D. Hidden with the rest of the menu until the coin drop.
    this.renderChip = this.add
      .text(10, STAGE_H - 8, '', {
        fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#f5ead9',
        stroke: '#000', strokeThickness: 3, backgroundColor: '#241b2e', padding: { x: 7, y: 4 },
      })
      .setOrigin(0, 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { if (this.canChoose()) this.toggleRender(); });
    this.menuItems.push(this.renderChip);
    this.refreshRenderChip();

    // clickable menu buttons (mouse) — also 1/2/3 hotkeys + ENTER
    const toSettings = () => {
      play(this, 's-blip');
      this.scene.start('Settings');
    };
    const toLobby = () => {
      play(this, 's-blip');
      this.scene.start('Lobby', { render3d: this.render3d });
    };
    const opts: { label: string; act: () => void }[] = [
      { label: '1 · VS CPU', act: () => go(true) },
      { label: '2 · TWO PLAYERS', act: () => go(false) },
      { label: '3 · ONLINE', act: toLobby },
      { label: '4 · TRAINING', act: () => go(false, true) },
      { label: '5 · SETTINGS', act: toSettings },
    ];
    // fit the whole list on-screen regardless of item count (STAGE_H=540):
    // pack the block below the subtitle down to a bottom margin
    const top = 336;
    const step = Math.min(52, Math.floor((STAGE_H - top - 16) / opts.length));
    const rectH = Math.min(46, step - 4);
    opts.forEach((o, i) => {
      const y = top + i * step + step / 2;
      const bg = this.add
        .rectangle(STAGE_W / 2, y, 340, rectH, 0x241b2e, 0.85)
        .setStrokeStyle(2, 0x7a6a86)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(STAGE_W / 2, y, o.label, {
          fontFamily: 'monospace', fontSize: '24px', fontStyle: 'bold', color: '#f5ead9',
          stroke: '#000', strokeThickness: 5,
        })
        .setOrigin(0.5);
      this.menuItems.push(bg, label);
      this.buttons.push({ bg, label, act: o.act });
      // mouse hover moves the shared cursor here so mouse + pad agree
      bg.on('pointerover', () => { this.selIdx = i; this.highlight(); });
      bg.on('pointerdown', () => {
        if (!this.menuReady) return;
        this.selIdx = i;
        o.act();
      });
    });
    for (const item of this.menuItems) item.setVisible(false);
    this.highlight();

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
    this.input.keyboard!.on('keydown-THREE', () => { if (this.canChoose()) toLobby(); });
    this.input.keyboard!.on('keydown-FOUR', () => { if (this.canChoose()) go(false, true); });
    this.input.keyboard!.on('keydown-FIVE', () => { if (this.canChoose()) toSettings(); });
    // secret: M jumps straight into a demo (skips the 20s idle wait). In 3D it
    // goes right to the Thriller dance formation (deterministic, for testing);
    // in 2D it demos a fight.
    this.input.keyboard!.on('keydown-M', () => {
      if (!this.canChoose()) return;
      if (this.render3d) this.scene.start('Dance');
      else this.startAttractDemo();
    });
    // arrow / W-S cursor nav mirrors the gamepad; ENTER/SPACE activate the cursor
    for (const k of ['UP', 'W']) this.input.keyboard!.on(`keydown-${k}`, () => this.moveCursor(-1));
    for (const k of ['DOWN', 'S']) this.input.keyboard!.on(`keydown-${k}`, () => this.moveCursor(1));
    // left/right flips the render mode (mirrors the on-screen ◄ ► chip)
    for (const k of ['LEFT', 'A', 'RIGHT', 'D']) this.input.keyboard!.on(`keydown-${k}`, () => this.tryToggleRender());
    for (const k of ['ENTER', 'SPACE']) this.input.keyboard!.on(`keydown-${k}`, () => this.activate());
    // any bound punch/kick key also selects the highlighted item
    const atk = attackKeyCodes();
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => { if (atk.has(e.keyCode)) this.activate(); });
  }

  /** left/right on the title: wake the menu on the first press, else flip mode. */
  private tryToggleRender(): void {
    if (!this.menuReady) { this.notePresence(); return; }
    this.toggleRender();
  }

  private toggleRender(): void {
    this.idleMs = 0;
    this.render3d = !this.render3d;
    this.refreshRenderChip();
    play(this, 's-blip', 0.5);
  }

  private refreshRenderChip(): void {
    this.renderChip.setText(`◄  RENDER: ${this.render3d ? '3D' : '2D'}  ►`);
    this.renderChip.setColor(this.render3d ? '#7fe3ff' : '#f5ead9');
  }

  /** Move the selection cursor; the first press just wakes the menu. */
  private moveCursor(d: number): void {
    if (!this.menuReady) { this.notePresence(); return; }
    this.idleMs = 0;
    this.selIdx = (this.selIdx + d + this.buttons.length) % this.buttons.length;
    this.highlight();
    play(this, 's-blip', 0.4);
  }

  /** Activate the highlighted item (ENTER / pad confirm). */
  private activate(): void {
    if (!this.canChoose()) { this.notePresence(); return; }
    this.buttons[this.selIdx]?.act();
  }

  private highlight(): void {
    this.buttons.forEach(({ bg, label }, i) => {
      const on = i === this.selIdx;
      bg.setFillStyle(on ? 0x3a2b40 : 0x241b2e, on ? 0.95 : 0.85).setStrokeStyle(2, on ? 0xffb347 : 0x7a6a86);
      label.setColor(on ? '#ffd24a' : '#f5ead9');
    });
  }

  update(_time: number, delta: number): void {
    // gamepad drives the menu: the first press is the coin drop (reveal only),
    // then dpad/stick moves the cursor and any attack/Start selects.
    const n = menuNav.poll();
    if (n.anyHeld) this.idleMs = 0; // pad activity postpones the attract demo
    if (!this.menuReady) {
      if (n.up || n.down || n.left || n.right || n.confirm || n.start || n.menu) this.notePresence();
    } else {
      if (n.up) this.moveCursor(-1);
      if (n.down) this.moveCursor(1);
      if (n.left || n.right) this.toggleRender();
      // scene transitions must fire OUTSIDE update() — see navDefer
      if (n.confirm || n.start) navDefer(this, () => this.activate());
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
    this.revealedAt = this.time.now;
    this.coinText.setVisible(false);
    for (const item of this.menuItems) item.setVisible(true);
    play(this, 's-blip', 0.45);
  }

  private canChoose(): boolean {
    // the physical press that revealed the menu also fires the number/ENTER
    // handlers on the same tick — require a later tick so it can't double-act
    return this.menuReady && this.time.now > this.revealedAt;
  }

  /** Arcade attract mode: two random fighters demo the game on a random stage
   *  until any key/click/pad button brings the player back to the title. */
  private startAttractDemo(): void {
    // 3D attract alternates: half the time the Thriller dance formation, half a
    // bot fight. 2D always demos a fight.
    if (this.render3d && Math.random() < 0.5) {
      this.scene.start('Dance');
      return;
    }
    // 3D attract is restricted to fighters with a baked GLB; 2D uses everyone playable
    const pool = ROSTER.filter((r) => (this.render3d ? r.mesh3d : r.playable)).map((r) => r.id);
    const p1 = Phaser.Utils.Array.GetRandom(pool);
    const p2 = Phaser.Utils.Array.GetRandom(pool);
    const stage = Phaser.Utils.Array.GetRandom(STAGES).id;
    this.scene.start(this.render3d ? 'Fight3D' : 'Fight', { p1, p2, stage, demo: true });
  }
}
