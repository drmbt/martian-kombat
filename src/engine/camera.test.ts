// Optional MUGEN / SF2-style horizontal camera (MatchRules.camera). The
// engine owns it because it bounds the fighters; omitted = the classic fixed
// screen, which every other engine test (and the KFM parity test) covers.
import { describe, expect, it } from 'vitest';
import { EMPTY_INPUT, STAGE_MAX_X, STAGE_MIN_X, STAGE_W, arenaBounds, cameraX, initialState, step, type Defs, type GameState, type InputFrame } from './index';
import { testChar, testMove } from '../bench/fixtures';

const inp = (p: Partial<InputFrame> = {}): InputFrame => ({ ...EMPTY_INPUT, ...p });
const defs: Defs = { a: testChar('a'), b: testChar('b') };
const WIDE = { minX: -415, maxX: 1375 };
const CAM = { width: STAGE_W, margin: 50 };

function fight(camera = true): GameState {
  const s = initialState('a', 'b', defs, { roundTicks: 0, stage: camera ? WIDE : undefined, camera: camera ? CAM : undefined });
  s.phase = 'fight';
  return s;
}
const run = (s: GameState, n: number, p1: Partial<InputFrame>, p2: Partial<InputFrame>): void => {
  for (let i = 0; i < n; i++) step(s, [inp(p1), inp(p2)], defs);
};

describe('camera (MatchRules.camera)', () => {
  it('fixed screen when omitted: centre is STAGE_W/2, arena is the stage', () => {
    const s = fight(false);
    expect(cameraX(s)).toBe(STAGE_W / 2);
    expect(arenaBounds(s)).toEqual({ minX: STAGE_MIN_X, maxX: STAGE_MAX_X });
  });

  it('two fighters walking apart are pinned to the view: max separation = width − 2·margin', () => {
    const s = fight();
    run(s, 400, { left: true }, { right: true });
    const [a, b] = s.fighters;
    expect(b.x - a.x).toBeCloseTo(CAM.width - 2 * CAM.margin, 5);
    expect(cameraX(s)).toBeCloseTo((a.x + b.x) / 2, 5); // still centred on them
  });

  it('the view follows a pair moving together until the stage end, which becomes the corner', () => {
    const s = fight();
    run(s, 600, { right: true }, { right: true }); // P1 chases, P2 retreats
    const [a, b] = s.fighters;
    expect(b.x).toBeCloseTo(WIDE.maxX, 5); // far past the fixed screen's 910
    expect(a.x).toBeGreaterThan(STAGE_MAX_X); // the chaser followed off the old screen
    expect(cameraX(s)).toBeCloseTo(WIDE.maxX + CAM.margin - CAM.width / 2, 5); // clamped
  });

  it('a corner hit pushes the attacker back (corner = the arena edge, not the old screen)', () => {
    const d2: Defs = { a: testChar('a', {}, { lp: testMove({ knockback: 8 }) }), b: testChar('b') };
    const s = initialState('a', 'b', d2, { roundTicks: 0, stage: WIDE, camera: CAM });
    s.phase = 'fight';
    s.fighters[0].x = WIDE.maxX - 91;
    s.fighters[1].x = WIDE.maxX;
    step(s, [inp({ lp: true }), inp()], d2);
    for (let i = 0; i < 6 && s.fighters[1].action.kind !== 'hitstun'; i++) step(s, [inp(), inp()], d2);
    expect(s.fighters[1].action.kind).toBe('hitstun');
    expect(s.fighters[0].vx).toBeLessThan(0); // corner transfer: the attacker slides back
  });

  it('projectiles live until they leave the VIEW, not the old fixed screen', () => {
    const shot = (s: GameState): void => {
      s.projectiles.push({
        owner: 0, moveId: 'fb', x: 1200, y: 100, vx: 10, // flies far above both fighters
        box: { x: -10, y: -10, w: 20, h: 20 }, damage: 10, hitstun: 10, blockstun: 8, knockback: 4,
        height: 'mid', ttl: -1, vy: 0, gravity: 0, fuse: -1, knockdown: false, field: false,
        rehit: 0, hitCooldown: 0, slowFactor: 0, pull: false,
      });
    };
    // fixed screen: x 1200 is already past STAGE_W + 60 — gone on the first tick
    const fixed = fight(false);
    shot(fixed);
    step(fixed, [inp(), inp()], defs);
    expect(fixed.projectiles).toHaveLength(0);
    // camera parked at the right stage end: the view reaches 1425, so it lives
    const s = fight();
    s.fighters[0].x = 1100;
    s.fighters[1].x = 1300;
    shot(s);
    const view = cameraX(s) + CAM.width / 2;
    let ticks = 0;
    while (s.projectiles.length && ticks < 100) {
      step(s, [inp(), inp()], defs);
      ticks++;
    }
    expect(ticks).toBe(Math.floor((view + 60 - 1200) / 10) + 1);
  });
});
