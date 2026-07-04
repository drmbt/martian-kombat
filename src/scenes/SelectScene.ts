// Character select: both players pick simultaneously from the 8-Martian grid.
// P1 WASD + F, P2 arrows + K. Locked characters (no sheet yet) can't be picked.
// Once both lock in, a stage-select dialog opens (RANDOM is the default);
// either player's keys drive it.
import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { ROSTER, type RosterEntry } from '../data/roster';
import { characters } from '../data/characters';
import { STAGES, stageOwner } from '../data/stages';
import { play } from './BootScene';
import { playMusic } from '../audio/music';
import { menuNav, navDefer } from '../input/menu-nav';
import { BindAction, getSettings } from '../settings';
import type { OnlineSelectData, StartConfig } from '../net/lobby';

const ATTACK_ACTIONS: BindAction[] = ['lp', 'mp', 'hp', 'lk', 'mk', 'hk'];

// --- Character-select layout ---------------------------------------------
// The world map sits up top; the roster packs into a bottom-center grid that
// scales to the roster count (see layoutGrid), and each player's currently
// boxed pick blows up as a big portrait on the outer left/right, SFII-style.
const MAP_ASPECT = 3168 / 1344; // source stage-map.png aspect (~2.357)
const MAP_TOP = 42;
const MAP_H = 236;
const MAP_W = Math.round(MAP_H * MAP_ASPECT);

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
const CELL_W = 288; // sprite-sheet cell dims (matches FightScene)
const CELL_H = 384;
const SIDE_P1_X = 116;
const SIDE_P2_X = STAGE_W - 116;
const SIDE_SPRITE_H = 250; // display height of the idle sprite
const SIDE_BASE_Y = 512; // feet baseline
const SIDE_TAG_Y = 296; // "1P" / "2P" label
const SIDE_NAME_Y = 524; // character name
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
  // roster grid, sized to the roster count by layoutGrid()
  private gcols = 5;
  private grows = 2;
  private gcell = 100;
  private gOriginX = 0;
  private gOriginY = 0;
  private starting = false;
  private cpu = false;
  private training = false;
  private render3d = false;
  /** online payload when this is a netplay pick (null = local). In online the
   *  local player controls only `online.localSlot`; the other side is filled
   *  from the wire, and only the host (slot 0) drives the stage dialog. */
  private online: OnlineSelectData | null = null;
  private waitingText: Phaser.GameObjects.Text | null = null;
  private stageMode = false;
  private stageIdx = 0;
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

  init(data: { cpu?: boolean; training?: boolean; render3d?: boolean; online?: OnlineSelectData }): void {
    this.online = data.online ?? null;
    // online is strictly 2-human, and the renderer is the host's (adopted)
    this.cpu = !this.online && !!data.cpu;
    this.training = !this.online && !!data.training;
    this.render3d = this.online ? this.online.render3d : !!data.render3d;
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
    }

    // World map banner across the top.
    if (this.textures.exists('ui-world-map')) {
      this.add
        .image(STAGE_W / 2, MAP_TOP + MAP_H / 2, 'ui-world-map')
        .setDisplaySize(MAP_W, MAP_H)
        .setDepth(1);
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
        .setOrigin(0.5, 0.95)
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
      this.add
        .text(STAGE_W / 2, MAP_TOP + MAP_H + 10, this.training ? 'TRAINING — pick your fighter, then the dummy' : 'VS CPU — pick your fighter, then your opponent', {
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
      if (this.stageMode) this.scene.restart({ cpu: this.cpu, training: this.training, render3d: this.render3d });
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
      onRemoteLock: (r) => this.applyRemotePick(r.charId),
      onBothLocked: () => this.onBothLocked(),
      onStart: (c) => this.launchOnline(c),
      onPhase: (phase, detail) => {
        if (phase === 'error') this.onNetError(detail ?? 'connection lost');
      },
    });
    // a pick that landed during the Lobby→Select handoff won't re-fire the
    // hook — reflect it now so the remote slot isn't left blank
    if (net.controller.remotePick) this.applyRemotePick(net.controller.remotePick);
  }

  /** the remote player's fighter arrived — reflect it in their slot */
  private applyRemotePick(charId: string): void {
    const remoteSlot: 0 | 1 = this.online!.localSlot === 0 ? 1 : 0;
    const i = ROSTER.findIndex((e) => e.id === charId);
    if (i < 0) return;
    this.idx[remoteSlot] = i;
    this.confirmed[remoteSlot] = true;
    play(this, `ann-${charId}`, 1);
    this.redraw();
  }

  /** both fighters locked: HOST opens the stage picker, GUEST waits for it */
  private onBothLocked(): void {
    if (this.online!.localSlot === 0) {
      this.time.delayedCall(600, () => this.openStagePick());
    } else {
      this.waitingText = this.add
        .text(STAGE_W / 2, STAGE_H / 2, 'waiting for host to choose the stage…', {
          fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold', color: '#ffd24a',
          stroke: '#000', strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setDepth(20);
    }
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
    this.waitingText?.setText('starting…');
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
    play(this, `ann-${entry.id}`, 1);
    this.redraw();
    if (this.online) {
      this.online.controller.lockChar(entry.id);
      return;
    }
    if (this.confirmed[0] && this.confirmed[1]) {
      this.time.delayedCall(1100, () => this.openStagePick());
    }
  }

  /** RANDOM tile first, then every stage — index space of the dialog. */
  private stageOptions(): { id: string; name: string }[] {
    return [{ id: 'random', name: 'RANDOM' }, ...STAGES];
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
      tile.on('pointerover', () => { this.stageIdx = i; });
      tile.on('pointerdown', () => { this.stageIdx = i; this.confirmStage(); });
      if (opt.id === 'random') {
        this.add.text(x, ty, '?', { ...font, fontSize: `${Math.round(th * 0.55)}px`, fontStyle: 'bold', color: '#ffd24a' })
          .setOrigin(0.5).setDepth(12);
      } else if (this.textures.exists(`bg-stage-${opt.id}`)) {
        this.add.image(x, ty, `bg-stage-${opt.id}`).setDisplaySize(tw, th).setDepth(12);
      }
      const owner = opt.id === 'random' ? null : stageOwner(opt.id, picked, characters);
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
    // online HOST: commit the stage through the controller — the match config
    // it sends drives BOTH peers' launch (via onStart -> launchOnline), so the
    // guest starts on the identical stage/rules (V25). Never scene.start here.
    if (this.online) {
      this.starting = true;
      this.redrawStage();
      this.online.controller.setStage(stage);
      this.online.controller.confirmStart();
      return;
    }
    this.starting = true;
    this.redrawStage();
    this.time.delayedCall(500, () => {
      this.scene.start('Versus', {
        p1: ROSTER[this.idx[0]].id, p2: ROSTER[this.idx[1]].id,
        cpu: this.cpu, training: this.training, stage, render3d: this.render3d,
      });
    });
  }

  private redrawStage(): void {
    const g = this.stageCursor;
    if (!g) return;
    const { x, y } = this.stageCellXY(this.stageIdx);
    const ty = y - SLABEL_H / 2;
    g.clear();
    g.lineStyle(this.starting ? 5 : 3, 0x58e6d9, 1);
    g.strokeRect(x - this.sThumbW / 2 - 4, ty - this.sThumbH / 2 - 4, this.sThumbW + 8, this.sThumbH + 8);
  }

  update(): void {
    this.padFrame();
    if (this.stageMode) this.redrawStage();
    else this.redraw();
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
        else navDefer(this, () => this.scene.restart({ cpu: this.cpu, training: this.training, render3d: this.render3d }));
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
      if (spr && this.textures.exists(sheetKey)) {
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
  }
}
