// SF2-style pre-fight VS screen: the two portraits face off on black with a
// big VS burst while a random versus clip plays once (menu music fades out on
// entry) — the fight starts when the clip ends. Any key or click skips
// straight in; with no versus tracks (or blocked audio) a timer advances.
import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { characters } from '../data/characters';
import { ROSTER } from '../data/roster';
import { stageById } from '../data/stages';
import { hasTracks, playMusic } from '../audio/music';
import { menuNav, navDefer } from '../input/menu-nav';

const HOLD_MS = 3400; // hold when there's no versus clip to pace the screen
const MAX_HOLD_MS = 20000; // safety net if audio is blocked and never ends
const PORTRAIT = 270;

interface VersusData {
  p1?: string;
  p2?: string;
  cpu?: boolean;
  training?: boolean;
  showcase?: boolean;
  /** dev-only move tuner (see FightScene) */
  tuner?: boolean;
  /** dev-only sprite editor (see FightScene) */
  spriteEditor?: boolean;
  /** dev-only Character Studio: module rail over the fight (see FightScene) */
  studio?: boolean;
  /** studio deep link: which module opens active */
  module?: string;
  stage?: string;
  render3d?: boolean;
}

export class VersusScene extends Phaser.Scene {
  private fight: Required<Omit<VersusData, 'module'>> & { module?: string } = {
    p1: 'vincent', p2: 'yulia', cpu: false, training: false, showcase: false,
    tuner: false, spriteEditor: false, studio: false, stage: 'salton', render3d: false,
  };
  private started = false;

  constructor() {
    super('Versus');
  }

  init(data: VersusData): void {
    // NOTE: this scene sits between Select and Fight — every fight flag must
    // pass through here or it silently vanishes (the studio flag did once).
    this.fight = {
      p1: data.p1 ?? 'vincent',
      p2: data.p2 ?? 'yulia',
      cpu: !!data.cpu,
      training: !!data.training,
      showcase: !!data.showcase,
      tuner: !!data.tuner,
      spriteEditor: !!data.spriteEditor,
      studio: !!data.studio,
      module: data.module,
      stage: data.stage ?? 'salton',
      render3d: !!data.render3d,
    };
    this.started = false;
  }

  create(): void {
    // 3D: start streaming the fight renderer (models/stage/pipelines) NOW so it
    // overlaps this VS screen instead of a black screen after it
    if (this.fight.render3d) {
      void import('../renderer3d/warmup').then((m) =>
        m.warmupRenderer([this.fight.p1, this.fight.p2], this.fight.stage),
      );
    }
    // a random versus clip paces the screen: fight starts when it ends
    if (hasTracks('versus')) {
      playMusic('versus', { once: true, onEnd: () => this.startFight() });
      this.time.delayedCall(MAX_HOLD_MS, () => this.startFight());
    } else {
      playMusic('versus'); // fades the menu theme out to silence
      this.time.delayedCall(HOLD_MS, () => this.startFight());
    }

    this.add.rectangle(STAGE_W / 2, STAGE_H / 2, STAGE_W, STAGE_H, 0x000000, 1);
    this.portrait(0, this.fight.p1);
    this.portrait(1, this.fight.p2);

    // red burst behind the VS, then the VS itself pops in
    const burst = this.add.graphics().setDepth(2);
    const bx = STAGE_W / 2;
    const by = STAGE_H * 0.78;
    burst.fillStyle(0xc41e10, 1);
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i < 24; i++) {
      const r = i % 2 === 0 ? 150 : 88;
      const a = (i / 24) * Math.PI * 2;
      pts.push({ x: bx + Math.cos(a) * r * 1.35, y: by + Math.sin(a) * r * 0.55 });
    }
    burst.fillPoints(pts, true);
    const vs = this.add
      .text(bx, by, 'VS', {
        fontFamily: 'monospace', fontSize: '110px', fontStyle: 'bold', color: '#ffd24a',
        stroke: '#7a1408', strokeThickness: 14,
      })
      .setOrigin(0.5)
      .setDepth(3)
      .setScale(2.5)
      .setAlpha(0);
    this.tweens.add({ targets: vs, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut', delay: 350 });

    const stage = stageById(this.fight.stage);
    if (stage) {
      this.add
        .text(STAGE_W / 2, STAGE_H - 16, stage.name, {
          fontFamily: 'monospace', fontSize: '14px', color: '#9a8fa8', stroke: '#000', strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(3);
    }

    this.input.keyboard!.once('keydown', () => this.startFight());
    this.input.once('pointerdown', () => this.startFight());
  }

  update(): void {
    // pad presses fire no DOM events — poll so the controller can skip the splash
    const n = menuNav.poll();
    if (n.confirm || n.start || n.menu) navDefer(this, () => this.startFight());
  }

  /** Portrait in a framed box sliding in from its side, name plate below. */
  private portrait(slot: 0 | 1, charId: string): void {
    const x = slot === 0 ? STAGE_W * 0.24 : STAGE_W * 0.76;
    const y = STAGE_H * 0.36;
    const from = slot === 0 ? -PORTRAIT : STAGE_W + PORTRAIT;
    const color = Phaser.Display.Color.HexStringToColor(characters[charId]?.color ?? '#ffb347').color;

    const box = this.add.container(from, y).setDepth(1);
    box.add(this.add.rectangle(0, 0, PORTRAIT + 12, PORTRAIT + 12, 0x14101a, 1).setStrokeStyle(4, color));
    if (this.textures.exists(`portrait-${charId}`)) {
      const img = this.add.image(0, 0, `portrait-${charId}`).setDisplaySize(PORTRAIT, PORTRAIT);
      if (slot === 1) img.setFlipX(true); // right fighter faces left, SF2-style
      box.add(img);
    }
    this.tweens.add({ targets: box, x, duration: 320, ease: 'Cubic.easeOut', delay: slot * 120 });

    const name = ROSTER.find((r) => r.id === charId)?.name ?? charId.toUpperCase();
    this.add
      .text(x, y + PORTRAIT / 2 + 42, name, {
        fontFamily: 'monospace', fontSize: '40px', fontStyle: 'bold', color: '#ffb347',
        stroke: '#2a3a7a', strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setDepth(1);
  }

  private startFight(): void {
    if (this.started) return;
    this.started = true;
    const { p1, p2, cpu, training, showcase, tuner, spriteEditor, studio, module, stage, render3d } = this.fight;
    this.scene.start(render3d ? 'Fight3D' : 'Fight', { p1, p2, cpu, training, showcase, tuner, spriteEditor, studio, module, stage });
  }
}
