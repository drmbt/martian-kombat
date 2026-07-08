// Type declarations for the shared kit grammar. Keep in sync with kit.mjs.
export const LIGHT_CHAIN: string[];
export const CANCEL_MOVES: string[];
export function variantsFor(
  archetypeKey: string,
  move: Record<string, unknown>,
): { l: Record<string, unknown>; h: Record<string, unknown> } | null;
export function applyKitGrammar(
  moves: Record<string, Record<string, unknown>>,
  specials?: { id: string; archetype: string }[],
): Record<string, Record<string, unknown>>;
