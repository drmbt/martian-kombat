import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from './engine';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { SelectScene } from './scenes/SelectScene';
import { VersusScene } from './scenes/VersusScene';
import { FightScene } from './scenes/FightScene';
import { SettingsScene } from './scenes/SettingsScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: STAGE_W,
  height: STAGE_H,
  backgroundColor: '#0c0910',
  input: { gamepad: true },
  scene: [BootScene, MenuScene, SelectScene, VersusScene, FightScene, SettingsScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

// debug handle: lets tooling step the loop manually when rAF is throttled
// (hidden tabs), e.g. `__game.loop.step(t += 16.7)`
(window as unknown as { __game: Phaser.Game }).__game = game;
