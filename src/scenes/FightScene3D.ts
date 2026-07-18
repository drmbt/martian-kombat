// The 3D fight scene (RENDER: 3D on the title; ?dev=3d for direct launch).
// Phaser still owns boot, input, audio, and scene flow; Three owns a separate
// canvas mounted over the Phaser one. The deterministic engine drives
// everything — this scene is the same step() loop as FightScene with a
// different presenter (SPEC V1, V7). Presentation events come from the shared
// pure diffTick (SPEC V15); audio from the shared soundCues table; pause/
// keys/nav/pad/log from the shared FightShell; UI chrome from src/ui/.
import Phaser from 'phaser';
import { initialState } from '../engine';
import type { GameState, InputFrame } from '../engine';
import { FightSession, type Session } from '../session/FightSession';
import { NetSession, type NetIssue } from '../session/NetSession';
import type { OnlineFightData } from '../net/lobby';
import { characters } from '../data/characters';
import { KeyboardSource } from '../input/keyboard';
import { getSettings } from '../settings';
import { CpuDriver } from '../ai/bot';
import { takeWarmRenderer } from '../renderer3d/warmup';
import { play, playVoice, runCues } from './BootScene';
import { AssetLoader } from './assetLoader';
import { queueFighterVO } from './assetQueue';
import { playMusic } from '../audio/music';
import { diffTick, snapTick, type FightEvent } from '../presentation/tickEvents';
import { soundCues } from '../presentation/soundDirector';
import { HudModel } from '../presentation/hudModel';
import { bannerFor, type BannerVariant } from '../presentation/banner';
import { STAGE3D_BOUNDS } from '../renderer3d/threeCoordinates';
// three is dev-path-only: type-only import here, the real module loads
// dynamically in create() so the production 2D bundle never ships it
import type { ThreeFightRenderer } from '../renderer3d/ThreeFightRenderer';
import { createSettingsPanel, DEFAULT_SETTINGS } from '../renderer3d/threeRenderSettings';
import { UiLayer } from '../ui/layer';
import { FightHud } from '../ui/FightHud';
import { AnnouncerBanner } from '../ui/AnnouncerBanner';
import { FatalityOverlay } from '../ui/FatalityOverlay';
import { WinOverlay } from '../ui/WinOverlay';
import { LoadingOverlay } from '../ui/LoadingOverlay';
import { FightShell } from './fightShell';

export class FightScene3D extends Phaser.Scene {
  private chars: [string, string] = ['vincent', 'vincent'];
  private stageId = 'chiba-roof';
  private cpu = false;
  private training = false;
  private state!: GameState;
  private inputs!: KeyboardSource;
  private bot: CpuDriver | null = null;
  private botP1: CpuDriver | null = null;
  private demo = false;
  private showcase = false;
  private session!: Session;
  private online: OnlineFightData | null = null;
  private net: NetSession | null = null;
  private netIssue: NetIssue | null = null;
  private uiLayer: UiLayer | null = null;
  private shell: FightShell | null = null;
  private loading: LoadingOverlay | null = null;
  /** captured by the session's beforeTick hook for diffTick */
  private pendingSnap: ReturnType<typeof snapTick> | null = null;
  private renderer3d: ThreeFightRenderer | null = null;
  private hud: FightHud | null = null;
  private banner: AnnouncerBanner | null = null;
  /** engine tick when the fight phase last began (phaseFrame stays 0 in
   *  fight — the FIGHT! banner needs its own clock) */
  private fightEnteredTick = -1;
  private fatalityOverlay: FatalityOverlay | null = null;
  private winOverlay: WinOverlay | null = null;
  private skeletonOn = false;
  private settings = { ...DEFAULT_SETTINGS };
  private panel: ReturnType<typeof createSettingsPanel> | null = null;
  private inspectorOn = false;
  private tauntKey = 'Q';
  /** shared ghost-bar + combo bookkeeping (see presentation/hudModel) */
  private hudModel!: HudModel;

  constructor() {
    super('Fight3D');
  }

  init(data: {
    p1?: string;
    p2?: string;
    cpu?: boolean;
    training?: boolean;
    stage?: string;
    demo?: boolean;
    showcase?: boolean;
    online?: OnlineFightData;
  }): void {
    this.chars = [data.p1 ?? 'vincent', data.p2 ?? 'vincent'];
    this.stageId = data.stage ?? 'chiba-roof';
    this.online = data.online ?? null;
    // online is strictly 2-human — no CPU, no demo, no training upkeep
    this.showcase = !this.online && !!data.showcase;
    this.demo = !this.online && (!!data.demo || this.showcase);
    this.cpu = !this.online && !!data.cpu;
    this.training = !this.online && !!data.training;
    this.net = null;
    this.netIssue = null;
    this.uiLayer = null;
    this.shell = null;
    this.loading = null;
    // demo = attract mode: both sides are (showcase) bots
    this.bot = this.cpu || this.demo ? new CpuDriver(1, 1, this.showcase) : null;
    this.botP1 = this.demo ? new CpuDriver(0, 1, this.showcase) : null;
  }

  /** Hard barrier for lazy VO (the 3D renderer uses meshes for fighters + its
   *  own 3D stage, but kiai/hurt/victory + move call-outs still route through
   *  playVoice). VersusScene warms these; blocks create() on a cold entry. */
  preload(): void {
    for (const id of new Set(this.chars)) queueFighterVO(this, id);
  }

  create(): void {
    // 3D arena is wider than the 2D 960px stage — symmetric around center so
    // the engine->Three mapping stays put (engine V: rules.stage). Online: both
    // peers build the identical state from the lobby's agreed rules (which the
    // host baked with these same 3D bounds), so V25 holds.
    this.state = initialState(
      this.chars[0],
      this.chars[1],
      characters,
      this.online
        ? this.online.rules
        : {
            stage: { ...STAGE3D_BOUNDS },
            // room for the entry gesture + READY? 3-2-1 before FIGHT
            introTicks: 240,
            // showcase: single round that ends in the fatality
            ...(this.showcase ? { winsNeeded: 1 } : {}),
            // training sandbox: no round clock
            ...(this.training ? { roundTicks: 0 } : {}),
          },
    );
    this.inputs = new KeyboardSource(this);
    // the one fight-loop driver (SPEC V17/V18) — same hooks for local and net;
    // NetSession just consumes the local slot and drives the remote over the
    // wire (V18). Identical to FightScene's wiring, different presenter.
    const hooks = {
      beforeTick: (s: GameState) => {
        this.pendingSnap = snapTick(s);
      },
      inputs: (s: GameState): [InputFrame, InputFrame] => [
        this.botP1 ? this.botP1.poll(s) : this.inputs.poll(0),
        this.bot ? this.bot.poll(s) : this.inputs.poll(1),
      ],
      afterTick: (s: GameState, inp: [InputFrame, InputFrame]) => {
        this.shell?.logInputs(inp);
        const prev = this.pendingSnap!;
        if (prev.phase !== 'fight' && s.phase === 'fight') {
          this.fightEnteredTick = s.tick;
        }
        const events = diffTick(prev, s, characters);
        runCues(this, soundCues(events, this.chars)); // shared event→audio table
        this.handleEvents(events); // renderer fx (blood, shake, flashes)
        if (this.training && s.phase === 'fight') {
          // sandbox upkeep: health snaps back so nothing ever dies
          for (const f of s.fighters) {
            f.health = Math.max(f.health, Math.ceil(characters[f.charId].health * 0.4));
            if (f.action.kind !== 'hitstun' && f.action.kind !== 'airHit' && f.action.kind !== 'knockdown') {
              f.health = characters[f.charId].health;
            }
          }
        }
        this.hudModel.tick(events, s);
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
    } else {
      this.session = new FightSession(this.state, hooks, characters);
    }
    this.hudModel = new HudModel(characters, this.chars);
    playMusic([`stages/${this.stageId}`, 'stages/default']);
    // lazy fatality panels — pulled in the background during the fight (the
    // FatalityOverlay needs them only at FINISH HIM / match end)
    for (const id of new Set(this.chars)) void AssetLoader.fatality(this, id);
    // the DOM layer exists before the renderer so LOADING… can cover the boot
    this.uiLayer = new UiLayer(this);
    this.loading = new LoadingOverlay(this.uiLayer.root);
    // the shared fight shell: ESC pause menu, F2 move log, R/ENTER/F9/click
    // matchEnd nav, pad menu nav, demo exits, online rematch — 2D parity
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
      render3d: true,
      state: () => this.state,
      debugKeys: [
        {
          key: 'F1',
          act: () => {
            this.settings.hitboxes = !this.settings.hitboxes;
            if (this.renderer3d) this.renderer3d.hitboxes.visible = this.settings.hitboxes;
          },
        },
        {
          key: 'F3',
          act: () => {
            this.settings.skeleton = this.skeletonOn = !this.skeletonOn;
            this.renderer3d?.setSkeletonVisible(this.skeletonOn);
          },
        },
        {
          key: 'F4',
          act: () => {
            if (!this.panel) return;
            this.panel.el.style.display = this.panel.el.style.display === 'none' ? 'block' : 'none';
          },
        },
        {
          key: 'F5',
          act: () => {
            if (this.inspectorOn) return;
            this.inspectorOn = true;
            void this.renderer3d?.enableInspector();
          },
        },
      ],
      pauseHint:
        'ESC/START resume · ◄► choose, attack confirms · F1 hitboxes · F2 move log · F3 skeleton · F4 settings · ` orbit',
    });
    void this.bootRenderer();

    const kb = this.input.keyboard!;
    // backtick: free mouse orbit/zoom/pan inspection cam + game-frustum gizmo.
    // While on, the 3D canvas takes pointer events so the mouse drives OrbitControls.
    kb.on('keydown-BACKTICK', () => {
      const r = this.renderer3d;
      if (!r) return;
      void r.toggleInspectorCam(r.canvas).then((on) => {
        r.canvas.style.pointerEvents = on ? 'auto' : 'none';
      });
    });
    // taunt is a real engine input (bound key, default V/P1) — deterministic +
    // net-synced. The HUD hint just shows the local player's bound taunt key.
    const tauntSlot = this.online ? this.online.localSlot : 0;
    this.tauntKey = String.fromCharCode(getSettings().bindings[tauntSlot].keys.taunt);

    this.scale.on('resize', this.layoutDom, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layoutDom, this);
      this.renderer3d?.dispose();
      this.renderer3d = null;
      // hud/banner/overlays live inside the UiLayer root, which disposes
      // itself on shutdown — drop the refs so a restart rebuilds them
      this.hud = null;
      this.banner = null;
      this.fatalityOverlay = null;
      this.winOverlay = null;
      this.shell = null;
      this.loading = null;
      this.uiLayer = null;
      this.panel?.el.remove();
      this.panel = null;
    });
  }

  private async bootRenderer(): Promise<void> {
    // adopt the renderer warmed during the VS screen / online stage-settle
    // (models + stage + pipelines already streaming) — or boot fresh if none
    // was warmed for this matchup (e.g. ?dev=3d direct launch). The heavy load
    // thus overlaps a screen the player was already watching.
    const renderer = await takeWarmRenderer(this.chars, this.stageId);
    // the scene may have shut down while the chunk was loading
    if (!renderer || !this.scene.isActive()) {
      renderer?.dispose();
      return;
    }
    this.renderer3d = renderer;
    // dev handle for CDP-driven verification
    (window as unknown as { __r3d?: ThreeFightRenderer }).__r3d = renderer;
    // ?boxes=1 starts with the overlay on — lets headless screenshots verify
    // the debug cuboids without keyboard input
    this.settings.hitboxes = new URLSearchParams(window.location.search).get('boxes') === '1';
    renderer.hitboxes.visible = this.settings.hitboxes;
    this.mountDom(renderer.canvas);
    const host = this.game.canvas.parentElement ?? document.body;
    this.panel = createSettingsPanel(host, this.settings, (s) => this.renderer3d?.applySettings(s));
    renderer.applySettings(this.settings);
  }

  // ---------- DOM (Three canvas + shared UI chrome — SPEC T19/T29) ----------

  private mountDom(canvas: HTMLCanvasElement): void {
    const layer = this.uiLayer!;
    const parent = this.game.canvas.parentElement ?? document.body;
    canvas.style.cssText = 'position:absolute;pointer-events:none;';
    parent.appendChild(canvas);
    this.hud = new FightHud(layer.root, this.chars, characters);
    this.banner = new AnnouncerBanner(layer.root);
    this.fatalityOverlay = new FatalityOverlay(layer.root, characters);
    this.winOverlay = new WinOverlay(layer.root, characters, {
      prompt: this.online ? 'R  REMATCH   ·   ESC  QUIT' : 'R  REMATCH   ·   ENTER  SELECT',
      revealFrame: 150, // let the "<NAME> WINS" beat land + breathe first (2D parity)
      onFirstShow: (id) => playVoice(this, id, 'victory', 0.85),
    });
    this.layoutDom();
  }

  /** the Three canvas tracks the game canvas rect; the UI chrome rides the
   *  UiLayer, which tracks it on its own */
  private layoutDom(): void {
    const r3d = this.renderer3d;
    if (!r3d) return;
    const game = this.game.canvas;
    const parent = game.parentElement ?? document.body;
    const pr = parent.getBoundingClientRect();
    const gr = game.getBoundingClientRect();
    r3d.canvas.style.left = `${gr.left - pr.left}px`;
    r3d.canvas.style.top = `${gr.top - pr.top}px`;
    r3d.canvas.style.width = `${gr.width}px`;
    r3d.canvas.style.height = `${gr.height}px`;
    r3d.setSize(Math.round(gr.width), Math.round(gr.height));
  }

  private drawHud(): void {
    if (!this.hud) return;
    // center-stage announcement: pure function of state (presentation/banner)
    const [text, variant]: [string, BannerVariant] = bannerFor(this.state, characters, this.fightEnteredTick);
    this.banner?.set(text, variant);
    const clip = (slot: 0 | 1): string => {
      const ci = this.renderer3d?.clipInfo(slot);
      return ci ? `${ci.name}${ci.placeholder ? ' *PLACEHOLDER*' : ''}` : '…';
    };
    this.hud.update(this.state, {
      ghost: this.hudModel.ghost,
      combo: this.hudModel.comboLabel,
      clips: [clip(0), clip(1)],
      tauntKey: this.tauntKey,
    });
  }



  // ---------- presentation events (SPEC T18/T20/T21/T22) ----------

  /** Renderer-side event fx ONLY (blood, shake, flashes, scene flow) — all
   *  audio comes from the shared soundCues table executed in afterTick. */
  private handleEvents(events: FightEvent[]): void {
    const s = this.state;
    const r = this.renderer3d;
    for (const e of events) {
      switch (e.type) {
        case 'round-end':
          if (!e.timeUp && e.winner !== null) {
            // KO gush — MK vibes (SPEC V16)
            const loser = e.winner === 0 ? 1 : 0;
            const lf = s.fighters[loser];
            r?.fx.spawnBlood(lf.x, lf.y - 140, s.fighters[e.winner].facing, 70, s.tick);
            r?.shake(s.tick, 20, 0.06);
          }
          break;
        case 'match-end':
          // don't let the KO punch (still held) instantly skip the win screen
          this.shell?.armEndNav();
          // idle attract exits to the title so the menu can cycle the demo; a
          // menu-chosen CPU-vs-CPU showcase returns to the CPU-vs-CPU select
          // (toCharacterSelect carries `showcase`) to pick another matchup
          if (this.demo) {
            this.time.delayedCall(6000, () =>
              this.showcase ? this.shell?.toCharacterSelect() : this.scene.start('Menu'),
            );
          }
          break;
        case 'finisher':
          r?.shake(s.tick, 12, 0.05);
          break;
        case 'fatality-start':
          r?.shake(s.tick, 28, 0.09);
          break;
        case 'hit': {
          const f = s.fighters[e.slot];
          const atk = s.fighters[e.slot === 0 ? 1 : 0];
          r?.fx.spawnHitFx(s, e.slot, e.counter, e.heavy);
          // blood along the impact velocity — tiered: a whiff of red on light
          // hits, moderate on solid ones, restrained even at the top end
          const amount = Math.min(Math.round(3 + e.damage * (e.heavy || e.counter ? 0.75 : 0.45)), 42);
          r?.fx.spawnBlood(f.x - f.facing * 20, f.y - 150, atk.facing, amount, s.tick);
          r?.flashFighter(e.slot, s.tick, e.counter ? 8 : 4, e.counter ? 0xff2a1a : 0xffffff);
          r?.shake(s.tick, e.counter ? 8 : 5, e.counter ? 0.05 : 0.03);
          break;
        }
        case 'block':
          r?.fx.spawnBlockFx(s, e.slot);
          break;
        case 'attack-start':
          this.shell?.logMove(e.slot);
          break;
        case 'dust':
          r?.fx.spawnDust(s, e.slot);
          break;
      }
    }
  }

  update(_time: number, deltaMs: number): void {
    // hold the sim (and its intro countdown + sounds) until the renderer has
    // its models/stage/pipelines up — otherwise the whole fight plays out over
    // a black screen while the GLBs stream in. A loading overlay covers the wait.
    if (!this.renderer3d?.isReady) {
      this.session.resetPacing(); // don't bank the wait into a fast-forward burst
      this.loading?.show();
      return;
    }
    this.loading?.hide();
    // shell: pad nav, pause state, move-log redraw, online rematch arming.
    // While paused the sim halts but the renderer keeps presenting the frame.
    if (this.shell?.frame() ?? true) this.session.advance(deltaMs);
    else this.session.resetPacing();
    // pass the sub-tick alpha so clip playback interpolates between poses
    this.renderer3d?.render(this.state, this.session.alpha);
    this.drawHud();
    this.fatalityOverlay?.sync(this.state);
    this.winOverlay?.sync(this.state);
    this.panel?.setFps(this.game.loop.actualFps, deltaMs);
  }

}
