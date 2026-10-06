// tools/raw-sync.mjs — the private R2 mirror's pure helpers (selection,
// manifest, env, verify). Temp dirs only: no rclone, no network.
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildManifest,
  categoryOf,
  hashEntries,
  loadRawEnv,
  parseEnv,
  rcloneEnv,
  selectIgnored,
  selectTracked,
  serializeManifest,
  summarize,
  verifyEntries,
} from '../../tools/raw-sync.mjs';

const dirs: string[] = [];
const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'mk-raw-sync-'));
  dirs.push(d);
  return d;
};
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

const put = (root: string, rel: string, body: string): void => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), body);
};
const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

describe('raw-sync selection', () => {
  it('keeps ignored assets, drops junk, secrets, mugen and non-asset paths', () => {
    expect(
      selectIgnored([
        'assets/raw/creator/ben/state.json',
        'assets/raw/canonical/tao.png',
        'assets/raw/canonical/.DS_Store',
        'assets/raw/mugen/chars/kfm/kfm.def',
        'assets/raw/qa/__pycache__/x.pyc',
        'assets/raw/music/loop.asd',
        'assets/veo-clips/a.mp4',
        'assets/raw/canonical/tao.png', // duplicate
        'assets/.env.local',
        '.env',
        'node_modules/x/index.js',
      ]),
    ).toEqual(['assets/raw/canonical/tao.png', 'assets/raw/creator/ben/state.json', 'assets/veo-clips/a.mp4']);
  });

  it('tracked set = assets/ plus ROOT-level mp4s only', () => {
    expect(selectTracked(['public/demo.mp4', 'gameplay-demo.mp4', 'assets/voice-inspo/gene/a.wav', 'src/main.ts'])).toEqual([
      'assets/voice-inspo/gene/a.wav',
      'gameplay-demo.mp4',
    ]);
  });

  it('categorises by assets/raw/<dir> or assets/<dir>', () => {
    expect(categoryOf('assets/raw/creator/ben/img/00-idle-a.png')).toBe('raw/creator');
    expect(categoryOf('assets/raw/world-map.png')).toBe('raw/(files)');
    expect(categoryOf('assets/veo-clips/a.mp4')).toBe('veo-clips');
    expect(categoryOf('gameplay-demo.mp4')).toBe('root');
    expect(summarize([{ path: 'assets/raw/qa/a', bytes: 3 }, { path: 'assets/raw/qa/b', bytes: 4 }])).toEqual({
      'raw/qa': { files: 2, bytes: 7 },
    });
  });
});

describe('raw-sync manifest', () => {
  it('sorts entries by path, dedupes snapshots, ends with a newline', () => {
    const m = buildManifest({
      ignored: [
        { path: 'assets/raw/z.png', bytes: 1, sha256: 'b' },
        { path: 'assets/raw/a.png', bytes: 2, sha256: 'a' },
      ],
      snapshots: ['snapshots/x/', 'snapshots/x/'],
      generatedAt: '2026-10-04T00:00:00.000Z',
      sourceHost: 'host',
    });
    expect(m.ignored.map((e) => e.path)).toEqual(['assets/raw/a.png', 'assets/raw/z.png']);
    expect(m).toMatchObject({ version: 1, bucket: 'martiankombat-raw', prefix: 'repo/', snapshots: ['snapshots/x/'] });
    expect(m.trackedMirrored).toEqual({ files: 0, bytes: 0 });
    const text = serializeManifest(m);
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toContain('\n  "version": 1,');
  });

  it('hashes present files and verifies OK / missing / mismatched / skipped jobs', async () => {
    const root = tmp();
    put(root, 'assets/raw/canonical/tao.png', 'tao');
    put(root, 'assets/raw/qa/rj/report.json', '{}');
    const entries = await hashEntries(root, ['assets/raw/canonical/tao.png', 'assets/raw/qa/rj/report.json', 'assets/raw/gone.png']);
    expect(entries).toEqual([
      { path: 'assets/raw/canonical/tao.png', bytes: 3, sha256: sha('tao') },
      { path: 'assets/raw/qa/rj/report.json', bytes: 2, sha256: sha('{}') },
    ]);
    put(root, 'assets/raw/qa/rj/report.json', '{"x":1}'); // drifted after the manifest
    const manifest = [
      ...entries,
      { path: 'assets/raw/stages/salton.png', bytes: 1, sha256: sha('s') },
      { path: 'assets/raw/jobs/q.json', bytes: 1, sha256: sha('j') },
    ];
    const r = await verifyEntries(root, manifest);
    expect(r).toEqual({
      ok: 1,
      missing: ['assets/raw/stages/salton.png'],
      mismatched: ['assets/raw/qa/rj/report.json'],
      skipped: ['assets/raw/jobs/q.json'],
    });
    expect((await verifyEntries(root, manifest, { includeJobs: true })).missing).toContain('assets/raw/jobs/q.json');
  });
});

describe('raw-sync env', () => {
  it('parses .env lines: quotes, export, inline comments', () => {
    expect(
      parseEnv(['# c', 'export A="x y"', "B='q#1'", 'C=plain   # note', 'D=', 'bad line'].join('\n')),
    ).toEqual({ A: 'x y', B: 'q#1', C: 'plain', D: '' });
  });

  it('tolerates a missing .env and lets the real environment win', () => {
    const root = tmp();
    expect(loadRawEnv(root, { R2_RAW_BUCKET: 'b' }).R2_RAW_BUCKET).toBe('b');
    writeFileSync(join(root, '.env'), 'R2_RAW_BUCKET=file\nR2_ENDPOINT=e\n');
    const env = loadRawEnv(root, { R2_RAW_BUCKET: 'real', R2_ENDPOINT: '' });
    expect(env.R2_RAW_BUCKET).toBe('real');
    expect(env.R2_ENDPOINT).toBe('e'); // an empty real var doesn't blank the file's value
  });

  it('builds the mkraw remote env and names (never prints) missing keys', () => {
    expect(() => rcloneEnv({ R2_ACCESS_KEY_ID: 'k' })).toThrow(/R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_RAW_BUCKET/);
    const env = rcloneEnv({ R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's', R2_ENDPOINT: 'https://x', R2_RAW_BUCKET: 'b' });
    expect(env).toMatchObject({
      RCLONE_CONFIG_MKRAW_TYPE: 's3',
      RCLONE_CONFIG_MKRAW_PROVIDER: 'Cloudflare',
      RCLONE_CONFIG_MKRAW_ACL: 'private',
      RCLONE_CONFIG_MKRAW_NO_CHECK_BUCKET: 'true',
      RCLONE_CONFIG_MKRAW_ENDPOINT: 'https://x',
    });
  });
});
