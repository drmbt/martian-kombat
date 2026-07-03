# Stage Template

Generated stages are packed to `1680x720` and displayed in-game at `960x540`.
Ultra-wide art is scaled to full game height and horizontally parallax-cropped.

Use this guide image when designing or reviewing stage art:

- [`stage-template-1680x720.png`](stage-template-1680x720.png)
- [`stage-template-1680x720.svg`](stage-template-1680x720.svg) is the editable source.
- [`stage-layer-variants-1680x720.png`](stage-layer-variants-1680x720.png)
  shows the one-, two-, and three-layer parallax variants.
- [`stage-layer-variants-1680x720.svg`](stage-layer-variants-1680x720.svg)
  is the editable source for the variant guide.

## Engine Anchors

| Engine | Game px | Stage-art px |
| --- | ---: | ---: |
| Canvas size | 960x540 | 1680x720 |
| Floor contact line (`FLOOR_Y`) | y=460 | y=613 |
| Bottom edge | y=540 | y=720 |

## Composition Guide

- Horizon/deep background: roughly `y=230-320` in the `1680x720` image.
- Main landmarks and readable stage identity: `y=220-500`.
- Walkable floor begins visually: around `y=500`.
- Fighter foot/contact line: `y=613`.
- Clear fighter strip: keep `y=560-700` free of props, people, walls, furniture,
  vehicles, rails, or high-contrast objects that would sit under fighter feet.
- Ground texture must continue to the bottom edge. Do not create a flat border,
  vignette, empty band, or separate UI-like strip at the bottom.

## Perspective

The floor should read as a shallow receding plane, not a flat horizontal band.
Use texture lines, plank seams, cracks, gravel trails, or light/shadow streaks
that angle subtly toward the horizon. Keep the plane continuous across the full
width so fighters can stand anywhere from left wall to right wall.

## Prompt Patch

Add this to stage prompts when regenerating:

```text
STAGE LAYOUT TEMPLATE: final packed image is 1680x720. The fighting floor is a
continuous shallow perspective plane. Its visible near edge touches the bottom
of the image at y=720. The fighter foot/contact line is around y=613, so the
area around y=560-700 must be open, textured walkable ground with no props,
people, furniture, vehicles, rails, walls, or high-contrast clutter crossing it.
The floor should visually begin around y=500 and recede toward a horizon around
y=260-310 using subtle angled texture lines/cracks/planks/gravel perspective.
Put stage landmarks in the middle distance above the fighter strip.
```

## Optional Parallax Layers

Current stages are single flattened images. For stronger depth, use optional
per-stage layer files with the same `1680x720` canvas. Keep the floor on the
nearest layer that it visually blends into; do not force a separate floor layer
when it would create a visible seam.

```text
public/assets/backgrounds/stages/<id>/
  sky.png       # optional far sky / mountains, slowest x movement
  back.png      # optional distant structures / horizon objects
  stage.png     # required main layer: floor + anything that must seam with it
```

Allowed variants:

- `sky + back + stage`: best case for outdoor scenes with clean depth bands.
- `sky + stage`: good when floor, midground, and landmarks are visually linked.
- `stage`: flattened fallback, equivalent to the current single-image stages.

Recommended scroll factors relative to the current fighter-midpoint parallax:

| Layer | Factor | Content |
| --- | ---: | --- |
| `sky` | 0.15 | sky, sun, far mountains, clouds |
| `back` | 0.40 | distant structures, horizon landmarks |
| `stage` | 1.00 | walkable floor, near props, anything touching the fighter strip |

The `stage` layer owns the exact floor contract from this document. `sky` and
`back` should not contain opaque pixels in the fighter strip unless those pixels
are fully hidden by `stage`.

Implementation shape:

- Keep the existing flat `bg-stage-<id>` path as the default.
- If layer files exist, preload them as `bg-stage-<id>-sky`, `-back`, and
  `-stage`.
- In `FightScene`, draw the layers at the same display size as current stage
  art, but apply `bgOverhang * factor` for each layer.
- Allow each stage to override the default parallax factors in `src/data/stages.ts`.
- Keep HUD, fighters, projectiles, and shadows unchanged.

This lets old stages keep working while new or regenerated stages opt into
layered parallax.
