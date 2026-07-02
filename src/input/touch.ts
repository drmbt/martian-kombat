// On-screen touch/mouse controls for P1: a directional pad (bottom-left) and
// six attack buttons (bottom-right). Multi-touch aware — each control tracks
// the set of pointer ids currently pressing it, so a touch device can hold a
// direction and press a button at once. A single mouse can only press one
// control at a time, which is enough for casual browser play and menus.
//
// Exposes poll() -> Partial<InputFrame>; FightScene OR-merges it into P1.
import Phaser from 'phaser';
import type { InputFrame } from '../engine';

type Ctl = keyof InputFrame;

interface Zone {
  ctl: Ctl;
  gfx: Phaser.GameObjects.Graphics;
  hit: Phaser.Geom.Circle | Phaser.Geom.Rectangle;
  cx: number;
  cy: number;
  label?: Phaser.GameObjects.Text;
  color: number;
  pressed: Set<number>;
}

const IDLE_ALPHA = 0.22;
const PRESSED_ALPHA = 0.7;

export class TouchControls {
  private zones: Zone[] = [];
  private container: Phaser.GameObjects.Container;
  private handlers: { event: string; fn: (p: Phaser.Input.Pointer) => void }[] = [];
  visible = true;

  constructor(private scene: Phaser.Scene, w: number, h: number) {
    this.container = scene.add.container(0, 0).setDepth(7);

    // --- d-pad, bottom-left ---
    const dx = 118;
    const dy = h - 104;
    const r = 34;
    const gap = 42;
    this.addCircle('left', dx - gap, dy, r, 0x58e6d9, '◀');
    this.addCircle('right', dx + gap, dy, r, 0x58e6d9, '▶');
    this.addCircle('up', dx, dy - gap, r, 0x58e6d9, '▲');
    this.addCircle('down', dx, dy + gap, r, 0x58e6d9, '▼');

    // --- attack buttons, bottom-right (P=punch row, K=kick row) ---
    const bx = w - 210;
    const by = h - 118;
    const br = 30;
    const sx = 66;
    const sy = 62;
    const punch = 0xff7a5a;
    const kick = 0xffd24a;
    this.addCircle('lp', bx, by, br, punch, 'LP');
    this.addCircle('mp', bx + sx, by, br, punch, 'MP');
    this.addCircle('hp', bx + sx * 2, by, br, punch, 'HP');
    this.addCircle('lk', bx, by + sy, br, kick, 'LK');
    this.addCircle('mk', bx + sx, by + sy, br, kick, 'MK');
    this.addCircle('hk', bx + sx * 2, by + sy, br, kick, 'HK');

    this.wireGlobalPointer();
    this.redraw();
  }

  private addCircle(ctl: Ctl, cx: number, cy: number, r: number, color: number, label: string): void {
    const gfx = this.scene.add.graphics();
    const txt = this.scene.add
      .text(cx, cy, label, {
        fontFamily: 'monospace', fontSize: label.length > 1 ? '15px' : '22px',
        fontStyle: 'bold', color: '#0c0910',
      })
      .setOrigin(0.5);
    this.container.add([gfx, txt]);
    this.zones.push({
      ctl, gfx, cx, cy, color, label: txt,
      hit: new Phaser.Geom.Circle(cx, cy, r + 6), // a touch slop for fingers
      pressed: new Set(),
    });
  }

  /** Global pointer handlers: any pointer over a zone presses it; releasing or
   *  dragging out clears that pointer from the zone. Handled at the scene level
   *  (not per-object interactive) so multi-touch tracking stays simple. */
  private wireGlobalPointer(): void {
    const input = this.scene.input;
    const hitAt = (px: number, py: number): Zone | null => {
      for (const z of this.zones) {
        if (Phaser.Geom.Circle.Contains(z.hit as Phaser.Geom.Circle, px, py)) return z;
      }
      return null;
    };
    const clearPointer = (id: number, exceptZone?: Zone | null) => {
      for (const z of this.zones) {
        if (z !== exceptZone && z.pressed.delete(id)) this.redraw();
      }
    };
    const on = (event: string, fn: (p: Phaser.Input.Pointer) => void) => {
      input.on(event, fn);
      this.handlers.push({ event, fn });
    };
    on('pointerdown', (p) => {
      if (!this.visible) return;
      const z = hitAt(p.x, p.y);
      if (z) { z.pressed.add(p.id); this.redraw(); }
    });
    on('pointermove', (p) => {
      if (!this.visible || !p.isDown) return;
      const z = hitAt(p.x, p.y);
      clearPointer(p.id, z);         // dragging off a zone releases it
      if (z && !z.pressed.has(p.id)) { z.pressed.add(p.id); this.redraw(); }
    });
    const release = (p: Phaser.Input.Pointer) => clearPointer(p.id);
    on('pointerup', release);
    on('pointerupoutside', release);
  }

  private redraw(): void {
    for (const z of this.zones) {
      const c = z.hit as Phaser.Geom.Circle;
      const down = z.pressed.size > 0;
      z.gfx.clear();
      z.gfx.fillStyle(z.color, down ? PRESSED_ALPHA : IDLE_ALPHA);
      z.gfx.lineStyle(2, z.color, down ? 0.95 : 0.5);
      z.gfx.fillCircle(c.x, c.y, c.radius - 6);
      z.gfx.strokeCircle(c.x, c.y, c.radius - 6);
      z.label?.setAlpha(down ? 0.95 : 0.5);
    }
  }

  setVisible(v: boolean): void {
    if (v === this.visible) return;
    this.visible = v;
    this.container.setVisible(v);
    if (!v) {
      for (const z of this.zones) z.pressed.clear();
      this.redraw();
    }
  }

  poll(): Partial<InputFrame> {
    const out: Partial<InputFrame> = {};
    if (!this.visible) return out;
    for (const z of this.zones) if (z.pressed.size > 0) out[z.ctl] = true;
    return out;
  }

  destroy(): void {
    for (const h of this.handlers) this.scene.input.off(h.event, h.fn);
    this.handlers = [];
    this.container.destroy();
  }
}
