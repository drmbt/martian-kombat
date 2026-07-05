// 3D attract: the meshed roster dances the Thriller in a synced formation.
// Phaser owns scene flow + music; a Three canvas (the DanceRenderer) mounts
// over the Phaser one, same as FightScene3D. No engine, no HUD — pure show.
// three is loaded dynamically so the 2D bundle never ships it.
import Phaser from 'phaser';
import { characters } from '../data/characters';
import { ROSTER } from '../data/roster';
import { STAGES } from '../data/stages';
import { playMusic } from '../audio/music';
import type { DanceRenderer } from '../renderer3d/DanceRenderer';

export class DanceScene extends Phaser.Scene {
  private dance: DanceRenderer | null = null;
  private hint: HTMLDivElement | null = null;

  constructor() {
    super('Dance');
  }

  create(): void {
    // dance to an actual STAGE track (never menu blips) — a random stage each
    // time for variety; the whole stage-music pool, else the default stage track
    const stage = Phaser.Utils.Array.GetRandom(STAGES);
    playMusic([`stages/${stage.id}`, 'stages/default']);
    void this.boot();

    // attract: any key/click returns to the title (` stays free for perf); it
    // also auto-returns so the menu's attract cycle keeps rolling
    const toMenu = (): void => { this.scene.start('Menu'); };
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => { if (e.key !== '`') toMenu(); });
    this.input.on('pointerdown', toMenu);
    // mouse wheel dollies the camera in/out
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.dance?.zoom(dy));
    this.time.delayedCall(45_000, toMenu);

    const host = this.game.canvas.parentElement ?? document.body;
    this.hint = document.createElement('div');
    this.hint.textContent = '♪ DANCE — PRESS ANY KEY';
    this.hint.style.cssText =
      'position:absolute;left:50%;bottom:22px;transform:translateX(-50%);z-index:40;' +
      'font:bold 20px monospace;color:#ffd24a;text-shadow:0 2px 5px #000;pointer-events:none;';
    host.appendChild(this.hint);

    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layout, this);
      this.hint?.remove();
      this.hint = null;
      this.dance?.dispose();
      this.dance = null;
    });
  }

  private async boot(): Promise<void> {
    const { DanceRenderer } = await import('../renderer3d/DanceRenderer');
    const ids = ROSTER.filter((r) => r.mesh3d).map((r) => r.id);
    const renderer = new DanceRenderer(characters, ids);
    if (!this.scene.isActive()) {
      renderer.dispose();
      return;
    }
    this.dance = renderer;
    this.mount(renderer.canvas);
    await renderer.init();
  }

  private mount(canvas: HTMLCanvasElement): void {
    const parent = this.game.canvas.parentElement ?? document.body;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    canvas.style.cssText = 'position:absolute;pointer-events:none;';
    parent.appendChild(canvas);
    this.layout();
  }

  private layout(): void {
    const r = this.dance;
    if (!r) return;
    const game = this.game.canvas;
    const parent = game.parentElement ?? document.body;
    const pr = parent.getBoundingClientRect();
    const gr = game.getBoundingClientRect();
    r.canvas.style.left = `${gr.left - pr.left}px`;
    r.canvas.style.top = `${gr.top - pr.top}px`;
    r.canvas.style.width = `${gr.width}px`;
    r.canvas.style.height = `${gr.height}px`;
    r.setSize(Math.round(gr.width), Math.round(gr.height));
  }
}
