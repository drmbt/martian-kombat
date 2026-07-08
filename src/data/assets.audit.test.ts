/// <reference types="node" />
// Asset-completeness audit — a guardrail that FAILS (loudly, with a list) when
// a playable fighter or a stage is missing a whole CLASS of game-ready assets.
// It reads public/assets/ directly, so adding a character/stage to the data
// without generating its sprites/portraits/VO/fatality/panels trips this test.
//
// Not every asset is contractual: per-move projectile/vfx art is optional (the
// loader gates on the asset manifest), so this only checks the assets EVERY
// complete fighter/stage must ship. See docs/CHARACTERS.md for the full
// per-character generation checklist.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROSTER } from './roster';
import { characters } from './characters';
import { STAGES } from './stages';
import { CELL_H, CELL_W } from '../render/coords';

// mirrors VOICE_COUNTS in BootScene (kept here so the audit doesn't import
// Phaser); the loader requests this many numbered clips per category
const VOICE_COUNTS = { kiai: 6, hurt: 6, victory: 4 } as const;

const ASSETS = join(process.cwd(), 'public', 'assets');
const has = (...p: string[]): boolean => existsSync(join(ASSETS, ...p));

/** collect every missing contractual asset for a fighter */
function fighterGaps(id: string): string[] {
  const g: string[] = [];
  if (!has('sprites', id, 'sheet.png')) g.push('sprite sheet.png');
  if (!has('sprites', id, 'meta.json')) g.push('sprite meta.json');
  if (!has('portraits', `${id}.png`)) g.push('portrait');
  if (!has('portraits', `${id}-bust.png`)) g.push('bust portrait'); // BootScene hard-loads bust-<id>
  if (!has('portraits', `${id}-ko.png`)) g.push('KO portrait');
  if (!has('audio', 'announcer', `${id}.mp3`)) g.push('name VO');
  for (const [cat, n] of Object.entries(VOICE_COUNTS)) {
    const missing = Array.from({ length: n }, (_, i) => i + 1).filter((i) => !has('audio', 'voice', `${id}-${cat}-${i}.mp3`));
    if (missing.length) g.push(`${cat} VO ${missing.join('/')}`);
  }
  const fat = characters[id]?.fatality;
  if (!fat) g.push('fatality (none defined)');
  else {
    const missing = Array.from({ length: fat.panels }, (_, i) => i + 1).filter(
      (n) => !has('fatalities', id, `${fat.id}-${n}.jpg`),
    );
    if (missing.length) g.push(`fatality panels ${missing.join('/')}`);
  }
  return g;
}

describe('asset completeness audit', () => {
  for (const r of ROSTER.filter((x) => x.playable)) {
    it(`${r.id} has every game-ready asset`, () => {
      const gaps = fighterGaps(r.id);
      expect(gaps, `${r.id} is missing: ${gaps.join(', ')}`).toEqual([]);
    });
  }

  it('every stage has a name-call VO', () => {
    const missing = STAGES.filter((s) => !has('audio', 'announcer', `stage-${s.id}.mp3`)).map((s) => s.id);
    expect(missing, `stages missing a name VO: ${missing.join(', ')}`).toEqual([]);
  });

  it('every registered stage has its background art', () => {
    // registration/asset drift guard (the earl-home/vincent-home lesson):
    // a stage in STAGES whose art file is gone means a stale registration
    const missing = STAGES.filter((s) => !existsSync(join(process.cwd(), 'public', s.file))).map((s) => s.id);
    expect(missing, `stages registered without art: ${missing.join(', ')}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Orphan sweep — the inverse of the completeness audit: files on disk that no
// roster character owns. Catches deleted/renamed characters leaving portraits
// behind (haidai), superseded fatality panels (flo's rm-rf), and per-move VO
// whose move no longer opts in (vanessa's teleportal).
// ---------------------------------------------------------------------------
describe('orphan asset sweep', () => {
  const ids = new Set(ROSTER.map((r) => r.id));
  const dirOf = (...p: string[]): string[] => {
    const d = join(ASSETS, ...p);
    return existsSync(d) ? readdirSync(d).filter((f) => !f.startsWith('.')) : [];
  };

  it('portraits all belong to a roster character', () => {
    const orphans = dirOf('portraits').filter((f) => {
      const m = /^(.+?)(-bust|-ko)?\.png$/.exec(f);
      return !m || !ids.has(m[1]);
    });
    expect(orphans, `orphan portraits: ${orphans.join(', ')}`).toEqual([]);
  });

  it('sprite + fatality dirs all belong to a roster character', () => {
    const orphans = [
      ...dirOf('sprites').filter((d) => statSync(join(ASSETS, 'sprites', d)).isDirectory() && !ids.has(d)),
      ...dirOf('fatalities').filter((d) => statSync(join(ASSETS, 'fatalities', d)).isDirectory() && !ids.has(d)),
    ];
    expect(orphans, `orphan asset dirs: ${orphans.join(', ')}`).toEqual([]);
  });

  it('fatality panels match each character’s declared fatality id', () => {
    const stale: string[] = [];
    for (const id of ids) {
      const fat = characters[id]?.fatality;
      for (const f of dirOf('fatalities', id)) {
        if (!f.endsWith('.jpg')) continue;
        if (!fat || !f.startsWith(`${fat.id}-`)) stale.push(`${id}/${f}`);
      }
    }
    expect(stale, `panels from a superseded fatality: ${stale.join(', ')}`).toEqual([]);
  });

  it('per-move VO clips belong to a move that opts in (voice: true)', () => {
    const stale = dirOf('audio', 'voice')
      .filter((f) => f.includes('-move-') && f.endsWith('.mp3'))
      .filter((f) => {
        const m = /^(.+?)-move-(.+)\.mp3$/.exec(f);
        return !m || characters[m[1]]?.moves[m[2]]?.voice !== true;
      });
    expect(stale, `move VO without a voice:true move: ${stale.join(', ')}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Sheet meta shape — every packed meta.json agrees with the shared coordinate
// contract (src/render/coords). `skeletons` and a version field become
// mandatory with meta v2 in the Sprint 27 Phase 2 migration.
// ---------------------------------------------------------------------------
describe('sheet meta shape', () => {
  for (const r of ROSTER.filter((x) => x.playable)) {
    it(`${r.id} meta.json is coherent`, () => {
      const p = join(ASSETS, 'sprites', r.id, 'meta.json');
      if (!existsSync(p)) return; // completeness audit already flags this
      const meta = JSON.parse(readFileSync(p, 'utf8')) as {
        cellW: number; cellH: number; cols: number; rows: number; frames: string[];
      };
      expect(meta.cellW, 'cellW').toBe(CELL_W);
      expect(meta.cellH, 'cellH').toBe(CELL_H);
      expect(meta.frames.length, 'frames fit the grid').toBeLessThanOrEqual(meta.cols * meta.rows);
      expect(new Set(meta.frames).size, 'frame names unique').toBe(meta.frames.length);
      expect(meta.frames.length, 'has frames').toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Character schema lint — a playable fighter must carry the full roster-
// standard kit grammar, not just assets. KNOWN_KIT_GAPS is the Sprint 27
// Phase 3 backfill list: shrink it, never grow it.
// ---------------------------------------------------------------------------
const KNOWN_KIT_GAPS: Record<string, string[]> = {
  // emptied 2026-07-08 (Sprint 27 Phase 3 backfill): ben + earl gained
  // chains/cancel/variants + themed fatalities (dinners-ready / final-mix),
  // vanessa her win quotes. Keep this list EMPTY — a new entry means a new
  // fighter shipped below the roster standard.
};

describe('character schema lint', () => {
  for (const r of ROSTER.filter((x) => x.playable)) {
    it(`${r.id} meets the roster kit standard`, () => {
      const def = characters[r.id];
      const moves = Object.values(def.moves);
      const gaps: string[] = [];
      if ((def.winQuotes?.length ?? 0) < 3) gaps.push('win quotes');
      if (!def.fatality || def.fatality.id === 'finish') gaps.push('placeholder fatality');
      if (!moves.some((m) => (m.chains?.length ?? 0) > 0)) gaps.push('chains');
      if (!moves.some((m) => m.variants && Object.keys(m.variants).length > 0)) gaps.push('variants');
      if (!moves.some((m) => m.cancel)) gaps.push('cancel');
      if (!def.moves.throw) gaps.push('universal throw');
      const known = new Set(KNOWN_KIT_GAPS[r.id] ?? []);
      const unexpected = gaps.filter((g) => !known.has(g));
      const fixed = [...known].filter((g) => !gaps.includes(g));
      expect(unexpected, `${r.id} kit gaps: ${unexpected.join(', ')}`).toEqual([]);
      expect(fixed, `${r.id} KNOWN_KIT_GAPS is stale — remove: ${fixed.join(', ')}`).toEqual([]);
    });
  }
});
