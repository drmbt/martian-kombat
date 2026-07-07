// Shared move-JSON write-back helper for the dev editors (MoveTunerPanel +
// SpriteEditorPanel). The live `characters` registry is scale-baked (applyScale
// in src/data/characterScale.ts). Un-bake by the same factor before persisting
// to src/data/characters/<id>.json, or geometry compounds larger every WRITE.
// The top-level `scale` is written alongside; hurtStand/bodyBox stay base in the
// JSON (untouched), so reload reproduces the runtime state exactly.
import type { CharacterDef, MoveDef } from '../engine';
import { scaleGeometry } from '../data/characterScale';

export function unscaledMoves(def: CharacterDef): Record<string, MoveDef> {
  const s = def.scale ?? 1;
  return s === 1 ? def.moves : scaleGeometry(def, 1 / s).moves;
}

/** POST the character's (unscaled) moves + scale to the dev-editor endpoint. */
export async function writeCharacterMoves(def: CharacterDef): Promise<number> {
  const res = await fetch('/__editor/character', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: def.id, moves: unscaledMoves(def), scale: def.scale }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { ok?: boolean; moveCount?: number };
  return json.moveCount ?? 0;
}
