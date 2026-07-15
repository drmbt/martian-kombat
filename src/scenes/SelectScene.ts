// Character select: both players pick simultaneously from the 8-Martian grid.
// P1 WASD + F, P2 arrows + K. Locked characters (no sheet yet) can't be picked.
// Once both lock in, a stage-select dialog opens (RANDOM is the default);
// either player's keys drive it.
import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { ROSTER, type RosterEntry } from '../data/roster';
import { characters } from '../data/characters';
import { STAGES, stageById, stageOwner, type StageEntry } from '../data/stages';
import { play, announce } from './BootScene';
import { playMusic } from '../audio/music';
import { menuNav, navDefer } from '../input/menu-nav';
import { BindAction, getSettings } from '../settings';
import type { OnlineSelectData, StartConfig } from '../net/lobby';
import { UiLayer } from '../ui/layer';
import { CELL_H, CELL_W, FLOOR_FRAC } from '../render/coords';
// type-only: the real module (and three) loads dynamically on the 3D path
import type { SelectPreview3D } from '../renderer3d/SelectPreview3D';

const ATTACK_ACTIONS: BindAction[] = ['lp', 'mp', 'hp', 'lk', 'mk', 'hk'];

// --- Character-select layout ---------------------------------------------
// The world map sits up top; the roster packs into a bottom-center grid that
// scales to the roster count (see layoutGrid), and each player's currently
// boxed pick blows up as a big portrait on the outer left/right, SFII-style.
const MAP_ASPECT = 3168 / 1344; // source stage-map.png aspect (~2.357)
const MAP_TOP = 42;
const MAP_H = 236;
const MAP_W = Math.round(MAP_H * MAP_ASPECT);
const MAP_LEFT = Math.round(STAGE_W / 2 - MAP_W / 2);
// Home-stage thumbnail flanking the map: P1 in the left gutter, P2 mirrored to
// the right. Sits above each side's idle sprite, clear of the map's edges.
const SIDE_THUMB_W = 184;
const SIDE_THUMB_H = Math.round((SIDE_THUMB_W * 9) / 21);
const SIDE_THUMB_X = 102; // P1 center; P2 = STAGE_W - SIDE_THUMB_X
const SIDE_THUMB_Y = 158;

// Bottom-center band the roster grid lives in (bottom edge is flush/tight).
const GRID_LEFT = 214;
const GRID_RIGHT = 746;
const GRID_TOP = 298;
const GRID_BOTTOM = STAGE_H - 4;
const GRID_W = GRID_RIGHT - GRID_LEFT;
const GRID_H = GRID_BOTTOM - GRID_TOP;
const GRID_GAP = 6;
const CELL_MAX = 132; // don't let cells balloon when the roster is small

// Animated idle sprite on each side. P1 (left) faces right toward the center;
// P2 (right) is flipped to face left, so the two fighters square off inward.
// CELL_W/CELL_H/FLOOR_FRAC come from src/render/coords (the single source)
const SIDE_P1_X = 116;
const SIDE_P2_X = STAGE_W - 116;
const SIDE_SPRITE_H = 250; // display height of the idle sprite
const SIDE_BASE_Y = 512; // feet baseline
const SIDE_TAG_Y = 296; // "1P" / "2P" label
const SIDE_NAME_Y = 520; // character name — centered on the pod ellipse (SIDE_BASE_Y + 8)
const SIDE_IDLE_MS = 360; // idle-a <-> idle-b toggle period

// stage dialog: the grid sizes itself to the option count (RANDOM + every
// stage) so a growing roster keeps fitting the 960x540 canvas — see
// layoutStageGrid, which picks the column count giving the largest 21:9 thumb.
const SGRID_TOP = 84; // below the CHOOSE STAGE title
const SGRID_BOTTOM = STAGE_H - 34; // above the controls hint
const SLABEL_H = 26; // thumb->label gap + label line
const SMARGIN_X = 32;
const STHUMB_MAX_W = 190;

export class SelectScene extends Phaser.Scene {
  private idx: [number, number] = [0, 1];
  private confirmed: [boolean, boolean] = [false, false];
  private cursors!: Phaser.GameObjects.Graphics;
  private nameTexts: Phaser.GameObjects.Text[] = [];
  private sideSprites: (Phaser.GameObjects.Sprite | null)[] = [null, null];
  private sidePodium!: Phaser.GameObjects.Graphics;
  private sideSheet: [string, string] = ['', ''];
  private sideIdle: [[number, number], [number, number]] = [[0, 1], [0, 1]];
  // home-stage pins over the top map: static dots + a per-player highlight
  // (ring + name label + stage thumbnail) tracking each side's current pick
  private pinLayer: Phaser.GameObjects.Graphics | null = null;
  private pinLabels: Phaser.GameObjects.Text[] = [];
  private pinThumbs: (Phaser.GameObjects.Image | null)[] = [null, null];
  // roster grid, sized to the roster count by layoutGrid()
  private gcols = 5;
  private grows = 2;
  private gcell = 100;
  private gOriginX = 0;
  private gOriginY = 0;
  private starting = false;
  private cpu = false;
  private training = false;
  private showcase = false;
  /** dev-only move tuner (see FightScene) */
  private tuner = false;
  /** dev-only sprite editor (see FightScene) */
  private spriteEditor = false;
  /** dev-only Character Studio (module rail; see FightScene) */
  private studio = false;
  private studioModule: string | undefined;
  private render3d = false;
  /** live 3D idle previews on the side slots (3D mode; loaded dynamically) */
  private preview3d: SelectPreview3D | null = null;
  /** online payload when this is a netplay pick (null = local). In online the
   *  local player controls only `online.localSlot`; the other side is filled
   *  from the wire, and only the host (slot 0) drives the stage dialog. */
  private online: OnlineSelectData | null = null;
  private waitingText: Phaser.GameObjects.Text | null = null;
  private stageMode = false;
  private stageIdx = 0;
  /** online: the option index the REMOTE player voted for (-1 = not yet) */
  private remoteStageIdx = -1;
  private stageCursor: Phaser.GameObjects.Graphics | null = null;
  // stage-dialog layout, computed by layoutStageGrid for the current count
  private scols = 4;
  private sThumbW = STHUMB_MAX_W;
  private sThumbH = Math.round((STHUMB_MAX_W * 9) / 21);
  private sCellW = STHUMB_MAX_W + 24;
  private sCellH = Math.round((STHUMB_MAX_W * 9) / 21) + SLABEL_H;
  private sFirstRowY = 128;

  constructor() {
    super('Select');
  }

  init(data: { cpu?: boolean; training?: boolean; showcase?: boolean; tuner?: boolean; spriteEditor?: boolean; studio?: boolean; module?: string; render3d?: boolean; online?: OnlineSelectData }): void {
    this.online = data.online ?? null;
    // showcase = a chosen CPU-vs-CPU demo; one controller picks BOTH fighters,
    // exactly like VS CPU, so it rides the same single-controller select flow
    this.showcase = !this.online && !!data.showcase;
    // online is strictly 2-human, and the renderer is the host's (adopted)
    this.cpu = !this.online && (!!data.cpu || this.showcase);
    this.training = !this.online && !!data.training;
    this.tuner = !this.online && !!data.tuner;
    this.spriteEditor = !this.online && !!data.spriteEditor;
    this.studio = !this.online && !!data.studio;
    this.studioModule = data.module;
    this.render3d = this.online ? this.online.render3d : !!data.render3d;
    this.preview3d = null; // rebuilt per create(); disposed on shutdown
  }

  /** Boot the live 3D side previews (3D mode): dynamic import keeps three
   *  out of the 2D bundle; portraits stay up until each GLB actually lands. */
  private async boot3dPreview(): Promise<void> {
    const { SelectPreview3D } = await import('../renderer3d/SelectPreview3D');
    if (!this.scene.isActive()) return;
    const preview = new SelectPreview3D(characters, () => {
      // a model finished loading — swap the portrait out on the next redraw
      if (this.scene.isActive() && !this.stageMode) this.redraw();
    });
    await preview.init();
    if (!this.scene.isActive()) {
      preview.dispose();
      return;
    }
    this.preview3d = preview;
    const layer = new UiLayer(this);
    layer.root.appendChild(preview.canvas);
    const size = (): void => {
      const r = this.game.canvas.getBoundingClientRect();
      preview.setSize(r.width, r.height);
    };
    size();
    this.scale.on('resize', size);
    this.events.once('shutdown', () => {
      this.scale.off('resize', size);
      preview.dispose();
      this.preview3d = null;
    });
    this.redraw();
  }

  /** the slot the LOCAL player controls (online: fixed; local: the P1-first
   *  shared cursor logic). All grid movement + confirms route through here. */
  private localControlSlot(): 0 | 1 {
    return this.online ? this.online.localSlot : this.slotForP1();
  }

  /** Whether an entry can be picked in the CURRENT render mode: 3D needs a baked
   *  GLB (`mesh3d`), 2D just needs a sprite sheet (`playable`). */
  private pickable(entry: RosterEntry): boolean {
    return this.render3d ? !!entry.mesh3d : entry.playable;
  }

  create(): void {
    this.cameras.main.fadeIn(400, 0, 0, 0); // soft cross-fade in from the win screen / menu
    this.idx = [0, 1];
    this.confirmed = [false, false];
    this.starting = false;
    this.stageMode = false;
    this.stageIdx = 0;
    this.stageCursor = null;
    // the menu theme carries through character select (no-op if already playing)
    playMusic('menu');

    if (this.textures.exists('bg-salton')) {
      this.add.image(STAGE_W / 2, STAGE_H / 2, 'bg-salton').setDisplaySize(STAGE_W, STAGE_H).setAlpha(0.35);
    }
    this.add.rectangle(STAGE_W / 2, STAGE_H / 2, STAGE_W, STAGE_H, 0x0c0910, 0.5);
    this.add
      .text(STAGE_W / 2, 22, 'CHOOSE YOUR MARTIAN', {
        fontFamily: 'monospace', fontSize: '30px', fontStyle: 'bold', color: '#ffb347',
        stroke: '#2a0a0a', strokeThickness: 8,
      })
      .setOrigin(0.5);
    if (this.render3d) {
      this.add
        .text(STAGE_W - 12, 12, '3D', {
          fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold', color: '#7fe3ff',
          stroke: '#000', strokeThickness: 4, backgroundColor: '#123', padding: { x: 8, y: 4 },
        })
        .setOrigin(1, 0)
        .setDepth(8);
      void this.boot3dPreview(); // live GLB idles on the side slots
    }

    // World map banner across the top.
    if (this.textures.exists('ui-world-map')) {
      this.add
        .image(STAGE_W / 2, MAP_TOP + MAP_H / 2, 'ui-world-map')
        .setDisplaySize(MAP_W, MAP_H)
        .setDepth(1);
    }

    // Home-stage pins over the map (all depths < 10 so the stage dialog's
    // opaque overlay hides them). redrawPins() drives them each frame.
    this.pinLayer = this.add.graphics().setDepth(8);
    this.pinLabels = [];
    this.pinThumbs = [null, null];
    for (const p of [0, 1] as const) {
      this.pinThumbs[p] = this.add.image(0, 0, '__WHITE').setVisible(false).setDepth(7);
      this.pinLabels[p] = this.add
        .text(0, 0, '', {
          fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold',
          color: '#fff', stroke: '#000', strokeThickness: 4,
        })
        .setOrigin(0.5, 1)
        .setDepth(9)
        .setVisible(false);
    }

    // Size the roster grid to the current count before laying cells out.
    this.layoutGrid(ROSTER.length);

    ROSTER.forEach((entry, i) => {
      const { x, y } = this.cellXY(i);
      const c = this.gcell;
      const cellBg = this.add.rectangle(x, y, c, c, 0x14101a, 0.85).setStrokeStyle(2, 0x594566).setDepth(2);
      const locked = !this.pickable(entry);
      if (this.textures.exists(`portrait-${entry.id}`)) {
        const img = this.add.image(x, y, `portrait-${entry.id}`).setDisplaySize(c - 6, c - 6).setDepth(3);
        if (locked) img.setAlpha(0.3).setTint(0x777799);
      }
      // in 3D mode a sprite-playable fighter with no baked GLB reads "3D SOON"
      if (locked && this.render3d && entry.playable) {
        this.add
          .text(x, y + c / 2 - 10, '3D SOON', {
            fontFamily: 'monospace', fontSize: '10px', fontStyle: 'bold', color: '#7fe3ff',
            stroke: '#000', strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(4);
      }
      // mouse: hovering moves the active cursor here; clicking confirms it.
      // The mouse always drives the first unconfirmed slot — in every mode it
      // picks P1 first, then (once P1 locks) P2 / the CPU opponent / the dummy.
      cellBg.setInteractive({ useHandCursor: !locked });
      cellBg.on('pointerover', () => {
        if (this.stageMode) return;
        const p = this.confirmed[0] ? 1 : 0;
        if (!this.confirmed[p] && !this.starting) this.idx[p] = i;
      });
      cellBg.on('pointerdown', () => {
        if (this.stageMode) return;
        const p = this.confirmed[0] ? 1 : 0;
        if (this.confirmed[p] || this.starting) return;
        this.idx[p] = i;
        this.confirm(p);
      });
    });

    this.sidePodium = this.add.graphics().setDepth(3);
    this.cursors = this.add.graphics().setDepth(6);

    // Big animated idle sprites on the outer edges (SFII-style), squaring off.
    for (const p of [0, 1] as const) {
      const sx = p === 0 ? SIDE_P1_X : SIDE_P2_X;
      const color = p === 0 ? '#58e6d9' : '#ff5a48';
      this.add
        .text(sx, SIDE_TAG_Y, p === 0 ? '1P' : '2P', {
          fontFamily: 'monospace', fontSize: '20px', fontStyle: 'bold', color, stroke: '#000', strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(5);
      this.sideSprites[p] = this.add
        .sprite(sx, SIDE_BASE_Y, 'sheet-vincent', 0)
        .setOrigin(0.5, FLOOR_FRAC)
        .setDisplaySize((SIDE_SPRITE_H * CELL_W) / CELL_H, SIDE_SPRITE_H)
        .setFlipX(p === 1)
        .setDepth(4);
      this.nameTexts[p] = this.add
        .text(sx, SIDE_NAME_Y, '', {
          fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold', color, stroke: '#000', strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(5);
    }

    if (this.cpu || this.training) {
      const hint = this.showcase
        ? 'DEMO — pick both fighters to watch a CPU-vs-CPU showcase'
        : this.training
          ? 'TRAINING — pick your fighter, then the dummy'
          : 'VS CPU — pick your fighter, then your opponent';
      this.add
        .text(STAGE_W / 2, MAP_TOP + MAP_H + 10, hint, {
          fontFamily: 'monospace', fontSize: '13px', color: '#e8dcc8', stroke: '#000', strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(5);
    }

    const kb = this.input.keyboard!;
    const slotForP1 = this.slotForP1.bind(this);
    const move = this.moveGrid.bind(this);
    kb.on('keydown-A', () => (this.stageMode ? this.stageMove(-1) : move(slotForP1(), -1)));
    kb.on('keydown-D', () => (this.stageMode ? this.stageMove(1) : move(slotForP1(), 1)));
    kb.on('keydown-W', () => (this.stageMode ? this.stageMove(-this.scols) : move(slotForP1(), -this.gcols)));
    kb.on('keydown-S', () => (this.stageMode ? this.stageMove(this.scols) : move(slotForP1(), this.gcols)));
    // any of P1's bound attack keys confirms P1's slot; any of P2's confirms
    // P2's (in the stage dialog either side confirms the shared pick)
    const bindings = getSettings().bindings;
    const atkSet = (slot: 0 | 1): Set<number> => new Set(ATTACK_ACTIONS.map((a) => bindings[slot].keys[a]));
    const atk1 = atkSet(0);
    const atk2 = atkSet(1);
    kb.on('keydown', (e: KeyboardEvent) => {
      if (this.starting) return;
      if (this.stageMode) {
        if (atk1.has(e.keyCode) || atk2.has(e.keyCode)) this.confirmStage();
        return;
      }
      if (atk1.has(e.keyCode)) this.confirm(this.slotForP1());
      else if (atk2.has(e.keyCode) && !this.cpu && !this.training) this.confirm(1);
    });
    // arrows always work in the stage dialog — it's a shared pick
    kb.on('keydown-LEFT', () => this.stageMode && this.stageMove(-1));
    kb.on('keydown-RIGHT', () => this.stageMode && this.stageMove(1));
    kb.on('keydown-UP', () => this.stageMode && this.stageMove(-this.scols));
    kb.on('keydown-DOWN', () => this.stageMode && this.stageMove(this.scols));
    // ENTER confirms in sequence: P1's pick, then P2's, then the stage
    kb.on('keydown-ENTER', () => {
      if (this.stageMode) this.confirmStage();
      else this.confirm(this.confirmed[0] ? 1 : 0);
    });
    if (!this.cpu && !this.training) {
      kb.on('keydown-LEFT', () => !this.stageMode && move(1, -1));
      kb.on('keydown-RIGHT', () => !this.stageMode && move(1, 1));
      kb.on('keydown-UP', () => !this.stageMode && move(1, -this.gcols));
      kb.on('keydown-DOWN', () => !this.stageMode && move(1, this.gcols));
    }
    // ESC backs out: stage dialog -> character pick, character pick -> main menu
    kb.on('keydown-ESC', () => {
      if (this.starting) return;
      play(this, 's-blip', 0.5);
      if (this.online) return this.leaveOnline(); // leaving disconnects the match
      if (this.stageMode) this.scene.restart({ cpu: this.cpu, training: this.training, showcase: this.showcase, tuner: this.tuner, spriteEditor: this.spriteEditor, studio: this.studio, module: this.studioModule, render3d: this.render3d });
      else this.scene.start('Menu');
    });

    this.add
      .text(STAGE_W / 2, STAGE_H - 20, 'ESC / SELECT · menu', {
        fontFamily: 'monospace', fontSize: '13px', color: '#9a8fa8', stroke: '#000', strokeThickness: 3,
      })
      .setOrigin(0.5);

    if (this.online) this.setupOnline();

    this.redraw();
  }

  /** Wire the shared select to the live match controller (SPEC T39 reuse). The
   *  controller was created by LobbyScene during connect; here it gains the
   *  pick/stage/start hooks and the local player is bannered by side. */
  private setupOnline(): void {
    const net = this.online!;
    this.add
      .text(STAGE_W / 2, MAP_TOP + MAP_H + 10, `ONLINE vs ${net.remoteName} — you are Player ${net.localSlot + 1}`, {
        fontFamily: 'monospace', fontSize: '13px', color: '#8fe388', stroke: '#000', strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(5);
    net.controller.setHooks({
      onRemoteCursor: (idx) => this.applyRemoteCursor(idx),
      onRemoteLock: (r) => this.applyRemotePick(r.charId),
      onBothLocked: () => this.onBothLocked(),
      onRemoteStage: (stageId) => this.applyRemoteStageVote(stageId),
      onStart: (c) => this.launchOnline(c),
      onPhase: (phase, detail) => {
        if (phase === 'error') this.onNetError(detail ?? 'connection lost');
      },
    });
    // a pick that landed during the Lobby→Select handoff won't re-fire the
    // hook — reflect it now so the remote slot isn't left blank
    if (net.controller.remotePick) this.applyRemotePick(net.controller.remotePick);
  }

  /** the remote player's live cursor — move their slot's box before they lock */
  private applyRemoteCursor(idx: number): void {
    const remoteSlot: 0 | 1 = this.online!.localSlot === 0 ? 1 : 0;
    if (this.confirmed[remoteSlot] || idx < 0 || idx >= ROSTER.length) return;
    this.idx[remoteSlot] = idx;
    play(this, 's-blip', 0.2);
    this.redraw();
  }

  /** the remote player cast a stage vote — mark it in the dialog (no call-out
   *  yet; the resolved stage is announced once at launch) */
  private applyRemoteStageVote(stageId: string): void {
    this.remoteStageIdx = this.stageOptions().findIndex((o) => o.id === stageId);
    if (this.stageMode) this.redrawStage();
  }

  /** the remote player's fighter arrived — reflect it in their slot */
  private applyRemotePick(charId: string): void {
    const remoteSlot: 0 | 1 = this.online!.localSlot === 0 ? 1 : 0;
    const i = ROSTER.findIndex((e) => e.id === charId);
    if (i < 0) return;
    this.idx[remoteSlot] = i;
    this.confirmed[remoteSlot] = true;
    announce(this, `ann-${charId}`);
    this.redraw();
  }

  /** both fighters locked: clear the "waiting" notice and BOTH players open
   *  the stage picker (votes reconcile in the controller) */
  private onBothLocked(): void {
    this.waitingText?.destroy();
    this.waitingText = null;
    this.time.delayedCall(600, () => this.openStagePick());
  }

  /** show/replace the "waiting for the opponent" notice (bottom banner, above
   *  the stage dialog + everything else) */
  private setWaiting(text: string): void {
    if (!this.waitingText) {
      this.waitingText = this.add
        .text(STAGE_W / 2, STAGE_H - 42, '', {
          fontFamily: 'monospace', fontSize: '17px', fontStyle: 'bold', color: '#ffd24a',
          stroke: '#000', strokeThickness: 6, align: 'center',
          backgroundColor: '#1a1020', padding: { x: 12, y: 5 },
        })
        .setOrigin(0.5)
        .setDepth(30);
    }
    this.waitingText.setText(text).setVisible(true);
  }

  /** leave an online pick: tell the peer, drop the channel, back to menu */
  private leaveOnline(): void {
    const t = this.online?.transport;
    try {
      t?.send({ t: 'bye', reason: 'left character select' });
    } catch {
      /* channel may already be gone */
    }
    t?.close();
    this.scene.start('Menu');
  }

  private onNetError(detail: string): void {
    if (this.starting) return;
    this.starting = true;
    this.add.rectangle(STAGE_W / 2, STAGE_H / 2, STAGE_W, STAGE_H, 0x1a0508, 0.85).setDepth(30);
    this.add
      .text(STAGE_W / 2, STAGE_H / 2, `CONNECTION LOST\n${detail}`, {
        fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold', color: '#ff5a4a',
        stroke: '#000', strokeThickness: 5, align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(31);
    this.time.delayedCall(1800, () => this.scene.start('Menu'));
  }

  /** hand the live transport to the Fight (2D or 3D per the host's renderer).
   *  onStart fires exactly once per peer (beginMatch is guarded), so this runs
   *  once — the host from its own confirmStart, the guest from the `start` msg. */
  private launchOnline(config: StartConfig): void {
    this.starting = true;
    this.waitingText?.setText(`stage: ${config.stage.replace(/-/g, ' ').toUpperCase()}`);
    // announce the resolved stage (the winning vote) as the match kicks off
    this.playStageVo(config.stage);
    // 3D online: start streaming the renderer the moment the stage settles, so
    // it overlaps the launch instead of a black screen in the fight
    if (config.render3d) {
      void import('../renderer3d/warmup').then((m) => m.warmupRenderer(config.chars, config.stage));
    }
    const net = this.online!;
    this.time.delayedCall(400, () => {
      this.scene.start(config.render3d ? 'Fight3D' : 'Fight', {
        p1: config.chars[0],
        p2: config.chars[1],
        stage: config.stage,
        online: {
          transport: net.transport,
          localSlot: net.localSlot,
          delay: config.delay,
          rules: config.rules,
          remoteName: net.remoteName,
          render3d: config.render3d,
        },
      });
    });
  }

  /** Which slot the shared keyboard/pad drives: P1 until it locks, then P2. */
  private slotForP1(): 0 | 1 {
    return (this.cpu || this.training) && this.confirmed[0] ? 1 : 0;
  }

  private moveGrid(p: 0 | 1, d: number): void {
    // online: the local player only ever moves their own slot
    if (this.online) p = this.online.localSlot;
    if (this.confirmed[p] || this.starting) return;
    const n = ROSTER.length;
    this.idx[p] = ((this.idx[p] + d) % n + n) % n;
    play(this, 's-blip', 0.5);
    // mirror our cursor to the opponent's screen (live remote cursor)
    if (this.online) this.online.controller.moveCursor(this.idx[p]);
  }

  /** idle-a / idle-b sheet frame indices for the side idle animation. */
  private idleFrames(id: string): [number, number] {
    const meta = this.cache.json.get(`meta-${id}`) as { frames?: string[] } | undefined;
    const frames = meta?.frames ?? [];
    const ia = frames.indexOf('idle-a');
    const ib = frames.indexOf('idle-b');
    return [ia >= 0 ? ia : 0, ib >= 0 ? ib : ia >= 0 ? ia : 0];
  }

  /**
   * Size the roster grid to fit the bottom-center band: pick the column count
   * giving the largest square cell that fits both the band width and height,
   * then bottom-anchor the rows flush to the screen edge. Grows gracefully as
   * the roster expands — more fighters just shrink the cells / add rows.
   */
  private layoutGrid(n: number): void {
    let best = { cols: 4, s: 0 };
    for (let cols = 3; cols <= 8; cols++) {
      const rows = Math.ceil(n / cols);
      const s = Math.min((GRID_W - (cols - 1) * GRID_GAP) / cols, (GRID_H - (rows - 1) * GRID_GAP) / rows);
      if (s > best.s) best = { cols, s };
    }
    this.gcols = best.cols;
    this.grows = Math.ceil(n / this.gcols);
    this.gcell = Math.min(CELL_MAX, Math.floor(best.s));
    const gridW = this.gcols * this.gcell + (this.gcols - 1) * GRID_GAP;
    const gridH = this.grows * this.gcell + (this.grows - 1) * GRID_GAP;
    this.gOriginX = STAGE_W / 2 - gridW / 2 + this.gcell / 2;
    this.gOriginY = GRID_BOTTOM - gridH + this.gcell / 2; // flush to the bottom
  }

  private cellXY(i: number): { x: number; y: number } {
    const col = i % this.gcols;
    const row = Math.floor(i / this.gcols);
    const stride = this.gcell + GRID_GAP;
    return {
      x: this.gOriginX + col * stride,
      y: this.gOriginY + row * stride,
    };
  }

  private confirm(p: 0 | 1): void {
    // online: only ever confirm the local slot; the pick goes over the wire and
    // the stage picker is opened by onBothLocked (host), not here
    if (this.online) p = this.online.localSlot;
    if (this.confirmed[p] || this.starting) return;
    const entry = ROSTER[this.idx[p]];
    if (!this.pickable(entry)) {
      play(this, 's-blip', 0.3);
      return;
    }
    this.confirmed[p] = true;
    announce(this, `ann-${entry.id}`);
    this.redraw();
    if (this.online) {
      this.online.controller.lockChar(entry.id);
      // picked first → tell them we're waiting on the other player, don't
      // silently sit (onBothLocked clears this and opens the stage picker)
      const remoteSlot = this.online.localSlot === 0 ? 1 : 0;
      if (!this.confirmed[remoteSlot]) {
        this.setWaiting(`waiting for ${this.online.remoteName} to choose their fighter…`);
      }
      return;
    }
    if (this.confirmed[0] && this.confirmed[1]) {
      this.time.delayedCall(1100, () => this.openStagePick());
    }
  }

  /** RANDOM tile first, then every stage — index space of the dialog. */
  private stageOptions(): { id: string; name: string }[] {
    // 3D-only: a pseudo-tile for the grey test chamber (no real STAGES entry,
    // no slot conflict — the grid auto-sizes). Maps to room='test-room' in 3D.
    const testRoom = this.render3d ? [{ id: 'test-room', name: '3D TEST ROOM' }] : [];
    return [{ id: 'random', name: 'RANDOM' }, ...testRoom, ...STAGES];
  }

  /**
   * Size the dialog grid to the option count: pick the column count (4..10)
   * that yields the largest 21:9 thumbnail fitting both the canvas width and
   * the vertical band between title and controls hint, then center the rows.
   */
  private layoutStageGrid(n: number): void {
    let best = { cols: 4, tw: 0 };
    for (let cols = 4; cols <= 10; cols++) {
      const rows = Math.ceil(n / cols);
      const byWidth = Math.floor((STAGE_W - SMARGIN_X) / cols) - 16;
      const byHeight = Math.floor(((SGRID_BOTTOM - SGRID_TOP) / rows - SLABEL_H) * (21 / 9));
      const tw = Math.min(STHUMB_MAX_W, byWidth, byHeight);
      if (tw > best.tw) best = { cols, tw };
    }
    this.scols = best.cols;
    this.sThumbW = best.tw;
    this.sThumbH = Math.round((best.tw * 9) / 21);
    this.sCellW = best.tw + 16;
    this.sCellH = this.sThumbH + SLABEL_H;
    const rows = Math.ceil(n / this.scols);
    const slack = Math.max(0, SGRID_BOTTOM - SGRID_TOP - rows * this.sCellH);
    this.sFirstRowY = SGRID_TOP + Math.round(slack / 2) + Math.round(this.sCellH / 2);
  }

  private stageCellXY(i: number): { x: number; y: number } {
    const col = i % this.scols;
    const row = Math.floor(i / this.scols);
    const gridW = this.scols * this.sCellW;
    return {
      x: STAGE_W / 2 - gridW / 2 + this.sCellW / 2 + col * this.sCellW,
      y: this.sFirstRowY + row * this.sCellH,
    };
  }

  private openStagePick(): void {
    if (this.stageMode || this.starting) return;
    this.stageMode = true;
    this.stageIdx = 0; // RANDOM is the default
    this.layoutStageGrid(this.stageOptions().length);
    const picked = [ROSTER[this.idx[0]].id, ROSTER[this.idx[1]].id];

    this.add.rectangle(STAGE_W / 2, STAGE_H / 2, STAGE_W, STAGE_H, 0x0c0910, 1).setDepth(10);
    this.add
      .text(STAGE_W / 2, 52, 'CHOOSE STAGE', {
        fontFamily: 'monospace', fontSize: '30px', fontStyle: 'bold', color: '#ffb347',
        stroke: '#2a0a0a', strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(11);

    const font = { fontFamily: 'monospace', stroke: '#000', strokeThickness: 3 };
    const tw = this.sThumbW;
    const th = this.sThumbH;
    const labelSize = tw < 130 ? '10px' : '12px';
    this.stageOptions().forEach((opt, i) => {
      const { x, y } = this.stageCellXY(i);
      const ty = y - SLABEL_H / 2; // thumb center; label sits below it
      const tile = this.add.rectangle(x, ty, tw, th, 0x14101a, 1).setStrokeStyle(1, 0x594566).setDepth(11);
      tile.setInteractive({ useHandCursor: true });
      tile.on('pointerover', () => {
        if (this.stageIdx === i) return;
        this.stageIdx = i;
        this.redrawStage();
      });
      tile.on('pointerdown', () => { this.stageIdx = i; this.confirmStage(); });
      if (opt.id === 'random') {
        this.add.text(x, ty, '?', { ...font, fontSize: `${Math.round(th * 0.55)}px`, fontStyle: 'bold', color: '#ffd24a' })
          .setOrigin(0.5).setDepth(12);
      } else if (opt.id === 'test-room') {
        this.add.text(x, ty, '▦', { ...font, fontSize: `${Math.round(th * 0.5)}px`, fontStyle: 'bold', color: '#7fe3ff' })
          .setOrigin(0.5).setDepth(12);
      } else if (this.textures.exists(`bg-stage-${opt.id}`)) {
        this.add.image(x, ty, `bg-stage-${opt.id}`).setDisplaySize(tw, th).setDepth(12);
      }
      const owner = opt.id === 'random' || opt.id === 'test-room' ? null : stageOwner(opt.id, picked, characters);
      const label = owner ? `${opt.name} · ${characters[owner].name}` : opt.name;
      this.add
        .text(x, ty + th / 2 + 3, label, {
          ...font, fontSize: labelSize, color: owner ? characters[owner].color : '#f5ead9',
        })
        .setOrigin(0.5, 0)
        .setDepth(12);
    });
    this.add
      .text(STAGE_W / 2, STAGE_H - 18, 'MOVE: WASD / ARROWS / D-PAD · CONFIRM: any attack or ENTER', {
        ...font, fontSize: '12px', color: '#e8dcc8',
      })
      .setOrigin(0.5)
      .setDepth(12);
    this.stageCursor = this.add.graphics().setDepth(13);
    this.redrawStage();
  }

  private stageMove(d: number): void {
    if (this.starting) return;
    const n = this.stageOptions().length;
    this.stageIdx = ((this.stageIdx + d) % n + n) % n;
    play(this, 's-blip', 0.5);
    this.redrawStage();
  }

  private confirmStage(): void {
    if (this.starting) return;
    const pick = this.stageOptions()[this.stageIdx];
    const stage = pick.id === 'random'
      ? STAGES[Math.floor(Math.random() * STAGES.length)].id
      : pick.id;
    play(this, 's-blip', 0.8);
    // online: BOTH players vote for a stage. The host reconciles (agree → that,
    // disagree → coin flip) and sends the authoritative start, so both peers
    // launch on the identical stage/rules (V25). Never scene.start here.
    // online: BOTH vote; the announce waits until the vote is SETTLED
    // (launchOnline plays the resolved stage), not on each vote here
    if (this.online) {
      this.starting = true;
      this.redrawStage();
      this.online.controller.pickStage(stage);
      this.setWaiting(`stage locked — waiting for ${this.online.remoteName}…`);
      return;
    }
    // offline: this IS the final pick — call it out now
    this.starting = true;
    this.redrawStage();
    this.playStageVo(stage);
    this.time.delayedCall(500, () => {
      this.scene.start('Versus', {
        p1: ROSTER[this.idx[0]].id, p2: ROSTER[this.idx[1]].id,
        // showcase launches as a CPU-vs-CPU demo, not a human-vs-CPU match
        cpu: this.showcase ? false : this.cpu, training: this.training,
        showcase: this.showcase, tuner: this.tuner, spriteEditor: this.spriteEditor,
        studio: this.studio, module: this.studioModule, stage, render3d: this.render3d,
      });
    });
  }

  private redrawStage(): void {
    const g = this.stageCursor;
    if (!g) return;
    g.clear();
    // online: colour the local cursor by our slot; draw the opponent's vote in
    // their colour (nested) so both votes are visible before they resolve
    const localColor = this.online?.localSlot === 1 ? 0xff5a48 : 0x58e6d9;
    const remoteColor = this.online?.localSlot === 1 ? 0x58e6d9 : 0xff5a48;
    if (this.online && this.remoteStageIdx >= 0) {
      const { x, y } = this.stageCellXY(this.remoteStageIdx);
      const ty = y - SLABEL_H / 2;
      g.lineStyle(3, remoteColor, 1);
      g.strokeRect(x - this.sThumbW / 2 - 8, ty - this.sThumbH / 2 - 8, this.sThumbW + 16, this.sThumbH + 16);
    }
    const { x, y } = this.stageCellXY(this.stageIdx);
    const ty = y - SLABEL_H / 2;
    g.lineStyle(this.starting ? 5 : 3, localColor, 1);
    g.strokeRect(x - this.sThumbW / 2 - 4, ty - this.sThumbH / 2 - 4, this.sThumbW + 8, this.sThumbH + 8);
  }

  /** announce a stage by name (louder + ducks music; missing clips stay
   *  silent). Only fired on FINAL selection — offline on confirm, online once
   *  the vote is settled — never on hover/navigation. */
  private playStageVo(stageId: string): void {
    // Clyde (stage voice) records quieter than the Maverick name-calls, so
    // push extra gain (WebAudio volume is a gain — >1 is fine here)
    announce(this, `ann-stage-${stageId}`, 2.4);
  }

  update(): void {
    this.padFrame();
    if (this.stageMode) this.redrawStage();
    else this.redraw();
    // 3D side previews: hidden behind the (full-screen Phaser) stage dialog;
    // driven off the Phaser loop so pacing matches the rest of the scene
    this.preview3d?.setVisible(!this.stageMode);
    if (!this.stageMode) this.preview3d?.render(this.time.now);
  }

  /** Gamepad drives the same picks the keyboard does (shared cursor). A single
   *  pad fills the first still-open slot (P1, then P2 / the CPU / the dummy). */
  private padSlot(): 0 | 1 {
    return this.confirmed[0] ? 1 : 0;
  }

  private padFrame(): void {
    if (this.starting) return;
    const n = menuNav.poll();
    if (this.stageMode) {
      if (n.up) this.stageMove(-this.scols);
      if (n.down) this.stageMove(this.scols);
      if (n.left) this.stageMove(-1);
      if (n.right) this.stageMove(1);
      // confirm/back re-check state at fire time — see navDefer
      if (n.confirm || n.start) navDefer(this, () => { if (this.stageMode) this.confirmStage(); });
      // Select backs out of the stage dialog to the character grid
      if (n.menu) {
        play(this, 's-blip', 0.5);
        if (this.online) navDefer(this, () => this.leaveOnline());
        else navDefer(this, () => this.scene.restart({ cpu: this.cpu, training: this.training, showcase: this.showcase, tuner: this.tuner, spriteEditor: this.spriteEditor, render3d: this.render3d }));
      }
      return;
    }
    const p = this.padSlot();
    if (n.up) this.moveGrid(p, -this.gcols);
    if (n.down) this.moveGrid(p, this.gcols);
    if (n.left) this.moveGrid(p, -1);
    if (n.right) this.moveGrid(p, 1);
    if (n.confirm || n.start) navDefer(this, () => { if (!this.stageMode) this.confirm(this.padSlot()); });
    // Select brings up the main menu (matches ESC)
    if (n.menu) {
      play(this, 's-blip', 0.5);
      if (this.online) navDefer(this, () => this.leaveOnline());
      else navDefer(this, () => this.scene.start('Menu'));
    }
  }

  /** Screen position of a normalized (0..1) world-map pin. */
  private pinScreen(pin: { x: number; y: number }): { x: number; y: number } {
    return { x: MAP_LEFT + pin.x * MAP_W, y: MAP_TOP + pin.y * MAP_H };
  }

  /** The home stage (with pin) of the fighter at a roster index, if any. */
  private homeStage(rosterIdx: number): StageEntry | undefined {
    const entry = ROSTER[rosterIdx];
    const def = entry ? characters[entry.id] : undefined;
    return def?.stage ? stageById(def.stage) : undefined;
  }

  /** Whether a player's slot is "in play" enough to light its home pin. P1
   *  always; P2 in 2P/online always, but in single-controller modes only once
   *  P1 has locked (the opponent-pick phase). */
  private pinSlotActive(p: 0 | 1): boolean {
    if (p === 0) return true;
    if (!this.cpu && !this.training && !this.showcase) return true;
    return this.confirmed[0];
  }

  /** Draw the world-map pins: dim dots for every placed stage (no labels) plus
   *  a player-colored highlight — ring, stage name, and stage thumbnail — for
   *  each side's currently hovered/held fighter's home stage. */
  private redrawPins(): void {
    const layer = this.pinLayer;
    if (!layer) return;
    layer.clear();
    // base dots: every placed stage, unlabeled
    for (const st of STAGES) {
      if (!st.pin) continue;
      const s = this.pinScreen(st.pin);
      layer.fillStyle(0x000000, 0.55);
      layer.fillCircle(s.x, s.y + 1, 4.4);
      layer.fillStyle(0xffe08a, 0.95);
      layer.fillCircle(s.x, s.y, 2.9);
    }

    const colors = [0x58e6d9, 0xff5a48] as const;
    const hexes = ['#7ff2e8', '#ff8072'] as const;
    const active: (StageEntry | undefined)[] = [
      this.pinSlotActive(0) ? this.homeStage(this.idx[0]) : undefined,
      this.pinSlotActive(1) ? this.homeStage(this.idx[1]) : undefined,
    ];
    for (const p of [0, 1] as const) {
      const label = this.pinLabels[p];
      const thumb = this.pinThumbs[p];
      const st = active[p];
      if (!st || !st.pin) {
        label.setVisible(false);
        thumb?.setVisible(false);
        continue;
      }
      const s = this.pinScreen(st.pin);
      const color = colors[p];
      // ring + glow at the pin
      layer.fillStyle(color, 0.22);
      layer.fillCircle(s.x, s.y, 12);
      layer.lineStyle(2.5, color, 1);
      layer.strokeCircle(s.x, s.y, 7);
      layer.fillStyle(color, 1);
      layer.fillCircle(s.x, s.y, 3.2);

      // stage name at the pin — P1 above, P2 below, so a shared pin never clashes
      const lx = Phaser.Math.Clamp(s.x, 40, STAGE_W - 40);
      label.setVisible(true).setText(st.name).setColor(hexes[p]);
      if (p === 0) label.setPosition(lx, Math.max(14, s.y - 11)).setOrigin(0.5, 1);
      else label.setPosition(lx, Math.min(STAGE_H - 8, s.y + 11)).setOrigin(0.5, 0);

      // stage thumbnail flanking the map: P1 left gutter, P2 right gutter
      const key = `bg-stage-${st.id}`;
      if (thumb && this.textures.exists(key)) {
        const tx = p === 0 ? SIDE_THUMB_X : STAGE_W - SIDE_THUMB_X;
        const ty = SIDE_THUMB_Y;
        thumb.setVisible(true).setTexture(key).setDisplaySize(SIDE_THUMB_W, SIDE_THUMB_H).setPosition(tx, ty).clearTint();
        layer.lineStyle(2, color, 1);
        layer.strokeRect(tx - SIDE_THUMB_W / 2, ty - SIDE_THUMB_H / 2, SIDE_THUMB_W, SIDE_THUMB_H);
      } else {
        thumb?.setVisible(false);
      }
    }
  }

  private redraw(): void {
    const g = this.cursors;
    const pod = this.sidePodium;
    const c = this.gcell;
    g.clear();
    pod.clear();
    for (const p of [0, 1] as const) {
      const entry = ROSTER[this.idx[p]];
      const { x, y } = this.cellXY(this.idx[p]);
      const color = p === 0 ? 0x58e6d9 : 0xff5a48;
      const inset = p === 0 ? 0 : 4; // nest P2's box so a shared cell shows both
      // grid cursor
      g.lineStyle(this.confirmed[p] ? 5 : 3, color, 1);
      g.strokeRect(x - c / 2 + inset, y - c / 2 + inset, c - inset * 2, c - inset * 2);
      // animated idle sprite for this player's current pick (P2 faces center)
      const sx = p === 0 ? SIDE_P1_X : SIDE_P2_X;
      const spr = this.sideSprites[p];
      const sheetKey = `sheet-${entry.id}`;
      // 3D mode, best-available preview: live GLB idle (SelectPreview3D) →
      // portrait bust while it streams / for sheet-only fighters → 2D sheet.
      this.preview3d?.setChar(p, this.render3d && entry.mesh3d ? entry.id : null);
      const portraitKey = `portrait-${entry.id}`;
      if (spr && this.render3d && this.preview3d?.active(p)) {
        spr.setVisible(false);
        this.sideSheet[p] = ''; // force a re-texture when we fall back later
      } else if (spr && this.render3d && this.textures.exists(portraitKey)) {
        spr.setVisible(true);
        if (this.sideSheet[p] !== portraitKey) {
          this.sideSheet[p] = portraitKey;
          spr.setTexture(portraitKey);
          spr.setDisplaySize(SIDE_SPRITE_H * 0.8, SIDE_SPRITE_H * 0.8);
          spr.setFlipX(p === 1);
          if (!this.pickable(entry)) spr.setAlpha(0.5).setTint(0x8a8aa0);
          else spr.setAlpha(1).clearTint();
        }
      } else if (spr && this.textures.exists(sheetKey)) {
        spr.setVisible(true);
        if (this.sideSheet[p] !== sheetKey) {
          this.sideSheet[p] = sheetKey;
          spr.setTexture(sheetKey, 0);
          spr.setDisplaySize((SIDE_SPRITE_H * CELL_W) / CELL_H, SIDE_SPRITE_H);
          spr.setFlipX(p === 1);
          this.sideIdle[p] = this.idleFrames(entry.id);
          if (!this.pickable(entry)) spr.setAlpha(0.5).setTint(0x8a8aa0);
          else spr.setAlpha(1).clearTint();
        }
        const [ia, ib] = this.sideIdle[p];
        spr.setFrame(Math.floor(this.time.now / SIDE_IDLE_MS) % 2 ? ib : ia);
      } else if (spr) {
        spr.setVisible(false);
      }
      // player-colored podium glow under the feet, brighter when locked in
      pod.fillStyle(color, this.confirmed[p] ? 0.55 : 0.16);
      pod.fillEllipse(sx, SIDE_BASE_Y + 8, 150, 26);
      this.nameTexts[p].setText(`${entry.name}${this.confirmed[p] ? ' ✓' : ''}`);
    }
    this.redrawPins();
  }
}
