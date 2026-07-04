# CorridorKey — cleaner green-screen keying (production upgrade, not yet wired in)

**Status:** evaluated & proven 2026-07-04, **not yet integrated.** Current
production keying is still ffmpeg `chromakey` in `tools/pack-sheet.mjs` (with a
PIL/numpy coarse-mask fallback used in some spots). This doc is the parking spot
so we can pick it up for a **main production release**: at that point we re-key
**all** sprite sheets from their raw green-screen frames using CorridorKey
instead of ffmpeg/PIL.

## Why bother

[CorridorKey](https://github.com/nikopueringer/CorridorKey) is a neural
green-screen *unmixer*. Where ffmpeg `chromakey` can only threshold a hard edge,
CorridorKey reconstructs the true foreground color **and** a clean linear alpha
for every semi-transparent pixel. On our art this is a dramatic win anywhere the
subject has soft/translucent edges that blend into the screen — **flames, smoke,
glow, spliff smoke, genAI glitch FX** (Yulia's flaming fists, Kirby's fire, Flo's
smoke, Gene's glitch). ffmpeg leaves a bright green halo around those pixels;
CorridorKey removes it and rebuilds the fire/smoke as real translucent color.

For fully opaque sprites the win is marginal — the payoff is the effect-heavy
characters. Proof images from the eval live outside the repo (scratchpad), but
the effect is: green fringe on flames → gone, flames become real fire.

Wardrobe greens (Yulia's bandana, green clothing) are **preserved** — the model
distinguishes wardrobe green from screen green, which is exactly the failure mode
that forced `pack-sheet.mjs` to run `chromakey` with despill OFF.

## The repo is already cloned & installed

Local clone: `/Users/vincentnaples/Documents/github/CorridorKey` (a sibling of
this repo, NOT a submodule). Installed via the repo's
`Install_CorridorKey_Linux_Mac.sh` + `uv sync --extra mlx`. Torch green/blue
checkpoints download automatically on first run.

## Getting the MLX (Apple Silicon) weights — the part with dead links

The bundled downloader (`python -m corridorkey_mlx weights download`) defaults to
a **dead GitHub repo** (`cristopheryates/corridorkey-mlx`, 404) and fails with
`Release not found: latest`. The README's "Option A" one-liner does not work.

**Working recipe** (run inside the CorridorKey clone, `uv`/`.venv` active):

```bash
export CORRIDORKEY_MLX_WEIGHTS_REPO="nikopueringer/corridorkey-mlx"
python -m corridorkey_mlx weights download --tag v1.0.0
# ~380 MB, SHA256 0b6b202768725fda9f7953090a705262d9c9276e241360d15218357a27d95580
# then copy the cached file into the checkpoints dir:
WEIGHTS=$(python -m corridorkey_mlx weights download --tag v1.0.0 --print-path | grep safetensors | tail -1)
cp "$WEIGHTS" CorridorKeyModule/checkpoints/corridorkey_mlx.safetensors
```

The override env var is `CORRIDORKEY_MLX_WEIGHTS_REPO` (prefix
`CORRIDORKEY_MLX_` + `WEIGHTS_REPO`). Tag must be `v1.0.0` — there is no `latest`
release published.

## Running inference on Mac (MLX) — the two gotchas

```bash
cd /Users/vincentnaples/Documents/github/CorridorKey
export PYTORCH_ENABLE_MPS_FALLBACK=1 OPENCV_IO_ENABLE_OPENEXR=1
python corridorkey_cli.py run-inference \
  --backend mlx --screen-color green --srgb \
  --despill 5 --despeckle --despeckle-size 20 \
  --image-size 2048 --refiner 1.0 --tile --comp
```

1. **`--tile` is mandatory on MLX.** Without it, full-frame 2048 inference thrashes
   and blows past 10 minutes on Apple Silicon. With `--tile`: **~5s inference /
   ~12s wall per frame**. (Torch/MPS works without `--tile` but is ~82s/frame —
   ~6–7× slower than tiled MLX.)
2. **Pass every arg explicitly for non-interactive runs.** In particular
   `--image-size 2048` — if omitted it stays `None` and the run crashes deep in a
   `logger.info("... img_size=%d", None)` format call. Also set `--despeckle-size`.
3. **Checkpoint collision.** The tool can't tell the Torch `.safetensors` from the
   MLX `.safetensors` (both green, same extension) and errors *"Multiple green
   checkpoints… Keep exactly one."* For an MLX run, the MLX weights must be the
   **only** green `.safetensors` in `CorridorKeyModule/checkpoints/`. Options for
   integration: keep MLX weights in a **separate checkpoints dir**, or standardize
   on MLX and remove the Torch `CorridorKey.safetensors`. (During the eval we just
   stashed the Torch file with a restore trap.)

## Input contract

CorridorKey needs, per shot folder under `ClipsForInference/<shot>/`:

- `Input/<frame>.png` — the **raw green-screen frame**
  (`assets/raw/frames/<char>/NN-<pose>.png` in this repo — the gitignored
  originals, still on disk).
- `AlphaHint/<frame>.png` — a **coarse** black/white mask (does NOT need to be
  precise; the model is trained on eroded/blurry hints). We don't have GVM /
  VideoMaMa / BiRefNet weights installed, so generate the hint ourselves from a
  wide chroma threshold. A working recipe (PIL/numpy):
  green_bg = `g > r+25 & g > b+25 & g > 80`; foreground = `~green_bg`; then
  `MinFilter(5)` erode + `GaussianBlur(3)`.

Outputs land in `ClipsForInference/<shot>/Output/`: `/FG` (straight sRGB color,
EXR), `/Matte` (linear alpha, EXR), `/Processed` (premultiplied RGBA EXR),
`/Comp` (checkerboard preview PNG). To build a game-ready **straight-alpha RGBA
PNG**: `RGB = clip(FG_bgr[..., ::-1], 0, 1)`, `A = clip(Matte, 0, 1)`, ×255.
FG is already sRGB-gamma, so no extra conversion for an 8-bit PNG.

## Integration sketch (when we do the production pass)

Add an opt-in `--keyer corridor` path to `tools/pack-sheet.mjs` that, per frame:
generates the coarse alpha hint → runs CorridorKey (MLX + `--tile`, isolated
checkpoints dir) → composes FG+Matte to a straight-alpha PNG → feeds that into the
existing scale/pad/tile packing (instead of the ffmpeg `chromakey` step). Keep
ffmpeg as the fast default for iteration; use CorridorKey for the final release
bake. Batch the ~50–64 cells/character; at ~12s/frame that's ~10–13 min/char on
MLX — plan for it. Torch/MPS is the cross-platform fallback (no `--tile` needed,
~82s/frame).

## License note

CorridorKey is CC BY-NC-SA-flavored: fine to use for processing our assets
(including commercial projects), but do not resell the tool or offer it as a paid
inference API, and keep the "Corridor Key" name in any fork. Attribution belongs
in credits if we ship keyed-with-CorridorKey art in a release.
