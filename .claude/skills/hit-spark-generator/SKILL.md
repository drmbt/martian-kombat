---
name: hit-spark-generator
description: How to generate, validate, and canonize animated hit-spark / impact-VFX overlays for Martian Kombat in a single nano-banana pass (NxN sprite-sheet grids), plus the playback-variety spec that keeps them from looking samey in-game. Use when adding or regenerating impact sparks / hit VFX, building the tintable spark library, or wiring spark playback into the renderer.
---

# Hit-spark generator + playback

Two halves: (A) make the tintable greyscale spark animations cheaply, and (B)
play them back so a small library never looks repetitive. All post-generation
processing is deterministic (numpy/PIL/ffmpeg) — the ONLY model call is the
initial grid generation. Tools live in `tools/qa/`; the committed library is
`public/assets/vfx/sparks/` (`<id>.png` strips + `sparks.json`).

## A. Generation (one model call → a whole animation)

nano-banana reliably emits a clean **NxN grid of sequential animation frames** in
ONE pass (3×3 = 9 frames, 4×4 = 16). `tools/qa/gen-vfx-grid.mjs` prompts it;
`tools/qa/vfx_grid.py` post-processes; `tools/qa/vfx_canonize.py` bakes the
keepers into the library.

### Grid prompt rules (in `gen-vfx-grid.mjs`)
- Ask for an `SxS` grid of SEQUENTIAL frames, frame 1 = first instant → peak →
  faded by the last cell, evenly spaced, **NO drawn gridlines/borders/numbers**.
- **STRICTLY GREYSCALE** (white core → grey → dark grey), **NO color** — sparks
  are tinted per-attacker at runtime.
- **FLAT MAGENTA `#FF00FF` background** (never green — sparks read as white/grey
  and would die in a green key).
- **Never touch the edge:** "each effect stays in the central ~60–65% of its
  cell with margin, never touching a cell edge."
- Style dial: `painted cel arcade` vs `anime / DBZ ki-energy` vs
  `sparse + asymmetric`. Anime/DBZ + noise/rotation gave the best hits.

### Effect archetypes (pick to match the need)
- **Compact burst** (impact-burst, ki-scatter, double-shockstar): sharp,
  self-contained, stays clear of edges → cleanest, works at 9 frames.
- **Sparse / asymmetric** (diag-slash, claw-rake, ember-flick, spark-spit,
  splinter-shard, noise-fizz): off-center, gestural, jagged, lots of negative
  space → the most *reusable* because rotation/mirror transforms them (see B).
- **Radial / full-cell** (ring-shockwave, speed-impact): fill the cell by
  nature — they WILL touch edges; either accept it (fine for a tintable overlay)
  or use the boomerang truncate. Don't fight it with the margin rule.

### Hard-won prompt lessons
- **Scope noise to the EFFECT, not the frame.** "gritty/torn" pushed too hard
  makes the model fill the whole cell (incl. background) with grey noise, which
  defeats the magenta key (jagged-tear failed this way; noise-fizz kept the
  noise sparse *on magenta* and worked). A frame whose background isn't clean
  magenta shows as constant full-frame alpha — the edge check catches it.
- **Directional effects need the sweep spelled out** or they read as flicker.

### Deterministic post-processing (`vfx_grid.py`, zero model calls)
1. **key** the magenta (`chromakey=0xFF00FF:0.18:0.08`).
2. **slice** into NxN cells, **inset ~6%** — nano-banana often draws faint cell
   gridlines; the inset drops them (turned heavy-pow from 9/9 edge-bleed to 2/9).
3. **greyscale-normalize** each frame (force RGB→luma) — kills the pink key
   fringe; correct since sparks are greyscale + tinted. Erode alpha 1px.
4. **centroid-center:** find the densest (peak) frame, shift ALL frames by one
   uniform offset so that centroid is centered — stabilizes the loop.
5. **validate:** per-frame edge-bleed; constant full-frame alpha = failed key.
6. **boomerang (optional, `vfx_grid_boomerang.py`):** for an effect that touches
   an edge, keep frames BEFORE first contact and play forward+reversed → a clean
   bloom-and-recede loop that never clips. Smoothness = how many clean frames
   existed (energy-flare had 7 → smooth; early-touchers give 4-frame pops).
7. **canonize (`vfx_canonize.py`):** the keepers → `sparks/<id>.png` horizontal
   strips (128px frames) + `sparks.json` (`frames`, `fw/fh`, `fps`, **`tags`**).

## B. Playback — keep a small library from looking samey

All spark playback is RENDER-side (`presentTick` state-diff in FightScene) — it
does NOT touch the sim, so it's free to vary. **Derive every "random" choice from
a deterministic hash (tick + slot + hit-count)** — like the CPU's tick-hash
decisions — so replays and netcode stay pixel-identical (`Math.random` is
cosmetically fine but off-brand). Levers, biggest first:

1. **Pool + pick-per-hit (the #1 fix).** Never bind one spark to a move. Bind a
   TAG pool and pick one each hit: light normals → a `light` spark, heavies →
   `heavy`, bladed → `slash`, energy specials → `energy`. Randomizing the sprite
   itself removes most repetition before any transform.
2. **Per-move / per-character override.** Reuse the existing `vfx` block pattern:
   a move or character JSON sets `sparkTags:["slash"]` or a specific
   `spark:"claw-rake"`; default = the strength pool. This is how you "limit
   certain sparks to certain movesets" (Catherine staff → slash, Gene glitch →
   energy) with no engine change.
3. **Rotate + mirror.** Random flipX + rotation per spawn. Radial sparks need
   only subtle spin; DIRECTIONAL ones (slash/claw/spit/ember/splinter) transform
   completely — rotate roughly along the attack vector, then jitter ±20°.
4. **Position jitter.** Spawn at the hitbox∩hurtbox OVERLAP point (not the box
   center) + a few px jitter. Nothing lands identically twice.
5. **Scale + layering by strength.** Light = one small spark; heavy = one bigger
   + a second overlapping spark at an offset/rotation. Scale jitter ±15%.
6. **Speed.** Play ONCE (don't loop) at ~24–30fps so the pop is ~0.3–0.5s, timed
   to land inside the hitstop freeze. Heavies a touch bigger/slower.
7. **Start frame — nuance.** IMPACT sparks start at frame 0 (the flash IS the
   contact; starting mid-anim loses the punch). Start-frame jitter is for
   SUSTAINED/ambient effects (auras, lingering fields), not hits.
8. **Tint** already gives cross-character variety (attacker color) for free.

Samesey-killer stack: **random spark from a tag pool → rotate/mirror to the
attack angle → jitter position/scale → layer for heavies → deterministic-hash it
all.** Sprint 24 (SPRINTBOARD) tracks wiring this into the renderer.

## Commands
```
node tools/qa/gen-vfx-grid.mjs            # generate NxN spark grids (edit SPARKS)
python3 tools/qa/vfx_grid.py              # key/inset/normalize/center/validate + gif previews
python3 tools/qa/vfx_grid_boomerang.py    # <id>-2.gif truncated bloom-and-recede loops
python3 tools/qa/vfx_canonize.py          # bake keepers -> public/assets/vfx/sparks/ + tags
```
