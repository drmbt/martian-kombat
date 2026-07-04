// The deterministic fight core: step(state, inputs, defs) advances exactly one
// 60hz tick. Same state + same inputs => same result, always. No Phaser, no
// randomness, no wall clock — this is what makes replay/rollback possible.

import {
  Box,
  CharacterDef,
  FighterState,
  GameState,
  InputFrame,
  MatchRules,
  Motion,
  MoveDef,
  Projectile,
  Strength,
} from './types';
import {
  ACTION_BUFFER_TICKS,
  BOUNCE_VY,
  CANCEL_WINDOW_TICKS,
  CHARGE_TICKS,
  COMBO_SCALE_FLOOR,
  COMBO_SCALE_STEP,
  COUNTER_HITSTOP_BONUS,
  COUNTER_HITSTUN_MULT,
  DASH_REGEN_TICKS,
  DASH_STOCKS,
  DIZZY_TICKS,
  FATALITY_RANGE,
  FATALITY_TICKS,
  FINISHER_TICKS,
  FLOOR_Y,
  GETUP_TICKS,
  GROUND_FRICTION,
  HITSTOP_HEAVY,
  HITSTOP_LIGHT,
  LANDING_TICKS,
  LANDING_WHIFF_TICKS,
  HITSTOP_MEDIUM,
  HITSTOP_SPECIAL,
  INPUT_BUFFER_LEN,
  INTRO_TICKS,
  KNOCKDOWN_TICKS,
  ROUND_END_TICKS,
  ROUND_TICKS,
  SPAWN_OFFSET,
  STAGE_MAX_X,
  STAGE_MIN_X,
  STAGE_W,
  STUN_DECAY,
  STUN_THRESHOLD,
  THROW_TECH_PUSH,
  THROW_TECH_RECOIL,
  THROW_TECH_TICKS,
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
    charge: 0,
    stun: 0,
    hitstop: 0,
    buffered: null,
    dashStocks: DASH_STOCKS,
    dashRegen: 0,
    comboHits: 0,
    floatGravity: 0,
  };
}

export function initialState(
  charA: string,
  charB: string,
  defs: Defs,
  rules?: Partial<MatchRules>,
): GameState {
  const r: MatchRules = {
    roundTicks: rules?.roundTicks ?? ROUND_TICKS,
    winsNeeded: rules?.winsNeeded ?? WINS_NEEDED,
  };
  return {
    tick: 0,
    phase: 'intro',
    phaseFrame: 0,
    roundNumber: 1,
    rules: r,
    timer: r.roundTicks,
    fighters: [initFighter(charA, defs[charA], 0), initFighter(charB, defs[charB], 1)],
    projectiles: [],
    wins: [0, 0],
    roundWinner: null,
    fatality: null,
    pendingThrow: null,
  };
}

function resetRound(s: GameState, defs: Defs): void {
  const [a, b] = s.fighters;
  s.fighters = [initFighter(a.charId, defs[a.charId], 0), initFighter(b.charId, defs[b.charId], 1)];
  s.projectiles = [];
  s.timer = s.rules.roundTicks;
  s.roundNumber++;
  s.roundWinner = null;
  s.phase = 'intro';
  s.phaseFrame = 0;
  s.pendingThrow = null;
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

  // charge down-up: banked hold (f.charge, decays fast on release) + up now.
  // pickAttack runs before the jump check, so the special wins over prejump.
  if (motion === 'du') {
    return f.charge >= CHARGE_TICKS && ((buf[buf.length - 1] ?? 0) & BIT.up) !== 0;
  }

  const STAGES: Record<Exclude<Motion, '360' | 'du'>, { need: number; not?: number }[]> = {
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

/** Mash trigger (lightning legs): the final press is THIS tick and the input
 *  buffer holds at least `need` fresh press edges of the class in total —
 *  any button of the class counts, so drumming lp/mp/hp all feed the mash. */
function mashedStrength(f: FighterState, cls: 'punch' | 'kick', need: number): Strength | null {
  const now = freshStrength(f, cls);
  if (!now) return null;
  const buf = f.inputBuffer;
  let edges = 0;
  for (const bit of STRENGTH_BITS[cls]) {
    for (let i = 0; i < buf.length; i++) {
      const prev = i > 0 ? buf[i - 1] : 0;
      if (buf[i] & bit && !(prev & bit)) edges++;
    }
  }
  return edges >= need ? now : null;
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

/** The universal-throw chord: LP AND LK held now, both pressed recently
 *  (same recent-press rule as comboPress, across the punch/kick classes). */
function throwChord(f: FighterState): boolean {
  const buf = f.inputBuffer;
  const cur = buf[buf.length - 1] ?? 0;
  if (!(cur & BIT.lp) || !(cur & BIT.lk)) return false;
  for (const bit of [BIT.lp, BIT.lk]) {
    let recent = false;
    for (let i = buf.length - 6; i < buf.length - 1; i++) {
      // frames before the buffer began count as released
      if (i < 0 || !(buf[i] & bit)) {
        recent = true;
        break;
      }
    }
    if (!recent) return false;
  }
  return true;
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

/** States where a fresh button press waits in the action buffer instead of
 *  being dropped: your own attack's tail, every reel, wakeup, prejump, and
 *  landing recovery. ('air' is absent — pickAirAttack consumes air presses.) */
const BUFFERABLE = new Set([
  'attack', 'airAttack', 'hitstun', 'blockstun', 'knockdown', 'getup', 'prejump', 'landing', 'dazed',
]);

function canAct(f: FighterState): boolean {
  return ACTIONABLE.has(f.action.kind);
}

/** Any of the six attack buttons freshly pressed this tick (per-button edge —
 *  a second button pressed while another is held still counts). */
function anyFreshButton(f: FighterState): boolean {
  const buf = f.inputBuffer;
  const cur = buf[buf.length - 1] ?? 0;
  const prev = buf[buf.length - 2] ?? 0;
  return ((cur & ~prev) & (PUNCH_BITS | KICK_BITS)) !== 0;
}

function isInvulnerable(f: FighterState): boolean {
  const a = f.action;
  if (a.kind === 'attack' && (a.invuln ?? 0) > a.frame) return true; // reversal i-frames
  if (a.kind === 'airHit' && a.bounced) return true; // rebounding off the floor = already down
  const k = a.kind;
  // 'dazed' is NOT here: a dizzied fighter is fully vulnerable (the finisher-
  // window daze doesn't care — nothing resolves attacks in that phase)
  return k === 'knockdown' || k === 'getup' || k === 'ko';
}

function grounded(f: FighterState): boolean {
  return f.y >= FLOOR_Y;
}

/** Can this player fire a projectile? (classic one-fireball-on-screen rule;
 *  visual fields like smoke don't count) */
function ownsLiveProjectile(s: GameState, slot: 0 | 1): boolean {
  return s.projectiles.some((p) => p.owner === slot && !p.field);
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
    let strength: Strength | null;
    if (m.input.button === 'LPLK') {
      strength = throwChord(f) ? 'l' : null;
    } else {
      const cls = m.input.button === 'PPP' ? 'punch' : m.input.button === 'KKK' ? 'kick' : m.input.button;
      const combo = m.input.button === 'PPP' || m.input.button === 'KKK';
      strength = combo
        ? comboPress(f, cls)
          ? 'm'
          : null
        : m.input.mash
          ? mashedStrength(f, cls, m.input.mash)
          : freshStrength(f, cls);
    }
    if (!strength) continue;
    if (m.input.motion && !motionDone(f, m.input.motion)) continue;
    if (m.projectile && !m.projectile.field && ownsLiveProjectile(s, slot)) continue;
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
      // chains & special cancels: once this move has CONTACTED (hit or block —
      // a.hasHit is set on either; whiffs never cancel), a buffered press may
      // cut its recovery short inside the cancel window. Chains are data
      // (`chains` on the move lists legal targets); `cancel: true` normals
      // may cancel into any motion special (grabs excluded — canceling into
      // a command grab on a reeling victim would be degenerate).
      let canceled = false;
      if (a.hasHit && f.buffered) {
        const cm = resolveMove(def.moves[a.moveId!], a.strength);
        if (a.frame <= cm.startup + cm.active + CANCEL_WINDOW_TICKS) {
          const target = def.moves[f.buffered.id];
          const isChain = !!target && !!cm.chains?.includes(f.buffered.id);
          const isSpecialCancel = !!target && !!cm.cancel && !!target.input && !target.grab;
          if (
            (isChain || isSpecialCancel) &&
            // one-fireball rule re-checked at cancel time
            !(target.projectile && !target.projectile.field && ownsLiveProjectile(s, slot))
          ) {
            const res = resolveMove(target, f.buffered.strength);
            f.action = {
              kind: 'attack',
              frame: 0,
              moveId: f.buffered.id,
              strength: f.buffered.strength,
              hasHit: false,
              invuln: res.invuln ?? 0,
            };
            f.buffered = null;
            canceled = true;
          }
        }
      }
      // early chord upgrade: a lone button that becomes a 2-button chord
      // within the first few frames kara-cancels into the PPP/KKK/LPLK
      // special (nobody can hit two keys on the same 60hz tick).
      // Single-button SPECIALS upgrade too — dp+2P lands one tick apart and
      // the qcf-tail special would otherwise steal the input (Gene's
      // Diffusion vs Hallucination) — but chord specials never re-upgrade.
      const cur = def.moves[a.moveId!];
      const curIsChord =
        cur.input?.button === 'PPP' || cur.input?.button === 'KKK' || cur.input?.button === 'LPLK';
      if (!canceled && !curIsChord && a.frame < 4) {
        for (const [id, mv] of Object.entries(def.moves)) {
          const btn = mv.input?.button;
          if (btn !== 'PPP' && btn !== 'KKK' && btn !== 'LPLK') continue;
          const chord = btn === 'LPLK' ? throwChord(f) : comboPress(f, btn === 'PPP' ? 'punch' : 'kick');
          if (!chord) continue;
          if (mv.input!.motion && !motionDone(f, mv.input!.motion)) continue;
          const str: Strength = btn === 'LPLK' ? 'l' : 'm';
          const up = resolveMove(mv, str);
          f.action = { kind: 'attack', frame: 0, moveId: id, strength: str, hasHit: false, invuln: up.invuln ?? 0 };
          break;
        }
      }
      const act = f.action;
      const m = resolveMove(def.moves[act.moveId!], act.strength);
      act.frame++;
      if (m.forwardVel && act.frame <= m.startup + m.active) {
        f.x += f.facing * m.forwardVel;
      }
      // teleports blink at the first active frame (Diffusion)
      if (m.teleport && act.frame === m.startup) {
        const o = s.fighters[slot === 0 ? 1 : 0];
        if (m.teleport.mode === 'behind') {
          f.x = o.x + (f.x <= o.x ? 90 : -90);
        } else {
          f.x = f.facing === 1 ? STAGE_MIN_X + 40 : STAGE_MAX_X - 40;
        }
        f.x = Math.min(STAGE_MAX_X, Math.max(STAGE_MIN_X, f.x));
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
      // yoga float: launch high, then drift down under reduced gravity
      // (cleared on touchdown or on getting hit) — air normals stay live
      if (m.float && act.frame === m.startup) {
        f.vy = -m.float.vy;
        f.vx = f.facing * (m.float.vx ?? 0);
        f.floatGravity = m.float.gravity;
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
            vy: p.vy ?? 0,
            gravity: p.gravity ?? 0,
            fuse: p.fuse ?? -1,
            knockdown: p.knockdown ?? false,
            field: p.field ?? false,
            detonate: p.detonate,
            rehit: p.rehit ?? 0,
            hitCooldown: 0,
            slowFactor: p.slowFactor ?? 0,
            pull: p.pull ?? false,
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
      // a float only slows a controlled fall — getting hit ends it (applyHit
      // clears it too, but knockdowns re-enter here as airHit)
      f.vy += a.kind === 'air' && f.floatGravity > 0 ? f.floatGravity : def.gravity;
      f.y += f.vy;
      f.x += f.vx;
      if (f.y >= FLOOR_Y) {
        f.floatGravity = 0;
        if (a.kind === 'airHit' && !a.bounced) {
          // ground-impact bounce: pop back off the floor once (invulnerable —
          // you're already down), then the next contact settles for real
          f.vy = -BOUNCE_VY;
          f.vx *= 0.5;
          f.y = FLOOR_Y - 1; // lift so the rebound arc plays
          a.bounced = true;
        } else {
          f.y = FLOOR_Y;
          f.vy = 0;
          f.vx = 0;
          f.action =
            a.kind === 'airHit'
              ? { kind: 'knockdown', frame: 0 }
              : { kind: 'landing', frame: LANDING_TICKS };
        }
      } else if (a.kind === 'air') {
        const id = pickAirAttack(f, def, input);
        if (id) f.action = { kind: 'airAttack', frame: 0, moveId: id, hasHit: false };
      }
      break;
    }
    case 'airAttack': {
      const m = def.moves[a.moveId!];
      a.frame++;
      f.vy += f.floatGravity > 0 ? f.floatGravity : def.gravity;
      f.y += f.vy;
      f.x += f.vx;
      if (f.y >= FLOOR_Y) {
        // landing interrupts the air normal — a whiff eats extra recovery
        f.floatGravity = 0;
        f.y = FLOOR_Y;
        f.vy = 0;
        f.vx = 0;
        f.action = { kind: 'landing', frame: a.hasHit ? LANDING_TICKS : LANDING_WHIFF_TICKS };
      } else if (a.frame >= m.startup + m.active + m.recovery) {
        f.action = { kind: 'air', frame: 0 };
      }
      break;
    }
    case 'landing': {
      a.frame--;
      if (a.frame <= 0) f.action = { kind: 'idle', frame: 0 };
      break;
    }
    case 'hitstun':
    case 'blockstun': {
      a.frame--;
      if (a.frame <= 0) {
        // stun past the threshold converts the reel into a dizzy (never off a block)
        f.action =
          a.kind === 'hitstun' && f.stun >= STUN_THRESHOLD
            ? { kind: 'dazed', frame: 0 }
            : { kind: 'idle', frame: 0 };
      }
      break;
    }
    case 'knockdown': {
      a.frame++;
      if (a.frame >= KNOCKDOWN_TICKS) f.action = { kind: 'getup', frame: 0 };
      break;
    }
    case 'getup': {
      a.frame++;
      if (a.frame >= GETUP_TICKS) {
        f.action =
          f.stun >= STUN_THRESHOLD ? { kind: 'dazed', frame: 0 } : { kind: 'idle', frame: 0 };
      }
      break;
    }
    case 'dazed': {
      // dizzy: helpless, counting up to recovery. (The finisher-window daze
      // never reaches here — updateFighter isn't called for the loser then.)
      a.frame++;
      if (a.frame >= DIZZY_TICKS) {
        f.stun = 0;
        f.action = { kind: 'idle', frame: 0 };
      }
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
      // a buffered press (wakeup reversal, landing buffer, tap during a reel
      // or recovery) fires on this first actionable frame; consumed either
      // way — one press never triggers twice
      let attack: AttackPick | null = null;
      if (f.buffered) {
        const mv = def.moves[f.buffered.id];
        // re-check the one-fireball rule at execution time
        if (mv && !(mv.projectile && !mv.projectile.field && ownsLiveProjectile(s, slot))) {
          attack = { id: f.buffered.id, strength: f.buffered.strength };
        }
        f.buffered = null;
      }
      if (!attack) attack = pickAttack(s, slot, def, input, stance);
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
        // double-tap forward = dash: an impulse the ground friction bleeds
        // off — gated by the stock pool so it can't be spammed
        if (doubleTapped(f, 'f') && f.dashStocks > 0) {
          f.dashStocks--;
          f.vx = f.facing * DASH_SPEED;
        }
        f.action = { kind: 'walkF', frame: 0 };
        f.x += f.facing * def.walkSpeed;
      } else if (holdingBack(f, input)) {
        if (doubleTapped(f, 'b') && f.dashStocks > 0) {
          f.dashStocks--;
          f.vx = -f.facing * BACKDASH_SPEED;
        }
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
  /** freeze ticks this contact buys (L short, H long, specials most) */
  hitstop: number;
  /** melee freezes both fighters; projectiles freeze the victim only */
  freezeAttacker: boolean;
  /** defender was clipped during their own attack's startup or recovery:
   *  bonus hitstun + extra victim-side freeze */
  counter: boolean;
  /** command grabs ignore blocking entirely */
  unblockable?: boolean;
}

/** Counterhit test: the defender is mid-attack and NOT in active frames
 *  (active-vs-active the same tick is a trade, not a counter). */
function isCounterhit(d: FighterState, defs: Defs): boolean {
  const a = d.action;
  if (a.kind !== 'attack' && a.kind !== 'airAttack') return false;
  const m = resolveMove(defs[d.charId].moves[a.moveId!], a.strength);
  return a.frame < m.startup || a.frame >= m.startup + m.active;
}

/** lights are chipless; everything meatier shaves 10% through block */
const CHIPLESS = new Set(['lp', 'lk', 'clp', 'clk', 'jlp', 'jlk']);

/** Combo damage scaling: hits 1-2 land full, each later hit in the same combo
 *  loses COMBO_SCALE_STEP% (cumulative) down to the COMBO_SCALE_FLOOR%.
 *  Integer math keeps it deterministic; a connecting hit always deals ≥1. */
function scaleForCombo(damage: number, comboHits: number): number {
  if (damage <= 0) return damage;
  const pct = Math.max(COMBO_SCALE_FLOOR, 100 - COMBO_SCALE_STEP * Math.max(0, comboHits - 2));
  return Math.max(1, Math.floor((damage * pct) / 100));
}

/** Freeze frames for a connecting move: specials hit hardest, otherwise the
 *  button strength embedded in the move id ('lp'/'cmk'/'jhk') decides. */
function hitstopFor(moveId: string, m: MoveDef): number {
  if (m.input) return HITSTOP_SPECIAL;
  const strength = moveId.match(/([lmh])[pk]$/)?.[1];
  return strength === 'h' ? HITSTOP_HEAVY : strength === 'm' ? HITSTOP_MEDIUM : HITSTOP_LIGHT;
}

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

  // per-fighter freeze: the victim always, the attacker only on melee;
  // trades keep the longest via max(); counterhits sting the victim longer
  d.hitstop = Math.max(d.hitstop, hit.hitstop + (hit.counter ? COUNTER_HITSTOP_BONUS : 0));
  if (hit.freezeAttacker) {
    const atk = s.fighters[atkSlot];
    atk.hitstop = Math.max(atk.hitstop, hit.hitstop);
  }

  if (!hit.unblockable && isBlocking(d, defInput, hit.height)) {
    const guard = d.action.kind === 'crouch' || defInput.down ? 'crouch' : 'stand';
    d.action = { kind: 'blockstun', frame: hit.blockstun, guard };
    d.vx = attackerFacing * hit.knockback * 0.8;
    if (hit.chip > 0) d.health = Math.max(1, d.health - hit.chip); // chip can't KO
  } else {
    // combo bookkeeping: a hit on an already-reeling victim extends the combo,
    // anything else starts a fresh one; later hits scale down (stun scales
    // with them so long chains can't also be free dizzies)
    const inCombo = d.action.kind === 'hitstun' || d.action.kind === 'airHit';
    d.comboHits = inCombo ? d.comboHits + 1 : 1;
    const damage = scaleForCombo(hit.damage, d.comboHits);
    d.health = Math.max(0, d.health - damage);
    // stun feeds on clean hits only; the punish that lands on a dizzied
    // fighter ends the dizzy instead of stacking toward the next one
    if (d.action.kind === 'dazed') d.stun = 0;
    else d.stun += damage;
    const counter = hit.counter || undefined;
    d.floatGravity = 0; // a hit knocks the float out of them
    if (!grounded(d)) {
      d.action = { kind: 'airHit', frame: 0, counter };
      d.vx = attackerFacing * hit.knockback * 0.6;
      d.vy = -5;
    } else if (hit.knockdown) {
      d.action = { kind: 'airHit', frame: 0, counter };
      d.vx = attackerFacing * hit.knockback * 0.6;
      d.vy = -4.5;
    } else {
      const stun = hit.counter ? Math.floor(hit.hitstun * COUNTER_HITSTUN_MULT) : hit.hitstun;
      d.action = { kind: 'hitstun', frame: stun, counter };
      d.vx = attackerFacing * hit.knockback;
    }
  }

  // corner transfer: if the defender is pinned on a wall, push the attacker
  // back instead so spacing still changes
  if (d.x <= STAGE_MIN_X + 1 || d.x >= STAGE_MAX_X - 1) {
    s.fighters[atkSlot].vx = -attackerFacing * hit.knockback * 0.7;
  }
}

function resolveAttacks(
  s: GameState,
  defs: Defs,
  inputs: [InputFrame, InputFrame],
  frozen: [boolean, boolean],
): void {
  // snapshot both attacks first so trades (both connect same tick) work
  for (const slot of [0, 1] as const) {
    const f = s.fighters[slot];
    const a = f.action;
    if (frozen[slot]) continue; // a frozen attacker's hitbox is inert this tick
    if (a.kind !== 'attack' && a.kind !== 'airAttack') continue;
    const m = resolveMove(defs[f.charId].moves[a.moveId!], a.strength);
    // one hit per activation — unless the move rehits (lightning legs):
    // the same activation may connect again every `rehit` ticks
    if (a.hasHit && !(m.rehit && a.frame - (a.lastHitFrame ?? 0) >= m.rehit)) continue;
    if (a.frame < m.startup || a.frame >= m.startup + m.active) continue;

    const defSlot = slot === 0 ? 1 : 0;
    const d = s.fighters[defSlot];
    if (isInvulnerable(d)) continue;

    // command grabs: unblockable, range-based, grounded targets only
    if (m.grab) {
      // universal throws also whiff on victims already reeling — throwing a
      // hitstunned/blockstunned/launched opponent would be a free loop
      if (
        m.techable &&
        (s.pendingThrow ||
          d.action.kind === 'hitstun' ||
          d.action.kind === 'blockstun' ||
          d.action.kind === 'airHit')
      ) {
        continue;
      }
      if (grounded(d) && Math.abs(f.x - d.x) <= m.grab.range) {
        a.hasHit = true;
        if (m.techable) {
          // hold the victim through the tech window; damage waits for expiry
          if (d.action.kind === 'dazed') d.stun = 0; // the throw is the dizzy punish
          s.pendingThrow = {
            attacker: slot,
            moveId: a.moveId!,
            strength: a.strength,
            ticksLeft: THROW_TECH_TICKS,
          };
          d.action = { kind: 'hitstun', frame: THROW_TECH_TICKS + 2 };
          d.vx = 0;
          // the grab thunk freezes both for a beat (melee-style)
          f.hitstop = Math.max(f.hitstop, HITSTOP_LIGHT);
          d.hitstop = Math.max(d.hitstop, HITSTOP_LIGHT);
          continue;
        }
        applyHit(s, defSlot, f.facing, {
          damage: m.damage,
          hitstun: m.hitstun,
          blockstun: m.blockstun,
          knockback: m.knockback,
          height: m.height,
          knockdown: true,
          chip: 0,
          hitstop: hitstopFor(a.moveId!, m),
          freezeAttacker: true,
          counter: false, // grabs land clean, never as counters
          unblockable: true,
        }, inputs[defSlot]);
        if (m.grabRecoil) f.vx = -f.facing * m.grabRecoil; // 86'd bounce-away
        // kudzu drain: the grab feeds the attacker (Symbiosis)
        if (m.heal) f.health = Math.min(defs[f.charId].health, f.health + m.heal);
      }
      continue;
    }

    if (!m.hitbox) continue;
    if (overlaps(worldBox(f, m.hitbox), defenderHurtRect(d, defs[d.charId]))) {
      a.hasHit = true;
      a.lastHitFrame = a.frame;
      applyHit(s, defSlot, f.facing, {
        damage: m.damage,
        hitstun: m.hitstun,
        blockstun: m.blockstun,
        knockback: m.knockback,
        height: m.height,
        knockdown: !!m.knockdown,
        chip: CHIPLESS.has(a.moveId!) ? 0 : Math.floor(m.damage * 0.1),
        hitstop: hitstopFor(a.moveId!, m),
        freezeAttacker: true,
        counter: isCounterhit(d, defs),
      }, inputs[defSlot]);
    }
  }
}

/** Armed and waiting (lobbed bomb in flight or fuse ticking) — hits nobody,
 *  but CAN still clash with enemy projectiles (interceptable bombs, and
 *  Hallucination clones that pop real fireballs). */
function isDormant(p: Projectile): boolean {
  return p.fuse > 0;
}

function projRect(p: Projectile): Rect {
  return { l: p.x + p.box.x, t: p.y + p.box.y, r: p.x + p.box.x + p.box.w, b: p.y + p.box.y + p.box.h };
}

function updateProjectiles(s: GameState, defs: Defs, inputs: [InputFrame, InputFrame]): void {
  const slowFields = s.projectiles.filter((q) => q.field && q.slowFactor > 0);
  const slowBy = (p: Projectile): number => {
    const zone = slowFields.find((q) => q.owner !== p.owner && overlaps(projRect(p), projRect(q)));
    return zone ? zone.slowFactor : 1;
  };
  for (const p of s.projectiles) {
    p.x += p.vx * (p.field ? 1 : slowBy(p));
    // lobbed arc: fall, then stick to the floor and start the fuse
    if (p.gravity > 0) {
      p.vy += p.gravity;
      p.y += p.vy;
      if (p.y >= FLOOR_Y) {
        p.y = FLOOR_Y;
        p.vx = 0;
        p.vy = 0;
        p.gravity = 0;
      }
    }
    if (p.fuse > 0 && p.gravity === 0) p.fuse--;
    if (p.hitCooldown > 0) p.hitCooldown--;
    if (p.fuse === 0 && p.detonate) {
      const d = p.detonate;
      p.vx = 0; // walking clones stop where they pop
      p.box = d.box;
      p.damage = d.damage;
      p.hitstun = d.hitstun;
      p.blockstun = d.blockstun;
      p.knockback = d.knockback;
      p.height = d.height ?? 'mid';
      p.ttl = d.ttl;
      p.knockdown = true;
      p.moveId = `${p.moveId}-burst`; // renderer swaps to the blast art
      p.fuse = -1;
      p.detonate = undefined;
    }
    if (p.ttl > 0) p.ttl--;
  }

  // slow fields also drag the opposing fighter's ground impulses (dash/knockback)
  for (const zone of slowFields) {
    const foe = s.fighters[zone.owner === 0 ? 1 : 0];
    if (overlaps(projRect(zone), defenderHurtRect(foe, defs[foe.charId]))) {
      foe.vx *= zone.slowFactor;
    }
  }

  // projectile vs projectile: clash and both die (smoke/slow fields don't
  // participate; dormant bombs and clones DO — they're interceptable)
  const dead = new Set<Projectile>();
  for (const p of s.projectiles) {
    for (const q of s.projectiles) {
      if (p.field || q.field) continue;
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
    if (p.field || isDormant(p)) continue; // smoke / armed bombs never hit
    if (p.hitCooldown > 0) continue; // tick-damage cloud between hits
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
        knockdown: p.knockdown,
        // projectiles are special-born; lingering tick-clouds stay light so
        // rehit damage doesn't stutter the whole match
        hitstop: p.rehit > 0 ? HITSTOP_LIGHT : HITSTOP_SPECIAL,
        freezeAttacker: false, // SF fireballs never freeze the shooter
        counter: isCounterhit(d, defs),
        chip: Math.floor(p.damage * 0.1),
      }, inputs[defSlot]);
      // "get over here": an UNBLOCKED hit reels the victim in — dropped at
      // the owner's feet mid-launch, the knockdown lands them right there
      // (a blocked spear is plain blockstun + pushback, no drag)
      if (p.pull && d.action.kind !== 'blockstun') {
        const owner = s.fighters[p.owner];
        const side = d.x >= owner.x ? 1 : -1;
        d.x = Math.min(STAGE_MAX_X, Math.max(STAGE_MIN_X, owner.x + side * 85));
        d.vx = 0;
      }
      // lingering clouds survive their hits and re-hit on a cooldown
      if (p.rehit > 0) p.hitCooldown = p.rehit;
      else dead.add(p);
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
  if (winner !== null && s.wins[winner] >= s.rules.winsNeeded) {
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
    const f = s.fighters[slot];
    const buf = f.inputBuffer;
    buf.push(packInput(inputs[slot]));
    if (buf.length > INPUT_BUFFER_LEN) buf.shift();
    // bank charge while holding down; bleed it fast on release (short grace
    // window to flick ↓→↑ without losing the charge)
    f.charge = inputs[slot].down ? Math.min(f.charge + 1, 600) : Math.max(0, f.charge - 8);
    // dash stock regen: one at a time, only while short (see DASH_STOCKS)
    if (f.dashStocks < DASH_STOCKS && ++f.dashRegen >= DASH_REGEN_TICKS) {
      f.dashStocks++;
      f.dashRegen = 0;
    }
    // action buffer: a button tapped while unactionable (or frozen in
    // hitstop) resolves its attack pick NOW — motions and chords are read at
    // press time so wakeup reversals keep their input window — and fires on
    // the first actionable frame. Newest press wins; TTL drops stale ones.
    if (f.buffered && --f.buffered.ticksLeft <= 0) f.buffered = null;
    if (
      s.phase === 'fight' &&
      (BUFFERABLE.has(f.action.kind) || f.hitstop > 0) &&
      anyFreshButton(f)
    ) {
      const pick = pickAttack(s, slot, defs[f.charId], inputs[slot], inputs[slot].down ? 'crouch' : 'stand');
      if (pick) f.buffered = { id: pick.id, strength: pick.strength, ticksLeft: ACTION_BUFFER_TICKS };
    }
  }

  // outside the fight phase, any leftover freeze stops the whole world — the
  // KO hit's dramatic pause carries into roundEnd/finisher exactly as before.
  // (Inputs keep buffering above so motions finished mid-freeze still count.)
  if (s.phase !== 'fight' && (s.fighters[0].hitstop > 0 || s.fighters[1].hitstop > 0)) {
    for (const f of s.fighters) if (f.hitstop > 0) f.hitstop--;
    return s;
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
      if (s.roundWinner !== null && s.wins[s.roundWinner] >= s.rules.winsNeeded) {
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

  // per-fighter hitstop: a frozen fighter skips their update entirely this
  // tick (no action frames, no physics, no stun decay); the other side keeps
  // moving — that's the SF fireball asymmetry. Projectiles keep flying.
  const frozen: [boolean, boolean] = [f1.hitstop > 0, f2.hitstop > 0];
  for (const f of s.fighters) if (f.hitstop > 0) f.hitstop--;

  // universal throw mid-hold: the victim's own LP+LK inside the window techs
  // it (both bounce back, no damage); expiry lands the unblockable knockdown.
  // The grab thunk's freeze pauses the tech window along with everything else.
  if (s.pendingThrow && !frozen[s.pendingThrow.attacker]) {
    const pt = s.pendingThrow;
    const atk = s.fighters[pt.attacker];
    const vicSlot = pt.attacker === 0 ? 1 : 0;
    const vic = s.fighters[vicSlot];
    if (atk.action.kind !== 'attack' || atk.action.moveId !== pt.moveId) {
      // attacker interrupted mid-throw (stray projectile) — release the victim
      vic.action = { kind: 'idle', frame: 0 };
      s.pendingThrow = null;
    } else if (throwChord(vic)) {
      // teched: both bounce apart, nobody takes damage. The brief recoil
      // (blockstun shape) stops the victim's still-held chord from firing an
      // instant counter-throw on this very tick
      vic.action = { kind: 'blockstun', frame: THROW_TECH_RECOIL, guard: 'stand' };
      atk.action = { kind: 'blockstun', frame: THROW_TECH_RECOIL, guard: 'stand' };
      vic.vx = atk.facing * THROW_TECH_PUSH;
      atk.vx = -atk.facing * THROW_TECH_PUSH;
      s.pendingThrow = null;
    } else if (--pt.ticksLeft <= 0) {
      const m = resolveMove(defs[atk.charId].moves[pt.moveId], pt.strength);
      applyHit(s, vicSlot, atk.facing, {
        damage: m.damage,
        hitstun: m.hitstun,
        blockstun: m.blockstun,
        knockback: m.knockback,
        height: m.height,
        knockdown: true,
        chip: 0,
        hitstop: hitstopFor(pt.moveId, m),
        freezeAttacker: true,
        counter: false,
        unblockable: true,
      }, inputs[vicSlot]);
      if (m.grabRecoil) atk.vx = -atk.facing * m.grabRecoil;
      if (m.heal) atk.health = Math.min(defs[atk.charId].health, atk.health + m.heal);
      s.pendingThrow = null;
    }
  }

  // dizzy meter bleeds off a little every live tick (poking can't stun-lock;
  // a frozen fighter's meter holds — freeze is time standing still for them)
  for (const slot of [0, 1] as const) {
    const f = s.fighters[slot];
    if (!frozen[slot] && f.stun > 0 && f.action.kind !== 'dazed') {
      f.stun = Math.max(0, f.stun - STUN_DECAY);
    }
    // the combo drops the moment its victim stops reeling (hitstop pauses the
    // reel, so a frozen victim keeps the count)
    const k = f.action.kind;
    if (k !== 'hitstun' && k !== 'airHit') f.comboHits = 0;
  }

  if (!frozen[0]) updateFighter(s, 0, defs[f1.charId], inputs[0]);
  if (!frozen[1]) updateFighter(s, 1, defs[f2.charId], inputs[1]);

  // face the opponent whenever actionable
  for (const slot of [0, 1] as const) {
    const f = s.fighters[slot];
    const o = s.fighters[slot === 0 ? 1 : 0];
    if (!frozen[slot] && canAct(f) && grounded(f)) {
      if (o.x > f.x) f.facing = 1;
      else if (o.x < f.x) f.facing = -1;
    }
  }

  // body push: grounded fighters can't overlap (skipped while either side is
  // frozen so the freeze frame actually holds still)
  if (!frozen[0] && !frozen[1] && grounded(f1) && grounded(f2) && !isInvulnerable(f1) && !isInvulnerable(f2)) {
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
  resolveAttacks(s, defs, inputs, frozen);

  for (const slot of [0, 1] as const) {
    const f = s.fighters[slot];
    f.x = Math.min(STAGE_MAX_X, Math.max(STAGE_MIN_X, f.x));
  }

  // the round clock holds its breath with the freeze frames
  if (s.rules.roundTicks > 0 && !frozen[0] && !frozen[1]) s.timer--;

  // KO / time-up (no time-up when the round clock is off)
  const ko1 = f1.health <= 0;
  const ko2 = f2.health <= 0;
  if (ko1 || ko2) {
    endRound(s, ko1 && ko2 ? null : ko1 ? 1 : 0, defs);
  } else if (s.rules.roundTicks > 0 && s.timer <= 0) {
    endRound(s, f1.health > f2.health ? 0 : f2.health > f1.health ? 1 : null, defs);
  }

  return s;
}
