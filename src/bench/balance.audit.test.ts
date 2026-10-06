// MKS-1 balance ratchet. Every playable fighter is MEASURED in the engine
// (src/bench/audit.ts) and graded against src/bench/standards.ts.
//   - a NEW error (not in baseline.json) fails: you just broke a move
//   - a FIXED error still listed in baseline.json fails: ratchet it down
// Both fix the same way: npm run bench -- --update-baseline (and commit it).
// Band warnings never fail CI — they are reported by `npm run bench`.
import { describe, expect, it } from 'vitest';
import { characters } from '../data/characters';
import { ROSTER } from '../data/roster';
import { auditCharacter } from './audit';
import baseline from './baseline.json';

describe('MKS-1 balance audit (ratchet)', () => {
  const known = new Set<string>(baseline.errors);
  const current = new Map<string, string>();
  const playable = ROSTER.filter((x) => x.playable).map((x) => x.id);
  for (const id of playable) {
    for (const f of auditCharacter(characters, id, { combos: false, opponents: playable }).findings) {
      if (f.severity === 'error') current.set(f.key, f.message);
    }
  }

  it('no new MKS-1 errors', () => {
    const fresh = [...current].filter(([k]) => !known.has(k)).map(([k, m]) => `${k} — ${m}`);
    expect(fresh, 'new MKS-1 errors (fix the move, or if intentional: npm run bench -- --update-baseline)').toEqual([]);
  });

  it('baseline only lists errors that still exist', () => {
    const fixed = [...known].filter((k) => !current.has(k));
    expect(fixed, 'these are fixed — ratchet the baseline down: npm run bench -- --update-baseline').toEqual([]);
  });
});
