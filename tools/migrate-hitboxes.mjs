// Sprint 27 Phase 2 — roster hitbox pass: derive each BUTTON NORMAL's hitbox
// from its active cell's baked skeleton (meta.skeletons, post-migration) and
// write it into the character JSON. A Node port of the exact math the Sprite
// Editor uses (src/ui/hitboxFromSkeleton.ts + src/render/geometry.ts
// cellBoxToHitbox), so the editors and this script produce identical boxes.
//
// Scope: the 18 button normals only (stand/crouch/air). Specials, throws and
// variants keep their hand-tuned values — they're the personality.
//
//   node tools/migrate-hitboxes.mjs [--char <id>] [--skip <id,id>] [--dry]
//
// --skip: weapon-reach fighters whose normals strike with a PROP the skeleton
// can't see (catherine's bo staff) keep their hand-tuned boxes — a fist-only
// box on a staff poke is wrong, not tighter.
import { join } from 'node:path';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ROOT } from './lib.mjs';
import { CELL_W, CELL_H, FLOOR_FRAC, ART_MARGIN } from './core/coords.mjs';

const ORIGIN_CX = CELL_W / 2;
const ORIGIN_FEET = FLOOR_FRAC * CELL_H;
const only = process.argv.includes('--char') ? process.argv[process.argv.indexOf('--char') + 1] : null;
const skip = new Set(
  process.argv.includes('--skip') ? process.argv[process.argv.indexOf('--skip') + 1].split(',') : [],
);
const dry = process.argv.includes('--dry');

const NORMALS = ['lp', 'mp', 'hp', 'lk', 'mk', 'hk'];
const strikeKind = (id) => (/k$/.test(id.replace(/^[cj]/, '')) ? 'kick' : 'punch');

/** port of src/ui/hitboxFromSkeleton.ts — cell-space box around the forward-
 *  most striking limb cluster (x from center, y up from the feet line) */
function hitboxFromSkeleton(joints, kind, pad = 22) {
  const conf = (p) => p && p[2] >= 0.3;
  const coreNames = kind === 'punch' ? ['Lsho', 'Rsho'] : ['Lhip', 'Rhip'];
  const corePts = coreNames.map((n) => joints[n]).filter(conf);
  const [cx, cy] = corePts.length
    ? [corePts.reduce((s, p) => s + p[0], 0) / corePts.length, corePts.reduce((s, p) => s + p[1], 0) / corePts.length]
    : [ORIGIN_CX, ORIGIN_FEET * 0.6];
  const sides = kind === 'punch'
    ? [
        { pivot: 'Lwri', member: (n) => n.startsWith('lhand_') },
        { pivot: 'Rwri', member: (n) => n.startsWith('rhand_') },
      ]
    : [
        { pivot: 'Lank', member: (n) => n === 'Lbigtoe' || n === 'Lsmalltoe' || n === 'Lheel' },
        { pivot: 'Rank', member: (n) => n === 'Rbigtoe' || n === 'Rsmalltoe' || n === 'Rheel' },
      ];
  let best = null;
  let bestReach = -Infinity;
  for (const s of sides) {
    const p = joints[s.pivot];
    if (!conf(p)) continue;
    const reach = p[0] - cx + 0.5 * Math.max(0, cy - p[1]);
    if (reach > bestReach) {
      bestReach = reach;
      best = { pivot: [p[0], p[1]], member: s.member };
    }
  }
  if (!best) return null;
  const R2 = 60 * 60;
  const xs = [best.pivot[0]];
  const ys = [best.pivot[1]];
  for (const [name, p] of Object.entries(joints)) {
    if (!best.member(name) || !conf(p)) continue;
    if ((p[0] - best.pivot[0]) ** 2 + (p[1] - best.pivot[1]) ** 2 <= R2) {
      xs.push(p[0]);
      ys.push(p[1]);
    }
  }
  const x0 = Math.min(...xs) - pad;
  const x1 = Math.max(...xs) + pad;
  const y0 = Math.min(...ys) - pad;
  const y1 = Math.max(...ys) + pad;
  return { x: Math.round(x0 - ORIGIN_CX), y: Math.round(y0 - ORIGIN_FEET), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
}

/** src/render/geometry.ts cellBoxToHitbox with footOffset = 0 (post-migration)
 *  and the UNSCALED JSON hurtStand (applyScale multiplies box + hurtStand by
 *  def.scale together at load, so unscaled-in → correctly-scaled live). */
const cellBoxToHitbox = (hurtStandH, b) => {
  const rs = (hurtStandH * ART_MARGIN) / CELL_H;
  return { x: Math.round(b.x * rs), y: Math.round(b.y * rs), w: Math.round(b.w * rs), h: Math.round(b.h * rs) };
};

const ids = readdirSync(join(ROOT, 'src/data/characters'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''));

for (const id of ids) {
  if (only && id !== only) continue;
  if (skip.has(id)) {
    console.log(`[${id}] skipped (weapon-reach normals stay hand-tuned)`);
    continue;
  }
  const metaPath = join(ROOT, 'public/assets/sprites', id, 'meta.json');
  if (!existsSync(metaPath)) continue;
  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  const skels = meta.skeletons ?? {};
  const jsonPath = join(ROOT, 'src/data/characters', `${id}.json`);
  const def = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  const changes = [];
  for (const prefix of ['', 'c', 'j']) {
    for (const b of NORMALS) {
      const moveId = `${prefix}${b}`;
      const move = def.moves[moveId];
      if (!move || move.hitbox == null) continue;
      const cell = prefix === 'j' ? moveId : `${moveId}-active`;
      const joints = skels[cell];
      if (!joints) continue;
      const box = hitboxFromSkeleton(joints, strikeKind(moveId));
      if (!box) continue;
      const hb = cellBoxToHitbox(def.hurtStand.h, box);
      const old = move.hitbox;
      if (hb.x === old.x && hb.y === old.y && hb.w === old.w && hb.h === old.h) continue;
      changes.push(`${moveId}: ${JSON.stringify(old)} -> ${JSON.stringify(hb)}`);
      move.hitbox = hb;
    }
  }
  if (changes.length && !dry) writeFileSync(jsonPath, JSON.stringify(def, null, 2) + '\n');
  console.log(`[${id}] ${changes.length} normals ${dry ? '(dry)' : 'updated'}`);
  for (const c of changes.slice(0, 3)) console.log('   ', c);
}
