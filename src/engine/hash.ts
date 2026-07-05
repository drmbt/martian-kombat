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
const KINDS: ActionKind[] = [
  'idle', 'walkF', 'walkB', 'crouch', 'prejump', 'air', 'attack', 'airAttack',
  'hitstun', 'blockstun', 'airHit', 'knockdown', 'getup', 'landing', 'ko', 'dazed',
];

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
    fnv.num(KINDS.indexOf(f.action.kind));
    fnv.num(f.action.frame);
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
