// P8.5 — generators decide by the SHIPPED file, not the gitignored raw. Judging
// by the raw made a fresh clone re-spend on art that already ships and then
// overwrite it (proven 2026-10-07: a mock studio:run clobbered Vincent's
// portrait + fatality panels).
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { shippedState } from '../../tools/lib.mjs';

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
function files(shipped: boolean, raw: boolean): { final: string; raw: string } {
  const d = mkdtempSync(join(tmpdir(), 'mk-shipped-'));
  dirs.push(d);
  const f = { final: join(d, 'final.png'), raw: join(d, 'raw.png') };
  if (shipped) writeFileSync(f.final, 'x');
  if (raw) writeFileSync(f.raw, 'x');
  return f;
}

describe('shippedState (P8.5)', () => {
  it('skips when the shipped file exists — even with NO raw (the fresh-clone case)', () => {
    const f = files(true, false);
    expect(shippedState(f.final, f.raw, false)).toBe('skip');
  });

  it('skips when both exist', () => {
    const f = files(true, true);
    expect(shippedState(f.final, f.raw, false)).toBe('skip');
  });

  it('derives locally when only the raw exists (no API call)', () => {
    const f = files(false, true);
    expect(shippedState(f.final, f.raw, false)).toBe('derive');
  });

  it('generates only when neither exists, or with --force', () => {
    const none = files(false, false);
    expect(shippedState(none.final, none.raw, false)).toBe('generate');
    const both = files(true, true);
    expect(shippedState(both.final, both.raw, true)).toBe('generate');
  });
});
