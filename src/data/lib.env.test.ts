// P2.9 — tools/lib.mjs loadEnv must tolerate a missing .env (mock mode and
// local-only tools need zero setup), let real env vars win, strip quotes.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { genMock, loadEnv } from '../../tools/lib.mjs';

const dirs: string[] = [];
const saved: Record<string, string | undefined> = {};
const setEnv = (k: string, v: string | undefined): void => {
  if (!(k in saved)) saved[k] = process.env[k];
  if (v === undefined) delete process.env[k];
  else process.env[k] = v;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
    delete saved[k];
  }
});
const envFile = (text: string): string => {
  const d = mkdtempSync(join(tmpdir(), 'mk-env-'));
  dirs.push(d);
  const p = join(d, '.env');
  writeFileSync(p, text);
  return p;
};

describe('loadEnv', () => {
  it('returns real env vars (no throw) when the file is missing', () => {
    setEnv('MK_TEST_ONLY_IN_ENV', 'yes');
    const env = loadEnv(join(tmpdir(), 'mk-definitely-missing', '.env'));
    expect(env.MK_TEST_ONLY_IN_ENV).toBe('yes');
  });

  it('parses quotes, export prefixes, CRLF and trailing comments', () => {
    const p = envFile('A="double quoted"\r\nexport B=\'single\'\nC=plain # note\nD=has#hash\n# comment\nlower=x\n');
    const env = loadEnv(p);
    expect(env.A).toBe('double quoted');
    expect(env.B).toBe('single');
    expect(env.C).toBe('plain');
    expect(env.D).toBe('has#hash');
    expect(env.lower).toBeUndefined();
  });

  it('lets a real environment variable win over the file', () => {
    const p = envFile('MK_TEST_WIN=from-file\nMK_TEST_FILE_ONLY=kept\n');
    setEnv('MK_TEST_WIN', 'from-env');
    const env = loadEnv(p);
    expect(env.MK_TEST_WIN).toBe('from-env');
    expect(env.MK_TEST_FILE_ONLY).toBe('kept');
  });
});

describe('genMock', () => {
  it('treats MK_CREATOR_MOCK and MK_GEN_MOCK as the same switch', () => {
    setEnv('MK_GEN_MOCK', undefined);
    setEnv('MK_CREATOR_MOCK', undefined);
    expect(genMock()).toBe(false);
    setEnv('MK_CREATOR_MOCK', '1');
    expect(genMock()).toBe(true);
    setEnv('MK_CREATOR_MOCK', undefined);
    setEnv('MK_GEN_MOCK', '1');
    expect(genMock()).toBe(true);
  });
});
