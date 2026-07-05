// Renders engine state and plays presentation (sprites, HUD, audio). All
// audio/vfx are derived by diffing engine state before/after each tick —
// the deterministic core in src/engine/ stays pure and silent.
import Phaser from 'phaser';
import {
  FATALITY_TICKS,
  FLOOR_Y,
  InputFrame,
  GameState,
  INTRO_TICKS,
  STAGE_W,
  STAGE_H,
  FighterState,
  initialState,
  resolveMove,
  worldBox,
} from '../engine';
import { FightSession, type Session } from '../session/FightSession';
import { NetSession, type NetIssue } from '../session/NetSession';
import type { OnlineFightData } from '../net/lobby';
import { characters } from '../data/characters';
import { stageById } from '../data/stages';
import { KeyboardSource } from '../input/keyboard';
import { CpuDriver } from '../ai/bot';
import { play, playVoice, runCues } from './BootScene';
import { playMusic } from '../audio/music';
import { getSettings } from '../settings';
import { diffTick, snapTick, type FightEvent, type TickSnap } from '../presentation/tickEvents';
import { soundCues } from '../presentation/soundDirector';
import { HudModel } from '../presentation/hudModel';
import { UiLayer } from '../ui/layer';
import { WinOverlay } from '../ui/WinOverlay';
import { FightShell } from './fightShell';

// Cells are looked up BY NAME from each sheet's meta.json (written by
// tools/pack-sheet.mjs), so v2 six-button sheets and legacy 23-cell sheets
// coexist. Legacy sheets fall back: new buttons borrow the nearest old art.
/** Round ended by the clock (never true when the round clock is off). */
const timedOut = (s: GameState): boolean => s.rules.roundTicks > 0 && s.timer <= 0;

const CELL_W = 288;
const CELL_H = 384;
const SHADOW_W = 96;
const SHADOW_H = 36;
const SHADOW_PAD = 8;
const SPRITE_FOOT_OFFSET_Y = 16;
const PHASE_NAME = ['startup', 'active', 'recovery'] as const;
// per-special projectile draw size (square px); default 72
const PROJ_SIZE: Record<string, number> = {
  'order-up': 96, // Jazzper is a whole dog
  'fork-bomb': 64,
  'fork-bomb-burst': 150,
  smokescreen: 260,
  'root-access': 120,
  'sudo-kill': 90,
  overgrowth: 48,
  'overgrowth-burst': 200,
  'spore-bloom': 130,
  hallucination: 300,
  'hallucination-burst': 170,
  'rate-limit': 220,
  'flour-bomb': 210,
  'thread-of-life': 92,
};
// projectiles that depict a grounded figure: engine y is their FEET (spawnY 0,
// box extends upward), so draw bottom-anchored instead of centered — a
// centered clone renders half-buried below the floor
const PROJ_FEET_ANCHORED = new Set(['hallucination', 'hallucination-burst', 'flour-bomb']);
const LEGACY_BUTTON: Record<string, string> = {
  lp: 'light', mp: 'light', hp: 'heavy', lk: 'light', mk: 'heavy', hk: 'heavy',
};

const BAR_W = 320;
const BAR_X1 = 100;
const DEFAULT_LAYER_FACTORS = { sky: 0.15, far: 0.35, near: 0.7, floor: 1.0 } as const;

interface Spark {
  x: number;
  y: number;
  life: number;
  color: number;
}

/** Composited impact overlay (hit sparks, per-move smoke/bursts): a sprite
 *  that grows and fades over a handful of render frames. */
interface VfxSprite {
  img: Phaser.GameObjects.Image;
  life: number;
  max: number;
  /** display-size growth per render frame, px */
  grow: number;
}

interface BgLayer {
  img: Phaser.GameObjects.Image;
  overhang: number;
  factor: number;
}

interface PerfDrawBuckets {
  draw: number;
  vfx: number;
  world: number;
  fighters: number;
  projectiles: number;
  sparks: number;
  debug: number;
  hud: number;
  cutscene: number;
}

interface PerfFrameSample extends PerfDrawBuckets {
  frame: number;
  sim: number;
  tick: number;
  present: number;
  ticks: number;
}

const blankDrawPerf = (): PerfDrawBuckets => ({
  draw: 0,
  vfx: 0,
  world: 0,
  fighters: 0,
  projectiles: 0,
  sparks: 0,
  debug: 0,
  hud: 0,
  cutscene: 0,
});

const mixColor = (a: number, b: number, t: number): number => {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const blue = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | blue;
};

export class FightScene extends Phaser.Scene {
  private chars: [string, string] = ['vincent', 'yulia'];
  private state!: GameState;
  private inputs!: KeyboardSource;
  private gfxUnder!: Phaser.GameObjects.Graphics;
  private gfxHud!: Phaser.GameObjects.Graphics;
  private fighterSprites: (Phaser.GameObjects.Sprite | null)[] = [null, null];
  private hitFlashSprites: (Phaser.GameObjects.Sprite | null)[] = [null, null];
  private fighterShadows: (Phaser.GameObjects.Image | null)[] = [null, null];
  private hudPortraitShadows: Phaser.GameObjects.Image[] = [];
  private projSprites: Phaser.GameObjects.Image[] = [];
  private msgText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private hasBg = false;
  private stageId = 'salton';
  private bg: Phaser.GameObjects.Image | null = null;
  private bgLayers: BgLayer[] = [];
  /** px of background hidden past each screen edge — the parallax travel */
  private bgOverhang = 0;
  private session!: Session;
  /** online payload when this is a netplay match (null = local) */
  private online: OnlineFightData | null = null;
  private net: NetSession | null = null;
  private netIssue: NetIssue | null = null;
  private netText: Phaser.GameObjects.Text | null = null;
  /** captured by the session's beforeTick hook for presentTick's diff */
  private pendingSnap: TickSnap | null = null;
  private tickStart = 0;
  private frameTickMs = 0;
  private framePresentMs = 0;
  private debugBoxes = false;
  private stageGuide = false;
  private sparks: Spark[] = [];
  private vfx: VfxSprite[] = [];
  /** persistent circling-stars overlay per fighter, shown while dazed */
  private dizzySprites: [Phaser.GameObjects.Image | null, Phaser.GameObjects.Image | null] = [null, null];
  /** shared ghost-bar + combo bookkeeping (see presentation/hudModel) */
  private hudModel!: HudModel;
  private cellMaps: [Map<string, number>, Map<string, number>] = [new Map(), new Map()];
  /** shared DOM chrome layer + the fight shell (pause/keys/nav/pad/log) */
  private uiLayer!: UiLayer;
  private shell!: FightShell;
  private cpu = false;
  private training = false;
  private demo = false;
  private bot: CpuDriver | null = null;
  private botP1: CpuDriver | null = null;
  private fatalityPanel: Phaser.GameObjects.Image | null = null;
  /** SFII-style post-match taunt screen (shared DOM WinOverlay) */
  private winOverlay!: WinOverlay;
  private stageGuideTexts: Phaser.GameObjects.Text[] = [];
  private lastDamageTick: [number, number] = [0, 0];
  private perfOn = false;
  private perfText!: Phaser.GameObjects.Text;
  private perfSamples: PerfFrameSample[] = [];
  private perfDraw = blankDrawPerf();

  constructor() {
    super('Fight');
  }

  init(data: {
    p1?: string;
    p2?: string;
    cpu?: boolean;
    training?: boolean;
    demo?: boolean;
    stage?: string;
    online?: OnlineFightData;
  }): void {
    this.chars = [data.p1 ?? 'vincent', data.p2 ?? 'yulia'];
    this.stageId = data.stage ?? 'salton';
    this.online = data.online ?? null;
    // online is strictly 2-human: no CPU, no demo, no training upkeep
    this.cpu = !this.online && !!data.cpu;
    this.training = !this.online && !!data.training;
    this.demo = !this.online && !!data.demo;
    this.net = null;
    this.netIssue = null;
    this.bot = this.cpu || this.demo ? new CpuDriver(1) : null;
    this.botP1 = this.demo ? new CpuDriver(0) : null;
    this.fatalityPanel = null;
    this.lastDamageTick = [0, 0];
    this.stageGuide = false;
  }

  create(): void {
    const cfg = getSettings();
    // online: BOTH peers build the identical start state from the lobby's
    // agreed rules — V25 replay-equivalence depends on this being deterministic
    this.state = initialState(
      this.chars[0],
      this.chars[1],
      characters,
      this.online
        ? this.online.rules
        : { roundTicks: cfg.roundSeconds * 60, winsNeeded: cfg.winsNeeded },
    );
    this.inputs = new KeyboardSource(this);
    // the one fight-loop driver (SPEC V17/V18): session owns pacing + step();
    // this scene hangs its presentation diffing off the tick hooks. The hooks
    // are IDENTICAL for local and net play — NetSession just consumes the
    // local slot's input and drives the remote slot over the wire (V18).
    const hooks = {
      beforeTick: (s: GameState) => {
        this.tickStart = performance.now();
        this.pendingSnap = snapTick(s);
      },
      inputs: (s: GameState): [InputFrame, InputFrame] => [
        this.botP1 ? this.botP1.poll(s) : this.inputs.poll(0),
        this.bot ? this.bot.poll(s) : this.inputs.poll(1),
      ],
      afterTick: (_s: GameState, inp: [InputFrame, InputFrame]) => {
        if (this.training) this.trainingUpkeep();
        this.logInputs(inp);
        this.frameTickMs += performance.now() - this.tickStart;
        const presentStart = performance.now();
        this.presentTick(this.pendingSnap!);
        this.framePresentMs += performance.now() - presentStart;
      },
    };
    if (this.online) {
      const net = new NetSession(this.state, hooks, characters, {
        transport: this.online.transport,
        localSlot: this.online.localSlot,
        delay: this.online.delay,
      });
      net.onIssue((issue) => (this.netIssue = issue));
      this.net = net;
      this.session = net;
      // net status line (T41 turns this into the ping/quality HUD). Kept
      // always-present so a halt (disconnect/desync) is never silent (V20).
      this.netText = this.add
        .text(STAGE_W / 2, 10, '', {
          fontFamily: 'monospace', fontSize: '14px', color: '#8fe388',
          stroke: '#000', strokeThickness: 4, align: 'center',
        })
        .setOrigin(0.5, 0)
        .setDepth(10000);
    } else {
      this.session = new FightSession(this.state, hooks, characters);
    }
    this.fighterSprites = [null, null];
    this.hitFlashSprites = [null, null];
    this.fighterShadows = [null, null];
    this.hudPortraitShadows = [];
    this.projSprites = [];
    // shared DOM chrome: layer + shell + overlays (auto-disposed on shutdown)
    this.uiLayer = new UiLayer(this);
    this.shell = new FightShell(this, {
      layer: this.uiLayer,
      defs: characters,
      chars: this.chars,
      stageId: this.stageId,
      online: this.online,
      cpu: this.cpu,
      training: this.training,
      demo: this.demo,
      render3d: false,
      state: () => this.state,
      debugKeys: [
        { key: 'F1', act: () => (this.debugBoxes = !this.debugBoxes) },
        { key: 'F3', act: () => (this.stageGuide = !this.stageGuide) },
      ],
      pauseHint:
        'ESC/START resume · ◄► choose, attack confirms · F1 hitboxes · F2 move log · F3 stage guide · ` perf',
    });
    this.winOverlay = new WinOverlay(this.uiLayer.root, characters, {
      revealFrame: 72, // the K.O./victory beat lands first
      prompt: this.online ? 'R  REMATCH   ·   ESC  QUIT' : 'R  REMATCH   ·   ENTER  SELECT',
      onFirstShow: (id) => playVoice(this, id, 'victory', 0.85),
    });
    this.sparks = [];
    this.vfx = []; // scene.restart destroyed the old images with the scene
    this.dizzySprites = [null, null];
    this.perfOn = false;
    this.hudModel = new HudModel(characters, this.chars);

    // per-stage fight music; a rematch on the same stage keeps the track going
    playMusic([`stages/${this.stageId}`, 'stages/default']);

    // Stage art keeps its native aspect at full screen height; anything wider
    // than the screen (ultra-wide 21:9 stages) becomes parallax travel.
    const bgKey = this.textures.exists(`bg-stage-${this.stageId}`)
      ? `bg-stage-${this.stageId}`
      : this.textures.exists('bg-salton') ? 'bg-salton' : null;
    this.hasBg = bgKey !== null;
    this.bg = null;
    this.bgLayers = [];
    this.bgOverhang = 0;
    const stageDef = stageById(this.stageId);
    const layerDefs = stageDef?.layers;
    if (layerDefs) {
      const ordered = [
        ['sky', layerDefs.sky],
        ['far', layerDefs.far],
        ['near', layerDefs.near],
        ['floor', layerDefs.floor],
      ] as const;
      for (const [name, layer] of ordered) {
        if (!layer) continue;
        const key = `bg-stage-${this.stageId}-${name}`;
        if (!this.textures.exists(key)) continue;
        const src = this.textures.get(key).getSourceImage();
        const bgW = Math.max(STAGE_W, (STAGE_H * src.width) / src.height);
        const img = this.add.image(STAGE_W / 2, STAGE_H / 2, key).setDisplaySize(bgW, STAGE_H).setDepth(0);
        this.bgLayers.push({
          img,
          overhang: (bgW - STAGE_W) / 2,
          factor: layer.factor ?? DEFAULT_LAYER_FACTORS[name],
        });
      }
      this.hasBg = this.bgLayers.length > 0;
    }
    if (bgKey && this.bgLayers.length === 0) {
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
        this.fighterShadows[slot] = this.add.image(0, 0, '__DEFAULT').setOrigin(0.5).setDepth(1.5).setVisible(false);
        this.fighterSprites[slot] = this.add.sprite(0, 0, `sheet-${id}`, 0).setOrigin(0.5, 0.95).setDepth(2);
        this.hitFlashSprites[slot] = this.add
          .sprite(0, 0, `sheet-${id}`, 0)
          .setOrigin(0.5, 0.95)
          .setDepth(3)
          .setTintFill(0xfff0ea)
          .setAlpha(0.45)
          .setVisible(false);
      }
      // HUD portrait
      if (this.textures.exists(`portrait-${id}`)) {
        const px = slot === 0 ? 68 : STAGE_W - 68;
        this.hudPortraitShadows.push(
          this.add
            .image(px + (slot === 0 ? 2 : -2), 48, `portrait-${id}`)
            .setDisplaySize(48, 48)
            .setDepth(5.5)
            .setFlipX(slot === 1)
            .setTintFill(0x000000)
            .setAlpha(0.38),
        );
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
      .text(STAGE_W / 2, STAGE_H - 14, 'P1: WASD + RTY punches FGH kicks   P2: ARROWS + UIO punches JKL kicks   ESC pause · F2 move log · F3 stage · ` perf', {
        ...font, fontSize: '12px', color: '#e8dcc8', stroke: '#000', strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(6);

    this.stageGuideTexts = [
      this.add.text(10, (260 / 720) * STAGE_H - 16, 'horizon y=260', {
        fontFamily: 'monospace', fontSize: '11px', color: '#ffffff', stroke: '#000', strokeThickness: 3,
      }),
      this.add.text(10, (500 / 720) * STAGE_H - 16, 'floor starts y=500', {
        fontFamily: 'monospace', fontSize: '11px', color: '#ffffff', stroke: '#000', strokeThickness: 3,
      }),
      this.add.text(10, (613 / 720) * STAGE_H - 18, 'FLOOR_Y / feet y=613', {
        fontFamily: 'monospace', fontSize: '11px', color: '#ffffff', stroke: '#000', strokeThickness: 3,
      }),
      this.add.text(10, (700 / 720) * STAGE_H - 18, 'clear fighter strip y=560-700', {
        fontFamily: 'monospace', fontSize: '11px', color: '#ffffff', stroke: '#000', strokeThickness: 3,
      }),
      this.add.text(STAGE_W - 236, 98, 'F3 STAGE GUIDE\nblue: horizon\nwhite: fighter feet\norange: floor plane', {
        fontFamily: 'monospace', fontSize: '11px', color: '#d8e7ff', stroke: '#000', strokeThickness: 3, lineSpacing: 3,
      }),
    ].map((t) => t.setDepth(7).setVisible(false));
    this.perfSamples = [];
    this.perfDraw = blankDrawPerf();
    this.perfText = this.add
      .text(14, 14, '', {
        fontFamily: 'monospace', fontSize: '12px', color: '#dfffe6',
        backgroundColor: '#050806cc', padding: { x: 8, y: 6 },
      })
      .setDepth(50)
      .setVisible(false);

    if (this.training) {
      this.add
        .text(STAGE_W / 2, 84, 'TRAINING · ENTER to leave', {
          fontFamily: 'monospace', fontSize: '13px', color: '#ffd24a', stroke: '#000', strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(6);
    }

    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (e.key !== '`') return;
      this.perfOn = !this.perfOn;
      this.perfText.setVisible(this.perfOn);
    });

    // demo exits, pause menu, F-keys, matchEnd nav, pointer nav: all live in
    // the shared FightShell (constructed above) — identical in 2D and 3D

    if (!this.demo) play(this, 'ann-round-1');
  }

  update(_time: number, deltaMs: number): void {
    // shell: pad nav, pause state, move-log redraw, online rematch arming
    if (!this.shell.frame()) {
      this.session.resetPacing();
      return;
    }
    const frameStart = performance.now();
    this.frameTickMs = 0;
    this.framePresentMs = 0;
    const tickCount = this.session.advance(deltaMs);
    if (this.net) this.updateNetStatus();
    this.draw();
    this.recordPerf({
      ...this.perfDraw,
      frame: performance.now() - frameStart,
      sim: this.frameTickMs + this.framePresentMs,
      tick: this.frameTickMs,
      present: this.framePresentMs,
      ticks: tickCount,
    });
  }

  /** Minimal net readout (T41 replaces with a proper quality indicator). */
  private updateNetStatus(): void {
    const net = this.net;
    const txt = this.netText;
    if (!net || !txt) return;
    if (this.netIssue) {
      const msg =
        this.netIssue.kind === 'desync'
          ? `DESYNC — match halted\n${this.netIssue.detail}`
          : `OPPONENT DISCONNECTED\n${this.netIssue.detail}`;
      txt.setText(msg).setColor('#ff5a4a');
      return;
    }
    const s = net.stats();
    if (s.stalls > 0 && s.ahead >= s.delay + 3) {
      txt.setText('WAITING FOR OPPONENT…').setColor('#ffd24a');
    } else {
      // quiet in the healthy case: just a small rollback tick-rate readout
      txt.setText(s.rollbacks > 0 ? `net · rb ${s.rollbacks}` : 'net').setColor('#8fe388');
    }
  }

  // (online rematch handshake + prompt: FightShell.armRematch)

  /** Diff pre/post tick state (shared diffTick) into audio cues (shared
   *  soundCues table), HUD bookkeeping (shared HudModel), and this
   *  renderer's own sparks/shakes/flashes. */
  private presentTick(prev: TickSnap): void {
    const s = this.state;
    const events = diffTick(prev, s, characters);
    runCues(this, soundCues(events, this.chars), {
      // victory theme plays once over the win-quote screen, then the game
      // returns to character select (any click/ENTER skips ahead, R rematches)
      onVictoryMusic: () =>
        playMusic('victory', {
          keepOnMiss: true,
          once: true,
          onEnd: () => {
            if (this.state.phase !== 'matchEnd') return;
            if (this.demo) this.shell.toMainMenu();
            else this.shell.toCharacterSelect();
          },
        }),
    });
    this.hudModel.tick(events, s);

    for (const e of events) {
      switch (e.type) {
        case 'match-end':
          // don't let the KO-causing punch (still held) instantly skip the win screen
          this.shell.armEndNav();
          break;
        case 'finisher':
          this.cameras.main.shake(150, 0.006);
          break;
        case 'fatality-start':
          this.cameras.main.flash(300, 255, 30, 30);
          this.cameras.main.shake(400, 0.01);
          break;
        case 'hit': {
          // counterhit: distinct red spark, a sharper layered crack, a harder
          // shake (the engine flags the reel; see applyHit)
          this.spawnHitVfx(e.slot, e.damage, e.counter);
          this.cameras.main.shake(e.counter ? 100 : 60, e.counter ? 0.006 : 0.004);
          // the counter anchors over the attacker
          this.comboText.setX(s.fighters[e.slot === 0 ? 1 : 0].x).setText(this.hudModel.comboLabel);
          break;
        }
        case 'block': {
          // icy shield ripple on the guarding side
          const f = s.fighters[e.slot];
          this.spawnVfx('vfx-spark-block', f.x + f.facing * 42, f.y - 130, 95, 0xa8c8ff, f.facing === 1);
          break;
        }
        case 'attack-start':
          this.logMove(e.slot);
          break;
        case 'dust': {
          // sandy cloud at the feet (airHit floor bounce / settling knockdown)
          const f = s.fighters[e.slot];
          this.spawnVfx('vfx-spark-hit', f.x, FLOOR_Y - 16, 95, 0xcbb894);
          break;
        }
      }
    }

    // attract demo loops back to the title once the win screen has had its beat
    if (this.demo && s.phase === 'matchEnd' && s.phaseFrame === 300) {
      this.shell.toMainMenu();
    }
  }

  // ---------- impact VFX (renderer-side; engine state is never touched) ----------

  /** Spawn an overlay sprite that grows and fades. Returns false when the
   *  texture never loaded (dev-server 404s) so callers can fall back. */
  private spawnVfx(key: string, x: number, y: number, size: number, tint?: number, flip = false): boolean {
    if (!this.textures.exists(key)) return false;
    const img = this.add.image(x, y, key).setDepth(4).setDisplaySize(size, size).setFlipX(flip);
    if (tint !== undefined) img.setTint(tint);
    this.vfx.push({ img, life: 14, max: 14, grow: size * 0.04 });
    return true;
  }

  /** Impact overlay for a connecting hit on `slot`: the attacker's per-move
   *  art when the move declares some (vfx-<char>-<move>), else a generic
   *  greyscale spark tinted the attacker's color — heavier contact, bigger
   *  spark. Counterhits override with a big sharp red burst. Falls back to
   *  the old flash circle if no texture loaded. */
  private spawnHitVfx(slot: 0 | 1, damage: number, counter = false): void {
    const s = this.state;
    const f = s.fighters[slot]; // defender
    const atk = s.fighters[slot === 0 ? 1 : 0];
    const atkDef = characters[atk.charId];
    const atkAction = atk.action;
    const atkMove =
      atkAction.kind === 'attack' || atkAction.kind === 'airAttack'
        ? atkDef.moves[atkAction.moveId!]
        : undefined;
    const ix = f.x - f.facing * 20;
    const iy = f.y - 150;

    if (counter) {
      if (this.spawnVfx('vfx-spark-heavy', ix, iy, 155, 0xff3b30, atk.facing === -1)) return;
      this.sparks.push({ x: ix, y: iy, life: 12, color: 0xff3b30 });
      return;
    }
    if (atkMove?.vfx) {
      const size = atkMove.vfx.size ?? 160;
      const onGround = atkMove.vfx.anchor === 'ground';
      if (this.spawnVfx(`vfx-${atk.charId}-${atkAction.moveId}`,
        onGround ? f.x : ix, onGround ? FLOOR_Y - size * 0.3 : iy, size, undefined, atk.facing === -1)) {
        return;
      }
    }
    // specials, heavy buttons, and meaty projectile damage earn the big burst
    const heavy = !!atkMove?.input || /h[pk]$/.test(atkAction.moveId ?? '') || damage >= 55;
    const tint = Phaser.Display.Color.HexStringToColor(atkDef.color).color;
    if (!this.spawnVfx(heavy ? 'vfx-spark-heavy' : 'vfx-spark-hit', ix, iy, heavy ? 135 : 90, tint)) {
      this.sparks.push({ x: ix, y: iy, life: 12, color: 0xfff06e });
    }
  }

  /** Raw-input ticker (shell MoveLogModel): what the engine registered. */
  private logInputs(frames: [InputFrame, InputFrame]): void {
    this.shell.logInputs(frames);
  }

  /** FIFO of triggered moves: "P1 Rising Glyph (H)" / "P2 cr.MK". */
  private logMove(slot: 0 | 1): void {
    this.shell.logMove(slot);
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
      case 'taunt': return this.cellFor(slot, ['taunt', 'win', 'idle-a']);
      case 'walkF':
      case 'walkB': return this.cellFor(slot, [(t >> 3) % 2 ? 'walk-b' : 'walk-a']);
      case 'crouch':
      case 'prejump':
      case 'landing':
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

  private shadowKey(charId: string, frame: number): string {
    return `shadow-${charId}-${frame}`;
  }

  private ensureShadowTexture(charId: string, frame: number): string | null {
    const key = this.shadowKey(charId, frame);
    if (this.textures.exists(key)) return key;

    const sheet = this.textures.get(`sheet-${charId}`);
    const src = sheet.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
    if (!src) return null;

    const cols = Math.max(1, Math.floor(src.width / CELL_W));
    const sx0 = (frame % cols) * CELL_W;
    const sy0 = Math.floor(frame / cols) * CELL_H;

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = CELL_W;
    srcCanvas.height = CELL_H;
    const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
    if (!srcCtx) return null;
    srcCtx.drawImage(src, sx0, sy0, CELL_W, CELL_H, 0, 0, CELL_W, CELL_H);
    const pixels = srcCtx.getImageData(0, 0, CELL_W, CELL_H).data;

    const weights = new Float32Array(SHADOW_W);
    for (let y = 0; y < CELL_H; y += 4) {
      const heightFromFeet = CELL_H - y;
      const yNorm = Phaser.Math.Clamp(heightFromFeet / CELL_H, 0.08, 1);
      const footBias = 1 - yNorm;
      for (let x = 0; x < CELL_W; x += 3) {
        const alpha = pixels[(y * CELL_W + x) * 4 + 3];
        if (alpha < 24) continue;
        const nx = (x - CELL_W / 2) / (CELL_W / 2);
        const spread = 0.72 + yNorm * 0.52;
        const center = Math.round(((nx * spread + 1) / 2) * (SHADOW_W - 1));
        const radius = 4 + Math.round(yNorm * 4.0 + footBias * 3.6);
        const amount = (alpha / 255) * (0.5 + yNorm * 0.85 + footBias * 0.75);
        for (let dx = -radius; dx <= radius; dx++) {
          const ix = center + dx;
          if (ix < 0 || ix >= SHADOW_W) continue;
          const falloff = 1 - Math.abs(dx) / (radius + 1);
          weights[ix] += amount * falloff * falloff;
        }
      }
    }

    let max = 0;
    for (const w of weights) max = Math.max(max, w);
    if (max <= 0) return null;

    const maskW = SHADOW_W + SHADOW_PAD * 2;
    const maskH = SHADOW_H + SHADOW_PAD * 2;
    const mask = document.createElement('canvas');
    mask.width = maskW;
    mask.height = maskH;
    const maskCtx = mask.getContext('2d');
    if (!maskCtx) return null;
    const out = document.createElement('canvas');
    out.width = maskW;
    out.height = maskH;
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    const img = maskCtx.createImageData(maskW, maskH);
    const cy = SHADOW_PAD + SHADOW_H * 0.56;
    for (let y = SHADOW_PAD; y < SHADOW_PAD + SHADOW_H; y++) {
      const dy = Math.abs((y - cy) / (SHADOW_H * 0.5));
      const rowSoft = Math.max(0, 1 - dy * dy);
      const rowTaper = Math.sqrt(rowSoft);
      for (let x = SHADOW_PAD; x < SHADOW_PAD + SHADOW_W; x++) {
        const sx = x - SHADOW_PAD;
        const nx = Math.abs((sx - SHADOW_W / 2) / (SHADOW_W / 2));
        const edgeSoft = Math.max(0, 1 - Math.pow(nx, 4) * 0.72);
        const col = weights[sx] / max;
        const soft =
          col * 0.55 +
          ((weights[Math.max(0, sx - 2)] + weights[Math.min(SHADOW_W - 1, sx + 2)]) / (max * 2)) * 0.28 +
          ((weights[Math.max(0, sx - 6)] + weights[Math.min(SHADOW_W - 1, sx + 6)]) / (max * 2)) * 0.17;
        const a = Math.round(250 * Math.min(1, soft) * rowSoft * rowTaper * edgeSoft);
        const i = (y * maskW + x) * 4;
        img.data[i] = 0;
        img.data[i + 1] = 0;
        img.data[i + 2] = 0;
        img.data[i + 3] = a;
      }
    }
    maskCtx.putImageData(img, 0, 0);
    ctx.filter = 'blur(8px)';
    ctx.drawImage(mask, 0, 0);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    for (let band = 0; band < 6; band++) {
      const y = CELL_H - 1 - band * 5;
      for (let x = 0; x < CELL_W; x += 4) {
        const alpha = pixels[(y * CELL_W + x) * 4 + 3];
        if (alpha < 44) continue;
        const nx = (x - CELL_W / 2) / (CELL_W / 2);
        const cx = SHADOW_PAD + ((nx * 0.9 + 1) / 2) * SHADOW_W;
        const cy2 = SHADOW_PAD + SHADOW_H * 0.58;
        ctx.beginPath();
        ctx.ellipse(cx, cy2, 4.2, 2.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    this.textures.addCanvas(key, out);
    return key;
  }

  private drawFighterShadow(slot: 0 | 1, f: FighterState, def: typeof characters[string], frame: number): void {
    const shadow = this.fighterShadows[slot];
    if (!shadow) {
      this.gfxUnder.fillStyle(0x000000, 0.35).fillEllipse(f.x, FLOOR_Y + 8, def.bodyBox.w * 1.6, 18);
      return;
    }
    const key = this.ensureShadowTexture(f.charId, frame);
    if (!key) {
      shadow.setVisible(false);
      this.gfxUnder.fillStyle(0x000000, 0.35).fillEllipse(f.x, FLOOR_Y + 8, def.bodyBox.w * 1.6, 18);
      return;
    }

    const k = f.action.kind;
    const air = f.y < FLOOR_Y || k === 'air' || k === 'airAttack' || k === 'airHit';
    const dist = Math.max(0, FLOOR_Y - f.y);
    const crouch = k === 'crouch' || k === 'landing' || f.action.guard === 'crouch' || (k === 'attack' && f.action.moveId?.startsWith('c'));
    const down = k === 'knockdown' || k === 'getup' || (k === 'ko' && f.y >= FLOOR_Y);
    const artW = (def.hurtStand.h * 1.32 * CELL_W) / CELL_H;
    const width = artW * (down ? 1.78 : crouch ? 1.58 : 1.5) * (air ? Math.max(0.6, 1 - dist / 460) : 1);
    const height = (down ? 39 : crouch ? 34 : 32) * (air ? Math.max(0.58, 1 - dist / 540) : 1);
    const alpha = (down ? 0.64 : 0.74) * (air ? Math.max(0.24, 1 - dist / 280) : 1);
    shadow
      .setTexture(key)
      .setVisible(alpha > 0.04)
      .setPosition(f.x, FLOOR_Y + 10)
      .setDisplaySize(width, height)
      .setAlpha(alpha)
      .setFlipX(f.facing === -1);
  }

  private draw(): void {
    const drawStart = performance.now();
    let sectionStart = drawStart;
    const perf = blankDrawPerf();
    const s = this.state;
    const gU = this.gfxUnder;
    gU.clear();
    this.gfxHud.clear();

    // animate impact overlays first (runs even during fatality/win screens so
    // stragglers finish fading instead of freezing under the cutscene)
    this.vfx = this.vfx.filter((v) => {
      v.life--;
      if (v.life <= 0) {
        v.img.destroy();
        return false;
      }
      const t = v.life / v.max;
      v.img.setAlpha(Math.min(1, t * 2.15));
      v.img.setDisplaySize(v.img.displayWidth + v.grow, v.img.displayHeight + v.grow);
      return true;
    });
    perf.vfx = performance.now() - sectionStart;
    sectionStart = performance.now();

    if (s.phase === 'fatality' && s.fatality) {
      for (const sh of this.fighterShadows) sh?.setVisible(false);
      for (const dz of this.dizzySprites) dz?.setVisible(false);
      this.drawFatality();
      perf.cutscene = performance.now() - sectionStart;
      perf.draw = performance.now() - drawStart;
      this.perfDraw = perf;
      return;
    }
    if (this.fatalityPanel) {
      this.fatalityPanel.setVisible(false);
    }

    // Post-match win-quote screen (shared DOM WinOverlay): after the K.O./
    // victory beat lands, the winner portrait taunts the beaten loser.
    this.winOverlay.sync(s); // shows past revealFrame, hides otherwise
    if (s.phase === 'matchEnd' && s.roundWinner !== null && s.phaseFrame > 72) {
      for (const sh of this.fighterShadows) sh?.setVisible(false);
      for (const dz of this.dizzySprites) dz?.setVisible(false);
      perf.cutscene = performance.now() - sectionStart;
      perf.draw = performance.now() - drawStart;
      this.perfDraw = perf;
      return;
    }

    if (!this.hasBg) {
      gU.fillStyle(0x241b2e, 1).fillRect(0, 0, STAGE_W, STAGE_H);
      gU.fillStyle(0x3a2b40, 1).fillRect(0, FLOOR_Y, STAGE_W, STAGE_H - FLOOR_Y);
      gU.lineStyle(2, 0x594566, 1).lineBetween(0, FLOOR_Y, STAGE_W, FLOOR_Y);
    }

    // SF2-style parallax: backgrounds slide opposite the fighters' midpoint.
    // Layered stages use smaller factors for farther art.
    if (this.bgLayers.length > 0) {
      const mid = (s.fighters[0].x + s.fighters[1].x) / 2;
      const t = Phaser.Math.Clamp((mid - STAGE_W / 2) / (STAGE_W / 2), -1, 1);
      for (const layer of this.bgLayers) {
        layer.img.setX(STAGE_W / 2 - t * layer.overhang * layer.factor);
      }
    } else if (this.bg && this.bgOverhang > 0) {
      const mid = (s.fighters[0].x + s.fighters[1].x) / 2;
      const t = Phaser.Math.Clamp((mid - STAGE_W / 2) / (STAGE_W / 2), -1, 1);
      this.bg.setX(STAGE_W / 2 - t * this.bgOverhang);
    }
    perf.world = performance.now() - sectionStart;
    sectionStart = performance.now();

    for (const slot of [0, 1] as const) {
      const f = s.fighters[slot];
      const def = characters[f.charId];

      // circling dizzy stars over a dazed fighter's head (fight-phase dizzy
      // and the finisher-window daze both read as "helpless")
      if (f.action.kind === 'dazed' && this.textures.exists('vfx-dizzy')) {
        let dz = this.dizzySprites[slot];
        if (!dz) {
          dz = this.add.image(0, 0, 'vfx-dizzy').setDepth(4);
          this.dizzySprites[slot] = dz;
        }
        dz.setVisible(true)
          .setPosition(f.x, f.y - def.hurtStand.h - 22 + Math.sin(s.tick / 7) * 3)
          .setDisplaySize(120, 72)
          .setFlipX(((s.tick >> 4) & 1) === 1); // cheap orbit shimmer
      } else {
        this.dizzySprites[slot]?.setVisible(false);
      }

      const sprite = this.fighterSprites[slot];
      if (sprite) {
        const flash = this.hitFlashSprites[slot];
        sprite.setVisible(true);
        const h = def.hurtStand.h * 1.32; // art has margin around the body
        sprite.setDisplaySize((h * CELL_W) / CELL_H, h);
        sprite.setPosition(f.x, f.y + SPRITE_FOOT_OFFSET_Y + (def.spriteOffsetY ?? 0));
        sprite.setFlipX(f.facing === -1);
        sprite.setRotation(0);
        const frame = this.actionToCell(slot, f);
        this.drawFighterShadow(slot, f, def, frame);
        sprite.setFrame(frame);
        if (flash) {
          flash
            .setVisible(false)
            .setDisplaySize(sprite.displayWidth, sprite.displayHeight)
            .setPosition(sprite.x, sprite.y)
            .setFlipX(sprite.flipX)
            .setRotation(sprite.rotation)
            .setFrame(frame);
        }
        const k = f.action.kind;
        const mirrorTint = this.chars[0] === this.chars[1] && slot === 1 ? 0xffb0a0 : undefined;
        if (k === 'hitstun' || (k === 'airHit' && f.action.frame < 6)) {
          sprite.clearTint();
          flash?.setVisible(true);
        }
        else if (k === 'blockstun') sprite.setTint(0xaaaaff);
        else if (k === 'dazed') {
          sprite.setTint(0x776677);
          sprite.setRotation(Math.sin(this.state.tick / 9) * 0.05); // woozy sway
        } else if (k === 'ko' || k === 'knockdown') sprite.setTint(0x9a9a9a);
        else if (mirrorTint) sprite.setTint(mirrorTint);
        else sprite.clearTint();
      } else {
        this.fighterShadows[slot]?.setVisible(false);
        gU.fillStyle(0x000000, 0.35).fillEllipse(f.x, FLOOR_Y + 8, def.bodyBox.w * 1.6, 18);
        this.drawCapsule(slot);
      }
    }
    perf.fighters = performance.now() - sectionStart;
    sectionStart = performance.now();

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
        const feet = PROJ_FEET_ANCHORED.has(p.moveId);
        img.setOrigin(0.5, feet ? 1 : 0.5);
        img.setVisible(true)
          .setPosition(p.x, feet ? p.y + SPRITE_FOOT_OFFSET_Y : p.y)
          .setDisplaySize(size, size);
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
    perf.projectiles = performance.now() - sectionStart;
    sectionStart = performance.now();

    this.sparks = this.sparks.filter((sp) => --sp.life > 0);
    for (const sp of this.sparks) {
      this.gfxHud.fillStyle(sp.color, sp.life / 12).fillCircle(sp.x, sp.y, 26 - sp.life);
    }
    perf.sparks = performance.now() - sectionStart;
    sectionStart = performance.now();

    this.comboText.setVisible(this.hudModel.comboLabel !== '');
    this.comboText.setAlpha(this.hudModel.comboAlpha);

    if (this.stageGuide) this.drawStageGuide();
    else for (const t of this.stageGuideTexts) t.setVisible(false);
    if (this.debugBoxes) this.drawDebug();
    perf.debug = performance.now() - sectionStart;
    sectionStart = performance.now();
    this.drawHud();
    perf.hud = performance.now() - sectionStart;
    perf.draw = performance.now() - drawStart;
    this.perfDraw = perf;
  }

  private recordPerf(sample: PerfFrameSample): void {
    this.perfSamples.push(sample);
    if (this.perfSamples.length > 45) this.perfSamples.shift();
    if (!this.perfOn || this.perfSamples.length === 0) return;

    const avg = (key: keyof PerfFrameSample) =>
      this.perfSamples.reduce((sum, s) => sum + s[key], 0) / this.perfSamples.length;
    const max = (key: keyof PerfFrameSample) =>
      this.perfSamples.reduce((hi, s) => Math.max(hi, s[key]), 0);
    const fps = this.game.loop.actualFps;
    this.perfText.setText([
      `FPS ${fps.toFixed(1)}   frame ${avg('frame').toFixed(2)}ms avg / ${max('frame').toFixed(2)} max`,
      `ticks/frame ${avg('ticks').toFixed(2)}   sim ${avg('sim').toFixed(2)}ms`,
      `  engine ${avg('tick').toFixed(2)}   present ${avg('present').toFixed(2)}`,
      `draw ${avg('draw').toFixed(2)}ms`,
      `  vfx ${avg('vfx').toFixed(2)}   world ${avg('world').toFixed(2)}   fighters ${avg('fighters').toFixed(2)}`,
      `  projectiles ${avg('projectiles').toFixed(2)}   sparks ${avg('sparks').toFixed(2)}   hud ${avg('hud').toFixed(2)}`,
      `  debug ${avg('debug').toFixed(2)}   cutscene ${avg('cutscene').toFixed(2)}`,
    ].join('\n'));
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
    for (const sp of this.hitFlashSprites) sp?.setVisible(false);
    for (const sp of this.fighterShadows) sp?.setVisible(false);
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

  private drawStageGuide(): void {
    const g = this.gfxHud;
    const y = (stageY: number) => (stageY / 720) * STAGE_H;
    const horizon = y(260);
    const horizonMax = y(310);
    const floorStart = y(500);
    const clearTop = y(560);
    const foot = y(613);
    const clearBottom = y(700);
    const vanishing = { x: STAGE_W / 2, y: horizon };

    g.fillStyle(0x1f6fff, 0.09).fillRect(0, 0, STAGE_W, horizonMax);
    g.fillStyle(0xffd166, 0.08).fillRect(0, floorStart, STAGE_W, STAGE_H - floorStart);
    g.fillStyle(0xff5a48, 0.11).fillRect(0, clearTop, STAGE_W, clearBottom - clearTop);

    g.lineStyle(2, 0x9cc7ff, 0.95).lineBetween(0, horizon, STAGE_W, horizon);
    g.lineStyle(1, 0x9cc7ff, 0.7).lineBetween(0, horizonMax, STAGE_W, horizonMax);
    g.lineStyle(2, 0xffd166, 0.95).lineBetween(0, floorStart, STAGE_W, floorStart);
    g.lineStyle(4, 0xffffff, 0.95).lineBetween(0, foot, STAGE_W, foot);
    g.lineStyle(1, 0xff8a5c, 0.75).lineBetween(0, clearTop, STAGE_W, clearTop);
    g.lineStyle(1, 0xff8a5c, 0.75).lineBetween(0, clearBottom, STAGE_W, clearBottom);

    g.lineStyle(1, 0xffd166, 0.45);
    for (const x of [70, 250, STAGE_W / 2, STAGE_W - 250, STAGE_W - 70]) {
      g.lineBetween(x, STAGE_H, vanishing.x + (x - STAGE_W / 2) * 0.16, vanishing.y);
    }

    g.fillStyle(0x05070c, 0.72).fillRoundedRect(STAGE_W - 246, 88, 230, 78, 6);
    for (const t of this.stageGuideTexts) t.setVisible(true);
  }

  private drawHud(): void {
    const g = this.gfxHud;
    const s = this.state;
    for (const slot of [0, 1] as const) {
      const f = s.fighters[slot];
      const def = characters[f.charId];
      const ratio = Math.max(0, f.health / def.health);
      const x = slot === 0 ? BAR_X1 : STAGE_W - BAR_X1 - BAR_W;
      const px = slot === 0 ? 68 : STAGE_W - 68;
      // portrait background uses the same character color source as impact sparks
      const accent = Phaser.Display.Color.HexStringToColor(def.color).color;
      const deep = mixColor(accent, 0x05030a, 0.82);
      const glow = mixColor(accent, 0x000000, 0.24);
      if (slot === 0) {
        g.fillGradientStyle(glow, deep, accent, deep, 1, 1, 1, 1);
      } else {
        g.fillGradientStyle(deep, glow, deep, accent, 1, 1, 1, 1);
      }
      g.fillRect(px - 25, 21, 50, 50);
      g.lineStyle(2, 0x594566, 1).strokeRect(px - 25, 21, 50, 50);
      g.fillStyle(0x14101a, 0.9).fillRect(x - 2, 26, BAR_W + 4, 22);
      // SF2 ghost bar: recently lost health lingers in red behind the live
      // bar, then drains toward it (bookkeeping lives in the shared HudModel)
      const ghostW = BAR_W * Math.max(0, this.hudModel.ghost[slot] / def.health);
      g.fillStyle(0xb3271b, 1).fillRect(slot === 0 ? x + BAR_W - ghostW : x, 28, ghostW, 18);
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
        return `${name} WINS${fatal}\nENTER / attack continue · R rematch · ESC / SELECT menu`;
      }
      default:
        return '';
    }
  }

}
