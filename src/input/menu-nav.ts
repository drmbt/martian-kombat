// Gamepad -> menu navigation pulses, shared by every menu surface.
//
// Reads navigator.getGamepads() DIRECTLY each poll — never Phaser's per-scene
// gamepad plugin. Phaser's Gamepad wrapper drops any pad snapshot whose
// timestamp predates the wrapper's creation (Gamepad.js: `pad.timestamp <
// this._created`), and each scene start creates fresh wrappers — so menu
// input would freeze after a scene change with real controllers (Chrome only
// bumps pad.timestamp on state CHANGE). Going straight to the browser API
// sidesteps that whole class of bug.
//
// One module-level singleton keeps a persistent held-state across scene
// transitions: a button still held when a new screen appears stays "held" and
// must be released and pressed again to fire. That kills cross-screen
// bleed-through (one press acting on two screens) with no per-scene seeding.
//
//   up / down / left / right — dpad OR left stick, auto-repeat while held
//   confirm                  — ANY punch or kick button (from bindings) + A/B
//   start                    — Start (9): confirm in menus, pause in a fight
//   menu                     — Back/Select (8): open the menu / back out
//   anyHeld                  — raw "some pad input is down" (presence, not an edge)
//
// All connected pads are OR-merged, so any controller drives the menus.
import type Phaser from 'phaser';
import { BindAction, getSettings, Settings } from '../settings';

const DEADZONE = 0.5;
const FIRST_REPEAT_MS = 380; // initial delay before a held direction repeats
const REPEAT_MS = 150;

// standard-mapping indices for the non-remappable menu controls
const BTN = { A: 0, B: 1, BACK: 8, START: 9, DUP: 12, DDOWN: 13, DLEFT: 14, DRIGHT: 15 };

/** the six attack actions — any of them selects in a menu */
const ATTACKS: BindAction[] = ['lp', 'mp', 'hp', 'lk', 'mk', 'hk'];

export interface NavPulse {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  /** any punch/kick button (+ A/B) — "select this item" */
  confirm: boolean;
  /** Start — confirm in menus, pause in a fight */
  start: boolean;
  /** Back/Select — "open the menu / go back" */
  menu: boolean;
  /** raw held-state (no edge): used for presence/attract-idle, never actions */
  anyHeld: boolean;
}

type Signal = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'start' | 'menu';
const SIGNALS: Signal[] = ['up', 'down', 'left', 'right', 'confirm', 'start', 'menu'];
const REPEATING: ReadonlySet<Signal> = new Set(['up', 'down', 'left', 'right']);

/** The slice of the Gamepad API we read (mockable in tests). */
export interface PadLike {
  connected: boolean;
  buttons: readonly { pressed: boolean; value: number }[];
  axes: readonly number[];
}
export type PadSource = () => readonly (PadLike | null)[];

/** Keyboard keycodes bound to any attack, for either player — menus let any of
 *  them confirm too (so R/T/Y/F/G/H and U/I/O/J/K/L all "select"). */
export function attackKeyCodes(): Set<number> {
  const codes = new Set<number>();
  for (const p of getSettings().bindings) for (const a of ATTACKS) codes.add(p.keys[a]);
  return codes;
}

export class MenuNav {
  private source: PadSource;
  private held: Record<Signal, boolean> = {
    up: false, down: false, left: false, right: false, confirm: false, start: false, menu: false,
  };
  private repeatAt: Partial<Record<Signal, number>> = {};
  private seeded = false;
  /** confirm-button set cache, invalidated when the settings object changes */
  private confirmFor: Settings | null = null;
  private confirmButtons: number[] = [BTN.A, BTN.B];

  constructor(source: PadSource) {
    this.source = source;
  }

  /** Call once per frame from the active scene's update(). */
  poll(now: number = performance.now()): NavPulse {
    const raw = this.readRaw();
    // First-ever poll only seeds held-state: anything already down when the
    // game gains a poller (e.g. a button held through a page load) must be
    // released and pressed again before it can fire.
    if (!this.seeded) {
      this.seeded = true;
      for (const s of SIGNALS) this.held[s] = raw[s];
      return {
        up: false, down: false, left: false, right: false,
        confirm: false, start: false, menu: false, anyHeld: raw.anyHeld,
      };
    }
    return {
      up: this.edge('up', raw.up, now),
      down: this.edge('down', raw.down, now),
      left: this.edge('left', raw.left, now),
      right: this.edge('right', raw.right, now),
      confirm: this.edge('confirm', raw.confirm, now),
      start: this.edge('start', raw.start, now),
      menu: this.edge('menu', raw.menu, now),
      anyHeld: raw.anyHeld,
    };
  }

  private edge(key: Signal, down: boolean, now: number): boolean {
    const wasDown = this.held[key];
    this.held[key] = down;
    const repeat = REPEATING.has(key);
    if (down && !wasDown) {
      if (repeat) this.repeatAt[key] = now + FIRST_REPEAT_MS;
      return true; // rising edge
    }
    if (down && repeat && now >= (this.repeatAt[key] ?? Infinity)) {
      this.repeatAt[key] = now + REPEAT_MS;
      return true; // auto-repeat tick (directions only)
    }
    return false;
  }

  private refreshConfirmButtons(): void {
    const s = getSettings();
    if (s === this.confirmFor) return;
    const set = new Set<number>([BTN.A, BTN.B]);
    for (const p of s.bindings) for (const a of ATTACKS) set.add(p.pad[a]);
    this.confirmFor = s;
    this.confirmButtons = [...set];
  }

  private readRaw(): Record<Signal, boolean> & { anyHeld: boolean } {
    this.refreshConfirmButtons();
    const r = {
      up: false, down: false, left: false, right: false,
      confirm: false, start: false, menu: false, anyHeld: false,
    };
    for (const pad of this.source()) {
      if (!pad || !pad.connected) continue;
      const b = (i: number): boolean => {
        const bt = pad.buttons[i];
        return !!bt && (bt.pressed || bt.value > 0.4);
      };
      const sx = pad.axes[0] ?? 0;
      const sy = pad.axes[1] ?? 0;
      r.up ||= b(BTN.DUP) || sy < -DEADZONE;
      r.down ||= b(BTN.DDOWN) || sy > DEADZONE;
      r.left ||= b(BTN.DLEFT) || sx < -DEADZONE;
      r.right ||= b(BTN.DRIGHT) || sx > DEADZONE;
      for (const i of this.confirmButtons) {
        if (b(i)) { r.confirm = true; break; }
      }
      r.start ||= b(BTN.START);
      r.menu ||= b(BTN.BACK);
      r.anyHeld ||=
        r.up || r.down || r.left || r.right || r.confirm || r.start || r.menu ||
        pad.buttons.some((bt) => bt.pressed);
    }
    return r;
  }
}

/** The one shared tracker every scene polls. */
export const menuNav = new MenuNav(() =>
  typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [],
);

/**
 * Run a pad-triggered action just OUTSIDE the Phaser step (macrotask).
 *
 * Scene transitions kicked off synchronously inside scene.update() queue their
 * op mid scene-manager iteration and rely on the NEXT frame applying it — which
 * proved unreliable on real hardware (the selection registered but the next
 * scene never appeared), while identical transitions fired from DOM-event
 * handlers or delayedCall() work everywhere. So every pad action takes the
 * same between-frames path. Skips the action if the scene has been stopped in
 * the meantime (e.g. a double press queued two transitions).
 */
export function navDefer(scene: Phaser.Scene, fn: () => void): void {
  setTimeout(() => {
    if (scene.scene.isActive()) fn();
  }, 0);
}
