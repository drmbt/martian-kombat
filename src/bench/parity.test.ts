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

  // 2026-10-06: Kung Fu Man ships as a SECRET unlockable with his real art.
  // A reference may sit in ROSTER only as `secret` (never `playable`: no VO,
  // no CPU/attract pools, no roster bench), and its playable copy must fight
  // exactly like the measured port — regenerate it with npm run mugen:sprites.
  it('references reach the roster only as secrets', async () => {
    const { ROSTER } = await import('../data/roster');
    for (const id of Object.keys(REFERENCES)) {
      const r = ROSTER.find((e) => e.id === id);
      if (r) expect({ id, playable: r.playable, secret: r.secret }).toEqual({ id, playable: false, secret: true });
    }
  });

  // ...up to ONE allowed difference: a uniform `scale` (art + boxes + reach
  // together, so he stands in the roster's height band) — compared unscaled
  it('a secret reference fights exactly like its bench port (before its uniform scale)', async () => {
    const { ROSTER } = await import('../data/roster');
    const ALLOWED = new Set(['name', 'color', 'winQuotes', 'cellW', '_source', 'scale', '_scaleNote']);
    const sim = (d: object) => Object.fromEntries(Object.entries(d).filter(([k]) => !ALLOWED.has(k)));
    for (const [id, refc] of Object.entries(REFERENCES)) {
      if (!ROSTER.some((e) => e.id === id)) continue;
      const raw = (await import(`../data/characters/${id}.json`)).default as object;
      expect(sim(raw), `${id}.json drifted from ${id}.port.json — re-run npm run mugen:sprites`).toEqual(sim(refc.def));
    }
  });
});
