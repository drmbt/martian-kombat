// Dev-only 3D fight scene (?dev=3d — SPEC I.url). Phaser still owns boot,
// input, audio, and scene flow; Three owns a separate canvas mounted over the
// Phaser one. The deterministic engine drives everything — this scene is the
// same step() loop as FightScene with a different presenter (SPEC V1, V7).
// Presentation events come from the shared pure diffTick (SPEC V15); sounds
// and music reuse the exact 2D helpers and asset keys.
import Phaser from 'phaser';
import { initialState } from '../engine';
import type { GameState, InputFrame } from '../engine';
import { FightSession, type Session } from '../session/FightSession';
import { NetSession, type NetIssue } from '../session/NetSession';
import type { OnlineFightData } from '../net/lobby';
import { RematchLink, type RematchState } from '../net/rematch';
import { characters } from '../data/characters';
import { KeyboardSource } from '../input/keyboard';
import { getSettings } from '../settings';
import { CpuDriver } from '../ai/bot';
import { stageById } from '../data/stages';
import { play, playVoice } from './BootScene';
import { nextTrack, playMusic } from '../audio/music';
import { diffTick, snapTick, type FightEvent } from '../presentation/tickEvents';
// three is dev-path-only: type-only import here, the real module loads
// dynamically in create() so the production 2D bundle never ships it
import type { ThreeFightRenderer } from '../renderer3d/ThreeFightRenderer';
import { createSettingsPanel, DEFAULT_SETTINGS } from '../renderer3d/threeRenderSettings';
import { FightHud } from '../renderer3d/hud/FightHud';
import { AnnouncerBanner, type BannerVariant } from '../renderer3d/hud/AnnouncerBanner';
import { FatalityOverlay } from '../renderer3d/hud/FatalityOverlay';
import { WinOverlay } from '../renderer3d/hud/WinOverlay';

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
  private session!: Session;
  private online: OnlineFightData | null = null;
  private net: NetSession | null = null;
  private netIssue: NetIssue | null = null;
  private rematch: RematchLink | null = null;
  private rematchLeft = false;
  private rematchEl: HTMLDivElement | null = null;
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
  private comboHits = 0;
  private comboTicks = 0;
  private ghostHealth: [number, number] = [0, 0];
  private ghostHoldUntil: [number, number] = [0, 0];

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
    online?: OnlineFightData;
  }): void {
    this.chars = [data.p1 ?? 'vincent', data.p2 ?? 'vincent'];
    this.stageId = data.stage ?? 'chiba-roof';
    this.online = data.online ?? null;
    // online is strictly 2-human — no CPU, no demo, no training upkeep
    this.demo = !this.online && !!data.demo;
    this.cpu = !this.online && !!data.cpu;
    this.training = !this.online && !!data.training;
    this.net = null;
    this.netIssue = null;
    this.rematch = null;
    this.rematchLeft = false;
    this.rematchEl = null;
    // demo = attract mode: both sides are bots
    this.bot = this.cpu || this.demo ? new CpuDriver(1) : null;
    this.botP1 = this.demo ? new CpuDriver(0) : null;
    this.comboHits = 0;
    this.comboTicks = 0;
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
            stage: { minX: -110, maxX: 1070 },
            // room for the entry gesture + READY? 3-2-1 before FIGHT
            introTicks: 240,
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
      afterTick: (s: GameState) => {
        const prev = this.pendingSnap!;
        if (prev.phase !== 'fight' && s.phase === 'fight') {
          this.fightEnteredTick = s.tick;
        }
        this.handleEvents(diffTick(prev, s, characters));
        if (this.training && s.phase === 'fight') {
          // sandbox upkeep: health snaps back so nothing ever dies
          for (const f of s.fighters) {
            f.health = Math.max(f.health, Math.ceil(characters[f.charId].health * 0.4));
            if (f.action.kind !== 'hitstun' && f.action.kind !== 'airHit' && f.action.kind !== 'knockdown') {
              f.health = characters[f.charId].health;
            }
          }
        }
        this.tickGhosts();
        if (this.comboTicks > 0 && --this.comboTicks === 0) this.comboHits = 0;
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
    this.ghostHealth = [characters[this.chars[0]].health, characters[this.chars[1]].health];
    this.ghostHoldUntil = [0, 0];
    playMusic([`stages/${this.stageId}`, 'stages/default']);
    void this.bootRenderer();

    const kb = this.input.keyboard!;
    kb.on('keydown-F1', () => {
      this.settings.hitboxes = !this.settings.hitboxes;
      if (this.renderer3d) this.renderer3d.hitboxes.visible = this.settings.hitboxes;
    });
    kb.on('keydown-F2', () => {
      this.settings.skeleton = this.skeletonOn = !this.skeletonOn;
      this.renderer3d?.setSkeletonVisible(this.skeletonOn);
    });
    // backtick: free mouse orbit/zoom/pan inspection cam + game-frustum gizmo.
    // While on, the 3D canvas takes pointer events so the mouse drives OrbitControls.
    kb.on('keydown-BACKTICK', () => {
      const r = this.renderer3d;
      if (!r) return;
      void r.toggleInspectorCam(r.canvas).then((on) => {
        r.canvas.style.pointerEvents = on ? 'auto' : 'none';
      });
    });
    kb.on('keydown-F3', () => {
      if (this.inspectorOn) return;
      this.inspectorOn = true;
      void this.renderer3d?.enableInspector();
    });
    kb.on('keydown-F4', () => {
      if (!this.panel) return;
      this.panel.el.style.display = this.panel.el.style.display === 'none' ? 'block' : 'none';
    });
    // taunt is now a real engine input (bound key, default V/P1) so it's
    // deterministic + net-synced — no scene-level keypress needed. The HUD hint
    // just shows the local player's bound taunt key.
    const tauntSlot = this.online ? this.online.localSlot : 0;
    this.tauntKey = String.fromCharCode(getSettings().bindings[tauntSlot].keys.taunt);
    kb.on('keydown-ESC', () => {
      if (this.online) {
        if (this.state.phase === 'matchEnd') this.rematch?.leave('you left');
      } else this.scene.start('Menu');
    });
    // online: R / ENTER at matchEnd opts into a rematch on the same channel
    const rematchKey = (): void => {
      if (this.online && this.state.phase === 'matchEnd') {
        play(this, 's-blip', 0.6);
        this.rematch?.optIn();
      }
    };
    kb.on('keydown-R', rematchKey);
    kb.on('keydown-ENTER', rematchKey);
    kb.on('keydown-F9', () => {
      if (this.online) return; // online rematches via R, not a local restart
      this.scene.restart({ p1: this.chars[0], p2: this.chars[1], cpu: this.cpu, stage: this.stageId });
    });

    if (this.demo) {
      // attract mode: any input drops back to the title (` stays free for the
      // perf overlay); the match auto-returns so the menu can cycle the demo
      const toMenu = (): void => { this.scene.start('Menu'); };
      this.input.keyboard!.on('keydown', (e: KeyboardEvent) => { if (e.key !== '`') toMenu(); });
      this.input.on('pointerdown', toMenu);
      const host = this.game.canvas.parentElement ?? document.body;
      const hint = document.createElement('div');
      hint.textContent = 'DEMO — PRESS ANY KEY';
      hint.style.cssText =
        'position:absolute;left:50%;bottom:22px;transform:translateX(-50%);z-index:40;' +
        'font:bold 20px monospace;color:#ffd24a;text-shadow:0 2px 5px #000;pointer-events:none;';
      host.appendChild(hint);
      this.events.once('shutdown', () => hint.remove());
    }

    this.scale.on('resize', this.layoutDom, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layoutDom, this);
      this.renderer3d?.dispose();
      this.renderer3d = null;
      this.hud?.dispose();
      this.hud = null;
      this.banner?.dispose();
      this.banner = null;
      this.fatalityOverlay?.dispose();
      this.fatalityOverlay = null;
      this.winOverlay?.dispose();
      this.winOverlay = null;
      this.panel?.el.remove();
      this.panel = null;
    });
  }

  private async bootRenderer(): Promise<void> {
    const { ThreeFightRenderer } = await import('../renderer3d/ThreeFightRenderer');
    // DEFAULT: mount the picked match's painted 2D stage art as a 3D parallax
    // bridge (billboards at depths matching the 2D layer factors, over a shadow
    // ground) — the real stage in 3D, no grey test chamber. Dev overrides:
    // ?room=test for the grid chamber, ?room=street for the night-street set.
    const roomParam = new URLSearchParams(window.location.search).get('room');
    // the '3D TEST ROOM' stage pick (or ?room=test) → grey chamber; else the
    // picked stage's painted art as the 2D→3D bridge
    const room =
      this.stageId === 'test-room' || roomParam === 'test'
        ? 'test-room'
        : roomParam === 'street'
          ? 'street'
          : '2d';
    let stage2d;
    if (room === '2d') {
      const entry = stageById(this.stageId);
      const l = entry?.layers;
      stage2d = l
        ? [
            { file: l.sky!.file, factor: l.sky?.factor ?? 0.14 },
            { file: l.far!.file, factor: l.far?.factor ?? 0.34 },
            { file: l.near!.file, factor: l.near?.factor ?? 0.68 },
            { file: l.floor!.file, factor: l.floor?.factor ?? 1 },
          ]
        : entry
          ? [{ file: entry.file, factor: 0.32 }]
          : undefined;
    }
    const renderer = new ThreeFightRenderer(characters, this.chars, room, stage2d);
    // the scene may have shut down while the chunk was loading
    if (!this.scene.isActive()) {
      renderer.dispose();
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
    await renderer.init(this.stageId);
    renderer.applySettings(this.settings);
  }

  // ---------- DOM (Three canvas + HUD components — SPEC T19/T29) ----------

  private mountDom(canvas: HTMLCanvasElement): void {
    const parent = this.game.canvas.parentElement ?? document.body;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    canvas.style.cssText = 'position:absolute;pointer-events:none;';
    parent.appendChild(canvas);
    this.hud = new FightHud(parent, this.chars, characters);
    this.banner = new AnnouncerBanner(parent, this.hud.root);
    this.fatalityOverlay = new FatalityOverlay(parent, characters, this.hud.root);
    this.winOverlay = new WinOverlay(parent, characters, this.hud.root);
    this.layoutDom();
  }


  private layoutDom(): void {
    const r3d = this.renderer3d;
    if (!r3d) return;
    const game = this.game.canvas;
    const parent = game.parentElement ?? document.body;
    const pr = parent.getBoundingClientRect();
    const gr = game.getBoundingClientRect();
    for (const el of [r3d.canvas, this.hud?.root].filter(Boolean) as HTMLElement[]) {
      el.style.left = `${gr.left - pr.left}px`;
      el.style.top = `${gr.top - pr.top}px`;
      el.style.width = `${gr.width}px`;
      el.style.height = `${gr.height}px`;
    }
    r3d.setSize(Math.round(gr.width), Math.round(gr.height));
  }

  /** last written DOM values — the HUD only touches the DOM on change
   *  (innerHTML re-parses and textContent invalidates layout every frame) */
  private hudCache: Record<string, string | number> = {};

  /** center-stage announcement for the current state (see AnnouncerBanner) */
  private bannerMessage(): [string, BannerVariant] {
    const s = this.state;
    const introLen = s.roundNumber === 1 ? s.rules.introTicks : 90;
    switch (s.phase) {
      case 'intro': {
        const left = introLen - s.phaseFrame;
        if (s.roundNumber === 1 && s.rules.introTicks >= 240) {
          if (left > 180) return [s.phaseFrame < 45 ? `ROUND ${s.roundNumber}` : 'READY?', 'pop'];
          if (left > 120) return ['3', 'count'];
          if (left > 60) return ['2', 'count'];
          return ['1', 'count'];
        }
        return [`ROUND ${s.roundNumber}`, 'pop'];
      }
      case 'fight':
        return this.fightEnteredTick >= 0 && s.tick - this.fightEnteredTick < 55
          ? ['FIGHT!', 'slam']
          : ['', 'pop'];
      case 'roundEnd': {
        if (s.roundWinner === null) return ['DOUBLE K.O.', 'slam'];
        if (s.rules.roundTicks > 0 && s.timer <= 0) return ['TIME UP', 'slam'];
        const w = s.fighters[s.roundWinner];
        const perfect = w.health === characters[w.charId].health;
        if (perfect && s.phaseFrame >= 60 && s.phaseFrame < 150) return ['PERFECT', 'shine'];
        return s.phaseFrame < 60 ? ['K.O.!', 'slam'] : ['', 'pop'];
      }
      case 'finisher':
        return ['FINISH THEM', 'pulse'];
      case 'fatality':
        return s.phaseFrame < 70 ? ['FATALITY', 'slam'] : ['', 'pop'];
      default:
        return ['', 'pop'];
    }
  }

  private drawHud(): void {
    if (!this.hud) return;
    const [text, variant] = this.bannerMessage();
    this.banner?.set(text, variant);
    const clip = (slot: 0 | 1): string => {
      const ci = this.renderer3d?.clipInfo(slot);
      return ci ? `${ci.name}${ci.placeholder ? ' *PLACEHOLDER*' : ''}` : '…';
    };
    this.hud.update(this.state, {
      ghost: this.ghostHealth,
      combo: this.comboHits >= 2 && this.comboTicks > 0 ? `${this.comboHits} HITS` : '',
      clips: [clip(0), clip(1)],
      tauntKey: this.tauntKey,
    });
  }



  // ---------- presentation events (SPEC T18/T20/T21/T22) ----------

  /** play() gated on focus: a blurred window suspends the audio context but
   *  the sim keeps stepping — un-gated sounds queue up in the suspended
   *  context and ALL fire at once on refocus. */
  private snd(key: string, volume?: number): void {
    if (document.hasFocus()) play(this, key, volume);
  }

  private voice(charId: string, kind: 'hurt' | 'kiai', volume: number): void {
    if (document.hasFocus()) playVoice(this, charId, kind, volume);
  }

  private handleEvents(events: FightEvent[]): void {
    const s = this.state;
    const r = this.renderer3d;
    for (const e of events) {
      switch (e.type) {
        case 'round-intro':
          play(this, e.round === 2 ? 'ann-round-2' : 'ann-final-round');
          nextTrack();
          break;
        case 'count':
          this.snd('s-block', 0.35); // countdown blip
          break;
        case 'fight-start':
          play(this, 'ann-fight', 1);
          break;
        case 'round-end':
          if (e.timeUp) play(this, 'ann-time-up');
          else if (e.winner === null) play(this, 'ann-double-ko');
          else {
            play(this, 'ann-ko', 1);
            if (e.perfect) this.time.delayedCall(800, () => play(this, 'ann-perfect'));
            // KO gush — MK vibes (SPEC V16)
            const loser = e.winner === 0 ? 1 : 0;
            const lf = s.fighters[loser];
            r?.fx.spawnBlood(lf.x, lf.y - 140, s.fighters[e.winner].facing, 70, s.tick);
            r?.shake(s.tick, 20, 0.06);
          }
          break;
        case 'match-end':
          play(this, `ann-${s.fighters[e.winner].charId}`, 1);
          this.time.delayedCall(900, () => play(this, 'ann-victory', 1));
          playMusic('victory', { keepOnMiss: true, once: true });
          // attract mode loops back to the title so the menu can cycle the demo
          if (this.demo) this.time.delayedCall(6000, () => this.scene.start('Menu'));
          break;
        case 'finisher':
          play(this, 'ann-finish-them', 1);
          r?.shake(s.tick, 12, 0.05);
          break;
        case 'fatality-start':
          play(this, 'ann-fatality', 1);
          r?.shake(s.tick, 28, 0.09);
          break;
        case 'hit': {
          const f = s.fighters[e.slot];
          const atk = s.fighters[e.slot === 0 ? 1 : 0];
          play(this, 's-hit', e.counter ? 1 : undefined);
          if (e.counter) play(this, 's-whoosh', 0.9);
          playVoice(this, f.charId, 'hurt', 0.7);
          this.ghostHoldUntil[e.slot] = s.tick + 32;
          r?.fx.spawnHitFx(s, e.slot, e.counter, e.heavy);
          // blood along the impact velocity — tiered: a whiff of red on light
          // hits, moderate on solid ones, restrained even at the top end
          const amount = Math.min(Math.round(3 + e.damage * (e.heavy || e.counter ? 0.75 : 0.45)), 42);
          r?.fx.spawnBlood(f.x - f.facing * 20, f.y - 150, atk.facing, amount, s.tick);
          r?.flashFighter(e.slot, s.tick, e.counter ? 8 : 4, e.counter ? 0xff2a1a : 0xffffff);
          r?.shake(s.tick, e.counter ? 8 : 5, e.counter ? 0.05 : 0.03);
          this.comboHits = e.comboContinues ? this.comboHits + 1 : 1;
          this.comboTicks = 90;
          break;
        }
        case 'block':
          play(this, 's-block', 0.6);
          r?.fx.spawnBlockFx(s, e.slot);
          break;
        case 'attack-start':
          play(this, 's-whoosh', 0.4);
          if (e.special) playVoice(this, s.fighters[e.slot].charId, 'kiai', 0.8);
          break;
        case 'jump':
          play(this, 's-jump', 0.35);
          break;
        case 'taunt':
          playVoice(this, s.fighters[e.slot].charId, 'kiai', 0.7);
          break;
        case 'dust':
          r?.fx.spawnDust(s, e.slot);
          play(this, 's-hit', 0.3);
          break;
        case 'projectile-spawn':
          play(this, 's-projectile', 0.6);
          break;
        case 'throw-connect':
          play(this, 's-hit', 0.8);
          break;
      }
    }
  }

  private tickGhosts(): void {
    for (const slot of [0, 1] as const) {
      const hp = this.state.fighters[slot].health;
      if (this.state.tick > this.ghostHoldUntil[slot] && this.ghostHealth[slot] > hp) {
        this.ghostHealth[slot] = Math.max(hp, this.ghostHealth[slot] - 2);
      }
      if (hp > this.ghostHealth[slot]) this.ghostHealth[slot] = hp; // new round reset
    }
  }

  update(_time: number, deltaMs: number): void {
    this.session.advance(deltaMs);
    if (this.online && this.state.phase === 'matchEnd') this.armRematch();
    this.renderer3d?.render(this.state);
    this.drawHud();
    this.fatalityOverlay?.sync(this.state);
    this.winOverlay?.sync(this.state);
    this.panel?.setFps(this.game.loop.actualFps, deltaMs);
  }

  // ---------- online rematch (shared RematchLink; see FightScene) ----------

  private armRematch(): void {
    if (this.rematch || !this.online) return;
    this.rematch = new RematchLink(
      this.online,
      characters,
      this.stageId,
      {
        onPrompt: (st) => this.drawRematchPrompt(st),
        onLaunch: (online) => this.scene.start('Select', { online }),
        onLeave: (reason) => this.onRematchLeave(reason),
      },
      (fn) => this.time.delayedCall(0, fn),
    );
  }

  private drawRematchPrompt(st: RematchState): void {
    const msg = st.localReady
      ? st.remoteReady
        ? 'REMATCH! back to select…'
        : `waiting for ${st.remoteName}…`
      : st.remoteReady
        ? `${st.remoteName} wants a REMATCH!  ·  [R] accept   [ESC] quit`
        : 'REMATCH?  [R] play again   ·   [ESC] quit';
    if (!this.rematchEl) {
      const host = this.game.canvas.parentElement ?? document.body;
      const el = document.createElement('div');
      el.style.cssText =
        'position:absolute;left:50%;bottom:26px;transform:translateX(-50%);z-index:60;' +
        'font:bold 18px monospace;color:#ffd24a;background:#1a1020;padding:6px 12px;border-radius:4px;' +
        'text-shadow:0 2px 4px #000;pointer-events:none;white-space:nowrap;';
      host.appendChild(el);
      this.rematchEl = el;
      this.events.once('shutdown', () => el.remove());
    }
    this.rematchEl.textContent = msg;
    this.rematchEl.style.color = st.localReady && st.remoteReady ? '#8fe388' : '#ffd24a';
  }

  private onRematchLeave(reason: string): void {
    if (this.rematchLeft) return;
    this.rematchLeft = true;
    if (this.rematchEl) {
      this.rematchEl.textContent = reason;
      this.rematchEl.style.color = '#ff5a4a';
    }
    this.time.delayedCall(1200, () => this.scene.start('Menu'));
  }
}
