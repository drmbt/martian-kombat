# Fighting-Game Standards & MUGEN / IKEMEN GO Parity (MKS-1)

> **What this is.** Martian Kombat's comparison against the longest-running
> community fighting-game engine standard — **M.U.G.E.N** (Elecbyte, 1999–2013)
> and its open-source successor **IKEMEN GO** (MIT, active) — and the
> standard we adopt from it: **MKS-1** (Martian Kombat Standard v1, adopted
> 2026-10-04). It defines our terminology, frame-data conventions, units,
> "balanced character" bands, and the roadmap to engine/content parity.
>
> Everything numeric here is **measured by running our deterministic engine**
> (`src/bench/`), and the reference character (Kung Fu Man) is **ported into
> our engine and verified at 100% parity** against its MUGEN semantics.
>
> | Command | What it does |
> |---|---|
> | `npm run bench` | MKS-1 audit of the whole roster + roster-vs-reference medians |
> | `npm run bench -- --char <id>` | one fighter's measured frame-data table + findings |
> | `npm run bench -- --md` | regenerate `docs/FRAME_DATA.md` |
> | `npm run bench -- --parity kfm` | ported reference vs its source, metric by metric |
> | `npm run bench -- --update-baseline` | re-ratchet the CI baseline (`src/bench/baseline.json`) |
> | `npm run mugen:fetch` | download reference content into gitignored `assets/raw/mugen/` |
> | `npm run mugen:import -- --def <char.def> --id <id> --fit` | port a MUGEN/IKEMEN character + auto-fit it |
>
> Skills: **fighting-game-standards** (design + tuning to MKS-1) and
> **mugen-import** (porting/benchmarking community content).

---

## 1. The reference engines and why Kung Fu Man

**M.U.G.E.N** is a data-driven 2D fighting engine whose content formats
became a de-facto community standard: thousands of characters and stages
exist as `DEF` (manifest) + `CNS` (constants + state machine) + `CMD`
(command inputs + state entry) + `AIR` (animations with per-frame collision
boxes) + `SFF` (sprite archive) + `SND` (sounds). **IKEMEN GO** reimplements
MUGEN in Go (MIT license), runs that content, and extends it (rollback
netplay, tag/simul teams, dizzy, guard break, red life, training mode, Lua
screenpacks, ZSS state scripts, 3D stages, HD `localcoord` characters).

**Kung Fu Man (KFM)** is Elecbyte's sample character shipped with both
engines — the canonical "how a MUGEN character is supposed to be built"
reference. Licence: Creative Commons **Noncommercial**, attribution
optional. We never commit KFM's files (they live in the gitignored
`assets/raw/mugen/`, fetched by `npm run mugen:fetch`); we commit only the
**derived numeric tables** (`src/bench/reference/kfm.{port,ref}.json`),
attributed. KFM is a **bench-only** fighter: never in `ROSTER`, never shipped.

| KFM fact (measured from the files) | Value |
|---|---|
| localcoord | 320×240 (HD twin `kfm720`: 1280×720 — also ports at 100%) |
| life / airjuggle | 1000 / 15 points |
| buttons | 4 (x y a b = weak/strong punch/kick) + start |
| sprites / palettes | 281 sprites (SFF v2.01) / 16 palettes |
| standard animations | 65 of the 72 standard action numbers we track (`STANDARD_ANIMS`) present; 0 required missing |
| HitDefs / statedefs | 41 HitDef controllers across 58 statedefs |
| command.time / buffer.time | 15 / 1 ticks (our `INPUT_BUFFER_LEN` is also 15) |
| stand.friction | 0.85 (our `GROUND_FRICTION` is also 0.85) |

---

## 2. Feature matrix — Martian Kombat vs MUGEN 1.1 vs IKEMEN GO

✅ have · 🟡 partial · ❌ missing · ➖ not wanted / not applicable

| Area | MUGEN 1.1 | IKEMEN GO | Martian Kombat | Notes / parity path |
|---|---|---|---|---|
| **Architecture** | state machine in data (CNS statedefs + controllers + triggers) | same + ZSS script, Lua | fixed action kinds + **data-driven move archetypes** | ours is a curated subset by design (determinism, AI-gen pipeline). Import maps MUGEN shapes onto archetypes — §8 |
| Tick rate / fixed step | 60 Hz | 60 Hz | 60 Hz, pure `step()` | frames compare 1:1 |
| Determinism / rollback | ❌ / ❌ | ✅ / ✅ rollback netplay | ✅ / ✅ (PeerJS, rollback timesync) | parity |
| Coordinates | per-char/stage `localcoord`, axis at feet, +x fwd, −y up | same | 960×540 world, feet origin, +x fwd, −y up, `scale` | same convention — conversion is a single factor (CH unit, §4) |
| **Collision: hurtboxes** | Clsn2 **per animation element** | same | 🟡 one stand + one crouch box | biggest feel gap → roadmap C3 (derive per-phase boxes from our baked skeletons) |
| Collision: hitboxes | Clsn1 per element, many boxes | same | 🟡 one box per move (+ `rehit`) | roadmap C4 |
| Push box | `size.ground.front/back`, `Width` sctrl | same | ✅ `bodyBox` | |
| **Hit definition** | HitDef: damage+guard dmg, pausetime p1/p2, hittime, slidetime, guard.*, velocities, fall, … | same + dizzy/guard/redlife points | ✅ damage, hitstun, blockstun, knockback, height, knockdown, **+ `hitstop` (p1/p2), `chip`, `blockKnockback`** (MKS-1) | per-move pausetime / guard damage / guard velocity adopted 2026-10-04 |
| Attack attributes | `attr = S/C/A, N/S/H + A/T/P`; `NotHitBy`/`HitBy` | same | 🟡 `invuln` (all), `projImmune`, throw rules | roadmap C6: invuln classes as data |
| Priority / trades | `priority = 0–7, Hit/Miss/Dodge` | same | ❌ all simultaneous hits trade | roadmap C5 |
| Guard flags | `guardflag H/L/M/A` | same | ✅ `height: mid/low/high` | parity (no air-guard by design) |
| Juggle system | `airjuggle` pool + per-state `juggle` cost | same | ❌ (combo scaling only) | roadmap C2 — infinites exist today (§6) |
| Combo damage scaling | none built-in (`fall.defence_up`, attack/defence) | none built-in | ✅ 10%/hit after 2, floor 30% | ours is SF-style; keep |
| Hitstun decay | ❌ | ❌ (char-authored) | ❌ | roadmap C2 (the SF answer to light-chain loops) |
| Counter hit | char-authored | lifebar "Counter" message | ✅ 1.5× hitstun, +3 hitstop | |
| Throws | HitDef `attr NT` + `p2stateno` custom states, `TargetBind` | same | ✅ grab archetypes + universal LP+LK throw with tech window | ours has tech; KFM's doesn't |
| Dizzy / stun | ❌ | ✅ dizzy points | ✅ stun accumulator | parity |
| Guard break / guard points | ❌ | ✅ | ❌ | optional (C10) |
| Red life | ❌ | ✅ | ➖ (SF2 ghost bar is cosmetic) | |
| Power / super meter | ✅ power (default max 3000, 1000/level), `poweradd`, `SuperPause` | ✅ + `LifeToPowerMul` 0.7 / 0.6 | ❌ (RFE "super bar") | roadmap C7 — unlocks ported supers & EX moves |
| **Input language** | `~` release, `/` hold, `$` 4-way, `+` simultaneous, `>` strict, charge `~60$B, F` (KFM's reference); `command.time` 15, `buffer.time` 1 | same; `Input.PauseOnHitPause = 1` | ✅ 9 motions, mash, PPP/KKK/LPLK chords, **MUGEN charge (60-tick 4-way hold, 10-tick release window)** | `ff`, double-quarter supers missing (C8); buffer-in-hitstop fix (C1) |
| Chains / cancels | trigger-authored (`movecontact`, `time > N`) | same | ✅ data `chains` + `cancel` on contact, 8f window | ours never whiff-cancels (MUGEN can) |
| Movement | walk, **run** or hop, back-hop, air jump, run jump | same | walk, double-tap **impulse dash** (stocks), no air jump | per-char run vs dash, double jump = RFE |
| Air recovery / tech | ✅ `fall.recover` (xy) | ✅ | ❌ | roadmap C9 |
| Projectiles | `Projectile` sctrl: priority, hits, clash, edge bounds | same | ✅ rich: fans, lobs, fuse/detonate, fields, slow, pull, rehit, reflect | ours exceeds the stock set |
| Helpers / Explod / AfterImage | ✅ | ✅ | 🟡 renderer VFX (sparks, per-move overlays); no helpers | AfterImage = "frame trail" RFE |
| Palettes | 12 per char (`.act`), button-selected | same | ❌ | mirror matches need it (E3) |
| Sprites per char | typically hundreds–thousands (KFM 281) | same | ~65 cells (3/move phase) | Veo smoothing RFE; per-phase hurtboxes need no more cells |
| Standard anim numbers | ✅ (0 stand, 20 walk, 5000s get-hit …) | ✅ named in `common.const` | 🟡 by cell *name* (`idle-a`, `hit`, …) | action map §7 |
| **Stages** | layered BG + parallax `delta`, camera bounds/tension, `zoffset`, music | + 3D `.glb` stages, z-axis | single 21:9 painted image, fixed camera, floor line | stage import D3; camera scroll E2 (decision) |
| Arena width / camera | KFM stage ≈ **6.6 CH** walkable, screen 3.4 CH, camera `boundleft/right` + `screenleft/right` | same | screen 3.4 CH, walkable **3.0 CH** (fixed screen); **optional `MatchRules.camera`** (2026-10-06: midpoint-follow, view-bounded fighters, view-culled projectiles) — not yet wired into FightScene | 3.5:1 outpainted stages give ~6.3 CH (`gen:outpaint`); D9 comparison videos via `playtest:video` |
| Screenpack / lifebars | `system.def`, `fight.def`, `select.def` | + Lua motif | code-built HUD/menus | ➖ (not a goal) |
| Modes | arcade, versus, team (simul/turns), survival, training, watch | + tag, netplay, score | arcade (data stub), versus, CPU, training, online, fatality | |
| Training tools | Ctrl-C clsn, debug text | training mode (dummy, guard, input display) | ✅ F1 boxes / F2 move log / F3 skeleton; Move Tuner; **bench** | frame meter + dummy record E1 |
| AI | char-authored (`AILevel`) | same | ✅ data-driven `CpuDriver` + difficulty | |
| Story | intro/ending storyboards | same | `arcade: {motivation, ending}` stub | |
| Movelist | ❌ | `movelist.dat` | ✅ pause screen from data | parity |
| Content creation | hand-authored sprites/states | same | **AI pipeline + Character Studio** | our differentiator |

---

## 3. Terminology — community term ↔ MUGEN name ↔ our name

| Community term | MUGEN / IKEMEN | Martian Kombat |
|---|---|---|
| startup / active / recovery | anim elements before / with / after Clsn1 | `startup` / `active` / `recovery` (data) — see §4 for the SF conversion |
| frame advantage (on hit / on block) | derived: (hittime + p2 pause) − (remaining anim + p1 pause) | measured: `onHit` / `onBlock` (bench) |
| hitstun / blockstun | `ground.hittime` / `guard.hittime` | `hitstun` / `blockstun` |
| hitstop, hit-pause, freeze | `pausetime = p1, p2` (+ `guard.pausetime`) | `hitstop` (per-move override, `[attacker, victim]`) else `HITSTOP_*` |
| pushback | `ground.velocity` × `ground.slidetime` | `knockback` impulse (× `GROUND_FRICTION` decay) |
| block pushback | `guard.velocity` | `blockKnockback` (default 0.8 × knockback) |
| chip damage | `damage = hit, guard` | `chip` (default 0 lights / 10%) |
| hurtbox / hitbox / pushbox | Clsn2 / Clsn1 / `size` width | `hurtStand`+`hurtCrouch` / `hitbox` / `bodyBox` |
| overhead / low / mid | `guardflag = H` / `L` / `M` | `height: 'high' / 'low' / 'mid'` |
| knockdown / launcher | `fall = 1`, `ground.type = Trip` | `knockdown: true` |
| juggle | `juggle` points vs `airjuggle` | ❌ (C2) |
| chain / link / cancel | `movecontact` + ChangeState triggers | `chains` / link (measured) / `cancel` |
| reversal / DP / invincible | `NotHitBy` window | `invuln` (+ `invulnFrom`) |
| command normal / special / super / EX | CMD commands + `power >=` gates | motion `input` / ❌ supers / ❌ EX (C7) |
| charge move | `~30$B, F, x` | `cbf` / `du` + `CHARGE_TICKS` |
| custom state / throw | `p2stateno`, `TargetBind`, `TargetLifeAdd` | `grab`, `techable`, `tossArc` |
| meaty, frame trap, tick throw, okizeme | (design terms) | measurable with the bench (onBlock gaps, knockdown timing) |
| BnB (bread-and-butter combo) | — | bench "best meterless combo" (`combos.ts`) |
| infinite | (prevented by juggle points / authoring) | bench `infinite` rule (16-move cap) |
| CH (character height) | — | MKS-1 distance unit: px ÷ standing hurtbox height |

---

## 4. Conventions & units (MKS-1)

**Frame data uses the Street Fighter / SuperCombo convention**, measured by
the bench against a mirror at point blank:

- **startup** = the first active frame, counting the press frame as 1
- **active** = frames the hitbox is live
- **recovery** = frames after the last active frame until you can act
- **total** = frames the move occupies (startup − 1 + active + recovery)
- **on hit / on block** = defender's first actionable tick − attacker's (+ = attacker acts first)
- **push** = the defender's slide distance, in CH

How our data fields map (pinned by `src/bench/framedata.test.ts`):

| Measured | = from data (no overrides) |
|---|---|
| startup | `startup + 1` |
| total | `startup + active + recovery + 1` |
| recovery | `recovery + 1` (the tick the engine flips to idle still belongs to the move) |
| on hit | `hitstun − active − recovery` (+ victim − attacker hitstop if asymmetric) |
| on block | `blockstun − active − recovery` |

MUGEN reference semantics (porter, ±1f, verified against IKEMEN source):
`onHit = (s + p2 + hittime) − (L + p1)`, where `s` = first Clsn1 tick and
`L` = animation length; MUGEN-era characters default `guard.hittime` to
**ground.slidetime** (a documented-vs-actual quirk IKEMEN preserves), IKEMEN
characters to `ground.hittime`.

**Input & contact rules (engine, 2026-10-06):**

- **SOCD cleaning** (IKEMEN's rule): left+right held together = neutral,
  up+down = up. Applied inside `step()` (`cleanSocd`) so online peers agree.
  Before this, L+R walked forward AND blocked (measured: 192 px advance while
  blocking 6/6 MPs).
- **Same-tick connections** resolve against the start-of-tick state, never in
  slot order: two strikes both land (a trade); a strike beats a grab (the
  thrower got hit); two grabs clash and both whiff. Before this, slot 0
  (online: the host) always won. MUGEN-style per-move priority
  (Hit/Miss/Dodge) is roadmap C5 on top of this baseline.

**Units:** `f` (60 Hz frames — all three engines), `CH` (character heights:
px ÷ standing hurtbox height; makes 320×240 MUGEN and our 960×540 world
comparable), `CH/s` for speeds, `%HP` for damage.

---

## 5. The numbers — our roster vs the reference

Measured 2026-10-04 (`npm run bench`; full tables in `docs/FRAME_DATA.md`).

| Class (medians) | Startup ours / KFM | On hit | On block | Hitstop | Damage %HP |
|---|--:|--:|--:|--:|--:|
| light | 6 / 5 | +1 / +2 | −4 / −4 | **4 / 12** | 4.2 / 2.5 |
| medium | 9 / 9 | −1 / −1 | −8 / −6 | **6 / 12** | 6.9 / 6.0 |
| heavy | 11 / — | −2 / — | −10 / — | 9 / — | 9.0 / — |
| special | 12 / 10 | −6 / −5 | −15 / −12 | 10 / 12 | 8.8 / 9.5 |
| throw | 7 / 1 | — | — | 10 / 4 | 10.5 / 7.8 |

| Physics | Roster (range, median) | KFM |
|---|---|---|
| walk forward | 0.65–1.30 CH/s, ~1.0 | **1.55** |
| walk back ÷ forward | ~0.8 | 0.92 |
| jump airtime | 41–56 f, 43 | 37 |
| jump apex | 0.71–0.98 CH | 0.86 |
| forward jump distance | 0.66–1.27 CH, ~1.0 | 1.03 |
| prejump | 4–6 f | 3 |
| best meterless combo | 14–28 % HP | 18.5 % |
| arena (walkable) | **3.0 CH**, fixed screen | **~6.6 CH** (camera ±150) |

**Reading it:** frame-for-frame our startups and damage sit on the genre
line. The systemic differences are **feel** knobs: (1) our hitstop is about
**a third to a half** of KFM's — hits read snappier/lighter; (2) our
mediums/heavies are **minus on hit**, so links barely exist and combos lean
entirely on chains/cancels; (3) **most normals are punishable on block**
(medium median −8 vs a 5–6f fastest normal), which favors defense;
(4) we walk ~35% slower relative to body size; (5) our arena is ~half as
wide, so corners come twice as fast.

---

## 6. Findings (2026-10-04 audit)

### 6.1 Errors — objectively broken (ratcheted in `src/bench/baseline.json`)

14 errors at audit time; **12 fixed 2026-10-06** (struck through below) —
2 remain, both P4.3 balance work. Throw reach is checked against **every
playable opponent's** push box (bodies stop at front + front), not just the
mirror. The kit grammar (`tools/core/kit.mjs` `grabFloor`) now keeps
Studio-built grabs out of range errors too. The four never-connect normals
were boxes placed behind the body — the DWPose skeleton missed the extended
limb, so the auto-hitbox reproduced them; they were re-placed on the active
cells' forward-most opaque pixels.

| Fighter | Move | Rule | Detail |
|---|---|---|---|
| ~~vincent~~ | ~~`clk`~~ | ~~never-connects~~ | ~~hitbox reaches 22 px; bodies touch at 102 px~~ |
| vincent | `clp`/`lk` | **infinite** | 15 midscreen / 16+ corner — `lk`,`clp`,`cmk` drifted to 2f startup with 9–12 active frames (older docs: `lk` 5/3/10) |
| ~~flo~~ | ~~`lk`~~ | ~~never-connects~~ | ~~reach 34 px vs 88 px~~ |
| ~~kirby~~ | ~~`cmp`~~ | ~~never-connects~~ | ~~reach 17 px vs 94 px~~ |
| ~~tao~~ | ~~`chp`~~ | ~~never-connects~~ | ~~hitbox sits behind the fighter (reach −3 px)~~ |
| ~~bodhi~~ | ~~Table Work L~~ | ~~throw-out-of-range~~ | ~~range 77 px ≤ push separation 84 px (even the mirror)~~ |
| ~~bodhi~~ | ~~Table Work M~~ | ~~throw-out-of-range~~ | ~~89 px can't reach vincent, yulia, catherine, kirby, ben~~ |
| ~~ygor~~ | ~~throw~~ | ~~throw-out-of-range~~ | ~~range 79 px ≤ 88 px (even the mirror)~~ |
| ~~rapha~~ | ~~throw~~ | ~~throw-out-of-range~~ | ~~90 px can't reach vincent, yulia, catherine, ben~~ |
| ~~vanessa~~ | ~~throw~~ | ~~throw-out-of-range~~ | ~~91 px can't reach vincent (91 px)~~ |
| ~~marzipan~~ | ~~Symbiosis L~~ | ~~throw-out-of-range~~ | ~~95 px can't reach vincent (95 px)~~ |
| ~~earl, ben~~ | ~~`throw`~~ | ~~**unreachable**~~ | ~~no `input` field — the throw can never be performed (also `damage: 0`, range 64)~~ |
| ben | `clk`/`clp` | **infinite** | 11 midscreen / 16+ corner |

Earl (13), Tao (10) and RJ (11) also have long-but-finite light loops.
Warnings: 84 on-block, 58 on-hit, 46 startup, 43 damage band hits —
`npm run bench -- --char <id>` lists each.

### 6.2 Engine quirks the bench surfaced

1. ~~**Takeoff friction**~~ — **resolved 2026-10-06 (D10, MUGEN
   semantics):** the launch tick no longer runs ground friction, so a jump's
   air speed is exactly `jumpSpeedX`; `JUMP_SPEED_MULT` 1.6 → 1.4 kept every
   fighter's measured jump distance within 0.01 CH, and the KFM port now
   uses MUGEN's `jump.fwd` × scale unmodified (7.634).
2. ~~**Charge bleed**~~ — **resolved 2026-10-06 (D10):** MUGEN's reference
   charge `~60$B, F, x` with `time = 10` — hold the charge direction
   (4-way: down-back counts as back, down-left/right as down) for
   **`CHARGE_TICKS` = 60**, release, then the opposite direction + button
   within **`CHARGE_RELEASE_TICKS` = 10**; no bleed. Charge moves are now
   ~0.3 s slower to set up than the old effective 43 ticks.
3. **Action buffer expires during hitstop** — the 8-tick buffer counts down
   while frozen, so cancels pressed early in a ≥9-tick hitstop are
   **dropped** (12f hitstop drops almost all early cancels). IKEMEN's
   standard is `Input.PauseOnHitPause = 1`. Pinned by a quirk test.
4. **Double-tap dash** needs ≥ 2 release frames between taps (harmless).

---

## 7. Asset standards

**Standard animation numbers** (IKEMEN `common.const`) ↔ our cells — the
action map an importer/exporter uses:

| MUGEN action | Meaning | Our cell |
|---|---|---|
| 0 | stand | `idle-a`, `idle-b` |
| 20 / 21 | walk fwd / back | `walk-a`, `walk-b` |
| 10–12, 11 | stand↔crouch, crouching | `crouch` |
| 40–47 | jump start / up / down / land | `jump` |
| 120–152 | guard start / guarding / guard hit (stand, crouch, air) | `block`, `block-crouch` |
| 5000–5027 | get-hit high/low/crouch, light/medium/hard | `hit` |
| 5030–5060 | air get-hit / fall | `fall` |
| 5100–5120 | hit ground, lie down, get up | `down` |
| 5300 | dizzy (IKEMEN) | `hit` (+ dizzy VFX) |
| 180–195 | win / intro / taunt | (3D gestures; 2D taunt) |
| 9000,0 / 9000,1 | small / large portrait | `portraits/<id>.png`, `<id>-bust.png` |
| move anims (200…, 1000…) | elements w/ Clsn1 | `<move>-startup/active/recovery` |

MUGEN expects ~60 standard actions plus moves (KFM: 281 sprites); we ship
~65 named cells and interpolate nothing. Parity does **not** require more
cells — it requires per-phase **boxes** (C3/C4), which our baked DWPose
skeletons can generate automatically. Palettes: MUGEN ships 12
button-selected palettes per character; we have none (E3).

---

## 8. What a balanced MKS-1 character is

A fighter is MKS-1 compliant when (✓ = enforced by the bench/CI):

1. ✓ **No errors**: every move is performable, connects at some range, deals
   damage, single hits ≤ 25% HP, reversals are punishable on block, throw
   range clears the push box, no chain/link loop survives 16 moves.
2. **Frame data inside the class bands** (`src/bench/standards.ts`): lights
   3–6f and −4..+2 on block; mediums 5–10f, −6..+2; heavies 7–15f,
   −10..0; reversals 3–8f startup and ≤ −10 on block; projectiles 9–22f
   startup with 30–55f total; throws 2–8f. Chain/cancel normals may trade
   block frames for pressure.
3. **A complete toolkit** — answers to the five situations: a neutral poke,
   an anti-air (reversal or a fast upward normal), a get-off-me button
   (fastest normal ≤ 6f), a projectile answer (projectile, reflect,
   teleport, invuln, or a fast approach), and a confirmable combo route.
4. **Damage budget** — health 900–1150; best meterless combo 12–35% HP
   (genre 15–30%); throws 7–15%.
5. **Movement inside the physics bands** — walk 0.8–1.8 CH/s, back-walk
   0.6–1.0× forward, airtime 34–50f, apex 0.6–1.0 CH, jump distance
   0.7–1.4 CH, prejump 2–6f.
6. **Risk ↔ reward symmetry** — anything that does big damage or covers big
   space is unsafe somewhere (on block, on whiff, or in recovery).
7. **Identity over parity** — archetype templates (move-authoring skill)
   may sit at band *edges* on purpose (a grappler walks slow and hits hard;
   a rushdown has the fastest lights). Out-of-band by design is fine;
   out-of-band by accident is what the warnings catch.

---

## 9. Tuning workflow

1. `npm run bench -- --char <id>` → read the table + findings.
2. Fix errors first (they fail CI once fixed-then-regressed), then the
   warnings that aren't identity choices.
3. Tune in the Character Studio MOVES module (live) or the JSON; re-bench.
4. `npm run test` — the ratchet fails on new errors *and* on fixed errors
   still listed; `npm run bench -- --update-baseline` re-ratchets.
5. `npm run bench -- --md` to refresh `docs/FRAME_DATA.md`.

**Benchmarking against a reference** (the "does it play like the gold
standard" loop): `npm run mugen:import -- --def … --fit` ports + auto-fits;
`npm run bench -- --parity kfm` shows every metric; `src/bench/parity.test.ts`
keeps the committed KFM port at 100% — so any engine change that alters
timing semantics is caught immediately. Anything the fitter *can't* match is,
by definition, an engine-parity gap.

---

## 10. Roadmap

**Phase A — Standards foundation ✅ (2026-10-04).** Bench lab, MKS-1 bands,
CI ratchet, KFM port at 100% parity (+ HD `kfm720`), MUGEN parsers/porter,
per-move `hitstop`/`chip`/`blockKnockback`, skills, this doc.

**Phase B — MKS-1 compliance pass (data only, low risk).**
- B1 Fix the 4 never-connecting normals (re-derive from skeleton + clamp the
  hitbox past the push box).
- B2 Fix throws: Earl/Ben `input` + damage + range; Ygor/Bodhi-L range.
  Add "range > push separation + 10" to the creator's kit grammar.
- B3 Kill the infinites: restore Vincent's drifted `lk/clp/cmk`; shorten
  Ben's `clp/clk` chain.
- B4 Warnings sweep per fighter (identity-aware).

**Phase C — Engine parity primitives (each ships with a vitest).**
- **C1 Buffer survives hitstop** (IKEMEN `PauseOnHitPause`) — prerequisite
  for any hitstop increase; flips the quirk test.
- C2 Juggle points (MUGEN `airjuggle` 15 + per-move cost) and hitstun decay
  — systemic anti-infinite.
- **C3 Per-phase hurtboxes** derived from baked skeletons (Clsn2 parity:
  whiff punishes, low profiles, extended limbs) — the biggest feel lever.
- C4 Multiple / per-phase hitboxes (Clsn1 parity: multi-hit, two-part moves).
- C5 Priority & trade rules (Hit/Miss/Dodge).
- C6 Attack attributes + invuln classes (strike/throw/projectile) as data.
- C7 Power meter + supers + superpause (MUGEN 3000 / 1000-per-level,
  0.7/0.6 life-to-power) — merges the "super bar" RFE; unlocks EX moves.
- C8 `ff` and double-quarter motions; per-char run-vs-dash.
- C9 Air recovery / tech rolls.
- C10 Optional IKEMEN systems: guard points, just-defend.
- C11 ✅ quirks 6.2.1–2 resolved with MUGEN semantics (2026-10-06).

**Phase D — Content import (play a community character).**
- D1 SFF v2 decoder (RLE8/RLE5/LZ5/PNG — port IKEMEN `image.go`, MIT) + v1 PCX.
- D2 Action-map packer (§7) → a dev-only, gitignored KFM sprite sheet, so
  the port is **playable side-by-side** with our fighters in training.
- D3 Stage import: DEF + BG layers → 21:9 composite, floor from `zoffset`,
  arena from camera bounds.
- D4 Export: Martian fighter → MUGEN/IKEMEN DEF/CNS/AIR/CMD (run our cast
  inside IKEMEN — the reverse parity test).
- D5 More references (any permissively licensed community character; the
  importer + parity bench are generic).

**Phase E — Tooling & feel parity.**
- E1 Training: SF6-style frame meter, input display, dummy record/playback,
  bench numbers live in the Studio MOVES module.
- E2 Optional camera scroll into the 21:9 art's overscan (≈ MUGEN ±150
  bounds → ~4 CH arena) — **decision** (camera zoom was declined; scroll
  without zoom is SF2-faithful).
- E3 Alternate palettes (hue-shift shader) for mirror matches.
- E4 CPU-vs-CPU matchup matrix (deterministic seeds) for win-rate balance.

**Tracking:** this roadmap is folded into the unified backlog
`docs/handoff/02-PLAN.md` (merged with the 2026-10-04 full-repo audit) —
work items are ticked THERE, not here:

| This roadmap | Unified plan |
|---|---|
| B1 never-connecting normals | P4.0 |
| B2 throws (input, reach — incl. cross-matchup) | P4.1, P4.2 |
| B3 vincent drift / infinites | P4.3 (+ engine rule P3.8) |
| B4 warnings sweep | P4.4 (feel-wide changes: decision D8) |
| C1 buffer survives hitstop | P3.5 |
| C2 juggle points + hitstun decay | P3.8 |
| C5 priority & trades | P3.1 (always-trade baseline) → P10.7 |
| C3, C4, C6–C10 | P10.7 |
| C11 quirks | P3.11 (decision D10) |
| Phase D content import | P10.8 |
| Phase E tooling (E2 camera = decision D9) | P10.9 |

**Decisions for the project owner** (plan gates D8–D10; the numbers are
ready, the taste call isn't the bench's): raise hitstop toward KFM (after C1)? make mediums/heavies
plus on hit so links exist? make lights/mediums safer on block? raise walk
speeds toward 1.2–1.5 CH/s? widen the arena (E2)? fix or keep the takeoff
friction and charge bleed?

---

## 11. Licensing & attribution

- **IKEMEN GO** engine source: MIT — semantics verified against
  `src/char.go`, `src/anim.go`, `data/common1.cns.zss`, `data/common.const`;
  porting `image.go` decoders (D1) is permitted with attribution.
- **Kung Fu Man** (Elecbyte): CC BY-NC. Raw files stay in gitignored
  `assets/raw/mugen/`; committed tables in `src/bench/reference/` carry an
  attribution `_source` header; KFM never ships in the game.
- Any further reference: check its licence before `mugen:import`, record it
  in the port's `_source`, and keep it bench-only unless the licence allows more.
