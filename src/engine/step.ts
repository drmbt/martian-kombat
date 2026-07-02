// The deterministic fight core: step(state, inputs, defs) advances exactly one
// 60hz tick. Same state + same inputs => same result, always. No Phaser, no
// randomness, no wall clock — this is what makes replay/rollback possible.

import {
  Box,
  CharacterDef,
  FighterState,
  GameState,
  InputFrame,
  Projectile,
} from './types';
import {
  FLOOR_Y,
  GETUP_TICKS,
  GROUND_FRICTION,
  INPUT_BUFFER_LEN,
  INTRO_TICKS,
  KNOCKDOWN_TICKS,
  ROUND_END_TICKS,
  ROUND_TICKS,
  SPAWN_OFFSET,
  STAGE_MAX_X,
  STAGE_MIN_X,
  STAGE_W,
  WINS_NEEDED,
} from './constants';

export type Defs = Record<string, CharacterDef>;

// ---------- construction ----------

function initFighter(charId: string, def: CharacterDef, slot: 0 | 1): FighterState {
  return {
    charId,
    x: STAGE_W / 2 + (slot === 0 ? -SPAWN_OFFSET : SPAWN_OFFSET),
    y: FLOOR_Y,
    vx: 0,
    vy: 0,
    facing: slot === 0 ? 1 : -1,
    health: def.health,
    action: { kind: 'idle', frame: 0 },
    inputBuffer: [],
  };
}

export function initialState(charA: string, charB: string, defs: Defs): GameState {
  return {
    tick: 0,
    phase: 'intro',
    phaseFrame: 0,
    roundNumber: 1,
    timer: ROUND_TICKS,
    fighters: [initFighter(charA, defs[charA], 0), initFighter(charB, defs[charB], 1)],
    projectiles: [],
    wins: [0, 0],
    roundWinner: null,
  };
}

function resetRound(s: GameState, defs: Defs): void {
  const [a, b] = s.fighters;
  s.fighters = [initFighter(a.charId, defs[a.charId], 0), initFighter(b.charId, defs[b.charId], 1)];
  s.projectiles = [];
  s.timer = ROUND_TICKS;
  s.roundNumber++;
  s.roundWinner = null;
  s.phase = 'intro';
  s.phaseFrame = 0;
}

// ---------- geometry ----------

interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}

/** Box (facing-relative, feet origin) -> world rect. */
export function worldBox(f: FighterState, box: Box): Rect {
  const l = f.facing === 1 ? f.x + box.x : f.x - box.x - box.w;
  return { l, t: f.y + box.y, r: l + box.w, b: f.y + box.y + box.h };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
}

// ---------- input helpers ----------

export const BIT = {
  left: 1, right: 2, up: 4, down: 8,
  lp: 16, mp: 32, hp: 64, lk: 128, mk: 256, hk: 512,
} as const;
const PUNCH_BITS = BIT.lp | BIT.mp | BIT.hp;

export function packInput(i: InputFrame): number {
  return (
    (i.left ? BIT.left : 0) |
    (i.right ? BIT.right : 0) |
    (i.up ? BIT.up : 0) |
    (i.down ? BIT.down : 0) |
    (i.lp ? BIT.lp : 0) |
    (i.mp ? BIT.mp : 0) |
    (i.hp ? BIT.hp : 0) |
    (i.lk ? BIT.lk : 0) |
    (i.mk ? BIT.mk : 0) |
    (i.hk ? BIT.hk : 0)
  );
}

/** True when any bit of `mask` is down this tick but was up last tick. */
function freshPress(f: FighterState, mask: number): boolean {
  const buf = f.inputBuffer;
  const cur = (buf[buf.length - 1] ?? 0) & mask;
  const prev = (buf[buf.length - 2] ?? 0) & mask;
  return cur !== 0 && prev === 0;
}

/** Quarter-circle-forward (↓ ↘ →) inside the buffer window, facing-aware. */
function hasQCF(f: FighterState): boolean {
  const buf = f.inputBuffer;
  const fwdBit = f.facing === 1 ? BIT.right : BIT.left;
  let stage = 0; // saw ↓, then saw → (without ↓)
  for (let i = Math.max(0, buf.length - 14); i < buf.length; i++) {
    const b = buf[i];
    if (stage === 0 && b & BIT.down) stage = 1;
    else if (stage === 1 && b & fwdBit && !(b & BIT.down)) return true;
  }
  return false;
}

function holdingBack(f: FighterState, i: InputFrame): boolean {
  return f.facing === 1 ? i.left : i.right;
}

function holdingForward(f: FighterState, i: InputFrame): boolean {
  return f.facing === 1 ? i.right : i.left;
}

/** Double-tap detection against the rolling input buffer (newest entry is the
 *  current tick). Pattern: press now, with a release and an earlier press of
 *  the same direction inside the buffer window. */
function doubleTapped(f: FighterState, dir: 'f' | 'b'): boolean {
  const buf = f.inputBuffer;
  if (buf.length < 3) return false;
  const bit = (dir === 'f') === (f.facing === 1) ? 2 : 1; // right : left
  const cur = buf[buf.length - 1] & bit;
  const prev = buf[buf.length - 2] & bit;
  if (!cur || prev) return false; // not a fresh press
  let sawGap = false;
  for (let i = buf.length - 3; i >= 0; i--) {
    if (!(buf[i] & bit)) sawGap = true;
    else if (sawGap) return true; // earlier press separated by a release
  }
  return false;
}

const DASH_SPEED = 9;
const BACKDASH_SPEED = 7;

// ---------- state queries ----------

const ACTIONABLE = new Set(['idle', 'walkF', 'walkB', 'crouch']);

function canAct(f: FighterState): boolean {
  return ACTIONABLE.has(f.action.kind);
}

function isInvulnerable(f: FighterState): boolean {
  const k = f.action.kind;
  return k === 'knockdown' || k === 'getup' || k === 'ko';
}

function grounded(f: FighterState): boolean {
  return f.y >= FLOOR_Y;
}

/** Can this player fire a projectile? (classic one-fireball-on-screen rule) */
function ownsLiveProjectile(s: GameState, slot: 0 | 1): boolean {
  return s.projectiles.some((p) => p.owner === slot);
}

// ---------- per-fighter update ----------

// heavier buttons win when several land on the same tick
const BUTTON_PRIORITY = ['hp', 'hk', 'mp', 'mk', 'lp', 'lk'] as const;

function pickAttack(
  s: GameState,
  slot: 0 | 1,
  def: CharacterDef,
  i: InputFrame,
  stance: 'stand' | 'crouch',
): string | null {
  const f = s.fighters[slot];
  // special: quarter-circle-forward + fresh punch press
  if (def.moves.special && hasQCF(f) && freshPress(f, PUNCH_BITS)) {
    const m = def.moves.special;
    if (!(m.projectile && ownsLiveProjectile(s, slot))) return 'special';
  }
  const prefix = stance === 'crouch' ? 'c' : '';
  for (const b of BUTTON_PRIORITY) {
    if (i[b] && def.moves[prefix + b]) return prefix + b;
  }
  return null;
}

function pickAirAttack(f: FighterState, def: CharacterDef, i: InputFrame): string | null {
  for (const b of BUTTON_PRIORITY) {
    if (i[b] && def.moves[`j${b}`] && freshPress(f, BIT[b])) return `j${b}`;
  }
  return null;
}

function updateFighter(
  s: GameState,
  slot: 0 | 1,
  def: CharacterDef,
  input: InputFrame,
): void {
  const f = s.fighters[slot];
  const a = f.action;

  switch (a.kind) {
    case 'attack': {
      const m = def.moves[a.moveId!];
      a.frame++;
      if (m.forwardVel && a.frame <= m.startup + m.active) {
        f.x += f.facing * m.forwardVel;
      }
      // projectile spawns on the first active frame
      if (m.projectile && a.frame === m.startup) {
        const p = m.projectile;
        s.projectiles.push({
          owner: slot,
          x: f.x + f.facing * p.spawnX,
          y: f.y + p.spawnY,
          vx: f.facing * p.vx,
          box: p.box,
          damage: p.damage,
          hitstun: p.hitstun,
          blockstun: p.blockstun,
          knockback: p.knockback,
          height: p.height ?? 'mid',
          ttl: p.ttl ?? -1,
        });
      }
      if (a.frame >= m.startup + m.active + m.recovery) {
        f.action = { kind: 'idle', frame: 0 };
      }
      break;
    }
    case 'prejump': {
      a.frame++;
      if (a.frame >= def.prejumpFrames) {
        f.vy = -def.jumpVel;
        f.vx = (input.right ? 1 : 0) * def.walkSpeed - (input.left ? 1 : 0) * def.walkSpeed;
        f.action = { kind: 'air', frame: 0 };
      }
      break;
    }
    case 'air':
    case 'airHit': {
      f.vy += def.gravity;
      f.y += f.vy;
      f.x += f.vx;
      if (f.y >= FLOOR_Y) {
        f.y = FLOOR_Y;
        f.vy = 0;
        f.vx = 0;
        f.action =
          a.kind === 'airHit' ? { kind: 'knockdown', frame: 0 } : { kind: 'idle', frame: 0 };
      } else if (a.kind === 'air') {
        const id = pickAirAttack(f, def, input);
        if (id) f.action = { kind: 'airAttack', frame: 0, moveId: id, hasHit: false };
      }
      break;
    }
    case 'airAttack': {
      const m = def.moves[a.moveId!];
      a.frame++;
      f.vy += def.gravity;
      f.y += f.vy;
      f.x += f.vx;
      if (f.y >= FLOOR_Y) {
        // landing cancels the air normal
        f.y = FLOOR_Y;
        f.vy = 0;
        f.vx = 0;
        f.action = { kind: 'idle', frame: 0 };
      } else if (a.frame >= m.startup + m.active + m.recovery) {
        f.action = { kind: 'air', frame: 0 };
      }
      break;
    }
    case 'hitstun':
    case 'blockstun': {
      a.frame--;
      if (a.frame <= 0) f.action = { kind: 'idle', frame: 0 };
      break;
    }
    case 'knockdown': {
      a.frame++;
      if (a.frame >= KNOCKDOWN_TICKS) f.action = { kind: 'getup', frame: 0 };
      break;
    }
    case 'getup': {
      a.frame++;
      if (a.frame >= GETUP_TICKS) f.action = { kind: 'idle', frame: 0 };
      break;
    }
    case 'ko': {
      if (!grounded(f)) {
        f.vy += def.gravity;
        f.y += f.vy;
        f.x += f.vx;
        if (f.y >= FLOOR_Y) {
          f.y = FLOOR_Y;
          f.vy = 0;
          f.vx = 0;
        }
      }
      break;
    }
    default: {
      // idle / walkF / walkB / crouch — fully actionable
      const stance = input.down ? 'crouch' : 'stand';
      const attack = pickAttack(s, slot, def, input, stance);
      if (attack) {
        f.action = { kind: 'attack', frame: 0, moveId: attack, hasHit: false };
      } else if (input.up) {
        f.action = { kind: 'prejump', frame: 0 };
      } else if (input.down) {
        f.action = { kind: 'crouch', frame: 0 };
      } else if (holdingForward(f, input)) {
        // double-tap forward = dash: an impulse the ground friction bleeds off
        if (doubleTapped(f, 'f')) f.vx = f.facing * DASH_SPEED;
        f.action = { kind: 'walkF', frame: 0 };
        f.x += f.facing * def.walkSpeed;
      } else if (holdingBack(f, input)) {
        if (doubleTapped(f, 'b')) f.vx = -f.facing * BACKDASH_SPEED;
        f.action = { kind: 'walkB', frame: 0 };
        f.x -= f.facing * def.backSpeed;
      } else {
        f.action = { kind: 'idle', frame: 0 };
      }
      break;
    }
  }

  // knockback slide + friction for anyone on the ground (walk speed above is
  // positional, vx is purely impulse from hits/blocks)
  if (grounded(f) && a.kind !== 'air' && a.kind !== 'airHit' && a.kind !== 'airAttack') {
    f.x += f.vx;
    f.vx *= GROUND_FRICTION;
    if (Math.abs(f.vx) < 0.05) f.vx = 0;
  }
}

// ---------- combat resolution ----------

function defenderHurtRect(f: FighterState, def: CharacterDef): Rect {
  const a = f.action;
  const crouched = a.kind === 'crouch' || (a.kind === 'attack' && a.moveId?.startsWith('c'));
  return worldBox(f, crouched ? def.hurtCrouch : def.hurtStand);
}

function isBlocking(f: FighterState, i: InputFrame, height: 'mid' | 'low' | 'high'): boolean {
  if (!grounded(f)) return false;
  const k = f.action.kind;
  const guardReady =
    k === 'idle' || k === 'walkF' || k === 'walkB' || k === 'crouch' || k === 'blockstun';
  if (!guardReady || !holdingBack(f, i)) return false;
  const crouchGuard = i.down || k === 'crouch';
  if (height === 'low' && !crouchGuard) return false; // lows need crouch-block
  if (height === 'high' && crouchGuard) return false; // overheads beat crouch-block
  return true;
}

interface HitPayload {
  damage: number;
  hitstun: number;
  blockstun: number;
  knockback: number;
  height: 'mid' | 'low' | 'high';
  knockdown: boolean;
  /** damage dealt through block (heavies/specials); can never KO */
  chip: number;
}

/** lights are chipless; everything meatier shaves 10% through block */
const CHIPLESS = new Set(['lp', 'lk', 'clp', 'clk', 'jlp', 'jlk']);

/** Apply a connected hit or block. attackerFacing pushes the defender. */
function applyHit(
  s: GameState,
  defSlot: 0 | 1,
  attackerFacing: 1 | -1,
  hit: HitPayload,
  defInput: InputFrame,
): void {
  const d = s.fighters[defSlot];
  const atkSlot = defSlot === 0 ? 1 : 0;

  if (isBlocking(d, defInput, hit.height)) {
    const guard = d.action.kind === 'crouch' || defInput.down ? 'crouch' : 'stand';
    d.action = { kind: 'blockstun', frame: hit.blockstun, guard };
    d.vx = attackerFacing * hit.knockback * 0.8;
    if (hit.chip > 0) d.health = Math.max(1, d.health - hit.chip); // chip can't KO
  } else {
    d.health = Math.max(0, d.health - hit.damage);
    if (!grounded(d)) {
      d.action = { kind: 'airHit', frame: 0 };
      d.vx = attackerFacing * hit.knockback * 0.6;
      d.vy = -5;
    } else if (hit.knockdown) {
      d.action = { kind: 'airHit', frame: 0 };
      d.vx = attackerFacing * hit.knockback * 0.6;
      d.vy = -4.5;
    } else {
      d.action = { kind: 'hitstun', frame: hit.hitstun };
      d.vx = attackerFacing * hit.knockback;
    }
  }

  // corner transfer: if the defender is pinned on a wall, push the attacker
  // back instead so spacing still changes
  if (d.x <= STAGE_MIN_X + 1 || d.x >= STAGE_MAX_X - 1) {
    s.fighters[atkSlot].vx = -attackerFacing * hit.knockback * 0.7;
  }
}

function resolveAttacks(s: GameState, defs: Defs, inputs: [InputFrame, InputFrame]): void {
  // snapshot both attacks first so trades (both connect same tick) work
  for (const slot of [0, 1] as const) {
    const f = s.fighters[slot];
    const a = f.action;
    if ((a.kind !== 'attack' && a.kind !== 'airAttack') || a.hasHit) continue;
    const m = defs[f.charId].moves[a.moveId!];
    if (!m.hitbox) continue;
    if (a.frame < m.startup || a.frame >= m.startup + m.active) continue;

    const defSlot = slot === 0 ? 1 : 0;
    const d = s.fighters[defSlot];
    if (isInvulnerable(d)) continue;

    if (overlaps(worldBox(f, m.hitbox), defenderHurtRect(d, defs[d.charId]))) {
      a.hasHit = true;
      applyHit(s, defSlot, f.facing, {
        damage: m.damage,
        hitstun: m.hitstun,
        blockstun: m.blockstun,
        knockback: m.knockback,
        height: m.height,
        knockdown: !!m.knockdown,
        chip: CHIPLESS.has(a.moveId!) ? 0 : Math.floor(m.damage * 0.1),
      }, inputs[defSlot]);
    }
  }
}

function updateProjectiles(s: GameState, defs: Defs, inputs: [InputFrame, InputFrame]): void {
  for (const p of s.projectiles) {
    p.x += p.vx;
    if (p.ttl > 0) p.ttl--;
  }

  // projectile vs projectile: clash and both die
  const dead = new Set<Projectile>();
  for (const p of s.projectiles) {
    for (const q of s.projectiles) {
      if (p.owner !== q.owner && !dead.has(p) && !dead.has(q)) {
        const pr = { l: p.x + p.box.x, t: p.y + p.box.y, r: p.x + p.box.x + p.box.w, b: p.y + p.box.y + p.box.h };
        const qr = { l: q.x + q.box.x, t: q.y + q.box.y, r: q.x + q.box.x + q.box.w, b: q.y + q.box.y + q.box.h };
        if (overlaps(pr, qr)) {
          dead.add(p);
          dead.add(q);
        }
      }
    }
  }

  for (const p of s.projectiles) {
    if (dead.has(p)) continue;
    if (p.x < -60 || p.x > STAGE_W + 60 || p.ttl === 0) {
      dead.add(p);
      continue;
    }
    const defSlot = p.owner === 0 ? 1 : 0;
    const d = s.fighters[defSlot];
    if (isInvulnerable(d)) continue;
    const pr = { l: p.x + p.box.x, t: p.y + p.box.y, r: p.x + p.box.x + p.box.w, b: p.y + p.box.y + p.box.h };
    if (overlaps(pr, defenderHurtRect(d, defs[d.charId]))) {
      applyHit(s, defSlot, (p.vx > 0 ? 1 : -1) as 1 | -1, {
        damage: p.damage,
        hitstun: p.hitstun,
        blockstun: p.blockstun,
        knockback: p.knockback,
        height: p.height,
        knockdown: false,
        chip: Math.floor(p.damage * 0.1),
      }, inputs[defSlot]);
      dead.add(p);
    }
  }

  if (dead.size) s.projectiles = s.projectiles.filter((p) => !dead.has(p));
}

// ---------- round flow ----------

function endRound(s: GameState, winner: 0 | 1 | null): void {
  s.phase = 'roundEnd';
  s.phaseFrame = 0;
  s.roundWinner = winner;
  if (winner !== null) s.wins[winner]++;
  for (const slot of [0, 1] as const) {
    const f = s.fighters[slot];
    if (f.health <= 0) {
      f.action = { kind: 'ko', frame: 0 };
      f.vy = -6;
      f.vx = -f.facing * 3.5;
      f.y -= 1; // lift off the floor so the KO arc plays
    }
  }
}

function passivePhysics(f: FighterState, def: CharacterDef): void {
  if (!grounded(f) || f.action.kind === 'ko') {
    f.vy += def.gravity;
    f.y += f.vy;
    f.x += f.vx;
    if (f.y >= FLOOR_Y) {
      f.y = FLOOR_Y;
      f.vy = 0;
      f.vx = 0;
    }
  } else {
    f.x += f.vx;
    f.vx *= GROUND_FRICTION;
    if (Math.abs(f.vx) < 0.05) f.vx = 0;
  }
  f.x = Math.min(STAGE_MAX_X, Math.max(STAGE_MIN_X, f.x));
}

// ---------- the tick ----------

export function step(s: GameState, inputs: [InputFrame, InputFrame], defs: Defs): GameState {
  s.tick++;

  for (const slot of [0, 1] as const) {
    const buf = s.fighters[slot].inputBuffer;
    buf.push(packInput(inputs[slot]));
    if (buf.length > INPUT_BUFFER_LEN) buf.shift();
  }

  if (s.phase === 'intro') {
    s.phaseFrame++;
    if (s.phaseFrame >= INTRO_TICKS) {
      s.phase = 'fight';
      s.phaseFrame = 0;
    }
    return s;
  }

  if (s.phase === 'roundEnd') {
    s.phaseFrame++;
    for (const slot of [0, 1] as const) {
      passivePhysics(s.fighters[slot], defs[s.fighters[slot].charId]);
    }
    if (s.phaseFrame >= ROUND_END_TICKS) {
      if (s.roundWinner !== null && s.wins[s.roundWinner] >= WINS_NEEDED) {
        s.phase = 'matchEnd';
        s.phaseFrame = 0;
      } else {
        resetRound(s, defs);
      }
    }
    return s;
  }

  if (s.phase === 'matchEnd') {
    s.phaseFrame++;
    return s;
  }

  // --- phase: fight ---
  const [f1, f2] = s.fighters;

  updateFighter(s, 0, defs[f1.charId], inputs[0]);
  updateFighter(s, 1, defs[f2.charId], inputs[1]);

  // face the opponent whenever actionable
  for (const slot of [0, 1] as const) {
    const f = s.fighters[slot];
    const o = s.fighters[slot === 0 ? 1 : 0];
    if (canAct(f) && grounded(f)) {
      if (o.x > f.x) f.facing = 1;
      else if (o.x < f.x) f.facing = -1;
    }
  }

  // body push: grounded fighters can't overlap
  if (grounded(f1) && grounded(f2) && !isInvulnerable(f1) && !isInvulnerable(f2)) {
    const r1 = worldBox(f1, defs[f1.charId].bodyBox);
    const r2 = worldBox(f2, defs[f2.charId].bodyBox);
    if (overlaps(r1, r2)) {
      const ox = Math.min(r1.r, r2.r) - Math.max(r1.l, r2.l);
      const dir = f1.x <= f2.x ? 1 : -1;
      f1.x -= (dir * ox) / 2;
      f2.x += (dir * ox) / 2;
    }
  }

  updateProjectiles(s, defs, inputs);
  resolveAttacks(s, defs, inputs);

  for (const slot of [0, 1] as const) {
    const f = s.fighters[slot];
    f.x = Math.min(STAGE_MAX_X, Math.max(STAGE_MIN_X, f.x));
  }

  s.timer--;

  // KO / time-up
  const ko1 = f1.health <= 0;
  const ko2 = f2.health <= 0;
  if (ko1 || ko2) {
    endRound(s, ko1 && ko2 ? null : ko1 ? 1 : 0);
  } else if (s.timer <= 0) {
    endRound(s, f1.health > f2.health ? 0 : f2.health > f1.health ? 1 : null);
  }

  return s;
}
