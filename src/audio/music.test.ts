import { describe, expect, it } from 'vitest';
import { pickTrack, type MusicManifest } from './music';

const m: MusicManifest = {
  menu: ['theme.mp3'],
  'stages/mars': ['a.mp3', 'b.mp3', 'c.mp3'],
  'stages/default': ['fallback.mp3'],
};

describe('pickTrack', () => {
  it('picks from the first context that has tracks', () => {
    expect(pickTrack(m, ['menu'], () => 0)).toEqual({ ctx: 'menu', file: 'theme.mp3' });
  });

  it('falls through missing/empty contexts to the next in the chain', () => {
    expect(pickTrack({ ...m, select: [] }, ['select', 'menu'], () => 0)).toEqual({
      ctx: 'menu',
      file: 'theme.mp3',
    });
    expect(pickTrack(m, ['stages/neptune', 'stages/default'], () => 0)).toEqual({
      ctx: 'stages/default',
      file: 'fallback.mp3',
    });
  });

  it('returns null when nothing in the chain has tracks', () => {
    expect(pickTrack(m, ['victory'], () => 0)).toBeNull();
    expect(pickTrack({}, ['menu'], () => 0)).toBeNull();
  });

  it('selects randomly across a multi-track folder', () => {
    expect(pickTrack(m, ['stages/mars'], () => 0)?.file).toBe('a.mp3');
    expect(pickTrack(m, ['stages/mars'], () => 0.5)?.file).toBe('b.mp3');
    expect(pickTrack(m, ['stages/mars'], () => 0.99)?.file).toBe('c.mp3');
  });

  it('avoids repeating the just-finished track when rotating', () => {
    for (const r of [0, 0.5, 0.99]) {
      expect(pickTrack(m, ['stages/mars'], () => r, 'b.mp3')?.file).not.toBe('b.mp3');
    }
    // single-track folders can't avoid — still return the one track
    expect(pickTrack(m, ['menu'], () => 0, 'theme.mp3')?.file).toBe('theme.mp3');
  });
});
