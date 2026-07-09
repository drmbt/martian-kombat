// Type declarations for the lore-sheet module. Keep in sync with lore.mjs.
export const LORE_SHEET_ID: string;
export const LORE_SHEET_URL: string;
export const KNOWN_OPT_OUTS: string[];

export interface LorePerson {
  name: string;
  discord: string;
  caption: string;
  bio: string;
  lore: string;
  links: string;
  media: string;
  privacyOptOut: string;
  comment: string;
}

export class PrivacyOptOutError extends Error {
  optedOut: true;
  constructor(name: string, marker: string);
}

export function parseCsv(text: string): string[][];
export function peopleFromCsv(csvText: string): LorePerson[];
export function findPerson(people: LorePerson[], query: string): LorePerson | null;
export function assertNotOptedOut(people: LorePerson[], query: string): LorePerson | null;
export function fetchLoreSheet(opts?: { cachePath?: string; maxAgeMs?: number; force?: boolean }): Promise<LorePerson[] | null>;
export function lookupFighter(query: string, opts?: { cachePath?: string; maxAgeMs?: number; force?: boolean }): Promise<LorePerson | null>;
export function loreContext(person: LorePerson | null | undefined, maxLen?: number): string;
