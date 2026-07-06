// Online lobby (SPEC T39/T41). Host creates a room and shows a code; guest
// types the code to join. Once the DataChannel is open both players pick a
// character; the LobbyController (V21) verifies compatibility and hands the
// agreed config to FightScene, which runs the match on a NetSession.
//
// This scene is the thin presenter — all negotiation logic lives in
// src/net/lobby.ts (unit-tested) and the transport in src/net/webrtc.ts.
// peerjs is dynamically imported so the offline 2D bundle never ships it.
import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { play } from './BootScene';
import { playMusic } from '../audio/music';
import { characters } from '../data/characters';
import { menuNav, navDefer } from '../input/menu-nav';
import { getSettings } from '../settings';
import { LobbyController, type OnlineSelectData } from '../net/lobby';
import { STAGE3D_BOUNDS } from '../renderer3d/threeCoordinates';
import type { PeerLink } from '../net/webrtc';
import type { Transport } from '../net/transport';

type Screen = 'choose' | 'host' | 'join' | 'error';

export class LobbyScene extends Phaser.Scene {
  private screen: Screen = 'choose';
  private link: PeerLink | null = null;
  private transport: Transport | null = null;
  private controller: LobbyController | null = null;
  private isHost = false;
  private localSlot: 0 | 1 = 0;
  /** renderer for this session — host carries the menu toggle in; the guest's
   *  is adopted from the host over the wire (inside the controller) before the
   *  SelectScene hand-off, so 2D and 3D can never cross-join. */
  private render3d = false;
  /** the paste-anywhere handler, detached on shutdown */
  private pasteHandler: ((e: ClipboardEvent) => void) | null = null;

  private joinCode = '';
  private statusLine = '';
  private launched = false;

  // built per screen; cleared on redraw
  private layer: Phaser.GameObjects.GameObject[] = [];
  private buttons: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; act: () => void }[] = [];
  private selIdx = 0;

  constructor() {
    super('Lobby');
  }

  init(data: { render3d?: boolean }): void {
    // host carries the menu's render toggle in; the guest's mode is adopted
    // from the host inside the controller before Select
    this.render3d = !!data.render3d;
  }

  create(): void {
    playMusic('menu');
    this.resetState();
    // paste the room code from anywhere on the page (not just a focused field)
    this.pasteHandler = (e: ClipboardEvent) => this.onPaste(e);
    window.addEventListener('paste', this.pasteHandler);
    this.add.rectangle(STAGE_W / 2, STAGE_H / 2, STAGE_W, STAGE_H, 0x0c0910, 0.85).setDepth(-1);
    if (this.textures.exists('bg-salton')) {
      this.add.image(STAGE_W / 2, STAGE_H / 2, 'bg-salton').setDisplaySize(STAGE_W, STAGE_H).setAlpha(0.25).setDepth(-2);
    }
    this.input.keyboard!.on('keydown-ESC', () => this.leave());
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.events.once('shutdown', () => this.teardown());
    this.renderChoose();
  }

  private resetState(): void {
    this.screen = 'choose';
    this.link = null;
    this.transport = null;
    this.controller = null;
    this.joinCode = '';
    this.statusLine = '';
    this.launched = false;
    this.selIdx = 0;
  }

  // ---------- screen: choose HOST / JOIN ----------

  private renderChoose(): void {
    this.screen = 'choose';
    this.clearLayer();
    this.title('ONLINE VERSUS');
    this.subtitle('play a friend over the internet · WebRTC peer-to-peer');
    this.makeButtons([
      { label: 'HOST A MATCH', act: () => this.startHost() },
      { label: 'JOIN A MATCH', act: () => this.startJoin() },
      { label: 'BACK', act: () => this.leave() },
    ]);
  }

  // ---------- host ----------

  private async startHost(): Promise<void> {
    this.isHost = true;
    this.localSlot = 0;
    this.screen = 'host';
    this.statusLine = 'creating room…';
    this.clearLayer();
    this.title('HOSTING');
    this.subtitle('share this code with your opponent');
    try {
      const { hostRoom } = await import('../net/webrtc');
      const link = hostRoom();
      this.link = link;
      this.renderHostCode(link.code);
      const transport = await link.transport;
      this.onConnected(transport);
    } catch (err) {
      this.fail(err instanceof Error ? err.message : 'failed to host');
    }
  }

  private renderHostCode(code: string): void {
    this.clearLayer();
    this.title('HOSTING');
    this.subtitle(`${this.modeTag()} match — share this code, waiting for your opponent`);
    const codeText = this.add
      .text(STAGE_W / 2, 250, code, {
        fontFamily: 'monospace', fontSize: '72px', fontStyle: 'bold', color: '#ffd24a',
        stroke: '#2a0a0a', strokeThickness: 10,
      })
      .setOrigin(0.5);
    this.layer.push(codeText);
    this.makeButtons([
      {
        label: 'COPY CODE',
        act: () => {
          void navigator.clipboard?.writeText(code).catch(() => undefined);
          play(this, 's-blip', 0.5);
          this.setStatus('copied to clipboard');
        },
      },
      { label: 'CANCEL', act: () => this.leave() },
    ]);
    this.setStatus('waiting for opponent…');
  }

  // ---------- join ----------

  private startJoin(): void {
    this.isHost = false;
    this.localSlot = 1;
    this.screen = 'join';
    this.joinCode = '';
    this.renderJoin();
  }

  private renderJoin(): void {
    this.clearLayer();
    this.title('JOIN A MATCH');
    this.subtitle('type the room code, then press ENTER');
    const box = this.add
      .text(STAGE_W / 2, 250, this.joinCodeDisplay(), {
        fontFamily: 'monospace', fontSize: '64px', fontStyle: 'bold', color: '#ffd24a',
        stroke: '#2a0a0a', strokeThickness: 10,
      })
      .setOrigin(0.5);
    this.layer.push(box);
    this.makeButtons([
      { label: 'CONNECT', act: () => void this.connectAsGuest() },
      { label: 'BACK', act: () => this.renderChoose() },
    ]);
    this.setStatus('code is 5 letters/numbers');
  }

  private joinCodeDisplay(): string {
    const slots = this.joinCode.padEnd(5, '_').split('');
    return slots.join(' ');
  }

  private async connectAsGuest(): Promise<void> {
    if (this.joinCode.length < 5) {
      this.setStatus('enter all 5 characters first');
      return;
    }
    this.setStatus(`connecting to ${this.joinCode}…`);
    try {
      const { joinRoom } = await import('../net/webrtc');
      const link = joinRoom(this.joinCode);
      this.link = link;
      const transport = await link.transport;
      this.onConnected(transport);
    } catch (err) {
      this.fail(err instanceof Error ? err.message : 'could not connect');
    }
  }

  // ---------- connected: compatibility handshake, then hand off to Select ----

  private onConnected(transport: Transport): void {
    this.transport = transport;
    const cfg = getSettings();
    // 3D uses the wider arena bounds + a 3D-capable stage; both peers build the
    // identical initialState from these rules, so V25 holds in either renderer
    const bounds = this.render3d ? STAGE3D_BOUNDS : { minX: 50, maxX: 910 };
    const hostStage = this.render3d ? 'chiba-roof' : 'salton';
    this.controller = new LobbyController(
      {
        onPhase: (phase, detail) => {
          if (phase === 'error') this.fail(detail ?? 'lobby error');
          else if (phase === 'verifying') this.setStatus('connected — verifying…');
        },
        // once compatibility is verified, hand the live match off to the SAME
        // character/stage selector local play uses — no duplicate picker
        onReady: (info) => this.launchSelect(info.render3d, info.remoteName),
      },
      {
        transport,
        isHost: this.isHost,
        defs: characters,
        localName: this.isHost ? 'HOST' : 'GUEST',
        render3d: this.render3d,
        rules: this.isHost
          ? { roundTicks: cfg.roundSeconds * 60, winsNeeded: cfg.winsNeeded, stage: bounds, introTicks: 240 }
          : undefined,
        stage: this.isHost ? hostStage : undefined,
      },
    );
    this.setStatus('connected — verifying…');
  }

  /** Hand off to the reused SelectScene in online mode. It drives char + stage
   *  picking over the same controller and launches the Fight itself. */
  private launchSelect(render3d: boolean, remoteName: string): void {
    if (this.launched || !this.transport || !this.controller) return;
    this.launched = true;
    play(this, 's-blip', 0.7);
    const online: OnlineSelectData = {
      controller: this.controller,
      transport: this.transport,
      localSlot: this.localSlot,
      render3d,
      remoteName,
    };
    // the controller + transport live on into Select/Fight — don't tear down
    this.transport = null;
    this.scene.start('Select', { online });
  }

  // ---------- paste-anywhere ----------

  /** Accept the room code pasted anywhere on the page: jump to the join
   *  screen if needed, fill up to 5 valid chars, auto-connect when complete. */
  private onPaste(e: ClipboardEvent): void {
    if (this.isHost || this.screen === 'error' || this.launched) return;
    const raw = e.clipboardData?.getData('text') ?? '';
    const code = raw
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 5);
    if (!code) return;
    e.preventDefault();
    if (this.screen !== 'join') this.startJoin();
    this.joinCode = code;
    this.refreshJoinBox();
    play(this, 's-blip', 0.5);
    if (code.length === 5) void this.connectAsGuest();
  }

  // ---------- input ----------

  private onKey(e: KeyboardEvent): void {
    if (this.screen === 'join') {
      const k = e.key.toUpperCase();
      if (/^[A-Z0-9]$/.test(k) && this.joinCode.length < 5) {
        this.joinCode += k;
        this.refreshJoinBox();
      } else if (e.key === 'Backspace') {
        this.joinCode = this.joinCode.slice(0, -1);
        this.refreshJoinBox();
      } else if (e.key === 'Enter') {
        void this.connectAsGuest();
      }
      return;
    }
    // choose / host: ENTER activates the highlighted button
    if (e.key === 'Enter') this.activateButton();
    else if (e.key === 'ArrowUp' || e.key === 'w') this.moveButton(-1);
    else if (e.key === 'ArrowDown' || e.key === 's') this.moveButton(1);
  }

  private refreshJoinBox(): void {
    play(this, 's-blip', 0.3);
    // the code box is the first pushed text object on the join screen
    const box = this.layer.find((o) => o instanceof Phaser.GameObjects.Text && (o as Phaser.GameObjects.Text).style.fontSize === '64px') as
      | Phaser.GameObjects.Text
      | undefined;
    box?.setText(this.joinCodeDisplay());
  }

  update(): void {
    const nav = menuNav.poll();
    if (this.screen === 'choose' || this.screen === 'host' || this.screen === 'join') {
      if (nav.up) this.moveButton(-1);
      if (nav.down) this.moveButton(1);
      if (nav.confirm || nav.start) navDefer(this, () => this.activateButton());
      if (nav.menu) navDefer(this, () => this.leave());
    }
  }

  // ---------- shared UI helpers (MenuScene button style) ----------

  private makeButtons(opts: { label: string; act: () => void }[]): void {
    this.buttons = [];
    this.selIdx = 0;
    opts.forEach((o, i) => {
      const y = 360 + i * 52;
      const bg = this.add
        .rectangle(STAGE_W / 2, y, 360, 46, 0x241b2e, 0.9)
        .setStrokeStyle(2, 0x7a6a86)
        .setInteractive({ useHandCursor: true })
        .setDepth(4);
      const label = this.add
        .text(STAGE_W / 2, y, o.label, {
          fontFamily: 'monospace', fontSize: '24px', fontStyle: 'bold', color: '#f5ead9', stroke: '#000', strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setDepth(5);
      bg.on('pointerover', () => { this.selIdx = i; this.highlightButtons(); });
      bg.on('pointerdown', () => { this.selIdx = i; o.act(); });
      this.layer.push(bg, label);
      this.buttons.push({ bg, label, act: o.act });
    });
    this.highlightButtons();
  }

  private highlightButtons(): void {
    this.buttons.forEach(({ bg, label }, i) => {
      const on = i === this.selIdx;
      bg.setFillStyle(on ? 0x3a2b40 : 0x241b2e, on ? 0.95 : 0.9).setStrokeStyle(2, on ? 0xffb347 : 0x7a6a86);
      label.setColor(on ? '#ffd24a' : '#f5ead9');
    });
  }

  private moveButton(d: number): void {
    if (!this.buttons.length) return;
    this.selIdx = (this.selIdx + d + this.buttons.length) % this.buttons.length;
    play(this, 's-blip', 0.4);
    this.highlightButtons();
  }

  private activateButton(): void {
    this.buttons[this.selIdx]?.act();
  }

  private title(text: string): void {
    this.layer.push(
      this.add
        .text(STAGE_W / 2, 90, text, {
          fontFamily: 'monospace', fontSize: '48px', fontStyle: 'bold', color: '#ffb347', stroke: '#2a0a0a', strokeThickness: 10,
        })
        .setOrigin(0.5)
        .setDepth(4),
    );
  }

  private subtitle(text: string): void {
    this.layer.push(
      this.add
        .text(STAGE_W / 2, 140, text, {
          fontFamily: 'monospace', fontSize: '16px', color: '#e8dcc8', stroke: '#000', strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(4),
    );
  }

  private statusText: Phaser.GameObjects.Text | null = null;

  private setStatus(text: string): void {
    this.statusLine = text;
    if (!this.statusText) {
      this.statusText = this.add
        .text(STAGE_W / 2, STAGE_H - 26, '', {
          fontFamily: 'monospace', fontSize: '16px', color: '#8fe388', stroke: '#000', strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(6);
    }
    this.statusText.setText(text).setColor('#8fe388');
  }

  private clearLayer(): void {
    for (const o of this.layer) o.destroy();
    this.layer = [];
    this.buttons = [];
  }

  private fail(reason: string): void {
    this.screen = 'error';
    this.clearLayer();
    this.title('CONNECTION FAILED');
    this.subtitle(reason);
    this.makeButtons([
      { label: 'TRY AGAIN', act: () => { this.teardown(); this.resetState(); this.renderChoose(); } },
      { label: 'BACK TO MENU', act: () => this.leave() },
    ]);
    if (this.statusText) this.statusText.setColor('#ff5a4a');
  }

  private leave(): void {
    this.teardown();
    this.scene.start('Menu');
  }

  private teardown(): void {
    if (this.pasteHandler) {
      window.removeEventListener('paste', this.pasteHandler);
      this.pasteHandler = null;
    }
    // only destroy the link if we didn't hand the transport to a fight
    if (!this.launched) this.link?.destroy();
    this.link = null;
    this.controller = null;
  }

  /** short "2D"/"3D" tag for the current renderer, shown in lobby headers */
  private modeTag(): string {
    return this.render3d ? '3D' : '2D';
  }
}
