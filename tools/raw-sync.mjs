// raw-sync — the PRIVATE R2 mirror for the half of assets/ that git ignores.
//
// assets/raw/* is mostly gitignored regen output (creator drafts, QA reports,
// sprite-editor backups, keyed frames, fatality/vfx raws …) — paid generations
// that exist on exactly one disk. This mirrors them to the private bucket
// R2_RAW_BUCKET (martiankombat-raw) under `repo/<repo-relative path>` and keeps
// a committed index, assets/raw-store.manifest.json (path + bytes + sha256),
// so a fresh clone can `raw:pull` + `raw:verify` its way back to parity.
//
//   node tools/raw-sync.mjs manifest              hash the ignored set → manifest
//   node tools/raw-sync.mjs push [--tracked]      upload (never deletes), then manifest
//   node tools/raw-sync.mjs snapshot <name>       server-side copy → snapshots/<name>/
//   node tools/raw-sync.mjs pull [--include-jobs] [--overwrite]   restore, then verify
//   node tools/raw-sync.mjs verify [--remote]     re-hash local files vs the manifest
//   node tools/raw-sync.mjs status                files/bytes per category, local vs manifest
//
// Transport is rclone, configured ONLY through the child process env
// (RCLONE_CONFIG_MKRAW_*) — no rclone.conf, and secrets are never printed.
// Uploads are `rclone copy` (never sync, never --delete-*). `pull` skips
// assets/raw/jobs/ unless --include-jobs: the Studio job runner auto-resumes
// queued PAID jobs at dev-server start. assets/raw/mugen/ (third-party,
// CC BY-NC, `npm run mugen:fetch`) is never mirrored. See docs/RAW_ASSET_STORE.md.
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const MANIFEST_PATH = 'assets/raw-store.manifest.json';
export const DEFAULT_BUCKET = 'martiankombat-raw';
export const PREFIX = 'repo/';
export const REMOTE = 'mkraw';
export const JOBS_PREFIX = 'assets/raw/jobs/';
export const R2_ENV_NAMES = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ENDPOINT', 'R2_RAW_BUCKET'];

// OS/tool junk that is never worth mirroring, wherever it sits
const JUNK = [/(^|\/)node_modules\//, /(^|\/)dist\//, /(^|\/)\.vite\//, /(^|\/)__pycache__\//, /\.pyc$/, /\.asd$/, /(^|\/)\.DS_Store$/];
// third-party reference content — re-fetchable, licence forbids redistribution
const EXCLUDED_PREFIXES = ['assets/raw/mugen/'];
const SECRET = /(^|\/)\.env($|\.)/;

export const isJunk = (p) => JUNK.some((re) => re.test(p));
const keep = (p) => !isJunk(p) && !SECRET.test(p) && !EXCLUDED_PREFIXES.some((x) => p.startsWith(x));
const byPath = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const uniqSorted = (xs) => [...new Set(xs)].sort(byPath);

/** The gitignored files under assets/ worth keeping (input: `git ls-files --others --ignored`). */
export function selectIgnored(paths) {
  return uniqSorted(paths.filter((p) => p.startsWith('assets/') && keep(p)));
}

/** Tracked heavy media mirrored as backup: everything under assets/ + root-level *.mp4. */
export function selectTracked(paths) {
  return uniqSorted(paths.filter((p) => (p.startsWith('assets/') || (!p.includes('/') && p.endsWith('.mp4'))) && keep(p)));
}

/** Report bucket: `raw/<dir>` under assets/raw, `<dir>` elsewhere in assets/, `root` for root files. */
export function categoryOf(p) {
  const parts = p.split('/');
  if (parts[0] !== 'assets') return 'root';
  if (parts[1] === 'raw') return parts.length > 3 ? `raw/${parts[2]}` : 'raw/(files)';
  return parts.length > 2 ? parts[1] : '(files)';
}

/** {category: {files, bytes}} over [{path, bytes}], keys sorted. */
export function summarize(entries) {
  const out = {};
  for (const e of entries) {
    const c = categoryOf(e.path);
    out[c] ??= { files: 0, bytes: 0 };
    out[c].files++;
    out[c].bytes += e.bytes;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => byPath(a, b)));
}

/** The committed index. Entries sorted by path so diffs stay reviewable. */
export function buildManifest({ ignored, trackedMirrored, snapshots = [], bucket = DEFAULT_BUCKET, generatedAt, sourceHost }) {
  return {
    version: 1,
    bucket,
    prefix: PREFIX,
    generatedAt,
    sourceHost,
    ignored: [...ignored]
      .sort((a, b) => byPath(a.path, b.path))
      .map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
    trackedMirrored: trackedMirrored ?? { files: 0, bytes: 0 },
    snapshots: uniqSorted(snapshots),
  };
}

export const serializeManifest = (m) => JSON.stringify(m, null, 2) + '\n';

/** Parse a .env body: comments, `export ` prefixes, surrounding quotes, unquoted inline `# …`. */
export function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    const q = v[0];
    if ((q === '"' || q === "'") && v.lastIndexOf(q) > 0) v = v.slice(1, v.lastIndexOf(q));
    else v = v.replace(/\s+#.*$/, '').trim();
    out[m[1]] = v;
  }
  return out;
}

/** .env (a missing file is fine) overlaid by the real environment, which wins. */
export function loadRawEnv(root = ROOT, env = process.env) {
  const file = join(root, '.env');
  const fromFile = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
  return { ...fromFile, ...Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== '')) };
}

/** rclone remote `mkraw:` as child-process env. Throws (naming only the variables) when any is empty. */
export function rcloneEnv(env) {
  const missing = R2_ENV_NAMES.filter((k) => !env[k]);
  if (missing.length) throw new Error(`raw-sync: set ${missing.join(', ')} in .env (see .env.example)`);
  return {
    RCLONE_CONFIG_MKRAW_TYPE: 's3',
    RCLONE_CONFIG_MKRAW_PROVIDER: 'Cloudflare',
    RCLONE_CONFIG_MKRAW_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
    RCLONE_CONFIG_MKRAW_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
    RCLONE_CONFIG_MKRAW_ENDPOINT: env.R2_ENDPOINT,
    RCLONE_CONFIG_MKRAW_ACL: 'private',
    RCLONE_CONFIG_MKRAW_NO_CHECK_BUCKET: 'true',
  };
}

export function sha256File(abs) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(abs)
      .on('data', (d) => h.update(d))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')));
  });
}

async function mapPool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

/** [{path, bytes, sha256}] for repo-relative paths that exist under root. */
export async function hashEntries(root, paths, concurrency = 8) {
  const present = paths.filter((p) => existsSync(join(root, p)));
  return mapPool(present, concurrency, async (path) => {
    const abs = join(root, path);
    return { path, bytes: statSync(abs).size, sha256: await sha256File(abs) };
  });
}

/** Re-hash manifest entries under root → {ok, missing[], mismatched[], skipped[]}.
 *  Absent job files count as `skipped`, not missing — pull leaves them out by
 *  design — unless includeJobs. Present ones are always verified. */
export async function verifyEntries(root, entries, { includeJobs = false } = {}) {
  const res = { ok: 0, missing: [], mismatched: [], skipped: [] };
  await mapPool(entries, 8, async (e) => {
    const abs = join(root, e.path);
    if (!existsSync(abs)) return (!includeJobs && e.path.startsWith(JOBS_PREFIX) ? res.skipped : res.missing).push(e.path);
    if (statSync(abs).size !== e.bytes || (await sha256File(abs)) !== e.sha256) return res.mismatched.push(e.path);
    res.ok++;
  });
  for (const k of ['missing', 'mismatched', 'skipped']) res[k].sort(byPath);
  return res;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const gitList = (args) =>
  execFileSync('git', args, { cwd: ROOT, maxBuffer: 1 << 28 })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
const listIgnored = () => selectIgnored(gitList(['ls-files', '--others', '--ignored', '--exclude-standard', '-z', '--', 'assets']));
const listTracked = () =>
  selectTracked([...gitList(['ls-files', '-z', '--', 'assets']), ...gitList(['ls-files', '-z', '--', '*.mp4'])]).filter((p) =>
    existsSync(join(ROOT, p)),
  );

const fmtMB = (b) => `${(b / 1048576).toFixed(1)} MB`;
const readManifest = () => {
  const p = join(ROOT, MANIFEST_PATH);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
};

function printSummary(title, entries) {
  const s = summarize(entries);
  console.log(title);
  for (const [k, v] of Object.entries(s)) console.log(`  ${k.padEnd(28)} ${String(v.files).padStart(6)}  ${fmtMB(v.bytes).padStart(10)}`);
  const tot = entries.reduce((a, e) => a + e.bytes, 0);
  console.log(`  ${'TOTAL'.padEnd(28)} ${String(entries.length).padStart(6)}  ${fmtMB(tot).padStart(10)}`);
}

async function writeManifest({ trackedMirrored, addSnapshot } = {}) {
  const prev = readManifest();
  const env = loadRawEnv();
  const ignored = await hashEntries(ROOT, listIgnored());
  const m = buildManifest({
    ignored,
    trackedMirrored: trackedMirrored ?? prev?.trackedMirrored,
    snapshots: [...(prev?.snapshots ?? []), ...(addSnapshot ? [addSnapshot] : [])],
    bucket: env.R2_RAW_BUCKET || prev?.bucket || DEFAULT_BUCKET,
    generatedAt: new Date().toISOString(),
    sourceHost: hostname(),
  });
  writeFileSync(join(ROOT, MANIFEST_PATH), serializeManifest(m));
  printSummary(`manifest → ${MANIFEST_PATH}`, m.ignored);
  return m;
}

function requireRclone() {
  try {
    execFileSync('rclone', ['version'], { stdio: 'ignore' });
  } catch {
    throw new Error('raw-sync: rclone not found — install it (macOS: brew install rclone)');
  }
}

/** Run rclone against `mkraw:` with `paths` as a --files-from-raw list. Exit code is returned, never thrown. */
function rclone(args, paths) {
  requireRclone();
  const env = loadRawEnv();
  const childEnv = { ...process.env, ...rcloneEnv(env) };
  const dir = mkdtempSync(join(tmpdir(), 'mk-raw-sync-'));
  try {
    const extra = [];
    if (paths) {
      const list = join(dir, 'files.txt');
      writeFileSync(list, paths.join('\n') + '\n');
      extra.push('--files-from-raw', list);
    }
    const r = spawnSync('rclone', [...args, ...extra], { cwd: ROOT, env: childEnv, stdio: 'inherit' });
    return r.status ?? 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const bucketOf = () => loadRawEnv().R2_RAW_BUCKET;
const STATS = ['--stats', '30s', '--stats-one-line', '--stats-log-level', 'NOTICE'];

async function push(flags) {
  const ignored = listIgnored();
  const tracked = flags.has('--tracked') ? listTracked() : [];
  const paths = uniqSorted([...ignored, ...tracked]);
  const bytes = (ps) => ps.reduce((a, p) => a + statSync(join(ROOT, p)).size, 0);
  console.log(`push: ${ignored.length} ignored (${fmtMB(bytes(ignored))}) + ${tracked.length} tracked (${fmtMB(bytes(tracked))}) → ${REMOTE}:${bucketOf()}/${PREFIX}`);
  const code = rclone(['copy', '--checksum', '--transfers', '8', '--checkers', '16', ...STATS, '.', `${REMOTE}:${bucketOf()}/${PREFIX}`], paths);
  if (code !== 0) throw new Error(`raw-sync: rclone copy failed (exit ${code}) — nothing was deleted; re-run to resume`);
  await writeManifest(tracked.length ? { trackedMirrored: { files: tracked.length, bytes: bytes(tracked) } } : {});
}

async function snapshot(name) {
  if (!name || !/^[\w.-]+$/.test(name)) throw new Error('raw-sync: snapshot needs a name ([A-Za-z0-9_.-]), e.g. 2026-10-rescue-myhost');
  const m = readManifest();
  if (!m) throw new Error(`raw-sync: no ${MANIFEST_PATH} — run push first`);
  const dest = `snapshots/${name}/`;
  console.log(`snapshot: ${m.ignored.length} files ${PREFIX} → ${dest} (server-side)`);
  const code = rclone(['copy', '--checksum', '--transfers', '16', ...STATS, `${REMOTE}:${bucketOf()}/${PREFIX}`, `${REMOTE}:${bucketOf()}/${dest}`], m.ignored.map((e) => e.path));
  if (code !== 0) throw new Error(`raw-sync: snapshot copy failed (exit ${code})`);
  m.snapshots = uniqSorted([...(m.snapshots ?? []), dest]);
  writeFileSync(join(ROOT, MANIFEST_PATH), serializeManifest(m));
  console.log(`recorded ${dest} in ${MANIFEST_PATH}`);
}

async function pull(flags) {
  const m = readManifest();
  if (!m) throw new Error(`raw-sync: no ${MANIFEST_PATH} — nothing to pull`);
  const includeJobs = flags.has('--include-jobs');
  const paths = m.ignored.map((e) => e.path).filter((p) => includeJobs || !p.startsWith(JOBS_PREFIX));
  const skipped = m.ignored.length - paths.length;
  console.log(`pull: ${paths.length} files from ${REMOTE}:${m.bucket}/${m.prefix}${skipped ? ` (${skipped} job files skipped — pass --include-jobs)` : ''}`);
  const mode = flags.has('--overwrite') ? [] : ['--ignore-existing'];
  const code = rclone(['copy', '--checksum', '--transfers', '8', ...mode, ...STATS, `${REMOTE}:${m.bucket}/${m.prefix}`, '.'], paths);
  if (code !== 0) throw new Error(`raw-sync: rclone copy failed (exit ${code}) — re-run to resume`);
  await verify(new Set(includeJobs ? ['--include-jobs'] : []));
}

async function verify(flags) {
  const m = readManifest();
  if (!m) throw new Error(`raw-sync: no ${MANIFEST_PATH}`);
  if (flags.has('--remote')) {
    // every manifest entry present remotely with a matching hash (one-way: extra remote files are fine)
    const code = rclone(['check', '--one-way', '--checksum', `${REMOTE}:${m.bucket}/${m.prefix}`, '.'], m.ignored.map((e) => e.path).filter((p) => existsSync(join(ROOT, p))));
    if (code !== 0) process.exitCode = 1;
    return;
  }
  const r = await verifyEntries(ROOT, m.ignored, { includeJobs: flags.has('--include-jobs') });
  console.log(`verify: ${r.ok} OK · ${r.missing.length} missing · ${r.mismatched.length} mismatched${r.skipped.length ? ` · ${r.skipped.length} jobs skipped` : ''}`);
  for (const p of r.missing.slice(0, 20)) console.log(`  missing     ${p}`);
  if (r.missing.length > 20) console.log(`  … ${r.missing.length - 20} more missing`);
  for (const p of r.mismatched) console.log(`  MISMATCH    ${p}`);
  if (r.mismatched.length) process.exitCode = 1;
}

function status() {
  const local = listIgnored().map((path) => ({ path, bytes: statSync(join(ROOT, path)).size }));
  printSummary('local ignored set', local);
  const m = readManifest();
  if (!m) return console.log(`(no ${MANIFEST_PATH} yet)`);
  printSummary(`manifest (${m.generatedAt} on ${m.sourceHost})`, m.ignored);
  const inManifest = new Set(m.ignored.map((e) => e.path));
  const fresh = local.filter((e) => !inManifest.has(e.path));
  console.log(`not yet in manifest: ${fresh.length} files${fresh.length ? ' — run raw:push' : ''}`);
  console.log(`tracked mirrored: ${m.trackedMirrored.files} files (${fmtMB(m.trackedMirrored.bytes)}) · snapshots: ${m.snapshots.join(', ') || 'none'}`);
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  const flags = new Set(rest.filter((a) => a.startsWith('--')));
  const args = rest.filter((a) => !a.startsWith('--'));
  if (cmd === 'manifest') await writeManifest();
  else if (cmd === 'push') await push(flags);
  else if (cmd === 'snapshot') await snapshot(args[0]);
  else if (cmd === 'pull') await pull(flags);
  else if (cmd === 'verify') await verify(flags);
  else if (cmd === 'status') status();
  else {
    console.log('usage: node tools/raw-sync.mjs manifest | push [--tracked] | snapshot <name> | pull [--include-jobs] [--overwrite] | verify [--remote] | status');
    process.exitCode = cmd ? 1 : 0;
  }
}

const isMain = (process.argv[1] ?? '').endsWith('raw-sync.mjs');
if (isMain) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
