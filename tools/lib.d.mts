// Types for the parts of tools/lib.mjs that TypeScript (vitest) imports.
export function withBackoff<T>(
  fn: () => Promise<T>,
  opts?: { tries?: number; baseMs?: number; label?: string },
): Promise<T>;
