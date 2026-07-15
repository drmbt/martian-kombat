# 3D mode — resume via R2

3D mesh mode is **offlined on `main`** (ships with the 2D game). This branch,
`feat/3d-mode`, is the resume point: flags re-enabled and the R2 asset seam
wired. When you're ready to ship 3D, the work is mostly Cloudflare config.

## Why it's off

The four character GLBs (`vincent`, `yulia`, `flo`, `rapha`) are ~30 MB each,
over the **25 MiB per-file cap** on Cloudflare Workers Static Assets (and Pages).
The runtime `GLTFLoader` has **no Draco/meshopt decoder**, so they can't be
compressed under the cap without a code change. R2 (no per-file cap, zero egress)
is the right home for them.

## What's already done on this branch

- `src/data/roster.ts` — the 4 `mesh3d: true` flags are back on.
- `src/renderer3d/threeAssets.ts` — GLB URLs now use `VITE_ASSET_BASE` (the R2
  origin) with same-origin `BASE_URL` fallback for local dev.
- `public/.assetsignore` still excludes `assets/3d/` from the Workers upload —
  correct, since the GLBs come from R2, not the Worker.

Only the GLB path is on the R2 seam; all 2D assets still load same-origin from
the Worker (fast). That split is deliberate: heavy/rare 3D on R2, everything
else on the edge.

## To ship 3D (checklist)

1. **Upload the meshes to R2**, preserving the path:
   `public/assets/3d/**` → bucket key `assets/3d/**`
   (e.g. `rclone sync public/assets/3d r2:martiankombat-assets/assets/3d`, using
   the `R2_*` creds in `.env`).
2. **Public custom domain** on the bucket: R2 → Settings → Public access →
   Connect `cdn.martiankombat.com`.
3. **Set the env var** in the Worker (Settings → Variables):
   `VITE_ASSET_BASE=https://cdn.martiankombat.com/` (trailing slash required).
4. Merge this branch (or cherry-pick these commits) to `main` and deploy. The
   GLBs load from R2; the Worker upload stays under the cap.
5. **Verify** 3D mode in-browser: the character/stage GLBs 200 from
   `cdn.martiankombat.com`, no console errors.

## Optional follow-ups

- **Draco-compress** the GLBs (30 MB → ~3–5 MB) once a `DRACOLoader` is wired
  into `threeAssets.ts` — cuts R2 transfer and load time ~6–10×.
- **`git rm` the GLBs from the repo** once they live in R2 (they're ~100 MB of
  git weight); keep a copy in the gitignored `assets/raw/`.
- Broaden the `VITE_ASSET_BASE` seam to 2D assets too (BootScene loader) if you
  want the whole media library on R2 — see SPRINTBOARD Phase 5 (StorageDriver).
