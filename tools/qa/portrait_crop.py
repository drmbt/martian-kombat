#!/usr/bin/env python3
"""Pose-centered head-and-shoulders portrait crop.

The old portraits were a FIXED crop box on the canonical, so heads landed at
different scales/positions per character. This instead runs RTMPose on the
canonical, then frames every bust identically off the skeleton: centered on the
head, eyes on a fixed line, a consistent head-to-crop scale. Deterministic — no
vision model call, just keypoints + ffmpeg crop/key/scale.

  python tools/qa/portrait_crop.py --all
  python tools/qa/portrait_crop.py --char vanessa --review

Output: public/assets/portraits/<id>-bust.png (160x160, keyed). Idempotent.
The straight-on <id>.png selector icon is a SEPARATE generated asset (gen-icons)
and is never touched here.
"""
import argparse, os, subprocess, sys
import numpy as np
from PIL import Image
import importlib.util as _u

_spec = _u.spec_from_file_location("pq", os.path.join(os.path.dirname(__file__), "pose_qa.py"))
pq = _u.module_from_spec(_spec); _spec.loader.exec_module(pq)

ROOT = pq.ROOT
CANON = f"{ROOT}/assets/raw/canonical"
OUT = f"{ROOT}/public/assets/portraits"
SIZE = 160

# framing constants (fractions of the crop side) — tuned once, applied to all
EYE_LINE = 0.40    # eyes sit 40% down from the top of the crop
CROP_K = 3.15      # crop side = CROP_K x (shoulder_y - eye_y): head + shoulders


def head_frame(img):
    """Return (cx, cy_top, side) crop box in source pixels from the skeleton."""
    bgr = pq.to_bgr(img.convert("RGBA"))
    k, s, _ = pq.pose(bgr)
    if k is None:
        return None
    def g(name):
        return pq.kp(k, s, name, thr=0.2)
    nose = g("nose")
    lsho, rsho = g("Lsho"), g("Rsho")
    if not nose or not lsho or not rsho:
        return None
    eye_y = nose[1]
    head_cx = nose[0]
    sho_y = (lsho[1] + rsho[1]) / 2
    sho_cx = (lsho[0] + rsho[0]) / 2
    face_h = max(sho_y - eye_y, 20)
    side = face_h * CROP_K
    cx = 0.5 * head_cx + 0.5 * sho_cx          # balance head over shoulders
    top = eye_y - EYE_LINE * side
    return cx, top, side


def crop_one(char, review_tiles=None):
    src = f"{CANON}/{char}.png"
    if not os.path.exists(src):
        print(f"  [{char}] no canonical — skip"); return False
    fr = head_frame(Image.open(src))
    if fr is None:
        print(f"  [{char}] no head pose — skip"); return False
    cx, top, side = fr
    im = Image.open(src)
    W, H = im.size
    left = int(round(cx - side / 2)); topi = int(round(top)); s = int(round(side))
    # clamp fully inside the frame
    left = max(0, min(left, W - s)) if s <= W else 0
    topi = max(0, min(topi, H - s)) if s <= H else 0
    s = min(s, W, H)
    os.makedirs(OUT, exist_ok=True)
    # writes the BUST (<id>-bust.png); the straight-on <id>.png selector icon is
    # a separate generated asset and must NOT be overwritten by this side crop.
    dst = f"{OUT}/{char}-bust.png"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-vf",
                    f"crop={s}:{s}:{left}:{topi},chromakey=0x00B140:0.15:0.06,scale={SIZE}:{SIZE}",
                    "-frames:v", "1", dst], check=True)
    print(f"  [{char}] head@({cx:.0f},{top:.0f}) side={s} -> {dst}")
    if review_tiles is not None:
        t = Image.open(dst).convert("RGBA")
        bg = Image.new("RGBA", t.size, (128, 128, 128, 255)); bg.alpha_composite(t)
        review_tiles.append((char, np.array(bg.convert("RGB"))))
    return True


def main():
    import re
    ap = argparse.ArgumentParser()
    ap.add_argument("--char"); ap.add_argument("--all", action="store_true")
    ap.add_argument("--review", action="store_true")
    args = ap.parse_args()
    if args.all:
        chars = sorted(f[:-4] for f in os.listdir(CANON) if f.endswith(".png"))
    else:
        chars = [args.char]
    tiles = [] if args.review else None
    ok = 0
    for c in chars:
        ok += crop_one(c, tiles)
    print(f"cropped {ok}/{len(chars)} portraits")
    if tiles:
        import cv2
        per = 6
        rows = []
        for r in range(0, len(tiles), per):
            chunk = [cv2.cvtColor(t[1], cv2.COLOR_RGB2BGR) for t in tiles[r:r + per]]
            for im, (nm, _) in zip(chunk, tiles[r:r + per]):
                cv2.putText(im, nm, (4, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 255), 1)
            while len(chunk) < per:
                chunk.append(np.full_like(chunk[0], 60))
            rows.append(np.hstack(chunk))
        cv2.imwrite(f"{ROOT}/assets/raw/qa/portraits_review.png", np.vstack(rows))
        print(f"review -> assets/raw/qa/portraits_review.png")


if __name__ == "__main__":
    main()
