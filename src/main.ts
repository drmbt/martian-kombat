import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from './engine';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { SelectScene } from './scenes/SelectScene';
import { VersusScene } from './scenes/VersusScene';
import { FightScene } from './scenes/FightScene';
import { SettingsScene } from './scenes/SettingsScene';
import { ControlsScene } from './scenes/ControlsScene';
import { VolumeOverlayScene } from './scenes/VolumeOverlayScene';
import { LaunchData, rememberDevLaunch } from './devLaunch';

const devWindow = window as unknown as { __mkScenePatch?: boolean; __game?: Phaser.Game };

if (import.meta.env.DEV && !devWindow.__mkScenePatch) {
  devWindow.__mkScenePatch = true;
  const start = Phaser.Scenes.ScenePlugin.prototype.start;
  Phaser.Scenes.ScenePlugin.prototype.start = function patchedStart(
    key: string,
    data?: LaunchData,
  ): Phaser.Scenes.ScenePlugin {
    rememberDevLaunch(key, data);
    return start.call(this, key, data);
  };

  const restart = Phaser.Scenes.ScenePlugin.prototype.restart;
  Phaser.Scenes.ScenePlugin.prototype.restart = function patchedRestart(data?: LaunchData): Phaser.Scenes.ScenePlugin {
    rememberDevLaunch(this.key, data);
    return restart.call(this, data);
  };
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: STAGE_W,
  height: STAGE_H,
  backgroundColor: '#0c0910',
  input: { gamepad: true },
  scene: [BootScene, MenuScene, SelectScene, VersusScene, FightScene, SettingsScene, ControlsScene, VolumeOverlayScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

// debug handle: lets tooling step the loop manually when rAF is throttled
// (hidden tabs), e.g. `__game.loop.step(t += 16.7)`
devWindow.__game = game;

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy(true);
  });
}
