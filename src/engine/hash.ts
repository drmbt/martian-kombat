// Deterministic state hash for netplay desync detection (SPEC V20). Pure —
// same rules as everything in src/engine/: no wall-clock, no randomness.
//
// FNV-1a (32-bit) over the numeric core of GameState. Numbers are hashed via
// their IEEE-754 float64 bit patterns, so any observable divergence — even in
// the last mantissa bit — changes the hash on both machines identically.
// Strings (charId, moveId) are excluded on purpose: the handshake pins
// character data (SPEC V21), and every consequence of a differing move shows
// up in the hashed numbers within a tick or two.
import type { ActionKind, GameState, Phase } from './types';

const PHASES: Phase[] = ['intro', 'fight', 'roundEnd', 'finisher', 'fatality', 'matchEnd'];
// A Record, not an array: adding an ActionKind without an id is now a type
// error (P3.7 — 'taunt' was missing, so it hashed as -1). Ids are stable;
// append new kinds at the end.
const KIND_ID: Record<ActionKind, number> = {
  idle: 0, walkF: 1, walkB: 2, crouch: 3, prejump: 4, air: 5, attack: 6, airAttack: 7,
  hitstun: 8, blockstun: 9, airHit: 10, knockdown: 11, getup: 12, landing: 13, ko: 14, dazed: 15,
  taunt: 16,
};

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);

/** Streaming FNV-1a over float64 bit patterns. */
class Fnv {
  private h = 0x811c9dc5;

  num(n: number): void {
    f64[0] = n;
    this.word(u32[0]);
    this.word(u32[1]);
  }

  private word(w: number): void {
    let h = this.h;
    for (let shift = 0; shift < 32; shift += 8) {
      h ^= (w >>> shift) & 0xff;
      // h * 16777619 without float precision loss
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    this.h = h;
  }

  get value(): number {
    return this.h >>> 0;
  }
}

/** Hash the numeric core of a GameState. Equal on both peers ⇔ sims agree. */
export function hashState(s: GameState): number {
  const fnv = new Fnv();
  fnv.num(s.tick);
  fnv.num(PHASES.indexOf(s.phase));
  fnv.num(s.phaseFrame);
  fnv.num(s.roundNumber);
  fnv.num(s.timer);
  fnv.num(s.wins[0]);
  fnv.num(s.wins[1]);
  fnv.num(s.roundWinner === null ? -1 : s.roundWinner);
  for (const f of s.fighters) {
    fnv.num(f.x);
    fnv.num(f.y);
    fnv.num(f.vx);
    fnv.num(f.vy);
    fnv.num(f.facing);
    fnv.num(f.health);
    fnv.num(f.stun);
    fnv.num(f.hitstop);
    fnv.num(KIND_ID[f.action.kind]);
    fnv.num(f.action.frame);
    // P3.10: hidden state that decides FUTURE ticks — without it a divergence
    // (a dropped buffered press, a charge one tick short) hid until it acted
    fnv.num(f.charge);
    fnv.num(f.backCharge);
    fnv.num(f.chargeWindow);
    fnv.num(f.backChargeWindow);
    fnv.num(f.dashStocks);
    fnv.num(f.dashRegen);
    fnv.num(f.comboHits);
    fnv.num(f.buffered ? f.buffered.ticksLeft : -1);
    fnv.num(f.inputBuffer.length);
    for (const w of f.inputBuffer) fnv.num(w);
  }
  fnv.num(s.projectiles.length);
  for (const p of s.projectiles) {
    fnv.num(p.owner);
    fnv.num(p.x);
    fnv.num(p.y);
    fnv.num(p.vx);
    fnv.num(p.vy);
    fnv.num(p.ttl);
    fnv.num(p.fuse);
  }
  fnv.num(s.pendingThrow ? s.pendingThrow.ticksLeft : -1);
  return fnv.value;
}
