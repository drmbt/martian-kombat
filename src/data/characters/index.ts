// Character registry. Characters are pure data — adding one means adding a
// JSON file here and registering it, never touching engine code.
// (JSON imports widen string literals, hence the cast; runtime schema
// validation is an Icebox item.)
import type { Box, CharacterDef, Defs, MoveDef } from '../../engine';
import vincent from './vincent.json';
import yulia from './yulia.json';
import catherine from './catherine.json';
import kirby from './kirby.json';
import flo from './flo.json';
import freeman from './freeman.json';
import marzipan from './marzipan.json';
import gene from './gene.json';
import bodhi from './bodhi.json';
import cat from './cat.json';
import chebel from './chebel.json';
import ygor from './ygor.json';

const scaleBox = (b: Box, s: number): Box => ({
  x: Math.round(b.x * s),
  y: Math.round(b.y * s),
  w: Math.round(b.w * s),
  h: Math.round(b.h * s),
});

// Bake an optional spriteScale into the character's collision geometry so the
// engine (and everything deriving sizes from it, like the renderer's sprite
// height) sees one consistent set of pre-scaled boxes. Speeds, velocities,
// projectiles, and grab ranges are left alone — scale changes your silhouette
// and reach, not your movement.
function applySpriteScale(def: CharacterDef): CharacterDef {
  const s = def.spriteScale ?? 1;
  if (s === 1) return def;
  const moves: Record<string, MoveDef> = {};
  for (const [id, move] of Object.entries(def.moves)) {
    const variants = move.variants
      ? Object.fromEntries(
          Object.entries(move.variants).map(([k, v]) => [
            k,
            v?.hitbox ? { ...v, hitbox: scaleBox(v.hitbox, s) } : v,
          ]),
        )
      : undefined;
    moves[id] = {
      ...move,
      hitbox: move.hitbox ? scaleBox(move.hitbox, s) : move.hitbox,
      ...(variants ? { variants } : {}),
    };
  }
  return {
    ...def,
    bodyBox: scaleBox(def.bodyBox, s),
    hurtStand: scaleBox(def.hurtStand, s),
    hurtCrouch: scaleBox(def.hurtCrouch, s),
    moves,
  };
}

export const characters: Defs = {
  vincent: applySpriteScale(vincent as unknown as CharacterDef),
  yulia: applySpriteScale(yulia as unknown as CharacterDef),
  catherine: applySpriteScale(catherine as unknown as CharacterDef),
  kirby: applySpriteScale(kirby as unknown as CharacterDef),
  flo: applySpriteScale(flo as unknown as CharacterDef),
  freeman: applySpriteScale(freeman as unknown as CharacterDef),
  marzipan: applySpriteScale(marzipan as unknown as CharacterDef),
  gene: applySpriteScale(gene as unknown as CharacterDef),
  bodhi: applySpriteScale(bodhi as unknown as CharacterDef),
  cat: applySpriteScale(cat as unknown as CharacterDef),
  chebel: applySpriteScale(chebel as unknown as CharacterDef),
  ygor: applySpriteScale(ygor as unknown as CharacterDef),
};
