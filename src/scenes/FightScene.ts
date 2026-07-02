// Renders engine state. Uses generated sprite sheets + stage art when the
// assets exist, and falls back to placeholder capsules for characters whose
// sheets haven't been generated yet. The scene owns NO game logic.
import Phaser from 'phaser';
import {
  FLOOR_Y,
  GameState,
  INTRO_TICKS,
  STAGE_W,
  STAGE_H,
  TICK_MS,
  FighterState,
  initialState,
  step,
  worldBox,
} from '../engine';
import { characters } from '../data/characters';
import { KeyboardSource } from '../input/keyboard';

const P1_CHAR = 'vincent';
const P2_CHAR = 'yulia';

// Cell layout is a contract with tools/frames-manifest.mjs — never reorder.
const CELL_W = 288;
const CELL_H = 384;
const CELL = {
  idleA: 0, idleB: 1, walkA: 2, walkB: 3, crouch: 4, jump: 5,
  block: 6, blockCrouch: 7, hit: 8, fall: 9, down: 10,
} as const;
const MOVE_BASE: Record<string, number> = { light: 11, heavy: 14, sweep: 17, special: 20 };

interface Spark {
  x: number;
  y: number;
  life: number;
  color: number;
}

export class FightScene extends Phaser.Scene {
  private state!: GameState;
  private inputs!: KeyboardSource;
  private gfxUnder!: Phaser.GameObjects.Graphics; // shadows, capsule fallback
  private gfxHud!: Phaser.GameObjects.Graphics; // bars, sparks, debug boxes
  private fighterSprites: (Phaser.GameObjects.Sprite | null)[] = [null, null];
  private projSprites: Phaser.GameObjects.Image[] = [];
  private msgText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private hasBg = false;
  private accumulator = 0;
  private debugBoxes = false;
  private sparks: Spark[] = [];
  private prevHealth: [number, number] = [0, 0];

  constructor() {
    super('Fight');
  }

  preload(): void {
    this.load.image('bg-salton', 'assets/backgrounds/salton-shoreline.jpg');
    for (const id of [P1_CHAR, P2_CHAR]) {
      this.load.spritesheet(`sheet-${id}`, `assets/sprites/${id}/sheet.png`, {
        frameWidth: CELL_W,
        frameHeight: CELL_H,
      });
      this.load.image(`proj-${id}`, `assets/sprites/${id}/projectile.png`);
    }
  }

  create(): void {
    this.state = initialState(P1_CHAR, P2_CHAR, characters);
    this.prevHealth = [this.state.fighters[0].health, this.state.fighters[1].health];
    this.inputs = new KeyboardSource(this);

    this.hasBg = this.textures.exists('bg-salton');
    if (this.hasBg) {
      this.add.image(STAGE_W / 2, STAGE_H / 2, 'bg-salton').setDisplaySize(STAGE_W, STAGE_H).setDepth(0);
    }
    this.gfxUnder = this.add.graphics().setDepth(1);
    this.gfxHud = this.add.graphics().setDepth(5);

    for (const slot of [0, 1] as const) {
      const id = this.state.fighters[slot].charId;
      if (this.textures.exists(`sheet-${id}`)) {
        this.fighterSprites[slot] = this.add.sprite(0, 0, `sheet-${id}`, 0).setOrigin(0.5, 0.95).setDepth(2);
      }
    }

    const font = { fontFamily: 'monospace', color: '#f5ead9' };
    this.msgText = this.add
      .text(STAGE_W / 2, 200, '', { ...font, fontSize: '52px', fontStyle: 'bold', stroke: '#000', strokeThickness: 8 })
      .setOrigin(0.5)
      .setAlign('center')
      .setDepth(6);
    this.timerText = this.add
      .text(STAGE_W / 2, 38, '99', { ...font, fontSize: '36px', fontStyle: 'bold', stroke: '#000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(6);
    this.add.text(40, 58, characters[P1_CHAR].name, { ...font, fontSize: '14px', stroke: '#000', strokeThickness: 3 }).setDepth(6);
    this.add
      .text(STAGE_W - 40, 58, characters[P2_CHAR].name, { ...font, fontSize: '14px', stroke: '#000', strokeThickness: 3 })
      .setOrigin(1, 0)
      .setDepth(6);
    this.add
      .text(STAGE_W / 2, STAGE_H - 14, 'P1: WASD+F/G/H   P2: ARROWS+K/L/;   S+G sweep   F1 hitboxes   R rematch', {
        ...font, fontSize: '12px', color: '#e8dcc8', stroke: '#000', strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(6);

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
        this.sparks.push({ x: f.x + f.facing * -20, y: f.y - 150, life: 12, color: 0xfff06e });
        this.cameras.main.shake(60, 0.004);
      }
      this.prevHealth[slot] = f.health;
    }
  }

  /** engine action -> sheet cell (contract with tools/frames-manifest.mjs) */
  private actionToCell(f: FighterState): number {
    const a = f.action;
    const t = this.state.tick;
    switch (a.kind) {
      case 'idle': return (t >> 4) % 2 ? CELL.idleB : CELL.idleA;
      case 'walkF':
      case 'walkB': return (t >> 3) % 2 ? CELL.walkB : CELL.walkA;
      case 'crouch':
      case 'prejump':
      case 'getup': return CELL.crouch;
      case 'air': return CELL.jump;
      case 'attack': {
        const m = characters[f.charId].moves[a.moveId!];
        const phase = a.frame < m.startup ? 0 : a.frame < m.startup + m.active ? 1 : 2;
        return MOVE_BASE[a.moveId!] + phase;
      }
      case 'hitstun': return CELL.hit;
      case 'blockstun': return a.guard === 'crouch' ? CELL.blockCrouch : CELL.block;
      case 'airHit': return CELL.fall;
      case 'knockdown': return CELL.down;
      case 'ko': return f.y >= FLOOR_Y ? CELL.down : CELL.fall;
      default: return CELL.idleA;
    }
  }

  private draw(): void {
    const s = this.state;
    const gU = this.gfxUnder;
    const gH = this.gfxHud;
    gU.clear();
    gH.clear();

    if (!this.hasBg) {
      gU.fillStyle(0x241b2e, 1).fillRect(0, 0, STAGE_W, STAGE_H);
      gU.fillStyle(0x3a2b40, 1).fillRect(0, FLOOR_Y, STAGE_W, STAGE_H - FLOOR_Y);
      gU.lineStyle(2, 0x594566, 1).lineBetween(0, FLOOR_Y, STAGE_W, FLOOR_Y);
    }

    for (const slot of [0, 1] as const) {
      const f = s.fighters[slot];
      const def = characters[f.charId];
      gU.fillStyle(0x000000, 0.35).fillEllipse(f.x, FLOOR_Y + 8, def.bodyBox.w * 1.6, 18);

      const sprite = this.fighterSprites[slot];
      if (sprite) {
        const h = def.hurtStand.h * 1.32; // art has margin around the body
        sprite.setDisplaySize((h * CELL_W) / CELL_H, h);
        sprite.setPosition(f.x, f.y + 6);
        sprite.setFlipX(f.facing === -1);
        sprite.setFrame(this.actionToCell(f));
        const k = f.action.kind;
        if (k === 'hitstun' || (k === 'airHit' && f.action.frame < 6)) sprite.setTintFill(0xffffff);
        else if (k === 'blockstun') sprite.setTint(0xaaaaff);
        else if (k === 'ko' || k === 'knockdown') sprite.setTint(0x9a9a9a);
        else sprite.clearTint();
      } else {
        this.drawCapsule(slot);
      }
    }

    // projectiles
    while (this.projSprites.length < s.projectiles.length) {
      this.projSprites.push(this.add.image(0, 0, '__DEFAULT').setDepth(2));
    }
    this.projSprites.forEach((img, i) => {
      const p = s.projectiles[i];
      if (!p) {
        img.setVisible(false);
        return;
      }
      const key = `proj-${s.fighters[p.owner].charId}`;
      if (this.textures.exists(key)) {
        if (img.texture.key !== key) img.setTexture(key);
        img.setVisible(true).setPosition(p.x, p.y).setDisplaySize(72, 72);
        img.setRotation(s.tick * 0.15 * (p.vx > 0 ? 1 : -1));
      } else {
        img.setVisible(false);
        gU.fillStyle(0xb28aff, 1).fillCircle(p.x, p.y, 16);
        gU.fillStyle(0xffffff, 0.8).fillCircle(p.x, p.y, 7);
      }
    });

    // sparks
    this.sparks = this.sparks.filter((sp) => --sp.life > 0);
    for (const sp of this.sparks) {
      gH.fillStyle(sp.color, sp.life / 12).fillCircle(sp.x, sp.y, 26 - sp.life);
    }

    if (this.debugBoxes) this.drawDebug();
    this.drawHud();
  }

  private drawCapsule(slot: 0 | 1): void {
    const g = this.gfxUnder;
    const f = this.state.fighters[slot];
    const def = characters[f.charId];
    const body = worldBox(f, def.bodyBox);
    const base = Phaser.Display.Color.HexStringToColor(def.color).color;
    const k = f.action.kind;

    let color = base;
    if (k === 'hitstun' || k === 'airHit') color = 0xffffff;
    else if (k === 'blockstun') color = 0x8888ff;
    else if (k === 'ko' || k === 'knockdown') color = 0x555555;

    const lying = k === 'knockdown' || k === 'getup' || (k === 'ko' && f.y >= FLOOR_Y);
    if (lying) {
      g.fillStyle(color, 1).fillRoundedRect(f.x - 80, FLOOR_Y - 44, 160, 44, 14);
      return;
    }
    const h = k === 'crouch' || f.action.guard === 'crouch' ? def.hurtCrouch.h : body.b - body.t;
    g.fillStyle(color, 1).fillRoundedRect(body.l, f.y - h, body.r - body.l, h, 12);
    g.fillCircle(f.x + f.facing * 6, f.y - h - 20, 24);
    const a = f.action;
    if (a.kind === 'attack') {
      const m = def.moves[a.moveId!];
      if (m.hitbox && a.frame >= m.startup && a.frame < m.startup + m.active) {
        const hb = worldBox(f, m.hitbox);
        g.fillStyle(0xffe08a, 1).fillRoundedRect(hb.l, hb.t, hb.r - hb.l, hb.b - hb.t, 6);
      }
    }
  }

  private drawDebug(): void {
    const g = this.gfxHud;
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
    const g = this.gfxHud;
    const s = this.state;
    const barW = 380;
    for (const slot of [0, 1] as const) {
      const f = s.fighters[slot];
      const def = characters[f.charId];
      const ratio = Math.max(0, f.health / def.health);
      const x = slot === 0 ? 40 : STAGE_W - 40 - barW;
      g.fillStyle(0x14101a, 0.9).fillRect(x - 2, 26, barW + 4, 22);
      const fillW = barW * ratio;
      const color = ratio > 0.5 ? 0x7ee06e : ratio > 0.25 ? 0xffd24a : 0xff5a48;
      g.fillStyle(color, 1).fillRect(slot === 0 ? x + barW - fillW : x, 28, fillW, 18);
      for (let w = 0; w < 2; w++) {
        const px = slot === 0 ? x + barW - 14 - w * 20 : x + 14 + w * 20;
        if (s.wins[slot] > w) g.fillStyle(0xffd24a, 1).fillCircle(px, 62, 6);
        else g.lineStyle(1, 0xd8cbb8, 1).strokeCircle(px, 62, 6);
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
