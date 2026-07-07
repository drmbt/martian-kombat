#!/usr/bin/env python3
"""Run DWPose on a directory of sprite cells and emit named keypoints as JSON.

A minimal slice of tools/qa/pose_qa.py: no QA, no hitbox suggestion, no
montage — just the 11 named joints per image that get baked into a sprite
sheet's meta.json for the in-game skeleton overlay. Used by the Sprite Editor's
"Regenerate keypoints" button (vite.config.ts /__editor/skeleton-regen), which
writes the edited cells to a scratch dir and shells out here.

  python3 tools/qa/infer_keypoints.py --dir <scratch-dir>

Reads every *.png in --dir, keyed by the filename stem (so `lp-active.png` ->
"lp-active"), and prints {"<stem>": {"<joint>": [x, y, conf], ...}, ...} to
stdout. Coordinates are in the image's own pixel space (callers pass the same
288x384 cells the packer/renderer use).
"""
import argparse, contextlib, glob, json, os, sys

# reuse the heavy ONNX model + joint maps from the QA script so there's exactly
# one place that knows how to talk to rtmlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pose_qa import model, pose, to_bgr, named_keypoints  # noqa: E402
from PIL import Image  # noqa: E402


def keypoints_for(path):
    rgba = Image.open(path).convert("RGBA")
    k, s, _people = pose(to_bgr(rgba))
    if k is None:
        return {}
    return named_keypoints(k, s)  # full 133-point wholebody set


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    args = ap.parse_args()
    # rtmlib/onnxruntime print model-load noise to stdout — send everything
    # except our JSON to stderr so the endpoint gets clean parseable stdout
    result = {}
    real_stdout = sys.stdout
    with contextlib.redirect_stdout(sys.stderr):
        model()  # warm the ONNX session once before the loop
        for path in sorted(glob.glob(os.path.join(args.dir, "*.png"))):
            stem = os.path.splitext(os.path.basename(path))[0]
            result[stem] = keypoints_for(path)
    json.dump(result, real_stdout)


if __name__ == "__main__":
    main()
