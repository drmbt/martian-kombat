#!/usr/bin/env python3
"""Bake the approved hit-spark grids into committed, game-ready assets:
a horizontal transparent sprite-sheet strip per spark (greyscale, tintable) +
a manifest. Reuses the vfx_grid pipeline (key/inset/centroid-center/normalize).

  python tools/qa/vfx_canonize.py

Output: public/assets/vfx/sparks/<id>.png  (N frames of FSxFS, left→right)
        public/assets/vfx/sparks/sparks.json
"""
import os, json
import importlib.util as u
import numpy as np
from PIL import Image

_spec = u.spec_from_file_location("vg", os.path.join(os.path.dirname(__file__), "vfx_grid.py"))
vg = u.module_from_spec(_spec); _spec.loader.exec_module(vg)

FS = 128       # per-frame size in the strip (overlays are low-res)
FPS = 24       # suggested playback rate
OUTDIR = f"{vg.ROOT}/public/assets/vfx/sparks"

# the experiment's approved keepers: (frames, tags). Tags let the renderer pool
# by strength/kind and limit certain sparks to certain movesets.
VIABLE = {
    "spark-scatter":    (16, ["light", "spark"]),
    "dust-puff":        (9,  ["impact", "dust", "body"]),
    "slash-arc":        (16, ["slash"]),
    "ki-scatter":       (16, ["light", "energy", "spark"]),
    "energy-flare":     (16, ["heavy", "energy"]),
    "grit-debris":      (16, ["heavy", "dust", "noise"]),
    "ki-lightning":     (16, ["energy", "electric"]),
    "double-shockstar": (9,  ["heavy", "impact"]),
    "diag-slash":       (9,  ["slash", "light"]),
    "cross-slash":      (9,  ["slash"]),
    "ember-flick":      (9,  ["light", "spark", "sparse"]),
    "splinter-shard":   (9,  ["heavy", "shard", "sparse"]),
    "claw-rake":        (16, ["slash", "heavy"]),
    "spark-spit":       (16, ["spark", "sparse"]),
    "noise-fizz":       (16, ["noise", "sparse", "light"]),
}


def centered(gid, n):
    im = vg.key_magenta(f"{vg.SRC}/{gid}.png")
    frames, cw, ch = vg.slice_grid(im, n)
    alphas = [np.array(f)[:, :, 3] for f in frames]
    densest = int(np.argmax([int(a.sum()) for a in alphas]))
    cen = vg.centroid(alphas[densest]) or (cw / 2, ch / 2)
    dx, dy = int(round(cw / 2 - cen[0])), int(round(ch / 2 - cen[1]))
    out = []
    for f in frames:
        canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        canvas.paste(f, (dx, dy), f)
        out.append(vg.normalize(canvas).resize((FS, FS)))
    return out


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    manifest = {}
    for gid, (n, tags) in VIABLE.items():
        if not os.path.exists(f"{vg.SRC}/{gid}.png"):
            print(f"  [{gid}] raw grid missing — skip")
            continue
        frames = centered(gid, n)
        strip = Image.new("RGBA", (FS * len(frames), FS), (0, 0, 0, 0))
        for i, f in enumerate(frames):
            strip.paste(f, (i * FS, 0), f)
        strip.save(f"{OUTDIR}/{gid}.png")
        manifest[gid] = {"frames": len(frames), "fw": FS, "fh": FS, "tags": tags}
        print(f"  [{gid:16}] -> sparks/{gid}.png  ({len(frames)}f)  {tags}")
    json.dump({"version": 1, "fps": FPS, "sparks": manifest},
              open(f"{OUTDIR}/sparks.json", "w"), indent=2)
    print(f"\ncanonized {len(manifest)} sparks -> {OUTDIR}/sparks.json")


if __name__ == "__main__":
    main()
