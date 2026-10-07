// P13.1 / P13.2 — the calibration lab and its competent bot.
import { describe, expect, it } from 'vitest';
import { characters } from '../../data/characters';
import { CpuDriver } from '../../ai/bot';
import { SmartBot } from '../../ai/smart';
import { runMatch } from './match';
import { runMatrix } from './matrix';

describe('SmartBot (P13.2)', () => {
  it('beats the random CPU when both play the same fighter', () => {
    // same fighter on both sides: only skill differs
    let wins = 0;
    let games = 0;
    for (const id of ['vincent', 'kirby', 'freeman', 'tao', 'cat', 'earl']) {
      const a = runMatch(characters, id, id, [new SmartBot(0, characters, { seed: 1 }), new CpuDriver(1)]);
      const b = runMatch(characters, id, id, [new CpuDriver(0), new SmartBot(1, characters, { seed: 2 })]);
      wins += (a.winner === 0 ? 1 : 0) + (b.winner === 1 ? 1 : 0);
      games += 2;
    }
    expect(wins / games).toBeGreaterThanOrEqual(0.8);
  });

  it('replays a match exactly (seeded, no Math.random)', () => {
    const run = () => runMatch(characters, 'yulia', 'chebel', [new SmartBot(0, characters, { seed: 7 }), new SmartBot(1, characters, { seed: 8 })]);
    const a = run();
    const b = run();
    expect(b).toEqual(a);
  });
});

describe('matchup matrix (P13.1)', () => {
  it('is deterministic and covers both slot orders', () => {
    const ids = ['vincent', 'yulia', 'gene'];
    const m1 = runMatrix(characters, ids, { seeds: 1 });
    const m2 = runMatrix(characters, ids, { seeds: 1 });
    expect(m2.cells).toEqual(m1.cells);
    // each ordered non-mirror pair: 1 seed × 2 slot orders = 2 games
    expect(m1.cells.vincent.yulia.games).toBe(2);
    expect(m1.cells.vincent.yulia.wins + m1.cells.vincent.yulia.draws + m1.cells.vincent.yulia.losses).toBe(2);
    // the two sides of a pair agree
    expect(m1.cells.vincent.yulia.wins).toBe(m1.cells.yulia.vincent.losses);
  });
});

import { applyFeel, D8 } from './feel';
import { artHitbox } from './art';
import { bake, loadRaw } from './raw';
import { auditCharacter } from '../audit';

describe('D8 feel profile (P13.3)', () => {
  const raw = loadRaw(['yulia', 'kirby']);
  const d8 = applyFeel(raw, 'd8');
  it('sets hitstop / plus-on-hit / safer blocks / walk speed as data', () => {
    expect(d8.yulia.moves.lp.hitstop).toBe(raw.yulia.moves.lp.hitstop ?? D8.hitstop.light);
    const mp = d8.yulia.moves.mp;
    if (!mp.knockdown) expect(mp.hitstun - mp.active - mp.recovery).toBeGreaterThanOrEqual(D8.onHit.medium);
    expect(mp.blockstun - mp.active - mp.recovery).toBeGreaterThanOrEqual(D8.onBlockFloor.medium);
    expect(d8.yulia.walkSpeed).toBeGreaterThanOrEqual(raw.yulia.walkSpeed);
    expect(applyFeel(raw, 'current')).toBe(raw); // A side is untouched
  });
  it('adds no MKS-1 errors', () => {
    const baked = bake(d8);
    for (const id of ['yulia', 'kirby']) {
      expect(auditCharacter(baked, id, { combos: true }).findings.filter((f) => f.severity === 'error')).toEqual([]);
    }
  });
});

describe('hitboxes from the art (P13.4 stage A)', () => {
  it('boxes a drawn strike in front of the body, in unscaled JSON units', () => {
    const raw = loadRaw(['rj']);
    const a = artHitbox('rj', 'lp', raw.rj.hurtStand.h);
    expect(a).not.toBeNull();
    expect(a!.box.x + a!.box.w).toBeGreaterThan(40); // reaches forward
    expect(a!.box.y).toBeLessThan(0); // above the feet
    expect(artHitbox('rj', 'no-such-move', raw.rj.hurtStand.h)).toBeNull();
  });
});
