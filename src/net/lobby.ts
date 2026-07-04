// Lobby negotiation (SPEC V21, T39) — the handshake that must agree before a
// NetSession can safely start. Pure controller over the Transport interface:
// no Phaser, no peerjs, so the whole join/verify/start dance is unit-tested
// over the loopback pair. LobbyScene is the thin presenter on top.
//
// The two failure modes this guards are the ones that silently corrupt a
// match: a protocol-version skew (wire format differs) and a character-data
// skew (one peer's frame data was patched → sims diverge tick one). Both
// refuse the match up front with a shown reason rather than desyncing later.
import type { Defs, MatchRules } from '../engine';
import { PROTO, type NetMsg, type Transport, type TransportStatus } from './transport';

/** FNV-1a over the serialized character registry. Equal ⇔ both peers run
 *  identical frame data / hitboxes / move lists. Any drift (a rebalance on one
 *  side) changes it, and the handshake refuses the match. */
export function charDataHash(defs: Defs): number {
  const json = JSON.stringify(defs);
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i) & 0xff;
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    // fold the high char code byte too (non-ASCII names) so it can't alias
    h ^= (json.charCodeAt(i) >> 8) & 0xff;
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return h >>> 0;
}

export type LobbyPhase =
  | 'connecting' // transport not open yet
  | 'picking' // connected; players choosing/locking characters
  | 'starting' // both locked + agreed; match config emitted
  | 'error'; // incompatible or transport died

export interface StartConfig {
  rules: MatchRules;
  stage: string;
  chars: [string, string]; // [host = slot 0, guest = slot 1]
  delay: number;
  /** host-chosen renderer — guest adopts it, so 2D/3D can never cross-join */
  render3d: boolean;
}

/** what LobbyScene hands FightScene to run an online match (SPEC T40). The
 *  live transport is passed by reference through scene data — after the
 *  handshake the NetSession takes over its onMessage. */
export interface OnlineFightData {
  transport: Transport;
  localSlot: 0 | 1;
  delay: number;
  rules: MatchRules;
}

export interface RemotePlayer {
  name: string;
  charId: string;
}

export interface LobbyHooks {
  onPhase?: (phase: LobbyPhase, detail?: string) => void;
  /** the remote player locked in (name + character) */
  onRemoteLock?: (remote: RemotePlayer) => void;
  /** GUEST only: the host announced its renderer — adopt it before picking a
   *  character (so the roster pool + launched scene match, no cross-join) */
  onRenderMode?: (render3d: boolean) => void;
  /** handshake complete — launch the Fight with a NetSession using this */
  onStart?: (config: StartConfig) => void;
}

export interface LobbyOptions {
  transport: Transport;
  isHost: boolean;
  defs: Defs;
  localName: string;
  /** input delay in ticks the match will run with (host decides, sent in start) */
  delay?: number;
  /** host-only: match rules + stage for the start message */
  rules?: MatchRules;
  stage?: string;
  /** host-only: renderer for the match (2D default). Guest adopts host's. */
  render3d?: boolean;
}

const DEFAULT_RULES: MatchRules = {
  roundTicks: 99 * 60,
  winsNeeded: 2,
  stage: { minX: 50, maxX: 910 },
  introTicks: 240,
};

export class LobbyController {
  private readonly transport: Transport;
  private readonly isHost: boolean;
  private readonly charHash: number;
  private readonly localName: string;
  private readonly delay: number;
  private readonly rules: MatchRules;
  /** host: fixed from opts. guest: adopted from the host's `mode` message. */
  private render3d: boolean;
  private stage: string;

  private phase: LobbyPhase = 'connecting';
  private open = false;
  private localChar: string | null = null;
  private remote: RemotePlayer | null = null;
  private remoteProtoOk = false;
  private started = false;

  constructor(
    private readonly hooks: LobbyHooks,
    opts: LobbyOptions,
  ) {
    this.transport = opts.transport;
    this.isHost = opts.isHost;
    this.charHash = charDataHash(opts.defs);
    this.localName = opts.localName;
    this.delay = opts.delay ?? 2;
    this.rules = opts.rules ?? DEFAULT_RULES;
    this.render3d = opts.render3d ?? false;
    this.stage = opts.stage ?? 'salton';
    this.transport.onMessage((m) => this.receive(m));
    this.transport.onStatus((s, d) => this.onStatus(s, d));
  }

  /** host may re-pick the stage until the match starts (guest gets it in start) */
  setStage(stage: string): void {
    this.stage = stage;
  }

  /** the local player locked their character — fire the hello and maybe start */
  lockChar(charId: string): void {
    if (this.phase === 'error' || this.started) return;
    this.localChar = charId;
    if (this.open) this.sendHello();
    this.maybeStart();
  }

  private sendHello(): void {
    if (!this.localChar) return;
    this.transport.send({
      t: 'hello',
      proto: PROTO,
      charHash: this.charHash,
      charId: this.localChar,
      name: this.localName,
    });
  }

  private receive(m: NetMsg): void {
    if (this.phase === 'error') return;
    switch (m.t) {
      case 'mode': {
        // guest adopts the host's renderer before picking (auto-switch)
        if (!this.isHost) {
          this.render3d = m.render3d;
          this.hooks.onRenderMode?.(m.render3d);
        }
        break;
      }
      case 'hello': {
        if (m.proto !== PROTO) {
          return this.fail(`version mismatch (peer proto ${m.proto}, need ${PROTO})`);
        }
        if (m.charHash !== this.charHash) {
          return this.fail('character data mismatch — both players need the same game version');
        }
        this.remoteProtoOk = true;
        this.remote = { name: m.name, charId: m.charId };
        this.hooks.onRemoteLock?.(this.remote);
        this.maybeStart();
        break;
      }
      case 'start': {
        // authoritative config from the host — guest obeys it verbatim,
        // including the renderer (so a 2D guest can't join a 3D host)
        if (!this.isHost) this.beginMatch(m.rules, m.stage, m.chars, m.delay, m.render3d);
        break;
      }
      case 'bye':
        this.fail(m.reason || 'peer left');
        break;
      case 'input':
      case 'hash':
      case 'resync':
        break; // match traffic — not ours; the NetSession owns it post-start
    }
  }

  private maybeStart(): void {
    if (this.started || !this.open) return;
    if (!this.localChar || !this.remote || !this.remoteProtoOk) return;
    // both sides locked + verified. Host is authoritative: it defines the
    // config, sends `start`, and both begin on it. Guest waits for `start`.
    if (this.isHost) {
      const chars: [string, string] = [this.localChar, this.remote.charId];
      this.transport.send({
        t: 'start',
        rules: this.rules,
        stage: this.stage,
        chars,
        delay: this.delay,
        render3d: this.render3d,
      });
      this.beginMatch(this.rules, this.stage, chars, this.delay, this.render3d);
    }
  }

  private beginMatch(
    rules: MatchRules,
    stage: string,
    chars: [string, string],
    delay: number,
    render3d: boolean,
  ): void {
    if (this.started) return;
    this.started = true;
    this.setPhase('starting');
    this.hooks.onStart?.({ rules, stage, chars, delay, render3d });
  }

  private onStatus(s: TransportStatus, detail?: string): void {
    if (s === 'open') {
      this.open = true;
      if (this.phase === 'connecting') this.setPhase('picking');
      // host announces its renderer immediately so the guest adopts it before
      // picking a character (2D/3D never cross-join)
      if (this.isHost) this.transport.send({ t: 'mode', render3d: this.render3d });
      // a char locked before the channel opened still needs its hello
      if (this.localChar) this.sendHello();
      this.maybeStart();
    } else if (s === 'closed' || s === 'error') {
      if (!this.started) this.fail(detail ?? 'connection lost');
    }
  }

  private fail(reason: string): void {
    if (this.phase === 'error') return;
    this.setPhase('error', reason);
  }

  private setPhase(phase: LobbyPhase, detail?: string): void {
    this.phase = phase;
    this.hooks.onPhase?.(phase, detail);
  }
}
