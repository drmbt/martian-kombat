// Post-match rematch over the still-open channel (both scenes reuse this).
// At matchEnd the finished NetSession's transport is handed here; each side
// opts in, and when BOTH agree we spin up a fresh LobbyController on the SAME
// connection (skipVerify — already handshaked this session) and hand the
// resulting select config back so the scene can return to character select.
// No room-code re-entry. Phaser-free: the scene supplies a `defer` (its clock)
// because onReady fires synchronously mid-construction.
import type { Defs } from '../engine';
import { LobbyController, type OnlineFightData, type OnlineSelectData } from './lobby';

export interface RematchState {
  localReady: boolean;
  remoteReady: boolean;
  remoteName: string;
}

export interface RematchHooks {
  /** UI: redraw the prompt for the current opt-in state */
  onPrompt: (state: RematchState) => void;
  /** both agreed — start the shared SelectScene with this online payload */
  onLaunch: (select: OnlineSelectData) => void;
  /** the match can't continue (opponent left / disconnect) — go to menu */
  onLeave: (reason: string) => void;
}

export class RematchLink {
  private local = false;
  private remote = false;
  private started = false;
  private controller: LobbyController | null = null;

  constructor(
    private readonly online: OnlineFightData,
    private readonly defs: Defs,
    /** the scene's current stage (host re-picks in select; just a default) */
    private readonly stage: string,
    private readonly hooks: RematchHooks,
    /** run a fn on the next tick (scene clock) — onReady fires mid-construction */
    private readonly defer: (fn: () => void) => void,
  ) {
    this.online.transport.onMessage((m) => {
      if (m.t === 'rematch') {
        this.remote = true;
        this.emit();
        this.maybeStart();
      } else if (m.t === 'bye') {
        this.leave(`opponent left: ${m.reason}`);
      }
    });
    this.online.transport.onStatus((s, detail) => {
      if ((s === 'closed' || s === 'error') && !this.started) this.leave(detail ?? 'connection lost');
    });
    this.emit();
  }

  /** local player pressed "play again" */
  optIn(): void {
    if (this.local || this.started) return;
    this.local = true;
    this.online.transport.send({ t: 'rematch' });
    this.emit();
    this.maybeStart();
  }

  /** local player quit (or an unrecoverable error) */
  leave(reason: string): void {
    if (this.started) return;
    this.started = true;
    try {
      this.online.transport.send({ t: 'bye', reason: 'left match' });
    } catch {
      /* channel already gone */
    }
    this.online.transport.close();
    this.hooks.onLeave(reason);
  }

  private emit(): void {
    this.hooks.onPrompt({ localReady: this.local, remoteReady: this.remote, remoteName: this.online.remoteName });
  }

  private maybeStart(): void {
    if (this.started || !this.local || !this.remote) return;
    this.started = true;
    const net = this.online;
    const isHost = net.localSlot === 0;
    // fresh controller on the SAME open channel; skipVerify → onReady fires
    // synchronously during construction, so DEFER the launch to when
    // `this.controller` is assigned.
    this.controller = new LobbyController(
      {
        onReady: (info) =>
          this.defer(() =>
            this.hooks.onLaunch({
              controller: this.controller!,
              transport: net.transport,
              localSlot: net.localSlot,
              render3d: net.render3d,
              remoteName: info.remoteName || net.remoteName,
            }),
          ),
      },
      {
        transport: net.transport,
        isHost,
        defs: this.defs,
        localName: isHost ? 'HOST' : 'GUEST',
        render3d: net.render3d,
        rules: net.rules,
        stage: this.stage,
        delay: net.delay,
        skipVerify: true,
        remoteName: net.remoteName,
      },
    );
  }
}
