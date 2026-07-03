// Quick-volume overlay: a small speaker + master fader pinned to the lower
// right that fades in whenever the mouse moves over the game and hides after
// a moment of stillness (it stays up while muted or mid-drag). Launched once
// by BootScene and kept running above every other scene. Clicking the speaker
// toggles master mute; dragging the fader sets master volume — both persist
// via settings and apply to music and SFX immediately.
import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { applyMusicVolume } from '../audio/volume';
import { getSettings, updateSettings } from '../settings';
import { play } from './BootScene';

const PANEL_W = 220;
const PANEL_H = 48;
const TRACK_W = 120;
const TRACK_H = 10;
const HIDE_AFTER_MS = 2600;

export class VolumeOverlayScene extends Phaser.Scene {
  private panel!: Phaser.GameObjects.Container;
  private icon!: Phaser.GameObjects.Text;
  private fill!: Phaser.GameObjects.Graphics;
  private pct!: Phaser.GameObjects.Text;
  private trackX = 0; // panel-local left edge of the fader track
  private hideTimer: Phaser.Time.TimerEvent | null = null;
  private dragging = false;
  private zone!: Phaser.GameObjects.Zone;

  constructor() {
    super('Volume');
  }

  create(): void {
    this.scene.bringToTop();

    const px = STAGE_W - PANEL_W - 14;
    const py = STAGE_H - PANEL_H - 14;
    this.panel = this.add.container(px, py).setAlpha(0).setVisible(false);

    const bg = this.add.graphics();
    bg.fillStyle(0x14101a, 0.92).fillRoundedRect(0, 0, PANEL_W, PANEL_H, 10);
    bg.lineStyle(2, 0x7a6a86, 1).strokeRoundedRect(0, 0, PANEL_W, PANEL_H, 10);
    this.panel.add(bg);

    this.icon = this.add
      .text(28, PANEL_H / 2, '', { fontSize: '24px' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.icon.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation(); // don't let the click reach the scene underneath
        updateSettings({ muted: !getSettings().muted });
        applyMusicVolume();
        play(this, 's-blip', 0.6); // silent when muting, audible when unmuting
        this.redraw();
        this.poke();
      },
    );
    this.panel.add(this.icon);

    this.trackX = 52;
    const track = this.add.graphics();
    track.fillStyle(0x0c0910, 1).fillRect(this.trackX, (PANEL_H - TRACK_H) / 2, TRACK_W, TRACK_H);
    track.lineStyle(1, 0x7a6a86, 1).strokeRect(this.trackX, (PANEL_H - TRACK_H) / 2, TRACK_W, TRACK_H);
    this.panel.add(track);
    this.fill = this.add.graphics();
    this.panel.add(this.fill);

    this.pct = this.add
      .text(this.trackX + TRACK_W + 12, PANEL_H / 2, '', {
        fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: '#58e6d9',
        stroke: '#000', strokeThickness: 3,
      })
      .setOrigin(0, 0.5);
    this.panel.add(this.pct);

    // generous grab zone around the track (mouse-friendly)
    this.zone = this.add
      .zone(px + this.trackX - 6, py, TRACK_W + 24, PANEL_H)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    const zone = this.zone;
    zone.on(
      'pointerdown',
      (p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        this.dragging = true;
        this.setFromPointer(p);
      },
    );
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragging && p.isDown) this.setFromPointer(p);
      this.poke(); // any mouse motion over the game reveals the overlay
    });
    this.input.on('pointerup', () => {
      if (this.dragging) {
        this.dragging = false;
        play(this, 's-blip', 0.5); // level check at the new volume
      }
    });

    this.redraw();
    this.setHitAreas(false); // hidden until the mouse moves
  }

  private setFromPointer(p: Phaser.Input.Pointer): void {
    const frac = (p.x - (this.panel.x + this.trackX)) / TRACK_W;
    const v = Math.round(Math.max(0, Math.min(1, frac)) * 20) / 20;
    updateSettings({ masterVolume: v, muted: false }); // touching the fader unmutes
    applyMusicVolume();
    this.redraw();
  }

  /** Reveal the panel and (re)arm the auto-hide. */
  private poke(): void {
    this.redraw(); // settings may have changed elsewhere (settings page, reset)
    this.panel.setVisible(true);
    this.setHitAreas(true);
    this.tweens.add({ targets: this.panel, alpha: 1, duration: 150 });
    this.hideTimer?.remove();
    this.hideTimer = this.time.delayedCall(HIDE_AFTER_MS, () => {
      if (this.dragging || getSettings().muted) return this.poke(); // stay up
      this.tweens.add({
        targets: this.panel,
        alpha: 0,
        duration: 400,
        onComplete: () => {
          this.panel.setVisible(false);
          this.setHitAreas(false); // a hidden panel must not eat corner clicks
        },
      });
    });
  }

  private setHitAreas(on: boolean): void {
    if (this.icon.input) this.icon.input.enabled = on;
    if (this.zone.input) this.zone.input.enabled = on;
  }

  private redraw(): void {
    const s = getSettings();
    this.icon.setText(s.muted ? '🔇' : '🔊');
    this.pct.setText(s.muted ? 'MUTE' : `${Math.round(s.masterVolume * 100)}%`);
    this.pct.setColor(s.muted ? '#ff5a48' : '#58e6d9');
    this.fill.clear();
    this.fill
      .fillStyle(s.muted ? 0x7a6a86 : 0x58e6d9, 1)
      .fillRect(this.trackX, (PANEL_H - TRACK_H) / 2, TRACK_W * s.masterVolume, TRACK_H);
  }
}
