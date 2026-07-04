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
}

export interface RemotePlayer {
  name: string;
  charId: string;
}

export interface LobbyHooks {
  onPhase?: (phase: LobbyPhase, detail?: string) => void;
  /** the remote player locked in (name + character) */
  onRemoteLock?: (remote: RemotePlayer) => void;
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
        // authoritative config from the host — guest obeys it verbatim
        if (!this.isHost) this.beginMatch(m.rules, m.stage, m.chars, m.delay);
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
      this.transport.send({ t: 'start', rules: this.rules, stage: this.stage, chars, delay: this.delay });
      this.beginMatch(this.rules, this.stage, chars, this.delay);
    }
  }

  private beginMatch(rules: MatchRules, stage: string, chars: [string, string], delay: number): void {
    if (this.started) return;
    this.started = true;
    this.setPhase('starting');
    this.hooks.onStart?.({ rules, stage, chars, delay });
  }

  private onStatus(s: TransportStatus, detail?: string): void {
    if (s === 'open') {
      this.open = true;
      if (this.phase === 'connecting') this.setPhase('picking');
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
