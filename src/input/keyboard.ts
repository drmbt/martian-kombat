// Keyboard + gamepad -> InputFrame snapshots, one per engine tick.
// Bindings come from settings (Settings → Controls, press-to-bind); defaults:
// P1: WASD moves · R/T/Y = LP/MP/HP · F/G/H = LK/MK/HK
// P2: arrows move · U/I/O = LP/MP/HP · J/K/L = LK/MK/HK
// Pads (first connected pad = P1, second = P2): remappable button indices
// (default dpad moves · X/Y/RB = punches · A/B/RT = kicks); the left stick
// always moves. Keyboard and pad are OR-merged so either works at any moment.
// Specials are motion inputs (QCF+punch), resolved inside the engine.
//
// Pads are read from navigator.getGamepads() DIRECTLY, never Phaser's gamepad
// plugin — the plugin keeps a SPARSE wrapper array keyed by controller index,
// and its stopListeners() crashes on the holes during every scene shutdown
// when a pad sits at index > 0 (common on macOS/Bluetooth), killing the game
// loop mid scene-transition. See src/input/menu-nav.ts for the same story.
import Phaser from 'phaser';
import type { InputFrame } from '../engine';
import { BIND_ACTIONS, getSettings, PlayerBindings } from '../settings';

/** Nth connected pad, compacted — a lone pad at browser index 1 still drives P1. */
function padForPlayer(player: 0 | 1): Gamepad | null {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
  let seen = 0;
  for (const p of navigator.getGamepads()) {
    if (p && p.connected) {
      if (seen === player) return p;
      seen++;
    }
  }
  return null;
}

export interface InputSource {
  poll(player: 0 | 1): InputFrame;
}

type KeyMap = Record<keyof InputFrame, Phaser.Input.Keyboard.Key>;

export class KeyboardSource implements InputSource {
  private maps: [KeyMap, KeyMap];
  private pads: [PlayerBindings['pad'], PlayerBindings['pad']];

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    const bindings = getSettings().bindings;
    const bind = (b: PlayerBindings): KeyMap => {
      const m = {} as KeyMap;
      for (const a of BIND_ACTIONS) {
        m[a] = kb.addKey(b.keys[a]);
        // keep bound keys (arrows, space, ...) from scrolling the page
        kb.addCapture(b.keys[a]);
      }
      return m;
    };
    this.maps = [bind(bindings[0]), bind(bindings[1])];
    this.pads = [bindings[0].pad, bindings[1].pad];
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
      taunt: m.taunt.isDown,
    };

    const pad = padForPlayer(player);
    if (pad) {
      const b = this.pads[player];
      const btn = (i: number): boolean => {
        const bt = pad.buttons[i];
        return !!bt && (bt.pressed || bt.value > 0.4);
      };
      const sx = pad.axes[0] ?? 0;
      const sy = pad.axes[1] ?? 0;
      frame.left ||= btn(b.left) || sx < -0.5;
      frame.right ||= btn(b.right) || sx > 0.5;
      frame.up ||= btn(b.up) || sy < -0.5;
      frame.down ||= btn(b.down) || sy > 0.5;
      frame.lp ||= btn(b.lp);
      frame.mp ||= btn(b.mp);
      frame.hp ||= btn(b.hp);
      frame.lk ||= btn(b.lk);
      frame.mk ||= btn(b.mk);
      frame.hk ||= btn(b.hk);
      frame.taunt ||= btn(b.taunt);
    }
    return frame;
  }
}
