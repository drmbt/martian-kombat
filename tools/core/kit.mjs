// THE roster-standard kit grammar — the SF2-Turbo conventions every playable
// fighter carries (enforced by the schema lint in assets.audit.test.ts):
// lights chain into lights, mediums cancel into specials, specials get L/H
// variants. The Character Creator applies this to every built kit so no new
// fighter ships mechanically thinner than the roster (the ben/earl lesson);
// the CLI/auto-pilot path shares it for parity.
//
// Non-destructive: existing chains/cancel/variants are never overwritten, so
// canon-reopened kits keep their hand-tuned grammar.

export const LIGHT_CHAIN = ['lp', 'lk', 'clp', 'clk'];
export const CANCEL_MOVES = ['mp', 'mk', 'cmp', 'cmk'];

/** archetypes with no natural L/M/H axis — no variants generated */
const NO_VARIANT_ARCHETYPES = new Set(['teleport', 'mirror-teleport', 'reversal', 'reflector', 'techable-throw']);

/** default L/H variant patches for a special (M = the base values).
 *  Returns null when the archetype has no natural strength axis. */
export function variantsFor(archetypeKey, move) {
  if (NO_VARIANT_ARCHETYPES.has(archetypeKey)) return null;
  const s = typeof move.startup === 'number' ? move.startup : 10;
  const proj = move.projectile;
  if (proj && typeof proj === 'object') {
    const pd = typeof proj.damage === 'number' ? proj.damage : 50;
    const l = { startup: Math.max(4, s - 2), projectile: { damage: Math.round(pd * 0.85) } };
    const h = { startup: s + 3, projectile: { damage: Math.round(pd * 1.15) } };
    if (typeof proj.vx === 'number' && proj.vx !== 0) {
      const dir = proj.vx > 0 ? 1 : -1;
      l.projectile.vx = proj.vx - 2 * dir;
      h.projectile.vx = proj.vx + 2 * dir;
    }
    if (typeof proj.ttl === 'number') {
      l.projectile.ttl = Math.max(6, Math.round(proj.ttl * 0.8));
      h.projectile.ttl = Math.round(proj.ttl * 1.25);
    }
    return { l, h };
  }
  const dm = typeof move.damage === 'number' ? move.damage : 0;
  if (move.grab && typeof move.grab === 'object') {
    return dm > 0
      ? { l: { damage: Math.round(dm * 0.85) }, h: { damage: Math.round(dm * 1.15), startup: s + 2 } }
      : null;
  }
  if (dm <= 0) return null;
  const l = { startup: Math.max(3, s - 2), damage: Math.round(dm * 0.85) };
  const h = { startup: s + 3, damage: Math.round(dm * 1.15) };
  if (typeof move.forwardVel === 'number' && move.forwardVel > 0) {
    l.forwardVel = Math.round(move.forwardVel * 0.75 * 10) / 10;
    h.forwardVel = Math.round(move.forwardVel * 1.2 * 10) / 10;
  }
  return { l, h };
}

/**
 * Apply the grammar to an assembled kit IN PLACE (non-destructive):
 *  - lights chain into the light family
 *  - mediums gain special-cancel windows
 *  - each special gains L/H variants when its archetype has a strength axis
 * @param {Record<string, object>} moves  the kit (button normals + specials)
 * @param {{id: string, archetype: string}[]} specials  the draft specials
 */
export function applyKitGrammar(moves, specials = []) {
  for (const id of LIGHT_CHAIN) {
    const m = moves[id];
    if (m && m.chains == null) m.chains = [...LIGHT_CHAIN];
  }
  for (const id of CANCEL_MOVES) {
    const m = moves[id];
    if (m && m.cancel == null) m.cancel = true;
  }
  for (const s of specials) {
    const m = moves[s.id];
    if (!m || m.variants != null) continue;
    const v = variantsFor(s.archetype, m);
    if (v) m.variants = v;
  }
  return moves;
}
