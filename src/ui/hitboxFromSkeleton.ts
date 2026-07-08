// Auto-derive a move hitbox from a cell's DWPose keypoints — the in-browser
// twin of `suggest_hitbox` in tools/qa/pose_qa.py, used by the Sprite Editor's
// "auto hitbox from skeleton" button. Works off the 11-joint subset baked into
// meta.json (no hand/foot sub-keypoints), so it's a good starting box the user
// then tweaks, not a pixel-perfect measurement.
//
// Output is an origin-relative CELL-space box (x forward from center, y up from
// feet). The caller converts it to an engine hitbox via
// FightScene.cellBoxToHitbox, which uses the sprite's RENDER scale (so the box
// draws over the art) — NOT the character `scale` collision multiplier.
import type { Box, MoveDef } from '../engine';
import { ORIGIN_CX, ORIGIN_FEET } from '../render/coords';

type Joints = Record<string, [number, number, number]>;
export type StrikeKind = 'punch' | 'kick';

/** punch- vs kick-reach: prefer the move's declared special button, else the
 *  normal's id suffix (…p / …k), else punch. */
export function strikeKind(moveId: string, move?: MoveDef): StrikeKind {
  const b = move?.input?.button;
  if (b === 'kick' || b === 'KKK') return 'kick';
  if (b === 'punch' || b === 'PPP') return 'punch';
  const base = moveId.replace(/^[cj]/, '');
  return /k$/.test(base) ? 'kick' : 'punch';
}

function core(j: Joints, kind: StrikeKind): [number, number] {
  const names = kind === 'punch' ? ['Lsho', 'Rsho'] : ['Lhip', 'Rhip'];
  const pts = names.map((n) => j[n]).filter((p): p is [number, number, number] => !!p && p[2] >= 0.3);
  if (pts.length) return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  return [ORIGIN_CX, ORIGIN_FEET * 0.6];
}

/** The box around the forward-most striking limb, in the engine's unscaled
 *  facing-relative convention. Returns null if the limb isn't confidently
 *  detected in this cell (caller keeps the existing box). */
export function hitboxFromSkeleton(joints: Joints, kind: StrikeKind, pad = 22): Box | null {
  const [cx, cy] = core(joints, kind);
  // striking side: forward-most wrist (punch) or ankle (kick), plus the whole
  // hand/foot cluster on that side (mirrors pose_qa.py striking_extremity), so
  // the box is SIZED to the fist/foot instead of a fixed square on one joint.
  const sides: { pivot: string; member: (n: string) => boolean }[] =
    kind === 'punch'
      ? [
          { pivot: 'Lwri', member: (n) => n.startsWith('lhand_') },
          { pivot: 'Rwri', member: (n) => n.startsWith('rhand_') },
        ]
      : [
          { pivot: 'Lank', member: (n) => n === 'Lbigtoe' || n === 'Lsmalltoe' || n === 'Lheel' },
          { pivot: 'Rank', member: (n) => n === 'Rbigtoe' || n === 'Rsmalltoe' || n === 'Rheel' },
        ];
  let best: { pivot: [number, number]; member: (n: string) => boolean } | null = null;
  let bestReach = -Infinity;
  for (const s of sides) {
    const p = joints[s.pivot];
    if (!p || p[2] < 0.3) continue;
    const reach = p[0] - cx + 0.5 * Math.max(0, cy - p[1]); // toward opponent (faces right) + height bonus
    if (reach > bestReach) {
      bestReach = reach;
      best = { pivot: [p[0], p[1]], member: s.member };
    }
  }
  if (!best) return null;
  // cluster = the pivot + all its hand/foot sub-points within a radius (drops
  // stray low-confidence outliers, like pose_qa's _near)
  const R2 = 60 * 60;
  const xs = [best.pivot[0]];
  const ys = [best.pivot[1]];
  for (const [name, p] of Object.entries(joints)) {
    if (!best.member(name) || p[2] < 0.3) continue;
    if ((p[0] - best.pivot[0]) ** 2 + (p[1] - best.pivot[1]) ** 2 <= R2) {
      xs.push(p[0]);
      ys.push(p[1]);
    }
  }
  const x0 = Math.min(...xs) - pad;
  const x1 = Math.max(...xs) + pad;
  const y0 = Math.min(...ys) - pad;
  const y1 = Math.max(...ys) + pad;
  return {
    x: Math.round(x0 - ORIGIN_CX),
    y: Math.round(y0 - ORIGIN_FEET),
    w: Math.round(x1 - x0),
    h: Math.round(y1 - y0),
  };
}
