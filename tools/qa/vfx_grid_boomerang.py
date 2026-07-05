#!/usr/bin/env python3
"""For the sparks whose frames touch the cell edge: re-render as <id>-2.gif,
truncated to the frames BEFORE the first edge contact, then played forward +
reversed (ping-pong) so the burst blooms out and pulls back without ever
clipping an edge. Reuses the vfx_grid pipeline (key/slice/normalize/center).

  python tools/qa/vfx_grid_boomerang.py
"""
import os
import importlib.util as u
import numpy as np
from PIL import Image

_spec = u.spec_from_file_location("vg", os.path.join(os.path.dirname(__file__), "vfx_grid.py"))
vg = u.module_from_spec(_spec); _spec.loader.exec_module(vg)

OUT = vg.OUT
# the new (edge-touching) batch — spark-scatter never touches, so it's excluded
IDS = ["ki-scatter", "shard-crack", "pinwheel-burst", "speed-impact",
       "ki-lightning", "grit-debris", "double-shockstar", "energy-flare"]


def centered_frames(gid):
    """Reproduce vfx_grid's keyed/inset/centered/normalized frames + per-frame
    edge-touch measured on the FINAL rendered frame."""
    im = vg.key_magenta(f"{vg.SRC}/{gid}.png")
    frames, cw, ch = vg.slice_grid(im, vg.FRAMES[gid])
    alphas = [np.array(f)[:, :, 3] for f in frames]
    densest = int(np.argmax([int(a.sum()) for a in alphas]))
    cen = vg.centroid(alphas[densest]) or (cw / 2, ch / 2)
    dx, dy = int(round(cw / 2 - cen[0])), int(round(ch / 2 - cen[1]))
    out = []
    for f in frames:
        canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        canvas.paste(f, (dx, dy), f)
        out.append(vg.normalize(canvas))
    edges = [vg.edge_touch(np.array(f)[:, :, 3]) for f in out]  # measured post-render
    return out, edges


def main():
    made = []
    for gid in IDS:
        if not os.path.exists(f"{vg.SRC}/{gid}.png"):
            continue
        frames, edges = centered_frames(gid)
        first = next((i for i, e in enumerate(edges) if e > 0), None)
        if first is None:
            print(f"  [{gid:16}] never touches an edge — skipped (use the plain gif)")
            continue
        if first == 0:
            print(f"  [{gid:16}] touches from frame 0 (radial effect) — no clean frames, skipped")
            continue
        clean = frames[:first]                       # frames before first contact
        rev = clean[-2:0:-1] if len(clean) > 2 else clean[::-1]
        boom = clean + rev                           # bloom out, pull back
        vg.save_transparent_gif(boom, f"{OUT}/{gid}-2.gif", duration=60)
        vg.contact_sheet(boom, f"{gid}-2 (boomerang, {len(clean)} clean)",
                         0, [0] * len(boom)).save(f"{OUT}/{gid}-2-sheet.png")
        made.append(gid)
        print(f"  [{gid:16}] first edge @#{first} -> keep {len(clean)} clean, "
              f"ping-pong to {len(boom)} frames -> {gid}-2.gif")

    if made:
        tiles = []
        for g in made:
            im = Image.open(f"{OUT}/{g}-2-sheet.png").convert("RGB")
            im.thumbnail((900, 200))
            tiles.append(np.array(im))
        w = max(t.shape[1] for t in tiles)
        tiles = [np.pad(t, ((0, 0), (0, w - t.shape[1]), (0, 0)), constant_values=40) for t in tiles]
        Image.fromarray(np.vstack(tiles)).save(f"{OUT}/_overview_boomerang.png")
        print(f"\noverview -> {OUT}/_overview_boomerang.png ({len(made)} sparks)")


if __name__ == "__main__":
    main()
