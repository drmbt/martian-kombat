// Renders engine state and plays presentation (sprites, HUD, audio). All
// audio/vfx are derived by diffing engine state before/after each tick —
// the deterministic core in src/engine/ stays pure and silent.
import Phaser from 'phaser';
import {
  EMPTY_INPUT,
  FATALITY_TICKS,
  FLOOR_Y,
  InputFrame,
  GameState,
  INTRO_TICKS,
  STAGE_W,
  STAGE_H,
  TICK_MS,
  FighterState,
  initialState,
  resolveMove,
  step,
  worldBox,
} from '../engine';
import { characters } from '../data/characters';
import { KeyboardSource } from '../input/keyboard';
import { CpuDriver } from '../ai/bot';
import { play } from './BootScene';
import { nextTrack, playMusic } from '../audio/music';
import { getSettings } from '../settings';

// Cells are looked up BY NAME from each sheet's meta.json (written by
// tools/pack-sheet.mjs), so v2 six-button sheets and legacy 23-cell sheets
// coexist. Legacy sheets fall back: new buttons borrow the nearest old art.
/** Round ended by the clock (never true when the round clock is off). */
const timedOut = (s: GameState): boolean => s.rules.roundTicks > 0 && s.timer <= 0;

const CELL_W = 288;
const CELL_H = 384;
const PHASE_NAME = ['startup', 'active', 'recovery'] as const;
// per-special projectile draw size (square px); default 72
const PROJ_SIZE: Record<string, number> = {
  'order-up': 96, // Jazzper is a whole dog
  'fork-bomb': 64,
  'fork-bomb-burst': 150,
  smokescreen: 260,
  'root-access': 120,
  'sudo-kill': 90,
};
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
  moveIds: [string | undefined, string | undefined];
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
  private stageId = 'salton';
  private bg: Phaser.GameObjects.Image | null = null;
  /** px of background hidden past each screen edge — the parallax travel */
  private bgOverhang = 0;
  private accumulator = 0;
  private debugBoxes = false;
  private sparks: Spark[] = [];
  private comboHits = 0;
  private comboTicks = 0;
  private cellMaps: [Map<string, number>, Map<string, number>] = [new Map(), new Map()];
  private paused = false;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private pauseScroll: { txt: Phaser.GameObjects.Text; top: number; maxScroll: number; scroll: number }[] = [];
  private cpu = false;
  private training = false;
  private bot: CpuDriver | null = null;
  private fatalityPanel: Phaser.GameObjects.Image | null = null;
  /** SFII-style post-match taunt: winner portrait, beaten loser portrait, quote */
  private winScreen: Phaser.GameObjects.Container | null = null;
  private moveLogOn = false;
  private moveLog: string[] = [];
  private moveLogText!: Phaser.GameObjects.Text;
  private inputHist: [string[], string[]] = [[], []];
  private inputHistTexts: Phaser.GameObjects.Text[] = [];
  private prevInputs: [InputFrame, InputFrame] = [{ ...EMPTY_INPUT }, { ...EMPTY_INPUT }];
  private lastDamageTick: [number, number] = [0, 0];

  constructor() {
    super('Fight');
  }

  init(data: { p1?: string; p2?: string; cpu?: boolean; training?: boolean; stage?: string }): void {
    this.chars = [data.p1 ?? 'vincent', data.p2 ?? 'yulia'];
    this.stageId = data.stage ?? 'salton';
    this.cpu = !!data.cpu;
    this.training = !!data.training;
    this.bot = this.cpu ? new CpuDriver(1) : null;
    this.fatalityPanel = null;
    this.moveLogOn = this.training; // sandbox shows the move log by default
    this.moveLog = [];
    this.lastDamageTick = [0, 0];
    // scene instances are reused across matches — reset transient UI state so a
    // match entered from a *paused* one doesn't start frozen
    this.paused = false;
  }

  create(): void {
    const cfg = getSettings();
    this.state = initialState(this.chars[0], this.chars[1], characters, {
      roundTicks: cfg.roundSeconds * 60,
      winsNeeded: cfg.winsNeeded,
    });
    this.inputs = new KeyboardSource(this);
    this.fighterSprites = [null, null];
    this.projSprites = [];
    this.winScreen = null; // rebuilt lazily on matchEnd (scene.restart destroys it)
    this.sparks = [];
    this.accumulator = 0;
    this.comboHits = 0;
    this.comboTicks = 0;

    // per-stage fight music; a rematch on the same stage keeps the track going
    playMusic([`stages/${this.stageId}`, 'stages/default']);

    // Stage art keeps its native aspect at full screen height; anything wider
    // than the screen (ultra-wide 21:9 stages) becomes parallax travel.
    const bgKey = this.textures.exists(`bg-stage-${this.stageId}`)
      ? `bg-stage-${this.stageId}`
      : this.textures.exists('bg-salton') ? 'bg-salton' : null;
    this.hasBg = bgKey !== null;
    this.bg = null;
    this.bgOverhang = 0;
    if (bgKey) {
      const src = this.textures.get(bgKey).getSourceImage();
      const bgW = Math.max(STAGE_W, (STAGE_H * src.width) / src.height);
      this.bg = this.add.image(STAGE_W / 2, STAGE_H / 2, bgKey).setDisplaySize(bgW, STAGE_H).setDepth(0);
      this.bgOverhang = (bgW - STAGE_W) / 2;
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
      .text(STAGE_W / 2, STAGE_H - 14, 'P1: WASD + RTY punches FGH kicks   P2: ARROWS + UIO punches JKL kicks   ESC menu · F2 move log', {
        ...font, fontSize: '12px', color: '#e8dcc8', stroke: '#000', strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(6);

    // overlays live in the upper corners so the bottom on-screen pad is clear
    this.moveLogText = this.add
      .text(16, 96, '', {
        fontFamily: 'monospace', fontSize: '13px', color: '#9ef7a0',
        stroke: '#000', strokeThickness: 3, lineSpacing: 3,
      })
      .setOrigin(0, 0)
      .setDepth(6);
    this.inputHist = [[], []];
    this.inputHistTexts = [0, 1].map((slot) =>
      this.add
        .text(STAGE_W - 16, 96 + slot * 22, '', {
          fontFamily: 'monospace', fontSize: '15px',
          color: slot === 0 ? '#58e6d9' : '#ff8a7a',
          stroke: '#000', strokeThickness: 3,
        })
        .setOrigin(1, 0)
        .setDepth(6),
    );

    if (this.training) {
      this.add
        .text(STAGE_W / 2, 84, 'TRAINING — dummy never fights back · health refills · ENTER to leave', {
          fontFamily: 'monospace', fontSize: '13px', color: '#ffd24a', stroke: '#000', strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(6);
    }

    this.buildPauseOverlay();
    this.input.keyboard!.on('keydown-F2', () => {
      this.moveLogOn = !this.moveLogOn;
      if (!this.moveLogOn) {
        this.moveLogText.setText('');
        for (const t of this.inputHistTexts) t.setText('');
      }
    });
    this.input.keyboard!.on('keydown-ESC', () => this.togglePause());
    this.input.keyboard!.on('keydown-F1', () => (this.debugBoxes = !this.debugBoxes));
    this.input.keyboard!.on('keydown-R', () => {
      if (this.state.phase === 'matchEnd') this.restartMatch();
    });
    this.input.keyboard!.on('keydown-ENTER', () => {
      if (this.training) this.toCharacterSelect();
      else if (this.state.phase === 'matchEnd') this.toCharacterSelect();
    });
    // clicking through the win-quote screen skips back to character select
    this.input.on('pointerdown', () => {
      if (this.state.phase === 'matchEnd') this.toCharacterSelect();
    });

    play(this, 'ann-round-1');
  }

  // ---------- pause / navigation ----------

  private togglePause(): void {
    this.paused = !this.paused;
    this.pauseOverlay.setVisible(this.paused);
  }

  private restartMatch(): void {
    this.scene.restart({ p1: this.chars[0], p2: this.chars[1], cpu: this.cpu, training: this.training, stage: this.stageId });
  }

  private toCharacterSelect(): void {
    this.scene.start('Select', { cpu: this.cpu, training: this.training });
  }

  private toMainMenu(): void {
    this.scene.start('Menu');
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
      const p1 = this.inputs.poll(0);
      const p2 = this.bot ? this.bot.poll(this.state) : this.inputs.poll(1);
      step(this.state, [p1, p2], characters);
      if (this.training) this.trainingUpkeep();
      this.logInputs([p1, p2]);
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
      moveIds: [a.action.moveId, b.action.moveId],
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
      nextTrack(); // fresh stage track between rounds (no-op for single-track folders)
    }
    if (s.phase === 'intro' && s.phaseFrame === Math.floor(INTRO_TICKS * 0.6)) {
      play(this, 'ann-fight', 1);
    }
    if (prev.phase === 'fight' && s.phase === 'roundEnd') {
      if (s.rules.roundTicks > 0 && s.timer <= 0) play(this, 'ann-time-up');
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
      // victory theme plays once over the win-quote screen, then the game
      // returns to character select (any click/ENTER skips ahead, R rematches)
      playMusic('victory', {
        keepOnMiss: true,
        once: true,
        onEnd: () => {
          if (this.state.phase === 'matchEnd') this.toCharacterSelect();
        },
      });
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
      if (
        (kind === 'attack' || kind === 'airAttack') &&
        (was !== kind || prev.moveIds[slot] !== f.action.moveId)
      ) {
        play(this, 's-whoosh', 0.4);
        if (characters[f.charId].moves[f.action.moveId!]?.input) play(this, `v-${f.charId}-kiai`, 0.8);
        this.logMove(slot);
      }
      if (kind === 'air' && was === 'prejump') play(this, 's-jump', 0.35);
    }

    if (s.projectiles.length > prev.projectiles) play(this, 's-projectile', 0.6);

    if (this.comboTicks > 0 && --this.comboTicks === 0) this.comboHits = 0;
  }

  /** Raw-input ticker: arrows for held direction + freshly pressed buttons,
   *  one line per player — shows what the engine actually registered. */
  private logInputs(frames: [InputFrame, InputFrame]): void {
    for (const slot of [0, 1] as const) {
      const i = frames[slot];
      const prev = this.prevInputs[slot];
      const dir =
        i.up && i.left ? '↖' : i.up && i.right ? '↗'
        : i.down && i.left ? '↙' : i.down && i.right ? '↘'
        : i.up ? '↑' : i.down ? '↓' : i.left ? '←' : i.right ? '→' : '';
      const btns = (['lp', 'mp', 'hp', 'lk', 'mk', 'hk'] as const)
        .filter((b) => i[b] && !prev[b])
        .map((b) => b.toUpperCase())
        .join('+');
      this.prevInputs[slot] = { ...i };
      const token = btns ? `${dir}${dir ? '+' : ''}${btns}` : dir;
      const hist = this.inputHist[slot];
      if (token && token !== hist[hist.length - 1]) {
        hist.push(token);
        if (hist.length > 10) hist.shift();
        if (this.moveLogOn) this.inputHistTexts[slot].setText(`P${slot + 1} ▸ ${hist.join(' ')}`);
      }
    }
  }

  /** FIFO overlay of triggered moves: "P1 Rising Glyph (H)" / "P2 cr.MK". */
  private logMove(slot: 0 | 1): void {
    const f = this.state.fighters[slot];
    const id = f.action.moveId!;
    const def = characters[f.charId].moves[id];
    let label: string;
    if (def?.input) {
      const str = f.action.strength ? ` (${f.action.strength.toUpperCase()})` : '';
      const M: Record<string, string> = {
        qcf: '↓↘→', qcb: '↓↙←', bf: '←→', dp: '→↓↘', hcb: '→↓←', hcf: '←↓→', '360': '360°',
      };
      const inp = def.input.motion ? M[def.input.motion] : '';
      const btn = def.input.button === 'punch' ? 'P' : def.input.button === 'kick' ? 'K' : def.input.button;
      label = `${def.name ?? id}${str} · ${inp}${inp ? '+' : ''}${btn}`;
    } else if (id.startsWith('c')) label = `cr.${id.slice(1).toUpperCase()}`;
    else if (id.startsWith('j')) label = `j.${id.slice(1).toUpperCase()}`;
    else label = id.toUpperCase();
    this.moveLog.push(`P${slot + 1}  ${label}`);
    if (this.moveLog.length > 8) this.moveLog.shift();
    if (this.moveLogOn) this.moveLogText.setText(this.moveLog.join('\n'));
  }

  /** Sandbox rules: frozen clock, refilling health, rounds never end. */
  private trainingUpkeep(): void {
    const s = this.state;
    s.timer = s.rules.roundTicks;
    for (const slot of [0, 1] as const) {
      const f = s.fighters[slot];
      const full = characters[f.charId].health;
      if (f.health < full) {
        if (this.lastDamageTick[slot] === 0) this.lastDamageTick[slot] = s.tick;
        if (s.tick - this.lastDamageTick[slot] > 120) {
          f.health = full;
          this.lastDamageTick[slot] = 0;
        }
      }
    }
    // a KO/finisher in the sandbox just resets the room
    if (s.phase !== 'fight' && s.phase !== 'intro') {
      s.phase = 'fight';
      s.phaseFrame = 0;
      s.roundWinner = null;
      s.fatality = null;
      s.wins = [0, 0];
      s.projectiles = [];
      for (const f of s.fighters) {
        f.health = characters[f.charId].health;
        f.action = { kind: 'idle', frame: 0 };
        f.vx = 0;
        f.vy = 0;
        f.y = FLOOR_Y;
      }
      this.lastDamageTick = [0, 0];
    }
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
        const m = resolveMove(characters[f.charId].moves[a.moveId!], a.strength);
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

    // Post-match win-quote screen: after the K.O./victory beat lands, the winner
    // portrait taunts the beaten loser portrait with a quote (SFII win screen).
    if (s.phase === 'matchEnd' && s.roundWinner !== null && s.phaseFrame > 72) {
      this.showWinScreen(s.roundWinner);
      return;
    }
    if (this.winScreen) this.winScreen.setVisible(false);

    if (!this.hasBg) {
      gU.fillStyle(0x241b2e, 1).fillRect(0, 0, STAGE_W, STAGE_H);
      gU.fillStyle(0x3a2b40, 1).fillRect(0, FLOOR_Y, STAGE_W, STAGE_H - FLOOR_Y);
      gU.lineStyle(2, 0x594566, 1).lineBetween(0, FLOOR_Y, STAGE_W, FLOOR_Y);
    }

    // SF2-style parallax: the background slides opposite the fighters' midpoint
    if (this.bg && this.bgOverhang > 0) {
      const mid = (s.fighters[0].x + s.fighters[1].x) / 2;
      const t = Phaser.Math.Clamp((mid - STAGE_W / 2) / (STAGE_W / 2), -1, 1);
      this.bg.setX(STAGE_W / 2 - t * this.bgOverhang);
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
      const ownerChar = s.fighters[p.owner].charId;
      // per-special art, falling back to the character's legacy single sprite
      const key = this.textures.exists(`proj-${ownerChar}-${p.moveId}`)
        ? `proj-${ownerChar}-${p.moveId}`
        : `proj-${ownerChar}`;
      if (this.textures.exists(key)) {
        if (img.texture.key !== key) img.setTexture(key);
        const size = PROJ_SIZE[p.moveId] ?? 72;
        img.setVisible(true).setPosition(p.x, p.y).setDisplaySize(size, size);
        img.setAlpha(p.moveId === 'smokescreen' ? 0.92 : 1);
        if (p.moveId === 'sigil-bolt') {
          img.setRotation(s.tick * 0.15 * (p.vx > 0 ? 1 : -1)); // runes spin
        } else if (p.moveId === 'fork-bomb' && (p.vx !== 0 || p.vy !== 0)) {
          img.setRotation(s.tick * 0.12 * (p.vx > 0 ? 1 : -1)); // laptop tumbles until it lands
        } else {
          img.setRotation(0).setFlipX(p.vx < 0); // dogs, fire, knives face forward
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
    this.moveLogText.setVisible(this.moveLogOn);
    for (const t of this.inputHistTexts) t.setVisible(this.moveLogOn);
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

  /** Build (once) and reveal the SFII-style post-match taunt screen: winner
   *  portrait on the left, beaten-and-bloodied loser portrait on the right, and
   *  one of the winner's random win quotes printed at the bottom. */
  private showWinScreen(winner: 0 | 1): void {
    if (this.winScreen) {
      this.winScreen.setVisible(true);
      return;
    }
    const loser: 0 | 1 = winner === 0 ? 1 : 0;
    const winId = this.chars[winner];
    const loseId = this.chars[loser];
    const winDef = characters[winId];
    const quotes = winDef.winQuotes ?? [];
    const quote = quotes.length ? Phaser.Utils.Array.GetRandom(quotes) : '...';
    const font = { fontFamily: 'monospace', color: '#f5ead9' };

    const c = this.add.container(0, 0).setDepth(20);

    c.add(this.add.rectangle(0, 0, STAGE_W, STAGE_H, 0x05030a, 1).setOrigin(0, 0));

    // winner portrait (faces right, toward the loser)
    const winKey = this.textures.exists(`portrait-${winId}`) ? `portrait-${winId}` : null;
    if (winKey) c.add(this.add.image(288, 232, winKey).setDisplaySize(300, 300));
    // loser portrait: beaten-and-bloodied variant if it exists, else greyed normal
    const koKey = this.textures.exists(`portrait-ko-${loseId}`)
      ? `portrait-ko-${loseId}`
      : this.textures.exists(`portrait-${loseId}`) ? `portrait-${loseId}` : null;
    if (koKey) {
      const l = this.add.image(672, 232, koKey).setDisplaySize(300, 300).setFlipX(true);
      if (koKey === `portrait-${loseId}`) l.setTint(0x777277); // no KO art: grey them out
      c.add(l);
    }

    c.add(
      this.add
        .text(STAGE_W / 2, 64, `${winDef.name} WINS`, {
          ...font, fontSize: '44px', fontStyle: 'bold', color: winDef.color,
          stroke: '#000', strokeThickness: 8,
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(STAGE_W / 2, 452, quote, {
          ...font, fontSize: '26px', fontStyle: 'bold', color: '#ffd24a', align: 'center',
          stroke: '#000', strokeThickness: 6, wordWrap: { width: STAGE_W - 120 },
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(STAGE_W / 2, STAGE_H - 26, 'R  REMATCH        ENTER  SELECT', {
          ...font, fontSize: '15px', color: '#e8dcc8', stroke: '#000', strokeThickness: 3,
        })
        .setOrigin(0.5),
    );

    this.winScreen = c;
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
      const m = resolveMove(def.moves[a.moveId!], a.strength);
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
        const m = resolveMove(def.moves[a.moveId!], a.strength);
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

    this.timerText.setText(s.rules.roundTicks === 0 ? '∞' : String(Math.max(0, Math.ceil(s.timer / 60))));
    this.msgText.setText(this.message());
  }

  private message(): string {
    const s = this.state;
    switch (s.phase) {
      case 'intro':
        return s.phaseFrame < INTRO_TICKS * 0.6 ? `ROUND ${s.roundNumber}` : 'FIGHT!';
      case 'roundEnd':
        if (s.roundWinner === null) return timedOut(s) ? 'TIME UP' : 'DOUBLE K.O.';
        return timedOut(s) ? 'TIME UP' : 'K.O.';
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
    const notate = (input: { motion?: string; button: string }) => {
      const M: Record<string, string> = {
        qcf: '↓↘→', qcb: '↓↙←', bf: '← →', dp: '→↓↘', hcb: '→↓←', hcf: '←↓→', '360': '360°',
      };
      const btn = input.button === 'punch' ? 'P' : input.button === 'kick' ? 'K' : input.button;
      return `${input.motion ? M[input.motion] + '+' : ''}${btn}`;
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
    const PW = STAGE_W - 70;
    const PH = STAGE_H - 60;
    const px = 35; // panel left
    const py = 30; // panel top
    const items: Phaser.GameObjects.GameObject[] = [];

    items.push(
      this.add.rectangle(STAGE_W / 2, STAGE_H / 2, PW, PH, 0x0c0910, 0.95).setStrokeStyle(2, 0x594566),
    );
    items.push(
      this.add.text(STAGE_W / 2, py + 26, 'PAUSED', { ...font, fontSize: '26px', fontStyle: 'bold' }).setOrigin(0.5),
    );

    // --- menu buttons row (clickable + keyboard) ---
    const menu: { label: string; act: () => void }[] = [
      { label: 'RESUME', act: () => this.togglePause() },
      { label: 'RESTART', act: () => this.restartMatch() },
      { label: 'CHARACTER SELECT', act: () => this.toCharacterSelect() },
      { label: 'MAIN MENU', act: () => this.toMainMenu() },
    ];
    const btnY = py + 66;
    const gap = 14;
    const btnW = (PW - 40 - gap * (menu.length - 1)) / menu.length;
    menu.forEach((mi, i) => {
      const bx = px + 20 + i * (btnW + gap) + btnW / 2;
      const bg = this.add
        .rectangle(bx, btnY, btnW, 40, 0x241b2e, 1)
        .setStrokeStyle(2, 0x7a6a86)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(bx, btnY, mi.label, { ...font, fontSize: '14px', fontStyle: 'bold' })
        .setOrigin(0.5);
      bg.on('pointerover', () => bg.setFillStyle(0x3a2b40).setStrokeStyle(2, 0xffb347));
      bg.on('pointerout', () => bg.setFillStyle(0x241b2e).setStrokeStyle(2, 0x7a6a86));
      bg.on('pointerdown', () => { play(this, 's-blip', 0.5); mi.act(); });
      items.push(bg, label);
    });

    // --- move-list columns, contained + wheel-scrollable ---
    const listTop = py + 100;
    const listBottom = py + PH - 44;
    const listH = listBottom - listTop;
    const colW = (PW - 60) / 2;
    const colX = [px + 20, px + 20 + colW + 20];
    this.pauseScroll = [];
    for (const slot of [0, 1] as const) {
      const x = colX[slot];
      const txt = this.add.text(x, listTop, this.moveListText(slot), {
        ...font, fontSize: '13px', lineSpacing: 5, wordWrap: { width: colW - 8 },
      });
      const mask = this.add
        .rectangle(x + colW / 2, listTop + listH / 2, colW, listH, 0x000000, 0)
        .setVisible(false);
      txt.setMask(mask.createGeometryMask());
      const state = { txt, top: listTop, maxScroll: Math.max(0, txt.height - listH), scroll: 0 };
      this.pauseScroll.push(state);
      // wheel over this column scrolls it
      mask.setInteractive(
        new Phaser.Geom.Rectangle(x, listTop, colW, listH),
        Phaser.Geom.Rectangle.Contains,
      );
      mask.on('wheel', (_p: unknown, _dx: number, dy: number) => {
        state.scroll = Phaser.Math.Clamp(state.scroll + dy * 0.5, 0, state.maxScroll);
        txt.setY(listTop - state.scroll);
      });
      if (state.maxScroll > 0) {
        items.push(
          this.add.text(x + colW - 4, listBottom + 2, '▼ scroll', {
            ...font, fontSize: '10px', color: '#9a8fa8',
          }).setOrigin(1, 0),
        );
      }
      items.push(txt, mask);
    }

    items.push(
      this.add
        .text(STAGE_W / 2, py + PH - 20, 'ESC resume · F1 hitboxes · F2 move log · click a button above', {
          ...font, fontSize: '11px', color: '#9a8fa8',
        })
        .setOrigin(0.5),
    );

    this.pauseOverlay = this.add.container(0, 0, items).setDepth(10).setVisible(false);
  }
}
