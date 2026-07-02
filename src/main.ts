import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from './engine';
import { FightScene } from './scenes/FightScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: STAGE_W,
  height: STAGE_H,
  backgroundColor: '#0c0910',
  scene: [FightScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

// debug handle: lets tooling step the loop manually when rAF is throttled
// (hidden tabs), e.g. `__game.loop.step(t += 16.7)`
(window as unknown as { __game: Phaser.Game }).__game = game;
