# Deploy, caching & storage

How martiankombat.com is built and served, how media is cached, and where the
non-git assets live. Written 2026-10-06 (02-PLAN P1.7); facts verified
against `wrangler.jsonc`, `public/_headers`, `public/.assetsignore`,
`src/data/assetUrl.ts`, `tools/gen-asset-manifest.mjs`, `tools/raw-sync.mjs`
and `.env.example`.

## The site

**martiankombat.com is the only site.** It is a static Vite build (`dist/`)
served by **Cloudflare Workers Static Assets**: `wrangler.jsonc` declares an
assets-only Worker named `martian-kombat` (no Worker script) with
`assets.directory: "./dist"`.

- **`not_found_handling: "none"`** — a missing file returns a real 404. The
  old `single-page-application` mode answered every missing `.png`/`.mp3`
  with `index.html` + HTTP 200, which the browser cached and then failed to
  decode (EncodingError). The game has no client routes (state lives in
  `?query`), so nothing needs the SPA fallback (02-PLAN P2.2).
- The `name` in `wrangler.jsonc` must match the Worker in the Cloudflare
  dashboard, or `wrangler deploy` targets a different Worker.

## Builds and previews

- **Cloudflare Workers Builds** (the dashboard's Git integration) builds and
  deploys on every push to **`main`** → martiankombat.com. There is no GitHub
  Actions deploy (that workflow was removed in `0c738ee`).
- **Every pushed branch gets a preview** at
  `https://<branch-with-dashes>-martian-kombat.stayprompin.workers.dev`
  (e.g. `docs/p1-truth-in-docs` →
  `docs-p1-truth-in-docs-martian-kombat.stayprompin.workers.dev`). The GitHub
  check **"Workers Builds: martian-kombat"** on the commit links the exact
  version.
- **Flow:** one branch + PR per sprint → test on the preview → the user
  merges → `main` deploys. Never push to `main` or force-push.
- The build command lives in the Cloudflare dashboard, not the repo; it must
  be `npm run build`, whose `prebuild` regenerates the music manifest and `src/data/assetManifest.json` (content versions — below).
  `npx vite build` skips `prebuild`, so a local build made that way can ship
  stale versions.
- **GitHub Pages** (`drmbt.github.io/martian-kombat`, a frozen 2026-07-07
  build) was **unpublished 2026-10-06** (02-PLAN P2.5).

## Browser caching — `public/_headers`

Cloudflare's default is `max-age=0, must-revalidate` (a 304 round-trip per
file per visit). `public/_headers` overrides it:

| Path | Policy | Why it's safe |
|---|---|---|
| `/assets/*.js`, `/assets/*.css` | `public, max-age=31536000, immutable` | Vite fingerprints the filename |
| `/assets/{sprites,backgrounds,portraits,fatalities,vfx,ui}/*`, `/assets/audio/*.mp3` | `public, max-age=31536000, immutable` | every request carries `?v=<sha8>` (below) |
| everything else (HTML, the music `manifest.json`, …) | Cloudflare default (revalidate) | — |

- **Content versions:** `tools/gen-asset-manifest.mjs` records a short
  content hash per media file in `src/data/assetManifest.json` → `versions`;
  `assetUrl()` (`src/data/assetUrl.ts`) appends it as `?v=<sha8>`. A
  regenerated file gets a new URL; an unchanged one is never revalidated. The
  static host ignores the query string. **Any new code that loads a file from
  `public/assets/` must wrap its path in `assetUrl()`**, or a regenerated file
  stays stale for a year.
- **Rules must not overlap:** Cloudflare merges the headers of every matching
  rule. That's why audio is matched by extension (`*.mp3`) rather than
  `/assets/audio/*`: the music `manifest.json` must keep revalidating (it is
  also fetched with `cache: 'no-cache'`).
- Run `npm run gen:assets` (or `npm run build`) after changing any media.

## `public/.assetsignore`

Files excluded from the Workers upload. Today: `assets/3d/` (the GLB meshes
exceed Workers' 25 MiB per-file cap). 3D is frozen (dev or `?3d=1`), so prod
never requests them.

## R2 buckets

| Bucket | Access | Holds | Used by |
|---|---|---|---|
| `martiankombat-assets` (`R2_BUCKET`) | public (future CDN) | intended for heavy media / 3D meshes | nothing on `main` yet |
| `martiankombat-raw` (`R2_RAW_BUCKET`) | **private** (no public access, no r2.dev, no custom domain) | the gitignored half of `assets/` + backups of tracked heavy media, under `repo/<path>`, plus `snapshots/` | `npm run raw:*` (`tools/raw-sync.mjs`, needs `rclone`) |

- `npm run raw:pull` / `raw:verify` / `raw:status` / `raw:manifest` are safe.
  **No writes (`raw:push`, `raw:snapshot`) until 02-PLAN P8.17** makes push
  no-clobber — today `rclone copy --checksum` replaces any differing object.
- Full workflow and index format: `docs/RAW_ASSET_STORE.md`.
- Never put third-party reference content (`assets/raw/mugen/`, CC BY-NC) in
  either bucket.

## `VITE_ASSET_BASE`

A build-time base URL for loading heavy media from R2/CDN instead of the same
origin (must end with `/`; not secret). **It is only wired on the
`feat/3d-mode` branch** (`src/renderer3d/threeAssets.ts`, for GLB meshes).
On `main` nothing reads it: all media is same-origin.

## Secrets

`.env` is never committed and never printed. Deploys need no local secrets
(Workers Builds builds from git). `CLOUDFLARE_ACCOUNT_ID` /
`CLOUDFLARE_API_TOKEN` are only for CLI deploys; the `R2_*` keys are for
`raw:*` and future media uploads. Key names: `.env.example`.
