// Renders engine state and plays presentation (sprites, HUD, audio). All
// audio/vfx are derived by diffing engine state before/after each tick —
// the deterministic core in src/engine/ stays pure and silent.
import Phaser from 'phaser';
import {
  Box,
  FATALITY_TICKS,
  FLOOR_Y,
  InputFrame,
  GameState,
  INTRO_TICKS,
  STAGE_W,
  STAGE_H,
  FighterState,
  initialState,
  mirrorTeleportPhases,
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
import { DIFFICULTIES, DIFFICULTY_AGGRESSION, type Difficulty } from '../ai/difficulty';
import { MoveTunerPanel } from '../ui/MoveTunerPanel';
import { SpriteEditorPanel } from '../ui/SpriteEditorPanel';
import { CharacterCreatorPanel } from '../ui/CharacterCreatorPanel';
import { StagesPanel } from '../ui/StagesPanel';
import { StudioRail } from '../ui/StudioRail';
import { SpriteSheetModel, type SheetMeta } from '../ui/spriteSheetModel';
import { play, playVoice, runCues } from './BootScene';
import { AssetLoader } from './assetLoader';
import { queueFighterSprite, queueFighterVO, queueStage } from './assetQueue';
import { playMusic } from '../audio/music';
import { getSettings } from '../settings';
import { diffTick, snapTick, type FightEvent, type TickSnap } from '../presentation/tickEvents';
import { soundCues } from '../presentation/soundDirector';
import { HudModel } from '../presentation/hudModel';
import { UiLayer } from '../ui/layer';
import { WinOverlay } from '../ui/WinOverlay';
import { FightShell } from './fightShell';
import { ART_MARGIN, CELL_H, CELL_W, FLOOR_FRAC, ORIGIN_CX, ORIGIN_FEET, SPRITE_FOOT_OFFSET_Y } from '../render/coords';
import * as geom from '../render/geometry';

// Cells are looked up BY NAME from each sheet's meta.json (written by
// tools/pack-sheet.mjs), so v2 six-button sheets and legacy 23-cell sheets
// coexist. Legacy sheets fall back: new buttons borrow the nearest old art.
/** Round ended by the clock (never true when the round clock is off). */
const timedOut = (s: GameState): boolean => s.rules.roundTicks > 0 && s.timer <= 0;

// CELL_W/CELL_H/FLOOR_FRAC/SPRITE_FOOT_OFFSET_Y now come from src/render/coords
// (the single source shared with SelectScene, the editors, and tools/qa).
const SHADOW_W = 96;
const SHADOW_H = 36;
const SHADOW_PAD = 8;
const PHASE_NAME = ['startup', 'active', 'recovery'] as const;
// per-special projectile draw size (square px); default 72
const PROJ_SIZE: Record<string, number> = {
  'order-up': 96, // Jazzper is a whole dog
  'sigil-bolt': 112, // Vincent's glyphs — read as a real rune, not a dot
  'fork-bomb': 104, // Flo's tumbling laptop is a whole laptop
  'fork-bomb-burst': 170,
  smokescreen: 150, // "Flame War" — a short Yoga-Flame burst (was a big smoke field)
  'root-access': 120,
  'sudo-kill': 90,
  'pop-tab-chain': 104, // Rapha's flung chain
  overgrowth: 48,
  'overgrowth-burst': 200,
  'spore-bloom': 130,
  hallucination: 300,
  'hallucination-burst': 170,
  'rate-limit': 150, // "Line Goes Up" — a short rising candle burst (was a slow field)
  'flour-bomb': 210,
  'thread-of-life': 92,
};
// projectiles that depict a grounded figure: engine y is their FEET (spawnY 0,
// box extends upward), so draw bottom-anchored instead of centered — a
// centered clone renders half-buried below the floor
const PROJ_FEET_ANCHORED = new Set(['hallucination', 'hallucination-burst', 'flour-bomb']);
// render-only vertical nudge (px, negative = up) — the hitbox stays put.
// Flo's Flame War should look like it roars out of his MOUTH, not his chest.
const PROJ_RENDER_OFFSET_Y: Record<string, number> = {
  smokescreen: -125, // lift the flame's origin to mouth/head height
};
const LEGACY_BUTTON: Record<string, string> = {
  lp: 'light', mp: 'light', hp: 'heavy', lk: 'light', mk: 'heavy', hk: 'heavy',
};

const BAR_W = 320;
const BAR_X1 = 100;
// shared vertical center of the name / side-tag / round-win-pip row; sits so the
// row's bottom lands on the portrait icon's lower edge (icon frame spans y=21..72)
const HUD_NAME_Y = 63;
// matchEnd ticks the "<NAME> WINS" beat holds over the frozen fight before the
// win-quote screen takes over — 2s at 60 ticks/sec (fits the "<NAME>… WINS!"
// announcer callout with a breath after)
const WIN_REVEAL_FRAME = 120;
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
  /** persistent HUD GameObjects (portraits/names/tags/timer/hint) — hidden in
   *  spriteEditor mode, which wants a clean canvas */
  private hudEls: Phaser.GameObjects.GameObject[] = [];
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
  /** index -> cell name, the inverse of cellMaps — lets drawSkeleton() know
   *  which cell is currently showing without re-deriving it */
  private cellNames: [string[], string[]] = [[], []];
  /** F3 skeleton overlay: DWPose keypoints baked into meta.json at pack time
   *  (tools/pack-sheet.mjs, from tools/qa/pose_qa.py's report.json) — absent
   *  for characters not yet repacked with that data (graceful no-op) */
  private skeletons: [Record<string, Record<string, [number, number, number]>> | undefined, Record<string, Record<string, [number, number, number]>> | undefined] = [undefined, undefined];
  private showSkeleton = false;
  /** the cell name currently resolved for each slot's sprite this frame —
   *  set alongside sprite.setFrame(), read by drawSkeleton() */
  private currentCellName: [string | null, string | null] = [null, null];
  /** shared DOM chrome layer + the fight shell (pause/keys/nav/pad/log) */
  private uiLayer!: UiLayer;
  private shell!: FightShell;
  private cpu = false;
  private training = false;
  private demo = false;
  private showcase = false;
  private tuner = false;
  private spriteEditor = false;
  /** dev-only Character Studio: module rail over the live fight (WYSIWYG) */
  private studio = false;
  private studioModule: string | undefined;
  private studioRail: StudioRail | null = null;
  /** sprite-editor working sheet model (edits mirror onto the fighter live) */
  private sheetModel: SpriteSheetModel | null = null;
  private spritePanel: SpriteEditorPanel | null = null;
  /** sprite-editor: the move whose hitbox is drawn faint/active + draggable */
  private editorMoveId: string | null = null;
  /** sprite-editor loop control: current looped move/pose, cadence, pause */
  private editorLoopMove = '__idle__';
  private editorLoopTicks = 24;
  private editorLoopPaused = false;
  private showHitbox = false;
  /** [p1 driver, p2 driver] — null means that slot is human/manual */
  private bots: [CpuDriver | null, CpuDriver | null] = [null, null];
  /** move-tuner: which mode setControlMode last put each slot in — used to
   *  let directional keys still nudge a loop-mode fighter for positioning
   *  (see pollSlot) */
  private controlMode: ['manual' | 'cpu' | 'loop', 'manual' | 'cpu' | 'loop'] = ['manual', 'manual'];
  private tunerPanel: MoveTunerPanel | null = null;
  /** move-tuner: freeze ticks the instant a held slot's move reaches its
   *  first active frame (see setHoldActive / afterTick) */
  private holdActiveSlots: [boolean, boolean] = [false, false];
  private tunerFrozen = false;
  /** move-tuner: a soft (non-live) hitbox marker shown while a move's
   *  parameters are expanded in the inspector, so it can be dialed in without
   *  actually firing the move over and over (see setPreviewBox) */
  private previewBox: { slot: 0 | 1; box: Box } | null = null;
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
    /** showcase demo: both bots walk their full moveset + guaranteed fatality */
    showcase?: boolean;
    stage?: string;
    online?: OnlineFightData;
    /** dev-only move tuner: mounts the inspector sidebar, runtime-swappable
     *  per-slot control modes (see setControlMode) */
    tuner?: boolean;
    /** dev-only sprite editor: single-character sheet/hitbox/skeleton editor */
    spriteEditor?: boolean;
    /** dev-only Character Studio: the collapsible module rail hosting the
     *  Sprite Editor + Move Tuner (and later the creator modules) over the
     *  live fight scene — the WYSIWYG shell (docs/CHARACTER_STUDIO.md §2.1) */
    studio?: boolean;
    /** studio deep link: which module opens active ('sprites' | 'moves') */
    module?: string;
  }): void {
    this.studio = !this.online && !!data.studio;
    this.studioModule = data.module;
    this.spriteEditor = !this.online && !!data.spriteEditor;
    // sprite editor edits ONE fighter; mirror it into both slots so the loop
    // driver has a valid (hidden) opponent to face
    const p1 = data.p1 ?? 'vincent';
    this.chars = [p1, this.spriteEditor ? p1 : data.p2 ?? 'yulia'];
    this.stageId = data.stage ?? 'salton';
    this.online = data.online ?? null;
    // online is strictly 2-human: no CPU, no demo, no training upkeep
    this.cpu = !this.online && !!data.cpu;
    // sprite editor + studio ride the training sandbox (health regen, no round end)
    this.training = !this.online && (!!data.training || this.spriteEditor || this.studio);
    // showcase is a chosen CPU-vs-CPU demo — both sides are (showcase) bots
    this.showcase = !this.online && !!data.showcase;
    this.demo = !this.online && (!!data.demo || this.showcase);
    this.tuner = !this.online && !!data.tuner;
    this.net = null;
    this.netIssue = null;
    // demo/attract mode: randomize CPU difficulty per side (also the
    // mechanism a future arcade difficulty-select would drive); a plain
    // human-vs-CPU match keeps the original fixed aggression
    const randomAgg = () => DIFFICULTY_AGGRESSION[DIFFICULTIES[Math.floor(Math.random() * DIFFICULTIES.length)]];
    this.bots = [
      this.demo ? new CpuDriver(0, randomAgg(), this.showcase) : null,
      this.cpu || this.demo ? new CpuDriver(1, this.demo ? randomAgg() : 1, this.showcase) : null,
    ];
    this.fatalityPanel = null;
    this.lastDamageTick = [0, 0];
    this.stageGuide = false;
  }

  /** Hard barrier for the lazy fight assets: queue the two fighters' sheets/VO
   *  and the stage. Phaser blocks create() until these load. On the normal
   *  Select→Versus path the VS screen already warmed them, so nothing is queued
   *  and this is instant; on cold entries (dev launch, Studio TEST, arcade,
   *  online-direct) it's the safety net that keeps the fight off capsules. */
  preload(): void {
    for (const id of new Set(this.chars)) {
      queueFighterSprite(this, id);
      queueFighterVO(this, id);
    }
    queueStage(this, this.stageId);
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
        : {
            roundTicks: cfg.roundSeconds * 60,
            // showcase is a single round that ends in the fatality
            winsNeeded: this.showcase ? 1 : cfg.winsNeeded,
          },
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
      inputs: (s: GameState): [InputFrame, InputFrame] => [this.pollSlot(s, 0), this.pollSlot(s, 1)],
      afterTick: (s: GameState, inp: [InputFrame, InputFrame]) => {
        if (this.training) this.trainingUpkeep();
        if (this.tuner) this.tunerHoldUpkeep(s);
        if (this.spriteEditor) this.spriteEditorUpkeep();
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
    this.hudEls = [];
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
      showcase: this.showcase,
      tuner: this.tuner,
      spriteEditor: this.spriteEditor,
      studio: this.studio,
      module: this.studioModule,
      render3d: false,
      state: () => this.state,
      debugKeys: [
        { key: 'F1', act: () => (this.debugBoxes = !this.debugBoxes) },
        { key: 'F3', act: () => (this.showSkeleton = !this.showSkeleton) },
        { key: 'F5', act: () => (this.stageGuide = !this.stageGuide) },
      ],
      pauseHint:
        'ESC/START resume · ◄► choose, attack confirms · F1 hitboxes · F2 move log · F3 skeleton · F5 stage guide · ` perf',
    });
    this.winOverlay = new WinOverlay(this.uiLayer.root, characters, {
      revealFrame: WIN_REVEAL_FRAME, // the "<NAME> WINS" beat lands + breathes first
      prompt: this.online ? 'R  REMATCH   ·   ESC  QUIT' : 'R  REMATCH   ·   ENTER  SELECT',
      onFirstShow: (id) => playVoice(this, id, 'victory', 0.85),
    });
    this.tunerPanel = null;
    if (this.tuner) {
      this.debugBoxes = true; // hitbox edits should be visible immediately
      this.tunerPanel = new MoveTunerPanel(this.uiLayer.root, characters, this.chars, this);
    }
    this.sparks = [];
    this.vfx = []; // scene.restart destroyed the old images with the scene
    this.dizzySprites = [null, null];
    this.perfOn = false;
    this.hudModel = new HudModel(characters, this.chars);

    // per-stage fight music; a rematch on the same stage keeps the track going
    playMusic([`stages/${this.stageId}`, 'stages/default']);

    // Lazy fatality panels: not needed until FINISH HIM at match end, so pull
    // both fighters' cutscene art in the BACKGROUND now, during the fight — the
    // download is done long before a KO. Missing panels degrade gracefully.
    for (const id of new Set(this.chars)) void AssetLoader.fatality(this, id);

    // 'wireframe' is the studio's dev stage TEMPLATE: no art, a sparse
    // programmatic grid (horizon / floor plane / posts) so a character under
    // construction stands in a neutral, honest space. Never in the registry.
    if (this.stageId === 'wireframe') this.drawWireframeStage();

    // Stage art keeps its native aspect at full screen height; anything wider
    // than the screen (ultra-wide 21:9 stages) becomes parallax travel.
    const bgKey = this.stageId === 'wireframe'
      ? null
      : this.textures.exists(`bg-stage-${this.stageId}`)
      ? `bg-stage-${this.stageId}`
      : this.textures.exists('bg-salton') ? 'bg-salton' : null;
    // the wireframe template IS a background — without this the !hasBg
    // fallback paints its opaque purple field over the grid every frame
    this.hasBg = bgKey !== null || this.stageId === 'wireframe';
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
      const meta = this.cache.json.get(`meta-${id}`) as
        | { frames?: string[]; skeletons?: Record<string, Record<string, [number, number, number]>> }
        | undefined;
      this.cellMaps[slot] = new Map((meta?.frames ?? []).map((n, i) => [n, i]));
      this.cellNames[slot] = meta?.frames ?? [];
      this.skeletons[slot] = meta?.skeletons;
      if (this.textures.exists(`sheet-${id}`)) {
        this.fighterShadows[slot] = this.add.image(0, 0, '__DEFAULT').setOrigin(0.5).setDepth(1.5).setVisible(false);
        this.fighterSprites[slot] = this.add.sprite(0, 0, `sheet-${id}`, 0).setOrigin(0.5, FLOOR_FRAC).setDepth(2);
        this.hitFlashSprites[slot] = this.add
          .sprite(0, 0, `sheet-${id}`, 0)
          .setOrigin(0.5, FLOOR_FRAC)
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
        this.hudEls.push(this.add.image(px, 46, `portrait-${id}`).setDisplaySize(48, 48).setDepth(6).setFlipX(slot === 1));
        this.gfxHud; // portraits framed in drawHud
      }
    }
    // mirror-match: tint P2 so the twins are tellable-apart (skipped in the
    // sprite editor, where slot 1 is a hidden loop-driver opponent)
    if (this.chars[0] === this.chars[1] && !this.spriteEditor) this.fighterSprites[1]?.setTint(0xffb0a0);

    this.sheetModel = null;
    this.spritePanel = null;
    this.studioRail = null;
    if (this.spriteEditor) this.setupSpriteEditor();

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
    // name / side-tag / win-pip row: all three share the vertical center
    // HUD_NAME_Y so they read as one clean line whose bottom meets the portrait
    // icon. Names justify to the bar's OUTSIDE edge (away from center); the
    // P1/P2/CPU tag tucks just inside the round-win pips (toward center).
    const nameStyle = { ...font, fontSize: '14px', stroke: '#000', strokeThickness: 3 };
    this.hudEls.push(
      this.add.text(BAR_X1, HUD_NAME_Y, characters[this.chars[0]].name, nameStyle).setOrigin(0, 0.5).setDepth(6),
      this.add.text(STAGE_W - BAR_X1, HUD_NAME_Y, characters[this.chars[1]].name, nameStyle).setOrigin(1, 0.5).setDepth(6),
      this.add.text(BAR_X1 + BAR_W + 8, HUD_NAME_Y, this.playerLabel(0), nameStyle).setOrigin(0, 0.5).setDepth(6),
      this.add.text(STAGE_W - BAR_X1 - BAR_W - 8, HUD_NAME_Y, this.playerLabel(1), nameStyle).setOrigin(1, 0.5).setDepth(6),
      this.add
        .text(STAGE_W / 2, STAGE_H - 14, 'P1: WASD + RTY punches FGH kicks   P2: ARROWS + UIO punches JKL kicks   ESC pause · F2 move log · F3 stage · ` perf', {
          ...font, fontSize: '12px', color: '#e8dcc8', stroke: '#000', strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(6),
    );
    // sprite editor wants a clean canvas — no health bars/timer/portraits/names
    if (this.spriteEditor) this.setHudVisible(false);
    if (this.studio) this.setupStudio();

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
        .text(STAGE_W / 2, 84, this.studio ? 'CHARACTER STUDIO' : this.spriteEditor ? 'SPRITE EDITOR' : this.tuner ? 'MOVE TUNER' : 'TRAINING · ENTER to leave', {
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
    // move-tuner "hold at active": stop ticking, but keep drawing/pacing sane
    // so it doesn't try to catch up a backlog of ticks the instant it's released
    if (this.tuner && this.tunerFrozen) {
      this.session.resetPacing();
      this.draw();
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
            // real matches fade on to char select a couple seconds past the
            // theme; demo/showcase loop on their own phaseFrame timer below
            if (this.demo || this.state.phase !== 'matchEnd') return;
            this.time.delayedCall(2000, () => this.fadeOutToNext());
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

    // once the demo win screen has had its beat: idle attract exits to the
    // title; a menu-chosen CPU-vs-CPU showcase returns to the CPU-vs-CPU select
    // so you can pick another matchup to watch
    if (this.demo && s.phase === 'matchEnd' && s.phaseFrame === 300) {
      if (this.showcase) this.fadeOutToNext();
      else this.shell.toMainMenu();
    }
  }

  /** Win-quote screen is done breathing: fade a black curtain over the shell,
   *  then advance to character select. A menu-chosen CPU-vs-CPU showcase rides
   *  back to the CPU-vs-CPU select (toCharacterSelect carries `showcase`), so you
   *  pick a new matchup to watch; a real match returns to the normal select. The
   *  destination fades its camera in for a cross-fade. No-op if already skipped. */
  private fadeOutToNext(): void {
    if (this.state.phase !== 'matchEnd') return;
    const curtain = document.createElement('div');
    curtain.style.cssText =
      'position:absolute;inset:0;background:#000;opacity:0;z-index:9;pointer-events:none;' +
      'transition:opacity 700ms ease;';
    this.uiLayer.root.appendChild(curtain);
    requestAnimationFrame(() => (curtain.style.opacity = '1'));
    this.time.delayedCall(720, () => this.shell.toCharacterSelect());
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

  /** move-tuner "hold at active": the instant a held slot's attack reaches
   *  its first active frame, freeze the whole sim (update() stops ticking)
   *  so the active hitbox can be inspected at rest. Checking `=== startup`
   *  (not the whole active window) means resuming doesn't instantly re-trip
   *  it on the very next tick. */
  private tunerHoldUpkeep(s: GameState): void {
    if (this.tunerFrozen) return;
    for (const slot of [0, 1] as const) {
      if (!this.holdActiveSlots[slot]) continue;
      const f = s.fighters[slot];
      const a = f.action;
      if (a.kind !== 'attack' && a.kind !== 'airAttack') continue;
      const def = characters[f.charId];
      const move = def.moves[a.moveId!];
      if (!move) continue;
      const m = resolveMove(move, a.strength);
      if (a.frame === m.startup) {
        this.tunerFrozen = true;
        return;
      }
    }
  }

  /** move-tuner: freeze/unfreeze the whole-hold toggle for a side */
  setHoldActive(slot: 0 | 1, on: boolean): void {
    this.holdActiveSlots[slot] = on;
    if (!on) this.tunerFrozen = false;
  }

  /** move-tuner: soft (non-live) hitbox marker for the move currently
   *  expanded in the inspector — drawn every frame regardless of whether
   *  the move is actually firing (see drawDebug) */
  setPreviewBox(slot: 0 | 1, box: Box | null): void {
    this.previewBox = box ? { slot, box } : null;
  }

  /** the move's ACTIVE-cell baked skeleton (editor working model wins over
   *  the meta bake, so fresh regens/joint drags are what you anchor to) */
  private moveActiveJoints(slot: 0 | 1, moveId: string): Record<string, [number, number, number]> | undefined {
    for (const cell of [`${moveId}-active`, moveId]) {
      const j = this.editorJoints(cell) ?? this.skeletons[slot]?.[cell];
      if (j) return j;
    }
    return undefined;
  }

  /** TunerHost: joint names available on a move's active cell */
  jointNamesFor(slot: 0 | 1, moveId: string): string[] {
    const j = this.moveActiveJoints(slot, moveId);
    // body joints only — the per-finger/face points are noise in a dropdown
    return j ? Object.keys(j).filter((n) => !/^(face|lhand|rhand)_/.test(n)) : [];
  }

  /** TunerHost: a joint's engine-space offset from the fighter origin — the
   *  projectile spawn anchor ("spawn from the wrist", not a guessed number).
   *  Cell space → engine via the RENDER scale (src/render/geometry). */
  spawnFromJoint(slot: 0 | 1, moveId: string, joint: string): { x: number; y: number } | null {
    const j = this.moveActiveJoints(slot, moveId)?.[joint];
    if (!j) return null;
    const def = characters[this.chars[slot]];
    const rs = geom.renderScale(def);
    return {
      x: Math.round((j[0] - ORIGIN_CX) * rs),
      y: Math.round((j[1] - ORIGIN_FEET) * rs + geom.footOffset(def)),
    };
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
        const base = characters[f.charId].moves[a.moveId!];
        const m = resolveMove(base, a.strength);
        let phase: 0 | 1 | 2;
        if (base.teleport?.mirror) {
          // Mirrored teleport (Matrix Teleport): the startup/active/recovery
          // cells play once on the origin side, the fighter blinks exactly
          // at `half` (see mirrorTeleportPhases / step.ts), then the SAME
          // three cells replay reversed on the destination side — a
          // dissolve/blink/re-form palindrome with no extra art.
          const { subStartup, subActive, subRecovery, half } = mirrorTeleportPhases(m);
          const t = a.frame;
          if (t < subStartup) phase = 0;
          else if (t < subStartup + subActive) phase = 1;
          else if (t < half + subRecovery) phase = 2; // spans both sides of the blink
          else if (t < half + subRecovery + subActive) phase = 1;
          else phase = 0;
        } else {
          phase = a.frame < m.startup ? 0 : a.frame < m.startup + m.active ? 1 : 2;
          // Portal teleport: the blink lands her on the far side at the first
          // active frame. Play the post-blink cells in REVERSE so she reads as
          // re-forming OUT of the portal (startup = summon/enter on the origin
          // side, then recovery→active as she resolidifies on the far side).
          if (base.teleport && phase >= 1) phase = (3 - phase) as 1 | 2;
        }
        return this.cellFor(slot, this.attackCells(f.charId, a.moveId!, phase));
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

  // Shadow anchor: with the roster floor-normalized (feet exactly on FLOOR_Y,
  // Sprint 27 Phase 2) shadows hug the soles — the old +8/+10 offsets were
  // tuned for art that drew below the line and read too low afterwards.
  private drawFighterShadow(slot: 0 | 1, f: FighterState, def: typeof characters[string], frame: number): void {
    const shadow = this.fighterShadows[slot];
    if (!shadow) {
      this.gfxUnder.fillStyle(0x000000, 0.35).fillEllipse(f.x, FLOOR_Y + 2, def.bodyBox.w * 1.6, 18);
      return;
    }
    const key = this.ensureShadowTexture(f.charId, frame);
    if (!key) {
      shadow.setVisible(false);
      this.gfxUnder.fillStyle(0x000000, 0.35).fillEllipse(f.x, FLOOR_Y + 2, def.bodyBox.w * 1.6, 18);
      return;
    }

    const k = f.action.kind;
    const air = f.y < FLOOR_Y || k === 'air' || k === 'airAttack' || k === 'airHit';
    const dist = Math.max(0, FLOOR_Y - f.y);
    const crouch = k === 'crouch' || k === 'landing' || f.action.guard === 'crouch' || (k === 'attack' && f.action.moveId?.startsWith('c'));
    const down = k === 'knockdown' || k === 'getup' || (k === 'ko' && f.y >= FLOOR_Y);
    const artW = geom.renderScale(def) * CELL_W;
    const width = artW * (down ? 1.78 : crouch ? 1.58 : 1.5) * (air ? Math.max(0.6, 1 - dist / 460) : 1);
    const height = (down ? 39 : crouch ? 34 : 32) * (air ? Math.max(0.58, 1 - dist / 540) : 1);
    const alpha = (down ? 0.64 : 0.74) * (air ? Math.max(0.24, 1 - dist / 280) : 1);
    shadow
      .setTexture(key)
      .setVisible(alpha > 0.04)
      .setPosition(f.x, FLOOR_Y + 4)
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
    if (s.phase === 'matchEnd' && s.roundWinner !== null && s.phaseFrame > WIN_REVEAL_FRAME) {
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

    // after a fatality, the beaten loser lies burnt in a heap through the win
    // beat — not dazed on their feet. Force the down pose, kill the dizzy stars,
    // ash the sprite, and pile some dust under them.
    const fatalDown = s.phase === 'matchEnd' && !!s.fatality && s.roundWinner !== null;
    const loserSlot = s.roundWinner === 0 ? 1 : 0;

    for (const slot of [0, 1] as const) {
      // sprite editor edits ONE fighter; slot 1 is a hidden loop-driver dummy
      if (this.spriteEditor && slot === 1) {
        this.fighterSprites[1]?.setVisible(false);
        this.fighterShadows[1]?.setVisible(false);
        continue;
      }
      const f = s.fighters[slot];
      const def = characters[f.charId];
      const burnt = fatalDown && slot === loserSlot;

      if (burnt) {
        // ashy dust heap the charred loser sprawls in
        gU.fillStyle(0x241f1b, 0.9).fillEllipse(f.x, FLOOR_Y + 8, def.bodyBox.w * 2.1, 24);
        gU.fillStyle(0x463d34, 0.8).fillEllipse(f.x, FLOOR_Y + 3, def.bodyBox.w * 1.5, 15);
        gU.fillStyle(0x5c5046, 0.5).fillEllipse(f.x - def.bodyBox.w * 0.3, FLOOR_Y - 1, def.bodyBox.w * 0.7, 8);
      }

      // circling dizzy stars over a dazed fighter's head (fight-phase dizzy
      // and the finisher-window daze both read as "helpless")
      if (f.action.kind === 'dazed' && !burnt && this.textures.exists('vfx-dizzy')) {
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
        const h = def.hurtStand.h * ART_MARGIN; // art has margin around the body
        sprite.setDisplaySize((h * CELL_W) / CELL_H, h);
        sprite.setPosition(f.x, f.y + geom.footOffset(def));
        sprite.setFlipX(f.facing === -1);
        sprite.setRotation(0);
        let frame = burnt ? this.cellFor(slot, ['down', 'fall', 'hit']) : this.actionToCell(slot, f);
        // a def can reference cells its (older/smaller) sheet lacks — an
        // invalid frame index makes Phaser throw on a null sourceSize; clamp
        // to the first cell instead of killing the render loop
        if (!sprite.texture.has(frame as unknown as string)) frame = 0;
        this.currentCellName[slot] = this.cellNames[slot][frame] ?? null;
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
        if (burnt) {
          sprite.setTint(0x453b32); // charred ash
          sprite.setRotation(0);
        } else if (k === 'hitstun' || (k === 'airHit' && f.action.frame < 6)) {
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
        this.currentCellName[slot] = null;
        this.fighterShadows[slot]?.setVisible(false);
        gU.fillStyle(0x000000, 0.35).fillEllipse(f.x, FLOOR_Y + 2, def.bodyBox.w * 1.6, 18);
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
        const size = PROJ_SIZE[p.moveId] ?? characters[ownerChar].moves[p.moveId]?.projectile?.renderSize ?? 72;
        const feet = PROJ_FEET_ANCHORED.has(p.moveId);
        const oy = PROJ_RENDER_OFFSET_Y[p.moveId] ?? 0; // render-only nudge
        img.setOrigin(0.5, feet ? 1 : 0.5);
        img.setVisible(true)
          .setPosition(p.x, (feet ? p.y + SPRITE_FOOT_OFFSET_Y : p.y) + oy)
          .setDisplaySize(size, size);
        img.setAlpha(1);
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
    if (this.spriteEditor) this.drawEditorGuides();
    if (this.spriteEditor && this.showHitbox) this.drawEditorHitbox();
    if (this.showSkeleton) this.drawSkeleton();
    perf.debug = performance.now() - sectionStart;
    sectionStart = performance.now();
    if (!this.spriteEditor) this.drawHud();
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
    this.drawPreviewBox();
  }

  /** the limb graph over the DWPose joints baked into meta.json (see
   *  tools/pack-sheet.mjs), grouped + colored to match the QA montage skeleton
   *  (tools/qa/pose_qa.py draw_overlay): torso/head orange, arms blue, legs
   *  green. Each bone is drawn only when both its joints are present. */
  private static readonly SKELETON_GROUPS: { color: number; bones: [string, string][] }[] = [
    { color: 0xff8c1a, bones: [['Lsho', 'Rsho'], ['Lhip', 'Rhip'], ['Lsho', 'Lhip'], ['Rsho', 'Rhip']] },
    { color: 0x33a0ff, bones: [['Lsho', 'Lelb'], ['Lelb', 'Lwri'], ['Rsho', 'Relb'], ['Relb', 'Rwri']] },
    { color: 0x3ad64a, bones: [['Lhip', 'Lkne'], ['Lkne', 'Lank'], ['Rhip', 'Rkne'], ['Rkne', 'Rank']] },
  ];
  private static readonly JOINT_COLOR: Record<string, number> = {
    nose: 0xff8c1a, Lsho: 0xff8c1a, Rsho: 0xff8c1a, Lhip: 0xff8c1a, Rhip: 0xff8c1a,
    Leye: 0xff8c1a, Reye: 0xff8c1a, Lear: 0xff8c1a, Rear: 0xff8c1a,
    Lelb: 0x33a0ff, Relb: 0x33a0ff, Lwri: 0x33a0ff, Rwri: 0x33a0ff,
    Lkne: 0x3ad64a, Rkne: 0x3ad64a, Lank: 0x3ad64a, Rank: 0x3ad64a,
  };
  // COCO-wholebody hand topology (21 pts): wrist(0) fans to 5 fingers
  private static readonly HAND_BONES: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
  ];
  private static readonly FOOT_BONES: [string, string][] = [
    ['Lank', 'Lheel'], ['Lank', 'Lbigtoe'], ['Lank', 'Lsmalltoe'],
    ['Rank', 'Rheel'], ['Rank', 'Rbigtoe'], ['Rank', 'Rsmalltoe'],
  ];
  private static readonly HAND_COLOR = 0x33e0ff;
  private static readonly FOOT_COLOR = 0x3ad64a;

  /** F3 debug overlay: a stick figure from DWPose keypoints QA'd against the
   *  actual painted sprite (tools/qa/pose_qa.py -> tools/pack-sheet.mjs ->
   *  meta.json), replayed live off whichever cell is currently on screen —
   *  no runtime pose inference, just the sprite's own transform applied to
   *  pre-measured joints (mirrors sprite.setOrigin/setDisplaySize/setFlipX
   *  from the fighter-draw block above). Silently draws nothing for a
   *  character/cell with no baked keypoints yet. */
  private drawSkeleton(): void {
    const g = this.gfxHud;
    const slots = this.spriteEditor ? ([0] as const) : ([0, 1] as const);
    for (const slot of slots) {
      const cellName = this.currentCellName[slot];
      if (!cellName) continue;
      // editor reads live (edited) joints from the working sheet model
      const joints = this.editorJoints(cellName) ?? this.skeletons[slot]?.[cellName];
      if (!joints) continue;
      const f = this.state.fighters[slot];
      const def = characters[f.charId];
      const mirror: 1 | -1 = f.facing === -1 ? -1 : 1;
      const toWorld = (jx: number, jy: number): [number, number] =>
        geom.cellToWorld(def, f.x, f.y, jx, jy, mirror);
      const bone = (a: string, b: string, color: number, w = 2): void => {
        const ja = joints[a];
        const jb = joints[b];
        if (!ja || !jb) return;
        const [ax, ay] = toWorld(ja[0], ja[1]);
        const [bx, by] = toWorld(jb[0], jb[1]);
        g.lineStyle(w, color, 0.95).lineBetween(ax, ay, bx, by);
      };
      // body
      for (const grp of FightScene.SKELETON_GROUPS) for (const [a, b] of grp.bones) bone(a, b, grp.color);
      // neck: nose -> shoulder midpoint
      if (joints.nose && joints.Lsho && joints.Rsho) {
        const [nx, ny] = toWorld(joints.nose[0], joints.nose[1]);
        const [lx, ly] = toWorld(joints.Lsho[0], joints.Lsho[1]);
        const [rx, ry] = toWorld(joints.Rsho[0], joints.Rsho[1]);
        g.lineStyle(2, 0xff8c1a, 0.95).lineBetween(nx, ny, (lx + rx) / 2, (ly + ry) / 2);
      }
      // feet + hands (finger bones)
      for (const [a, b] of FightScene.FOOT_BONES) bone(a, b, FightScene.FOOT_COLOR, 1);
      for (const pre of ['lhand_', 'rhand_']) {
        for (const [a, b] of FightScene.HAND_BONES) bone(`${pre}${a}`, `${pre}${b}`, FightScene.HAND_COLOR, 1);
      }
      // joint dots: body joints big+colored, hands/feet a small point. Face
      // points (face_*) are not baked anymore, and skipped if a stale meta has them.
      for (const name in joints) {
        if (name.startsWith('face_')) continue;
        const [jx, jy] = toWorld(joints[name][0], joints[name][1]);
        const bodyCol = FightScene.JOINT_COLOR[name];
        if (bodyCol !== undefined) {
          g.fillStyle(bodyCol, 1).fillCircle(jx, jy, 3);
        } else {
          const col = name.startsWith('lhand_') || name.startsWith('rhand_') ? FightScene.HAND_COLOR : FightScene.FOOT_COLOR;
          g.fillStyle(col, 0.9).fillCircle(jx, jy, 1.3);
        }
      }
    }
  }

  // ---------- sprite editor (spriteEditor mode) ----------

  /** live (edited) joints for a cell from the working sheet model, else null */
  private editorJoints(cellName: string): Record<string, [number, number, number]> | undefined {
    return this.spriteEditor ? this.sheetModel?.jointsFor(cellName) : undefined;
  }

  private setupSpriteEditor(): void {
    const id = this.chars[0];
    const meta = this.cache.json.get(`meta-${id}`) as SheetMeta | undefined;
    const src = this.textures.exists(`sheet-${id}`)
      ? (this.textures.get(`sheet-${id}`).getSourceImage() as CanvasImageSource)
      : null;
    if (meta && src) {
      this.sheetModel = new SpriteSheetModel(this, id, src, meta);
      // point the live fighter at the editable working texture so edits show
      this.fighterSprites[0]?.setTexture(this.sheetModel.texKey, 0);
      this.hitFlashSprites[0]?.setTexture(this.sheetModel.texKey, 0);
    }
    // one fighter only: hide the loop-driver dummy, park the subject on the left
    this.fighterSprites[1]?.setVisible(false);
    this.state.fighters[0].x = 168;
    this.state.fighters[0].facing = 1;
    this.showHitbox = true;
    this.debugBoxes = false; // the editor draws its own selected-move box
    this.installEditorPointer();
    if (this.sheetModel) {
      this.spritePanel = new SpriteEditorPanel(this.uiLayer.root, characters[id], this.sheetModel, this);
    }
    this.events.once('shutdown', () => {
      this.spritePanel?.dispose();
      this.sheetModel?.dispose();
    });
  }

  /** show/hide the fight chrome (health bars, portraits, timer, messages) —
   *  the sprite-editor "clean canvas" and the studio's SPRITES module use it */
  private setHudVisible(v: boolean): void {
    const els = [...this.hudEls, ...this.hudPortraitShadows, this.msgText, this.timerText, this.comboText];
    for (const o of els) (o as unknown as { setVisible(v: boolean): void }).setVisible(v);
  }

  /** the studio's dev stage template: a sparse wireframe space — dark field,
   *  horizon, perspective floor grid, an accented feet line and scale posts —
   *  so a character under construction reads against a neutral background. */
  private drawWireframeStage(): void {
    const g = this.add.graphics().setDepth(0);
    const horizonY = Math.round((260 / 720) * STAGE_H);
    const floorTop = Math.round((500 / 720) * STAGE_H);
    g.fillStyle(0x0b0f16, 1).fillRect(0, 0, STAGE_W, STAGE_H);
    // sky band grid (sparse)
    g.lineStyle(1, 0x22333f, 0.8);
    for (let x = 0; x <= STAGE_W; x += 96) g.lineBetween(x, 0, x, horizonY);
    for (let y = 0; y <= horizonY; y += 96) g.lineBetween(0, y, STAGE_W, y);
    // horizon
    g.lineStyle(2, 0x3f6b7e, 1).lineBetween(0, horizonY, STAGE_W, horizonY);
    // floor plane: converging verticals + widening horizontals (fake depth)
    g.lineStyle(1, 0x2c4757, 1);
    const cx = STAGE_W / 2;
    for (let i = -8; i <= 8; i++) {
      g.lineBetween(cx + i * 40, floorTop, cx + i * 130, STAGE_H);
    }
    for (let t = 0; t <= 1; t += 0.2) {
      const y = floorTop + (STAGE_H - floorTop) * t * t;
      g.lineStyle(1, 0x2c4757, 1).lineBetween(0, y, STAGE_W, y);
    }
    // the feet line (FLOOR_Y) accented + scale posts every 200px
    g.lineStyle(2, 0x4a8a9e, 1).lineBetween(0, FLOOR_Y, STAGE_W, FLOOR_Y);
    g.lineStyle(2, 0x4a8a9e, 0.8);
    for (let x = 100; x < STAGE_W; x += 200) g.lineBetween(x, FLOOR_Y - 10, x, FLOOR_Y + 10);
    this.add
      .text(12, FLOOR_Y + 14, 'WIREFRAME DEV STAGE — assign a real stage in STAGES before shipping', {
        fontFamily: 'monospace', fontSize: '12px', color: '#56788a', stroke: '#000', strokeThickness: 2,
      })
      .setDepth(0.5);
  }

  /** Character Studio CREATOR: swap slot 0 to a LIVE DRAFT — the def goes
   *  into the live registry, the (placeholder→real) cells live on a canvas
   *  texture the wizard blits into as generations land, and the fighter
   *  simply renders it: the fight scene IS the creator preview. Also the
   *  canon-edit path: reopening a fighter re-mounts it here with its real
   *  assets inherited. Returns a refresh handle for cell updates. */
  setStudioSubject(def: (typeof characters)[string], meta: SheetMeta, canvas: HTMLCanvasElement): { refresh: () => void } {
    const id = def.id;
    characters[id] = def; // live registry (dev-only mutation, same as the tuner)
    const key = `sheet-${id}`;
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.addCanvas(key, canvas)!;
    meta.frames.forEach((_, i) =>
      tex.add(i, 0, (i % meta.cols) * meta.cellW, Math.floor(i / meta.cols) * meta.cellH, meta.cellW, meta.cellH),
    );
    tex.refresh();
    this.chars[0] = id;
    this.cellMaps[0] = new Map(meta.frames.map((n, i) => [n, i]));
    this.cellNames[0] = meta.frames;
    this.skeletons[0] = meta.skeletons;
    const f = this.state.fighters[0];
    f.charId = id;
    f.health = def.health;
    f.action = { kind: 'idle', frame: 0 }; // never carry an action into a new kit
    this.fighterSprites[0]?.setTexture(key, 0);
    this.hitFlashSprites[0]?.setTexture(key, 0);
    // stale cached silhouettes would shadow the OLD art — drop them so
    // ensureShadowTexture re-bakes from the new canvas
    for (const tkey of this.textures.getTextureKeys()) {
      if (tkey.startsWith(`shadow-${id}-`)) this.textures.remove(tkey);
    }
    return { refresh: () => tex.refresh() };
  }

  /** Character Studio: the collapsible module rail over the live fight. Each
   *  module lazily mounts one of the existing dev panels over THIS scene (the
   *  WYSIWYG guarantee); TEST hides them all so the scene is pure play. The
   *  full creator modules (Identity/Look/Audio/FX/Stages/Ship) re-host here
   *  next (docs/CHARACTER_STUDIO.md §2.1). */
  private setupStudio(): void {
    const spritesOn = (): void => {
      if (!this.spritePanel) this.setupSpriteEditor();
      else this.spritePanel.setMounted(true);
      // (re-)park the subject for the editor's fighter column
      this.fighterSprites[1]?.setVisible(false);
      this.state.fighters[0].x = 168;
      this.state.fighters[0].facing = 1;
      this.spriteEditor = true;
      this.setHudVisible(false);
    };
    const spritesOff = (): void => {
      this.spriteEditor = false;
      this.spritePanel?.setMounted(false);
      this.fighterSprites[1]?.setVisible(true);
      this.setHudVisible(true);
    };
    const movesOn = (): void => {
      if (!this.tunerPanel) {
        this.debugBoxes = true; // hitbox edits should be visible immediately
        this.tunerPanel = new MoveTunerPanel(this.uiLayer.root, characters, this.chars, this);
      } else {
        this.tunerPanel.setMounted(true);
      }
      this.tuner = true;
    };
    const movesOff = (): void => {
      this.tuner = false;
      this.tunerFrozen = false;
      this.tunerPanel?.setMounted(false);
    };
    // the full creator wizard, re-hosted over the live fight (the standalone
    // CharacterCreatorScene grid backdrop is retired from the menu routes)
    let creatorPanel: CharacterCreatorPanel | null = null;
    const creatorOn = (): void => {
      if (!creatorPanel) {
        creatorPanel = new CharacterCreatorPanel(this.uiLayer.root, () => this.studioRail?.setActive(null), {
          sceneHosted: true,
          subject: {
            mount: (def, meta, canvas) => this.setStudioSubject(def as unknown as (typeof characters)[string], meta, canvas),
            // the wizard's preview/move buttons drive the LIVE fighter
            loopMove: (moveId) => this.loopMove(moveId),
            stopLoop: () => this.manualControl(),
          },
        });
        // editing an existing fighter (opened from the roster screen on their
        // home stage): auto-open them as a canon edit — the wireframe stage
        // marks the NEW-character flow, which starts fresh at SEED
        if (this.stageId !== 'wireframe' && characters[this.chars[0]]) {
          creatorPanel.openCanonIfFresh(this.chars[0]);
        }
      } else {
        creatorPanel.setMounted(true);
      }
    };
    const creatorOff = (): void => creatorPanel?.setMounted(false);
    // stage registry / home-stage assignment / world-map pin round-trip
    let stagesPanel: StagesPanel | null = null;
    const stagesOn = (): void => {
      if (!stagesPanel) {
        stagesPanel = new StagesPanel(this.uiLayer.root, characters, {
          openPinEditor: () =>
            this.scene.start('StagePinEditor', {
              returnTo: {
                scene: 'Fight',
                data: { p1: this.chars[0], p2: this.chars[1], cpu: false, training: true, studio: true, module: 'stages', stage: this.stageId, render3d: false },
              },
            }),
        });
      } else {
        stagesPanel.setMounted(true);
      }
    };
    const stagesOff = (): void => stagesPanel?.setMounted(false);
    this.studioRail = new StudioRail(
      this.uiLayer.root,
      [
        { key: 'creator', label: 'CREATOR', hint: 'zero → hero wizard: seed · profile · moves · rig · polish · ship', activate: creatorOn, deactivate: creatorOff },
        { key: 'sprites', label: 'SPRITES', hint: 'sheet cells · regen · keypoints · auto-hitbox', activate: spritesOn, deactivate: spritesOff },
        { key: 'moves', label: 'MOVES', hint: 'frame data · hitboxes · CPU/loop drivers · write to JSON', activate: movesOn, deactivate: movesOff },
        { key: 'stages', label: 'STAGES', hint: 'registry · home-stage assignment · world-map pins', activate: stagesOn, deactivate: stagesOff },
        { key: 'test', label: 'TEST', hint: 'play it — all panels hidden · F1 boxes · F2 log · F3 skeleton', activate: () => this.setHudVisible(true), deactivate: () => undefined },
      ],
      this.studioModule ?? 'moves',
    );
    this.events.once('shutdown', () => {
      creatorPanel?.dispose();
      creatorPanel = null;
      stagesPanel?.dispose();
      stagesPanel = null;
      this.studioRail?.dispose();
      this.studioRail = null;
    });
  }

  /** keep the subject parked left + facing right between loop reps (forward-
   *  drifting moves aside) so it stays under the editor's fighter column */
  private spriteEditorUpkeep(): void {
    const f = this.state.fighters[0];
    if (f.action.kind === 'idle' || f.action.kind === 'walkF' || f.action.kind === 'walkB') {
      f.x = 168;
      f.vx = 0;
    }
    f.facing = 1;
  }

  // --- SpriteEditorHost interface (called by SpriteEditorPanel) ---
  /** loop a move OR a pseudo-pose ('__idle__' / '__walk__'); the driver stays
   *  in place with attack off so the pose plays under the editor's column */
  loopMove(moveId: string): void {
    this.editorLoopMove = moveId;
    this.setControlMode(0, 'loop', { moveId, attack: false, pauseTicks: this.editorLoopTicks });
    this.setLoopPaused(0, this.editorLoopPaused);
  }
  /** hand slot 0 back to the keyboard so the tester can drive it themselves */
  manualControl(): void {
    this.setControlMode(0, 'manual');
  }
  pauseLoop(paused: boolean): void {
    this.editorLoopPaused = paused;
    this.setLoopPaused(0, paused);
  }
  /** ticks the loop waits between reps (the "timer") — re-applied live */
  setLoopInterval(pauseTicks: number): void {
    this.editorLoopTicks = pauseTicks;
    if (this.controlMode[0] === 'loop') this.loopMove(this.editorLoopMove);
  }
  /** which move's hitbox is drawn faint/active + is draggable (edit target) */
  setEditorMove(moveId: string): void {
    this.editorMoveId = moveId;
  }
  setShowSkeleton(on: boolean): void {
    this.showSkeleton = on;
  }
  setShowHitbox(on: boolean): void {
    this.showHitbox = on;
  }

  /** selected-move hitbox on the subject: faint at rest, bright + handled
   *  during its active frames; draggable (see installEditorPointer) */
  private drawEditorHitbox(): void {
    if (!this.editorMoveId) return;
    const f = this.state.fighters[0];
    const def = characters[f.charId];
    const move = def.moves[this.editorMoveId];
    if (!move?.hitbox) return;
    const wb = worldBox(f, move.hitbox);
    const a = f.action;
    const active =
      (a.kind === 'attack' || a.kind === 'airAttack') &&
      a.moveId === this.editorMoveId &&
      a.frame >= move.startup &&
      a.frame < move.startup + move.active;
    const g = this.gfxHud;
    const col = 0xff4d6d;
    g.fillStyle(col, active ? 0.3 : 0.08).fillRect(wb.l, wb.t, wb.r - wb.l, wb.b - wb.t);
    g.lineStyle(2, col, active ? 1 : 0.55).strokeRect(wb.l, wb.t, wb.r - wb.l, wb.b - wb.t);
    for (const [hx, hy] of [[wb.l, wb.t], [wb.r, wb.t], [wb.l, wb.b], [wb.r, wb.b]] as const) {
      g.fillStyle(0xffffff, 0.9).fillRect(hx - 4, hy - 4, 8, 8);
    }
  }

  /** sprite-editor guides: the world floor plane (feet line) + a soft outline
   *  around the current cell's silhouette, both in the SAME cell->world space
   *  the sprite art is drawn in — so you can see feet-vs-shadow and the sprite
   *  extent against the floor */
  private drawEditorGuides(): void {
    const g = this.gfxHud;
    // floor plane: where the engine grounds the fighter (feet land here)
    g.lineStyle(1, 0x00e0ff, 0.5).lineBetween(0, FLOOR_Y, STAGE_W, FLOOR_Y);
    const name = this.currentCellName[0];
    const box = name ? this.sheetModel?.alphaBoxForName(name) : null;
    if (box) {
      const [l, t] = this.cellToWorld(box.x0, box.y0);
      const [r, b] = this.cellToWorld(box.x1, box.y1);
      g.lineStyle(1, 0xffffff, 0.28).strokeRect(l, t, r - l, b - t);
    }
  }

  /** the editor's slot-0 fighter def (transforms live in src/render/geometry) */
  private editorDef(): { def: (typeof characters)[string]; fx: number; fy: number } {
    const f = this.state.fighters[0];
    return { def: characters[f.charId], fx: f.x, fy: f.y };
  }
  private cellToWorld(jx: number, jy: number): [number, number] {
    const { def, fx, fy } = this.editorDef();
    return geom.cellToWorld(def, fx, fy, jx, jy);
  }

  /** SpriteEditorHost: delegate to the shared transform (RENDER scale + foot
   *  offset — NOT the collision `scale`; see src/render/geometry.ts). */
  cellBoxToHitbox(b: Box): Box {
    return geom.cellBoxToHitbox(this.editorDef().def, b);
  }
  private worldToCell(wx: number, wy: number): [number, number] {
    const { def, fx, fy } = this.editorDef();
    return geom.worldToCell(def, fx, fy, wx, wy);
  }

  private installEditorPointer(): void {
    type Drag =
      | { kind: 'joint'; joint: string; cell: string }
      | { kind: 'move' | 'nw' | 'ne' | 'sw' | 'se'; wl: number; wt: number; wr: number; wb: number; px: number; py: number };
    let drag: Drag | null = null;
    const near = (a: number, b: number, r = 9) => Math.abs(a - b) <= r;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const wx = p.worldX;
      const wy = p.worldY;
      const cell = this.currentCellName[0];
      // joints first (only when the skeleton overlay is on)
      if (this.showSkeleton && cell) {
        const joints = this.editorJoints(cell) ?? this.skeletons[0]?.[cell];
        if (joints) {
          for (const jn in joints) {
            const [jwx, jwy] = this.cellToWorld(joints[jn][0], joints[jn][1]);
            if (near(jwx, wx) && near(jwy, wy)) {
              drag = { kind: 'joint', joint: jn, cell };
              return;
            }
          }
        }
      }
      // hitbox move/resize
      const move = this.editorMoveId ? characters[this.chars[0]].moves[this.editorMoveId] : undefined;
      if (this.showHitbox && move?.hitbox) {
        const f = this.state.fighters[0];
        const wb = worldBox(f, move.hitbox);
        const corner = (cx: number, cy: number, k: 'nw' | 'ne' | 'sw' | 'se') =>
          near(cx, wx) && near(cy, wy) ? k : null;
        const k =
          corner(wb.l, wb.t, 'nw') ?? corner(wb.r, wb.t, 'ne') ?? corner(wb.l, wb.b, 'sw') ?? corner(wb.r, wb.b, 'se');
        if (k) drag = { kind: k, wl: wb.l, wt: wb.t, wr: wb.r, wb: wb.b, px: wx, py: wy };
        else if (wx >= wb.l && wx <= wb.r && wy >= wb.t && wy <= wb.b)
          drag = { kind: 'move', wl: wb.l, wt: wb.t, wr: wb.r, wb: wb.b, px: wx, py: wy };
      }
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!drag || !p.isDown) return;
      const wx = p.worldX;
      const wy = p.worldY;
      if (drag.kind === 'joint') {
        const [cx, cy] = this.worldToCell(wx, wy);
        this.sheetModel?.setJoint(drag.cell, drag.joint, Math.round(cx * 10) / 10, Math.round(cy * 10) / 10);
        return;
      }
      const move = this.editorMoveId ? characters[this.chars[0]].moves[this.editorMoveId] : undefined;
      if (!move?.hitbox) return;
      const f = this.state.fighters[0];
      let { wl, wt, wr, wb } = drag;
      const dx = wx - drag.px;
      const dy = wy - drag.py;
      if (drag.kind === 'move') {
        wl += dx; wr += dx; wt += dy; wb += dy;
      } else {
        if (drag.kind === 'nw' || drag.kind === 'sw') wl = wx;
        if (drag.kind === 'ne' || drag.kind === 'se') wr = wx;
        if (drag.kind === 'nw' || drag.kind === 'ne') wt = wy;
        if (drag.kind === 'sw' || drag.kind === 'se') wb = wy;
      }
      // world edges -> facing-relative box (editor faces right: l = f.x + box.x)
      const x = Math.round(Math.min(wl, wr) - f.x);
      const y = Math.round(Math.min(wt, wb) - f.y);
      move.hitbox = { x, y, w: Math.max(4, Math.round(Math.abs(wr - wl))), h: Math.max(4, Math.round(Math.abs(wb - wt))) };
    });

    this.input.on('pointerup', () => (drag = null));
  }

  /** move-tuner soft hitbox marker — always drawn (independent of whether the
   *  move is actually active) while a move's params are expanded, so it can
   *  be dialed in without repeatedly firing the move */
  private drawPreviewBox(): void {
    if (!this.previewBox) return;
    const { slot, box } = this.previewBox;
    const f = this.state.fighters[slot];
    const wb = worldBox(f, box);
    const g = this.gfxHud;
    g.fillStyle(0x7fe3ff, 0.16).fillRect(wb.l, wb.t, wb.r - wb.l, wb.b - wb.t);
    g.lineStyle(2, 0x7fe3ff, 0.8).strokeRect(wb.l, wb.t, wb.r - wb.l, wb.b - wb.t);
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
      // centered on the shared name row (HUD_NAME_Y), hugging the health bar's
      // INSIDE edge (toward screen center)
      for (let w = 0; w < 2; w++) {
        const wx = slot === 0 ? x + BAR_W - 14 - w * 20 : x + 14 + w * 20;
        if (s.wins[slot] > w) g.fillStyle(0xffd24a, 1).fillCircle(wx, HUD_NAME_Y, 6);
        else g.lineStyle(1, 0xd8cbb8, 1).strokeCircle(wx, HUD_NAME_Y, 6);
      }
    }

    this.timerText.setText(s.rules.roundTicks === 0 ? '∞' : String(Math.max(0, Math.ceil(s.timer / 60))));
    this.msgText.setText(this.message());
  }

  /** HUD tag beside the round-win pips: which side is bot-driven vs human */
  private playerLabel(slot: 0 | 1): string {
    return this.bots[slot] ? 'CPU' : slot === 0 ? 'P1' : 'P2';
  }

  /** move-tuner: a loop-mode dummy is still bot-driven, but the tester often
   *  wants to nudge it into a specific spot (corner, max range, ...) — held
   *  directional keys override the driver's own movement for that tick, and
   *  its attack decisions are untouched */
  private pollSlot(s: GameState, slot: 0 | 1): InputFrame {
    const bot = this.bots[slot];
    if (!bot) return this.inputs.poll(slot);
    const frame = bot.poll(s);
    if (this.tuner && this.controlMode[slot] === 'loop') {
      const kb = this.inputs.poll(slot);
      if (kb.left || kb.right || kb.up || kb.down) {
        return { ...frame, left: kb.left, right: kb.right, up: kb.up, down: kb.down };
      }
    }
    return frame;
  }

  /** move-tuner: swap a slot between manual/CPU/loop at runtime */
  setControlMode(
    slot: 0 | 1,
    mode: 'manual' | 'cpu' | 'loop',
    opts?: { difficulty?: Difficulty; moveId?: string; pauseTicks?: number; attack?: boolean },
  ): void {
    this.controlMode[slot] = mode;
    if (mode === 'manual') {
      this.bots[slot] = null;
      return;
    }
    if (mode === 'cpu') {
      this.bots[slot] = new CpuDriver(slot, DIFFICULTY_AGGRESSION[opts?.difficulty ?? 'medium'], false);
      return;
    }
    // loop
    const driver = new CpuDriver(slot, 1, false);
    driver.setLoop(opts?.moveId ?? null, opts?.pauseTicks ?? 30, opts?.attack ?? false);
    this.bots[slot] = driver;
  }

  /** move-tuner: pause/resume the current loop-mode driver on a slot (no-op
   *  if that slot isn't in loop mode) */
  setLoopPaused(slot: 0 | 1, paused: boolean): void {
    this.bots[slot]?.setLoopPaused(paused);
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
        return `${name} WINS${fatal}`;
      }
      default:
        return '';
    }
  }

}
