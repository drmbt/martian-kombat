# Raw asset store — the private R2 mirror for gitignored assets

**Status:** live since 2026-10-04 (first push + snapshot from the original dev
machine during the rescue; see `docs/handoff/RESCUE_REPORT.md`).

Most of `assets/raw/` is gitignored: Studio drafts, QA reports, sprite-editor
backups, keyed frames, raw fatality/VFX/icon generations, voice tests. These
are paid generations, and before the rescue each one existed on only one disk.
`tools/raw-sync.mjs` mirrors them to a **private** R2 bucket and keeps a
committed index, so a fresh clone can get back to parity.

## Where everything lives

| What | Where |
|---|---|
| Canonical regen anchors (`assets/raw/canonical/**`, vincent/yulia painted style-tests, the salton world-map style ref), unshipped Studio draft `state.json`s | **git** (small, irreplaceable: generators read them as reference inputs) |
| Source frames (`assets/raw/frames/`), Sprite-Editor overlays (`assets/raw/edits/`), inspo photos/voice, `assets/archive/` | **git** (and mirrored to R2 as a backup) |
| Everything else gitignored under `assets/` | private R2 only |
| `.env` | neither: copy it between machines by hand |

| Thing | Value |
|---|---|
| Bucket | `martiankombat-raw` (private: no public access, no r2.dev, no custom domain) |
| Object keys | `repo/<repo-relative path>`, e.g. `repo/assets/raw/creator/ben/state.json` |
| Snapshots | `snapshots/<name>/<repo-relative path>`: frozen server-side copies of the ignored set |
| Index (committed) | `assets/raw-store.manifest.json`: every ignored file's path, bytes and sha256, sorted by path; plus the tracked-backup summary and the snapshot list |
| Env | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_RAW_BUCKET` (the public `R2_BUCKET` is a different bucket) |
| Transport | `rclone` (`brew install rclone`), configured only through the child process env (`RCLONE_CONFIG_MKRAW_*`). There's no `rclone.conf`, and secrets are never printed |

## Commands

```bash
npm run raw:status                 # files/bytes per category, local vs manifest
npm run raw:push                   # upload new/changed ignored files, rewrite the manifest
npm run raw:push -- --tracked      # also back up tracked heavy media (inspo, frames, archive, root mp4s)
npm run raw:snapshot -- <name>     # server-side frozen copy → snapshots/<name>/
npm run raw:pull                   # restore every manifest file you don't have, then verify
npm run raw:pull -- --overwrite    # also replace local files that differ
npm run raw:verify                 # re-hash local files vs the manifest (exit 1 on mismatch)
npm run raw:verify -- --remote     # rclone check: every local manifest file exists in R2 with the same hash
npm run raw:manifest               # re-hash the ignored set → manifest (no network)
```

**Uploads never delete.** `push` and `snapshot` use `rclone copy` (never
`sync`, never `--delete-*`). A file removed locally stays in R2, and removing
objects is a deliberate manual act. Commit the rewritten manifest after a push
so other machines can pull what you added.

## What is never mirrored

- **`assets/raw/jobs/` is not restored by default.** It's a stale queue from
  another machine. `pull` skips it unless you pass `--include-jobs`, and
  `verify` reports those entries as skipped rather than missing. Since P2.8
  (2026-10-07) a restored queue is harmless anyway: the runner loads
  carried-over jobs as *paused* and only an explicit per-character resume
  runs them.
- **`assets/raw/mugen/`** is third-party reference content (Kung Fu Man is
  CC BY-NC). Don't redistribute it, not even to a private bucket. Re-fetch it
  with `npm run mugen:fetch`.
- `.env*`, `node_modules/`, `dist/`, `.vite/`, Python caches, `*.asd`,
  `.DS_Store`.

## Gotchas

- An anchor that becomes tracked drops out of the manifest's `ignored` list at
  the next `raw:manifest`/`raw:push`, but the snapshot keeps it.
- Studio `state.json` files for *shipped* fighters embed base64 copies of
  their fatality panels and VO (1.3–1.8 MB each), and the Studio rewrites
  them on every save. That's why they stay R2-only and `.gitignore` lists
  them by name.
- The R2 token needs **Object Read & Write** on `martiankombat-raw`. A token
  scoped to only that bucket can't list the public `martiankombat-assets`.
