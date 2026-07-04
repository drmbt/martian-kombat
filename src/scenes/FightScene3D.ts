// Dev-only 3D fight scene (?dev=3d — SPEC I.url). Phaser still owns boot,
// input, audio, and scene flow; Three owns a separate canvas mounted over the
// Phaser one. The deterministic engine drives everything — this scene is the
// same step() loop as FightScene with a different presenter (SPEC V1, V7).
import Phaser from 'phaser';
import { initialState, step, TICK_MS } from '../engine';
import type { GameState } from '../engine';
import { characters } from '../data/characters';
import { KeyboardSource } from '../input/keyboard';
import { CpuDriver } from '../ai/bot';
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
  matchEnd: 'MATCH OVER',
};

export class FightScene3D extends Phaser.Scene {
  private chars: [string, string] = ['vincent', 'yulia'];
  private stageId = 'chiba-roof';
  private cpu = false;
  private state!: GameState;
  private inputs!: KeyboardSource;
  private bot: CpuDriver | null = null;
  private accumulator = 0;
  private renderer3d: ThreeFightRenderer | null = null;
  private hud: HTMLDivElement | null = null;
  private skeletonOn = false;
  private settings = { ...DEFAULT_SETTINGS };
  private panel: ReturnType<typeof createSettingsPanel> | null = null;
  private inspectorOn = false;

  constructor() {
    super('Fight3D');
  }

  init(data: { p1?: string; p2?: string; cpu?: boolean; stage?: string }): void {
    this.chars = [data.p1 ?? 'vincent', data.p2 ?? 'yulia'];
    this.stageId = data.stage ?? 'chiba-roof';
    this.cpu = !!data.cpu;
    this.bot = this.cpu ? new CpuDriver(1) : null;
    this.accumulator = 0;
  }

  create(): void {
    this.state = initialState(this.chars[0], this.chars[1], characters);
    this.inputs = new KeyboardSource(this);
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
      this.hud?.remove();
      this.hud = null;
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
    this.events.once('shutdown', () => {
      this.panel?.el.remove();
      this.panel = null;
    });
    await renderer.init(this.stageId);
    renderer.applySettings(this.settings);
  }

  /** Pin the Three canvas + HUD exactly over the Phaser canvas. */
  private mountDom(canvas: HTMLCanvasElement): void {
    const parent = this.game.canvas.parentElement ?? document.body;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    canvas.style.cssText = 'position:absolute;pointer-events:none;';
    const hud = document.createElement('div');
    hud.style.cssText =
      'position:absolute;pointer-events:none;color:#e8e4d8;font:12px monospace;' +
      'text-shadow:0 1px 2px #000;padding:8px 12px;white-space:pre;';
    parent.appendChild(canvas);
    parent.appendChild(hud);
    this.hud = hud;
    this.layoutDom();
  }

  private layoutDom(): void {
    const r3d = this.renderer3d;
    if (!r3d) return;
    const game = this.game.canvas;
    const parent = game.parentElement ?? document.body;
    const pr = parent.getBoundingClientRect();
    const gr = game.getBoundingClientRect();
    for (const el of [r3d.canvas, this.hud].filter(Boolean) as HTMLElement[]) {
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
    const [a, b] = s.fighters;
    const bar = (hp: number, max: number): string => {
      const filled = Math.max(0, Math.round((hp / max) * 20));
      return '█'.repeat(filled) + '░'.repeat(20 - filled);
    };
    const maxA = characters[a.charId].health;
    const maxB = characters[b.charId].health;
    const label = s.phase === 'intro' ? `ROUND ${s.roundNumber}` : PHASE_LABEL[s.phase];
    const clock = s.rules.roundTicks ? ` ${Math.ceil(s.timer / 60)}` : '';
    // active clip per fighter, PLACEHOLDER-flagged when a fallback plays (V12)
    const clip = (slot: 0 | 1): string => {
      const c = this.renderer3d?.clipInfo(slot);
      return c ? `${c.name}${c.placeholder ? ' *PLACEHOLDER*' : ''}` : '…';
    };
    this.hud.textContent =
      `${a.charId.toUpperCase()} ${bar(a.health, maxA)}  ${s.wins[0]}★` +
      `  ${label}${clock}  ` +
      `${s.wins[1]}★ ${bar(b.health, maxB)} ${b.charId.toUpperCase()}\n` +
      `[F1] hitboxes  [F2] skeleton  [F3] inspector  [F4] settings  [F9] rematch  [ESC] menu\n` +
      `clips: ${clip(0)} | ${clip(1)}`;
  }

  update(_time: number, deltaMs: number): void {
    this.accumulator += Math.min(deltaMs, 100);
    while (this.accumulator >= TICK_MS) {
      const p1 = this.inputs.poll(0);
      const p2 = this.bot ? this.bot.poll(this.state) : this.inputs.poll(1);
      step(this.state, [p1, p2], characters);
      this.accumulator -= TICK_MS;
    }
    this.renderer3d?.render(this.state);
    this.drawHud();
    this.panel?.setFps(this.game.loop.actualFps, deltaMs);
  }
}
