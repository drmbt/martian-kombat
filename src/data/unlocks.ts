// Secret-fighter unlocks (roster `secret: true`). Remembered per browser —
// a convenience, not shared state: online, the select screen also sends an
// `unlock` message so BOTH players' grids open the moment either one unlocks.
// Storage can be missing/blocked (private windows) — it then lasts the session.
const KEY = 'mk-unlocks';
const session = new Set<string>();

function stored(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function isUnlocked(id: string): boolean {
  return session.has(id) || stored().includes(id);
}

export function unlock(id: string): void {
  session.add(id);
  try {
    const ids = stored();
    if (!ids.includes(id)) localStorage.setItem(KEY, JSON.stringify([...ids, id]));
  } catch {
    /* storage blocked — the session set still holds it */
  }
}
