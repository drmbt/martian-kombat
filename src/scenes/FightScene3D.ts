// Dev-only 3D fight scene (?dev=3d — SPEC I.url). Phaser still owns boot,
// input, audio, and scene flow; Three owns a separate canvas mounted over the
// Phaser one. The deterministic engine drives everything — this scene is the
// same step() loop as FightScene with a different presenter (SPEC V1, V7).
// Presentation events come from the shared pure diffTick (SPEC V15); sounds
// and music reuse the exact 2D helpers and asset keys.
import Phaser from 'phaser';
import { initialState, step, TICK_MS } from '../engine';
import type { GameState } from '../engine';
import { characters } from '../data/characters';
import { KeyboardSource } from '../input/keyboard';
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
  private state!: GameState;
  private inputs!: KeyboardSource;
  private bot: CpuDriver | null = null;
  private accumulator = 0;
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
  private comboHits = 0;
  private comboTicks = 0;
  private ghostHealth: [number, number] = [0, 0];
  private ghostHoldUntil: [number, number] = [0, 0];

  constructor() {
    super('Fight3D');
  }

  init(data: { p1?: string; p2?: string; cpu?: boolean; stage?: string }): void {
    this.chars = [data.p1 ?? 'vincent', data.p2 ?? 'vincent'];
    this.stageId = data.stage ?? 'chiba-roof';
    this.cpu = !!data.cpu;
    this.bot = this.cpu ? new CpuDriver(1) : null;
    this.accumulator = 0;
    this.comboHits = 0;
    this.comboTicks = 0;
  }

  create(): void {
    // 3D arena is wider than the 2D 960px stage — symmetric around center so
    // the engine->Three mapping stays put (engine V: rules.stage)
    this.state = initialState(this.chars[0], this.chars[1], characters, {
      stage: { minX: -110, maxX: 1070 },
      // room for the entry gesture + READY? 3-2-1 before FIGHT
      introTicks: 240,
    });
    this.inputs = new KeyboardSource(this);
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
    kb.on('keydown-F3', () => {
      if (this.inspectorOn) return;
      this.inspectorOn = true;
      void this.renderer3d?.enableInspector();
    });
    kb.on('keydown-F4', () => {
      if (!this.panel) return;
      this.panel.el.style.display = this.panel.el.style.display === 'none' ? 'block' : 'none';
    });
    kb.on('keydown-T', () => {
      this.renderer3d?.taunt(0, this.state.tick);
      this.voice(this.chars[0], 'kiai', 0.6);
    });
    kb.on('keydown-ESC', () => this.scene.start('Menu'));
    kb.on('keydown-F9', () =>
      this.scene.restart({ p1: this.chars[0], p2: this.chars[1], cpu: this.cpu, stage: this.stageId }),
    );

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
    // dev placeholder rooms: grey test chamber (default), ?room=street for
    // the night-street stage, ?room=2d for the painted-2D-stage bridge
    // (billboards at parallax-matched depths; uses this match's stageId)
    const roomParam = new URLSearchParams(window.location.search).get('room');
    const room = roomParam === 'street' ? 'street' : roomParam === '2d' ? '2d' : 'test-room';
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
    // KO slow-mo (2D parity): the round-ending hit plays out at ~1/3 speed —
    // pure presentation, ticks advance identically, just spaced out
    const s = this.state;
    const koSlow =
      (s.phase === 'roundEnd' || s.phase === 'finisher') &&
      s.phaseFrame < 55 &&
      s.fighters.some((f) => f.health <= 0);
    this.accumulator += Math.min(deltaMs, 100) * (koSlow ? 0.35 : 1);
    while (this.accumulator >= TICK_MS) {
      const prev = snapTick(this.state);
      const p1 = this.inputs.poll(0);
      const p2 = this.bot ? this.bot.poll(this.state) : this.inputs.poll(1);
      step(this.state, [p1, p2], characters);
      if (prev.phase !== 'fight' && this.state.phase === 'fight') {
        this.fightEnteredTick = this.state.tick;
      }
      this.handleEvents(diffTick(prev, this.state, characters));
      this.tickGhosts();
      if (this.comboTicks > 0 && --this.comboTicks === 0) this.comboHits = 0;
      this.accumulator -= TICK_MS;
    }
    this.renderer3d?.render(this.state);
    this.drawHud();
    this.fatalityOverlay?.sync(this.state);
    this.winOverlay?.sync(this.state);
    this.panel?.setFps(this.game.loop.actualFps, deltaMs);
  }
}
