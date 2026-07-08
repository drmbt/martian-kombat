// THE shared sprite-sheet cell contract + generic pose library — moved out of
// tools/frames-manifest.mjs so the Character Creator (browser), the vite
// middleware, and the CLI gen scripts all read ONE copy. frames-manifest
// re-exports everything here, so existing importers are unchanged.
//
// Cell order is a CONTRACT with the renderer (FightScene actionToCell) —
// never reorder, only append. Pose strings carry the accumulated prompt
// lessons (idle-flicker pins, exaggerated walk strides, LOW/LYING geometric
// constraints) — see the sprite-generation skill for the craft behind them.
export { CELL_W, CELL_H } from './coords.mjs';
export const COLS = 6;
export const ROWS = 4;

// Geometric constraint beats pose adjectives for low stances: give the model
// a composition rule it can verify, not anatomy words it can fudge.
export const LOW =
  'squatting EXTREMELY low with knees fully folded and hips at heel height — the entire figure occupies ONLY the BOTTOM HALF of the frame, nothing but empty green in the top half';
export const LYING =
  'lying completely FLAT on their back on the ground — the entire figure is a HORIZONTAL shape stretched along the BOTTOM QUARTER of the frame, nothing but empty green in the top three quarters';

/** Shared generic cells 0..10 — the merged best-of-both pose library (the
 *  battle-hardened frames-manifest strings + the creator's anti-flicker /
 *  walk-cycle pins from the Chebel and walk-equals-idle lessons). */
export const CELLS = [
  { id: 'idle-a', pose: 'relaxed fighting idle, hands up in guard, weight settled on the back foot, BOTH feet flat on the ground. NOT an attack — no raised knee, kick or lunge.' },
  { id: 'idle-b', pose: 'the SAME calm grounded fighting idle, chest slightly risen mid-breath, hands drifted a few centimeters, BOTH feet flat on the ground. NOT an attack — no raised knee, kick or lunge.' },
  { id: 'walk-a', pose: 'walking forward mid-stride: the LEFT leg lifted and striding FORWARD with a bent knee, the RIGHT leg trailing BEHIND, weight shifting onto the front foot, guard up, arms in opposition. A clear exaggerated walk-cycle step — NOT a neutral standing pose.' },
  { id: 'walk-b', pose: 'walking forward, the OPPOSITE stride: the RIGHT leg lifted and striding FORWARD with a bent knee, the LEFT leg trailing BEHIND, opposite arm swing, guard up. Legs clearly in a DIFFERENT position from the first walk frame.' },
  { id: 'crouch', pose: `crouching down on deeply bent knees, buttocks near the heels, body compact, guard tight to the chin — NOT standing, ${LOW}` },
  { id: 'jump', pose: 'airborne mid-jump, knees tucked up, arms balanced, the whole figure lifted off the ground' },
  { id: 'block', pose: 'standing block, forearms crossed high in front of the face, braced backward. NOT an attack.' },
  { id: 'block-crouch', pose: `blocking while crouched, forearms shielding the face, curled compact — NOT standing, NOT an attack, ${LOW}` },
  { id: 'hit', pose: 'reeling from a hit, head snapped back, torso twisted off balance, grimace. NOT an attack, NOT a block.' },
  { id: 'fall', pose: 'launched backwards through the air, body horizontal, limbs flailing' },
  { id: 'down', pose: `knocked out COLD, head to one side, limbs sprawled — NOT standing, NOT sitting, ${LYING}` },
];

export const MOVES = ['light', 'heavy', 'sweep', 'special'];

// ---- v2 sheet layout: six buttons × stand/crouch/air ----
// stand moves get 3 cells (startup/active/recovery), crouch moves 2
// (active/recovery), air moves 1. Cell names are looked up from meta.json by
// the renderer, with fallbacks for legacy 23-cell sheets.
export const V2_BUTTONS = ['lp', 'mp', 'hp', 'lk', 'mk', 'hk'];

/** Ordered generation/pack job list for a character spec. */
export function buildJobs(spec) {
  // A character may override any shared generic-cell pose via spec.cells
  // (e.g. to stop an idle-loop from flickering or pin a fall direction) —
  // named specials/normals still come from moves6.
  const jobs = CELLS.map((c) => ({ id: c.id, pose: spec.cells?.[c.id] ?? c.pose }));
  if (spec.layout === 'v2') {
    for (const b of V2_BUTTONS) {
      for (const phase of ['startup', 'active', 'recovery']) {
        jobs.push({ id: `${b}-${phase}`, pose: spec.moves6.stand[b][phase] });
      }
    }
    for (const b of V2_BUTTONS) {
      for (const phase of ['active', 'recovery']) {
        jobs.push({ id: `c${b}-${phase}`, pose: `${spec.moves6.crouch[b][phase]}, ${LOW}` });
      }
    }
    for (const b of V2_BUTTONS) {
      jobs.push({ id: `j${b}`, pose: `airborne mid-jump, ${spec.moves6.air[b]}` });
    }
    // named specials, in declaration order (cells: <special-id>-<phase>)
    for (const [sid, phases] of Object.entries(spec.moves6.specials)) {
      for (const phase of ['startup', 'active', 'recovery']) {
        jobs.push({ id: `${sid}-${phase}`, pose: phases[phase] });
      }
    }
  } else {
    for (const move of MOVES) {
      for (const phase of ['startup', 'active', 'recovery']) {
        jobs.push({ id: `${move}-${phase}`, pose: spec.moves[move][phase] });
      }
    }
  }
  return jobs;
}

export function gridFor(spec) {
  const n = buildJobs(spec).length;
  const cols = spec.layout === 'v2' ? 8 : COLS;
  return { cols, rows: Math.ceil(n / cols) };
}
