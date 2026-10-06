// SFF v2 pixel decoding. The MUGEN files are third-party and gitignored
// (npm run mugen:fetch), so this skips where they're absent.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findSprite, readSffV2, spriteRgba } from './sff';

const SFF = 'assets/raw/mugen/chars/kfm720/kfm720.sff';

describe.skipIf(!existsSync(SFF))('SFF v2 decoder (kfm720)', () => {
  const sff = readSffV2(new Uint8Array(readFileSync(SFF)));
  it('decodes every sprite to its declared size', () => {
    for (let i = 0; i < sff.sprites.length; i++) {
      const s = spriteRgba(sff, i);
      expect(s.rgba.length).toBe(s.width * s.height * 4);
    }
  });
  it('palette index 0 is transparent, the body is opaque', () => {
    const s = spriteRgba(sff, findSprite(sff, 0, 0)); // idle
    expect(s.rgba[3]).toBe(0); // top-left corner: background
    let opaque = 0;
    for (let p = 3; p < s.rgba.length; p += 4) if (s.rgba[p] === 255) opaque++;
    expect(opaque / (s.width * s.height)).toBeGreaterThan(0.2);
  });
});
