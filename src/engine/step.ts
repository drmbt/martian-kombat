// The deterministic fight core: step(state, inputs, defs) advances exactly one
// 60hz tick. Same state + same inputs => same result, always. No Phaser, no
// randomness, no wall clock — this is what makes replay/rollback possible.

import {
  Box,
  CharacterDef,
  FighterState,
  GameState,
  InputFrame,
  Motion,
  MoveDef,
  Projectile,
  Strength,
} from './types';
import {
  FATALITY_RANGE,
  FATALITY_TICKS,
  FINISHER_TICKS,
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
    fatality: null,
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
const KICK_BITS = BIT.lk | BIT.mk | BIT.hk;

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

/** Staged motion matcher over the input buffer, facing-aware.
 *  Each stage is {need, not?}: a buffered frame advances the stage when it has
 *  every `need` bit and no `not` bit. The (simplified) 360 instead requires
 *  down + back + forward all seen inside the window ("270 rule" — pressing up
 *  would start a jump, exactly like real players buffer SPDs). */
function motionDone(f: FighterState, motion: Motion): boolean {
  const buf = f.inputBuffer;
  const from = Math.max(0, buf.length - 18);
  const fwd = f.facing === 1 ? BIT.right : BIT.left;
  const back = f.facing === 1 ? BIT.left : BIT.right;

  if (motion === '360') {
    let seen = 0;
    for (let i = from; i < buf.length; i++) {
      if (buf[i] & BIT.down) seen |= 1;
      if (buf[i] & back) seen |= 2;
      if (buf[i] & fwd) seen |= 4;
    }
    return seen === 7;
  }

  const STAGES: Record<Exclude<Motion, '360'>, { need: number; not?: number }[]> = {
    qcf: [{ need: BIT.down }, { need: fwd, not: BIT.down }],
    qcb: [{ need: BIT.down }, { need: back, not: BIT.down }],
    bf: [{ need: back }, { need: fwd, not: back }],
    dp: [{ need: fwd, not: BIT.down }, { need: BIT.down }, { need: fwd }],
    hcb: [{ need: fwd }, { need: BIT.down }, { need: back }],
    hcf: [{ need: back }, { need: BIT.down }, { need: fwd }],
  };
  const stages = STAGES[motion];
  let stage = 0;
  for (let i = from; i < buf.length; i++) {
    const s = stages[stage];
    if ((buf[i] & s.need) === s.need && !(buf[i] & (s.not ?? 0))) {
      stage++;
      if (stage === stages.length) return true;
    }
  }
  return false;
}

const STRENGTH_BITS: Record<'punch' | 'kick', [number, number, number]> = {
  punch: [BIT.lp, BIT.mp, BIT.hp],
  kick: [BIT.lk, BIT.mk, BIT.hk],
};

/** Which strength of the class was FRESHLY pressed this tick (h wins ties). */
function freshStrength(f: FighterState, cls: 'punch' | 'kick'): Strength | null {
  const [l, m, h] = STRENGTH_BITS[cls];
  if (freshPress(f, h)) return 'h';
  if (freshPress(f, m)) return 'm';
  if (freshPress(f, l)) return 'l';
  return null;
}

/** 2+ presses of the class landing within a ~5-tick window (practical 3P/3K —
 *  humans can't hit two keys on the same 60hz tick; SFII buffers this too).
 *  A button counts if it's held NOW and was released at some point inside the
 *  window (i.e. it's a recent press, not an ancient hold). */
function comboPress(f: FighterState, cls: 'punch' | 'kick'): boolean {
  const buf = f.inputBuffer;
  const cur = buf[buf.length - 1] ?? 0;
  let recent = 0;
  for (const bit of STRENGTH_BITS[cls]) {
    if (!(cur & bit)) continue;
    for (let i = buf.length - 6; i < buf.length - 1; i++) {
      // frames before the buffer began count as released
      if (i < 0 || !(buf[i] & bit)) {
        recent++;
        break;
      }
    }
  }
  return recent >= 2;
}

/** Effective move for an action: base numbers + the strength's variant patch.
 *  Exported — the renderer uses the same timings for animation phases. */
export function resolveMove(base: MoveDef, strength?: Strength): MoveDef {
  const patch = strength ? base.variants?.[strength] : undefined;
  if (!patch) return base;
  const { projectile: projPatch, ...rest } = patch;
  const merged: MoveDef = { ...base, ...rest, variants: base.variants };
  if (projPatch && base.projectile) {
    merged.projectile = { ...base.projectile, ...projPatch };
  }
  return merged;
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
  const a = f.action;
  if (a.kind === 'attack' && (a.invuln ?? 0) > a.frame) return true; // reversal i-frames
  const k = a.kind;
  return k === 'knockdown' || k === 'getup' || k === 'ko' || k === 'dazed';
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

interface AttackPick {
  id: string;
  strength?: Strength;
}

function pickAttack(
  s: GameState,
  slot: 0 | 1,
  def: CharacterDef,
  i: InputFrame,
  stance: 'stand' | 'crouch',
): AttackPick | null {
  const f = s.fighters[slot];
  // named specials: each declares its own motion + button class; the button's
  // strength (L/M/H) selects the variant
  for (const [id, m] of Object.entries(def.moves)) {
    if (!m.input) continue;
    const cls = m.input.button === 'PPP' ? 'punch' : m.input.button === 'KKK' ? 'kick' : m.input.button;
    const combo = m.input.button === 'PPP' || m.input.button === 'KKK';
    const strength = combo ? (comboPress(f, cls) ? 'm' : null) : freshStrength(f, cls);
    if (!strength) continue;
    if (m.input.motion && !motionDone(f, m.input.motion)) continue;
    if (m.projectile && ownsLiveProjectile(s, slot)) continue;
    return { id, strength };
  }
  const prefix = stance === 'crouch' ? 'c' : '';
  for (const b of BUTTON_PRIORITY) {
    if (i[b] && def.moves[prefix + b]) return { id: prefix + b };
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
      // early chord upgrade: a lone punch that becomes a 2-punch chord within
      // the first few frames kara-cancels into the PPP/KKK special (nobody
      // can hit two keys on the same 60hz tick)
      if (!def.moves[a.moveId!].input && a.frame < 4) {
        for (const [id, mv] of Object.entries(def.moves)) {
          if (!mv.input || (mv.input.button !== 'PPP' && mv.input.button !== 'KKK')) continue;
          if (comboPress(f, mv.input.button === 'PPP' ? 'punch' : 'kick')) {
            const up = resolveMove(mv, 'm');
            f.action = { kind: 'attack', frame: 0, moveId: id, strength: 'm', hasHit: false, invuln: up.invuln ?? 0 };
            break;
          }
        }
      }
      const act = f.action;
      const m = resolveMove(def.moves[act.moveId!], act.strength);
      act.frame++;
      if (m.forwardVel && act.frame <= m.startup + m.active) {
        f.x += f.facing * m.forwardVel;
      }
      // shoryuken leaps: rise while the attack stays out
      if (m.leap) {
        if (act.frame === m.startup) {
          f.vy = -m.leap.vy;
          f.vx = f.facing * m.leap.vx;
          f.y -= 1;
        }
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
      }
      // vaults launch airborne at the first active frame (Staff Vault)
      if (m.vault && act.frame === m.startup) {
        f.vy = -m.vault.vy;
        f.vx = f.facing * m.vault.vx;
        f.y -= 1;
        f.action = { kind: 'air', frame: 0 };
        break;
      }
      // projectiles spawn on the first active frame (fans spawn several)
      if (m.projectile && act.frame === m.startup) {
        const p = m.projectile;
        for (let n = 0; n < (p.count ?? 1); n++) {
          s.projectiles.push({
            owner: slot,
            moveId: act.moveId!,
            x: f.x + f.facing * p.spawnX,
            y: f.y + p.spawnY + n * (p.spreadY ?? 0),
            vx: f.facing * (p.vx + n * (p.spreadVX ?? 0)),
            box: p.box,
            damage: p.damage,
            hitstun: p.hitstun,
            blockstun: p.blockstun,
            knockback: p.knockback,
            height: p.height ?? 'mid',
            ttl: p.ttl ?? -1,
          });
        }
      }
      if (act.frame >= m.startup + m.active + m.recovery) {
        // a leap that ends airborne falls the rest of the way
        f.action = grounded(f) ? { kind: 'idle', frame: 0 } : { kind: 'air', frame: 0 };
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
    case 'dazed': {
      // standing defeated, swaying, waiting for the finisher window to resolve
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
        const resolved = resolveMove(def.moves[attack.id], attack.strength);
        f.action = {
          kind: 'attack',
          frame: 0,
          moveId: attack.id,
          strength: attack.strength,
          hasHit: false,
          invuln: resolved.invuln ?? 0,
        };
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
  /** command grabs ignore blocking entirely */
  unblockable?: boolean;
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

  if (!hit.unblockable && isBlocking(d, defInput, hit.height)) {
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
    const m = resolveMove(defs[f.charId].moves[a.moveId!], a.strength);
    if (a.frame < m.startup || a.frame >= m.startup + m.active) continue;

    const defSlot = slot === 0 ? 1 : 0;
    const d = s.fighters[defSlot];
    if (isInvulnerable(d)) continue;

    // command grabs: unblockable, range-based, grounded targets only
    if (m.grab) {
      if (grounded(d) && Math.abs(f.x - d.x) <= m.grab.range) {
        a.hasHit = true;
        applyHit(s, defSlot, f.facing, {
          damage: m.damage,
          hitstun: m.hitstun,
          blockstun: m.blockstun,
          knockback: m.knockback,
          height: m.height,
          knockdown: true,
          chip: 0,
          unblockable: true,
        }, inputs[defSlot]);
        if (m.grabRecoil) f.vx = -f.facing * m.grabRecoil; // 86'd bounce-away
      }
      continue;
    }

    if (!m.hitbox) continue;
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
    // reflectors bounce it back at the sender; lariats phase through it
    const da = d.action;
    if (da.kind === 'attack') {
      const dm = resolveMove(defs[d.charId].moves[da.moveId!], da.strength);
      const inWindow = da.frame < dm.startup + dm.active;
      if (dm.reflect && inWindow && overlaps(pr, defenderHurtRect(d, defs[d.charId]))) {
        p.owner = defSlot;
        p.vx = -p.vx;
        continue;
      }
      if (dm.projImmune && inWindow) continue;
    }
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

function endRound(s: GameState, winner: 0 | 1 | null, defs: Defs): void {
  s.roundWinner = winner;
  if (winner !== null) s.wins[winner]++;

  // match-deciding KO by a fighter with a fatality: open the finisher window
  // instead of the normal KO — the loser stands dazed, awaiting their fate
  if (winner !== null && s.wins[winner] >= WINS_NEEDED) {
    const loser = winner === 0 ? 1 : 0;
    const winnerDef = defs[s.fighters[winner].charId];
    if (winnerDef.fatality && s.fighters[loser].health <= 0) {
      s.phase = 'finisher';
      s.phaseFrame = 0;
      s.projectiles = [];
      s.fighters[loser].action = { kind: 'dazed', frame: 0 };
      s.fighters[loser].vx = 0;
      return;
    }
  }

  s.phase = 'roundEnd';
  s.phaseFrame = 0;
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

  if (s.phase === 'finisher') {
    s.phaseFrame++;
    const w = s.roundWinner as 0 | 1;
    const loser = w === 0 ? 1 : 0;
    const winner = s.fighters[w];
    const winnerDef = defs[winner.charId];

    // winner stays controllable (walk into range, style on them); nothing
    // can deal damage anymore
    updateFighter(s, w, winnerDef, inputs[w]);
    s.projectiles = [];
    winner.x = Math.min(STAGE_MAX_X, Math.max(STAGE_MIN_X, winner.x));
    if (canAct(winner) && grounded(winner)) {
      winner.facing = s.fighters[loser].x >= winner.x ? 1 : -1;
    }

    const fat = winnerDef.fatality;
    const fatCls =
      fat?.input.button === 'PPP' ? 'punch' : fat?.input.button === 'KKK' ? 'kick' : fat?.input.button;
    const fatPressed =
      fat &&
      (fat.input.button === 'PPP' || fat.input.button === 'KKK'
        ? comboPress(winner, fatCls as 'punch' | 'kick')
        : freshStrength(winner, fatCls as 'punch' | 'kick') !== null);
    if (
      fat &&
      fatPressed &&
      (!fat.input.motion || motionDone(winner, fat.input.motion)) &&
      Math.abs(winner.x - s.fighters[loser].x) <= (fat.range ?? FATALITY_RANGE)
    ) {
      s.phase = 'fatality';
      s.phaseFrame = 0;
      s.fatality = { owner: w, id: fat.id };
      winner.action = { kind: 'idle', frame: 0 };
      return s;
    }

    if (s.phaseFrame >= FINISHER_TICKS) {
      // mercy: no fatality input — the loser just collapses
      const l = s.fighters[loser];
      l.action = { kind: 'ko', frame: 0 };
      l.vy = -6;
      l.vx = -l.facing * 3.5;
      l.y -= 1;
      s.phase = 'roundEnd';
      s.phaseFrame = 0;
    }
    return s;
  }

  if (s.phase === 'fatality') {
    s.phaseFrame++;
    if (s.phaseFrame >= FATALITY_TICKS) {
      s.phase = 'matchEnd';
      s.phaseFrame = 0;
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
    endRound(s, ko1 && ko2 ? null : ko1 ? 1 : 0, defs);
  } else if (s.timer <= 0) {
    endRound(s, f1.health > f2.health ? 0 : f2.health > f1.health ? 1 : null, defs);
  }

  return s;
}
