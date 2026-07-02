// Keyboard + gamepad -> InputFrame snapshots, one per engine tick.
// P1: WASD moves · R/T/Y = LP/MP/HP · F/G/H = LK/MK/HK
// P2: arrows move · U/I/O = LP/MP/HP · J/K/L = LK/MK/HK
// Pads (slot order): dpad/left stick moves · X/Y/RB = punches · A/B/RT = kicks.
// Keyboard and pad are OR-merged so either works at any moment.
// Specials are motion inputs (QCF+punch), resolved inside the engine.
import Phaser from 'phaser';
import type { InputFrame } from '../engine';

export interface InputSource {
  poll(player: 0 | 1): InputFrame;
}

const P1_KEYS = {
  left: 'A', right: 'D', up: 'W', down: 'S',
  lp: 'R', mp: 'T', hp: 'Y',
  lk: 'F', mk: 'G', hk: 'H',
} as const;

const P2_KEYS = {
  left: 'LEFT', right: 'RIGHT', up: 'UP', down: 'DOWN',
  lp: 'U', mp: 'I', hp: 'O',
  lk: 'J', mk: 'K', hk: 'L',
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
      lp: m.lp.isDown,
      mp: m.mp.isDown,
      hp: m.hp.isDown,
      lk: m.lk.isDown,
      mk: m.mk.isDown,
      hk: m.hk.isDown,
    };

    const pad = this.scene.input.gamepad?.gamepads[player];
    if (pad) {
      const stick = pad.leftStick;
      frame.left ||= pad.left || stick.x < -0.5;
      frame.right ||= pad.right || stick.x > 0.5;
      frame.up ||= pad.up || stick.y < -0.5;
      frame.down ||= pad.down || stick.y > 0.5;
      frame.lp ||= pad.X;
      frame.mp ||= pad.Y;
      frame.hp ||= pad.R1 > 0.4;
      frame.lk ||= pad.A;
      frame.mk ||= pad.B;
      frame.hk ||= pad.R2 > 0.4;
    }
    return frame;
  }
}
