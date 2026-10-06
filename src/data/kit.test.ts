// P4.2 — the kit grammar keeps grabs out of throw-out-of-range: a grab must
// out-reach the push-box separation against every roster opponent.
import { describe, expect, it } from 'vitest';
import { ROSTER_MAX_FRONT, applyKitGrammar, grabFloor } from '../../tools/core/kit.mjs';
import { characters } from './characters';
import { ROSTER } from './roster';

describe('kit grammar: grab range floor (P4.2)', () => {
  it('ROSTER_MAX_FRONT covers every playable fighter (after scale)', () => {
    const fronts = ROSTER.filter((r) => r.playable).map((r) => characters[r.id].bodyBox.x + characters[r.id].bodyBox.w);
    expect(Math.max(...fronts)).toBeLessThanOrEqual(ROSTER_MAX_FRONT);
  });

  it('raises short grabs and grab variants to the floor; leaves longer ones alone', () => {
    const body = { x: -44, w: 88 };
    const moves: Record<string, Record<string, unknown>> = {
      throw: { grab: { range: 64 } },
      slam: { grab: { range: 90 }, variants: { l: { grab: { range: 70 } }, h: { grab: { range: 150 } } } },
    };
    applyKitGrammar(moves, [], { bodyBox: body });
    const floor = grabFloor(body);
    expect(floor).toBe(44 + ROSTER_MAX_FRONT + 10);
    expect((moves.throw.grab as { range: number }).range).toBe(floor);
    expect((moves.slam.grab as { range: number }).range).toBe(floor);
    const v = moves.slam.variants as Record<string, { grab: { range: number } }>;
    expect(v.l.grab.range).toBe(floor);
    expect(v.h.grab.range).toBe(150);
  });
});
