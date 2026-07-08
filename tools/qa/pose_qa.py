#!/usr/bin/env python3
"""Procedural sprite-sheet QA for Martian Kombat.

Runs over a character's keyed cells and validates them WITHOUT a vision model
where the geometry is decidable procedurally:

  * RTMPose (rtmlib / onnxruntime) keypoints per cell  -> where the limbs are
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

from coords import CELL_W as CW, CELL_H as CH, HEADROOM, FLOOR_FRAC, ORIGIN_CX, ORIGIN_FEET, CHROMA_GREEN

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ALPHA_THR = 16
FFMPEG_KEY = f"chromakey=0x{CHROMA_GREEN}:0.15:0.06"  # matches tools/pack-sheet.mjs

# The engine renders every sprite at origin (0.5, FLOOR_FRAC) and defines
# hitboxes relative to THAT anchor (worldBox: l = f.x + box.x, t = f.y + box.y).
# So a box aligns with a drawn limb only in this origin space — regardless of
# where the alpha actually sits. Suggestions + overlays therefore use these refs;
# the MEASURED sole/center are reported separately as the normalization target.
# All coordinate constants come from tools/qa/coords.py (single shared source).

# COCO-wholebody-133 indices
KP = {"nose": 0, "Lsho": 5, "Rsho": 6, "Lelb": 7, "Relb": 8, "Lwri": 9,
      "Rwri": 10, "Lhip": 11, "Rhip": 12, "Lkne": 13, "Rkne": 14,
      "Lank": 15, "Rank": 16}
LFOOT, RFOOT = [17, 18, 19], [20, 21, 22]     # big toe / small toe / heel
LHAND, RHAND = list(range(91, 112)), list(range(112, 133))

# Full COCO-wholebody-133 index -> name. Body names match KP above (so the
# 11-joint consumers keep working); feet/face/hands get grouped names so the
# in-editor skeleton overlay + auto-hitbox can use the same clusters DWPose
# (and the QA montage) draw. Baked into meta.json by tools/pack-sheet.mjs.
WB_NAMES = [None] * 133
for _i, _n in {0: "nose", 1: "Leye", 2: "Reye", 3: "Lear", 4: "Rear",
               5: "Lsho", 6: "Rsho", 7: "Lelb", 8: "Relb", 9: "Lwri", 10: "Rwri",
               11: "Lhip", 12: "Rhip", 13: "Lkne", 14: "Rkne", 15: "Lank", 16: "Rank",
               17: "Lbigtoe", 18: "Lsmalltoe", 19: "Lheel",
               20: "Rbigtoe", 21: "Rsmalltoe", 22: "Rheel"}.items():
    WB_NAMES[_i] = _n
for _i in range(23, 91):
    WB_NAMES[_i] = f"face_{_i - 23}"
for _i in range(91, 112):
    WB_NAMES[_i] = f"lhand_{_i - 91}"
for _i in range(112, 133):
    WB_NAMES[_i] = f"rhand_{_i - 112}"


def named_keypoints(k, s, thr=0.3):
    """Body + feet + hands COCO-wholebody points above `thr`, as
    {name: [x, y, conf]}. Face points (face_*) are dropped — the game skeleton
    overlay doesn't use them and they ~7x the baked meta.json size."""
    out = {}
    for i, name in enumerate(WB_NAMES):
        if name is None or name.startswith("face_"):
            continue
        if s[i] >= thr:
            out[name] = [round(float(k[i][0]), 1), round(float(k[i][1]), 1), round(float(s[i]), 2)]
    return out

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
        out["kp"] = named_keypoints(k, s)  # full 133-point wholebody set
        out["_k"], out["_s"] = k, s   # kept in-memory only, stripped before json
    # universal flags
    if a is None:
        out["flags"].append("EMPTY: no sprite pixels")
    else:
        tot = sum(edge.values())
        if tot > 0:
            out["flags"].append(f"EDGE_BLEED: {tot}px touch frame edge ({edge})")
    if people == 0:
        out["flags"].append("NO_POSE: RTMPose found no figure")
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

    The striking limb is the one extended toward the OPPONENT, scored by
    DIRECTIONAL reach — forward distance (toward the facing edge) plus a bonus
    for height above the body core. Undirected Euclidean distance is wrong: a
    support leg hanging straight DOWN sits ~120px below the hips and would beat
    a horizontal kicking leg extended forward (this is exactly how lk/mk/clp
    used to mis-pick the planted foot). Forward reach + up-bonus handles high
    kicks and overhead punches (up + forward) while a support limb dangling
    below core scores ~0 and can't win. Sub-keypoints are kept only when they
    cluster near the joint, so a noisy fingertip can't inflate the box.
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
        fwd = (p[0] - cx) if facing_right else (cx - p[0])  # signed toward opponent
        up = max(0.0, cy - p[1])  # height above core (0 for a limb below it)
        reach = fwd + 0.5 * up
        joints.append((p[0], p[1], p[2], pts, reach))
    if not joints:
        return None
    best = max(joints, key=lambda j: j[4])
    return best[:4]


# Confidence-gate constants for auto-applying a measured suggestion.
# CONF_THRESHOLD is a RTMPose keypoint-detection PROBABILITY (0-1, model-
# intrinsic) — it's already scale-free, so it does NOT need normalizing
# against character size the way a pixel distance does. Set to 0.6
# (2026-07-05): once the forward-limb selection bug was fixed, the cells that
# land in the 0.6-0.75 band are the correct limb only partly occluded by
# cloak/FX, so their boxes are trustworthy; a genuinely wrong detection reads
# well below 0.6. The forward-limb check remains the hard safety gate.
# FORWARD_GATE_FRAC/REACH_GAIN_FRAC ARE pixel-based, so each is expressed as
# a fraction of that character's own measured size (character_scale) instead
# of one fixed pixel count for the whole roster — a compact character and a
# tall/long-limbed one get proportionally fair gates.
CONF_THRESHOLD = 0.6
FORWARD_GATE_FRAC = 0.07
REACH_GAIN_FRAC = 0.08
DEFAULT_SCALE = 300.0  # fallback if idle-a's alpha can't be measured


def character_scale(cells):
    """Per-character size reference for the fractional gates: idle-a's own
    alpha bbox height (a taller/bigger-bodied character measures bigger)."""
    ia = cells.get("idle-a")
    if ia and ia.get("alpha"):
        h = ia["alpha"]["y1"] - ia["alpha"]["y0"]
        if h > 0:
            return h
    return DEFAULT_SCALE


def passes_gate(sug, scale, force=False):
    """Should this measured suggestion be trusted and auto-applied?

    The forward-limb check is a HARD safety gate (a box behind the character
    is never acceptable) and is enforced even under --force. The confidence
    check is a soft trust bar that --force waives — appropriate once the limb
    is correctly selected and only occlusion is dragging the score down."""
    if sug is None:
        return False, "no measurement"
    if sug["x"] < -FORWARD_GATE_FRAC * scale:
        return False, f"limb behind center (x={sug['x']}, gate={-FORWARD_GATE_FRAC*scale:.0f})"
    if not force and sug["conf"] < CONF_THRESHOLD:
        return False, f"confidence {sug['conf']:.2f} < {CONF_THRESHOLD}"
    return True, "ok"


def suggest_grab_range(cell, center_ref):
    """How far the reaching hand extends from body-center on the throw's
    active frame — a measured starting point for the move's grab.range,
    instead of guessing (or copying another character's number)."""
    ex = striking_extremity(cell, "punch")
    if ex is None:
        return None
    return {"x": round(ex[0] - center_ref, 1), "conf": round(ex[2], 2)}


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
    # key AND scale/pad to cell size, exactly like tools/pack-sheet.mjs
    # (same HEADROOM safe-zone), so the analysis runs in the same 288x384 space
    # the engine/renderer sees and the skeleton stays registered with the art
    vf = (f"{FFMPEG_KEY},scale={CW}:{CH - 2 * HEADROOM}:force_original_aspect_ratio=decrease,"
          f"pad={CW}:{CH}:(ow-iw)/2:{CH - HEADROOM}-ih:color=0x00000000")
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

    # punch reach: active wrist must extend beyond the idle guard wrist, by a
    # margin scaled to THIS character's own size (a compact character and a
    # long-limbed one shouldn't share one fixed pixel count)
    scale = character_scale(cells)
    idle_wx = wrist_x(idle) if idle else None
    if idle_wx is not None:
        for b in ("lp", "mp", "hp"):
            c = C(f"{b}-active")
            if not c: continue
            wx = wrist_x(c)
            if wx is not None and wx - idle_wx < REACH_GAIN_FRAC * scale:
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
    return float(np.median(soles)) if soles else ORIGIN_FEET


def center_reference(cells):
    ia = cells.get("idle-a")
    return float(ia["alpha"]["cx"]) if ia and ia.get("alpha") else CW / 2


# ---------- main ----------
KICK_PUNCH = {"lp": "punch", "mp": "punch", "hp": "punch",
              "lk": "kick", "mk": "kick", "hk": "kick"}
CROUCH_KICK_PUNCH = {f"c{k}": v for k, v in KICK_PUNCH.items()}
AIR_KICK_PUNCH = {f"j{k}": v for k, v in KICK_PUNCH.items()}
PHASE_SUFFIXES = ("-startup", "-active", "-recovery")


def move_id_for(nm):
    """Cell name -> the character-JSON move key. Cells are named
    '<moveId>-startup|active|recovery' for everything EXCEPT air attacks,
    whose single cell IS the move id ('jlp', not 'jlp-active') — so only
    strip a phase suffix when one is actually present. Do NOT split on the
    first hyphen: multi-word special ids (cloud-hands, rising-glyph,
    diffusion-strike...) contain hyphens themselves."""
    for suf in PHASE_SUFFIXES:
        if nm.endswith(suf):
            return nm[: -len(suf)]
    return nm


def is_active_cell(nm):
    """True for any cell that represents a move's damage-dealing frame —
    '<id>-active' for stand/crouch/specials, or the bare air-move cell
    ('jlp' etc, which has no separate startup/active/recovery split)."""
    return nm.endswith("-active") or move_id_for(nm) in AIR_KICK_PUNCH

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--char", required=True)
    ap.add_argument("--frames-dir")
    ap.add_argument("--suggest", action="store_true")
    ap.add_argument("--hitbox-grid", action="store_true",
                     help="export every cell, in sheet order, with its JSON hitbox "
                          "(red) and skeleton superimposed, as one big grid image")
    ap.add_argument("--per-row", type=int, default=8)
    ap.add_argument("--calibrate", action="store_true",
                     help="write confidence-gated measured hitboxes straight into "
                          "the character JSON for every move that has one; anything "
                          "that fails the gate is left untouched and reported")
    ap.add_argument("--force", action="store_true",
                     help="with --calibrate, waive the confidence bar (still keeps "
                          "the forward-limb safety check) so correct-limb but "
                          "occlusion-lowered measurements get applied too")
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

    # hitbox suggestions in engine origin space (drop-in for the JSON).
    # Named specials aren't in the punch/kick maps by cell name; if the JSON
    # already carries a real (non-null) hitbox for one, default the
    # measurement to a hand-strike (most melee specials are arm/palm-based —
    # imperfect for a kick-based special, but a reasonable default; flagged
    # by the low confidence a genuinely wrong kind usually produces anyway).
    suggestions = {}
    for nm, cell in cells.items():
        mv = move_id_for(nm)
        kind = KICK_PUNCH.get(mv) or CROUCH_KICK_PUNCH.get(mv) or AIR_KICK_PUNCH.get(mv)
        if not kind and is_active_cell(nm):
            existing = (cj.get("moves", {}).get(mv, {}) or {}).get("hitbox")
            if existing is not None:
                kind = "punch"
        if kind and is_active_cell(nm):
            sug = suggest_hitbox(cell, kind, ORIGIN_FEET, ORIGIN_CX)
            if sug:
                suggestions[nm] = sug

    # grab.range suggestion: how far the throw's reaching hand extends from
    # body-center on its active frame (v2 "throw-active" or legacy "throw")
    grab_suggestion = None
    for nm in ("throw-active", "throw"):
        if nm in cells:
            grab_suggestion = suggest_grab_range(cells[nm], measured_center)
            break

    # Hitbox calibration is computed on EVERY run (advisory), applied only
    # with --calibrate. Walk every move that currently has a real (non-null)
    # hitbox — that's "should have one" — not just punch/kick-named cells, so
    # a named special with an authored box gets checked too. A gated proposal
    # that meaningfully DIFFERS from the current box is surfaced as a "propose"
    # advisory: QA never rewrites it, it just tells you the box is off and by
    # how much. A plain run flags; --calibrate writes exactly this set.
    scale = character_scale(cells)
    DRIFT_FRAC = 0.05  # ignore sub-5%-of-body-height nudges as noise
    calibration = {"changed": [], "skipped": []}
    for mid, mv in (cj.get("moves") or {}).items():
        if mv.get("hitbox") is None:
            continue  # projectile/grab/teleport/reflect — no box by design
        cell_nm = f"{mid}-active" if f"{mid}-active" in cells else (mid if mid in cells else None)
        sug = suggestions.get(cell_nm) if cell_nm else None
        ok, reason = passes_gate(sug, scale, force=args.force)
        if not ok:
            calibration["skipped"].append({"move": mid, "reason": reason, "measured": sug})
            continue
        old = mv["hitbox"]
        new = {k: sug[k] for k in ("x", "y", "w", "h")}
        drift = max(abs(new[k] - old.get(k, 0)) for k in ("x", "y", "w", "h"))
        if drift < DRIFT_FRAC * scale:
            continue  # measured box already matches the authored one — no advice
        entry = {"move": mid, "old": old, "new": new, "conf": sug["conf"], "drift": drift}
        if args.calibrate:
            mv["hitbox"] = new
        calibration["changed"].append(entry)
    if args.calibrate:
        with open(cjp, "w") as f:
            json.dump(cj, f, indent=2)
            f.write("\n")

    # montage of flagged/interesting cells
    flagged = [nm for nm, c in cells.items() if c["flags"]] + [i["name"] for i in issues]
    show = [nm for nm in rgba_cells if nm in set(flagged)] or list(rgba_cells)[:12]
    tiles = []
    for nm in show:
        cell = cells[nm]
        mv = move_id_for(nm)
        ex = (cj.get("moves", {}).get(mv, {}) or {}).get("hitbox") if is_active_cell(nm) else None
        tiles.append(draw_overlay(rgba_cells[nm], cell, ex, suggestions.get(nm), ORIGIN_FEET, ORIGIN_CX))
    mont = montage(tiles)

    outdir = f"{ROOT}/assets/raw/qa/{args.char}"
    os.makedirs(outdir, exist_ok=True)
    if mont is not None:
        cv2.imwrite(f"{outdir}/montage.png", mont)

    if args.hitbox_grid:
        grid_tiles = []
        for nm in rgba_cells:
            cell = cells[nm]
            mv = move_id_for(nm)
            ex = (cj.get("moves", {}).get(mv, {}) or {}).get("hitbox") if is_active_cell(nm) else None
            grid_tiles.append(draw_overlay(rgba_cells[nm], cell, ex, None, ORIGIN_FEET, ORIGIN_CX))
        grid = montage(grid_tiles, per_row=args.per_row)
        if grid is not None:
            out_path = f"{outdir}/hitbox-grid.png"
            cv2.imwrite(out_path, grid)
            print(f"  -> {out_path} ({len(grid_tiles)} cells, red = JSON hitbox)")

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
              "issues": issues, "suggestions": suggestions,
              "grab_suggestion": grab_suggestion, "calibration": calibration,
              "cells": cells}
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
    if grab_suggestion:
        print(f"  measured grab reach: {grab_suggestion['x']}px from center "
              f"(conf {grab_suggestion['conf']}) — starting point for grab.range")
    if args.suggest:
        print("  suggested hitboxes (JSON convention):")
        for nm, sg in suggestions.items():
            print(f"    {nm:16} {sg}")
    # Hitbox advisory: always shown. A plain run PROPOSES (flags only);
    # --calibrate applies the exact same proposals.
    verb = "applied" if args.calibrate else "proposed"
    if calibration["changed"]:
        print(f"  hitbox calibration ({verb} — pass --calibrate to write): "
              f"{len(calibration['changed'])} off vs measured (scale={scale:.0f}px)")
        for c in calibration["changed"]:
            print(f"    [{verb:8}] {c['move']:16} conf={c['conf']:.2f} drift={c['drift']:.0f}px  "
                  f"{c['old']} -> {c['new']}")
    if calibration["skipped"]:
        print(f"  hitbox calibration skipped (gate not met — needs human/vision): "
              f"{len(calibration['skipped'])}")
        for s in calibration["skipped"]:
            print(f"    [skipped ] {s['move']:16} {s['reason']}")
    if args.calibrate and calibration["changed"]:
        print(f"  -> wrote {cjp}")
    print(f"  -> {outdir}/report.json + montage.png")


if __name__ == "__main__":
    main()
