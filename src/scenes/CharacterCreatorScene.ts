// Dev-only Character Creator wizard scene. Draws a dim grid-stage backdrop and
// mounts the DOM wizard (CharacterCreatorPanel) over it via a UiLayer — the same
// "playable stage with dialog overlays" pattern the Sprite Editor uses. Reached
// from EditorMenuScene → CHARACTER CREATOR (import.meta.env.DEV only). See
// docs/CHARACTER_CREATOR.md.
import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { UiLayer } from '../ui/layer';
import { CharacterCreatorPanel } from '../ui/CharacterCreatorPanel';

export class CharacterCreatorScene extends Phaser.Scene {
  private layer?: UiLayer;
  private panel?: CharacterCreatorPanel;

  constructor() {
    super('CharacterCreator');
  }

  create(): void {
    this.add.rectangle(STAGE_W / 2, STAGE_H / 2, STAGE_W, STAGE_H, 0x0a0d14, 1);
    // faint grid so the DOM overlay reads as sitting "on a stage"
    const g = this.add.graphics();
    g.lineStyle(1, 0x162230, 0.6);
    for (let x = 0; x <= STAGE_W; x += 48) g.lineBetween(x, 0, x, STAGE_H);
    for (let y = 0; y <= STAGE_H; y += 48) g.lineBetween(0, y, STAGE_W, y);

    // one-time CSS for the async "diffusion" shimmer
    if (!document.getElementById('mk-cc-style')) {
      const st = document.createElement('style');
      st.id = 'mk-cc-style';
      st.textContent = '@keyframes mkShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}';
      document.head.appendChild(st);
    }

    this.layer = new UiLayer(this);
    this.panel = new CharacterCreatorPanel(this.layer.root, () => this.scene.start('EditorMenu'));

    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('EditorMenu'));
    this.events.once('shutdown', () => this.panel?.dispose());
  }
}
