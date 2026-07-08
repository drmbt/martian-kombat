// Quick-volume overlay: a small speaker button pinned to the FAR UPPER-RIGHT
// corner that fades in on mouse motion. Clicking it toggles master mute
// (on/off only). Hovering it drops a VERTICAL fader beneath the button;
// dragging sets master volume (top = 100%). Both persist via settings and
// apply to music + SFX immediately. Launched once by BootScene and kept
// running above every other scene.
import Phaser from 'phaser';
import { STAGE_W } from '../engine';
import { applyMusicVolume } from '../audio/volume';
import { getSettings, updateSettings } from '../settings';
import { play } from './BootScene';

const ICON_R = 17; // speaker button radius
const ICON_X = STAGE_W - 14 - ICON_R; // button center
const ICON_Y = 14 + ICON_R;
const FADER_W = 38;
const FADER_H = 148;
const TRACK_LEN = 104;
const TRACK_W = 8;
const TRACK_TOP = 10; // fader-local y of the track top
const HIDE_AFTER_MS = 2600;
const FADER_CLOSE_MS = 700;

export class VolumeOverlayScene extends Phaser.Scene {
  private iconBtn!: Phaser.GameObjects.Container;
  private icon!: Phaser.GameObjects.Text;
  private iconZone!: Phaser.GameObjects.Zone;
  private fader!: Phaser.GameObjects.Container;
  private faderZone!: Phaser.GameObjects.Zone;
  private fill!: Phaser.GameObjects.Graphics;
  private pct!: Phaser.GameObjects.Text;
  private fx = 0; // fader world x/y (top-left)
  private fy = 0;
  private hideTimer: Phaser.Time.TimerEvent | null = null;
  private faderTimer: Phaser.Time.TimerEvent | null = null;
  private dragging = false;
  private faderOpen = false;

  constructor() {
    super('Volume');
  }

  create(): void {
    this.scene.bringToTop();

    // ── speaker button (upper-right) ──
    this.iconBtn = this.add.container(ICON_X, ICON_Y).setAlpha(0).setVisible(false);
    const bg = this.add.graphics();
    bg.fillStyle(0x14101a, 0.92).fillCircle(0, 0, ICON_R);
    bg.lineStyle(2, 0x7a6a86, 1).strokeCircle(0, 0, ICON_R);
    this.iconBtn.add(bg);
    this.icon = this.add.text(0, 1, '', { fontSize: '17px' }).setOrigin(0.5);
    this.iconBtn.add(this.icon);
    this.iconZone = this.add
      .zone(ICON_X - ICON_R, ICON_Y - ICON_R, ICON_R * 2, ICON_R * 2)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.iconZone.on(
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
    this.iconZone.on('pointerover', () => this.showFader());

    // ── vertical fader flyout (beneath the button, shown on rollover) ──
    this.fx = ICON_X - FADER_W / 2;
    this.fy = ICON_Y + ICON_R + 6;
    this.fader = this.add.container(this.fx, this.fy).setAlpha(0).setVisible(false);
    const fbg = this.add.graphics();
    fbg.fillStyle(0x14101a, 0.92).fillRoundedRect(0, 0, FADER_W, FADER_H, 10);
    fbg.lineStyle(2, 0x7a6a86, 1).strokeRoundedRect(0, 0, FADER_W, FADER_H, 10);
    this.fader.add(fbg);
    const track = this.add.graphics();
    track.fillStyle(0x0c0910, 1).fillRect((FADER_W - TRACK_W) / 2, TRACK_TOP, TRACK_W, TRACK_LEN);
    track.lineStyle(1, 0x7a6a86, 1).strokeRect((FADER_W - TRACK_W) / 2, TRACK_TOP, TRACK_W, TRACK_LEN);
    this.fader.add(track);
    this.fill = this.add.graphics();
    this.fader.add(this.fill);
    this.pct = this.add
      .text(FADER_W / 2, FADER_H - 16, '', {
        fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold', color: '#58e6d9',
        stroke: '#000', strokeThickness: 2,
      })
      .setOrigin(0.5);
    this.fader.add(this.pct);
    this.faderZone = this.add
      .zone(this.fx, this.fy, FADER_W, FADER_H)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.faderZone.on(
      'pointerdown',
      (p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        this.dragging = true;
        this.setFromPointer(p);
      },
    );

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragging && p.isDown) this.setFromPointer(p);
      this.poke(); // any mouse motion over the game reveals the speaker
      // keep the flyout while the pointer stays over button/fader; else close
      if (this.faderOpen && !this.dragging) {
        const inside =
          p.x >= this.fx - 10 && p.x <= this.fx + FADER_W + 10 &&
          p.y >= ICON_Y - ICON_R - 8 && p.y <= this.fy + FADER_H + 10;
        if (!inside) this.scheduleFaderClose();
        else this.faderTimer?.remove();
      }
    });
    this.input.on('pointerup', () => {
      if (this.dragging) {
        this.dragging = false;
        play(this, 's-blip', 0.5); // level check at the new volume
        this.scheduleFaderClose();
      }
    });

    this.redraw();
    this.setHitAreas(false); // hidden until the mouse moves
  }

  /** vertical track: top = 100%, bottom = 0% */
  private setFromPointer(p: Phaser.Input.Pointer): void {
    const frac = 1 - (p.y - (this.fy + TRACK_TOP)) / TRACK_LEN;
    const v = Math.round(Math.max(0, Math.min(1, frac)) * 20) / 20;
    updateSettings({ masterVolume: v, muted: false }); // touching the fader unmutes
    applyMusicVolume();
    this.redraw();
  }

  private showFader(): void {
    this.faderOpen = true;
    this.faderTimer?.remove();
    this.redraw();
    this.fader.setVisible(true);
    if (this.faderZone.input) this.faderZone.input.enabled = true;
    this.tweens.add({ targets: this.fader, alpha: 1, duration: 130 });
  }

  private scheduleFaderClose(): void {
    this.faderTimer?.remove();
    this.faderTimer = this.time.delayedCall(FADER_CLOSE_MS, () => {
      this.faderOpen = false;
      this.tweens.add({
        targets: this.fader,
        alpha: 0,
        duration: 250,
        onComplete: () => {
          this.fader.setVisible(false);
          if (this.faderZone.input) this.faderZone.input.enabled = false;
        },
      });
    });
  }

  /** Reveal the speaker and (re)arm its auto-hide. */
  private poke(): void {
    this.redraw(); // settings may have changed elsewhere (settings page, reset)
    this.iconBtn.setVisible(true);
    this.setHitAreas(true);
    this.tweens.add({ targets: this.iconBtn, alpha: 1, duration: 150 });
    this.hideTimer?.remove();
    this.hideTimer = this.time.delayedCall(HIDE_AFTER_MS, () => {
      if (this.dragging || this.faderOpen || getSettings().muted) return this.poke(); // stay up
      this.tweens.add({
        targets: this.iconBtn,
        alpha: 0,
        duration: 400,
        onComplete: () => {
          this.iconBtn.setVisible(false);
          this.setHitAreas(false); // a hidden button must not eat corner clicks
        },
      });
    });
  }

  private setHitAreas(on: boolean): void {
    if (this.iconZone.input) this.iconZone.input.enabled = on;
    if (this.faderZone.input) this.faderZone.input.enabled = on && this.faderOpen;
  }

  private redraw(): void {
    const s = getSettings();
    this.icon.setText(s.muted ? '🔇' : '🔊');
    this.pct.setText(s.muted ? 'MUTE' : `${Math.round(s.masterVolume * 100)}%`);
    this.pct.setColor(s.muted ? '#ff5a48' : '#58e6d9');
    this.fill.clear();
    const h = TRACK_LEN * (s.muted ? 0 : s.masterVolume);
    this.fill
      .fillStyle(s.muted ? 0x7a6a86 : 0x58e6d9, 1)
      .fillRect((FADER_W - TRACK_W) / 2, TRACK_TOP + TRACK_LEN - h, TRACK_W, h);
  }
}
