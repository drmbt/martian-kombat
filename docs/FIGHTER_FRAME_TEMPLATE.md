# Fighter Frame Template

Packed fighter cells are `288x384`. Use this guide when generating or QAing
individual frame cells:

- [`fighter-frame-template-288x384.png`](fighter-frame-template-288x384.png)
- [`fighter-frame-template-288x384.svg`](fighter-frame-template-288x384.svg) is the editable source.

## Alignment Contract

- The fighter's lowest sole/contact pixels should land around `y=365` inside
  the `288x384` cell.
- The usable foot-contact band is `y=352-374`.
- Keep transparent padding below the soles; do not crop into shoes, toes, or
  lying poses.
- Keep the fighter centered around `x=144` unless the pose intentionally leans
  or attacks forward.
- Grounded standing/walking/attack frames should share the same sole height.
  If one frame floats higher than the others, fix the packed cell or regenerate
  that frame before tuning renderer offsets.

## Why This Matters

`FightScene` anchors sprites near the bottom of each cell. Dynamic shadows are
generated from the current frame alpha, so inconsistent foot height makes the
same fighter appear to hover or sink between animation frames.

