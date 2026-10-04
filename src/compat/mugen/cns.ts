// CNS (constants + states) and CMD (commands + state -1 entry) parsers.
//
// A MUGEN character is a STATE MACHINE written as data: `[Statedef N]` opens a
// state (header params: type S/C/A/L, movetype A/I/H, physics, anim, juggle,
// poweradd, ctrl, velset), followed by `[State N, label]` controllers — each
// a `type` (HitDef, ChangeState, VelSet, PosAdd, NotHitBy, …) gated by
// `triggerall` + numbered `triggerN` expressions. We do not EXECUTE these
// (that would be a MUGEN VM); the porter (port.ts) pattern-matches the common
// shapes — HitDef params, AnimElem/Time triggers, NotHitBy windows, VelSet /
// PosAdd motion — which is enough to recover frame data from any
// conventionally-written character and to REPORT what it could not map.
import { findSection, get, getAll, parseIni, toRecord, unquote, type IniSection } from './ini';

export interface StateController {
  label: string;
  /** lowercased controller type: 'hitdef', 'changestate', 'velset', … */
  type: string;
  triggerAll: string[];
  /** trigger groups: triggers[1] = every `trigger1` line (ANDed); groups are ORed */
  triggers: Record<number, string[]>;
  /** every other key (first value wins), lowercased keys */
  params: Record<string, string>;
}

export interface Statedef {
  id: number;
  /** header params, lowercased keys: type, movetype, physics, anim, juggle, … */
  params: Record<string, string>;
  controllers: StateController[];
}

export interface Cns {
  /** constant sections by lowercased name: data, size, velocity, movement, quotes */
  constants: Record<string, Record<string, string>>;
  statedefs: Map<number, Statedef>;
}

function controllerFrom(sec: IniSection): StateController {
  const triggers: Record<number, string[]> = {};
  const params: Record<string, string> = {};
  for (const e of sec.entries) {
    const tm = /^trigger(\d+)$/.exec(e.key);
    if (tm) {
      (triggers[Number(tm[1])] ??= []).push(e.value);
    } else if (e.key !== 'triggerall' && e.key !== 'type' && !(e.key in params)) {
      params[e.key] = e.value;
    }
  }
  const label = /^state\s+[^,]+,?\s*(.*)$/i.exec(sec.name)?.[1] ?? '';
  return {
    label: label.trim(),
    type: (get(sec, 'type') ?? '').toLowerCase(),
    triggerAll: getAll(sec, 'triggerall'),
    triggers,
    params,
  };
}

/** Parse any CNS-shaped text: constants + every Statedef (CMD files too). */
export function parseCns(text: string): Cns {
  const secs = parseIni(text);
  const constants: Record<string, Record<string, string>> = {};
  const statedefs = new Map<number, Statedef>();
  let cur: Statedef | null = null;
  for (const sec of secs) {
    const sd = /^statedef\s+(-?\d+)/i.exec(sec.name);
    if (sd) {
      cur = { id: Number(sd[1]), params: toRecord(sec), controllers: [] };
      statedefs.set(cur.id, cur);
      continue;
    }
    if (/^state\s/i.test(sec.name)) {
      cur?.controllers.push(controllerFrom(sec));
      continue;
    }
    cur = null;
    if (!(sec.lname in constants)) constants[sec.lname] = toRecord(sec);
  }
  return { constants, statedefs };
}

// ---------- CMD ----------

export interface CommandDef {
  name: string;
  /** raw `command = …` text */
  command: string;
  time: number;
  bufferTime: number;
}

export interface Cmd {
  defaults: { time: number; bufferTime: number };
  commands: CommandDef[];
  /** the [Statedef -1] entry table (+ any other statedefs in the file) */
  states: Map<number, Statedef>;
}

export function parseCmd(text: string): Cmd {
  const secs = parseIni(text);
  const d = findSection(secs, 'defaults');
  const defaults = {
    time: Number(get(d, 'command.time') ?? 15),
    bufferTime: Number(get(d, 'command.buffer.time') ?? 1),
  };
  const commands: CommandDef[] = [];
  for (const sec of secs) {
    if (sec.lname !== 'command') continue;
    const name = unquote(get(sec, 'name'));
    const command = get(sec, 'command');
    if (!name || !command) continue;
    commands.push({
      name,
      command,
      time: Number(get(sec, 'time') ?? defaults.time),
      bufferTime: Number(get(sec, 'buffer.time') ?? defaults.bufferTime),
    });
  }
  return { defaults, commands, states: parseCns(text).statedefs };
}

// ---------- command-string analysis ----------

export interface CommandSymbol {
  /** directions held/pressed: subset of B,DB,D,DF,F,UF,U,UB */
  dir?: string;
  /** buttons pressed together (lowercase a b c x y z s) */
  buttons: string[];
  release: boolean;
  hold: boolean;
  fourWay: boolean;
  /** `~30$B` charge time */
  charge?: number;
}

export function parseCommandString(cmd: string): CommandSymbol[] {
  return cmd.split(',').map((raw) => {
    let s = raw.trim();
    const sym: CommandSymbol = { buttons: [], release: false, hold: false, fourWay: false };
    s = s.replace(/^>/, '');
    for (;;) {
      if (s.startsWith('/')) { sym.hold = true; s = s.slice(1); continue; }
      if (s.startsWith('$')) { sym.fourWay = true; s = s.slice(1); continue; }
      const rel = /^~(\d*)/.exec(s);
      if (rel) {
        sym.release = true;
        if (rel[1]) sym.charge = Number(rel[1]);
        s = s.slice(rel[0].length);
        continue;
      }
      break;
    }
    const dir = /^(DB|DF|UB|UF|B|D|F|U)(?![a-z])/.exec(s);
    if (dir) {
      sym.dir = dir[1];
      s = s.slice(dir[0].length);
    }
    for (const b of s.split('+')) {
      const t = b.trim().replace(/^[/$~\d]+/, '');
      if (/^[abcxyzs]$/.test(t)) sym.buttons.push(t);
      else if (/^(DB|DF|UB|UF|B|D|F|U)$/.test(t) && !sym.dir) sym.dir = t;
    }
    return sym;
  });
}

/** Our Motion vocabulary for a direction sequence (null = not expressible). */
export function motionOf(symbols: CommandSymbol[]): { motion: string | null; buttons: string[] } {
  const last = symbols[symbols.length - 1];
  const buttons = last?.buttons ?? [];
  const dirSyms = symbols.filter((s) => s.dir && !s.buttons.length);
  const dirs = dirSyms.map((s) => s.dir).join(',');
  const charge = dirSyms[0]?.charge ?? 0;
  let motion: string | null = null;
  if (!dirs) motion = '';
  else if (charge > 0 && /^(B|DB),F$/.test(dirs)) motion = 'cbf';
  else if (charge > 0 && /^(D|DB|DF),U$/.test(dirs)) motion = 'du';
  else if (dirs === 'D,DF,F') motion = 'qcf';
  else if (dirs === 'D,DB,B') motion = 'qcb';
  else if (dirs === 'F,D,DF') motion = 'dp';
  else if (dirs === 'B,DB,D,DF,F') motion = 'hcf';
  else if (dirs === 'F,DF,D,DB,B') motion = 'hcb';
  else if (dirs === 'B,F') motion = 'bf';
  else if (dirs === 'F,F') motion = 'ff'; // forward-forward: NOT in our Motion set yet
  else if (dirs === 'D,DF,F,D,DF,F') motion = 'qcf2'; // double quarter (super) — no supers yet
  else if (dirs === 'D,DB,B,D,DB,B') motion = 'qcb2';
  // a held direction + button (`/$D, a`, `/F, y`) is a stance/command normal
  else if (dirSyms.every((s) => s.hold)) motion = `hold:${dirs}`;
  return { motion, buttons };
}
