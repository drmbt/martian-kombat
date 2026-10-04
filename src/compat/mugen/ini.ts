// MUGEN / IKEMEN GO text-format tokenizer. Every MUGEN content file (DEF, CNS,
// CMD, AIR, stage DEF) is "INI-ish": `[Section]` headers, `key = value` lines,
// `;` comments. Keys are case-insensitive; section names and duplicate keys
// matter (a CNS state controller repeats `trigger1`, an AIR action is a raw
// line list), so this keeps BOTH the parsed entries and the raw lines.
//
// Pure TS, zero deps — shared by the Node import CLI (tools/fg/) and any
// future in-browser importer (Character Studio). Never imported by src/engine.

export interface IniEntry {
  /** lowercased, trimmed key */
  key: string;
  /** trimmed value with the trailing comment removed (quotes preserved) */
  value: string;
  line: number;
}

export interface IniSection {
  /** header text as written, trimmed: `Statedef 200`, `Begin Action 0` */
  name: string;
  /** lowercased header for matching */
  lname: string;
  entries: IniEntry[];
  /** every non-empty, comment-stripped line inside the section (AIR needs these) */
  lines: string[];
  line: number;
}

/** Strip a `;` comment that is not inside double quotes. */
export function stripComment(line: string): string {
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQ = !inQ;
    else if (ch === ';' && !inQ) return line.slice(0, i);
  }
  return line;
}

export function parseIni(text: string): IniSection[] {
  const out: IniSection[] = [];
  let cur: IniSection | null = null;
  const rows = text.replace(/^﻿/, '').split(/\r?\n/);
  rows.forEach((raw, idx) => {
    const line = stripComment(raw).trim();
    if (!line) return;
    const head = /^\[(.+?)\]/.exec(line);
    if (head) {
      cur = { name: head[1].trim(), lname: head[1].trim().toLowerCase(), entries: [], lines: [], line: idx + 1 };
      out.push(cur);
      return;
    }
    if (!cur) return; // stray lines before the first header are ignored, as MUGEN does
    const sec: IniSection = cur;
    sec.lines.push(line);
    const eq = line.indexOf('=');
    if (eq > 0) {
      sec.entries.push({ key: line.slice(0, eq).trim().toLowerCase(), value: line.slice(eq + 1).trim(), line: idx + 1 });
    }
  });
  return out;
}

/** First value for a key in a section (case-insensitive). */
export function get(sec: IniSection | undefined, key: string): string | undefined {
  if (!sec) return undefined;
  const k = key.toLowerCase();
  return sec.entries.find((e) => e.key === k)?.value;
}

/** Every value for a key (CNS triggers repeat: trigger1 = a / trigger1 = b). */
export function getAll(sec: IniSection | undefined, key: string): string[] {
  if (!sec) return [];
  const k = key.toLowerCase();
  return sec.entries.filter((e) => e.key === k).map((e) => e.value);
}

export function unquote(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
}

/** Comma list of numbers ("2.4, -8.1"); non-numeric parts become NaN. */
export function nums(v: string | undefined): number[] {
  if (v === undefined || v.trim() === '') return [];
  return v.split(',').map((p) => Number(p.trim()));
}

/** First number of a comma list, or `fallback` when absent/unparseable. */
export function num(v: string | undefined, fallback: number): number {
  const n = nums(v)[0];
  return n === undefined || Number.isNaN(n) ? fallback : n;
}

export function findSection(secs: IniSection[], name: string): IniSection | undefined {
  const n = name.toLowerCase();
  return secs.find((s) => s.lname === n);
}

/** Section → plain {key: value} map (first value wins). */
export function toRecord(sec: IniSection | undefined): Record<string, string> {
  const r: Record<string, string> = {};
  for (const e of sec?.entries ?? []) if (!(e.key in r)) r[e.key] = e.value;
  return r;
}
