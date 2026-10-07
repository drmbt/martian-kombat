// Cache-busting for game media (P6.6). Media URLs are stable paths, but frame
// data ships inside the content-hashed JS bundle — so after a repack a returning
// player could pair NEW frame data with an OLD cached sheet. gen-asset-manifest
// records a short content hash per media file; every loader URL carries it as
// `?v=<sha8>`, which lets public/_headers mark media `immutable` safely: a
// changed file gets a new URL, an unchanged one is never revalidated.
import assetManifest from './assetManifest.json';

const VERSIONS: Record<string, string> =
  (assetManifest as unknown as { versions?: Record<string, string> }).versions ?? {};

/** `assets/...` path (relative to the site root, no leading slash) → the same
 *  path with its content version appended. Unknown files pass through as-is. */
export function assetUrl(path: string): string {
  const v = VERSIONS[path];
  return v ? `${path}?v=${v}` : path;
}
