#!/usr/bin/env python3
"""Procedural sprite-sheet QA for Martian Kombat.

Runs over a character's keyed cells and validates them WITHOUT a vision model
where the geometry is decidable procedurally:

  * DWPose (rtmlib / onnxruntime) keypoints per cell  -> where the limbs are
  * alpha-edge check                                  -> nothing trails off frame
  * floor-plane (lowest-alpha sole) per cell          -> everyone on one plane
  * hitbox suggestion from the striking limb          -> stop guessing boxes
  * per-frame-GROUP rules (idle/walk/crouch/block/    -> catch bad generations
    hit-fall-down/punch-reach/kick-extra-limb)

It reads the packed sheet by default (public/assets/sprites/<char>/), or a
raw-frames dir with --frames-dir (keying each frame with the same ffmpeg
chromakey the packer uses). Writes assets/raw/qa/<char>/report.json and a
montage.png of overlays for the cells that need a human/vision second look.

Usage:
  python tools/qa/pose_qa.py --char gene                 # QA the packed sheet
  python tools/qa/pose_qa.py --char vanessa --frames-dir assets/raw/frames/vanessa
  python tools/qa/pose_qa.py --char vanessa --suggest    # print suggested hitboxes
"""
import argparse, json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image
import cv2

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CW, CH = 288, 384
ALPHA_THR = 16
FFMPEG_KEY = "chromakey=0x00B140:0.15:0.06"  # matches tools/pack-sheet.mjs

# The engine renders every sprite at origin (0.5, 0.95) and defines hitboxes
# relative to THAT anchor (worldBox: l = f.x + box.x, t = f.y + box.y). So a
# box aligns with a drawn limb only in this origin space — regardless of where
# the alpha actually sits. Suggestions + overlays therefore use these refs; the
# MEASURED sole/center are reported separately as the floor-normalization target.
ORIGIN_CX = CW / 2          # 144
ORIGIN_FEET = 0.95 * CH     # 365

# COCO-wholebody-133 indices
KP = {"nose": 0, "Lsho": 5, "Rsho": 6, "Lelb": 7, "Relb": 8, "Lwri": 9,
      "Rwri": 10, "Lhip": 11, "Rhip": 12, "Lkne": 13, "Rkne": 14,
      "Lank": 15, "Rank": 16}
LFOOT, RFOOT = [17, 18, 19], [20, 21, 22]     # big toe / small toe / heel
LHAND, RHAND = list(range(91, 112)), list(range(112, 133))

_MODEL = None
def model():
    global _MODEL
    if _MODEL is None:
        from rtmlib import Wholebody
        _MODEL = Wholebody(mode="balanced", backend="onnxruntime", device="cpu")
    return _MODEL


# ---------- image / alpha primitives ----------
def to_bgr(rgba):
    """Flatten an RGBA sprite onto mid-grey so the detector sees a clean figure."""
    im = rgba.convert("RGBA")
    bg = Image.new("RGBA", im.size, (128, 128, 128, 255))
    bg.alpha_composite(im)
    return cv2.cvtColor(np.array(bg.convert("RGB")), cv2.COLOR_RGB2BGR)


def alpha_mask(rgba):
    return (np.array(rgba.convert("RGBA"))[:, :, 3] > ALPHA_THR).astype(np.uint8)


def edge_bleed(mask):
    """How many opaque pixels touch each frame edge (0 everywhere == clean)."""
    return {"top": int(mask[0, :].sum()), "bottom": int(mask[-1, :].sum()),
            "left": int(mask[:, 0].sum()), "right": int(mask[:, -1].sum())}


def alpha_stats(mask):
    ys, xs = np.where(mask > 0)
    if len(xs) == 0:
        return None
    return {"x0": int(xs.min()), "x1": int(xs.max()),
            "y0": int(ys.min()), "y1": int(ys.max()),  # y1 == sole / floor
            "cx": int(round(xs.mean())), "area": int(mask.sum())}


def components(mask):
    """Sizeable connected blobs — >1 hints a detached limb / second figure."""
    m = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, _, stats, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    big = [int(stats[i, cv2.CC_STAT_AREA]) for i in range(1, n)
           if stats[i, cv2.CC_STAT_AREA] > 0.01 * CW * CH]
    return sorted(big, reverse=True)


# ---------- pose ----------
def pose(bgr):
    """Return the most-confident person's keypoints/scores + people count."""
    kpts, scores = model()(bgr)
    if len(kpts) == 0:
        return None, None, 0
    means = [np.nanmean(s) for s in scores]
    best = int(np.argmax(means))
    strong = int(sum(1 for m in means if m > 0.35))
    return kpts[best], scores[best], strong


def kp(k, s, name, thr=0.3):
    i = KP[name]
    if s[i] < thr:
        return None
    return (float(k[i][0]), float(k[i][1]), float(s[i]))


def group_pts(k, s, idxs, thr=0.3):
    pts = [(float(k[i][0]), float(k[i][1])) for i in idxs if s[i] >= thr]
    return pts


# ---------- per-cell analysis ----------
def analyze_cell(rgba, name, native_edge=None):
    # native_edge: edge bleed measured on the FULL-RES keyed frame. Packing
    # scales each frame to fit inside the cell (then pads), which pulls
    # edge-touching content off the edge — so edge bleed must be judged on the
    # native frame, not this scaled cell, or it silently passes.
    mask = alpha_mask(rgba)
    a = alpha_stats(mask)
    bgr = to_bgr(rgba)
    k, s, people = pose(bgr)
    edge = native_edge if native_edge is not None else edge_bleed(mask)
    out = {"name": name, "edge": edge, "alpha": a,
           "components": components(mask), "people": people,
           "kp": {}, "flags": []}
    if k is not None:
        for kn in ["Lwri", "Rwri", "Lank", "Rank", "Lkne", "Rkne",
                   "Lsho", "Rsho", "Lhip", "Rhip", "nose"]:
            p = kp(k, s, kn)
            if p:
                out["kp"][kn] = [round(p[0], 1), round(p[1], 1), round(p[2], 2)]
        out["_k"], out["_s"] = k, s   # kept in-memory only, stripped before json
    # universal flags
    if a is None:
        out["flags"].append("EMPTY: no sprite pixels")
    else:
        tot = sum(edge.values())
        if tot > 0:
            out["flags"].append(f"EDGE_BLEED: {tot}px touch frame edge ({edge})")
    if people == 0:
        out["flags"].append("NO_POSE: DWPose found no figure")
    elif people > 1:
        out["flags"].append(f"MULTI_FIGURE: {people} people detected (extra limb / 2nd character?)")
    return out


# ---------- hitbox suggestion ----------
def _near(joint, pts, r=45):
    """Keep only sub-keypoints within r px of the joint (kills stray outliers)."""
    return [(x, y) for (x, y) in pts
            if (x - joint[0]) ** 2 + (y - joint[1]) ** 2 <= r * r]


def _core(k, s, kind):
    """Body-core anchor the striking limb reaches away from: shoulder-mid for
    hands, hip-mid for feet. Falls back to the frame origin."""
    names = ("Lsho", "Rsho") if kind == "punch" else ("Lhip", "Rhip")
    pts = [kp(k, s, n) for n in names]
    pts = [p for p in pts if p]
    if pts:
        return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
    return (ORIGIN_CX, ORIGIN_FEET * 0.6)


def striking_extremity(cell, kind, facing_right=True):
    """Return (x,y,conf,pts) of the striking hand/foot in cell pixels.

    The striking limb is the extremity reaching FURTHEST from the body core
    (shoulders for hands, hips for feet) — robust for high kicks, overheads and
    downward strikes where "forward-most" would pick the planted/guard limb.
    Sub-keypoints are kept only when they cluster near the joint, so a noisy
    fingertip can't inflate the box.
    """
    k, s = cell.get("_k"), cell.get("_s")
    if k is None:
        return None
    cands = [("Lwri", LHAND), ("Rwri", RHAND)] if kind == "punch" \
        else [("Lank", LFOOT), ("Rank", RFOOT)]
    cx, cy = _core(k, s, kind)
    joints = []
    for jn, sub in cands:
        p = kp(k, s, jn)
        if not p:
            continue
        pts = _near((p[0], p[1]), group_pts(k, s, sub)) + [(p[0], p[1])]
        reach = (p[0] - cx) ** 2 + (p[1] - cy) ** 2
        # bias toward the forward half-space so a cocked rear limb doesn't win
        if (facing_right and p[0] < cx - 20) or (not facing_right and p[0] > cx + 20):
            reach *= 0.4
        joints.append((p[0], p[1], p[2], pts, reach))
    if not joints:
        return None
    best = max(joints, key=lambda j: j[4])
    return best[:4]


def suggest_hitbox(cell, kind, feet_ref, center_ref, pad=26):
    """Box (JSON convention: x forward from center_ref, y up from feet_ref)."""
    ex = striking_extremity(cell, kind)
    if ex is None:
        return None
    xs = [p[0] for p in ex[3]]
    ys = [p[1] for p in ex[3]]
    x0, x1 = min(xs) - pad, max(xs) + pad
    y0, y1 = min(ys) - pad, max(ys) + pad
    return {"x": int(round(x0 - center_ref)), "y": int(round(y0 - feet_ref)),
            "w": int(round(x1 - x0)), "h": int(round(y1 - y0)),
            "conf": round(ex[2], 2)}


# ---------- frame loading ----------
def load_sheet_cells(char):
    meta = json.load(open(f"{ROOT}/public/assets/sprites/{char}/meta.json"))
    sheet = Image.open(f"{ROOT}/public/assets/sprites/{char}/sheet.png")
    cols = meta["cols"]
    cells = {}
    for i, nm in enumerate(meta["frames"]):
        x0, y0 = (i % cols) * CW, (i // cols) * CH
        cells[nm] = sheet.crop((x0, y0, x0 + CW, y0 + CH))
    return cells


def load_raw_cells(frames_dir):
    """Key each raw NN-name.png with ffmpeg (same as packer), return {name: rgba}."""
    files = sorted(f for f in os.listdir(frames_dir)
                   if f[:2].isdigit() and f.endswith(".png"))
    # key AND scale/pad to cell size, exactly like tools/pack-sheet.mjs, so the
    # analysis runs in the same 288x384 space the engine/renderer sees
    vf = (f"{FFMPEG_KEY},scale={CW}:{CH}:force_original_aspect_ratio=decrease,"
          f"pad={CW}:{CH}:(ow-iw)/2:oh-ih:color=0x00000000")
    cells, native_edges = {}, {}
    with tempfile.TemporaryDirectory() as tmp:
        for f in files:
            name = f[3:-4] if f[2] == "-" else f[:-4]
            # native keyed (edge check at full resolution)
            nat = os.path.join(tmp, "nat_" + f)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i",
                            os.path.join(frames_dir, f), "-vf", FFMPEG_KEY,
                            "-frames:v", "1", nat], check=True)
            native_edges[name] = edge_bleed(alpha_mask(Image.open(nat).convert("RGBA")))
            # scaled/padded (pose, hitbox, floor in cell space)
            out = os.path.join(tmp, f)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i",
                            os.path.join(frames_dir, f), "-vf", vf,
                            "-frames:v", "1", out], check=True)
            cells[name] = Image.open(out).convert("RGBA").copy()
    return cells, native_edges


def check_projectiles(frames_dir):
    """Edge-bleed check on projectile art. Raw projectiles are on the green
    screen (no alpha), so key them first — otherwise the whole frame reads as
    opaque and every edge falsely 'bleeds'."""
    issues = []
    with tempfile.TemporaryDirectory() as tmp:
        for f in sorted(os.listdir(frames_dir)):
            if not f.startswith("projectile-") or not f.endswith(".png"):
                continue
            pid = f[len("projectile-"):-4]
            out = os.path.join(tmp, f)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i",
                            os.path.join(frames_dir, f), "-vf", FFMPEG_KEY,
                            "-frames:v", "1", out], check=True)
            eb = edge_bleed(alpha_mask(Image.open(out).convert("RGBA")))
            tot = sum(eb.values())
            if tot > 0:
                issues.append({"name": f"projectile:{pid}", "level": "regen",
                               "msg": f"EDGE_BLEED {tot}px ({eb}) — projectile art must float free of every edge"})
    return issues


# ---------- montage ----------
def draw_overlay(rgba, cell, existing_box, suggested_box, feet_ref, center_ref):
    from rtmlib import draw_skeleton
    canvas = to_bgr(rgba)
    if "_k" in cell:
        canvas = draw_skeleton(canvas, cell["_k"][None], cell["_s"][None], kpt_thr=0.3)
    cv2.line(canvas, (0, int(feet_ref)), (CW, int(feet_ref)), (0, 255, 255), 1)
    if existing_box:
        x = int(center_ref + existing_box["x"]); y = int(feet_ref + existing_box["y"])
        cv2.rectangle(canvas, (x, y), (x + existing_box["w"], y + existing_box["h"]), (0, 0, 255), 2)
    if suggested_box:
        x = int(center_ref + suggested_box["x"]); y = int(feet_ref + suggested_box["y"])
        cv2.rectangle(canvas, (x, y), (x + suggested_box["w"], y + suggested_box["h"]), (0, 200, 0), 2)
    cv2.putText(canvas, cell["name"], (6, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
    if cell["flags"]:
        cv2.putText(canvas, "FLAG", (6, CH - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
    return canvas


def montage(tiles, per_row=4):
    if not tiles:
        return None
    rows = []
    for r in range(0, len(tiles), per_row):
        chunk = tiles[r:r + per_row]
        while len(chunk) < per_row:
            chunk.append(np.full_like(tiles[0], 50))
        rows.append(np.hstack(chunk))
    return np.vstack(rows)


# ---------- group rules ----------
def wrist_x(cell, facing_right=True):
    xs = [cell["kp"][w][0] for w in ("Lwri", "Rwri") if w in cell["kp"]]
    return (max(xs) if facing_right else min(xs)) if xs else None


def run_group_rules(cells, char_json):
    """Cross-cell sanity rules. Returns list of {name, level, msg}."""
    issues = []
    def C(n): return cells.get(n)

    def note(name, level, msg):
        issues.append({"name": name, "level": level, "msg": msg})

    # idle: a/b exist and differ, but subtly (guard shift, not a leap)
    ia, ib = C("idle-a"), C("idle-b")
    if ia and ib and ia.get("alpha") and ib.get("alpha"):
        d = abs(ia["alpha"]["cx"] - ib["alpha"]["cx"]) + abs(ia["alpha"]["y0"] - ib["alpha"]["y0"])
        if d < 3:
            note("idle-b", "flag", "idle-a/idle-b nearly identical — no breathing shift")
        if d > 60:
            note("idle-b", "flag", f"idle shift too large ({d}px) — should be a subtle sway")

    # walk: the two frames should show a real STEP — either the leading foot
    # swaps or a knee lifts. Comparing gap *magnitude* is wrong (a good walk
    # has equal-width opposite strides); compare which foot leads + knee lift.
    wa, wb = C("walk-a"), C("walk-b")
    def front_foot(c):
        ks = c["kp"] if c else {}
        return ("L" if ks["Lank"][0] > ks["Rank"][0] else "R") if ("Lank" in ks and "Rank" in ks) else None
    def knee_lift(c):
        ks = c["kp"] if c else {}
        ys = [ks[k][1] for k in ("Lkne", "Rkne") if k in ks]
        return min(ys) if ys else None
    fa, fb = front_foot(wa), front_foot(wb)
    la, lb = knee_lift(wa), knee_lift(wb)
    if fa and fb and fa == fb and la and lb and abs(la - lb) < 25:
        note("walk-b", "flag", "walk-a/walk-b nearly identical — same lead foot, no visible step")

    # crouch: nose/hip must sit LOW (bottom half), not standing height
    for cn in ("crouch", "block-crouch"):
        c = C(cn)
        if c and "nose" in c["kp"] and c["kp"]["nose"][1] < CH * 0.4:
            note(cn, "flag", f"crouch head at y={c['kp']['nose'][1]:.0f} — not crouching (should be > {CH*0.4:.0f})")

    # block must differ from idle (bracing, not neutral)
    bl, idle = C("block"), C("idle-a")
    if bl and idle and bl.get("alpha") and idle.get("alpha"):
        if abs(bl["alpha"]["cx"] - idle["alpha"]["cx"]) < 4 and abs(bl["alpha"]["area"] - idle["alpha"]["area"]) < 0.03 * idle["alpha"]["area"]:
            note("block", "flag", "block looks like idle — should read as a braced parry")

    # hit / fall / down group
    dn = C("down")
    if dn and dn.get("alpha"):
        w = dn["alpha"]["x1"] - dn["alpha"]["x0"]; h = dn["alpha"]["y1"] - dn["alpha"]["y0"]
        if h > w:
            note("down", "flag", "down should be HORIZONTAL (lying flat), figure is taller than wide")
        if "nose" in dn["kp"] and dn["kp"]["nose"][0] > CW * 0.5:
            note("down", "flag", "down: head should be on the LEFT (fell backward facing right)")

    # punch reach: active wrist must extend beyond the idle guard wrist
    idle_wx = wrist_x(idle) if idle else None
    if idle_wx is not None:
        for b in ("lp", "mp", "hp"):
            c = C(f"{b}-active")
            if not c: continue
            wx = wrist_x(c)
            if wx is not None and wx - idle_wx < 24:
                note(f"{b}-active", "regen", f"no reach: fist x={wx:.0f} barely past idle guard {idle_wx:.0f} — extend the arm further forward")

    # kicks: extra-limb detection (multi-figure or blob split)
    for b in ("lk", "mk", "hk", "clk", "cmk", "chk"):
        c = C(f"{b}-active")
        if not c: continue
        if c["people"] > 1:
            note(f"{b}-active", "regen", "extra limb / second figure — regen: EXACTLY ONE figure, one kicking leg attached at the hip")
        comps = c.get("components", [])
        if len(comps) > 1 and comps[1] > 0.04 * CW * CH:
            note(f"{b}-active", "flag", f"detached blob (areas {comps[:3]}) — possible stray limb")
    return issues


# ---------- floor plane ----------
def feet_reference(cells):
    """Per-character floor plane = median sole y across grounded cells."""
    grounded = ["idle-a", "idle-b", "walk-a", "walk-b", "block",
                "lp-active", "mp-active", "hp-active"]
    soles = [cells[n]["alpha"]["y1"] for n in grounded
             if n in cells and cells[n].get("alpha")]
    return float(np.median(soles)) if soles else 0.95 * CH


def center_reference(cells):
    ia = cells.get("idle-a")
    return float(ia["alpha"]["cx"]) if ia and ia.get("alpha") else CW / 2


# ---------- main ----------
KICK_PUNCH = {"lp": "punch", "mp": "punch", "hp": "punch",
              "lk": "kick", "mk": "kick", "hk": "kick"}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--char", required=True)
    ap.add_argument("--frames-dir")
    ap.add_argument("--suggest", action="store_true")
    args = ap.parse_args()

    proj_issues = []
    if args.frames_dir:
        fdir = os.path.join(ROOT, args.frames_dir)
        rgba_cells, native_edges = load_raw_cells(fdir)
        proj_issues = check_projectiles(fdir)
    else:
        rgba_cells, native_edges = load_sheet_cells(args.char), {}

    cj = {}
    cjp = f"{ROOT}/src/data/characters/{args.char}.json"
    if os.path.exists(cjp):
        cj = json.load(open(cjp))

    cells = {nm: analyze_cell(img, nm, native_edges.get(nm)) for nm, img in rgba_cells.items()}
    # measured floor = normalization target; ORIGIN refs = engine-space for boxes
    measured_floor = feet_reference(cells)
    measured_center = center_reference(cells)

    issues = run_group_rules(cells, cj) + proj_issues

    # hitbox suggestions in engine origin space (drop-in for the JSON)
    suggestions = {}
    for nm, cell in cells.items():
        base = nm.split("-")[0].lstrip("c")
        kind = KICK_PUNCH.get(base)
        if kind and nm.endswith("-active"):
            sug = suggest_hitbox(cell, kind, ORIGIN_FEET, ORIGIN_CX)
            if sug:
                suggestions[nm] = sug

    # montage of flagged/interesting cells
    flagged = [nm for nm, c in cells.items() if c["flags"]] + [i["name"] for i in issues]
    show = [nm for nm in rgba_cells if nm in set(flagged)] or list(rgba_cells)[:12]
    tiles = []
    for nm in show:
        cell = cells[nm]
        base = nm.split("-")[0].lstrip("c")
        ex = (cj.get("moves", {}).get(base, {}) or {}).get("hitbox") if nm.endswith("-active") else None
        tiles.append(draw_overlay(rgba_cells[nm], cell, ex, suggestions.get(nm), ORIGIN_FEET, ORIGIN_CX))
    mont = montage(tiles)

    outdir = f"{ROOT}/assets/raw/qa/{args.char}"
    os.makedirs(outdir, exist_ok=True)
    if mont is not None:
        cv2.imwrite(f"{outdir}/montage.png", mont)

    # strip in-memory arrays before serialising
    for c in cells.values():
        c.pop("_k", None); c.pop("_s", None)
    report = {"char": args.char,
              "origin_feet": ORIGIN_FEET, "origin_cx": ORIGIN_CX,
              "measured_floor": round(measured_floor, 1),
              "measured_center": round(measured_center, 1),
              "floor_drift": round(measured_floor - ORIGIN_FEET, 1),
              "n_cells": len(cells),
              "n_flagged": len(set(flagged)),
              "issues": issues, "suggestions": suggestions, "cells": cells}
    json.dump(report, open(f"{outdir}/report.json", "w"), indent=1)

    # console summary
    print(f"[{args.char}] {len(cells)} cells | measured floor y={measured_floor:.0f} "
          f"(drift {measured_floor - ORIGIN_FEET:+.0f} from origin {ORIGIN_FEET:.0f}) "
          f"center x={measured_center:.0f}")
    print(f"  edge/pose flags: {len(set(nm for nm,c in cells.items() if c['flags']))}")
    for c in cells.values():
        for fl in c["flags"]:
            print(f"    {c['name']:16} {fl}")
    print(f"  group-rule issues: {len(issues)}")
    for i in issues:
        print(f"    [{i['level']:5}] {i['name']:16} {i['msg']}")
    if args.suggest:
        print("  suggested hitboxes (JSON convention):")
        for nm, sg in suggestions.items():
            print(f"    {nm:16} {sg}")
    print(f"  -> {outdir}/report.json + montage.png")


if __name__ == "__main__":
    main()
