import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from './engine';
import { FightScene } from './scenes/FightScene';

new Phaser.Game({
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
