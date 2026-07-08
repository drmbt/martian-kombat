#!/usr/bin/env python3
"""Deterministic post-processor for the VFX grid experiment (no LLM calls).

For each generated NxN grid (assets/raw/vfx/grid-tests/<id>.png):
  1. key the magenta screen -> straight alpha
  2. slice into N frames on the grid
  3. edge-alpha validation per frame (content must not touch the cell edge)
  4. find the DENSEST frame (max alpha) and its centroid
  5. recenter every frame by one uniform shift so that centroid is centered
     (anchors the burst; preserves inter-frame motion)
  6. emit an animated transparent GIF + a labeled contact sheet

  python tools/qa/vfx_grid.py
"""
import os, subprocess, tempfile
import numpy as np
from PIL import Image, ImageFilter

INSET = 0.06  # crop each cell inward to drop the gridline borders nano-banana draws

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = f"{ROOT}/assets/raw/vfx/grid-tests"
OUT = f"{ROOT}/assets/raw/qa/vfx-grid"
THR = 24
FRAMES = {"spark-scatter": 16,  # keeper, kept for comparison
          "diag-slash": 9, "cross-slash": 9, "ember-flick": 9, "splinter-shard": 9,
          "claw-rake": 16, "spark-spit": 16, "jagged-tear": 16, "noise-fizz": 16}


def key_magenta(path):
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as t:
        tmp = t.name
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-vf",
                    "chromakey=0xFF00FF:0.18:0.08", "-frames:v", "1", tmp], check=True)
    im = Image.open(tmp).convert("RGBA").copy()
    os.remove(tmp)
    return im


def slice_grid(im, n):
    s = int(round(n ** 0.5))
    W, H = im.size
    cw, ch = W // s, H // s
    ix, iy = int(cw * INSET), int(ch * INSET)  # inset drops the drawn gridlines
    frames = [im.crop((c * cw + ix, r * ch + iy, c * cw + cw - ix, r * ch + ch - iy))
              for r in range(s) for c in range(s)]
    return frames, cw - 2 * ix, ch - 2 * iy


def normalize(f):
    """Greyscale the RGB (kills the magenta key fringe — sparks are meant to be
    greyscale + tinted at runtime) and erode the alpha 1px (removes the hard
    keyed edge). Result is a clean tintable overlay frame."""
    arr = np.array(f)
    rgb, a = arr[:, :, :3].astype(np.float32), arr[:, :, 3]
    lum = (0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]).astype(np.uint8)
    out = Image.fromarray(np.dstack([lum, lum, lum, a]), "RGBA")
    out.putalpha(out.getchannel("A").filter(ImageFilter.MinFilter(3)))
    return out


def edge_touch(a):
    return int((a[0, :] > THR).sum() + (a[-1, :] > THR).sum()
               + (a[:, 0] > THR).sum() + (a[:, -1] > THR).sum())


def centroid(a):
    ys, xs = np.where(a > THR)
    return (float(xs.mean()), float(ys.mean())) if len(xs) else None


def save_transparent_gif(frames, path, duration=70):
    pal = []
    for f in frames:
        arr = np.array(f)
        alpha = arr[:, :, 3]
        q = Image.fromarray(arr[:, :, :3]).convert("P", palette=Image.ADAPTIVE, colors=255)
        qa = np.array(q)
        qa[alpha < THR] = 255  # reserve index 255 as transparent
        out = Image.fromarray(qa, mode="P")
        out.putpalette(q.getpalette()[:255 * 3] + [0, 0, 0])
        out.info["transparency"] = 255
        pal.append(out)
    pal[0].save(path, save_all=True, append_images=pal[1:], duration=duration,
                loop=0, disposal=2, transparency=255)


def contact_sheet(frames, gid, densest, edges):
    """Frames on a checker bg with per-frame density/edge labels (for review)."""
    from PIL import ImageDraw
    cw, ch = frames[0].size
    per = min(len(frames), 8)
    rows = (len(frames) + per - 1) // per
    pad = 4
    tile = 120
    W = per * (tile + pad) + pad
    H = rows * (tile + pad + 12) + pad + 16
    sheet = Image.new("RGB", (W, H), (40, 40, 40))
    d = ImageDraw.Draw(sheet)
    d.text((pad, 2), f"{gid}  ({len(frames)} frames, densest=#{densest})", fill=(255, 255, 255))
    for i, f in enumerate(frames):
        r, c = divmod(i, per)
        x = pad + c * (tile + pad)
        y = 16 + pad + r * (tile + pad + 12)
        # checker so alpha is visible
        chk = Image.new("RGBA", (tile, tile), (0, 0, 0, 0))
        for by in range(0, tile, 12):
            for bx in range(0, tile, 12):
                if ((bx // 12) + (by // 12)) % 2:
                    for yy in range(by, min(by + 12, tile)):
                        for xx in range(bx, min(bx + 12, tile)):
                            chk.putpixel((xx, yy), (70, 70, 70, 255))
        thumb = f.resize((tile, tile))
        chk.alpha_composite(thumb)
        sheet.paste(chk.convert("RGB"), (x, y))
        col = (255, 90, 90) if edges[i] > 0 else (140, 200, 140)
        star = "*" if i == densest else " "
        d.text((x, y + tile), f"{star}e{edges[i]}", fill=col)
    return sheet


def process(gid):
    n = FRAMES[gid]
    src = f"{SRC}/{gid}.png"
    if not os.path.exists(src):
        print(f"  [{gid}] not generated — skip")
        return None
    im = key_magenta(src)
    frames, cw, ch = slice_grid(im, n)
    alphas = [np.array(f)[:, :, 3] for f in frames]
    sums = [int(a.sum()) for a in alphas]
    edges = [edge_touch(a) for a in alphas]
    densest = int(np.argmax(sums))
    cen = centroid(alphas[densest]) or (cw / 2, ch / 2)
    dx, dy = int(round(cw / 2 - cen[0])), int(round(ch / 2 - cen[1]))
    centered = []
    for f in frames:
        canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        canvas.paste(f, (dx, dy), f)
        centered.append(normalize(canvas))
    os.makedirs(OUT, exist_ok=True)
    save_transparent_gif(centered, f"{OUT}/{gid}.gif")
    contact_sheet(centered, gid, densest, edges).save(f"{OUT}/{gid}-sheet.png")
    edge_bad = sum(1 for e in edges if e > 0)
    print(f"  [{gid:16}] {n}f  densest=#{densest}  centroid=({cen[0]:.0f},{cen[1]:.0f}) "
          f"shift=({dx:+d},{dy:+d})  edge-bleed frames={edge_bad}/{n}  -> {gid}.gif")
    return gid


def main():
    done = [g for g in (process(g) for g in FRAMES) if g]
    # overview montage: the densest frame of each grid, side by side
    if done:
        tiles = []
        for g in done:
            im = Image.open(f"{OUT}/{g}-sheet.png").convert("RGB")
            im.thumbnail((900, 200))
            tiles.append(np.array(im))
        w = max(t.shape[1] for t in tiles)
        tiles = [np.pad(t, ((0, 0), (0, w - t.shape[1]), (0, 0)), constant_values=40) for t in tiles]
        Image.fromarray(np.vstack(tiles)).save(f"{OUT}/_overview.png")
        print(f"\noverview -> {OUT}/_overview.png ({len(done)} grids)")


if __name__ == "__main__":
    main()
