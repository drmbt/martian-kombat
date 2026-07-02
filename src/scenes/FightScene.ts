// Renders engine state with placeholder capsules + debug boxes (F1).
// The scene owns NO game logic: it polls inputs, steps the engine at a fixed
// 60hz, and draws whatever the state says. Sprites replace capsules in Sprint 2.
import Phaser from 'phaser';
import {
  FLOOR_Y,
  GameState,
  INTRO_TICKS,
  STAGE_W,
  STAGE_H,
  TICK_MS,
  initialState,
  step,
  worldBox,
} from '../engine';
import { characters } from '../data/characters';
import { KeyboardSource } from '../input/keyboard';

const P1_CHAR = 'vincent';
const P2_CHAR = 'yulia';

interface Spark {
  x: number;
  y: number;
  life: number;
  color: number;
}

export class FightScene extends Phaser.Scene {
  private state!: GameState;
  private inputs!: KeyboardSource;
  private gfx!: Phaser.GameObjects.Graphics;
  private msgText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private nameTexts: Phaser.GameObjects.Text[] = [];
  private hintText!: Phaser.GameObjects.Text;
  private accumulator = 0;
  private debugBoxes = false;
  private sparks: Spark[] = [];
  private prevHealth: [number, number] = [0, 0];

  constructor() {
    super('Fight');
  }

  create(): void {
    this.state = initialState(P1_CHAR, P2_CHAR, characters);
    this.prevHealth = [this.state.fighters[0].health, this.state.fighters[1].health];
    this.inputs = new KeyboardSource(this);
    this.gfx = this.add.graphics();

    const font = { fontFamily: 'monospace', color: '#f5ead9' };
    this.msgText = this.add
      .text(STAGE_W / 2, 200, '', { ...font, fontSize: '52px', fontStyle: 'bold', stroke: '#000', strokeThickness: 8 })
      .setOrigin(0.5);
    this.timerText = this.add
      .text(STAGE_W / 2, 38, '99', { ...font, fontSize: '36px', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.nameTexts = [
      this.add.text(40, 58, characters[P1_CHAR].name, { ...font, fontSize: '14px' }),
      this.add.text(STAGE_W - 40, 58, characters[P2_CHAR].name, { ...font, fontSize: '14px' }).setOrigin(1, 0),
    ];
    this.hintText = this.add
      .text(STAGE_W / 2, STAGE_H - 16, 'P1: WASD+F/G/H   P2: ARROWS+K/L/;   S+G sweep   F1 hitboxes   R rematch', {
        ...font, fontSize: '12px', color: '#7a7286',
      })
      .setOrigin(0.5);

    this.input.keyboard!.on('keydown-F1', () => (this.debugBoxes = !this.debugBoxes));
    this.input.keyboard!.on('keydown-R', () => {
      if (this.state.phase === 'matchEnd') {
        this.state = initialState(P1_CHAR, P2_CHAR, characters);
        this.prevHealth = [this.state.fighters[0].health, this.state.fighters[1].health];
        this.sparks = [];
      }
    });
  }

  update(_time: number, deltaMs: number): void {
    // fixed timestep: rendering fps may vary, simulation never does
    this.accumulator += Math.min(deltaMs, 100);
    while (this.accumulator >= TICK_MS) {
      step(this.state, [this.inputs.poll(0), this.inputs.poll(1)], characters);
      this.accumulator -= TICK_MS;
      this.detectHits();
    }
    this.draw();
  }

  private detectHits(): void {
    for (const slot of [0, 1] as const) {
      const f = this.state.fighters[slot];
      if (f.health < this.prevHealth[slot]) {
        this.sparks.push({ x: f.x, y: f.y - 80, life: 12, color: 0xfff06e });
        this.cameras.main.shake(60, 0.004);
      }
      this.prevHealth[slot] = f.health;
    }
  }

  private draw(): void {
    const g = this.gfx;
    const s = this.state;
    g.clear();

    // stage
    g.fillStyle(0x241b2e, 1);
    g.fillRect(0, 0, STAGE_W, STAGE_H);
    g.fillStyle(0x3a2b40, 1);
    g.fillRect(0, FLOOR_Y, STAGE_W, STAGE_H - FLOOR_Y);
    g.lineStyle(2, 0x594566, 1);
    g.lineBetween(0, FLOOR_Y, STAGE_W, FLOOR_Y);

    // fighters
    for (const slot of [0, 1] as const) {
      const f = s.fighters[slot];
      const def = characters[f.charId];
      const body = worldBox(f, def.bodyBox);
      const base = Phaser.Display.Color.HexStringToColor(def.color).color;
      const k = f.action.kind;

      let color = base;
      if (k === 'hitstun' || k === 'airHit') color = 0xffffff;
      else if (k === 'blockstun') color = 0x8888ff;
      else if (k === 'ko' || k === 'knockdown') color = 0x555555;

      // shadow
      g.fillStyle(0x000000, 0.35);
      g.fillEllipse(f.x, FLOOR_Y + 6, 70, 14);

      const lying = k === 'knockdown' || k === 'getup' || (k === 'ko' && f.y >= FLOOR_Y);
      if (lying) {
        g.fillStyle(color, 1);
        g.fillRoundedRect(f.x - 45, FLOOR_Y - 26, 90, 26, 10);
      } else {
        const h = k === 'crouch' || f.action.guard === 'crouch' ? def.hurtCrouch.h : body.b - body.t;
        g.fillStyle(color, 1);
        g.fillRoundedRect(body.l, f.y - h, body.r - body.l, h, 8);
        // head
        g.fillCircle(f.x + f.facing * 4, f.y - h - 12, 14);
        // attack limb flash during active frames
        const a = f.action;
        if (a.kind === 'attack') {
          const m = def.moves[a.moveId!];
          if (m.hitbox && a.frame >= m.startup && a.frame < m.startup + m.active) {
            const hb = worldBox(f, m.hitbox);
            g.fillStyle(0xffe08a, 1);
            g.fillRoundedRect(hb.l, hb.t, hb.r - hb.l, hb.b - hb.t, 4);
          }
        }
      }
    }

    // projectiles
    for (const p of s.projectiles) {
      g.fillStyle(0xb28aff, 1);
      g.fillCircle(p.x, p.y, 14);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(p.x, p.y, 6);
    }

    // sparks
    this.sparks = this.sparks.filter((sp) => --sp.life > 0);
    for (const sp of this.sparks) {
      g.fillStyle(sp.color, sp.life / 12);
      g.fillCircle(sp.x, sp.y, 22 - sp.life);
    }

    if (this.debugBoxes) this.drawDebug();
    this.drawHud();
  }

  private drawDebug(): void {
    const g = this.gfx;
    for (const slot of [0, 1] as const) {
      const f = this.state.fighters[slot];
      const def = characters[f.charId];
      const hurt = f.action.kind === 'crouch' ? def.hurtCrouch : def.hurtStand;
      const hr = worldBox(f, hurt);
      g.lineStyle(1, 0x44ff88, 1).strokeRect(hr.l, hr.t, hr.r - hr.l, hr.b - hr.t);
      const br = worldBox(f, def.bodyBox);
      g.lineStyle(1, 0x4488ff, 1).strokeRect(br.l, br.t, br.r - br.l, br.b - br.t);
      const a = f.action;
      if (a.kind === 'attack') {
        const m = def.moves[a.moveId!];
        if (m.hitbox) {
          const phase = a.frame < m.startup ? 0xffff44 : a.frame < m.startup + m.active ? 0xff4444 : 0x999999;
          const hb = worldBox(f, m.hitbox);
          g.lineStyle(2, phase, 1).strokeRect(hb.l, hb.t, hb.r - hb.l, hb.b - hb.t);
        }
      }
    }
    for (const p of this.state.projectiles) {
      g.lineStyle(2, 0xff4444, 1).strokeRect(p.x + p.box.x, p.y + p.box.y, p.box.w, p.box.h);
    }
  }

  private drawHud(): void {
    const g = this.gfx;
    const s = this.state;
    const barW = 380;
    for (const slot of [0, 1] as const) {
      const f = s.fighters[slot];
      const def = characters[f.charId];
      const ratio = Math.max(0, f.health / def.health);
      const x = slot === 0 ? 40 : STAGE_W - 40 - barW;
      g.fillStyle(0x14101a, 1).fillRect(x - 2, 26, barW + 4, 22);
      const fillW = barW * ratio;
      const color = ratio > 0.5 ? 0x7ee06e : ratio > 0.25 ? 0xffd24a : 0xff5a48;
      g.fillStyle(color, 1).fillRect(slot === 0 ? x + barW - fillW : x, 28, fillW, 18);
      // round pips
      for (let w = 0; w < 2; w++) {
        const px = slot === 0 ? x + barW - 14 - w * 20 : x + 14 + w * 20;
        if (s.wins[slot] > w) g.fillStyle(0xffd24a, 1).fillCircle(px, 62, 6);
        else g.lineStyle(1, 0x7a7286, 1).strokeCircle(px, 62, 6);
      }
    }

    this.timerText.setText(String(Math.max(0, Math.ceil(s.timer / 60))));
    this.msgText.setText(this.message());
  }

  private message(): string {
    const s = this.state;
    switch (s.phase) {
      case 'intro':
        return s.phaseFrame < INTRO_TICKS * 0.6 ? `ROUND ${s.roundNumber}` : 'FIGHT!';
      case 'roundEnd':
        if (s.roundWinner === null) return s.timer <= 0 ? 'TIME UP' : 'DOUBLE K.O.';
        return s.timer <= 0 ? 'TIME UP' : 'K.O.';
      case 'matchEnd': {
        const name = characters[s.fighters[s.roundWinner ?? 0].charId].name;
        return `${name} WINS\nPRESS R`;
      }
      default:
        return '';
    }
  }
}
