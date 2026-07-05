// Pinned DOM layer over the Phaser canvas — the ONE mount point for the
// shared UI chrome in both renderers. Children position with inset/absolute
// against the game viewport; the layer tracks the canvas rect on resize.
// pointer-events default to none so gameplay clicks pass through; individual
// components (pause menu) opt back in on their own subtree.
import Phaser from 'phaser';

export class UiLayer {
  readonly root: HTMLDivElement;

  constructor(private scene: Phaser.Scene) {
    const parent = scene.game.canvas.parentElement ?? document.body;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    this.root = document.createElement('div');
    this.root.style.cssText = 'position:absolute;pointer-events:none;overflow:hidden;z-index:5;';
    parent.appendChild(this.root);
    this.layout();
    scene.scale.on('resize', this.layout, this);
    scene.events.once('shutdown', () => this.dispose());
  }

  /** align the layer with the (possibly letterboxed/scaled) game canvas */
  layout(): void {
    const game = this.scene.game.canvas;
    const parent = game.parentElement ?? document.body;
    const pr = parent.getBoundingClientRect();
    const gr = game.getBoundingClientRect();
    this.root.style.left = `${gr.left - pr.left}px`;
    this.root.style.top = `${gr.top - pr.top}px`;
    this.root.style.width = `${gr.width}px`;
    this.root.style.height = `${gr.height}px`;
  }

  dispose(): void {
    this.scene.scale.off('resize', this.layout, this);
    this.root.remove();
  }
}
