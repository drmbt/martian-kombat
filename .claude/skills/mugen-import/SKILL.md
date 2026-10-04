---
name: mugen-import
description: Port and benchmark MUGEN / IKEMEN GO community content (characters, stages) into Martian Kombat — fetch reference files, parse DEF/CNS/CMD/AIR/SFF/stage DEF, convert a character into a CharacterDef plus a reference frame-data table computed with MUGEN/IKEMEN semantics, auto-fit the port until it plays identically in our engine, read the lossy-mapping report (the engine-parity backlog), and keep the parity regression test green. Use when importing a MUGEN/IKEMEN character or stage, benchmarking our engine against Kung Fu Man or another reference, extending the porter to new HitDef/command shapes, or when src/bench/parity.test.ts fails after an engine change.
---

# MUGEN / IKEMEN import & parity benchmarking

Reference doc: `docs/FIGHTING_STANDARDS.md` (§1 engines, §2 feature matrix,
§4 semantics); backlog: `docs/handoff/02-PLAN.md` P10.8 (content import). Code:

- `src/compat/mugen/` — pure-TS parsers (`ini`, `air`, `cns` incl. CMD +
  command strings, `files` = DEF / stage DEF / SFF header) and `port.ts`.
- `src/bench/parity.ts` — `parityReport` (port measured in OUR engine vs the
  reference table) and `fitPort` (iterative auto-fit).
- `src/bench/reference/` — committed `<id>.port.json` (CharacterDef) +
  `<id>.ref.json` (home-engine frame data), registered in `index.ts`.
- `tools/fg/fetch-mugen.mjs`, `tools/fg/import-mugen.ts` — CLIs.

## Workflow

```bash
npm run mugen:fetch                                   # → assets/raw/mugen/ (GITIGNORED)
npm run mugen:import -- --def assets/raw/mugen/chars/kfm/kfm.def --id kfm --fit
npm run bench -- --parity kfm                         # metric-by-metric scorecard
npm run test                                          # parity.test.ts keeps it at 100%
```

`mugen:import` writes to `src/bench/reference/` by default (`--out` to
redirect, e.g. a scratch dir for experiments), prints MAPPED / LOSSY /
UNSUPPORTED, standard-animation coverage, sprite counts, and the parity
table. `--height N` sets the port's standing height (default 284 ≈ roster).
A new reference must be added to `REFERENCES` in
`src/bench/reference/index.ts` to join the bench and the parity test.

## Licensing rules (non-negotiable)

- Raw community files NEVER enter git — only `assets/raw/mugen/` (ignored).
- Committed `*.port.json` / `*.ref.json` carry a `_source` attribution line
  (author + licence). Check the character's readme licence first; NC
  licences (KFM: CC BY-NC) are fine for this non-commercial project's
  benchmarks but references stay **bench-only** — never in `ROSTER`
  (`parity.test.ts` enforces it), never shipped.
- IKEMEN GO source is MIT: porting its algorithms (e.g. `image.go` SFF
  decoders for plan P10.8 / D1) is fine with attribution in a comment.

## Semantics the porter encodes (verified against IKEMEN GO source)

- Scale: `k = targetHeight / standing Clsn2 height` (anim 0, element 0).
  Velocities/gravity × k; frames 1:1 (all 60 Hz); our `jumpVel` is divided
  by `JUMP_VEL_MULT`.
- Timing: first Clsn1 element at/after the HitDef's trigger time = `s`;
  `L` = animation length. Ref SF startup `s+1`, total `L`.
  Our first-pass port: `startup = s`, `recovery = L − s − active − 1`,
  `hitstun = hittime − 1`, `blockstun = guard.hittime − 1`.
- HitDef defaults: `guard.pausetime = pausetime`; `guard.hittime` =
  **ground.slidetime** for MUGEN-era characters (no `ikemenversion` in the
  DEF) and `ground.hittime` for IKEMEN ones; `guard.slidetime =
  guard.hittime`; `guard.velocity = ground.velocity`.
- Advantage (ref, ±1f): `(s + p2 + hittime) − (L + p1)`.
- Pushback (ref): velocity × friction per tick with the stop threshold,
  for `slidetime` ticks (`slideDistance`). Ours: `knockback ≈ push × 0.15`.
- Mapping: CMD `[Statedef -1]` ChangeState entries → command strings →
  `motionOf` (qcf/qcb/dp/hcf/hcb/bf/cbf/du; `ff`, double-quarter = unsupported).
  4-button chars map x/y/a/b → lp/hp/lk/hk. `power >= N` gates →
  unsupported (no meter yet). `p2bodydist X < N` → throw range. Specials of
  the same name fold into L/M/H `variants`. `stateno = …` + `movecontact`
  (incl. `var(k)` combo-condition indirection) → `chains` / `cancel`.

## Reading the report

- **LOSSY** lines are the engine-parity backlog (per-element hurtboxes,
  multi-hit moves ported as first hit, run vs dash, whiff-cancel chains…).
  Each maps to an item in `docs/handoff/02-PLAN.md` (P3 / P10.7).
- **UNSUPPORTED** = moves we cannot express yet (meter, `ff`, supers).
- Parity rows marked ✗ after `--fit` are true semantic gaps — add them to
  `docs/handoff/02-PLAN.md`, don't hand-tweak the JSON to hide them.

## When parity.test.ts fails

An engine change moved timing/physics semantics. If intended, re-fit:
`npm run mugen:fetch && npm run mugen:import -- --def
assets/raw/mugen/chars/kfm/kfm.def --id kfm --fit`, commit the new port,
and note the semantic change in `docs/FIGHTING_STANDARDS.md` (§4/§6).
If NOT intended, the engine change has a bug — the failing metric names it.

## Extending the porter

New HitDef/controller shape a character uses? Add the pattern to `port.ts`
(`fireTime` for new trigger forms, `entriesOf` for entry conditions),
cover it in `src/compat/mugen/mugen.test.ts` with a **synthetic** snippet
(never paste third-party file text into the repo), re-run the import and the
parity bench. Stage import (DEF → 21:9 composite) and SFF pixel decoding are
plan P10.8 (D1–D3): the parsers (`parseStageDef`, `parseSff`) already exist.
