// The shared "fight shell": everything around the fight that isn't
// rendering fighters — pause menu + pause state, the canonical key wiring
// (ESC pause · F1 hitboxes · F2 move log · R/ENTER/F9/click match-end nav),
// gamepad menu navigation, demo-mode exits, the F2 move log, and the online
// rematch handshake. Both FightScene (2D) and FightScene3D compose ONE of
// these, so a navigation/UX fix lands in both renderers by construction.
import Phaser from 'phaser';
import type { Defs, GameState, InputFrame } from '../engine';
import type { OnlineFightData } from '../net/lobby';
import { RematchLink } from '../net/rematch';
import { menuNav, navDefer } from '../input/menu-nav';
import { play } from './BootScene';
import { MoveLogModel } from '../presentation/moveLog';
import type { UiLayer } from '../ui/layer';
import { PauseMenu } from '../ui/PauseMenu';
import { MoveLogOverlay } from '../ui/MoveLogOverlay';
import { RematchPrompt } from '../ui/RematchPrompt';
import { DemoHint } from '../ui/DemoHint';

export interface FightShellOpts {
  layer: UiLayer;
  defs: Defs;
  chars: [string, string];
  stageId: string;
  online: OnlineFightData | null;
  cpu: boolean;
  training: boolean;
  demo: boolean;
  /** demo was explicitly chosen from the menu ("DEMO MATCH"), not idle-triggered
   *  attract mode — it plays to the finish; only ESC/Start opens a quit menu */
  showcase?: boolean;
  /** dev-only move tuner (see FightScene) — rides into restart/character select */
  tuner?: boolean;
  /** dev-only sprite editor (see FightScene) — rides into restart/character select */
  spriteEditor?: boolean;
  /** dev-only Character Studio (see FightScene) — rides into restart/character select */
  studio?: boolean;
  /** studio deep link: which module opens active */
  module?: string;
  /** which renderer this shell serves — rides into character select */
  render3d: boolean;
  /** live engine state accessor (scenes reassign state on restart) */
  state: () => GameState;
  /** renderer-specific debug keys (F1 hitboxes, F3 stage-guide/skeleton, …) */
  debugKeys?: { key: string; act: () => void }[];
  /** pause-menu hotkey hint line (renderer keymaps differ past F2) */
  pauseHint?: string;
}

export class FightShell {
  paused = false;
  /** shared F2 move-log model — scenes feed it from their tick hooks */
  readonly moveLog = new MoveLogModel();
  moveLogOn: boolean;
  private pauseMenu: PauseMenu | null = null;
  private moveLogOverlay: MoveLogOverlay;
  private rematch: RematchLink | null = null;
  private rematchPrompt: RematchPrompt | null = null;
  private rematchLeft = false;
  /** ignore pad/click "advance" for a beat after matchEnd (the KO punch is
   *  usually still held) — armed by the scene's match-end event */
  private endNavArmedAt = 0;

  constructor(
    private scene: Phaser.Scene,
    private opts: FightShellOpts,
  ) {
    this.moveLogOn = opts.training; // sandbox shows the move log by default
    this.moveLogOverlay = new MoveLogOverlay(opts.layer.root);
    this.moveLogOverlay.setVisible(this.moveLogOn);

    const kb = scene.input.keyboard!;
    const debugKeys = new Set(['F2', ...(opts.debugKeys ?? []).map((d) => d.key.toUpperCase())]);
    const registerDebugKeys = (): void => {
      kb.on('keydown-F2', () => {
        this.moveLogOn = !this.moveLogOn;
        this.moveLogOverlay.setVisible(this.moveLogOn);
      });
      for (const d of opts.debugKeys ?? []) kb.on(`keydown-${d.key}`, d.act);
    };
    const isDebugKey = (e: KeyboardEvent): boolean => debugKeys.has(e.key.toUpperCase());

    if (opts.demo) {
      registerDebugKeys();
      if (opts.showcase) {
        // explicitly chosen from the menu (DEMO MATCH): plays out to the
        // finish (auto-returns to the menu after the win screen, see
        // FightScene/FightScene3D) — ESC or a pad Start/Select press interrupts
        // it via the same pause menu a human match uses. Debug keys stay live.
        this.pauseMenu = new PauseMenu(
          opts.layer.root,
          [opts.defs[opts.chars[0]], opts.defs[opts.chars[1]]],
          [
            { label: 'RESUME', act: () => this.togglePause() },
            { label: 'MAIN MENU', act: () => this.toMainMenu() },
          ],
          { hint: opts.pauseHint, onNavSound: () => play(scene, 's-blip', 0.4) },
        );
        kb.on('keydown-ESC', () => this.togglePause());
        // R restarts the current CPU-vs-CPU matchup at any time
        kb.on('keydown-R', () => this.restartMatch());
        return;
      }
      // idle-triggered attract mode: a blinking banner, and ANY input returns
      // to the title, except debug/perf keys; pad exit polled in frame().
      new DemoHint(opts.layer.root); // torn down with the layer on shutdown
      kb.on('keydown', (e: KeyboardEvent) => {
        if (e.key !== '`' && !isDebugKey(e)) this.toMainMenu();
      });
      scene.input.on('pointerdown', () => this.toMainMenu());
      return; // navigation keybinds below do not apply to idle attract
    }

    this.pauseMenu = new PauseMenu(
      opts.layer.root,
      [opts.defs[opts.chars[0]], opts.defs[opts.chars[1]]],
      [
        { label: 'RESUME', act: () => this.togglePause() },
        { label: 'RESTART', act: () => this.restartMatch() },
        { label: 'CHARACTER SELECT', act: () => this.toCharacterSelect() },
        { label: 'MAIN MENU', act: () => this.toMainMenu() },
      ],
      {
        hint: opts.pauseHint,
        onNavSound: () => play(scene, 's-blip', 0.4),
      },
    );

    // --- the canonical fight keymap (identical across renderers) ---
    kb.on('keydown-ESC', () => {
      // online can't pause (V23); ESC at matchEnd quits the match instead
      if (this.opts.online) {
        if (this.opts.state().phase === 'matchEnd') this.rematch?.leave('you left');
        return;
      }
      this.togglePause();
    });
    kb.on('keydown-F2', () => {
      this.moveLogOn = !this.moveLogOn;
      this.moveLogOverlay.setVisible(this.moveLogOn);
    });
    for (const d of opts.debugKeys ?? []) kb.on(`keydown-${d.key}`, d.act);
    kb.on('keydown-R', () => {
      if (this.opts.state().phase !== 'matchEnd') return;
      if (this.opts.online) this.optInRematch();
      else this.restartMatch();
    });
    kb.on('keydown-ENTER', () => {
      // tuner/sprite editor: ENTER types into number inputs / triggers buttons
      // in the DOM sidebar — it must never also bail out to char select underneath
      if (this.opts.tuner || this.opts.spriteEditor) return;
      if (this.opts.online && this.opts.state().phase === 'matchEnd') this.optInRematch();
      else if (this.opts.training) this.toCharacterSelect();
      else if (this.opts.state().phase === 'matchEnd') this.toCharacterSelect();
    });
    // quick local restart, any time (not just matchEnd)
    kb.on('keydown-F9', () => {
      if (!this.opts.online) this.restartMatch();
    });
    // clicking through the win-quote screen: rematch online, else char select
    scene.input.on('pointerdown', () => {
      if (this.opts.state().phase !== 'matchEnd') return;
      if (scene.time.now < this.endNavArmedAt) return;
      if (this.opts.online) this.optInRematch();
      else this.toCharacterSelect();
    });
  }

  // ---------- per-frame driving (call at the top of scene.update) ----------

  /** Pad menu nav + overlay upkeep. Returns false while paused — the scene
   *  must then resetPacing() and skip the sim (renderers may still draw). */
  frame(): boolean {
    this.padMenuFrame();
    if (this.moveLogOn) this.moveLogOverlay.update(this.moveLog);
    if (this.opts.online && this.opts.state().phase === 'matchEnd') this.armRematch();
    return !this.paused;
  }

  /** Gamepad handling for everything that isn't the fight itself: the
   *  attract demo, the pause dialog, the win screen, and Start/Select
   *  opening the pause menu mid-match. */
  private padMenuFrame(): void {
    const n = menuNav.poll();
    if (this.paused) {
      if (n.left || n.up) this.pauseMenu?.move(-1);
      if (n.right || n.down) this.pauseMenu?.move(1);
      if (n.confirm) {
        play(this.scene, 's-blip', 0.5);
        // the button may restart / change scenes — defer, see navDefer
        navDefer(this.scene, () => this.pauseMenu?.confirm());
        return;
      }
      if (n.start || n.menu) this.togglePause(); // Start/Select resumes
      return;
    }
    if (this.opts.demo) {
      if (this.opts.showcase) {
        // chosen from the menu: only Start/Select opens the quit menu
        if (n.start || n.menu) this.togglePause();
        return;
      }
      // idle-triggered attract mode: any fresh pad input returns to the title
      if (n.confirm || n.start || n.menu || n.up || n.down || n.left || n.right) {
        navDefer(this.scene, () => this.toMainMenu());
      }
      return;
    }
    if (this.opts.state().phase === 'matchEnd') {
      // online: confirm = opt into a rematch, Select = quit the match
      if (this.opts.online) {
        if (this.scene.time.now < this.endNavArmedAt) return;
        if (n.confirm || n.start) navDefer(this.scene, () => this.optInRematch());
        else if (n.menu) navDefer(this.scene, () => this.rematch?.leave('you left'));
        return;
      }
      // Select brings up the full menu (rematch / char select / main menu)
      if (n.menu) {
        this.togglePause();
        return;
      }
      if (this.scene.time.now < this.endNavArmedAt) return;
      if (n.confirm || n.start) navDefer(this.scene, () => this.toCharacterSelect()); // any attack advances
      return;
    }
    // live match: Start or Select opens the pause menu
    if (n.start || n.menu) this.togglePause();
  }

  // ---------- tick-hook feeders (scenes call from session hooks/events) ----------

  logInputs(frames: [InputFrame, InputFrame]): void {
    this.moveLog.logInputs(frames);
  }

  logMove(slot: 0 | 1): void {
    this.moveLog.logMove(slot, this.opts.state(), this.opts.defs);
  }

  /** call on the match-end event: guards nav from the still-held KO punch */
  armEndNav(): void {
    this.endNavArmedAt = this.scene.time.now + 700;
  }

  // ---------- navigation ----------

  private togglePause(): void {
    // online can't freeze the sim — the other player is still fighting (V23)
    if (this.opts.online) return;
    this.paused = !this.paused;
    this.pauseMenu?.setVisible(this.paused);
  }

  private restartMatch(): void {
    const o = this.opts;
    // keep showcase so a CPU-vs-CPU demo restarts as CPU-vs-CPU (not human P1)
    this.scene.scene.restart({ p1: o.chars[0], p2: o.chars[1], cpu: o.cpu, training: o.training, showcase: o.showcase, tuner: o.tuner, spriteEditor: o.spriteEditor, studio: o.studio, module: o.module, stage: o.stageId });
  }

  toCharacterSelect(): void {
    const o = this.opts;
    // showcase rides back to the CPU-vs-CPU select so you can pick a new matchup
    this.scene.scene.start('Select', { cpu: o.cpu, training: o.training, showcase: o.showcase, tuner: o.tuner, spriteEditor: o.spriteEditor, studio: o.studio, module: o.module, render3d: o.render3d });
  }

  toMainMenu(): void {
    this.scene.scene.start('Menu');
  }

  // ---------- online rematch (same channel; RematchLink does the wire) ----------

  private armRematch(): void {
    if (this.rematch || !this.opts.online) return;
    this.rematch = new RematchLink(
      this.opts.online,
      this.opts.defs,
      this.opts.stageId,
      {
        onPrompt: (st) => {
          if (!this.rematchPrompt) this.rematchPrompt = new RematchPrompt(this.opts.layer.root);
          this.rematchPrompt.set(st);
        },
        onLaunch: (online) => this.scene.scene.start('Select', { online }),
        onLeave: (reason) => {
          if (this.rematchLeft) return;
          this.rematchLeft = true;
          this.rematchPrompt?.leave(reason);
          this.scene.time.delayedCall(1200, () => this.scene.scene.start('Menu'));
        },
      },
      (fn) => this.scene.time.delayedCall(0, fn),
    );
  }

  private optInRematch(): void {
    play(this.scene, 's-blip', 0.6);
    this.rematch?.optIn();
  }
}
