// Renders engine state and plays presentation (sprites, HUD, audio). All
// audio/vfx are derived by diffing engine state before/after each tick —
// the deterministic core in src/engine/ stays pure and silent.
import Phaser from 'phaser';
import {
  FATALITY_TICKS,
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
import { CpuDriver } from '../ai/bot';
import { play } from './BootScene';

// Cells are looked up BY NAME from each sheet's meta.json (written by
// tools/pack-sheet.mjs), so v2 six-button sheets and legacy 23-cell sheets
// coexist. Legacy sheets fall back: new buttons borrow the nearest old art.
const CELL_W = 288;
const CELL_H = 384;
const PHASE_NAME = ['startup', 'active', 'recovery'] as const;
const LEGACY_BUTTON: Record<string, string> = {
  lp: 'light', mp: 'light', hp: 'heavy', lk: 'light', mk: 'heavy', hk: 'heavy',
};

const BAR_W = 320;
const BAR_X1 = 100;

interface Spark {
  x: number;
  y: number;
  life: number;
  color: number;
}

interface TickSnapshot {
  phase: GameState['phase'];
  kinds: [string, string];
  healths: [number, number];
  projectiles: number;
}

export class FightScene extends Phaser.Scene {
  private chars: [string, string] = ['vincent', 'yulia'];
  private state!: GameState;
  private inputs!: KeyboardSource;
  private gfxUnder!: Phaser.GameObjects.Graphics;
  private gfxHud!: Phaser.GameObjects.Graphics;
  private fighterSprites: (Phaser.GameObjects.Sprite | null)[] = [null, null];
  private projSprites: Phaser.GameObjects.Image[] = [];
  private msgText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private hasBg = false;
  private accumulator = 0;
  private debugBoxes = false;
  private sparks: Spark[] = [];
  private comboHits = 0;
  private comboTicks = 0;
  private cellMaps: [Map<string, number>, Map<string, number>] = [new Map(), new Map()];
  private paused = false;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private cpu = false;
  private bot: CpuDriver | null = null;
  private fatalityPanel: Phaser.GameObjects.Image | null = null;

  constructor() {
    super('Fight');
  }

  init(data: { p1?: string; p2?: string; cpu?: boolean }): void {
    this.chars = [data.p1 ?? 'vincent', data.p2 ?? 'yulia'];
    this.cpu = !!data.cpu;
    this.bot = this.cpu ? new CpuDriver(1) : null;
    this.fatalityPanel = null;
  }

  create(): void {
    this.state = initialState(this.chars[0], this.chars[1], characters);
    this.inputs = new KeyboardSource(this);
    this.fighterSprites = [null, null];
    this.projSprites = [];
    this.sparks = [];
    this.accumulator = 0;
    this.comboHits = 0;
    this.comboTicks = 0;

    this.hasBg = this.textures.exists('bg-salton');
    if (this.hasBg) {
      this.add.image(STAGE_W / 2, STAGE_H / 2, 'bg-salton').setDisplaySize(STAGE_W, STAGE_H).setDepth(0);
    }
    this.gfxUnder = this.add.graphics().setDepth(1);
    this.gfxHud = this.add.graphics().setDepth(5);

    for (const slot of [0, 1] as const) {
      const id = this.chars[slot];
      const meta = this.cache.json.get(`meta-${id}`) as { frames?: string[] } | undefined;
      this.cellMaps[slot] = new Map((meta?.frames ?? []).map((n, i) => [n, i]));
      if (this.textures.exists(`sheet-${id}`)) {
        this.fighterSprites[slot] = this.add.sprite(0, 0, `sheet-${id}`, 0).setOrigin(0.5, 0.95).setDepth(2);
      }
      // HUD portrait
      if (this.textures.exists(`portrait-${id}`)) {
        const px = slot === 0 ? 68 : STAGE_W - 68;
        this.add.image(px, 46, `portrait-${id}`).setDisplaySize(48, 48).setDepth(6).setFlipX(slot === 1);
        this.gfxHud; // portraits framed in drawHud
      }
    }
    // mirror-match: tint P2 so the twins are tellable-apart
    if (this.chars[0] === this.chars[1]) this.fighterSprites[1]?.setTint(0xffb0a0);

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
    this.comboText = this.add
      .text(0, 130, '', { ...font, fontSize: '30px', fontStyle: 'bold', color: '#ffd24a', stroke: '#000', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(6);
    this.add
      .text(120, 58, characters[this.chars[0]].name, { ...font, fontSize: '14px', stroke: '#000', strokeThickness: 3 })
      .setDepth(6);
    this.add
      .text(STAGE_W - 120, 58, characters[this.chars[1]].name, { ...font, fontSize: '14px', stroke: '#000', strokeThickness: 3 })
      .setOrigin(1, 0)
      .setDepth(6);
    this.add
      .text(STAGE_W / 2, STAGE_H - 14, 'P1: WASD + RTY punches FGH kicks   P2: ARROWS + UIO punches JKL kicks   ESC move list', {
        ...font, fontSize: '12px', color: '#e8dcc8', stroke: '#000', strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(6);

    this.buildPauseOverlay();
    this.input.keyboard!.on('keydown-ESC', () => {
      this.paused = !this.paused;
      this.pauseOverlay.setVisible(this.paused);
    });
    this.input.keyboard!.on('keydown-F1', () => (this.debugBoxes = !this.debugBoxes));
    this.input.keyboard!.on('keydown-R', () => {
      if (this.state.phase === 'matchEnd') this.scene.restart({ p1: this.chars[0], p2: this.chars[1], cpu: this.cpu });
    });
    this.input.keyboard!.on('keydown-ENTER', () => {
      if (this.state.phase === 'matchEnd') this.scene.start('Select', { cpu: this.cpu });
    });

    play(this, 'ann-round-1');
  }

  update(_time: number, deltaMs: number): void {
    if (this.paused) {
      this.accumulator = 0;
      return;
    }
    // fixed timestep: rendering fps may vary, simulation never does
    this.accumulator += Math.min(deltaMs, 100);
    while (this.accumulator >= TICK_MS) {
      const snap = this.snapshot();
      const p2 = this.bot ? this.bot.poll(this.state) : this.inputs.poll(1);
      step(this.state, [this.inputs.poll(0), p2], characters);
      this.accumulator -= TICK_MS;
      this.presentTick(snap);
    }
    this.draw();
  }

  private snapshot(): TickSnapshot {
    const [a, b] = this.state.fighters;
    return {
      phase: this.state.phase,
      kinds: [a.action.kind, b.action.kind],
      healths: [a.health, b.health],
      projectiles: this.state.projectiles.length,
    };
  }

  /** Diff pre/post tick state into sounds, sparks, and combo bookkeeping. */
  private presentTick(prev: TickSnapshot): void {
    const s = this.state;

    // announcer cues
    if (s.phase === 'intro' && s.phaseFrame === 1 && s.tick > 1) {
      play(this, s.roundNumber === 2 ? 'ann-round-2' : 'ann-final-round');
    }
    if (s.phase === 'intro' && s.phaseFrame === Math.floor(INTRO_TICKS * 0.6)) {
      play(this, 'ann-fight', 1);
    }
    if (prev.phase === 'fight' && s.phase === 'roundEnd') {
      if (s.timer <= 0) play(this, 'ann-time-up');
      else if (s.roundWinner === null) play(this, 'ann-double-ko');
      else {
        play(this, 'ann-ko', 1);
        const w = s.fighters[s.roundWinner];
        if (w.health === characters[w.charId].health) {
          this.time.delayedCall(800, () => play(this, 'ann-perfect'));
        }
      }
    }
    if (
      (prev.phase === 'roundEnd' || prev.phase === 'fatality') &&
      s.phase === 'matchEnd' &&
      s.roundWinner !== null
    ) {
      play(this, `ann-${s.fighters[s.roundWinner].charId}`, 1);
      this.time.delayedCall(900, () => play(this, 'ann-victory', 1));
    }
    if (prev.phase === 'fight' && s.phase === 'finisher') {
      play(this, 'ann-finish-them', 1);
      this.cameras.main.shake(150, 0.006);
    }
    if (prev.phase === 'finisher' && s.phase === 'fatality') {
      play(this, 'ann-fatality', 1);
      this.cameras.main.flash(300, 255, 30, 30);
      this.cameras.main.shake(400, 0.01);
    }

    // per-fighter transitions
    for (const slot of [0, 1] as const) {
      const f = s.fighters[slot];
      const kind = f.action.kind;
      const was = prev.kinds[slot];
      const other = slot === 0 ? 1 : 0;

      if (f.health < prev.healths[slot]) {
        play(this, 's-hit');
        play(this, `v-${f.charId}-hurt`, 0.7);
        this.sparks.push({ x: f.x + f.facing * -20, y: f.y - 150, life: 12, color: 0xfff06e });
        this.cameras.main.shake(60, 0.004);
        // combo: consecutive hits while the defender never left stun
        this.comboHits = was === 'hitstun' || was === 'airHit' ? this.comboHits + 1 : 1;
        this.comboTicks = 90;
        if (this.comboHits >= 2) {
          this.comboText.setX(s.fighters[other].x).setText(`${this.comboHits} HITS`);
        }
      }
      if (kind === 'blockstun' && was !== 'blockstun') play(this, 's-block', 0.6);
      if ((kind === 'attack' || kind === 'airAttack') && was !== kind) {
        play(this, 's-whoosh', 0.4);
        if (characters[f.charId].moves[f.action.moveId!]?.input) play(this, `v-${f.charId}-kiai`, 0.8);
      }
      if (kind === 'air' && was === 'prejump') play(this, 's-jump', 0.35);
    }

    if (s.projectiles.length > prev.projectiles) play(this, 's-projectile', 0.6);

    if (this.comboTicks > 0 && --this.comboTicks === 0) this.comboHits = 0;
  }

  /** First cell name present in this fighter's sheet meta wins. */
  private cellFor(slot: 0 | 1, candidates: string[]): number {
    const map = this.cellMaps[slot];
    for (const c of candidates) {
      const idx = map.get(c);
      if (idx !== undefined) return idx;
    }
    return 0;
  }

  /** Cell-name candidates for an attack, newest naming first, legacy last. */
  private attackCells(charId: string, moveId: string, phase: 0 | 1 | 2): string[] {
    // named specials: own cells, else the legacy single-special cells
    if (characters[charId].moves[moveId]?.input) {
      return [`${moveId}-${PHASE_NAME[phase]}`, `special-${PHASE_NAME[phase]}`];
    }
    if (moveId.startsWith('j')) return [moveId, 'jump'];
    if (moveId.startsWith('c')) {
      // crouch normals have 2 cells on v2 sheets (active art covers startup)
      const v2 = `${moveId}-${phase === 2 ? 'recovery' : 'active'}`;
      return [v2, `sweep-${PHASE_NAME[phase]}`, 'crouch'];
    }
    return [`${moveId}-${PHASE_NAME[phase]}`, `${LEGACY_BUTTON[moveId]}-${PHASE_NAME[phase]}`];
  }

  /** engine action -> sheet cell index (names from tools/frames-manifest.mjs) */
  private actionToCell(slot: 0 | 1, f: FighterState): number {
    const a = f.action;
    const t = this.state.tick;
    switch (a.kind) {
      case 'idle': return this.cellFor(slot, [(t >> 4) % 2 ? 'idle-b' : 'idle-a']);
      case 'walkF':
      case 'walkB': return this.cellFor(slot, [(t >> 3) % 2 ? 'walk-b' : 'walk-a']);
      case 'crouch':
      case 'prejump':
      case 'getup': return this.cellFor(slot, ['crouch']);
      case 'air': return this.cellFor(slot, ['jump']);
      case 'attack':
      case 'airAttack': {
        const m = characters[f.charId].moves[a.moveId!];
        const phase = a.frame < m.startup ? 0 : a.frame < m.startup + m.active ? 1 : 2;
        return this.cellFor(slot, this.attackCells(f.charId, a.moveId!, phase as 0 | 1 | 2));
      }
      case 'dazed':
      case 'hitstun': return this.cellFor(slot, ['hit']);
      case 'blockstun':
        return this.cellFor(slot, a.guard === 'crouch' ? ['block-crouch'] : ['block']);
      case 'airHit': return this.cellFor(slot, ['fall']);
      case 'knockdown': return this.cellFor(slot, ['down']);
      case 'ko': return this.cellFor(slot, f.y >= FLOOR_Y ? ['down'] : ['fall']);
      default: return 0;
    }
  }

  private draw(): void {
    const s = this.state;
    const gU = this.gfxUnder;
    gU.clear();
    this.gfxHud.clear();

    if (s.phase === 'fatality' && s.fatality) {
      this.drawFatality();
      return;
    }
    if (this.fatalityPanel) {
      this.fatalityPanel.setVisible(false);
    }

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
        sprite.setVisible(true);
        const h = def.hurtStand.h * 1.32; // art has margin around the body
        sprite.setDisplaySize((h * CELL_W) / CELL_H, h);
        sprite.setPosition(f.x, f.y + 6);
        sprite.setFlipX(f.facing === -1);
        sprite.setRotation(0);
        sprite.setFrame(this.actionToCell(slot, f));
        const k = f.action.kind;
        const mirrorTint = this.chars[0] === this.chars[1] && slot === 1 ? 0xffb0a0 : undefined;
        if (k === 'hitstun' || (k === 'airHit' && f.action.frame < 6)) sprite.setTintFill(0xffffff);
        else if (k === 'blockstun') sprite.setTint(0xaaaaff);
        else if (k === 'dazed') {
          sprite.setTint(0x776677);
          sprite.setRotation(Math.sin(this.state.tick / 9) * 0.05); // woozy sway
        } else if (k === 'ko' || k === 'knockdown') sprite.setTint(0x9a9a9a);
        else if (mirrorTint) sprite.setTint(mirrorTint);
        else sprite.clearTint();
      } else {
        this.drawCapsule(slot);
      }
    }

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
        const size = s.fighters[p.owner].charId === 'catherine' ? 96 : 72; // Jazzper is a whole dog
        img.setVisible(true).setPosition(p.x, p.y).setDisplaySize(size, size);
        if (s.fighters[p.owner].charId === 'vincent') {
          img.setRotation(s.tick * 0.15 * (p.vx > 0 ? 1 : -1)); // runes spin
        } else {
          img.setRotation(0).setFlipX(p.vx < 0); // dogs and fire just face forward
        }
      } else {
        img.setVisible(false);
        gU.fillStyle(0xb28aff, 1).fillCircle(p.x, p.y, 16);
        gU.fillStyle(0xffffff, 0.8).fillCircle(p.x, p.y, 7);
      }
    });

    this.sparks = this.sparks.filter((sp) => --sp.life > 0);
    for (const sp of this.sparks) {
      this.gfxHud.fillStyle(sp.color, sp.life / 12).fillCircle(sp.x, sp.y, 26 - sp.life);
    }

    this.comboText.setVisible(this.comboHits >= 2 && this.comboTicks > 0);
    this.comboText.setAlpha(Math.min(1, this.comboTicks / 30));

    if (this.debugBoxes) this.drawDebug();
    this.drawHud();
  }

  /** Full-bleed cutscene panels while the engine ticks the fatality timeline.
   *  Generic: any character with panels at assets/fatalities/<id>/<fid>-<n>. */
  private drawFatality(): void {
    const s = this.state;
    const { owner, id } = s.fatality!;
    const def = characters[s.fighters[owner].charId];
    const panels = def.fatality?.panels ?? 4;
    const panel = Math.min(panels, 1 + Math.floor((s.phaseFrame / FATALITY_TICKS) * panels));
    const key = `fat-${s.fighters[owner].charId}-${id}-${panel}`;

    for (const sp of this.fighterSprites) sp?.setVisible(false);
    for (const img of this.projSprites) img.setVisible(false);

    if (!this.fatalityPanel) {
      this.fatalityPanel = this.add.image(STAGE_W / 2, STAGE_H / 2, '__DEFAULT').setDepth(8);
    }
    const img = this.fatalityPanel;
    if (this.textures.exists(key)) {
      if (img.texture.key !== key) {
        img.setTexture(key).setDisplaySize(STAGE_W, STAGE_H).setVisible(true);
        this.cameras.main.shake(120, 0.006);
        this.cameras.main.flash(120, 255, 60, 40);
        play(this, 's-hit', 0.9);
      }
    } else {
      // no art: dramatic red blackout fallback so the flow still works
      img.setVisible(false);
      this.gfxUnder.fillStyle(0x1a0508, 1).fillRect(0, 0, STAGE_W, STAGE_H);
    }
    this.msgText.setText('');
    this.timerText.setText('');
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
    if (a.kind === 'attack' || a.kind === 'airAttack') {
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
      const crouched =
        f.action.kind === 'crouch' ||
        (f.action.kind === 'attack' && f.action.moveId?.startsWith('c'));
      const hr = worldBox(f, crouched ? def.hurtCrouch : def.hurtStand);
      g.lineStyle(1, 0x44ff88, 1).strokeRect(hr.l, hr.t, hr.r - hr.l, hr.b - hr.t);
      const br = worldBox(f, def.bodyBox);
      g.lineStyle(1, 0x4488ff, 1).strokeRect(br.l, br.t, br.r - br.l, br.b - br.t);
      const a = f.action;
      if (a.kind === 'attack' || a.kind === 'airAttack') {
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
    for (const slot of [0, 1] as const) {
      const f = s.fighters[slot];
      const def = characters[f.charId];
      const ratio = Math.max(0, f.health / def.health);
      const x = slot === 0 ? BAR_X1 : STAGE_W - BAR_X1 - BAR_W;
      // portrait frame
      const px = slot === 0 ? 68 : STAGE_W - 68;
      g.lineStyle(2, 0x594566, 1).strokeRect(px - 25, 21, 50, 50);
      g.fillStyle(0x14101a, 0.9).fillRect(x - 2, 26, BAR_W + 4, 22);
      const fillW = BAR_W * ratio;
      const color = ratio > 0.5 ? 0x7ee06e : ratio > 0.25 ? 0xffd24a : 0xff5a48;
      g.fillStyle(color, 1).fillRect(slot === 0 ? x + BAR_W - fillW : x, 28, fillW, 18);
      for (let w = 0; w < 2; w++) {
        const wx = slot === 0 ? x + BAR_W - 14 - w * 20 : x + 14 + w * 20;
        if (s.wins[slot] > w) g.fillStyle(0xffd24a, 1).fillCircle(wx, 62, 6);
        else g.lineStyle(1, 0xd8cbb8, 1).strokeCircle(wx, 62, 6);
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
      case 'finisher':
        return 'FINISH THEM!';
      case 'matchEnd': {
        const name = characters[s.fighters[s.roundWinner ?? 0].charId].name;
        const fatal = s.fatality ? '\nFATALITY' : '';
        return `${name} WINS${fatal}\nR rematch · ENTER select`;
      }
      default:
        return '';
    }
  }

  // ---------- pause / move list ----------

  private moveListText(slot: 0 | 1): string {
    const def = characters[this.chars[slot]];
    const m = def.moves;
    const cell = (id: string) => {
      const mv = m[id];
      if (!mv) return '—'.padEnd(14);
      const kd = mv.knockdown ? ' KD' : '';
      return `${mv.damage}dmg ${mv.startup}f${kd}`.padEnd(14);
    };
    const notate = (input: { motion: string; button: string }) => {
      const motion = input.motion === 'qcf' ? '↓↘→' : input.motion === 'qcb' ? '↓↙←' : '← →';
      return `${motion}+${input.button === 'punch' ? 'P' : 'K'}`;
    };
    const specials = Object.values(m)
      .filter((mv) => mv.input)
      .map((mv) => `★ ${mv.name}: ${notate(mv.input!)}`);
    const fatality = def.fatality
      ? [`☠ ${def.fatality.name}: ${notate(def.fatality.input)}  (when they hear FINISH THEM!)`]
      : [];
    return [
      def.name,
      ...specials,
      ...fatality,
      '',
      '        PUNCH         KICK',
      ` L      ${cell('lp')}${cell('lk')}`,
      ` M      ${cell('mp')}${cell('mk')}`,
      ` H      ${cell('hp')}${cell('hk')}`,
      '',
      '↓+button   crouching versions',
      '           (↓+kicks hit LOW: crouch-block them)',
      'jump+button air versions',
      '           (overheads: block them STANDING)',
    ].join('\n');
  }

  private buildPauseOverlay(): void {
    const font = { fontFamily: 'monospace', color: '#f5ead9' };
    const panel = this.add
      .rectangle(STAGE_W / 2, STAGE_H / 2, STAGE_W - 70, STAGE_H - 60, 0x0c0910, 0.94)
      .setStrokeStyle(2, 0x594566);
    const title = this.add
      .text(STAGE_W / 2, 62, 'PAUSED — MOVE LIST', { ...font, fontSize: '26px', fontStyle: 'bold' })
      .setOrigin(0.5);
    const colL = this.add.text(80, 100, this.moveListText(0), { ...font, fontSize: '13px', lineSpacing: 5 });
    const colR = this.add.text(STAGE_W / 2 + 40, 100, this.moveListText(1), { ...font, fontSize: '13px', lineSpacing: 5 });
    const controls = this.add
      .text(
        STAGE_W / 2,
        STAGE_H - 92,
        'P1  WASD move · R/T/Y punches · F/G/H kicks        P2  ARROWS move · U/I/O punches · J/K/L kicks\n' +
          'special: ↓ ↘ → + any punch      pads: X/Y/RB punches · A/B/RT kicks',
        { ...font, fontSize: '13px', color: '#e8dcc8', align: 'center', lineSpacing: 6 },
      )
      .setOrigin(0.5);
    const foot = this.add
      .text(STAGE_W / 2, STAGE_H - 48, 'ESC resume · F1 hitbox debug (yellow startup / red active / grey recovery)', {
        ...font, fontSize: '12px', color: '#9a8fa8',
      })
      .setOrigin(0.5);
    this.pauseOverlay = this.add
      .container(0, 0, [panel, title, colL, colR, controls, foot])
      .setDepth(10)
      .setVisible(false);
  }
}
