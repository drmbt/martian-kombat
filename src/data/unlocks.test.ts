// Secret-fighter unlocks persist per browser, and still work for the session
// when storage is missing or blocked (private windows).
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('unlocks', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('persists an unlock to localStorage', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    const u = await import('./unlocks');
    expect(u.isUnlocked('kfm')).toBe(false);
    u.unlock('kfm');
    expect(u.isUnlocked('kfm')).toBe(true);
    vi.resetModules(); // a fresh page load reads it back from storage
    expect((await import('./unlocks')).isUnlocked('kfm')).toBe(true);
  });

  it('works for the session when storage throws', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    const u = await import('./unlocks');
    u.unlock('kfm');
    expect(u.isUnlocked('kfm')).toBe(true);
  });
});
