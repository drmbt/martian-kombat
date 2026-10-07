// The persistent, invisible scene that owns the ONE on-demand asset loader
// (P6.1). BootScene launches it once and nothing ever stops it, so its loader
// never shuts down mid-download (the bug that stranded AssetLoader promises
// when Select stopped while a sheet was streaming). It draws nothing.
import Phaser from 'phaser';
import { AssetLoader } from './assetLoader';

export class AssetHostScene extends Phaser.Scene {
  constructor() {
    super('AssetHost');
  }

  create(): void {
    AssetLoader.attach(this);
    // background HTTP-cache warm-up — delayed a beat so the menu paints first
    this.time.delayedCall(600, () => AssetLoader.prefetchAll());
  }
}
