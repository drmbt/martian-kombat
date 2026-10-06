// MUGEN / IKEMEN GO character → Martian Kombat CharacterDef porter.
//
// Two outputs, deliberately separate:
//  1. `ref`  — a REFERENCE TABLE of what the character does in its home
//              engine, computed with MUGEN/IKEMEN semantics (frame data in SF
//              convention, hitstop, hitstun, pushback, physics). Units are the
//              source's own localcoord pixels; the CH ("character height")
//              unit makes it engine-independent.
//  2. `def`  — a best-effort CharacterDef for OUR engine, geometry scaled so
//              the port stands as tall as `targetHeight`. Timings are a
//              first-pass mapping; `src/bench/parity.ts` measures the port in
//              our real engine and `fitPort` closes the remaining gap.
//
// Plus `report`: every mapping decision that LOST information (per-element
// Clsn2 collapsed to 2 hurtboxes, meter-gated moves dropped, ff motions…).
// That report IS the engine-parity backlog — see docs/FIGHTING_STANDARDS.md.
//
// Semantics sources (verified against the IKEMEN GO source, MIT):
//  - HitDef defaults: guard.pausetime = pausetime; guard.hittime defaults to
//    ground.SLIDETIME for MUGEN-era chars (no ikemenversion) — MUGEN's
//    documented-vs-actual quirk — and to ground.hittime for IKEMEN chars;
//    guard.slidetime = guard.hittime; guard.velocity = ground.velocity.
//  - Hit slide: velocity set once (HitVelSet) then decays by stand.friction
//    (physics S) with a stop threshold, zeroed at slidetime.
//  - Frame advantage (±1f): onHit = (s + p2 + hittime) − (L + p1), where s =
//    first active tick, L = animation length, p1/p2 = pausetime.
import type { Box, CharacterDef, MoveDef, MoveHeight, SpecialInput } from '../../engine';
import { JUMP_VEL_MULT } from '../../engine/constants';
import { actionLength, elemStart, parseAir, unionClsn, type AirAction, type Clsn } from './air';
import { motionOf, parseCmd, parseCns, parseCommandString, type Cmd, type Statedef, type StateController } from './cns';
import { parseCharDef, parseSff } from './files';
import { nums, num } from './ini';

export interface MugenSources {
  def: string;
  /** every CNS/ST file the DEF lists (constants + states), in order */
  cns: string[];
  cmd: string;
  air: string;
  sff?: Uint8Array;
}

export interface PortOptions {
  /** our id for the port (default: lowercased def name, dashes) */
  id?: string;
  /** standing hurtbox height in OUR px the port is scaled to (roster median ≈ 284) */
  targetHeight?: number;
  license?: string;
}

export interface RefMove {
  /** our move id (lp, cmk, jhp, kung-fu-palm, throw…) */
  id: string;
  /** strength for specials ported as variants */
  strength?: 'l' | 'm' | 'h';
  state: number;
  anim: number;
  name: string;
  kind: 'normal' | 'air' | 'special' | 'throw';
  /** SF convention: the first active frame, counting the press frame as 1 */
  startup: number;
  active: number;
  /** frames after the last active frame until the fighter can act */
  recovery: number;
  total: number;
  damage: number;
  chip: number;
  /** pausetime [attacker, victim] */
  hitstop: [number, number];
  guardHitstop: [number, number];
  hitstun: number;
  blockstun: number;
  onHit: number | null;
  onBlock: number | null;
  /** slide distance in source px */
  pushHit: number;
  pushBlock: number;
  height: MoveHeight | 'unblockable';
  knockdown: boolean;
  juggle: number;
  /** furthest forward Clsn1 edge, source px */
  reach: number;
  hits: number;
  invuln?: { from: number; ticks: number };
  /** grab distance (center-to-center, source px) for throws */
  throwRange?: number;
  notes: string[];
}

export interface RefPhysics {
  /** source px/tick */
  walkFwd: number;
  walkBack: number;
  jumpVy: number;
  jumpVxFwd: number;
  jumpVxBack: number;
  gravity: number;
  prejump: number;
  landing: number;
  /** derived (source px / ticks) */
  airtime: number;
  apex: number;
  jumpDistFwd: number;
  standFriction: number;
  dash: { kind: 'run' | 'impulse'; vx: number; backVx: number; backVy: number; backDist: number };
}

export interface RefTable {
  id: string;
  name: string;
  author: string;
  license: string;
  engine: 'mugen' | 'ikemen';
  localcoord: [number, number];
  /** standing Clsn2 height in source px — the CH unit */
  standHeight: number;
  health: number;
  airJuggle: number;
  commandTime: number;
  bufferTime: number;
  size: { groundBack: number; groundFront: number; height: number };
  physics: RefPhysics;
  moves: RefMove[];
  sprites?: { count: number; palettes: number; version: string };
  standardAnims: { present: number[]; missing: number[] };
}

export interface PortReport {
  mapped: string[];
  lossy: string[];
  unsupported: string[];
}

export interface PortResult {
  def: CharacterDef;
  ref: RefTable;
  report: PortReport;
  /** our px per source px */
  scale: number;
}

/** The standard animation numbers every MUGEN/IKEMEN character ships (from
 *  IKEMEN's data/common.const). `[n, required]`. */
export const STANDARD_ANIMS: [number, boolean][] = [
  [0, true], [5, true], [6, true], [10, true], [11, true], [12, true], [20, true], [21, true],
  [40, true], [41, true], [42, true], [43, true], [44, false], [45, false], [46, false], [47, true],
  [100, true], [105, true], [120, true], [121, true], [122, true], [130, true], [131, true], [132, true],
  [140, true], [141, true], [142, true], [150, true], [151, true], [152, true],
  [170, false], [175, false], [180, false], [190, false], [195, false],
  [5000, true], [5001, true], [5002, true], [5005, true], [5006, true], [5007, true],
  [5010, true], [5011, true], [5012, true], [5015, true], [5016, true], [5017, true],
  [5020, true], [5021, true], [5022, true], [5025, true], [5026, true], [5027, true],
  [5030, true], [5035, false], [5040, true], [5050, true], [5060, false], [5070, true], [5080, true],
  [5090, true], [5100, true], [5101, false], [5110, true], [5120, true], [5140, false], [5150, false],
  [5160, true], [5170, true], [5200, true], [5210, true], [5300, false],
];

const kebab = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** MUGEN hit slide: velocity v (px/tick) for `ticks`, stand friction with a
 *  stop threshold (physics S in common1.cns 5001/150-series). */
export function slideDistance(v: number, ticks: number, friction: number, threshold: number): number {
  let d = 0;
  let vel = Math.abs(v);
  for (let t = 0; t < ticks && vel > 0; t++) {
    d += vel;
    vel *= friction;
    if (vel < threshold) vel = 0;
  }
  return d;
}

/** Trigger expressions of a controller (triggerall + every group, flattened). */
function allTriggers(c: StateController): string[] {
  return [...c.triggerAll, ...Object.values(c.triggers).flat()];
}

/** Earliest tick a controller fires, from `Time = t` / `AnimElem = k` /
 *  `AnimElemTime(k) >= 0` triggers (null when not statically knowable). */
function fireTime(c: StateController, act: AirAction | undefined): number | null {
  let best: number | null = null;
  for (const t of allTriggers(c)) {
    let v: number | null = null;
    const tm = /\btime\s*=\s*(\d+)/i.exec(t);
    const ae = /\banimelem\s*=\s*(\d+)/i.exec(t);
    const aet = /animelemtime\s*\(\s*(\d+)\s*\)\s*>=?\s*0/i.exec(t);
    if (tm && !/animtime|statetime|elemtime/i.test(t.slice(0, tm.index + 4))) v = Number(tm[1]);
    else if (ae && act) v = elemStart(act, Number(ae[1]) - 1);
    else if (aet && act) v = elemStart(act, Number(aet[1]) - 1);
    if (v !== null) best = best === null ? v : Math.min(best, v);
  }
  return best;
}

function commandsIn(exprs: string[]): { pos: string[]; neg: string[] } {
  const pos: string[] = [];
  const neg: string[] = [];
  for (const e of exprs) {
    for (const m of e.matchAll(/command\s*(!?=)\s*"([^"]+)"/gi)) (m[1] === '=' ? pos : neg).push(m[2]);
  }
  return { pos, neg };
}

/** state numbers referenced by `stateno = N`, `stateno = [a,b]`, minus `stateno != N` */
function stateRefs(exprs: string[]): { include: [number, number][]; exclude: number[] } {
  const include: [number, number][] = [];
  const exclude: number[] = [];
  for (const e of exprs) {
    for (const m of e.matchAll(/stateno\s*(!?=)\s*(\[\s*(\d+)\s*,\s*(\d+)\s*\]|\d+)/gi)) {
      const lo = m[3] !== undefined ? Number(m[3]) : Number(m[2]);
      const hi = m[4] !== undefined ? Number(m[4]) : Number(m[2]);
      if (m[1] === '=') include.push([lo, hi]);
      else exclude.push(lo);
    }
  }
  return { include, exclude };
}

interface Entry {
  label: string;
  target: number;
  commands: string[];
  negCommands: string[];
  power: number;
  bodyDist: number | null;
  /** state ranges this entry may cancel FROM (chains / special cancels) */
  from: { include: [number, number][]; exclude: number[] };
}

function entriesOf(cmd: Cmd): Entry[] {
  const st = cmd.states.get(-1);
  if (!st) return [];
  // var(k) combo-condition indirection: VarSet controllers that set var(k)=1
  const varRefs = new Map<number, { include: [number, number][]; exclude: number[] }>();
  for (const c of st.controllers) {
    if (c.type !== 'varset') continue;
    const vk = Object.keys(c.params).map((k) => /^var\((\d+)\)$/.exec(k)).find(Boolean);
    if (!vk || c.params[vk[0]].trim() !== '1') continue;
    varRefs.set(Number(vk[1]), stateRefs(Object.values(c.triggers).flat()));
  }
  const out: Entry[] = [];
  for (const c of st.controllers) {
    if (c.type !== 'changestate') continue;
    const target = Number(c.params.value);
    if (Number.isNaN(target)) continue;
    const exprs = allTriggers(c);
    const { pos, neg } = commandsIn(exprs);
    const power = Math.max(0, ...exprs.map((e) => Number(/power\s*>=?\s*(\d+)/i.exec(e)?.[1] ?? 0)));
    const bd = exprs.map((e) => /p2bodydist\s*x\s*<\s*=?\s*(-?\d+)/i.exec(e)?.[1]).find((v) => v !== undefined);
    const from = stateRefs(Object.entries(c.triggers).flatMap(([, v]) => v));
    for (const e of exprs) {
      const vm = /var\((\d+)\)/i.exec(e);
      const ref = vm ? varRefs.get(Number(vm[1])) : undefined;
      if (ref) {
        from.include.push(...ref.include);
        from.exclude.push(...ref.exclude);
      }
    }
    out.push({
      label: c.label,
      target,
      commands: pos,
      negCommands: neg,
      power,
      bodyDist: bd === undefined ? null : Number(bd),
      from,
    });
  }
  return out;
}

const inRanges = (n: number, f: Entry['from']): boolean =>
  !f.exclude.includes(n) && f.include.some(([lo, hi]) => n >= lo && n <= hi);

interface Timing {
  start: number;
  active: number;
  length: number;
  hitbox: Clsn | null;
  reach: number;
}

function timingOf(sd: Statedef, act: AirAction | undefined, hd: StateController | undefined): Timing | null {
  if (!act) return null;
  const length = actionLength(act);
  const arm = hd ? fireTime(hd, act) ?? 0 : 0;
  let first = -1;
  for (let i = 0; i < act.elements.length; i++) {
    const e = act.elements[i];
    const s = elemStart(act, i);
    if (e.clsn1.length && s + Math.max(1, e.time) > arm) {
      first = i;
      break;
    }
  }
  if (first < 0) return { start: arm, active: 0, length, hitbox: null, reach: 0 };
  const start = Math.max(arm, elemStart(act, first));
  let active = 0;
  const boxes: Clsn[] = [];
  for (let i = first; i < act.elements.length && act.elements[i].clsn1.length; i++) {
    const e = act.elements[i];
    active += i === first ? elemStart(act, i) + Math.max(0, e.time) - start : Math.max(0, e.time);
    boxes.push(...e.clsn1);
  }
  const hitbox = unionClsn(boxes);
  void sd;
  return { start, active: Math.max(1, active), length, hitbox, reach: hitbox?.r ?? 0 };
}

const toBox = (c: Clsn, k: number): Box => ({
  x: Math.round(c.l * k),
  y: Math.round(c.t * k),
  w: Math.max(1, Math.round((c.r - c.l) * k)),
  h: Math.max(1, Math.round((c.b - c.t) * k)),
});

function heightOf(guardflag: string | undefined): MoveHeight | 'unblockable' {
  const g = (guardflag ?? '').toUpperCase();
  if (!g) return 'unblockable';
  if (g.includes('M') || (g.includes('H') && g.includes('L'))) return 'mid';
  if (g.includes('L')) return 'low';
  if (g.includes('H')) return 'high';
  return 'unblockable';
}

/** ground normals by button letter. 4-button chars (no z/c) map weak/strong
 *  to L/H; 6-button chars map x y z / a b c to L M H. */
function buttonMap(sixButton: boolean): Record<string, string> {
  return sixButton
    ? { x: 'lp', y: 'mp', z: 'hp', a: 'lk', b: 'mk', c: 'hk' }
    : { x: 'lp', y: 'hp', a: 'lk', b: 'hk' };
}

function strengthOf(letter: string, sixButton: boolean): 'l' | 'm' | 'h' {
  if (letter === 'x' || letter === 'a') return 'l';
  if (letter === 'z' || letter === 'c') return 'h';
  return sixButton ? 'm' : 'h';
}

export function portMugenChar(src: MugenSources, opts: PortOptions = {}): PortResult {
  const report: PortReport = { mapped: [], lossy: [], unsupported: [] };
  const def = parseCharDef(src.def);
  const cnsList = src.cns.map(parseCns);
  const constants: Record<string, Record<string, string>> = {};
  const states = new Map<number, Statedef>();
  for (const c of cnsList) {
    for (const [k, v] of Object.entries(c.constants)) constants[k] ??= v;
    for (const [k, v] of c.statedefs) if (!states.has(k)) states.set(k, v);
  }
  const cmd = parseCmd(src.cmd);
  const air = parseAir(src.air);
  const engine: RefTable['engine'] = def.ikemenVersion ? 'ikemen' : 'mugen';
  const data = constants.data ?? {};
  const size = constants.size ?? {};
  const vel = constants.velocity ?? {};
  const mov = constants.movement ?? {};

  // ---- the CH unit + scale ----
  const idle = air.get(0);
  const idleHurt = unionClsn(idle?.elements[0]?.clsn2 ?? []);
  const standHeight = idleHurt ? -idleHurt.t : Math.abs(nums(size['head.pos'])[1] ?? 90);
  const targetHeight = opts.targetHeight ?? 284;
  const k = targetHeight / standHeight;
  const id = opts.id ?? kebab(def.name || 'mugen-port');

  // ---- physics ----
  const friction = num(mov['stand.friction'], 0.85);
  const threshold = num(mov['stand.friction.threshold'], 2);
  const gravity = num(mov.yaccel, 0.44);
  const jn = nums(vel['jump.neu']);
  const jumpVy = Math.abs(jn[1] ?? -8.4);
  const jumpVxFwd = num(vel['jump.fwd'], 2.5);
  const jumpVxBack = Math.abs(num(vel['jump.back'], -2.55));
  const prejump = air.get(40) ? actionLength(air.get(40)!) : 3;
  const landing = air.get(47) ? actionLength(air.get(47)!) : 3;
  const airtime = (2 * jumpVy) / gravity;
  const runFwd = nums(vel['run.fwd']);
  const runBack = nums(vel['run.back']);
  const backVy = Math.abs(runBack[1] ?? 0);
  const physics: RefPhysics = {
    walkFwd: num(vel['walk.fwd'], 2.4),
    walkBack: Math.abs(num(vel['walk.back'], -2.2)),
    jumpVy,
    jumpVxFwd,
    jumpVxBack,
    gravity,
    prejump,
    landing,
    airtime,
    apex: (jumpVy * jumpVy) / (2 * gravity),
    jumpDistFwd: jumpVxFwd * airtime,
    standFriction: friction,
    dash: {
      kind: (runFwd[1] ?? 0) === 0 ? 'run' : 'impulse',
      vx: runFwd[0] ?? 0,
      backVx: Math.abs(runBack[0] ?? 0),
      backVy,
      backDist: Math.abs(runBack[0] ?? 0) * (backVy > 0 ? (2 * backVy) / gravity : 0),
    },
  };

  const health = num(data.life, 1000);
  const groundBack = num(size['ground.back'], 15);
  const groundFront = num(size['ground.front'], 16);
  const crouchHurt = unionClsn(air.get(11)?.elements[0]?.clsn2 ?? []) ??
    unionClsn(air.get(10)?.elements.at(-1)?.clsn2 ?? []);

  const out: CharacterDef = {
    id,
    name: (def.displayName || def.name || id).toUpperCase(),
    color: '#c8c8c8',
    health,
    walkSpeed: +(physics.walkFwd * k).toFixed(2),
    backSpeed: +(physics.walkBack * k).toFixed(2),
    jumpVel: +((jumpVy * k) / JUMP_VEL_MULT).toFixed(3),
    jumpSpeedX: +(jumpVxFwd * k).toFixed(2),
    gravity: +(gravity * k).toFixed(4),
    prejumpFrames: prejump,
    bodyBox: { x: Math.round(-groundBack * k), y: -targetHeight, w: Math.round((groundBack + groundFront) * k), h: targetHeight },
    hurtStand: idleHurt ? toBox(idleHurt, k) : { x: -60, y: -targetHeight, w: 120, h: targetHeight },
    hurtCrouch: crouchHurt ? toBox(crouchHurt, k) : { x: -60, y: Math.round(-targetHeight * 0.65), w: 120, h: Math.round(targetHeight * 0.65) },
    moves: {},
  };
  report.lossy.push(
    `hurtboxes: per-element Clsn2 (${[...air.values()].filter((a) => a.elements.some((e) => e.clsn2.length)).length} animated actions) collapsed to hurtStand + hurtCrouch`,
    `dash: MUGEN ${physics.dash.kind === 'run' ? 'RUN (hold F,F)' : 'hop'} → our double-tap impulse dash (engine-global speeds)`,
    `jump: back-jump ${jumpVxBack} px/t → our symmetric jumpSpeedX`,
    `landing: anim 47 = ${landing}t → engine-global LANDING_TICKS`,
  );

  // ---- move entries ----
  const entries = entriesOf(cmd);
  const sixButton = cmd.commands.some((c) => /^[zc]$/.test(c.command.trim()));
  const bmap = buttonMap(sixButton);
  if (!sixButton) report.lossy.push('4-button character: x/y/a/b → lp/hp/lk/hk (mp/mk left unmapped)');
  const cmdByName = new Map<string, string[]>();
  for (const c of cmd.commands) cmdByName.set(c.name, [...(cmdByName.get(c.name) ?? []), c.command]);

  const refMoves: RefMove[] = [];
  const stateToMove = new Map<number, string>();
  const seen = new Set<number>();

  for (const en of entries) {
    if (seen.has(en.target)) continue;
    const sd = states.get(en.target);
    const label0 = en.label || `state ${en.target}`;
    if (en.power > 0) {
      seen.add(en.target);
      report.unsupported.push(`${label0} (state ${en.target}): meter-gated (power ≥ ${en.power}) — no super meter yet`);
      continue;
    }
    if (!sd) {
      if (en.commands.length) report.unsupported.push(`${label0}: target state ${en.target} not found in the CNS files`);
      continue;
    }
    const stype = (sd.params.type ?? 'S').toUpperCase();
    const isAttack = (sd.params.movetype ?? '').toUpperCase() === 'A';
    if (!isAttack) continue;
    seen.add(en.target);

    // analyse the commands: first one that resolves to a motion + button(s)
    let motion: string | null = null;
    let letters: string[] = [];
    for (const name of en.commands) {
      for (const raw of cmdByName.get(name) ?? []) {
        const mo = motionOf(parseCommandString(raw));
        if (mo.buttons.length) {
          if (motion === null || (motion === '' && mo.motion)) {
            motion = mo.motion;
            letters = mo.buttons;
          }
        }
      }
    }
    const label = label0;
    if (motion === null || !letters.length) {
      report.unsupported.push(`${label} (state ${en.target}): command not statically resolvable`);
      continue;
    }

    const anim = Number(sd.params.anim);
    const act = air.get(anim);
    const hitdefs = sd.controllers.filter((c) => c.type === 'hitdef');
    const hd = hitdefs[0];
    const t = timingOf(sd, act, hd);
    if (!t || !hd) {
      report.unsupported.push(`${label} (state ${en.target}): no HitDef/animation to read`);
      continue;
    }
    const p = hd.params;
    const isThrow = en.bodyDist !== null || /,\s*[NSH]T/i.test(p.attr ?? '') || p.p2stateno !== undefined;
    const isNormal = motion === '' || motion.startsWith('hold:');
    const [dmg, chipRaw] = nums(p.damage);
    const pause = nums(p.pausetime);
    const p1 = pause[0] ?? 0;
    const p2 = pause[1] ?? p1;
    const gpause = nums(p['guard.pausetime']);
    const gp1 = gpause[0] ?? p1;
    const gp2 = gpause[1] ?? p2;
    const hittime = num(p['ground.hittime'], 0);
    const slidetime = num(p['ground.slidetime'], 0);
    const guardHittime = p['guard.hittime'] !== undefined
      ? num(p['guard.hittime'], 0)
      : engine === 'mugen' ? slidetime : hittime;
    const guardSlide = p['guard.slidetime'] !== undefined ? num(p['guard.slidetime'], 0) : guardHittime;
    const gv = Math.abs(nums(p['ground.velocity'])[0] ?? 0);
    const gdv = p['guard.velocity'] !== undefined ? Math.abs(nums(p['guard.velocity'])[0] ?? 0) : gv;
    const knockdown = num(p.fall, 0) === 1 || /trip/i.test(p['ground.type'] ?? '') || nums(p['ground.velocity'])[1] !== undefined && (nums(p['ground.velocity'])[1] ?? 0) < 0;
    const height = isThrow ? 'unblockable' : heightOf(p.guardflag);

    // invulnerability windows (NotHitBy SCA)
    let invuln: RefMove['invuln'];
    for (const c of sd.controllers) {
      if (c.type !== 'nothitby') continue;
      if (!/S\s*C\s*A|SCA/i.test(c.params.value ?? '')) continue;
      const from = fireTime(c, act) ?? 0;
      invuln = { from, ticks: num(c.params.time, 1) };
    }

    const L = t.length;
    const startSF = t.start + 1;
    const recovery = L - t.start - t.active;
    const onHit = knockdown || isThrow ? null : t.start + p2 + hittime - (L + p1);
    const onBlock = isThrow ? null : t.start + gp2 + guardHittime - (L + gp1);
    const notes: string[] = [];
    if (hitdefs.length > 1) notes.push(`${hitdefs.length} HitDefs — first hit ported (multi-hit / conditional)`);

    // throw damage lives in the follow-up state (TargetLifeAdd)
    let damage = dmg ?? 0;
    let throwRange: number | undefined;
    if (isThrow) {
      const p1s = Number(p.p1stateno);
      const follow = states.get(p1s);
      const tla = follow?.controllers.filter((c) => c.type === 'targetlifeadd') ?? [];
      const sum = tla.reduce((s, c) => s + Math.abs(num(c.params.value, 0)), 0);
      if (sum > 0) damage = sum;
      throwRange = (en.bodyDist ?? 0) + groundFront + groundBack;
    }

    // ---- our move id ----
    let ourId: string;
    let strength: 'l' | 'm' | 'h' | undefined;
    let kind: RefMove['kind'];
    const letter = letters[0];
    if (isThrow) {
      ourId = 'throw';
      kind = 'throw';
    } else if (isNormal && letters.length === 1) {
      const base = bmap[letter];
      if (!base) {
        report.unsupported.push(`${label}: button '${letter}' has no slot`);
        continue;
      }
      ourId = stype === 'C' ? `c${base}` : stype === 'A' ? `j${base}` : base;
      kind = stype === 'A' ? 'air' : 'normal';
    } else if (['qcf', 'qcb', 'dp', 'hcf', 'hcb', 'bf', 'cbf', 'du'].includes(motion)) {
      const name = label.replace(/^(light|weak|strong|medium|heavy|fast|far|near)\s+/i, '').trim();
      ourId = kebab(name) || `special-${en.target}`;
      strength = strengthOf(letter, sixButton);
      kind = 'special';
    } else {
      report.unsupported.push(`${label} (state ${en.target}): motion '${motion}' (${letters.join('+')}) not in our Motion set`);
      continue;
    }

    const ref: RefMove = {
      id: ourId,
      strength,
      state: en.target,
      anim,
      name: label,
      kind,
      startup: startSF,
      active: t.active,
      recovery,
      total: L,
      damage,
      chip: chipRaw ?? 0,
      hitstop: [p1, p2],
      guardHitstop: [gp1, gp2],
      hitstun: hittime,
      blockstun: guardHittime,
      onHit,
      onBlock,
      pushHit: slideDistance(gv, slidetime, friction, threshold),
      pushBlock: slideDistance(gdv, guardSlide, friction, threshold),
      height,
      knockdown,
      juggle: num(sd.params.juggle, 0),
      reach: t.reach,
      hits: hitdefs.length,
      invuln,
      throwRange,
      notes,
    };
    refMoves.push(ref);
    stateToMove.set(en.target, ourId);

    // ---- our MoveDef (first pass; parity.fitPort refines timings) ----
    const move: MoveDef = {
      startup: t.start,
      active: t.active,
      recovery: Math.max(0, L - t.start - t.active - 1),
      damage,
      hitstun: Math.max(1, hittime - 1),
      blockstun: Math.max(1, guardHittime - 1),
      knockback: +(ref.pushHit * k * (1 - 0.85)).toFixed(2),
      hitbox: isThrow || !t.hitbox ? null : toBox(t.hitbox, k),
      height: height === 'unblockable' ? 'mid' : height,
      name: kind === 'special' || kind === 'throw' ? label.replace(/^(light|weak|strong)\s+/i, '') : undefined,
    };
    if (p1 !== 0 || p2 !== 0) move.hitstop = p1 === p2 ? p1 : [p1, p2];
    if ((chipRaw ?? 0) > 0) move.chip = chipRaw;
    // MUGEN pushes a blocker as far as guard.velocity × guard.slidetime says
    // (defaulting to the hit values) — never our 80%-of-knockback default
    if (!isThrow) move.blockKnockback = +(ref.pushBlock * k * (1 - 0.85)).toFixed(2);
    if (knockdown) move.knockdown = true;
    if (invuln) {
      move.invuln = invuln.ticks;
      if (invuln.from > 0) move.invulnFrom = invuln.from;
    }
    if (isThrow) {
      move.input = { button: 'LPLK' };
      move.grab = { range: Math.round((throwRange ?? 34) * k) };
      move.techable = true;
      notes.push('our universal throw is LP+LK and techable; the source throw is direction+button and not techable');
    }
    if (kind === 'special') {
      const cls = 'xyz'.includes(letter) ? 'punch' : 'kick';
      move.input = { motion: motion as SpecialInput['motion'], button: cls };
    }
    if (hitdefs.length > 1) report.lossy.push(`${ourId}${strength ? `(${strength})` : ''}: ${hitdefs.length}-hit move ported as its first hit`);

    if (kind === 'special') {
      // the first strength seen becomes the base (our M press + any strength
      // without a variant); later strengths fold in as variant patches
      const existing = out.moves[ourId];
      if (!existing) {
        out.moves[ourId] = move;
      } else {
        // fold the other strength in as a variant patch over the base
        const patch: Record<string, unknown> = {};
        for (const key of ['startup', 'active', 'recovery', 'damage', 'hitstun', 'blockstun', 'knockback', 'blockKnockback', 'hitstop', 'chip', 'hitbox', 'invuln'] as const) {
          if (JSON.stringify(move[key]) !== JSON.stringify(existing[key])) patch[key] = move[key];
        }
        existing.variants = { ...existing.variants, [strength!]: patch };
      }
    } else {
      out.moves[ourId] = move;
    }
    report.mapped.push(`${label} (state ${en.target}) → ${ourId}${strength ? ` [${strength}]` : ''}`);
  }

  // ---- chains & cancels from the entry table ----
  for (const en of entries) {
    const targetId = stateToMove.get(en.target);
    if (!targetId) continue;
    const targetDef = out.moves[targetId];
    for (const [stateNo, srcId] of stateToMove) {
      if (srcId === targetId && stateNo === en.target) continue;
      if (!inRanges(stateNo, en.from)) continue;
      const srcDef = out.moves[srcId];
      if (!srcDef || srcDef.input) continue; // only normals chain/cancel from
      if (targetDef.input && !targetDef.grab) srcDef.cancel = true;
      else if (!targetDef.input) srcDef.chains = [...new Set([...(srcDef.chains ?? []), targetId])];
    }
  }
  if (Object.values(out.moves).some((m) => m.chains)) {
    report.lossy.push('chains: MUGEN chains by elapsed time (whiff-cancelable); ours chain on CONTACT only');
  }

  // ---- sprites + standard animation coverage ----
  let sprites: RefTable['sprites'];
  if (src.sff) {
    try {
      const s = parseSff(src.sff);
      sprites = { count: s.spriteCount, palettes: s.paletteCount, version: s.version };
    } catch {
      /* unreadable sff: leave undefined */
    }
  }
  const present = STANDARD_ANIMS.filter(([n]) => air.has(n)).map(([n]) => n);
  const missing = STANDARD_ANIMS.filter(([n, req]) => req && !air.has(n)).map(([n]) => n);

  const ref: RefTable = {
    id,
    name: def.displayName || def.name,
    author: def.author,
    license: opts.license ?? 'see source readme',
    engine,
    localcoord: def.localcoord,
    standHeight,
    health,
    airJuggle: num(data.airjuggle, 15),
    commandTime: cmd.defaults.time,
    bufferTime: cmd.defaults.bufferTime,
    size: { groundBack, groundFront, height: num(size.height, 60) },
    physics,
    moves: refMoves,
    sprites,
    standardAnims: { present, missing },
  };
  return { def: out, ref, report, scale: k };
}
