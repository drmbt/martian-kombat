// core/lore.mjs — the machine-enforced privacy opt-out gate + sheet parsing.
// Fixture-driven (no network): the CSV shape mirrors the real "Mars People"
// tab export (gviz tqx=out:csv — every field quoted, prefix-matched headers).
import { describe, expect, it } from 'vitest';
import {
  KNOWN_OPT_OUTS, PrivacyOptOutError, assertNotOptedOut, findPerson, loreContext, parseCsv, peopleFromCsv,
} from '../../tools/core/lore.mjs';

const FIXTURE = [
  '"Name (as known on Mars)","discord handle","caption","bio","lore","link (web, social media tag)","media reference (photos, voice sample)","privacy opt out (indicate if you would prefer to not have your likeness used","comment"',
  '"Gene","gene_wav","dub scientist","Runs the speaker wall.","Gene, the ""Dub Scientist"" of Mars, mixes live.","","","",""',
  '"Maya Luna","mayaluna","","","","","","NO AI PLEASE",""',
  '"Peterson","pete_ok","a different martian entirely","","","","","",""',
  '"Tao","tao_moves","movement artist","Teaches contact improv,\nhosts sunrise flows.","","","","",""',
].join('\n');

const PEOPLE = peopleFromCsv(FIXTURE);

describe('lore sheet parsing', () => {
  it('parses quoted fields, escaped quotes, and embedded newlines', () => {
    const rows = parseCsv(FIXTURE);
    expect(rows).toHaveLength(5);
    expect(rows[1][4]).toContain('"Dub Scientist"');
    expect(rows[4][3]).toContain('contact improv,\nhosts sunrise flows');
  });

  it('maps prefix-matched header columns onto person fields', () => {
    expect(PEOPLE).toHaveLength(4);
    const gene = PEOPLE[0];
    expect(gene.name).toBe('Gene');
    expect(gene.discord).toBe('gene_wav');
    expect(gene.privacyOptOut).toBe('');
    expect(PEOPLE[1].privacyOptOut).toBe('NO AI PLEASE');
  });
});

describe('fuzzy person lookup', () => {
  it('finds by exact name, discord handle, and partial tokens', () => {
    expect(findPerson(PEOPLE, 'gene')?.name).toBe('Gene');
    expect(findPerson(PEOPLE, 'tao_moves')?.name).toBe('Tao');
    expect(findPerson(PEOPLE, 'maya')?.name).toBe('Maya Luna');
    expect(findPerson(PEOPLE, 'zzz-nobody')).toBeNull();
  });
});

describe('privacy opt-out gate (HARD RULE)', () => {
  it('throws PrivacyOptOutError for anyone with opt-out text', () => {
    expect(() => assertNotOptedOut(PEOPLE, 'Maya Luna')).toThrow(PrivacyOptOutError);
    expect(() => assertNotOptedOut(PEOPLE, 'maya')).toThrow(PrivacyOptOutError);
  });

  it('passes clean sheet rows — including names shadowing the fallback list', () => {
    // Peterson has a clean row; the static "Peter" fallback must NOT eclipse it
    expect(assertNotOptedOut(PEOPLE, 'Peterson')?.name).toBe('Peterson');
    expect(assertNotOptedOut(PEOPLE, 'gene')?.name).toBe('Gene');
  });

  it('refuses the known snapshot list when the sheet is unavailable', () => {
    for (const name of KNOWN_OPT_OUTS) {
      expect(() => assertNotOptedOut([], name)).toThrow(PrivacyOptOutError);
    }
    expect(assertNotOptedOut([], 'tao')).toBeNull(); // unknown names pass
  });
});

describe('loreContext', () => {
  it('condenses caption/bio/lore for the design prompt and clips long text', () => {
    const ctx = loreContext(PEOPLE[0]);
    expect(ctx).toContain('Caption: dub scientist');
    expect(ctx).toContain('Lore: Gene');
    expect(loreContext(PEOPLE[0], 30).length).toBeLessThanOrEqual(30);
    expect(loreContext(null)).toBe('');
  });
});
