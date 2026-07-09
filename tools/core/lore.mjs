// tools/core/lore.mjs — the Martian Lore sheet as a machine-readable source.
// One implementation for the CLI (new-character skill / studio:run) and the
// dev middleware (/__editor/lore, the design endpoint): fetch the public
// "Mars People" tab as CSV, fuzzy-find a person, and HARD-ENFORCE the
// privacy opt-out column ("NO AI PLEASE") — the check the skills used to do
// by hand is now machine-enforced (docs/CHARACTER_STUDIO.md §2.2, Phase 4).
// Plain ESM, no deps; Node 18+ (global fetch).
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

export const LORE_SHEET_ID = '1C8Kr5BJAopZXzsWJTcOvaySBvmEcQqPJgyXZ76Uohgo';
export const LORE_SHEET_URL = `https://docs.google.com/spreadsheets/d/${LORE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Mars%20People`;

/** Offline fallback ONLY (snapshot 2026-07-08, mirrors CLAUDE.md): when the
 *  sheet can't be fetched and no cache exists, these names still refuse.
 *  The live sheet is authoritative — re-fetch before any new character. */
export const KNOWN_OPT_OUTS = ['Maya Luna', 'Peter', 'Roarke', 'Summer'];

export class PrivacyOptOutError extends Error {
  constructor(name, marker) {
    super(`"${name}" is marked "${marker}" in the Martian Lore sheet's privacy opt-out column — ` +
      'they must NOT be scaffolded as a fighter, generated as an asset, or referenced by name in game content.');
    this.name = 'PrivacyOptOutError';
    this.optedOut = true;
  }
}

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, newlines in quotes). */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.length)) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.length)) rows.push(row);
  return rows;
}

/** header cell → person field (matched by prefix so sheet edits don't break us) */
const COLUMNS = [
  ['name', 'name'],
  ['discord', 'discord'],
  ['caption', 'caption'],
  ['bio', 'bio'],
  ['lore', 'lore'],
  ['link', 'links'],
  ['media', 'media'],
  ['privacy', 'privacyOptOut'],
  ['comment', 'comment'],
];

/** CSV rows → [{name, discord, caption, bio, lore, links, media, privacyOptOut, comment}] */
export function peopleFromCsv(csvText) {
  const rows = parseCsv(csvText);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.toLowerCase());
  const idx = {};
  for (const [prefix, key] of COLUMNS) {
    const i = header.findIndex((h) => h.startsWith(prefix));
    if (i >= 0) idx[key] = i;
  }
  if (idx.name === undefined || idx.privacyOptOut === undefined) {
    throw new Error('lore sheet: could not find the name/privacy columns — did the tab layout change?');
  }
  return rows.slice(1)
    .map((r) => {
      const p = {};
      for (const [, key] of COLUMNS) p[key] = (idx[key] !== undefined ? r[idx[key]] ?? '' : '').trim();
      return p;
    })
    .filter((p) => p.name);
}

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Fuzzy person lookup: exact name → exact discord → prefix/contains →
 *  best token overlap. Returns null when nothing plausibly matches. */
export function findPerson(people, query) {
  const q = norm(query);
  if (!q) return null;
  const exact = people.find((p) => norm(p.name) === q) ?? people.find((p) => norm(p.discord) === q);
  if (exact) return exact;
  const starts = people.filter((p) => norm(p.name).startsWith(q) || q.startsWith(norm(p.name)));
  if (starts.length === 1) return starts[0];
  const contains = people.filter((p) => norm(p.name).includes(q) || (p.discord && norm(p.discord).includes(q)));
  if (contains.length === 1) return contains[0];
  // token overlap (e.g. "maya" → "Maya Luna")
  const qTokens = new Set(q.split(' '));
  let best = null, bestScore = 0;
  for (const p of people) {
    const tokens = norm(p.name).split(' ');
    const score = tokens.filter((t) => qTokens.has(t)).length / Math.max(tokens.length, qTokens.size);
    if (score > bestScore) { best = p; bestScore = score; }
  }
  return bestScore >= 0.5 ? best : null;
}

/** THE hard gate. Throws PrivacyOptOutError when the queried person carries
 *  ANY text in the opt-out column (live sheet or fallback list). Returns the
 *  matched person (or null if unknown to the sheet — unknown names pass; the
 *  sheet only governs real Martians). */
export function assertNotOptedOut(people, query) {
  const person = findPerson(people, query);
  if (person?.privacyOptOut) throw new PrivacyOptOutError(person.name, person.privacyOptOut);
  if (person) return person; // a clean sheet row is authoritative
  // no sheet row (offline / unknown spelling): refuse the known snapshot list
  const q = norm(query);
  for (const name of KNOWN_OPT_OUTS) {
    const n = norm(name);
    if (q === n || (n.startsWith(q) && q.length >= 4) || (q.startsWith(n) && q.length - n.length <= 8)) {
      throw new PrivacyOptOutError(name, 'NO AI PLEASE');
    }
  }
  return null;
}

/**
 * Fetch the Mars People tab (with a disk cache so offline dev + repeated
 * design calls don't hammer the sheet). Falls back to the cache on network
 * failure regardless of age; with no cache either, returns null (callers
 * still get KNOWN_OPT_OUTS enforcement via assertNotOptedOut).
 */
export async function fetchLoreSheet({ cachePath, maxAgeMs = 60 * 60 * 1000, force = false } = {}) {
  if (cachePath && !force && existsSync(cachePath)) {
    const age = Date.now() - statSync(cachePath).mtimeMs;
    if (age < maxAgeMs) return peopleFromCsv(readFileSync(cachePath, 'utf8'));
  }
  try {
    const res = await fetch(LORE_SHEET_URL);
    if (!res.ok) throw new Error(`lore sheet fetch: ${res.status}`);
    const text = await res.text();
    if (cachePath) {
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, text);
    }
    return peopleFromCsv(text);
  } catch (e) {
    if (cachePath && existsSync(cachePath)) {
      console.warn(`  lore sheet: fetch failed (${String(e).slice(0, 80)}) — using stale cache`);
      return peopleFromCsv(readFileSync(cachePath, 'utf8'));
    }
    console.warn(`  lore sheet: unavailable (${String(e).slice(0, 80)}) — falling back to the static opt-out list`);
    return null;
  }
}

/** One-call front door: fetch (cached) + hard opt-out gate + person lookup.
 *  Throws PrivacyOptOutError on a match with the opt-out column. */
export async function lookupFighter(query, opts = {}) {
  const people = (await fetchLoreSheet(opts)) ?? [];
  return assertNotOptedOut(people, query);
}

/** condensed lore context for the design-draft prompt (bio + lore + caption,
 *  clipped) — how the sheet's running jokes reach archetypes/quotes/VO */
export function loreContext(person, maxLen = 2400) {
  if (!person) return '';
  const parts = [
    person.caption && `Caption: ${person.caption}`,
    person.bio && `Bio: ${person.bio}`,
    person.lore && `Lore: ${person.lore}`,
  ].filter(Boolean);
  const text = parts.join('\n');
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}
