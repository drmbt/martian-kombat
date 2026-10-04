// Engine-semantics regression guard: the committed Kung Fu Man port must
// keep playing like MUGEN's KFM in OUR engine. If an engine change moves any
// timing/physics semantic, this drops below 100% and says which metric.
// Intentional change? Re-fit the port: npm run mugen:fetch && npm run
// mugen:import -- --def assets/raw/mugen/chars/kfm/kfm.def --id kfm --fit
import { describe, expect, it } from 'vitest';
import { REFERENCES } from './reference';
import { parityReport } from './parity';

describe('benchmark references', () => {
  for (const [id, r] of Object.entries(REFERENCES)) {
    it(`${id}: the port measures within tolerance of its source on every metric`, () => {
      const p = parityReport(r.def, r.ref);
      const misses = p.rows.filter((x) => x.ok === false).map((x) => `${x.scope} ${x.metric}: ref ${x.ref} vs ours ${x.ours}`);
      expect(misses, `parity ${(p.score * 100).toFixed(1)}% — re-fit with npm run mugen:import -- --fit`).toEqual([]);
      expect(p.rows.filter((x) => x.ok !== null).length).toBeGreaterThan(80);
    });
  }

  it('references are bench-only: never registered as playable', async () => {
    const { ROSTER } = await import('../data/roster');
    for (const id of Object.keys(REFERENCES)) expect(ROSTER.some((r) => r.id === id)).toBe(false);
  });
});
