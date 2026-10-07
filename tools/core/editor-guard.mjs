// tools/core/editor-guard.mjs — request + path guards for the dev-only editor
// middleware (`editorApi()` in vite.config.ts, 02-PLAN P2.7).
//
// The /__editor/* endpoints spend API credits, write files and delete
// fighters. Without a guard, ANY web page open while `npm run dev` runs could
// POST to http://localhost:<port>/__editor/... (a "simple" text/plain request
// needs no CORS preflight), and a DNS-rebinding page could reach it under its
// own hostname. One check in front of every endpoint closes both:
//   - Host must be a loopback name (defeats DNS rebinding);
//   - Origin, when sent, must be a loopback origin (browsers send it on every
//     cross-site POST; curl and same-process tools don't send one);
//   - Sec-Fetch-Site, when sent, must not be cross-site;
//   - anything but GET/HEAD must be `Content-Type: application/json`
//     (forces a preflight for cross-origin pages; the editors all send JSON).
// Pure functions, no I/O — unit-tested in src/data/editorGuard.test.ts.

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** hostname part of a Host header ("localhost:5173" → "localhost") */
function hostName(host) {
  const h = String(host ?? '').trim().toLowerCase();
  if (h.startsWith('[')) return h.slice(0, h.indexOf(']') + 1);
  return h.split(':')[0];
}

export function isLoopbackHost(host) {
  const n = hostName(host);
  return LOOPBACK.has(n) || n.endsWith('.localhost');
}

export function isLoopbackOrigin(origin) {
  try {
    const u = new URL(String(origin));
    return (u.protocol === 'http:' || u.protocol === 'https:') && isLoopbackHost(u.host);
  } catch {
    return false;
  }
}

/** Decide whether an /__editor request may proceed.
 *  Returns `{ ok: true }` or `{ ok: false, status, error }` (403 / 415). */
export function checkEditorRequest(method, headers = {}) {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v[0] : v]));
  if (!isLoopbackHost(h.host)) return { ok: false, status: 403, error: 'editor API: non-loopback Host' };
  if (h.origin !== undefined && h.origin !== 'null' && !isLoopbackOrigin(h.origin)) {
    return { ok: false, status: 403, error: 'editor API: cross-origin request' };
  }
  if (h.origin === 'null') return { ok: false, status: 403, error: 'editor API: opaque origin' };
  if (h['sec-fetch-site'] === 'cross-site') return { ok: false, status: 403, error: 'editor API: cross-site request' };
  const m = String(method ?? 'GET').toUpperCase();
  if (m !== 'GET' && m !== 'HEAD') {
    const ct = String(h['content-type'] ?? '').toLowerCase();
    if (!ct.startsWith('application/json')) return { ok: false, status: 415, error: 'editor API: Content-Type must be application/json' };
  }
  return { ok: true };
}

/** a fighter / stage / move id usable as a path segment */
export const SAFE_ID = /^[a-z0-9][a-z0-9_-]*$/;
/** a file name inside an id's own folder (no separators, no leading dot) */
export const SAFE_FILE = /^[a-z0-9][a-z0-9._-]*$/i;

/** Quote a string as a single-quoted TS literal for the roster.ts / stages.ts
 *  writers (an apostrophe in a display name used to break the build). */
export function tsString(s) {
  return `'${String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' ')}'`;
}

/** Zip import: may this bundle file (path relative to the bundle's `assets/`
 *  dir, forward slashes) be copied into public/assets? Only the importing
 *  fighter's own files — a bundle must never overwrite another fighter's art,
 *  audio or someone else's stage. `stageId` is the bundle's home stage;
 *  `stageExists` says whether that stage's art already ships (never clobber). */
export function importPathAllowed(rel, id, stageId, stageExists = false) {
  const p = String(rel).replace(/\\/g, '/');
  if (!SAFE_ID.test(id) || p.split('/').some((seg) => seg === '..' || seg === '.' || seg === '')) return false;
  const parts = p.split('/');
  const file = parts[parts.length - 1];
  if (!SAFE_FILE.test(file)) return false;
  const [top, ...rest] = parts;
  switch (top) {
    case 'sprites':
    case 'fatalities':
      return rest[0] === id && rest.length >= 2;
    case 'portraits':
      return rest.length === 1 && [`${id}.png`, `${id}-bust.png`, `${id}-ko.png`].includes(file);
    case 'audio':
      if (rest[0] === 'announcer') return rest.length === 2 && file === `${id}.mp3`;
      if (rest[0] === 'voice') return rest.length === 2 && file.startsWith(`${id}-`) && file.endsWith('.mp3');
      if (rest[0] === 'music') return rest.length === 4 && rest[1] === 'stages' && SAFE_ID.test(rest[2]) && file === `${id}-theme.mp3`;
      return false;
    case 'backgrounds':
      return rest.length === 2 && rest[0] === 'stages' && !!stageId && SAFE_ID.test(stageId) && file === `${stageId}.jpg` && !stageExists;
    default:
      return false;
  }
}
