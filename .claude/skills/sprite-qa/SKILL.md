---
name: sprite-qa
description: Canonical workflow for creating and validating a character's sprite sheet in Martian Kombat — RTMPose/alpha deterministic QA, pose-measured hitboxes, floor normalization, sequential specials, projectile handling, and pose-centered portraits. Use whenever generating, regenerating, packing, or validating character frames, projectiles, hitboxes, or bust portraits.
---

# Character sprite creation & QA (canonical)

**QA POSTURE (Sprint 27, locked 2026-07-08): MINIMAL.** Human review in the
studio/game is the primary QA path. What's load-bearing now: local skeleton
inference (hitboxes need it — always local Python; fal is shipped-prod only,
never dev) and a vision look at the MAIN reference images (canonical +
crouch/jump anchors) before they seed everything downstream. The full
pose-rule battery below is documented but OPTIONAL — run it only when asked;
never automate validate→regenerate loops (one re-roll per asset, max).

Shared machinery: coordinate constants come from `src/render/coords.json`
via `tools/qa/coords.py` / `tools/core/coords.mjs` — never re-declare
FLOOR_FRAC/HEADROOM/CELL dims. The pack path is `tools/core/packer.mjs`
(CLI `gen:pack`, dev `/__editor/pack`, creator SHIP — all the same code);
meta.json is v2 (`version/floorFrac/headroom/normalized`). Sprite-Editor
edits persist as overlays in `assets/raw/edits/<id>/` and survive re-packs;
creator-written frame dirs carry a `.cellspace` marker (already keyed +
cell-space — the packer copies them through instead of re-keying).

The deterministic principle still applies when QA does run: **validate
deterministically, never with vision unless forced.** Every check below is
numpy/OpenCV or local RTMPose (ONNX) — zero LLM tokens. A vision call happens
at most once per QA run, on a single labeled montage of the cells that already
FAILED a deterministic check.

Tooling lives in `tools/qa/` (Python; `pip install -r tools/qa/requirements.txt`,
rtmlib auto-downloads RTMPose weights). Run QA with `npm run gen:qa`; bust
crops with `npm run gen:busts`.

## Pipeline order (do NOT reorder)

1. `gen:frames --char <id>` — generate raw frames + projectiles.
2. `gen:qa --char <id> --frames-dir assets/raw/frames/<id>` — validate the
   **raw/keyed native frames**, BEFORE packing.
3. Fix flagged cells (targeted `--cells` re-roll), re-run QA until clean.
4. `gen:pack --char <id> --normalize` — the final bake. QA is already done.
5. `gen:qa --char <id> --hitbox-grid` (against the PACKED sheet — omit
   `--frames-dir`) — every cell in sheet order, skeleton + the move's JSON
   hitbox in red, as one image at `assets/raw/qa/<id>/hitbox-grid.png`
   (`--per-row N` to reflow, default 8). Purely a visual sanity pass over
   the final hitboxes post-normalize; doesn't affect pass/fail.

**Never QA the packed sheet.** Packing scales each frame to fit inside the cell
and pads, which pulls edge-touching content off the edge and hides bleed. Edge
checks are only valid on the native frame.

## Generation rules

- **Facing:** every character always faces RIGHT (P1 perspective). Attacks,
  projectiles, and "forward" all mean toward the right frame edge.
- **No trailing off the edge:** the whole figure sits inside the frame with a
  green margin on all four sides. Any alpha touching an edge becomes a hard
  keyed line — regenerate.
- **Specials render SEQUENTIALLY**, never concurrently. Each phase references
  every earlier phase of the same special (+ the projectile + any inspo image)
  so startup/active/recovery stay visually coherent.
- **Projectile-first:** for a projectile-bearing special, generate the
  projectile art FIRST, then let startup/active reference it (so the thrower's
  release matches the shot).
- **Projectiles reference ONLY explicit inspo images, never the canonical** —
  the canonical drags the whole character into the projectile (the chocolate
  head lesson). The prompt already carries the style; use `no person, no hands,
  isolated object, wide green margin` language.
- **All FX must be keyable:** violet / silver-white / blue / gold / amber —
  NEVER green. Green glow, green vines, green runes vanish on the chroma key.
- **Idle + walk are authored as a batch** (they read as one loop).

## Per-frame-group validation

Compare RTMPose skeletons across related cells; regenerate with sharper prompt
verbage when a group fails.

- **idle-a / idle-b:** a subtle, distinct breathing shift (classic Ryu idle /
  boxer shuffle) — different from each other but NOT a flashy pop.
- **walk-a / walk-b:** a real step — the lead foot swaps or a knee lifts; the
  two frames and the idle must be visibly distinct. (Check lead-foot/knee-lift,
  not gap magnitude — equal-width opposite strides is correct.) The image model
  anchors hard to the canonical stance; break it with `MID-STEP, one knee
  lifted, narrow base, IGNORE the reference's wide stance` language.
- **crouch / block-crouch:** actually low — head in the bottom half of the frame.
- **block:** a braced defensive parry, clearly NOT the idle pose.
- **hit → fall → down** (validate as a group; they're one sequence):
  hit = snapped back, in pain; fall = further back, off balance; down = flat on
  the SAME bottom-y plane as the canonical, HEAD ON THE LEFT (fell backward
  facing right), horizontal, not flipped.
- **punch groups (lp/mp/hp + crouch):** the striking fist must extend clearly
  BEYOND the idle/canonical guard — there must be reach/contrast. If not,
  regenerate with "extend the arm further forward." (Overhead heavies are
  vertical — exempt from the horizontal-reach check.)
- **kick groups:** exactly ONE figure and ONE kicking leg. The common failure
  is the canonical pose PLUS a third kicking leg — RTMPose "2 people" or a second
  large alpha blob flags it. Regenerate: "EXACTLY ONE figure, one kicking leg
  attached at the hip."
- **specials:** the prompt should place the effect where the move's HITBOX is
  meant to be. Expected false positive: RTMPose reports "2 people" on a
  projectile-throw frame when the projectile is face/figure-like — ignore it.

## Hitboxes from the pose skeleton (stop guessing)

- **Author flow:** start a new character's JSON from the canonical + its
  skeleton — derive the move list, estimated hitboxes, and ranges from where the
  limbs actually are. After generation, compare the per-frame skeletons to the
  hitboxes and adjust.
- Each active cell's hitbox is measured from the striking extremity (forward-
  most wrist for punches, extremity furthest from the body core for kicks) in
  engine origin space (center x = 144, feet y = 0.95×384 = 365).
- **Confidence gate:** apply the measured box only when the striking limb is
  forward (x ≥ ~-20) and keypoint confidence ≥ 0.75; otherwise keep the estimate
  and FLAG it. Low confidence (heavy VFX, occlusion) → human/vision review.
- **Grab range from the throw pose (2026-07-05):** the universal throw's
  `grab.range` shouldn't be eyeballed either — `pose_qa.py` measures how far
  the reaching hand extends from body-center on the `throw-active` cell
  (same striking-extremity logic as punches) and reports it as
  `grab_suggestion` in `report.json` / the console summary. A character with
  long reach (grappler build) measures a bigger number than a compact one —
  use it as the JSON `grab.range` starting point, same confidence gate as
  hitboxes. It's descriptive only (no pass/fail — a throw pose has no "wrong"
  answer the way a crouch height does), so it never blocks a QA run.

## Floor normalization

Every fighter stands on one plane. The lowest-alpha row (sole) is the floor
marker. Compute the character's floor from the median sole of the GROUNDED cells
and shift EVERY cell by that one constant delta so the floor lands on the origin
plane (`gen:pack --normalize`). One per-character shift — never per-frame (that
jitters); airborne cells (jump/fall/j*) are excluded from the measurement.

## Projectile rules

- **Size from alpha:** measure the projectile's alpha bounding box (max x/y
  extent) to size it; center it in its own frame.
- **Emit offset:** spawn from the correct source on the thrower — fist keypoint,
  mouth/nose keypoint, or the figure's min-y (overhead) — derived from the
  active frame's skeleton, not guessed.
- **Never touch the edge:** projectile alpha must float free of all four edges
  (keyed check; regenerate if it bleeds).

## Portraits (bust)

Busts (`public/assets/portraits/<id>-bust.png`) are **pose-centered crops** of
the canonical, framed off the head keypoints (fixed eye-line, consistent head-
to-crop scale) so every character matches — never a fixed crop box
(`tools/qa/portrait_crop.py --all`). The straight-on `<id>.png` selector icon is
a SEPARATE generated asset (`gen-icons`) and must NOT be overwritten by the bust
crop.

**KO / defeated bust (`<id>-ko.png`, `gen-canonical`).** Roster convention
(`defeatPrompt` in `tools/core/prompts.mjs`): the head is **tilted / lolling to
one side, chin dropped toward a shoulder** — beaten and dazed, three-quarter to
the viewer, NEVER upright-square-on or a full profile. The KO's PRIMARY face
reference is the shipped straight-on portrait (`public/assets/portraits/<id>.png`),
then the canonical for outfit/style — so the KO matches the select-screen face.
Regenerate just the KO without touching an approved canonical/portrait by
deleting `assets/raw/canonical/ko/<id>.png` + `public/assets/portraits/<id>-ko.png`
and running `gen-canonical --char <id>` WITHOUT `--force` (the existing
canonical/portrait skip, only the KO rebuilds).

## Confidence / when to escalate to vision

Trust the deterministic verdict when: one figure detected, keypoint confidence
high, no edge bleed, group rules pass. Escalate to a SINGLE batched vision call
(one labeled ffmpeg montage of only the failing cells) when: keypoints are low-
confidence, a special uses props the skeleton can't read, or a group rule fires
that geometry can't disambiguate. Never make per-cell vision calls.
