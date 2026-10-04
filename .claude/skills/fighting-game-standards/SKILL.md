---
name: fighting-game-standards
description: How to judge and tune a Martian Kombat fighter against MKS-1 — the house fighting-game standard benchmarked on MUGEN/IKEMEN GO's Kung Fu Man and Street Fighter conventions. Covers the frame-data conventions (startup/active/recovery/advantage, SF style), units (CH, f, %HP), the per-class bands, the "balanced character" checklist, the bench lab (npm run bench) and the CI ratchet, and recipes for fixing each finding. Use when designing or tuning frame data, hitboxes, damage, movement or combos; when asked whether a character is balanced, safe, punishable, too strong/weak, or "feels" off; when a bench/ratchet test fails; or when comparing to MUGEN/IKEMEN/Street Fighter numbers.
---

# Fighting-game standards (MKS-1)

Full reference: `docs/FIGHTING_STANDARDS.md` (comparison matrix, glossary,
findings, roadmap). Measured tables: `docs/FRAME_DATA.md` (generated).
Bands as code: `src/bench/standards.ts`. This skill is the working recipe.

## Rule zero: measure, never read

The JSON is not the frame data — the engine is. `src/bench/` runs the real
deterministic `step()` with scripted inputs and reports what happens. Never
quote `startup: 4` from a JSON as "4-frame startup":

| You want | Bench says | From data (no overrides) |
|---|---|---|
| startup (SF: first active frame, press = 1) | `startup` | `startup + 1` |
| total frames occupied | `total` | `startup + active + recovery + 1` |
| recovery after active | `recovery` | `recovery + 1` |
| on hit | `onHit` | `hitstun − active − recovery` |
| on block | `onBlock` | `blockstun − active − recovery` |

So to make a move **+2 on hit**, set `hitstun = active + recovery + 2`.
Asymmetric `hitstop: [attacker, victim]` adds `victim − attacker` to both
advantages. These identities are pinned by `src/bench/framedata.test.ts`.

## Commands

```bash
npm run bench                         # roster summary, class medians vs KFM, errors, warning counts
npm run bench -- --char vincent       # one fighter: full measured table + every finding
npm run bench -- --md                 # regenerate docs/FRAME_DATA.md
npm run bench -- --update-baseline    # re-ratchet src/bench/baseline.json after fixing/accepting errors
```

`npm run test` includes `src/bench/balance.audit.test.ts` (the ratchet):
it fails on **new** errors and on **fixed** errors still in the baseline.
Warnings never fail CI.

## Units

`f` = 60 Hz frame. `CH` = px ÷ the fighter's standing hurtbox height (makes
MUGEN's 320×240 and our 960×540 comparable). `%HP` = damage ÷ max health.

## The bands (summary — `src/bench/standards.ts` is canonical)

| Class | Startup | On block | On hit | Damage %HP |
|---|---|---|---|---|
| light | 3–6 | −4..+2 | 0..+6 | 2–5 |
| medium | 5–10 | −6..+2 | 0..+7 | 4.5–8 |
| heavy | 7–15 | −10..0 | −2..+7 | 6.5–12 |
| air | 4–12 | — | — | 2–10 |
| special | 5–20 | ≥ −16 | — | 5–14 |
| reversal (invuln from f1) | 3–8 | ≤ −10 (must be punishable) | — | 7–14 |
| projectile | 9–22 (total 30–55) | −10..+6 | — | 3–10 |
| throw | 2–8 | — | — | 7–15 |

Character: health 900–1150 · walk 0.8–1.8 CH/s · back-walk 0.6–1.0× forward
· airtime 34–50f · apex 0.6–1.0 CH · jump distance 0.7–1.4 CH · prejump 2–6f
· fastest ground normal ≤ 6f · best meterless combo 12–35% HP.
Chain/cancel normals (non-light) are exempt from the on-block band.

## Errors (CI-ratcheted) and how to fix each

| Rule | Fix |
|---|---|
| `unreachable` | the move has no `input` and isn't a normal slot (`[cj]?[lmh][pk]`) — add the `input` (throws: `{ "button": "LPLK" }`) |
| `never-connects` | hitbox far edge (`x + w`) must clear the push box: `x + w` > `bodyBox` front + opponent's hurtbox back. Re-derive from the active cell's skeleton (Sprite Editor auto-hitbox) and sanity-check the reach |
| `throw-out-of-range` | `grab.range` (center-to-center) must exceed the push-box separation (`bodyBox.x + w` × 2) — aim for separation + 10..40 px |
| `zero-damage` | give it damage (fused projectiles carry it in `detonate.damage`) |
| `overkill-hit` | > 25% HP in one hit — split it or cut it |
| `safe-reversal` | an invulnerable reversal ≥ −2 on block: add recovery until ≤ −10 |
| `infinite` | a chain/link cycle still combos at 16 moves: remove the self/2-cycle from `chains`, cut the lights' active frames back to 2–3, or raise `knockback` so pushback ends it (normal: 4–8 hits) |

## Recipes for common warnings

- **Minus on hit** (mediums/heavies) → raise `hitstun`, not lower recovery
  (recovery also changes on-block and whiff punish).
- **Unsafe poke** (on block < band) → raise `blockstun` or trim `recovery`;
  a move that is −N is punishable by any normal with startup ≤ N.
- **Slow light** → lights are the "get off me" button; ≤ 6f measured.
- **Floaty jump** (airtime > 50f) → raise `gravity` and `jumpVel` together
  (apex ∝ v²/g, airtime ∝ v/g).
- **Jump distance**: the engine applies ground friction on the takeoff tick,
  so forward-jump speed is `0.85 × jumpSpeedX` after tick 1 (known quirk).
- **Charge moves** need `CHARGE_TICKS + 8` ticks of hold (the release tick
  bleeds 8) — tell playtesters ~0.7 s.
- **Cancels feel dropped after heavies**: the 8-tick action buffer expires
  during hitstop ≥ 9 (known quirk, plan P3.5). Don't raise hitstop until P3.5.

## Per-move contact overrides (MUGEN parity)

Optional on any move/variant; omit for engine defaults:
- `hitstop: N` or `[attacker, victim]` — MUGEN `pausetime` (defaults
  `HITSTOP_LIGHT/MEDIUM/HEAVY/SPECIAL` = 4/6/9/10; KFM uses 8–15)
- `chip: N` — damage through block (default 0 on lights, else 10%)
- `blockKnockback: N` — block push impulse (default 0.8 × `knockback`)

## A balanced MKS-1 fighter (checklist)

1. Zero errors. 2. Frame data in band or out *on purpose* (identity).
3. Answers to the five situations: neutral poke, anti-air, get-off-me
   (≤ 6f), a projectile answer, a confirmable combo. 4. Damage budget:
   BnB 12–35%, throws 7–15%. 5. Physics in band. 6. Every big reward has a
   punish window. 7. Archetype identity (move-authoring skill templates)
   decides which band *edges* the fighter lives on — e.g. a grappler walks
   slow and hits hard; a rushdown has the fastest lights and plus pressure.

## When tuning, also

- Re-run `npm run bench -- --char <id>` after every change; re-ratchet
  with `--update-baseline` when an error is fixed (the test demands it).
- Kits come from `tools/core/kit.mjs` (chains/cancels/variants) — the bench
  is the gate that tells you whether that grammar produced a sane fighter.
- Comparing to another engine's character? Use the **mugen-import** skill.
