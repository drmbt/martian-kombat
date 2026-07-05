// Net transport seam (SPEC V18/V22). NetSession talks to this interface only;
// the WebRTC implementation (src/net/webrtc.ts) and the in-memory loopback
// below are interchangeable, which is what makes rollback testable in vitest.
// Zero Phaser imports.
import type { GameState, MatchRules } from '../engine';

/** bump on any wire-format change — checked in the hello handshake (V21) */
export const PROTO = 1;

export type NetMsg =
  | { t: 'mode'; render3d: boolean } // host announces its renderer on connect; guest auto-adopts (2D/3D never cross-join)
  | { t: 'hello'; proto: number; charHash: number; name: string } // compatibility handshake on connect (V21) — char picked later, in Select
  | { t: 'cursor'; idx: number } // live character-grid cursor position (shows the remote player's cursor before they lock)
  | { t: 'pick'; charId: string } // a player locked their fighter on the (shared) character-select screen
  | { t: 'stagePick'; stageId: string } // a player's stage vote; host reconciles (agree → that, disagree → coin flip)
  | { t: 'start'; rules: MatchRules; stage: string; chars: [string, string]; delay: number; render3d: boolean }
  | { t: 'input'; tick: number; frames: number[] } // packed inputs, oldest first, last-8 redundancy (V22)
  | { t: 'rematch' } // post-match "play again" opt-in; both send → back to Select on the same channel
  | { t: 'hash'; tick: number; h: number } // confirmed-tick state hash (V20)
  | { t: 'resync'; tick: number; state: GameState } // host→guest authoritative state on rejoin (V27)
  | { t: 'bye'; reason: string };

export type TransportStatus = 'connecting' | 'open' | 'closed' | 'error';

export interface Transport {
  send(msg: NetMsg): void;
  onMessage(cb: (msg: NetMsg) => void): void;
  onStatus(cb: (status: TransportStatus, detail?: string) => void): void;
  close(): void;
}

export interface LoopbackOptions {
  /** delivery delay in virtual ticks */
  latency?: number;
  /** ± extra ticks, seeded — can reorder like an unordered channel */
  jitter?: number;
  /** packet loss probability 0..1, seeded — NetSession must survive it */
  loss?: number;
  seed?: number;
}

/** Two connected in-memory transports on a virtual clock. Deterministic:
 *  latency/jitter/loss come from a seeded LCG, time moves only via tick(). */
export function createLoopbackPair(opts: LoopbackOptions = {}): {
  a: Transport;
  b: Transport;
  /** advance the virtual clock one tick and deliver due messages */
  tick(): void;
  /** run n ticks (drains everything in-flight when n ≥ latency+jitter) */
  run(n: number): void;
} {
  const latency = opts.latency ?? 0;
  const jitter = opts.jitter ?? 0;
  const loss = opts.loss ?? 0;
  let rngState = (opts.seed ?? 1) >>> 0 || 1;
  const rng = (): number => {
    // LCG (numerical recipes) — deterministic across runs and engines
    rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
    return rngState / 0x100000000;
  };

  let now = 0;
  interface Pending {
    at: number;
    seq: number; // stable order among same-tick deliveries
    msg: NetMsg;
    deliver: (msg: NetMsg) => void;
  }
  const inFlight: Pending[] = [];
  let seq = 0;

  class LoopbackEnd implements Transport {
    private msgCb: ((msg: NetMsg) => void) | null = null;
    private statusCb: ((status: TransportStatus, detail?: string) => void) | null = null;
    peer!: LoopbackEnd;
    closed = false;

    send(msg: NetMsg): void {
      if (this.closed || this.peer.closed) return;
      if (loss > 0 && rng() < loss) return; // dropped on the floor
      const wobble = jitter > 0 ? Math.round((rng() * 2 - 1) * jitter) : 0;
      inFlight.push({
        at: now + Math.max(0, latency + wobble),
        seq: seq++,
        // clone so post-send mutation by the sender can't leak across (like a
        // real serialized channel)
        msg: structuredClone(msg),
        deliver: (m) => {
          // a closed pair delivers nothing, even messages already in flight —
          // deterministic teardown beats "maybe arrives" semantics
          if (!this.closed && !this.peer.closed) this.peer.msgCb?.(m);
        },
      });
    }

    onMessage(cb: (msg: NetMsg) => void): void {
      this.msgCb = cb;
    }

    onStatus(cb: (status: TransportStatus, detail?: string) => void): void {
      this.statusCb = cb;
      cb('open');
    }

    close(): void {
      if (this.closed) return;
      this.closed = true;
      this.statusCb?.('closed');
      this.peer.statusCb?.('closed', 'peer closed');
    }
  }

  const a = new LoopbackEnd();
  const b = new LoopbackEnd();
  a.peer = b;
  b.peer = a;

  const tick = (): void => {
    now++;
    const due = inFlight.filter((p) => p.at <= now).sort((x, y) => x.at - y.at || x.seq - y.seq);
    for (const p of due) {
      inFlight.splice(inFlight.indexOf(p), 1);
      p.deliver(p.msg);
    }
  };

  return {
    a,
    b,
    tick,
    run(n: number): void {
      for (let i = 0; i < n; i++) tick();
    },
  };
}
