"""Python accessor for the shared sprite-coordinate contract.

The values live in src/render/coords.json (single source — the browser and
tools/core/coords.mjs read the same file). Import from here in QA scripts;
never re-declare these constants.
"""
import json
import os

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
with open(os.path.join(_ROOT, "src", "render", "coords.json")) as _f:
    _c = json.load(_f)

CELL_W = _c["cellW"]
CELL_H = _c["cellH"]
FLOOR_FRAC = _c["floorFrac"]
HEADROOM = _c["headroom"]
ART_MARGIN = _c["artMargin"]
SPRITE_FOOT_OFFSET_Y = _c["spriteFootOffsetY"]
ORIGIN_CX = CELL_W / 2
ORIGIN_FEET = FLOOR_FRAC * CELL_H
CHROMA_GREEN = _c["chromaGreen"]
CHROMA_MAGENTA = _c["chromaMagenta"]
