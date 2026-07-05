// Settings → Controls: per-player keyboard AND gamepad rebinding.
// Click a cell (or W/S + ENTER) to arm it, then press the key / pad button
// you want; same-device duplicates swap with the old binding so every action
// always stays reachable. Persisted via src/settings.ts.
import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { play } from './BootScene';
import { menuNav, navDefer } from '../input/menu-nav';
import {
  BIND_ACTIONS,
  BindAction,
  DEFAULT_BINDINGS,
  getSettings,
  updateSettings,
} from '../settings';

const ACTION_LABELS: Record<BindAction, string> = {
  up: 'UP / JUMP', down: 'DOWN / CROUCH', left: 'LEFT', right: 'RIGHT',
  lp: 'LIGHT PUNCH', mp: 'MEDIUM PUNCH', hp: 'HEAVY PUNCH',
  lk: 'LIGHT KICK', mk: 'MEDIUM KICK', hk: 'HEAVY KICK',
  taunt: 'TAUNT',
};

const KEY_LABELS: Record<number, string> = {
  8: 'BKSP', 9: 'TAB', 13: 'ENTER', 16: 'SHIFT', 17: 'CTRL', 18: 'ALT', 20: 'CAPS',
  32: 'SPACE', 37: '←', 38: '↑', 39: '→', 40: '↓', 186: ';', 187: '=', 188: ',',
  189: '-', 190: '.', 191: '/', 192: '`', 219: '[', 220: '\\', 221: ']', 222: "'",
};

function keyLabel(code: number): string {
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code >= 96 && code <= 105) return `NUM${code - 96}`;
  if (code >= 48 && code <= 90) return String.fromCharCode(code);
  return `#${code}`;
}

/** standard-mapping names (xbox-ish); anything exotic shows as B<n> */
const PAD_LABELS: Record<number, string> = {
  0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT',
  8: 'BACK', 9: 'START', 10: 'L3', 11: 'R3', 12: 'D-UP', 13: 'D-DOWN', 14: 'D-LEFT', 15: 'D-RIGHT',
};

const padLabel = (i: number): string => PAD_LABELS[i] ?? `B${i}`;

// layout
const CX = STAGE_W / 2;
const ROW0_Y = 148;
const ROW_H = 31;
const COL_KEY_X = CX + 40;
const COL_PAD_X = CX + 210;
const CELL_W = 130;

type Device = 'keys' | 'pad';

export class ControlsScene extends Phaser.Scene {
  private player: 0 | 1 = 0;
  private armed: { action: BindAction; device: Device } | null = null;
  /** pad buttons already down when arming — only a FRESH press binds */
  private armSnapshot = new Set<string>();
  private cellTexts: Record<string, Phaser.GameObjects.Text> = {};
  private tabTexts: Phaser.GameObjects.Text[] = [];
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super('Controls');
  }

  create(): void {
    this.player = 0;
    this.armed = null;
    this.cellTexts = {};
    this.tabTexts = [];

    const font = { fontFamily: 'monospace', color: '#f5ead9' };
    if (this.textures.exists('bg-salton')) {
      this.add.image(CX, STAGE_H / 2, 'bg-salton').setDisplaySize(STAGE_W, STAGE_H).setAlpha(0.35);
    }
    this.add.rectangle(CX, STAGE_H / 2, STAGE_W, STAGE_H, 0x0c0910, 0.65);
    this.add
      .text(CX, 52, 'CONTROLS', {
        ...font, fontSize: '36px', fontStyle: 'bold', color: '#ffb347',
        stroke: '#2a0a0a', strokeThickness: 10,
      })
      .setOrigin(0.5);

    // P1 / P2 tabs
    ([0, 1] as const).forEach((slot) => {
      const t = this.add
        .text(CX - 70 + slot * 140, 96, `PLAYER ${slot + 1}`, { ...font, fontSize: '20px', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.player = slot;
          this.armed = null;
          play(this, 's-blip', 0.5);
          this.redraw();
        });
      this.tabTexts.push(t);
    });

    // column headers
    this.add.text(COL_KEY_X + CELL_W / 2, 118, 'KEYBOARD', { ...font, fontSize: '13px', color: '#9a8fa8' }).setOrigin(0.5);
    this.add.text(COL_PAD_X + CELL_W / 2, 118, 'GAMEPAD', { ...font, fontSize: '13px', color: '#9a8fa8' }).setOrigin(0.5);

    BIND_ACTIONS.forEach((action, i) => {
      const y = ROW0_Y + i * ROW_H;
      this.add.text(CX - 40, y, ACTION_LABELS[action], { ...font, fontSize: '16px' }).setOrigin(1, 0.5);
      for (const [device, x] of [['keys', COL_KEY_X], ['pad', COL_PAD_X]] as [Device, number][]) {
        const bg = this.add
          .rectangle(x + CELL_W / 2, y, CELL_W, ROW_H - 6, 0x241b2e, 0.9)
          .setStrokeStyle(1, 0x7a6a86)
          .setInteractive({ useHandCursor: true });
        const txt = this.add.text(x + CELL_W / 2, y, '', { ...font, fontSize: '15px', color: '#58e6d9' }).setOrigin(0.5);
        this.cellTexts[`${device}-${action}`] = txt;
        bg.on('pointerover', () => bg.setStrokeStyle(1, 0xffb347));
        bg.on('pointerout', () => bg.setStrokeStyle(1, 0x7a6a86));
        bg.on('pointerdown', () => this.arm(action, device));
      }
    });

    // reset + back rows
    const resetTxt = this.add
      .text(CX - 130, ROW0_Y + BIND_ACTIONS.length * ROW_H + 14, 'RESET BINDINGS', {
        ...font, fontSize: '17px', fontStyle: 'bold', color: '#ff8a7a', stroke: '#000', strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        updateSettings({ bindings: JSON.parse(JSON.stringify(DEFAULT_BINDINGS)) });
        this.armed = null;
        play(this, 's-blip');
        this.redraw();
      });
    const backTxt = this.add
      .text(CX + 130, resetTxt.y, 'BACK', {
        ...font, fontSize: '17px', fontStyle: 'bold', stroke: '#000', strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('Settings'));

    this.hint = this.add
      .text(CX, STAGE_H - 22, '', { ...font, fontSize: '13px', color: '#9a8fa8', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5);

    // one native listener does double duty: bind the armed key cell, ESC backs out
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (this.armed?.device === 'keys') {
        e.preventDefault();
        if (e.keyCode === 27) this.armed = null; // ESC cancels
        else this.bindTo(e.keyCode);
        this.redraw();
      } else if (e.keyCode === 27) {
        this.scene.start('Settings');
      }
    });

    this.redraw();
  }

  private arm(action: BindAction, device: Device): void {
    this.armed = { action, device };
    this.armSnapshot = this.pressedPadButtons();
    play(this, 's-blip', 0.5);
    this.redraw();
  }

  private pressedPadButtons(): Set<string> {
    // read the browser API directly — Phaser's per-scene pad wrappers drop
    // updates whose timestamp predates the wrapper (see src/input/menu-nav.ts)
    const down = new Set<string>();
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    pads.forEach((pad, p) => {
      pad?.buttons.forEach((b, i) => {
        if (b.pressed || b.value > 0.4) down.add(`${p}:${i}`);
      });
    });
    return down;
  }

  /** Write the armed binding; a same-device duplicate swaps with the old one. */
  private bindTo(code: number): void {
    if (!this.armed) return;
    const { action, device } = this.armed;
    const bindings = JSON.parse(JSON.stringify(getSettings().bindings)) as typeof DEFAULT_BINDINGS;
    const table = bindings[this.player][device];
    const old = table[action];
    for (const a of BIND_ACTIONS) {
      if (a !== action && table[a] === code) table[a] = old;
    }
    table[action] = code;
    updateSettings({ bindings });
    this.armed = null;
    play(this, 's-blip');
  }

  update(): void {
    // poll every frame so the shared tracker's held-state stays fresh, but only
    // act on Select when no cell is armed — armed presses are bind material
    const n = menuNav.poll();
    if (!this.armed && n.menu) {
      navDefer(this, () => this.scene.start('Settings'));
      return;
    }
    // pad rebinding: the first FRESH button press (not held while arming) wins
    if (this.armed?.device !== 'pad') return;
    for (const entry of this.pressedPadButtons()) {
      if (this.armSnapshot.has(entry)) continue;
      this.bindTo(Number(entry.split(':')[1]));
      this.redraw();
      return;
    }
  }

  private redraw(): void {
    this.tabTexts.forEach((t, i) =>
      t.setColor(i === this.player ? '#ffd24a' : '#7a6a86'),
    );
    const b = getSettings().bindings[this.player];
    for (const action of BIND_ACTIONS) {
      for (const device of ['keys', 'pad'] as Device[]) {
        const txt = this.cellTexts[`${device}-${action}`];
        const isArmed = this.armed?.action === action && this.armed?.device === device;
        if (isArmed) txt.setText('PRESS…').setColor('#ffd24a');
        else {
          const code = b[device][action];
          txt.setText(device === 'keys' ? keyLabel(code) : padLabel(code)).setColor('#58e6d9');
        }
      }
    }
    this.hint.setText(
      this.armed
        ? this.armed.device === 'keys'
          ? 'press a key to bind · ESC cancels'
          : 'press a gamepad button to bind'
        : 'click a cell to rebind · duplicates swap · left stick always moves · ESC back',
    );
  }
}
