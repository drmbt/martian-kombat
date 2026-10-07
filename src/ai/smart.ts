// SmartBot — a competent CPU (P13.2, also P5's "hard" difficulty). Plays from
// a bench-derived Playbook (playbook.ts): spaces at its poke range, blocks
// what it sees coming (after a reaction delay), punishes unsafe and whiffed
// moves, anti-airs jump-ins, throws blockers, and finishes confirmed hits
// with a verified combo route.
//
// Lives OUTSIDE src/engine/: the engine only ever sees the InputFrames this
// produces. Deterministic: decisions hash (seed, tick, slot) — never
// Math.random — so a lab matchup replays exactly.
import {
  EMPTY_INPUT,
  FLOOR_Y,
  resolveMove,
  type Defs,
  type FighterState,
  type GameState,
  type InputFrame,
} from '../engine';
import { moveFrames, type Partial6 } from '../bench/sim';
import type { RouteStep } from '../bench/combos';
import { playbookFor, type PlayMove, type Playbook } from './playbook';

export interface SmartOptions {
  /** ticks between the opponent doing something and the bot seeing it (~10 = human) */
  reaction?: number;
  /** chance (0..1) to miss a defensive read it could have made */
  mistake?: number;
  /** scales how often it presses buttons in neutral */
  aggression?: number;
  seed?: number;
}

interface Seen {
  kind: FighterState['action']['kind'];
  frame: number;
  moveId?: string;
  strength?: FighterState['action']['strength'];
  x: number;
  y: number;
  vx: number;
}

const ATTACKING = new Set(['attack', 'airAttack']);

export class SmartBot {
  private queue: Partial6[] = [];
  private history: Seen[] = [];
  private pb: Playbook | null = null;
  /** combo in progress: the route and the index of the step now executing */
  private combo: { steps: RouteStep[]; i: number; armedAt: number } | null = null;
  private pendingLink: RouteStep | null = null;
  private readonly reaction: number;
  private readonly mistake: number;
  private readonly aggression: number;
  private readonly seed: number;

  constructor(
    private readonly slot: 0 | 1,
    private readonly defs: Defs,
    opts: SmartOptions = {},
  ) {
    this.reaction = opts.reaction ?? 10;
    this.mistake = opts.mistake ?? 0.1;
    this.aggression = opts.aggression ?? 1;
    this.seed = opts.seed ?? 1;
  }

  /** deterministic 0..1 from (seed, tick, slot, salt) */
  private rand(s: GameState, salt: number): number {
    let x = (this.seed * 0x9e3779b1) ^ (s.tick * 0x85ebca6b) ^ ((this.slot + 1) * 0xc2b2ae35) ^ (salt * 0x27d4eb2f);
    x ^= x >>> 15;
    x = Math.imul(x, 0x2c1b3c6d);
    x ^= x >>> 12;
    x = Math.imul(x, 0x297a2d39);
    x ^= x >>> 15;
    return (x >>> 0) / 4294967296;
  }

  poll(s: GameState): InputFrame {
    const me = s.fighters[this.slot];
    const op = s.fighters[this.slot === 0 ? 1 : 0];
    this.pb ??= playbookFor(this.defs, me.charId);
    this.history.push({ kind: op.action.kind, frame: op.action.frame, moveId: op.action.moveId, strength: op.action.strength, x: op.x, y: op.y, vx: op.vx });
    if (this.history.length > 60) this.history.shift();
    if (s.phase !== 'fight') {
      this.queue = [];
      this.combo = null;
      return { ...EMPTY_INPUT };
    }
    if (this.queue.length) {
      // a move that hasn't started yet is dropped when a real threat shows up
      if (['idle', 'walkF', 'walkB', 'crouch'].includes(me.action.kind) && this.threatened(s, me, op)) this.queue = [];
      else return { ...EMPTY_INPUT, ...this.queue.shift()! };
    }
    return { ...EMPTY_INPUT, ...this.decide(s, me, op) };
  }

  /** is a live opponent attack (as seen after the reaction delay) in reach? */
  private threatened(s: GameState, me: FighterState, op: FighterState): boolean {
    const v = this.seen();
    if (!ATTACKING.has(v.kind) || !v.moveId) return false;
    const om = resolveMove(this.defs[op.charId].moves[v.moveId], v.strength);
    if (om.grab || v.frame >= om.startup + om.active) return false;
    return Math.abs(op.x - me.x) <= this.threatReach(op.charId, v.moveId, v.strength, om) + 30;
  }

  private keys(me: FighterState): { fwd: 'left' | 'right'; back: 'left' | 'right' } {
    return me.facing === 1 ? { fwd: 'right', back: 'left' } : { fwd: 'left', back: 'right' };
  }

  /** what the bot believes the opponent is doing (reaction-delayed) */
  private seen(): Seen {
    const i = Math.max(0, this.history.length - 1 - this.reaction);
    return this.history[i];
  }

  private perform(me: FighterState, m: { id: string; strength: RouteStep['strength'] }): Partial6 {
    const def = this.defs[me.charId];
    const inp = def.moves[m.id]?.input;
    let frames = moveFrames(def, m.id, m.strength, me.facing);
    // mash specials: exactly `mash` presses (the bench's version mashes ~48
    // frames, which would leave the bot unable to guard for 0.8 s)
    if (inp?.mash && frames) frames = frames.slice(0, inp.mash * 2 - 1);
    if (!frames || !frames.length) return {};
    this.queue.push(...frames.slice(1));
    return frames[0];
  }

  private decide(s: GameState, me: FighterState, op: FighterState): Partial6 {
    const pb = this.pb!;
    const { fwd, back } = this.keys(me);
    const dist = Math.abs(op.x - me.x);
    const a = me.action;
    const view = this.seen();
    const opDef = this.defs[op.charId];

    // ---- 1. finish confirmed hits with a combo route
    if (a.kind === 'attack' && a.hasHit && a.moveId) {
      if (!this.combo || this.combo.steps[this.combo.i]?.id !== a.moveId) {
        const route = pb.combos.find((r) => r[0].id === a.moveId && r.length > 1);
        this.combo = route ? { steps: route, i: 0, armedAt: -1 } : null;
      }
      const c = this.combo;
      if (c && c.armedAt !== s.tick && c.i + 1 < c.steps.length && op.action.kind !== 'blockstun') {
        const next = c.steps[c.i + 1];
        c.i++;
        c.armedAt = s.tick;
        if (next.via === 'link') {
          this.pendingLink = next;
          return {};
        }
        return this.perform(me, next);
      }
      return {};
    }
    if (a.kind !== 'attack') this.combo = null;

    // ---- 2. reeling: hold the block; buffer a punish as blockstun ends
    if (a.kind === 'blockstun') {
      // you know what you just blocked: read the REAL attacker, not the delayed view
      const om = op.action.kind === 'attack' && op.action.moveId ? resolveMove(opDef.moves[op.action.moveId], op.action.strength) : null;
      // punish only once their active frames are over (multi-hit / mash
      // moves keep hitting a guard that drops early)
      if (om && a.frame <= 3 && op.action.frame >= om.startup + om.active) {
        const remaining = om.startup + om.active + om.recovery - op.action.frame;
        const pun = this.bestPunish(dist, remaining - a.frame - 1);
        if (pun && this.rand(s, 9) > this.mistake) return this.perform(me, pun);
      }
      return { [back]: true, down: om ? om.height !== 'high' : a.guard === 'crouch' };
    }
    if (a.kind === 'air' && op.action.kind !== 'airHit') {
      // jump-in: press the best air normal once on the way down, in range
      if (me.vy > 0 && dist < 150 && pb.airs.length && this.rand(s, 1) < 0.35) {
        const id = pb.airs[0];
        return { [id.slice(1)]: true };
      }
      return {};
    }
    // knocked down / getting up / landing / reeling: hold guard so the first
    // actionable frame is already blocking (meaty wakeup attacks)
    if (!['idle', 'walkF', 'walkB', 'crouch'].includes(a.kind)) {
      return a.kind === 'attack' ? {} : { [back]: true, down: true };
    }

    // a combo link waits for the first actionable frame
    if (this.pendingLink) {
      const l = this.pendingLink;
      this.pendingLink = null;
      if (op.action.kind === 'hitstun') return this.perform(me, l);
    }

    // ---- 3. defense: block what is coming (after the reaction delay)
    const opAttacking = ATTACKING.has(view.kind) && view.moveId;
    if (opAttacking) {
      const om = resolveMove(opDef.moves[view.moveId!], view.strength);
      const reach = this.threatReach(op.charId, view.moveId!, view.strength, om);
      const live = view.frame < om.startup + om.active;
      if (live && !om.grab && dist <= reach + 30 && this.rand(s, 2) > this.mistake) {
        return { [back]: true, down: om.height !== 'high' };
      }
      // ---- 4. punish: their move is in recovery and something of ours is faster
      if (!live) {
        const remaining = om.startup + om.active + om.recovery - view.frame;
        const pun = this.bestPunish(dist, remaining - this.reaction);
        if (pun && this.rand(s, 3) > this.mistake) return this.perform(me, pun);
      }
    }
    if (view.kind === 'landing') {
      const pun = this.bestPunish(dist, view.frame - 2);
      if (pun && this.rand(s, 4) > this.mistake) return this.perform(me, pun);
    }
    // incoming projectile: block it
    const shot = s.projectiles.find((p) => p.owner !== this.slot && !p.field && Math.abs(p.x - me.x) < 260 && Math.sign(me.x - p.x) === Math.sign(p.vx || 1));
    if (shot && this.rand(s, 5) > this.mistake) return { [back]: true, down: shot.height !== 'high' };

    // ---- 5. anti-air: they are airborne and coming in
    const airborne = view.y < FLOOR_Y - 30 && (view.kind === 'air' || view.kind === 'airAttack');
    if (airborne && dist < 220) {
      const aa = pb.antiAirs[0];
      if (aa && this.rand(s, 6) > this.mistake) return this.perform(me, aa);
      return { [back]: true }; // no anti-air: stand-block the jump-in
    }

    // ---- 6. neutral
    const r = this.rand(s, 7);
    const theirs = playbookFor(this.defs, op.charId);
    const inTheirRange = dist <= theirs.pokeReach + 12;
    const opBusy = op.action.kind === 'attack' || op.action.kind === 'airAttack';
    // never idle inside a command-grab range: guarding loses to grabs —
    // step out of it, or stuff the grab with the fastest button
    const grabReach = Math.max(0, ...theirs.throws.map((m) => m.range[1]));
    if (grabReach && dist <= grabReach + 10 && !opBusy) {
      const jab = pb.punishers[0];
      if (jab && r < 0.2 * this.aggression) return this.perform(me, jab);
      if (r < 0.6) return { [back]: true };
    }
    const thr = pb.throws[0];
    if (thr && dist <= thr.range[1] && (op.action.kind === 'idle' || op.action.kind === 'crouch' || op.action.kind === 'blockstun') && r < 0.06 * this.aggression) {
      return this.perform(me, thr);
    }
    // offense: every ground strike that reaches from here — normals AND
    // specials — scored by damage × safety-on-block × speed; pick among the
    // best few. (A live threat was already blocked above, so a "busy"
    // opponent here is whiffing or recovering: pressing is right.)
    const inRange = pb.punishers.filter((m) => dist >= m.range[0] - 8 && dist <= m.range[1]);
    // patient: ~1 press per 25–50 ticks — pressing as often as a masher just trades
    const pressChance = inTheirRange && !opBusy ? 0.02 : 0.04;
    if (inRange.length && r < pressChance * this.aggression) {
      const score = (m: PlayMove): number => {
        const safety = m.onBlock === null ? 0.8 : m.onBlock >= -3 ? 1 : m.onBlock >= -8 ? 0.6 : 0.3;
        return m.damage * safety * (6 / (m.startup + 3));
      };
      const ranked = [...inRange].sort((x, y) => score(y) - score(x));
      const pick = ranked[Math.floor(this.rand(s, 8) * Math.min(3, ranked.length))];
      return this.perform(me, pick);
    }
    const proj = pb.projectiles[0];
    if (proj && dist > pb.pokeReach + 60 && !s.projectiles.some((p) => p.owner === this.slot) && r < 0.04 * this.aggression) {
      return this.perform(me, proj);
    }
    if (dist > pb.pokeReach + 120 && pb.airs.length && r > 0.985) {
      return { up: true, [fwd]: true }; // occasional jump-in from mid range
    }
    // default guard: stand if they have an overhead faster than we can react
    // to, else crouch (lows + mids)
    const stand = theirs.fastestHigh <= this.reaction + 6;
    if (inTheirRange) return { [back]: true, down: !stand }; // guard
    // approach only while they're not swinging (seen after the reaction delay)
    if (dist > pb.pokeReach - 10) return ATTACKING.has(view.kind) ? { [back]: true, down: true } : { [fwd]: true };
    // in our range, outside theirs: hold the spacing (guard ready)
    return { [back]: true, down: !stand };
  }

  /** how far (center distance) the opponent's move `id` reaches — MEASURED
   *  (travelling specials included), falling back to the hitbox */
  private threatReach(opId: string, id: string, strength: RouteStep['strength'] | undefined, om: ReturnType<typeof resolveMove>): number {
    const pb = playbookFor(this.defs, opId);
    const all = [...pb.punishers, ...pb.projectiles, ...pb.throws];
    const m = all.find((x) => x.id === id && (strength === undefined || x.strength === strength)) ?? all.find((x) => x.id === id);
    if (m) return m.range[1];
    if (om.grab) return (om.grab.range ?? 0) + 20;
    return om.hitbox ? Math.abs(om.hitbox.x + (om.hitbox.x >= 0 ? om.hitbox.w : 0)) + 60 : 0;
  }

  /** biggest punisher that is fast enough (startup < window) and reaches */
  private bestPunish(dist: number, window: number): PlayMove | null {
    if (window <= 0) return null;
    let best: PlayMove | null = null;
    for (const m of this.pb!.punishers) {
      if (m.startup >= window || dist > m.range[1] || dist < m.range[0] - 8) continue;
      if (!best || m.damage > best.damage) best = m;
    }
    return best;
  }
}
