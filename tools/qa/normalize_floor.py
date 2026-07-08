#!/usr/bin/env python3
"""Floor-normalize a directory of keyed sprite cells IN PLACE.

Every fighter must stand on the same plane, but the image model draws feet at
slightly different heights per frame. We compute the character's floor from the
GROUNDED cells (median lowest-alpha row), then shift EVERY cell by one constant
vertical delta so that floor lands on the engine's origin feet line. A single
per-character shift (not per-frame) keeps grounded frames on the plane while
preserving the relative lift of jumps/knockdowns — and never introduces jitter.

Called by tools/pack-sheet.mjs when `--normalize` is passed. Cells are named
cell-NN.png (NN = index into the frames list passed via --frames).

  python tools/qa/normalize_floor.py --dir <tmpdir> --frames idle-a,idle-b,... [--target 365]
"""
import argparse, json, os
import numpy as np
from PIL import Image

# CANONICAL floor line: the fraction of cell height where every fighter's feet
# land. Lowered from 0.95 to 0.88 (2026-07-05) to give ~46px of headroom below
# the feet (was 19px) — the per-cell floor spread (up to ~72px) was pushing deep
# stances / sub-floor FX past the cell bottom on the single normalize shift.
# The value lives in src/render/coords.json (shared with the whole codebase).
from coords import FLOOR_FRAC

# poses with no ground contact — excluded from the floor measurement (their
# lowest pixel is a tucked knee / airborne body, not a sole)
AIRBORNE = {"jump", "fall"}
def airborne(name):
    return name in AIRBORNE or name.startswith("j")


def sole_y(path):
    a = np.array(Image.open(path).convert("RGBA"))[:, :, 3]
    ys, _ = np.where(a > 16)
    return int(ys.max()) if len(ys) else None


def shift_v(path, dy):
    if dy == 0:
        return
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    out = np.zeros_like(arr)
    h = arr.shape[0]
    if dy > 0:      # move down
        out[dy:, :] = arr[: h - dy, :]
    else:           # move up
        out[: h + dy, :] = arr[-dy:, :]
    Image.fromarray(out).save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--frames", required=True, help="comma-separated frame names in cell order")
    ap.add_argument("--target", type=float, default=FLOOR_FRAC * 384)  # origin feet line
    args = ap.parse_args()

    names = args.frames.split(",")
    grounded = []
    for i, nm in enumerate(names):
        p = os.path.join(args.dir, f"cell-{i:02d}.png")
        if not os.path.exists(p) or airborne(nm):
            continue
        s = sole_y(p)
        if s is not None:
            grounded.append(s)
    if not grounded:
        print("[normalize] no grounded cells measured — skipping")
        return
    floor = float(np.median(grounded))
    dy = int(round(args.target - floor))
    spread = max(grounded) - min(grounded)
    for i in range(len(names)):
        p = os.path.join(args.dir, f"cell-{i:02d}.png")
        if os.path.exists(p):
            shift_v(p, dy)
    # sidecar for tools/pack-sheet.mjs — lets it shift QA-measured keypoints by
    # the same amount cell art just moved, so a skeleton overlay stays aligned
    json.dump({"dy": dy}, open(os.path.join(args.dir, "dy.json"), "w"))
    print(f"[normalize] floor {floor:.0f} -> {args.target:.0f} (shift {dy:+d}px), "
          f"grounded spread {spread}px across {len(grounded)} cells")


if __name__ == "__main__":
    main()
