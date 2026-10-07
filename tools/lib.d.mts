// Types for the parts of tools/lib.mjs that TypeScript (vitest) imports.
export function withBackoff<T>(
  fn: () => Promise<T>,
  opts?: { tries?: number; baseMs?: number; label?: string },
): Promise<T>;

/** `.env` (or MK_ENV_FILE) merged under real env vars; a missing file is fine */
export function loadEnv(path?: string): Record<string, string>;
/** true when MK_GEN_MOCK=1 or MK_CREATOR_MOCK=1 — providers return placeholders */
export function genMock(): boolean;
