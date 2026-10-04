// Engine-measured frame data. Conventions (SF/SuperCombo style, the same ones
// docs/FIGHTING_STANDARDS.md defines):
//   startup  — the first ACTIVE frame, counting the press frame as frame 1
//   active   — frames the hitbox is live (data; the engine honours it exactly)
//   recovery — frames after the last active frame before you can act again
//   total    — frames from the press until the first frame you can act
//   onHit / onBlock — (defender's first actionable tick) − (attacker's), from
//              a point-blank connect: + means the attacker acts first
//   push     — how many px the gap grew from contact to both recovered
// All values come from running step(): if the JSON says one thing and the
// engine does another, this reports the engine.
import { FLOOR_Y, resolveMove, type Defs, type MoveDef, type Strength } from '../engine';
import { ACTIONABLE, REELING, benchState, dirs, moveFrames, run, touchGap, type Partial6 } from './sim';

export type MoveClass =
  | 'light' | 'medium' | 'heavy'
  | 'air'
  | 'special' | 'reversal' | 'projectile' | 'throw' | 'utility';

export interface MoveMeasure {
  id: string;
  strength?: Strength;
  cls: MoveClass;
  name: string;
  startup: number | null;
  active: number;
  recovery: number | null;
  total: number | null;
  onHit: number | null;
  onBlock: number | null;
  /** hit knocked down (onHit is then n/a) */
  knockdown: boolean;
  damage: number;
  chip: number;
  hitstop: [number, number] | null;
  pushHit: number | null;
  pushBlock: number | null;
  /** attacker center → furthest hitbox edge (px), from data */
  reach: number;
  /** did it connect at any tested range vs a standing mirror? */
  connects: boolean;
  /** contact range window [min, max] gap in px, vs standing mirror */
  range: [number, number] | null;
  height: MoveDef['height'];
  invuln: number;
  notes: string[];
}

export function classify(id: string, m: MoveDef): MoveClass {
  if (m.grab) return 'throw';
  if (m.input) {
    if (m.projectile?.field) return 'utility'; // smoke / slow fields never collide
    if (m.projectile) return 'projectile';
    if ((m.invuln ?? 0) > 0 && (m.invulnFrom ?? 0) <= 1 && m.hitbox) return 'reversal';
    if (!m.hitbox && !m.projectile) return 'utility';
    if (m.damage <= 0 && !m.projectile) return 'utility';
    return 'special';
  }
  if (id.startsWith('j')) return 'air';
  const s = /([lmh])[pk]$/.exec(id)?.[1];
  return s === 'h' ? 'heavy' : s === 'm' ? 'medium' : 'light';
}

const LEAD = 4; // neutral ticks before the script starts (clean input buffer)

interface ConnectRun {
  contact: number | null;
  atkReady: number | null;
  defReady: number | null;
  damage: number;
  hitstop: [number, number] | null;
  push: number | null;
  knockdown: boolean;
  blocked: boolean;
  pressTick: number;
}

/** Perform `id` against a mirror at `gap`; the defender blocks from just
 *  before contact when `block` is set (pass the contact tick from a hit run). */
function connectRun(
  defs: Defs,
  charId: string,
  oppId: string,
  id: string,
  strength: Strength,
  gap: number,
  block: null | { stance: 'stand' | 'crouch'; from: number },
): ConnectRun {
  const def = defs[charId];
  const frames = moveFrames(def, id, strength, 1) ?? [];
  const pressTick = LEAD + frames.length - 1;
  const s = benchState(defs, charId, oppId, gap);
  const { back } = dirs(-1);
  const out: ConnectRun = {
    contact: null, atkReady: null, defReady: null, damage: 0, hitstop: null,
    push: null, knockdown: false, blocked: false, pressTick,
  };
  // the move's own first frame: a mash special's first presses fire a normal,
  // a buffered special starts after it — time everything from THIS move
  let begun = false;
  let wasReeling = false;
  let hpAtBegin = 0;
  let defXAtContact = 0;
  let guarded = false;
  run(
    s,
    defs,
    (t) => (t >= LEAD && t - LEAD < frames.length ? frames[t - LEAD] : {}),
    (t, st): Partial6 => {
      // guard from just before contact until the blockstun ends — then let
      // go, so walking back never inflates the measured pushback
      if (!block || t < block.from - 1) return {};
      const d = st.fighters[1];
      if (d.action.kind === 'blockstun') guarded = true;
      else if (guarded) return {};
      return block.stance === 'crouch' ? { [back]: true, down: true } : { [back]: true };
    },
    LEAD + frames.length + 260,
    (t, st) => {
      const [a, d] = st.fighters;
      const reeling = REELING.has(d.action.kind);
      if (!begun && a.action.kind === 'attack' && a.action.moveId === id) {
        begun = true;
        out.pressTick = t - a.action.frame;
        hpAtBegin = d.health;
      }
      if (!begun) {
        wasReeling = reeling;
        return t > pressTick + 90;
      }
      // contact = THIS move connecting: its own hasHit (melee, hit or block),
      // a fresh reel (projectiles), new damage, or a throw hold — never the
      // tail of a reel an earlier normal caused (mash specials)
      const own = a.action.kind === 'attack' && a.action.moveId === id && a.action.hasHit;
      const fresh = reeling && !wasReeling;
      wasReeling = reeling;
      if (out.contact === null && (own || fresh || d.health < hpAtBegin || st.pendingThrow)) {
        out.contact = t;
        out.blocked = d.action.kind === 'blockstun';
        out.hitstop = [a.hitstop, d.hitstop];
        defXAtContact = d.x;
      }
      if (out.contact === null) {
        // whiffed and recovered with no contact (and no shot still flying): give up
        return t > out.pressTick + 2 && ACTIONABLE.has(a.action.kind) && a.y >= FLOOR_Y && st.projectiles.length === 0;
      }
      if (d.action.kind === 'knockdown' || d.action.kind === 'getup') out.knockdown = true;
      if (out.atkReady === null && t > out.pressTick && ACTIONABLE.has(a.action.kind) && a.hitstop === 0) out.atkReady = t;
      if (out.defReady === null && ACTIONABLE.has(d.action.kind) && d.hitstop === 0) out.defReady = t;
      // pushback = the DEFENDER's slide (SF convention): settle once both
      // can act and the knockback impulse has bled off
      if (out.atkReady !== null && out.defReady !== null && d.vx === 0) {
        out.damage = hpAtBegin - d.health;
        out.push = d.x - defXAtContact;
        return true;
      }
      return false;
    },
  );
  if (out.contact !== null && out.push === null) out.damage = hpAtBegin - s.fighters[1].health;
  return out;
}

/** Whiff run far from the opponent: total frames until actionable. */
function whiffTotal(defs: Defs, charId: string, id: string, strength: Strength): number | null {
  const def = defs[charId];
  const frames = moveFrames(def, id, strength, 1);
  if (!frames) return null;
  const pressTick = LEAD + frames.length - 1;
  const s = benchState(defs, charId, charId, 640, 120);
  let started = false;
  let begin = pressTick;
  let total: number | null = null;
  run(s, defs, (t) => (t >= LEAD && t - LEAD < frames.length ? frames[t - LEAD] : {}), () => ({}), pressTick + 240, (t, st) => {
    const a = st.fighters[0];
    if (!started && a.action.kind === 'attack' && a.action.moveId === id) {
      started = true;
      begin = t - a.action.frame;
    }
    if (!started) return t > pressTick + 90;
    // frames OCCUPIED, press frame = 1 (SF convention): the tick the engine
    // flips back to idle still belongs to the move — a new action starts on
    // the next one
    if (t > begin && ACTIONABLE.has(a.action.kind)) {
      total = t - begin + 1;
      return true;
    }
    return false;
  });
  return started ? total : null;
}

function reachOf(m: MoveDef): number {
  if (m.grab) return m.grab.range;
  if (m.projectile) return Infinity;
  return m.hitbox ? m.hitbox.x + m.hitbox.w : 0;
}

/** Measure one move (at strength `strength` for specials) against a mirror. */
export function measureMove(defs: Defs, charId: string, id: string, strength: Strength = 'm', oppId = charId): MoveMeasure {
  const def = defs[charId];
  const opp = defs[oppId];
  const base = def.moves[id];
  const m = resolveMove(base, base.input ? strength : undefined);
  const cls = classify(id, m);
  const notes: string[] = [];
  // chords (LPLK/PPP/KKK) have no L/M/H — don't tag them with one
  const chord = base.input && ['LPLK', 'PPP', 'KKK'].includes(base.input.button);
  const meas: MoveMeasure = {
    id,
    strength: base.input && !chord ? strength : undefined,
    cls,
    name: m.name ?? id,
    startup: null,
    active: m.active,
    recovery: null,
    total: null,
    onHit: null,
    onBlock: null,
    knockdown: !!m.knockdown,
    damage: m.damage,
    chip: m.chip ?? 0,
    hitstop: null,
    pushHit: null,
    pushBlock: null,
    reach: reachOf(m),
    connects: false,
    range: null,
    height: m.height,
    invuln: m.invuln ?? 0,
    notes,
  };

  if (id.startsWith('j') && !base.input) {
    // air normals: data-level frame data (on-hit depends on jump-in height)
    meas.startup = m.startup + 1;
    meas.recovery = m.recovery;
    meas.total = m.startup + m.active + m.recovery;
    meas.connects = !!m.hitbox;
    return meas;
  }

  const total = whiffTotal(defs, charId, id, strength);
  meas.total = total;

  // scan gaps from bodies-touching outward; the first gap that connects is
  // "point blank", the last is max range
  const g0 = touchGap(def, opp) + 1;
  const maxGap = Number.isFinite(meas.reach) ? Math.min(700, Math.max(g0, meas.reach + 200)) : 520;
  let first: ConnectRun | null = null;
  let firstGap = 0;
  let lastGap = 0;
  for (let gap = g0; gap <= maxGap; gap += gap < g0 + 40 ? 4 : 12) {
    const r = connectRun(defs, charId, oppId, id, strength, gap, null);
    if (r.contact !== null) {
      if (!first) {
        first = r;
        firstGap = gap;
      }
      lastGap = gap;
    } else if (first) {
      break;
    }
  }
  if (total === null) notes.push('bench could not perform the input (move never started)');
  if (!first || first.contact === null) {
    if (cls !== 'utility' && total !== null) notes.push('never connects vs a standing mirror at any range');
    if (total !== null) {
      meas.startup = m.startup + 1;
      meas.recovery = total - m.startup - m.active;
    }
    return meas;
  }
  meas.connects = true;
  meas.range = [firstGap, lastGap];
  meas.startup = first.contact - first.pressTick + 1;
  meas.hitstop = first.hitstop;
  meas.damage = first.damage;
  meas.knockdown = first.knockdown || meas.knockdown;
  if (total !== null) meas.recovery = total - (meas.startup - 1) - m.active;
  if (cls === 'throw') return meas;

  if (!first.knockdown && first.atkReady !== null && first.defReady !== null) {
    meas.onHit = first.defReady - first.atkReady;
    meas.pushHit = first.push;
  }
  const stance = m.height === 'low' ? 'crouch' : 'stand';
  const blk = connectRun(defs, charId, oppId, id, strength, firstGap, { stance, from: first.contact });
  if (blk.contact !== null && blk.blocked && blk.atkReady !== null && blk.defReady !== null) {
    meas.onBlock = blk.defReady - blk.atkReady;
    meas.pushBlock = blk.push;
    meas.chip = blk.damage;
  } else if (blk.contact !== null && !blk.blocked) {
    notes.push(`not blockable ${stance === 'crouch' ? 'crouching' : 'standing'} at point blank`);
  }
  return meas;
}

export interface PhysicsMeasure {
  /** px per tick */
  walkFwd: number;
  walkBack: number;
  /** ticks from pressing up to leaving the ground */
  prejump: number;
  /** ticks airborne on a forward jump */
  airtime: number;
  /** px above the floor at the apex */
  apex: number;
  /** px travelled by a forward jump */
  jumpDist: number;
  /** ticks of unactionable landing */
  landing: number;
  /** px covered by a forward / back dash (double tap) */
  dashFwd: number;
  dashBack: number;
}

export function measurePhysics(defs: Defs, charId: string): PhysicsMeasure {
  const { fwd, back } = dirs(1);
  const walk = (dir: 'left' | 'right'): number => {
    const s = benchState(defs, charId, charId, 2000, 0, true);
    const x0 = s.fighters[0].x;
    run(s, defs, () => ({ [dir]: true }), () => ({}), 60);
    return Math.abs(s.fighters[0].x - x0) / 60;
  };
  // forward jump
  const s = benchState(defs, charId, charId, 2000, 0, true);
  const x0 = s.fighters[0].x;
  const floor = s.fighters[0].y;
  let pressed = -1;
  let lift = -1;
  let land = -1;
  let ready = -1;
  let minY = floor;
  // hold up-forward until airborne: the direction locks at takeoff (SF2)
  run(s, defs, () => (lift < 0 ? { up: true, [fwd]: true } : {}), () => ({}), 200, (t, st) => {
    const a = st.fighters[0];
    if (pressed < 0 && a.action.kind === 'prejump') pressed = t;
    if (lift < 0 && a.y < floor) lift = t;
    minY = Math.min(minY, a.y);
    if (lift >= 0 && land < 0 && a.y >= floor) land = t;
    if (land >= 0 && ACTIONABLE.has(a.action.kind)) {
      ready = t;
      return true;
    }
    return false;
  });
  const jumpDist = Math.abs(s.fighters[0].x - x0);
  const dash = (dir: 'left' | 'right'): number => {
    const d = benchState(defs, charId, charId, 2000, 0, true);
    const dx0 = d.fighters[0].x;
    // two taps with a 2-frame release between (doubleTapped needs a gap)
    run(d, defs, (t) => (t === 0 || t === 3 ? { [dir]: true } : {}), () => ({}), 60);
    return Math.abs(d.fighters[0].x - dx0);
  };
  return {
    walkFwd: walk(fwd),
    walkBack: walk(back),
    prejump: lift - Math.max(0, pressed) ,
    airtime: land - lift,
    apex: floor - minY,
    jumpDist,
    landing: ready - land,
    dashFwd: dash(fwd),
    dashBack: dash(back),
  };
}

export interface CharacterMeasure {
  id: string;
  name: string;
  health: number;
  /** standing hurtbox height — the CH unit */
  height: number;
  physics: PhysicsMeasure;
  moves: MoveMeasure[];
}

/** Every move (specials at each declared strength) + physics. */
export function measureCharacter(defs: Defs, charId: string): CharacterMeasure {
  const def = defs[charId];
  const moves: MoveMeasure[] = [];
  for (const [id, m] of Object.entries(def.moves)) {
    if (m.input) {
      const strengths: Strength[] = m.input.button === 'LPLK' || m.input.button === 'PPP' || m.input.button === 'KKK'
        ? [m.input.button === 'LPLK' ? 'l' : 'm']
        : ['l', 'm', 'h'];
      const seen = new Set<string>();
      for (const s of strengths) {
        const key = JSON.stringify(resolveMove(m, s));
        if (seen.has(key)) continue;
        seen.add(key);
        moves.push(measureMove(defs, charId, id, s));
      }
    } else {
      moves.push(measureMove(defs, charId, id));
    }
  }
  return { id: charId, name: def.name, health: def.health, height: def.hurtStand.h, physics: measurePhysics(defs, charId), moves };
}
