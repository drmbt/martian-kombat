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
  | 'verifying' // open; exchanging + checking the compatibility handshake
  | 'selecting' // verified; players on the shared character/stage select
  | 'starting' // both locked + host confirmed the stage; match config emitted
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
  /** opponent's display name — carried through so a rematch can relabel the
   *  select without re-doing the handshake */
  remoteName: string;
  /** the renderer this match runs in (so a rematch re-enters the same one) */
  render3d: boolean;
}

export interface RemotePlayer {
  name: string;
  charId: string;
}

/** what LobbyScene hands the shared SelectScene to run an online pick. The
 *  controller (with its live transport) is passed by reference; SelectScene
 *  adds its pick/stage/start hooks via setHooks and hands the transport on to
 *  the Fight when the match starts. */
export interface OnlineSelectData {
  controller: LobbyController;
  transport: Transport;
  localSlot: 0 | 1;
  render3d: boolean;
  remoteName: string;
}

export interface LobbyHooks {
  onPhase?: (phase: LobbyPhase, detail?: string) => void;
  /** GUEST only: the host announced its renderer — adopt it before selecting
   *  (so the roster pool + launched scene match, no cross-join) */
  onRenderMode?: (render3d: boolean) => void;
  /** compatibility handshake passed — hand off to the shared SelectScene */
  onReady?: (info: { remoteName: string; render3d: boolean }) => void;
  /** the remote player's live grid cursor moved (before they lock) */
  onRemoteCursor?: (idx: number) => void;
  /** the remote player locked their fighter in on the select screen */
  onRemoteLock?: (remote: RemotePlayer) => void;
  /** both fighters locked — BOTH players open the stage picker */
  onBothLocked?: () => void;
  /** the remote player cast their stage vote (for a "opponent picked X" note) */
  onRemoteStage?: (stageId: string) => void;
  /** match config agreed — launch the Fight with a NetSession using this */
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
  /** rematch: peers are already verified from the previous match on this same
   *  channel — skip the hello handshake and go straight to select */
  skipVerify?: boolean;
  /** rematch: the opponent's name is already known (no hello to carry it) */
  remoteName?: string;
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

  private hooks: LobbyHooks;
  private phase: LobbyPhase = 'connecting';
  private open = false;
  /** guest: host's renderer arrived. host: always known. Gates readiness so
   *  the guest never launches Select before it can pool the right roster. */
  private modeKnown: boolean;
  private remoteVerified = false;
  private remoteName = '';
  private localChar: string | null = null;
  private remoteChar: string | null = null;
  private localStage: string | null = null;
  private remoteStage: string | null = null;
  private readyFired = false;
  private bothLockedFired = false;
  private started = false;

  constructor(hooks: LobbyHooks, opts: LobbyOptions) {
    this.hooks = hooks;
    this.transport = opts.transport;
    this.isHost = opts.isHost;
    this.charHash = charDataHash(opts.defs);
    this.localName = opts.localName;
    this.delay = opts.delay ?? 2;
    this.rules = opts.rules ?? DEFAULT_RULES;
    this.render3d = opts.render3d ?? false;
    this.modeKnown = opts.isHost; // host sets its own mode; guest awaits `mode`
    this.stage = opts.stage ?? 'salton';
    // rematch: same peers, same channel, already verified — skip the handshake
    // and treat the peer as verified so onReady fires as soon as it's open
    if (opts.skipVerify) {
      this.remoteVerified = true;
      this.modeKnown = true;
      this.remoteName = opts.remoteName ?? '';
    }
    this.transport.onMessage((m) => this.receive(m));
    this.transport.onStatus((s, d) => this.onStatus(s, d));
  }

  /** merge in more hooks (Lobby wires connection hooks; SelectScene adds the
   *  pick/stage/start hooks when it takes over the same controller) */
  setHooks(more: Partial<LobbyHooks>): void {
    this.hooks = { ...this.hooks, ...more };
  }

  get renderMode(): boolean {
    return this.render3d;
  }

  /** the remote fighter if it already arrived (e.g. a pick that landed during
   *  the Lobby→Select scene handoff) — Select reflects it on setup */
  get remotePick(): string | null {
    return this.remoteChar;
  }

  /** the local player's grid cursor moved — mirror it to the peer's screen */
  moveCursor(idx: number): void {
    if (this.phase === 'error' || this.started || this.localChar) return;
    this.transport.send({ t: 'cursor', idx });
  }

  /** the local player locked their fighter on the select screen */
  lockChar(charId: string): void {
    if (this.phase === 'error' || this.started || this.localChar) return;
    this.localChar = charId;
    this.transport.send({ t: 'pick', charId });
    this.maybeBothLocked();
  }

  /** the local player cast their stage vote. BOTH players vote; the host
   *  reconciles (agree → that stage, disagree → coin flip between the two) and
   *  sends the authoritative `start`. */
  pickStage(stageId: string): void {
    if (this.phase === 'error' || this.started || this.localStage) return;
    this.localStage = stageId;
    this.transport.send({ t: 'stagePick', stageId });
    this.maybeResolveStage();
  }

  private maybeResolveStage(): void {
    // only the host reconciles, and only once both votes are in
    if (!this.isHost || this.started || !this.localStage || !this.remoteStage) return;
    const resolved =
      this.localStage === this.remoteStage
        ? this.localStage
        : Math.random() < 0.5
          ? this.localStage
          : this.remoteStage; // disagreement → random pick between the two votes
    this.stage = resolved;
    this.confirmStart();
  }

  /** HOST: both fighters locked + stage resolved → commit the match config */
  private confirmStart(): void {
    if (!this.isHost || this.started) return;
    if (!this.localChar || !this.remoteChar) return;
    const chars: [string, string] = [this.localChar, this.remoteChar];
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

  private receive(m: NetMsg): void {
    if (this.phase === 'error') return;
    switch (m.t) {
      case 'mode': {
        // guest adopts the host's renderer before selecting (auto-switch)
        if (!this.isHost) {
          this.render3d = m.render3d;
          this.modeKnown = true;
          this.hooks.onRenderMode?.(m.render3d);
          this.maybeReady();
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
        this.remoteVerified = true;
        this.remoteName = m.name;
        this.maybeReady();
        break;
      }
      case 'cursor': {
        if (!this.remoteChar) this.hooks.onRemoteCursor?.(m.idx); // ignore once they've locked
        break;
      }
      case 'pick': {
        this.remoteChar = m.charId;
        this.hooks.onRemoteLock?.({ name: this.remoteName, charId: m.charId });
        this.maybeBothLocked();
        break;
      }
      case 'stagePick': {
        this.remoteStage = m.stageId;
        this.hooks.onRemoteStage?.(m.stageId);
        this.maybeResolveStage(); // host reconciles once both votes are in
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

  /** compatibility verified on both sides → hand off to the shared select */
  private maybeReady(): void {
    if (this.readyFired || !this.open || !this.remoteVerified || !this.modeKnown) return;
    this.readyFired = true;
    this.setPhase('selecting');
    this.hooks.onReady?.({ remoteName: this.remoteName, render3d: this.render3d });
  }

  private maybeBothLocked(): void {
    if (this.bothLockedFired || !this.localChar || !this.remoteChar) return;
    this.bothLockedFired = true;
    this.hooks.onBothLocked?.();
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
      if (this.phase === 'connecting') this.setPhase('verifying');
      // host announces its renderer first so the guest can pool the right
      // roster; then both send the compatibility handshake (V21)
      if (this.isHost) this.transport.send({ t: 'mode', render3d: this.render3d });
      this.transport.send({ t: 'hello', proto: PROTO, charHash: this.charHash, name: this.localName });
      this.maybeReady();
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
