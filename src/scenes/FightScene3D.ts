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
import { play, playVoice } from './BootScene';
import { nextTrack, playMusic } from '../audio/music';
import { diffTick, snapTick, type FightEvent } from '../presentation/tickEvents';
// three is dev-path-only: type-only import here, the real module loads
// dynamically in create() so the production 2D bundle never ships it
import type { ThreeFightRenderer } from '../renderer3d/ThreeFightRenderer';
import { createSettingsPanel, DEFAULT_SETTINGS } from '../renderer3d/threeRenderSettings';

const PHASE_LABEL: Record<GameState['phase'], string> = {
  intro: 'ROUND',
  fight: '',
  roundEnd: 'KO',
  finisher: 'FINISH THEM',
  fatality: 'FATALITY',
  matchEnd: 'MATCH OVER — F9 REMATCH',
};

interface HudRefs {
  root: HTMLDivElement;
  bars: [HTMLDivElement, HTMLDivElement];
  ghosts: [HTMLDivElement, HTMLDivElement];
  wins: [HTMLSpanElement, HTMLSpanElement];
  timer: HTMLDivElement;
  label: HTMLDivElement;
  combo: HTMLDivElement;
  info: HTMLDivElement;
}

export class FightScene3D extends Phaser.Scene {
  private chars: [string, string] = ['vincent', 'vincent'];
  private stageId = 'chiba-roof';
  private cpu = false;
  private state!: GameState;
  private inputs!: KeyboardSource;
  private bot: CpuDriver | null = null;
  private accumulator = 0;
  private renderer3d: ThreeFightRenderer | null = null;
  private hud: HudRefs | null = null;
  private skeletonOn = false;
  private settings = { ...DEFAULT_SETTINGS };
  private panel: ReturnType<typeof createSettingsPanel> | null = null;
  private inspectorOn = false;
  private comboHits = 0;
  private comboTicks = 0;
  private ghostHealth: [number, number] = [0, 0];
  private ghostHoldUntil: [number, number] = [0, 0];
  private fatalityEl: HTMLDivElement | null = null;
  private fatalityImgs: HTMLImageElement[] = [];
  private winEl: HTMLDivElement | null = null;

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
    this.state = initialState(this.chars[0], this.chars[1], characters);
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
    kb.on('keydown-ESC', () => this.scene.start('Menu'));
    kb.on('keydown-F9', () =>
      this.scene.restart({ p1: this.chars[0], p2: this.chars[1], cpu: this.cpu, stage: this.stageId }),
    );

    this.scale.on('resize', this.layoutDom, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layoutDom, this);
      this.renderer3d?.dispose();
      this.renderer3d = null;
      this.hud?.root.remove();
      this.hud = null;
      this.panel?.el.remove();
      this.panel = null;
      this.fatalityEl?.remove();
      this.fatalityEl = null;
      this.fatalityImgs = [];
      this.winEl?.remove();
      this.winEl = null;
    });
  }

  private async bootRenderer(): Promise<void> {
    const { ThreeFightRenderer } = await import('../renderer3d/ThreeFightRenderer');
    const renderer = new ThreeFightRenderer(characters, this.chars);
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

  // ---------- DOM (Three canvas + HUD reusing 2D art assets — SPEC T19) ----------

  private mountDom(canvas: HTMLCanvasElement): void {
    const parent = this.game.canvas.parentElement ?? document.body;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    canvas.style.cssText = 'position:absolute;pointer-events:none;';
    parent.appendChild(canvas);
    this.hud = this.buildHud(parent);
    this.layoutDom();
  }

  private buildHud(parent: HTMLElement): HudRefs {
    const root = document.createElement('div');
    root.style.cssText =
      'position:absolute;pointer-events:none;color:#e8e4d8;font:12px monospace;' +
      'text-shadow:0 1px 2px #000;overflow:hidden;';

    const side = (slot: 0 | 1): { wrap: HTMLDivElement; bar: HTMLDivElement; ghost: HTMLDivElement; wins: HTMLSpanElement } => {
      const id = this.chars[slot];
      const wrap = document.createElement('div');
      wrap.style.cssText =
        `position:absolute;top:10px;${slot === 0 ? 'left' : 'right'}:12px;width:42%;` +
        `display:flex;gap:8px;align-items:flex-start;${slot === 1 ? 'flex-direction:row-reverse;' : ''}`;
      const img = document.createElement('img');
      img.src = `${import.meta.env.BASE_URL}assets/portraits/${id}.png`;
      img.style.cssText = 'width:52px;height:52px;object-fit:cover;border:2px solid #d8d2c0;background:#222;';
      img.onerror = () => (img.style.display = 'none');
      const col = document.createElement('div');
      col.style.cssText = 'flex:1;';
      const name = document.createElement('div');
      name.textContent = id.toUpperCase();
      name.style.cssText = `margin-bottom:3px;${slot === 1 ? 'text-align:right;' : ''}`;
      const barOuter = document.createElement('div');
      barOuter.style.cssText =
        'position:relative;height:14px;background:#3a1010;border:2px solid #d8d2c0;overflow:hidden;';
      const ghost = document.createElement('div');
      ghost.style.cssText =
        `position:absolute;top:0;${slot === 0 ? 'right' : 'left'}:0;height:100%;width:100%;background:#c8452c;`;
      const bar = document.createElement('div');
      bar.style.cssText =
        `position:absolute;top:0;${slot === 0 ? 'right' : 'left'}:0;height:100%;width:100%;background:#e8c832;`;
      barOuter.append(ghost, bar);
      const wins = document.createElement('span');
      wins.style.cssText =
        `display:block;color:#ffd75e;font-size:20px;line-height:1.2;letter-spacing:3px;` +
        `text-shadow:0 1px 3px #000;${slot === 1 ? 'text-align:right;' : ''}`;
      col.append(name, barOuter, wins);
      wrap.append(img, col);
      root.appendChild(wrap);
      return { wrap, bar, ghost, wins };
    };

    const left = side(0);
    const right = side(1);

    const timer = document.createElement('div');
    timer.style.cssText =
      'position:absolute;top:14px;left:50%;transform:translateX(-50%);font-size:28px;font-weight:bold;';
    const label = document.createElement('div');
    label.style.cssText =
      'position:absolute;top:52px;left:50%;transform:translateX(-50%);font-size:16px;color:#ff5e4a;white-space:nowrap;';
    const combo = document.createElement('div');
    combo.style.cssText =
      'position:absolute;top:34%;left:18%;font-size:22px;font-weight:bold;color:#ffd75e;display:none;';
    const info = document.createElement('div');
    info.style.cssText = 'position:absolute;left:12px;bottom:8px;white-space:pre;opacity:.8;';
    root.append(timer, label, combo, info);
    parent.appendChild(root);

    return {
      root,
      bars: [left.bar, right.bar],
      ghosts: [left.ghost, right.ghost],
      wins: [left.wins, right.wins],
      timer,
      label,
      combo,
      info,
    };
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

  private drawHud(): void {
    if (!this.hud) return;
    const s = this.state;
    for (const slot of [0, 1] as const) {
      const f = s.fighters[slot];
      const max = characters[f.charId].health;
      this.hud.bars[slot].style.width = `${Math.max(0, (f.health / max) * 100)}%`;
      this.hud.ghosts[slot].style.width = `${Math.max(0, (this.ghostHealth[slot] / max) * 100)}%`;
      const empty = Math.max(0, s.rules.winsNeeded - s.wins[slot]);
      this.hud.wins[slot].innerHTML =
        '★'.repeat(s.wins[slot]) + (empty ? `<span style="color:#5d5748;">${'☆'.repeat(empty)}</span>` : '');
    }
    this.hud.timer.textContent = s.rules.roundTicks ? String(Math.max(0, Math.ceil(s.timer / 60))) : '∞';
    this.hud.label.textContent = s.phase === 'intro' ? `ROUND ${s.roundNumber}` : PHASE_LABEL[s.phase];
    if (this.comboHits >= 2 && this.comboTicks > 0) {
      this.hud.combo.style.display = 'block';
      this.hud.combo.textContent = `${this.comboHits} HITS`;
    } else {
      this.hud.combo.style.display = 'none';
    }
    const clip = (slot: 0 | 1): string => {
      const c = this.renderer3d?.clipInfo(slot);
      return c ? `${c.name}${c.placeholder ? ' *PLACEHOLDER*' : ''}` : '…';
    };
    this.hud.info.textContent =
      `[F1] hitboxes  [F2] skeleton  [F3] inspector  [F4] settings  [F9] rematch  [ESC] menu\n` +
      `clips: ${clip(0)} | ${clip(1)}`;
  }

  // ---------- fatality panels + win screen (SPEC T27, reusing 2D art) ----------

  /** Full-bleed panel slideshow driven by phaseFrame — same jpgs as 2D. */
  private syncFatalityOverlay(): void {
    const s = this.state;
    const parent = this.hud?.root.parentElement;
    if (s.phase !== 'fatality' || !s.fatality || !parent) {
      if (this.fatalityEl) this.fatalityEl.style.display = 'none';
      return;
    }
    const owner = s.fighters[s.fatality.owner];
    const def = characters[owner.charId];
    const panels = def.fatality?.panels ?? 0;
    if (!panels) return;
    if (!this.fatalityEl) {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;inset:0;background:#000;pointer-events:none;z-index:3;';
      for (let n = 1; n <= panels; n++) {
        const img = document.createElement('img');
        img.src = `${import.meta.env.BASE_URL}assets/fatalities/${owner.charId}/${s.fatality.id}-${n}.jpg`;
        img.style.cssText =
          'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .25s;';
        el.appendChild(img);
        this.fatalityImgs.push(img);
      }
      // layout: pin over the game canvas like the HUD
      const hudStyle = this.hud!.root.style;
      el.style.left = hudStyle.left;
      el.style.top = hudStyle.top;
      el.style.width = hudStyle.width;
      el.style.height = hudStyle.height;
      el.style.inset = '';
      parent.appendChild(el);
      this.fatalityEl = el;
    }
    this.fatalityEl.style.display = 'block';
    const idx = Math.min(Math.floor(s.phaseFrame / (460 / panels)), panels - 1);
    this.fatalityImgs.forEach((img, i) => (img.style.opacity = i === idx ? '1' : '0'));
  }

  /** Win-quote screen: winner portrait, beaten loser bust, random taunt. */
  private syncWinOverlay(): void {
    const s = this.state;
    const parent = this.hud?.root.parentElement;
    if (s.phase !== 'matchEnd' || s.roundWinner === null || !parent) {
      if (this.winEl) this.winEl.style.display = 'none';
      return;
    }
    if (this.winEl) return; // built once; stays until rematch/exit
    const winner = s.fighters[s.roundWinner];
    const loser = s.fighters[s.roundWinner === 0 ? 1 : 0];
    const wDef = characters[winner.charId];
    const quotes = wDef.winQuotes ?? ['...'];
    const quote = quotes[s.tick % quotes.length];
    const base = import.meta.env.BASE_URL;
    const el = document.createElement('div');
    const hudStyle = this.hud!.root.style;
    el.style.cssText =
      `position:absolute;left:${hudStyle.left};top:${hudStyle.top};width:${hudStyle.width};height:${hudStyle.height};` +
      'background:rgba(5,6,12,.82);color:#e8e4d8;font:14px monospace;pointer-events:none;z-index:4;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;';
    el.innerHTML =
      `<div style="display:flex;gap:40px;align-items:flex-end;">` +
      `<img src="${base}assets/portraits/${winner.charId}.png" style="width:130px;border:3px solid #e8c832;background:#222;">` +
      `<img src="${base}assets/portraits/${loser.charId}-ko.png" onerror="this.src='${base}assets/portraits/${loser.charId}.png';this.style.filter='grayscale(1)'" style="width:110px;border:3px solid #555;background:#222;">` +
      `</div>` +
      `<div style="font-size:20px;color:#ffd75e;">${wDef.name.toUpperCase()} WINS</div>` +
      `<div style="max-width:70%;">“${quote}”</div>` +
      `<div style="opacity:.6;">[F9] rematch · [ESC] menu</div>`;
    parent.appendChild(el);
    this.winEl = el;
  }

  // ---------- presentation events (SPEC T18/T20/T21/T22) ----------

  private handleEvents(events: FightEvent[]): void {
    const s = this.state;
    const r = this.renderer3d;
    for (const e of events) {
      switch (e.type) {
        case 'round-intro':
          play(this, e.round === 2 ? 'ann-round-2' : 'ann-final-round');
          nextTrack();
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
    this.accumulator += Math.min(deltaMs, 100);
    while (this.accumulator >= TICK_MS) {
      const prev = snapTick(this.state);
      const p1 = this.inputs.poll(0);
      const p2 = this.bot ? this.bot.poll(this.state) : this.inputs.poll(1);
      step(this.state, [p1, p2], characters);
      this.handleEvents(diffTick(prev, this.state, characters));
      this.tickGhosts();
      if (this.comboTicks > 0 && --this.comboTicks === 0) this.comboHits = 0;
      this.accumulator -= TICK_MS;
    }
    this.renderer3d?.render(this.state);
    this.drawHud();
    this.syncFatalityOverlay();
    this.syncWinOverlay();
    this.panel?.setFps(this.game.loop.actualFps, deltaMs);
  }
}
