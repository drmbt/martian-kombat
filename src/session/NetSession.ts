// NetSession — GGPO-style rollback netplay behind the same Session surface as
// FightSession (SPEC V18/V19). The sim head runs on predicted remote inputs
// (predict = repeat last real input); when a real input arrives and disagrees,
// we restore the snapshot at the divergence tick and re-simulate to the head
// inside the same advance() call. Presentation hooks fire only the FIRST time
// a tick is simulated — re-sims are silent (SPEC V24); mispredicted sfx/vfx
// are the accepted rollback artifact, state-driven UI self-corrects.
//
// Tick naming: "tick k" is the step that produces state.tick === k, and
// inputs[k] are the inputs that step consumes. Ticks 1..delay are pre-seeded
// EMPTY on both peers so the first real local poll (scheduled at +delay)
// lands identically on both sides.
//
// Zero Phaser imports. No wall clock — pacing comes in via advance(deltaMs),
// which keeps every rollback scenario reproducible in vitest over the
// loopback transport.
import { hashState, packInput, step, unpackInput, TICK_MS } from '../engine';
import type { Defs, GameState } from '../engine';
import { koSlowActive, type Session, type SessionHooks } from './FightSession';
import type { NetMsg, Transport, TransportStatus } from '../net/transport';

export interface NetSessionOptions {
  transport: Transport;
  /** which fighter this peer controls: host 0, guest 1 */
  localSlot: 0 | 1;
  /** local input delay in ticks — shrinks rollback frequency (SPEC §C) */
  delay?: number;
  /** max ticks the head may run ahead of real remote inputs before stalling */
  window?: number;
  /** exchange a confirmed-state hash every N confirmed ticks (SPEC V20) */
  hashInterval?: number;
}

export interface NetIssue {
  kind: 'desync' | 'disconnect';
  detail: string;
}

export interface NetStats {
  /** ticks the head is running ahead of real remote inputs */
  ahead: number;
  rollbacks: number;
  /** total re-simulated ticks across all rollbacks */
  rollbackTicks: number;
  /** advance() calls skipped because the window was exhausted */
  stalls: number;
  /** frames eased to converge with the remote (timesync, V26) */
  syncSkips: number;
  /** ticks our head leads the remote's head by (drives timesync) */
  drift: number;
  delay: number;
  confirmedTick: number;
  head: number;
  halted: NetIssue | null;
}

const EMPTY_PACKED = 0;
/** how many past inputs ride along in every packet (SPEC V22) */
const REDUNDANCY = 8;
/** timesync: tolerate this many ticks ahead of the remote before easing a
 *  frame (small enough to keep both intros aligned, big enough to not thrash) */
const SYNC_AHEAD = 2;
/** min advances between eased frames — gentle convergence (~1 tick / N frames)
 *  that never freezes; a genuinely silent peer still runs into the window stall */
const SYNC_COOLDOWN = 6;

export class NetSession implements Session {
  private readonly transport: Transport;
  private readonly localSlot: 0 | 1;
  private readonly delay: number;
  private readonly window: number;
  private readonly hashInterval: number;

  private accumulator = 0;
  /** inputs[k] per slot, packed; local is authoritative, remote fills in */
  private readonly localInputs = new Map<number, number>();
  private readonly remoteInputs = new Map<number, number>();
  /** packed remote input each simulated tick actually used (real or guess) */
  private readonly usedRemote = new Map<number, number>();
  /** state clones keyed by state.tick, back to the confirmed tick */
  private readonly snapshots = new Map<number, GameState>();
  /** highest k such that ALL ticks ≤ k have real remote inputs */
  private remoteContiguous = 0;
  /** the remote peer's own sim head (their tick), from `input` packet ids —
   *  used for timesync (V26): if we run ahead of it we ease back a frame */
  private remoteHead = 0;
  /** frames the ahead peer has skipped to converge (stat/debug) */
  private syncSkips = 0;
  /** advances remaining before the next timesync skip is allowed */
  private syncCooldown = 0;
  /** the real remote input at remoteContiguous — the prediction source */
  private lastRealRemote = EMPTY_PACKED;
  private earliestMispredict = Infinity;
  private lastHashedTick = 0;
  private readonly myHashes = new Map<number, number>();
  private readonly theirHashes = new Map<number, number>();
  private rollbacks = 0;
  private rollbackTicks = 0;
  private stalls = 0;
  private halted: NetIssue | null = null;
  private issueCb: ((issue: NetIssue) => void) | null = null;

  constructor(
    readonly state: GameState,
    private readonly hooks: SessionHooks,
    private readonly defs: Defs,
    opts: NetSessionOptions,
  ) {
    this.transport = opts.transport;
    this.localSlot = opts.localSlot;
    this.delay = opts.delay ?? 2;
    this.window = opts.window ?? 10;
    this.hashInterval = opts.hashInterval ?? 60;
    // both peers pre-seed the delay gap identically (see header comment)
    for (let k = 1; k <= this.delay; k++) this.localInputs.set(k, EMPTY_PACKED);
    this.snapshots.set(this.state.tick, structuredClone(this.state));
    this.transport.onMessage((m) => this.receive(m));
    this.transport.onStatus((s, detail) => this.onTransportStatus(s, detail));
  }

  onIssue(cb: (issue: NetIssue) => void): void {
    this.issueCb = cb;
    if (this.halted) cb(this.halted);
  }

  stats(): NetStats {
    return {
      ahead: this.state.tick - this.remoteContiguous,
      rollbacks: this.rollbacks,
      rollbackTicks: this.rollbackTicks,
      stalls: this.stalls,
      syncSkips: this.syncSkips,
      drift: this.remoteHead > 0 ? this.state.tick - this.remoteHead : 0,
      delay: this.delay,
      confirmedTick: Math.min(this.remoteContiguous, this.state.tick),
      head: this.state.tick,
      halted: this.halted,
    };
  }

  advance(deltaMs: number): number {
    if (this.halted) return 0;
    // 1) reconcile: arrived real inputs that contradict a prediction rewind
    //    the sim before any new ticks run
    this.rollbackIfNeeded();
    if (this.halted) return 0; // desync can surface during reconcile
    // 2) pace exactly like the local session (KO slow-mo is state-derived, so
    //    both peers compute the same scaling — no drift)
    this.accumulator += Math.min(deltaMs, 100) * (koSlowActive(this.state) ? 0.35 : 1);
    // timesync (V26): if our sim head runs ahead of the remote's, drop one frame
    // (rate-limited) so both converge to the same tick at the same wall-clock —
    // otherwise a launch/latency skew leaves one side's intro (and every action)
    // visibly ahead of the other's forever. The cooldown keeps convergence
    // gentle and lets a genuinely silent peer still hit the window stall below.
    if (this.syncCooldown > 0) this.syncCooldown--;
    let mayStep = true;
    if (
      this.remoteHead > 0 &&
      this.state.tick - this.remoteHead > SYNC_AHEAD &&
      this.syncCooldown === 0 &&
      this.accumulator >= TICK_MS
    ) {
      this.accumulator -= TICK_MS; // burn this frame's time without stepping
      this.syncSkips++;
      this.syncCooldown = SYNC_COOLDOWN;
      mayStep = false;
    }
    let ticks = 0;
    while (mayStep && this.accumulator >= TICK_MS) {
      const k = this.state.tick + 1;
      if (k - this.remoteContiguous > this.window) {
        // out of rollback room — freeze and bank no further time (a stall
        // must not turn into a fast-forward burst when the peer recovers)
        this.stalls++;
        this.accumulator = 0;
        break;
      }
      this.pollLocal(k);
      this.simulate(k, true);
      this.accumulator -= TICK_MS;
      ticks++;
    }
    this.confirmAndHash();
    this.prune();
    return ticks;
  }

  resetPacing(): void {
    this.accumulator = 0;
  }

  get alpha(): number {
    return Math.min(this.accumulator / TICK_MS, 1);
  }

  close(reason: string): void {
    this.transport.send({ t: 'bye', reason });
    this.transport.close();
  }

  // ---------- sim ----------

  /** poll the local player NOW; it lands `delay` ticks in the future */
  private pollLocal(k: number): void {
    const target = k + this.delay;
    if (this.localInputs.has(target)) return;
    const frame = this.hooks.inputs(this.state)[this.localSlot];
    this.localInputs.set(target, packInput(frame));
    const frames: number[] = [];
    for (let t = target - REDUNDANCY + 1; t <= target; t++) {
      frames.push(this.localInputs.get(t) ?? EMPTY_PACKED);
    }
    this.transport.send({ t: 'input', tick: target, frames });
  }

  /** step tick k on the current state; `present` fires the scene hooks
   *  (first simulation only — rollback re-sims pass false, SPEC V24) */
  private simulate(k: number, present: boolean): void {
    const local = this.localInputs.get(k) ?? EMPTY_PACKED;
    const remote = this.remoteInputs.get(k) ?? this.lastRealRemote;
    this.usedRemote.set(k, remote);
    const pair: [number, number] = this.localSlot === 0 ? [local, remote] : [remote, local];
    if (present) this.hooks.beforeTick?.(this.state);
    const inputs: [ReturnType<typeof unpackInput>, ReturnType<typeof unpackInput>] = [
      unpackInput(pair[0]),
      unpackInput(pair[1]),
    ];
    step(this.state, inputs, this.defs);
    if (present) this.hooks.afterTick?.(this.state, inputs);
    this.snapshots.set(k, structuredClone(this.state));
  }

  private rollbackIfNeeded(): void {
    const from = this.earliestMispredict;
    if (from > this.state.tick) return;
    this.earliestMispredict = Infinity;
    const head = this.state.tick;
    const restore = this.snapshots.get(from - 1);
    if (!restore) {
      // can't happen while confirm/prune honor the window — fail loud, never
      // play on from a corrupt timeline
      this.halt({ kind: 'desync', detail: `rollback to ${from} but snapshot missing` });
      return;
    }
    // restore INTO the existing object — scenes hold this reference
    Object.assign(this.state, structuredClone(restore));
    for (let k = from; k <= head; k++) this.simulate(k, false);
    this.rollbacks++;
    this.rollbackTicks += head - from + 1;
  }

  // ---------- net ----------

  private receive(m: NetMsg): void {
    switch (m.t) {
      case 'input': {
        // the packet's newest tick = remote head + delay → recover their head
        this.remoteHead = Math.max(this.remoteHead, m.tick - this.delay);
        for (let i = 0; i < m.frames.length; i++) {
          const t = m.tick - m.frames.length + 1 + i;
          if (t < 1 || this.remoteInputs.has(t)) continue;
          this.remoteInputs.set(t, m.frames[i]);
          // a real input contradicting what a simulated tick used → rollback
          const used = this.usedRemote.get(t);
          if (used !== undefined && used !== m.frames[i] && t < this.earliestMispredict) {
            this.earliestMispredict = t;
          }
        }
        while (this.remoteInputs.has(this.remoteContiguous + 1)) {
          this.remoteContiguous++;
          this.lastRealRemote = this.remoteInputs.get(this.remoteContiguous)!;
        }
        break;
      }
      case 'hash': {
        this.theirHashes.set(m.tick, m.h);
        this.compareHash(m.tick);
        break;
      }
      case 'bye':
        this.halt({ kind: 'disconnect', detail: m.reason });
        break;
      case 'hello':
      case 'start':
        break; // lobby traffic — handled before the session exists (T39)
    }
  }

  private confirmAndHash(): void {
    const confirmed = Math.min(this.remoteContiguous, this.state.tick);
    let next = this.lastHashedTick + this.hashInterval;
    while (next <= confirmed) {
      const snap = this.snapshots.get(next);
      if (snap) {
        const h = hashState(snap);
        this.myHashes.set(next, h);
        this.transport.send({ t: 'hash', tick: next, h });
        this.compareHash(next);
      }
      this.lastHashedTick = next;
      next += this.hashInterval;
    }
  }

  private compareHash(tick: number): void {
    const mine = this.myHashes.get(tick);
    const theirs = this.theirHashes.get(tick);
    if (mine === undefined || theirs === undefined) return;
    if (mine !== theirs) {
      this.halt({
        kind: 'desync',
        detail: `state hash mismatch at confirmed tick ${tick} (${mine} vs ${theirs})`,
      });
    }
  }

  private onTransportStatus(s: TransportStatus, detail?: string): void {
    if (s === 'closed' || s === 'error') {
      this.halt({ kind: 'disconnect', detail: detail ?? s });
    }
  }

  private halt(issue: NetIssue): void {
    if (this.halted) return;
    this.halted = issue;
    this.issueCb?.(issue);
  }

  private prune(): void {
    // keep everything the next rollback could still need: the confirmed tick
    // itself (restore point) and anything newer
    const keep = Math.min(this.remoteContiguous, this.state.tick) - 1;
    for (const map of [this.snapshots, this.usedRemote, this.localInputs, this.remoteInputs]) {
      for (const t of map.keys()) if (t < keep) map.delete(t);
    }
    for (const map of [this.myHashes, this.theirHashes]) {
      for (const t of map.keys()) if (t < this.lastHashedTick - this.hashInterval) map.delete(t);
    }
  }
}
