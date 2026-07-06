#!/usr/bin/env python
"""Helpers run inside the CorridorKey venv by tools/corridorkey.mjs.
Only needs cv2 + numpy (both ship with CorridorKey's uv env).

  hints   <inputDir> <hintDir>    coarse B/W alpha hints from green frames
  compose <shotDir>  <outDir>     Output/FG+Matte EXRs -> straight-alpha PNGs

Recipes come from docs/CORRIDORKEY.md (eval 2026-07-04): hints are a wide
chroma threshold, eroded + blurred (the model is trained on coarse hints);
compose is RGB = clip(FG), A = clip(Matte) — FG is already sRGB-gamma.
"""
import glob
import os
import sys

os.environ.setdefault("OPENCV_IO_ENABLE_OPENEXR", "1")
import cv2  # noqa: E402
import numpy as np  # noqa: E402


def hints(input_dir, hint_dir):
    os.makedirs(hint_dir, exist_ok=True)
    wrote = 0
    for path in sorted(glob.glob(os.path.join(input_dir, "*.png"))):
        out = os.path.join(hint_dir, os.path.basename(path))
        if os.path.exists(out):
            continue
        img = cv2.imread(path, cv2.IMREAD_COLOR)
        if img is None:
            sys.exit(f"hints: unreadable image {path}")
        b = img[..., 0].astype(np.int16)
        g = img[..., 1].astype(np.int16)
        r = img[..., 2].astype(np.int16)
        green_bg = (g > r + 25) & (g > b + 25) & (g > 80)
        fg = (~green_bg).astype(np.uint8) * 255
        fg = cv2.erode(fg, np.ones((5, 5), np.uint8))  # ~ PIL MinFilter(5)
        fg = cv2.GaussianBlur(fg, (3, 3), 0)
        cv2.imwrite(out, fg)
        wrote += 1
    print(f"hints: {wrote} written to {hint_dir}")


def compose(shot_dir, out_dir):
    fg_dir = os.path.join(shot_dir, "Output", "FG")
    matte_dir = os.path.join(shot_dir, "Output", "Matte")
    mattes = sorted(glob.glob(os.path.join(matte_dir, "*.exr")))
    if not mattes:
        sys.exit(f"compose: no mattes in {matte_dir} — did inference run?")
    os.makedirs(out_dir, exist_ok=True)
    wrote = 0
    for mpath in mattes:
        stem = os.path.splitext(os.path.basename(mpath))[0]
        fpath = os.path.join(fg_dir, stem + ".exr")
        if not os.path.exists(fpath):
            sys.exit(f"compose: FG missing for {stem} in {fg_dir}")
        fg = cv2.imread(fpath, cv2.IMREAD_UNCHANGED)
        matte = cv2.imread(mpath, cv2.IMREAD_UNCHANGED)
        if fg is None or matte is None:
            sys.exit(f"compose: unreadable EXR for {stem}")
        if matte.ndim == 3:
            matte = matte[..., 0]
        bgr = np.clip(fg[..., :3], 0.0, 1.0)
        a = np.clip(matte, 0.0, 1.0)
        bgra = np.dstack([bgr, a])
        cv2.imwrite(os.path.join(out_dir, stem + ".png"),
                    np.round(bgra * 255).astype(np.uint8))
        wrote += 1
    print(f"compose: {wrote} written to {out_dir}")


if __name__ == "__main__":
    commands = {"hints": hints, "compose": compose}
    if len(sys.argv) != 4 or sys.argv[1] not in commands:
        sys.exit(__doc__)
    commands[sys.argv[1]](sys.argv[2], sys.argv[3])
