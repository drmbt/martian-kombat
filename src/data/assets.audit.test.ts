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
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROSTER } from './roster';
import { characters } from './characters';
import { STAGES } from './stages';

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
});
