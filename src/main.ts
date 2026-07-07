import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from './engine';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { SelectScene } from './scenes/SelectScene';
import { VersusScene } from './scenes/VersusScene';
import { FightScene } from './scenes/FightScene';
import { FightScene3D } from './scenes/FightScene3D';
import { DanceScene } from './scenes/DanceScene';
import { LobbyScene } from './scenes/LobbyScene';
import { SettingsScene } from './scenes/SettingsScene';
import { ControlsScene } from './scenes/ControlsScene';
import { VolumeOverlayScene } from './scenes/VolumeOverlayScene';
import { EditorMenuScene } from './scenes/EditorMenuScene';
import { StagePinEditorScene } from './scenes/StagePinEditorScene';
import { CharacterCreatorScene } from './scenes/CharacterCreatorScene';
import { LaunchData, rememberDevLaunch } from './devLaunch';

const devWindow = window as unknown as { __mkScenePatch?: boolean; __game?: Phaser.Game };

if (import.meta.env.DEV) {
  // dev-only: paint uncaught errors on screen — a crashed rAF loop otherwise
  // looks like "the game froze" with no clue why
  const showError = (msg: string): void => {
    let el = document.getElementById('mk-error');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mk-error';
      el.style.cssText =
        'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#7a1010;' +
        'color:#fff;font:12px monospace;padding:6px 10px;white-space:pre-wrap;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
  };
  window.addEventListener('error', (e) => showError(`⚠ ${e.message}\n${e.filename}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => showError(`⚠ unhandled rejection: ${String(e.reason)}`));
}

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
  // Phaser's gamepad plugin is OFF on purpose: its per-scene wrapper array is
  // sparse (keyed by controller index) and stopListeners() crashes on the
  // holes during scene shutdown when a pad sits at index > 0, killing every
  // scene transition. All pad input reads navigator.getGamepads() directly
  // (src/input/keyboard.ts + src/input/menu-nav.ts).
  input: { gamepad: false },
  scene: [
    BootScene, MenuScene, SelectScene, VersusScene, FightScene, FightScene3D, DanceScene, LobbyScene,
    SettingsScene, ControlsScene, VolumeOverlayScene,
    // dev-only authoring tools — reachable only via the title's DEV EDITOR item
    // (import.meta.env.DEV). Registering them is harmless in prod (unreachable).
    ...(import.meta.env.DEV ? [EditorMenuScene, StagePinEditorScene, CharacterCreatorScene] : []),
  ],
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
