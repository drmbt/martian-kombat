// Character scale — ONE uniform multiplier that resizes everything about a
// fighter's size + reach (art, hurtboxes, hitboxes, projectiles, grab range)
// about the feet origin. Movement (speeds/velocities) is intentionally NOT
// scaled — scale changes how big/far-reaching a character is, not how fast.
//
// `applyScale` bakes `def.scale` into the geometry once at load
// (src/data/characters/index.ts). `setCharacterScale` re-bakes live for the dev
// editors, mutating the shared characters[id] so the renderer/engine pick it up
// next frame/tick. The renderer derives sprite size from hurtStand.h, so the art
// resizes for free.
import type { Box, CharacterDef, MoveDef, ProjectileDef, VariantPatch } from '../engine';

export const scaleBox = (b: Box, s: number): Box => ({
  x: Math.round(b.x * s),
  y: Math.round(b.y * s),
  w: Math.round(b.w * s),
  h: Math.round(b.h * s),
});

function scaleProjectile(p: ProjectileDef, s: number): ProjectileDef {
  return {
    ...p,
    box: scaleBox(p.box, s),
    spawnX: Math.round(p.spawnX * s),
    spawnY: Math.round(p.spawnY * s),
    ...(p.renderSize != null ? { renderSize: Math.round(p.renderSize * s) } : {}),
    ...(p.detonate ? { detonate: { ...p.detonate, box: scaleBox(p.detonate.box, s) } } : {}),
  };
}

function scaleVariant(v: VariantPatch, s: number): VariantPatch {
  return {
    ...v,
    ...(v.hitbox ? { hitbox: scaleBox(v.hitbox, s) } : {}),
    ...(v.grab ? { grab: { range: Math.round(v.grab.range * s) } } : {}),
    ...(v.projectile ? { projectile: { ...v.projectile, ...(v.projectile.box ? { box: scaleBox(v.projectile.box, s) } : {}) } } : {}),
  };
}

function scaleMove(move: MoveDef, s: number): MoveDef {
  const variants = move.variants
    ? Object.fromEntries(Object.entries(move.variants).map(([k, v]) => [k, v ? scaleVariant(v, s) : v]))
    : undefined;
  return {
    ...move,
    ...(move.hitbox ? { hitbox: scaleBox(move.hitbox, s) } : {}),
    ...(move.projectile ? { projectile: scaleProjectile(move.projectile, s) } : {}),
    ...(move.grab ? { grab: { range: Math.round(move.grab.range * s) } } : {}),
    ...(variants ? { variants } : {}),
  };
}

/** Return a copy of `def` with all size/reach geometry multiplied by `s`. */
export function scaleGeometry(def: CharacterDef, s: number): CharacterDef {
  const moves: Record<string, MoveDef> = {};
  for (const [id, move] of Object.entries(def.moves)) moves[id] = scaleMove(move, s);
  return {
    ...def,
    bodyBox: scaleBox(def.bodyBox, s),
    hurtStand: scaleBox(def.hurtStand, s),
    hurtCrouch: scaleBox(def.hurtCrouch, s),
    moves,
  };
}

/** Load-time: bake `def.scale` into the geometry (no-op at scale 1). */
export function applyScale(def: CharacterDef): CharacterDef {
  const s = def.scale ?? 1;
  return s === 1 ? def : scaleGeometry(def, s);
}

// Each character's UNSCALED base geometry, snapshotted the first time it's
// live-edited so repeated scale changes never accumulate rounding drift.
const baseCache = new Map<string, CharacterDef>();

function baseOf(def: CharacterDef): CharacterDef {
  let base = baseCache.get(def.id);
  if (!base) {
    const cur = def.scale ?? 1;
    base = cur === 1 ? structuredClone(def) : scaleGeometry(structuredClone(def), 1 / cur);
    baseCache.set(def.id, base);
  }
  return base;
}

/** Bake-down: after flattening a character's scale into its geometry (def.scale
 *  reset to 1 with the scaled boxes kept), drop the cached UNSCALED base so the
 *  next live scale edit re-snapshots from the new identity geometry. */
export function resetScaleBase(def: CharacterDef): void {
  baseCache.delete(def.id);
}

/** Dev editor: set a character's scale and re-bake its geometry from the cached
 *  base, mutating the existing box objects IN PLACE so the live `characters[id]`
 *  (read by renderer + engine) resizes immediately AND any UI sliders that
 *  captured those box references stay wired. */
export function setCharacterScale(def: CharacterDef, newScale: number): void {
  const scaled = scaleGeometry(baseOf(def), newScale);
  def.scale = newScale;
  Object.assign(def.bodyBox, scaled.bodyBox);
  Object.assign(def.hurtStand, scaled.hurtStand);
  Object.assign(def.hurtCrouch, scaled.hurtCrouch);
  for (const [id, sm] of Object.entries(scaled.moves)) {
    const m = def.moves[id];
    if (!m) continue;
    if (m.hitbox && sm.hitbox) Object.assign(m.hitbox, sm.hitbox);
    if (m.projectile && sm.projectile) {
      Object.assign(m.projectile.box, sm.projectile.box);
      m.projectile.spawnX = sm.projectile.spawnX;
      m.projectile.spawnY = sm.projectile.spawnY;
      if (m.projectile.detonate && sm.projectile.detonate) Object.assign(m.projectile.detonate.box, sm.projectile.detonate.box);
    }
    if (m.grab && sm.grab) m.grab.range = sm.grab.range;
    if (m.variants && sm.variants) {
      for (const k of ['l', 'm', 'h'] as const) {
        const mv = m.variants[k];
        const sv = sm.variants[k];
        if (mv?.hitbox && sv?.hitbox) Object.assign(mv.hitbox, sv.hitbox);
        if (mv?.grab && sv?.grab) mv.grab.range = sv.grab.range;
      }
    }
  }
}
