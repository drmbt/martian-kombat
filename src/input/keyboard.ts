// Keyboard + gamepad -> InputFrame snapshots, one per engine tick.
// P1: WASD + F (light) G (heavy) H (special)
// P2: arrows + K (light) L (heavy) ; (special)
// Pads (slot order): dpad/left stick moves, X = light, Y = heavy, A/B = special.
// Keyboard and pad are OR-merged so either works at any moment.
import Phaser from 'phaser';
import type { InputFrame } from '../engine';

export interface InputSource {
  poll(player: 0 | 1): InputFrame;
}

const P1_KEYS = {
  left: 'A', right: 'D', up: 'W', down: 'S',
  light: 'F', heavy: 'G', special: 'H',
} as const;

const P2_KEYS = {
  left: 'LEFT', right: 'RIGHT', up: 'UP', down: 'DOWN',
  light: 'K', heavy: 'L', special: 'SEMICOLON',
} as const;

type KeyMap = Record<keyof InputFrame, Phaser.Input.Keyboard.Key>;

export class KeyboardSource implements InputSource {
  private maps: [KeyMap, KeyMap];
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard!;
    const bind = (spec: typeof P1_KEYS | typeof P2_KEYS): KeyMap => {
      const m = {} as KeyMap;
      (Object.keys(spec) as (keyof InputFrame)[]).forEach((k) => {
        m[k] = kb.addKey(Phaser.Input.Keyboard.KeyCodes[spec[k] as keyof typeof Phaser.Input.Keyboard.KeyCodes]);
      });
      return m;
    };
    this.maps = [bind(P1_KEYS), bind(P2_KEYS)];
    // keep arrows/space from scrolling the page
    kb.addCapture(['LEFT', 'RIGHT', 'UP', 'DOWN', 'SPACE']);
  }

  poll(player: 0 | 1): InputFrame {
    const m = this.maps[player];
    const frame: InputFrame = {
      left: m.left.isDown,
      right: m.right.isDown,
      up: m.up.isDown,
      down: m.down.isDown,
      light: m.light.isDown,
      heavy: m.heavy.isDown,
      special: m.special.isDown,
    };

    const pad = this.scene.input.gamepad?.gamepads[player];
    if (pad) {
      const stick = pad.leftStick;
      frame.left ||= pad.left || stick.x < -0.5;
      frame.right ||= pad.right || stick.x > 0.5;
      frame.up ||= pad.up || stick.y < -0.5;
      frame.down ||= pad.down || stick.y > 0.5;
      frame.light ||= pad.X;
      frame.heavy ||= pad.Y;
      frame.special ||= pad.A || pad.B;
    }
    return frame;
  }
}
