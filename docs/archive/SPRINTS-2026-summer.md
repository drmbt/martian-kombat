# Sprints 0–28, roadmap & handoff notes — 2026 summer (archived 2026-10-06)

> **Archived verbatim** from `SPRINTBOARD.md` by P1.1 of
> `docs/handoff/02-PLAN.md`: the board's header/status block, the Roadmap
> (Sprints 0–28, near-term roadmap, RFEs, Icebox) and the Agent handoff
> notes. The changelog is in `CHANGELOG-2026-summer.md`. History, not
> current truth — the live board is `SPRINTBOARD.md`, the backlog
> `docs/handoff/02-PLAN.md`.
>
> **Known-stale claims in this text** (corrected on the live board):
> the header's "Sprint 22 / 13 playable / 19 stages" (now 18 playable + Kung
> Fu Man secret, 27 stages); "feat/character-studio 24 ahead, not merged"
> (merged); "16 fighters / other 13" (18); the deploy recipe "GitHub Actions
> → Pages" (the workflow was removed in `0c738ee`; Pages was unpublished
> 2026-10-06 — Cloudflare Workers Builds from `main` deploys
> martiankombat.com, see `docs/DEPLOY.md`); Sprints 23/26 "IN PROGRESS" and
> 27 "PLANNED" (all shipped); "6 · DEV EDITOR" (now `7 · DEV EDITOR`); "no
> fighter uses du" (flo and yulia do); the `spriteOffsetY` prose (deleted in
> Sprint 27's floor migration); Tao "no stage" (his home stage is
> `institute`); "camera zoom/deadzone declined — fixed-screen framing"
> (the SF2 pan-only scrolling camera is on by default since 2026-10-06, zoom
> still declined).

<!-- verbatim below this line -->
# Martian Kombat — Sprintboard

> **Protocol:** This file is the single source of truth for project state and the
> agent handoff sheet. Before **every commit/push**: tick the boxes you completed,
> append a changelog entry, and update the handoff notes if work is mid-flight.
> Unchecked boxes in the active sprint = the backlog. Do not silently add scope;
> new ideas go to the Icebox.

**Latest (2026-10-04): the ACTIVE BACKLOG is `docs/handoff/02-PLAN.md`**
(full-repo audit + MKS-1 merged; it supersedes this file's "Current" and
handoff sections until its P1.1 slims this board). Machine move in progress:
`docs/handoff/01-OLD-MACHINE-PASSOFF.md` → `03-NEW-MACHINE-RESUME.md`, all on
branch `feat/mks1-rescue-handoff`. Sprint 28 Phase A (MKS-1: bench lab, KFM
port at 100% parity, CI ratchet) shipped — see `docs/FIGHTING_STANDARDS.md`.

**Current: Sprint 22 (renderer parity + shared presentation shell) SHIPPED —
roster now 13 playable (Rapha added, 4 with 3D meshes)** · MVP shipped
2026-07-02 (8/8 fighters playable, 19 stages, full music loop, fatalities,
CPU + training modes, settings). Sprint 19 (cancels & chains) shipped +
committed + pushed 2026-07-04 (`a27fa90`). Sprint 20 (personality specials +
Burn One) shipped 2026-07-04 — engine + data + docs + generated art,
130/130 vitest, verified live. Sprint 21 (**Cat — "Wet Paint"**, the first
roster expansion beyond the launch eight) shipped 2026-07-04 — full 7-step
pipeline, 134/134 vitest, art verified. Committed together with Sprint 20's
staged art on the user's go-ahead. **Bodhi is being built in a parallel
session** (registered `playable`, sheet packed, but audio + fatality panels
still pending in that session — expect the dev loader to hang until they land;
deploy degrades gracefully on real 404s). **Chebel + Ygor (Wave 2 chars #3–4)
100% COMPLETE 2026-07-04** — all 7 pipeline steps done for both: data +
generator-script entries, 62-cell sheets packed (+ projectile art: chebel
spirit-draw; ygor suave-creature/oracle/rainbow-road), 16 VO lines each +
announcer, portraits/KO (from earlier canonical pass), 4 fatality panels each
(the-reversed / final-render). Both `playable:true`, tsc clean + 134/134
tests, sprite-sheet QA passed (Bodhi's deep-crouch head-visible / hem-not-a-leg
/ empty-air-grab guards all held — no headless torsos, phantom legs or clones).
Roster now 12 playable. Parallelized by provider: ElevenLabs audio ran
concurrent with two Gemini frame jobs (conc 4 each = 8 in-flight, no 429s),
then pack + fatality. QA re-roll (user-directed): chebel `idle-a`/`idle-b`
(were flickery — too dissimilar, `idle-b` had a stray jaguar) + `fall` (now
topples backward) regenerated and re-packed. Added a reusable per-character
generic-cell override seam — `spec.cells['idle-b'] = '...'` in
frames-manifest overrides a shared CELLS pose without touching other chars
(`buildJobs` reads `spec.cells?.[id] ?? c.pose`). LESSON: text alone won't
hold an idle-loop frame static — the model turns "idle-b, chest risen" into a
knee-raise action pose; pin it hard ("BOTH feet flat, NOT an attack, NO raised
knee/kick/lunge") or it flickers against idle-a. Long-term RFEs live in their
own roadmap section.

**Since Sprint 21 (2026-07-04→05):** the 3D renderer went from a spike to a
production, menu-selectable mode and reached 2D feature parity — Sprint 22
(shared presentation shell) extracted the duplicated fight plumbing into
`src/presentation` (pure event/HUD/banner/move-log logic), `src/ui` (DOM
chrome both renderers mount), and `src/scenes/fightShell.ts` (pause/keys/nav),
so new presentation features land in both renderers at once; it also closed
the ESC-pause / F2-move-log / matchEnd-nav / gamepad-menu gaps in 3D and added
live GLB idle previews to character select. Online multiplayer shipped fully
(WebRTC over PeerJS, rollback timesync V26/T45, shared SelectScene, both-vote
stage, same-channel rematch — 2D + 3D). **Rapha** (RJ's raccoon-wrangler) is
the 13th playable fighter — a full 7-step-pipeline character (23 moves, 4
named specials + throw, Scrap Compactor fatality, portraits/KO/bust,
projectiles) AND the 4th baked 3D mesh. All 233 vitests green, tsc clean.

---

## Roadmap

### Sprint 0 — Scaffolding ✅
- [x] Repo init, `.gitignore` (`.env` excluded), pushed to `drmbt/martian-kombat`
- [x] `CLAUDE.md` (agent ground rules, stack, pipeline, conventions)
- [x] `SPRINTBOARD.md` (this file), `README.md`, `.env.example`
- [x] `docs/CHARACTERS.md` roster bible (personalities → move sets)
- [x] Inspiration photos in `assets/character-inspo/` (8 fighters)

### Sprint 1 — Fight core (playable with placeholder boxes) ✅
Goal: two rectangles can fight each other and it already *feels* like a fighter.
- [x] Vite + Phaser 3 + TypeScript + vitest project scaffold, `npm run dev` works
- [x] Deterministic fight loop: fixed 60hz tick, `(state, inputs) -> state`, zero
      Phaser imports in `src/engine/`, unit tests prove same inputs → same state
- [x] Input layer: keyboard mapping for P1/P2, per-tick input snapshot, input
      buffer (for specials later); gamepad stubbed
- [x] Movement: walk, dash (double-tap), jump (pre-jump frames), crouch, facing swap
- [x] Combat: hurtboxes/hitboxes from frame data, startup/active/recovery phases,
      hitstun/blockstun, standing + crouching block, pushback (throws deferred
      to Sprint 4 with the balance pass)
- [x] Health, round timer, KO detection, best-of-3 round flow, round-reset
- [x] Debug rendering: draw boxes + frame-phase colors (toggle with F1)
- [x] Two placeholder characters defined **as JSON frame data** (jab, heavy,
      sweep, one special each) proving the data-driven pipeline — Vincent
      (Sigil Bolt projectile) and Yulia (Cossack Spiral advancing knockdown)
- [x] Fight scene renders placeholder rects/capsules; hit sparks as flashes

### Sprint 2 — Asset pipeline (photos → sprite sheets) ✅
Goal: `npm run gen:*` turns an inspo photo into a game-ready animated fighter.
- [x] Style test samples (`tools/gen-style-test.mjs`): 3 art styles × 2 chars +
      4 stage tests. **User approved: painted-cel style, salton-shoreline stage**
- [x] `tools/style.md`: locked art-style prompt (painted cel, chroma #00B140)
- [x] Canonical sheets: approved `char-*-b-painted.png` from the style test
      double as the canonical reference for each character
- [x] `gen-frames.mjs` + `frames-manifest.mjs`: canonical sheet → 23 pose
      keyframes/char via `gemini-3-pro-image` (flash drifts bg color + fumbles
      lying/crouch poses). Cell order = renderer contract. 1 keyframe per
      startup/active/recovery phase maps 1:1 onto engine frame data.
      *(Veo motion clips → smoother animation is the post-MVP upgrade path.)*
- [x] `pack-sheet.mjs`: ffmpeg `chromakey` 0.15 (NOT colorkey+despill — despill
      bleaches wardrobe greens/hair) → 288×384 cells → 6×4 sheet + meta.json
- [x] Prompt sidecar logging (`.prompt.txt`) + idempotent/`--force` behavior
- [x] Full sprite sets for **Vincent** and **Yulia** wired into FightScene
      (sprites + tint feedback; capsule fallback stays for sheet-less chars)
- [x] Stage background: Salton shoreline sunset (gpt-image-2) in
      `public/assets/backgrounds/`, drawn behind the fight
- [x] Verified in browser: sprites render on stage, Sigil Bolt fired, hit
      flash + damage confirmed (via `window.__game` manual loop stepping)

### Sprint 3 — Real characters, sound, presentation ✅
Goal: it looks and sounds like a real (janky, charming) fighting game.
- [x] ElevenLabs announcer pack (`tools/gen-audio.mjs`, voice: Maverick): all 8
      names, ROUND 1/2/FINAL, FIGHT, K.O., TIME UP, DOUBLE K.O., PERFECT,
      MARTIAN VICTORY
- [x] ElevenLabs SFX (sound-generation): hit, block, whoosh, jump, projectile,
      menu blip; per-character kiai + hurt grunts for Vincent & Yulia
- [x] Audio wired via state-diffing in FightScene (`presentTick`) — engine
      stays pure/silent; missing audio degrades to silence via `play()` guard
- [x] Character select: all 8 Martians (canonical painted-cel art generated
      for the remaining 6 via `tools/gen-canonical.mjs`; chroma-keyed
      head crops in `public/assets/portraits/`), 2 playable, locked = SOON;
      simultaneous P1/P2 cursors, announcer says the name on confirm
- [x] Main menu + results; full loop menu→select→fight→results→(R rematch /
      ENTER reselect); BootScene preloads everything w/ progress bar
- [x] HUD polish: portraits on health bars, round pips, combo counter
      ("N HITS", renderer-side)
- [~] Motion inputs (quarter-circle) **deferred to Sprint 4 balance pass** —
      one-button specials play better for the party-game MVP; input buffer is
      already in engine state when we want them

### Sprint 4 — MVP ship
Goal: itch.io-able build; roster pipeline proven repeatable.
- [x] Third + fourth fighters prove the pipeline scales to weirder move sets:
      **Catherine** (bo-staff range, Jazzper = low-hitting dog projectile —
      must be crouch-blocked) and **Kirby** (fast/fragile, Scalding Sip =
      short-range ttl-limited fire cone). Engine grew `height` + `ttl` on
      projectiles. Jazzper renders as a sprinting-dog sprite (flip, no spin).
- [x] Gamepad support: pads OR-merged with keyboard per player (dpad/left
      stick + X light / Y heavy / A·B special); `input.gamepad` enabled
- [x] Balance/feel pass part 1: chip damage (10% through block on everything
      but lights, floored at 1 HP — chip can't KO). Throws remain deferred
      (Icebox) — 21 engine tests green incl. chip/low-projectile/ttl specs
- [x] Playtest with 2+ humans — done over keyboard, mostly working; feel RFEs
      captured in Sprint 16+. A proper **game-controller playtest is still
      owed** (browser keyboard isn't fun) → Sprint 16
- [x] Deployed: **https://drmbt.github.io/martian-kombat/** (user approved,
      made the repo public; gh-pages branch, force-push dist per handoff
      recipe) — **MVP SHIPPED 2026-07-02**

### Sprint 5 — Art QA + six-button combat (user-directed)
- [x] Yulia frame QA: 8 flagged frames regenerated. Crouch poses REQUIRE the
      low-reference anchor trick (see handoff gotchas) — prompt text alone
      never beat the standing canonical reference
- [x] Six-button layout: LP/MP/HP/LK/MK/HK × stand/crouch/air (19 moves/char),
      QCF+P specials via the input buffer, overheads ('high') beat crouch
      block, air normals cancel on landing — 27 engine tests green
- [x] Yulia rebuilt on the v2 50-cell sheet (8×7 grid); other 3 fighters play
      six-button through legacy-art fallbacks (renderer resolves cell names
      from meta.json, newest naming first)
- [x] Vincent's invisible projectile fixed: teal-on-green was unkeyable —
      regenerated blue-violet on a MAGENTA screen w/ per-projectile key color
- [x] Face icons for all 8 from `assets/character-inspo/face/` via
      `gen-icons.mjs` (Vincent + sunglasses; Kirby face + sprite outfit)
- [x] ESC pause overlay: both fighters' move lists (dmg/startup/KD), controls,
      special names; F1 hitbox debug confirmed working and documented in-game
- [x] Remaining roster frame QA — completed per-character as each fighter was
      built or rebuilt (Vincent S6, Catherine S7, Flo S11, Freeman S13,
      Kirby S14, Gene/Marzipan S15)
- [x] v2 sheets + native art for Vincent, Catherine, Kirby — shipped in
      Sprints 6, 7, and 14 respectively

### Sprint 6 — Named specials, fatality, CPU (user-directed)
- [x] Vincent on the v2 53-cell sheet: full six-button art, his old
      sweep-startup promoted to the crouch cell (user call — it read as one),
      block-crouch regenerated low-anchored; no limb dupes found in QA
- [x] Multi-special system: any number of named specials per character, each
      with fighting-game-convention input (`input: {motion: qcf/qcb/bf,
      button: punch/kick}`); cells named `<special-id>-<phase>` — no numbered
      schema. Vincent: Sigil Bolt (QCF+P) + NEW Cloud Hands (QCB+P). Yulia:
      Cossack Spiral remapped to ←→+K (kick move!), NEW Backbend Guillotine
      (QCB+K, overhead)
- [x] Fatality scaffolding: match-deciding KO by a fatality-holder → 'finisher'
      phase (FINISH THEM!, loser dazed, winner walks free) → motion input in
      range → 'fatality' cutscene phase (engine ticks the timeline, scene
      plays full-bleed panels) → matchEnd. Generic: `fatality` def in
      character JSON + panels in `public/assets/fatalities/<char>/`
- [x] Yulia's **Heart Breaker** (QCB+P): 4 gorgeous anime panels via
      `gen-fatality.mjs` (burnt-husk opponent = generic, reusable for any
      loser); FINISH THEM! / FATALITY! announcer lines
- [x] CPU opponent: `src/ai/bot.ts` CpuDriver (tick-hash decisions, input-queue
      motion specials, executes its own fatality); Menu: 1·VS CPU / 2·TWO
      PLAYERS; Select: P1 picks both fighters in CPU mode
- [x] 34 engine tests green (motions, multi-specials, overhead guillotine,
      full fatality flow, mercy timeout)
- [x] New gameplay-demo.mp4: CPU vincent vs CPU yulia — yulia wins 2-0 and
      lands Heart Breaker on camera

### Sprint 7 — Deploy hardening + Catherine v2 (user-directed)
- [x] Pages deploys moved to an Actions workflow (`.github/workflows/deploy.yml`,
      push-to-main, `cancel-in-progress: false`) — the legacy branch pipeline
      wedged when force-pushes raced (mid-deploy cancel → phantom queued
      deployment → everything times out). Wedge root-caused + phantom
      cancelled via the Pages deployments API; queue expected to self-heal
      (~2h per GitHub norm); site kept serving throughout
- [x] Rematch (R) and reselect (ENTER) keep CPU mode
- [x] Catherine v2 53-cell sheet: staff in EVERY frame via new per-character
      `always` prompt invariant; pole-kick/pole-vault kicks; block-crouch
      fixed with a cmk-active height anchor
- [x] Two specials: **Mise en Place** (QCF+P, knife-fan projectile, new art)
      and **Order Up!** (moved to QCB+P, Jazzper still hits low)
- [x] Per-move projectile plumbing: `Projectile.moveId`, per-special art files
      (`projectile-<move>.png`), manifest `extra.projectiles`, scene picks
      texture per special — characters can own any number of projectiles
- [x] 35 tests green; both specials verified live in-browser

### Sprint 8 — SFII Turbo move system (docs/MOVES.md, user-directed)
- [x] `docs/MOVES.md` is now the living spec with implementation checkboxes
- [x] L/M/H button variants (`variants` patch per special; strength captured
      from the triggering button) — Cossack Spiral travel/damage axis exact
- [x] New motions: dp (→↓↘), hcb/hcf, simplified 360 (↓+←+→ "270 rule"),
      3P/3K (2+ class buttons together); staged buffer matcher generalized
- [x] Reversal i-frames (`invuln`), command grabs (`grab`, unblockable,
      + `grabRecoil`), projectile reflect (`reflect`), projectile immunity
      (`projImmune`), vault mobility (`vault`), multi-projectile fans
      (`count`/`spreadVX`/`spreadY`)
- [x] Vincent: Rising Glyph (dp+P, i-frames) + Redirect (qcb+P reflector);
      Cloud Hands moved to qcb+K per the doc; Blue Screen fatality
- [x] Yulia: Volga Piledriver (360+P grab) + Braid Lariat (3P, projectile
      immune); ENOUGH. deferred (rage meter)
- [x] Catherine: Staff Vault (dp+K) + 86'd (hcb+K grab w/ bounce-away);
      knife-count variants; Jazzper distance variants; crouch-HK slide;
      Dinner Service fatality
- [x] 41 tests green (variants, dp i-frames vs meaty, unblockable grab vs
      block, reflect, knife counts, vault airborne)
- [ ] Deferred (stays deferred): rage meter + ENOUGH., armored/vault dashes,
      backdash i-frames, mash motions (charge `du` shipped with Flo in S11)

### Sprint 9 — Move-log overlay + training sandbox (user-directed)
- [x] Move-log overlay: scrolling FIFO (last 8) of triggered moves —
      "P1 Rising Glyph (H)" / "P1 cr.MK" — toggled with F2, rendered
      bottom-left, driven by state-diffing in presentTick
- [x] TRAINING mode (menu option 3): pick fighter + dummy, dummy never acts,
      health refills 2s after last hit, KO/finisher soft-resets the room,
      clock frozen, ENTER exits, move log ON by default
- [x] Move-verification recordings for all three working characters
      (moves-{vincent,yulia,catherine}.mp4, untracked): every normal, every
      special at L and H, ending with each fatality (Blue Screen, Heart
      Breaker, Dinner Service) executing in-game

### Sprint 10 — Stage variety + stage select (user-directed)
- [x] `tools/gen-stage.mjs` (`npm run gen:stages`): one ultra-wide 21:9 stage
      per `assets/stage-inspo/<FOLDER>/` via gemini-3-pro-image, ALL folder
      photos passed as references (composite prompt per stage, SCENES map in
      the script). Raw → `assets/raw/stages/`; packed 1680×720 jpg →
      `public/assets/backgrounds/stages/<id>.jpg`. Idempotent / `--force` /
      `--stage <id>`
- [x] 10 stages generated + QA'd: BBAC, CHIBA, DRIVE IN, ESTATES, INSTITUTE,
      MARS, NEPTUNE, SATURN, SHIPWRECK, THE RANGE (shipwreck needed one regen:
      "clean ground plane" came back as a flat color band — prompt now demands
      textured ground, keep that clause)
- [x] Stage registry `src/data/stages.ts` (11 entries incl. legacy salton);
      optional `stage` field on CharacterDef (UI hint only) — home stages:
      vincent→chiba, yulia→saturn, catherine→bbac, kirby→institute
- [x] Stage-select dialog after both fighters lock in: thumbnail grid,
      RANDOM tile is the default, home stages badged "CHIBA · VINCENT" in the
      owner's color, either player's keys drive it (WASD/arrows + F/K)
- [x] SF2 parallax in FightScene: stage art drawn at native aspect ×
      screen height; the extra width slides opposite the fighters' midpoint
      (±150 px on 21:9 art). 16:9 art (salton) degrades to static. Rematch
      keeps the stage
- [x] 41 tests green; select→dialog→fight verified live in-browser on CHIBA
      (parallax confirmed: mid 480→872 slid bg.x 480→357), RANDOM path drawn

### Sprint 10 — UI polish: pause menu, mouse/touch, scrollable moves (user-directed)
- [x] On-screen controls (`src/input/touch.ts`): translucent d-pad + 6 attack
      buttons for P1, multi-touch (hold direction + press button at once),
      OR-merged into P1 input. F3 hides; auto-hidden while paused / non-fight.
      `activePointers: 4` enabled in main.ts.
- [x] ESC pause is now a real menu: RESUME / RESTART / CHARACTER SELECT /
      MAIN MENU — clickable (mouse) + keyboard; verified via Phaser hitTest.
- [x] Move list no longer overflows: two word-wrapped columns clipped by a
      geometry mask, mouse-wheel scroll when a kit grows past the panel.
- [x] Menu + Select scenes clickable with the mouse (hover-highlight + click);
      character portraits and stage tiles are pick targets. Keyboard still works.
- [x] Debug overlays (move log / input ticker) moved to the upper corners so
      the bottom on-screen pad stays clear. 43 tests green; prod build clean.
- Note: dev server serves index.html for unbuilt-character asset requests,
  which can hang Phaser's loader in `npm run dev` (prod 404s load fine).

### Sprint 11 — Flo assets (user-directed)
- [x] Flo canonical regenerated (`assets/raw/` had been wiped; `gen-canonical.mjs`
      grew `--char` + a guard for missing style-test sources). Glyph color moved
      green → AMBER in the flavor prompt — green-on-green dies in the chroma key
      (Vincent teal-rune lesson, now baked into the prompt)
- [x] Flo v2 59-cell manifest entry: four specials per docs/MOVES.md —
      Fork Bomb (laptop lob), Smokescreen (spliff wall), Root Access (floor
      cable trap), sudo kill (terminal flame cone) — plus 5 projectile art
      pieces (incl. fork-bomb-burst detonation, art ready before engine)
- [x] 59 frames generated + QA'd; 13 regens (11 unanchored lows + 2 rerolls);
      block-crouch needed a one-off with the geometric bottom-half rule ON TOP
      of the low anchor (3 anchored rolls still came back standing)
- [x] Packed: `public/assets/sprites/flo/` sheet.png (8×8) + meta.json +
      5 keyed projectiles; keying verified over grey
- [x] Grunts: flo-kiai "Verdammt!" / flo-hurt "Ah! Scheiße!" (Daniel voice,
      stability 0.25 / style 1.0 — gen-audio now takes per-grunt overrides)
- [x] Engine: lobbed-arc projectiles (`vy`/`gravity`), landing fuse +
      `detonate` morph (moveId gains `-burst`, renderer swaps art), `field`
      projectiles (no collide/clash, exempt from the one-fireball rule),
      `knockdown` projectiles, charge `du` motion (banked `FighterState.charge`,
      fast decay on release — buffer untouched)
- [x] `flo.json` (19 normals + Fork Bomb/Smokescreen/Root Access/sudo kill
      with L/M/H variants) + roster unlock + BootScene burst-art load +
      FightScene per-special sizes/tumble/smoke-alpha. GOTCHA: sudo kill (hcf)
      is declared BEFORE Fork Bomb (qcf) in the JSON — every hcf contains a
      qcf tail and declaration order is the tiebreaker (test locks it in)
- [x] Fatality **rm -rf /** (qcb+P): 4 panels via gen-fatality.mjs — husk
      dissolves into cascading amber directory listings; shares qcb+P with
      Smokescreen safely (fatality check overrides in finisher; tested)
- [x] 49 engine tests green; production build clean
- [x] In-browser TRAINING-mode verification — closed by subsequent play
      sessions; Flo has been played and QA'd extensively since

### Sprint 12 — Post-match win-quote screen (user-directed)
- [x] SFII-style victory taunt phase: after the K.O./victory beat (matchEnd
      phaseFrame > 72), a full-bleed screen shows the winner portrait taunting
      the beaten loser portrait with a random win quote. Pure presentation in
      `FightScene.showWinScreen` (engine untouched — determinism intact); R/ENTER
      still rematch/reselect from it. Lazy-built container, reset on scene restart
- [x] `winQuotes: string[]` on `CharacterDef` (optional, render-only) + quotes
      authored for all 5 playable fighters' JSONs; docs/CHARACTERS.md carries
      quotes for all 8 (bible drives the unbuilt three)
- [x] Beaten-and-bloodied **defeated portraits**: `gen-canonical.mjs` now
      generates a bruised/bloodied bust per character (canonical+inspo refs,
      chroma-keyed) → `public/assets/portraits/<id>-ko.png`; all 8 generated + QA'd
- [x] BootScene loads `portrait-ko-<id>`; win screen falls back to a greyed
      normal portrait if the KO art is missing (graceful degrade)
- [x] CLAUDE.md pipeline rules updated (winQuotes + KO portrait now per-character
      invariants). 50 tests green, build clean, both win directions verified
      in-browser (Vincent-wins + Yulia-wins)

### Sprint 13 — Pipeline concurrency + Freeman assets (user-directed)
- [x] **Gen pipeline parallelized.** `tools/lib.mjs` gained a reusable
      `pool(items, size, worker)` + `concurrencyArg()` (opt-in `--concurrency N`).
      `gen-frames.mjs` now fans cells out through the pool (default 6) — anchor
      cell (`chk/sweep-active`) still generated FIRST, then the rest concurrently,
      so legacy low-anchored sheets stay correct. `gen-audio.mjs` flattens
      announcer/voice/sfx into one pooled task list (default 4). Failures log +
      skip-resume, never abort the batch.
- [x] Measured: Freeman's 56 frames in **219s @ conc 6** (~3.9s/img) vs a
      ~20 min serial baseline (~21s/img) → ~5.5×. Ceiling is Gemini's image
      rate limit, not the code (add 429 backoff before pushing concurrency up).
- [x] Freeman v2 56-cell manifest entry (`frames-manifest.mjs`): serene
      counter/turtle yogi, palm strikes, soft WHITE-GOLD chi (never green/crimson),
      `always` invariant (mala beads + linen + barefoot + serene half-smile).
      Three specials → cells: Presence, Breathwork, Sun Salutation. No projectiles.
- [x] 56 frames generated (0 failures, no regens needed) + packed to
      `public/assets/sprites/freeman/` sheet.png (8×7) + meta.json; chroma key
      verified (corner alpha 0x00, matches vincent). Grunts freeman-kiai/-hurt
      (Harry voice, calm settings: style 0.3 / stability 0.7).
- [x] `freeman.json` (19 normals cloned from flo pending a balance pass + three
      engine-valid specials): **Presence** (qcb+K — invuln counter-palm,
      forwardVel reposition), **Breathwork** (dp+P — invuln rising anti-air via
      `leap`), **Sun Salutation** (qcf+P — advancing combo via `forwardVel`), all
      with L/M/H variants. Registered in `index.ts`; roster flipped playable.
      Engine untouched (all three map onto existing primitives).
- [x] Verified in-browser TRAINING: Freeman selectable (cell lit), renders
      chroma-keyed, home stage INSTITUTE resolves, HUD portrait/name, HP normal +
      all three specials fire with correct motion/strength/animation (move-log
      confirmed). 50 engine tests green, typecheck clean.
- [x] **Fatality "Ego Death"** (hcb+P): 4 panels via `gen-fatality.mjs` (now
      pooled, + freeman `FATALITIES` entry) — Freeman meditates, the husk
      dissolves into rising white-gold lotus petals, leaving an outline in lotus.
      `fatality` block added to `freeman.json`; BootScene loads it generically.
      `gen-fatality` also made concurrent; added `gen:audio`/`gen:fatality` npm
      scripts. CLAUDE.md now lists fatality as step 7 — a full asset run is all 7.
- [x] Balance pass on Freeman's normals — closed in playtesting (the numbers
      play fine). Real counter/armor mechanics (Presence teleport-behind,
      Breathwork hit-absorb) folded into the combat-depth roadmap below.

### Sprint 14 — Kirby rebuild: acrobatic fire-breather (user-directed)
- [x] Reimagined Kirby "Spill the Tea" gossip → **"Firebreather"**: an acrobatic
      fire-breathing contortionist. ALL tea/teacup/match refs removed (canonical
      flavor, manifest `always`, docs/CHARACTERS.md, win quotes). New canonical
      (user-edited: no mouth fire) with a face-shot ref (`FACE[]`) now merged into
      `gen-canonical` for sharper facial fidelity; new select icon via `gen-icons`.
- [x] New kit (bible + kirby.json + frames-manifest v2), all on existing engine
      primitives (engine untouched): **Fire Breath** (qcf+P, ttl fire cone),
      **Sonic Scream** (qcb+P, knockdown shockwave-ring projectile), **Cartwheel**
      (dp+K, invuln rising anti-air) — L/M/H variants each.
- [x] Promoted legacy 23-cell → **v2 56-cell sheet** (8×7) + 2 keyed per-move
      projectiles (fire-breath cone, sonic-scream rings); user QA'd raw frames,
      packed clean (alpha transparent). Grunts refreshed. Removed the stale bare
      `projectile.png` (kit is all per-move art now, like flo — `proj-kirby` dev
      404 is the same benign gotcha flo/freeman/yulia already have).
- [x] Fatality **Hot Yoga** (hcb+P): 4 panels via `gen-fatality` (breath charge →
      fire-breath inferno → cartwheel through firestorm → serene bridge pose
      blowing smoke). `fatality` block in kirby.json; BootScene loads generically.
- [x] Engine test updated: the "no-fatality → straight roundEnd" branch test
      (previously used kirby as the fatality-less example) now strips a def's
      fatality locally, since every roster fighter owns one. 50 tests green,
      typecheck + prod build clean. Roster now **6/8 fully-built, all with fatalities**.
- [x] Regenerate kirby's KO/defeated bust (`portraits/kirby-ko.png`) from the new
      canonical — done 2026-07-02 (parallel session, committed with the
      Gene+Marzipan snapshot).

### Sprint 15 — Gene + Marzipan integration (marzi-char branch harvest)
- [x] Harvested Gene + Marzipan from the stale `origin/marzi-char` draft branch
      (2 commits off an old base; main was 10 ahead). No merge — cherry-picked
      the branch-only assets and **hand-ported** the engine mechanics on top of
      current main so nothing (round clock / winQuotes / leap / freeman / newer
      pipeline) got reverted. Kept the **branch canonicals** (`gene.png`/
      `marzipan.png`): their prompts are the refined "never green" chroma-safe
      versions the sprites were generated from — main's older portraits may want
      a `gen:canonical` re-run for perfect accent-color parity (cosmetic).
- [x] Assets pulled (game-ready + raw, per reproducibility rule): packed sheets
      `public/assets/sprites/{gene,marzipan}/` (+ 3 projectiles each), fatality
      panels (`four-oh-four` ×4 / `compost` ×4), voice grunts (kiai+hurt), the two
      character JSONs, raw canonicals + ~240 frame dumps + raw fatalities, and
      `docs/MOVE_DURATIONS.md`. Portraits + KO busts + announcer VO already lived
      on main (untouched).
- [x] Engine additions (ported additively, sit beside main's `leap`/`MatchRules`):
      `teleport` (Gene Diffusion blink-behind / retreat), grab `heal` (Marzipan
      Symbiosis kudzu drain), projectile `rehit` tick-clouds (Spore Bloom),
      `slowFactor` field that drags enemy projectiles + ground impulses (Rate
      Limit), and the chord-upgrade fix (single-button specials upgrade too, dp+2P
      vs qcf-tail). +9 engine tests.
- [x] Wired: `index.ts` (both registered alongside freeman), `roster.ts` (both →
      playable), `FightScene.ts` (6 PROJ_SIZE entries), `frames-manifest.mjs`
      (both v2 pose dicts). Authored `winQuotes` for both (were missing — the last
      parity gap). **Roster now 8/8 fully-built, all playable, all with fatalities.**
- [x] 68 tests green (63 engine incl. the new Gene/Marzipan kits); typecheck +
      prod build clean. In-browser: all 16 new assets serve 200, both selectable
      and playable, no character-specific console errors.

### Sprint 16 — Smoothness & playability (planned 2026-07-04)
Goal: the game we have, but it *feels* great — juice, VFX, attract mode, controls.
- [x] **Controller playtest** (user + real gamepad) — found and fixed three
      real bugs the synthetic-pad harness had missed (see 2026-07-03 changelog):
      Phaser's per-scene gamepad plugin dropping stale-timestamp pad snapshots
      after every scene change, pad-triggered scene transitions queued
      mid-`update()` never applying, and a Phaser `stopListeners()` crash on
      sparse pad-wrapper arrays (pad at index >0) that killed the game loop on
      every scene shutdown. All pad reads now bypass Phaser's plugin entirely
      (`navigator.getGamepads()` direct); the plugin is disabled in `main.ts`.
      Menu/select/settings/pause/win-screen navigation is fully wired: any
      punch/kick confirms, Start confirms, Select/Back opens the menu
      everywhere (title → pause → win screen).
- [x] **Impact VFX system**: composited hit-overlay sprites separate from the
      fighter sheets — hit sparks on every connecting normal, bigger
      explosions/smoke/shockwaves on specials that land (e.g. Yulia's Volga
      Piledriver pushes a ground smoke cloud). Two asset classes: (a) greyscale
      generics with a per-character color tint/LUT so they're reusable, and
      (b) per-move art that lives with the move like projectiles do today
      (render-only `vfx` block on the move). Engine stays pure — VFX are
      renderer-side, triggered by state-diffing in `presentTick`.
      `tools/gen-vfx.mjs` (`npm run gen:vfx`) generates both classes
- [x] **Attract mode**: no input on the menu for 20s → CPU-vs-CPU demo
      fight (random fighters/stage, HUD on, blinking "DEMO — PRESS ANY KEY"
      overlay); any key/click/pad input returns to the title, matchEnd
      auto-returns after the win-screen beat. CpuDriver powers both sides
- [x] **Control remapping in Settings**: per-player key AND gamepad-button
      mapping UI (press-to-bind rows, `ControlsScene` off Settings), persisted
      to localStorage via `src/settings.ts`; defaults = old hardwired
      bindings; duplicates swap; RESET BINDINGS row
- [x] **Game-feel juice bundle** (pairs with the VFX work):
      hitstop (3–8 tick freeze on contact, deterministic in-engine, scaled by
      button strength — L 3 / M 5 / H 7 / specials 8), delayed red health
      drain (SF2 ghost bar, renderer-side), KO slow-motion on the
      round-ending hit (renderer-side ~⅓ speed, sim ticks unchanged)

### Sprint 17 — Universal throws + dizzy/stun state (planned 2026-07-03)
Goal: two SF2-standard mechanics that have been "deferred since Sprint 1."
Both ride entirely on existing engine/renderer primitives — no new plumbing
classes, just new state + new named-cell art. Sprite gen for both is front-
loaded so art can be reviewed by eye while the engine/renderer work lands;
**no iterative QA/re-roll loop** — generate once, pack once, leave frame QA
(anatomy, keying, wrong pose) to a manual human pass, same as any other
in-flight character work.

**Universal throw** — every character gets a bespoke throw pose (matches how
every other special already works — nothing in this codebase shares generic
move art across the roster). This is NEW and separate from existing
command-grab specials (86'd, Volga Piledriver, Symbiosis, ENOUGH.) — those
keep their motion inputs and mechanics untouched.
- [x] Design lock: input = **LP+LK pressed together** (new cross-class chord
      — `comboPress`/`PPP`/`KKK` in `step.ts` already detects same-class
      chords; this needs the same idea across punch+kick), close range only,
      unblockable, grounded-vs-grounded only (no air throws), knocks the
      victim down. **Throw teching**: if the grabbed player presses their
      own LP+LK within a short window after being grabbed, both bounce back
      neutral, no damage — reuses the grab/`grabRecoil` shape already in
      `MoveDef`.
- [x] Victim reaction reuses existing `hit`/`knockdown`/`fall` cells — **no
      new shared cell**, so this never touches the fixed `CELLS` array in
      `frames-manifest.mjs` (inserting there would reindex every character's
      button cells — see 2026-07-03 spritesheet-conventions discussion).
      Only the ATTACKER needs new art: `throw-startup/-active/-recovery`,
      appended as an ordinary named special at the tail of each character's
      `moves6.specials` — the same additive-safe pattern every special has
      always used.
- [x] `throw` `MoveDef` + JSON wiring for all 8 characters (`grab` block,
      `input: {button:'LPLK'}` + `techable: true`, dmg 85 / range 105 — Yulia
      100/115; declared LAST in each JSON so motion specials keep priority)
- [x] Engine tests: chord detection, unblockable-vs-block, whiffs on
      airborne/already-hitstunned victims, tech window success/failure,
      determinism (same inputs → same state) — 9 new tests, 95/95 green
- [x] `docs/MOVES.md` gains the throw spec; roster's `always`-invariant props
      (Catherine's staff, Marzipan's barefoot look, etc.) still apply

**Dizzy/stun state** — cheaper than it sounds: `'dazed'` is *already* a
recognized `Action.kind` in `FightScene.actionToCell` (falls back to the
plain `hit` cell today), so this ships with placeholder rendering for free
before any art exists.
- [x] Engine: `stun` accumulator on `FighterState`, gains on every connecting
      hit (not on block), decays slowly over time so poking isn't free
      stun-lock, crosses a threshold → forces `dazed` for a fixed duration
      (classic ~3s), fully vulnerable / can't act or block while dazed, stun
      resets to 0 when the daze period ends
- [x] Visual: **VFX-overlay first, not new body-pose art** — a circling
      stars/birds loop drawn above the head during `dazed`, generated once
      via the existing `tools/gen-vfx.mjs` generic-asset pattern (like
      `spark-hit.png`) and reused by the whole roster. Zero new manifest
      cells, zero reindex risk, fast to generate, matches how impact VFX
      already layers over the character sheet without touching it. A
      dedicated per-character dazed body pose is an explicit stretch goal,
      NOT required for this sprint — only pursue it if there's time left
      after the above, and it must append (never insert) to a character's
      cell list if attempted.
- [x] Engine tests: stun accumulation, decay, threshold trigger, daze
      duration + reset, no-stun-while-already-dazed (no double-trigger)

**Both features:**
- [x] Full roster asset gen kicked off FIRST and in the background/parallel
      with engine work (`gen:frames`/`gen:pack` are per-character +
      `--concurrency`-poolable; `gen:vfx` is independent and fast) — don't
      block engine/renderer work on art finishing
- [x] SPRINTBOARD checkboxes + changelog + handoff notes updated before any
      commit; leave raw/packed assets staged but **do not commit or push**
      without the user's explicit review pass over the new frames first
      (nothing committed — everything sits in the working tree for review)

### Sprint 18 — Input forgiveness + hit feedback ✅ (shipped 2026-07-03)
Goal: the "special sauce" pass from the 2026-07-03 game-feel review (industry-
conventions list audited against the engine — most of it we already have; these
are the gaps). Sim stays strict, controls get forgiving, hits get legible.
All engine work; every item ships with vitest coverage.
- [x] **Action input buffering + reversal buffer** — `FighterState.buffered`:
      a fresh button press in any unactionable state (or while frozen in
      hitstop) resolves its attack pick AT PRESS TIME (so dp motions stay
      inside their window for wakeup reversals) and fires on the first
      actionable frame; ACTION_BUFFER_TICKS=8 TTL, consumed-once, newest
      press wins, one-fireball rule re-checked at execution. Covers wakeup
      reversals + landing buffer + presses during hitstop.
- [x] **Counterhits** — `isCounterhit()`: defender in their own attack's
      startup or recovery (active-frame trades excluded) → hitstun ×1.5
      (COUNTER_HITSTUN_MULT), +3 victim-only hitstop
      (COUNTER_HITSTOP_BONUS), `counter` flag on the reel action; renderer
      shows a big red spark + layered s-hit/s-whoosh crack + harder shake
- [x] **Landing recovery** — new `'landing'` action kind: LANDING_TICKS=3
      after a plain jump, LANDING_WHIFF_TICKS=6 after a whiffed air normal
      (connected/blocked air normals land light); unactionable + can't
      block, renders as the crouch cell
- [x] **Per-fighter (asymmetric) hitstop** — `GameState.hitstop` split into
      `FighterState.hitstop`: projectiles freeze the VICTIM only, melee
      freezes both, max() keeps the longest; frozen fighters skip their
      whole update (timer + throw-tech window pause while anyone's frozen;
      non-fight phases keep the whole-world KO freeze); projectiles keep
      flying through freezes (real SF fireball pressure)
- [x] **Ground-impact bounce** — airHit rebounds off the floor once
      (BOUNCE_VY=3.2, vx halved, invulnerable during the bounce via the
      `bounced` flag) before settling into knockdown; throws inherit it
      free via their airHit path; renderer puffs sand-tinted dust + soft
      thud on the bounce and the settle
- [x] Feel-tuning playtest: base hitstop raised to L4 / M6 / H9, specials 10;
      verified live in the browser (bot-vs-bot demo, ~5700 frames stepped:
      asymmetric freezes, bounces, counters, landing 3→2→1 all observed in
      engine state; no console errors) — subjective feel pass is the user's
      review
- [x] Engine tests: 17 new (buffer fire/expire/once, wakeup reversal,
      landing buffer, counter hitstun/hitstop/neutral, landing short/whiff/
      connected, bounce + bounce-invuln + throw bounce, per-fighter freeze
      asymmetry, max-freeze rule) — 110/110 green, tsc clean

### Sprint 19 — Cancels & chains (planned 2026-07-03)
Goal: combos become deliberate, not accidental (moved up from the near-term
roadmap by the feel review; Sprint 18's buffering makes cancels land naturally).
- [x] Chain rules: lights chain into lights (light→medium where a kit wants
      it) — data-driven flags on moves, not engine special cases
      (`chains: string[]` on the move; all 8 kits chain lights→lights,
      Vincent/Kirby/Yulia/Catherine got light→medium flavor chains)
- [x] Special-cancel windows: medium/heavy normals cancel into specials on
      hit or block during a cancel window (`cancel: true`, non-knockdown
      mediums/heavies; window = contact → active end + 8 ticks)
- [x] Combo damage scaling (later hits in a combo do less): hits 1-2 full,
      −10%/hit after, floored at 30% — stun scales with it
- [x] Engine tests: chain windows, cancel-on-hit vs -on-block vs whiff (no
      cancel), scaling math, determinism — 121/121 vitest

### Sprint 20 — Personality specials + Flo fatality rework (planned 2026-07-03)
Goal: one signature "that's SO them" move per fighter + Flo's new fatality.
Asset gen front-loaded/parallel like Sprint 17; cells append-only as always.
New engine primitives called out — everything else rides existing plumbing.
- [x] **Gene — Mana Burst**: projectile stamped with the Eden Art Labs logo
      (existing projectile primitives) — bf+P, L/M/H = speed
- [x] **Marzipan — vine spear** ("get over here"): projectile that DRAGS the
      opponent to Marzipan on hit, becomes a knockdown throw if unblocked —
      NEW pull-projectile primitive (`pull: true` on the ProjectileDef;
      blocked spears push back, never drag) — bf+P
- [x] **Yulia — spinning star kick** (Chun-Li spinning bird kick) — charge
      d,u+K: forwardVel + NEW melee-rehit multi-hit
- [x] **Flo — blunt smoke puff**: lingering tick-damage smoke-ring
      projectile (existing rehit primitives) — qcf+K
- [x] **Kirby — cat scratch**: mash-punch rapid attack (Chun-Li lightning
      legs) — NEW mash-motion input type (`input.mash: N` press edges in
      the buffer window) + melee rehit — multi-hits, chips through block
- [x] **Vincent — matrix teleport**: dissolves into digital runes,
      reappears behind the opponent — `teleport:'behind'` + invuln, qcf+K.
      (Cell art uses CRIMSON runes, not the lore's green — green FX on the
      chroma-green screen is the known unkeyable failure)
- [x] **Freeman — yoga float**: Dhalsim-style high jump with slow held-pose
      descent — NEW slow-fall/float primitive (`float: {vy, gravity}` +
      `FighterState.floatGravity`, cleared on touchdown or on getting hit;
      air normals stay live during the drift) — qcb+P
- [x] **Flo fatality replaced — "Burn One"**: lighter ignites the husk →
      grinds the ash → rolls it into a cigarette → smokes it. 4 panels via
      `gen-fatality.mjs` (replaces rm -rf /); fatality block in flo.json
      updated
- [x] docs/CHARACTERS.md + docs/MOVES.md updated with the new moves; engine
      tests for the new primitives (mash, melee rehit, pull, float,
      teleport wiring) — 130/130 vitest

### Sprint 21 — Cat "Wet Paint" (roster expansion; user-directed 2026-07-04)
Goal: prove the pipeline scales past the launch eight with a fresh Martian.
First fighter added since the Gene/Marzipan harvest. Rode entirely on existing
engine primitives (no engine changes) — she's pure data + generated art.
- [x] **Cat — barefoot Portuguese painter-dancer trickster** (rushdown +
      ground control + an alter ego). `cat.json` full six-button kit tuned
      light/fast (health 980, walk 5.4), dance normals, lights→lights/mediums
      chains. Home stage `painted-canyon`.
- [x] Four specials on existing plumbing: **Flour Bomb** (qcf+P — low pigment
      slow-field puddle, Rate Limit `field`/`slowFactor`), **Thread of Life**
      (qcb+P — woven knockdown lash, Vine Spear minus `pull`), **Pirouette**
      (dp+K — invuln rising spin kick, `leap`+`invuln`), **D. Catarina**
      (hcf+P — the old-lady cane whack; her lore ↓↓ isn't an engine motion so
      remapped to hcf, DECLARED BEFORE Flour Bomb so the qcf tail can't steal
      it — flo's sudo-kill lesson). Universal throw (LPLK).
- [x] **Still Life fatality** (hcb+P — designed here; the bible had none):
      flings living paint that pins the husk to a canvas, live-paints it
      dissolving brushstroke-by-brushstroke into an unflattering framed
      portrait, signs it, blows a kiss. `FATALITIES.cat` in gen-fatality.mjs;
      4 panels generated.
- [x] Full 7-step asset run: canonical + KO bust (pre-existing from an earlier
      canonical pass), 62-cell v2 sheet (8×8) + 2 keyed projectiles
      (flour-bomb puddle, thread-of-life lash), 16 grunts + `CAT!` announcer,
      4 fatality panels. `frames-manifest.mjs` cat pose dict + `extra.
      projectiles`. Zero gen failures.
- [x] Wired: `index.ts` + `roster.ts` (playable), FightScene `PROJ_SIZE` +
      `PROJ_FEET_ANCHORED` (flour-bomb is a ground puddle). BootScene needs
      nothing (loads generically from roster/characters). Added a `--char`
      scope flag to `gen-audio.mjs` so single-character runs don't clobber
      other in-flight fighters' audio.
- [x] docs/CHARACTERS.md Cat entry updated (fatality + hcf remap noted).
      4 new vitests (hcf-vs-qcf declaration-order tiebreaker, both projectile
      specials, cat-vs-cat determinism) — **134/134 green, tsc clean, prod
      build clean.** Art verified cell-by-cell (clean chroma key, consistent
      likeness, every pose matches the kit) via canvas render — a live in-game
      fight was blocked only by the parallel Bodhi build's incomplete assets
      hanging the dev loader (see current-sprint note), not by Cat.

### Near-term roadmap (approved 2026-07-03; updated same day by the feel
review — chains/cancels/scaling promoted to Sprint 19)
**Combat depth — closer to SF2:**
- [ ] Better blocking mechanics (proximity guard, block-release timing feel)
- [ ] Per-move hurtbox overrides: optional `hurtbox` on `MoveDef` (extend
      along a kick, pull the head back on a punch, low-profile sweeps/
      slides) — defenders currently always use the static stand/crouch
      boxes, so attacking limbs are invincible and pokes feel samey
- [ ] Post-stun throw protection: a few ticks of throw-invuln after leaving
      hitstun/blockstun so throw loops don't feel cheap (wakeup is already
      covered — knockdown/getup are fully invulnerable)
- [ ] CPU difficulty levels (easy/medium/hard bot — feeds arcade mode and
      makes attract-mode demos look better)
**Art QA:**
- [ ] **Marzipan sprite regen** — a lot of Marzipan's sprite frames need
      regenerating (flagged 2026-07-05, playtest QA). Re-roll the weak cells
      via `gen:frames --char marzipan --cells <ids>` (low-pose anchor trick
      for crouch/lying) then `gen:pack --char marzipan`; inspect the montage
      per the verify-new-character workflow before repacking.
- [ ] **Bodhi attack-frame regen** — his hitboxes are present + rendering
      correctly (verified via F1, 2026-07-05), but several `*-active` cells
      read as a WIND-UP (fist cocked back/high) rather than a strike EXTENDED
      to the hitbox, so his attacks look "hitbox-less" even though they
      connect. Re-roll the `-active` cells for the normals (esp. `hp-active`
      + the kicks) with prompts showing the limb fully extended toward the
      opponent at the hitbox height, then repack. (His 3 grabs —
      deep-tissue/table-work/throw — correctly show no hitbox; by design.)

**Presentation / UX:**
- [ ] Round-intro animations (fighters walk in / strike a pose before
      "ROUND 1… FIGHT!") + in-fight victory pose at round end
- [ ] Character height normalization: per-character scale + vertical offset
      (Vincent reads small and floats slightly off the ground); auto-derive
      the ground baseline at pack time (lowest non-alpha pixel → offset in
      meta.json) and scale bounding boxes to match
      — PARTIAL 2026-07-04: manual knobs shipped — optional `spriteScale` /
      `spriteOffsetY` in character JSON. `spriteScale` is baked into the
      collision geometry (bodyBox, hurt boxes, move + variant hitboxes) once
      at data load in `src/data/characters/index.ts`, so engine and art stay
      congruent (renderer derives sprite size from hurtStand.h; engine itself
      never reads the field — determinism intact). `spriteOffsetY` is a
      render-only vertical nudge in FightScene. Vincent set to
      `spriteScale: 1.08`. Whole roster ground-aligned 2026-07-04: measured
      each sheet's idle-cell lowest opaque pixel (alpha scan) vs the rendered
      floor line, normalized to Yulia's (already-correct) foot line via
      `spriteOffsetY` — vincent +20, marzipan +8, flo +2, gene −3,
      catherine −8, freeman −12 (yulia/kirby 0, omitted). Verified in-game
      across all four pairings. Still open: pack-time ground-baseline
      auto-derive (would replace these hand-measured offsets).
- [ ] Post-fatality flow: the cutscene exits straight to the victory/win
      screen instead of resolving back through the fight screen first
- [ ] Attract-mode blink cleanup: "INSERT COIN" and "DEMO — PRESS ANY KEY"
      blink out of phase — merge onto one line, sync them, or drop one
- [ ] Sound priority + cooldowns (multi-hit/rehit clouds stack into mush
      today) + the Sprint 18 counterhit sound
- [ ] Clash/tech feedback: projectile clashes currently delete both
      projectiles silently — add spark + sound; throw tech gets its own flash
- [ ] CRT/scanline filter toggle in Settings (post-process; leans into the
      16-bit pixel-art stages)

### Sprint 22 — Renderer parity + shared presentation shell (user-directed 2026-07-04)
Goal: 3D reaches 2D feature parity by extracting the duplicated presentation
plumbing into shared modules — build each missing piece ONCE, both renderers
inherit it. User-approved direction: 2D adopts the DOM UI chrome.
- [x] **Phase 1 — pure presentation layer** (2026-07-04): 2D FightScene
      migrated off its private presentTick diff onto the shared
      `snapTick`/`diffTick` (the acknowledged post-Sprint-19 debt — the two
      detectors had already drifted on FIGHT! timing). New pure modules in
      `src/presentation/`: `soundDirector` (event→audio-cue table, executed
      by `runCues` in BootScene — sounds are now defined exactly once for
      both renderers), `hudModel` (SF2 ghost bar + combo counter; 3D's
      slower flat-2/tick drain unified onto 2D's 0.008·maxHealth/tick),
      `banner` (pure bannerFor(state) — 3D's READY? 3-2-1 + the 2D short
      intro in one function; 2D still renders its own msgText until Phase
      2), `notation` (motion glyphs, move labels, pause-menu move list) and
      `moveLog` (F2 input ticker + move FIFO). 3D stage bounds hoisted to
      `STAGE3D_BOUNDS` in threeCoordinates (was duplicated in FightScene3D +
      LobbyScene); FightScene3D's redundant focus-gate snd()/voice()
      wrappers deleted (play() gates centrally). 27 new vitests (233 total).
      Verified live on the static prod build: full 2D CPU match (hits, ghost
      drain, combo, F2 log, fatality, win screen, victory-music → char
      select) and full 3D CPU match (WinOverlay, FATALITY banner slam), zero
      console errors.
- [x] **Phase 2 — shared DOM UI chrome** (2026-07-05): `renderer3d/hud/*`
      moved to `src/ui/` + new `UiLayer` (canvas-tracking DOM layer both
      renderers mount chrome into; killed the anchor-copying hack). New
      shared components: PauseMenu (buttons + native-scroll move lists +
      pad/mouse nav), MoveLogOverlay (F2), RematchPrompt, DemoHint,
      LoadingOverlay; WinOverlay upgraded to full 2D parity (colored
      "<NAME> WINS", FATALITY tag, KO portrait, quote, configurable prompt,
      onFirstShow victory-voice hook — 3D gains the voice + reveal beat).
      2D FightScene dropped its Phaser pause container/win container/log
      texts for the DOM components (~200 lines gone); 3D dropped its inline
      loading/rematch/demo DOM. Verified live: DOM pause menu opens on ESC
      mid-fight (all 4 actions, both move lists), F2 overlay ticks inputs +
      moves, win overlay shows with fatality tag + quote, 3D fight renders
      HUD/banner on the shared layer. tsc clean, 233/233, 0 console errors.
- [x] **Phase 3 — fightShell** (2026-07-05): `src/scenes/fightShell.ts` —
      ONE shared shell composed by both fight scenes owning: pause state +
      the PauseMenu, the canonical keymap (ESC pause · F2 move log ·
      R/ENTER/F9/click matchEnd nav), gamepad menu navigation, demo-mode
      exits + hint, endNav arming, and the online rematch handshake +
      prompt. 3D parity gaps CLOSED: ESC now opens the pause menu in 3D
      (was: exit to menu), F2 shows the move log in 3D (skeleton moved to
      F3, inspector to F5, canonical keymap: F1 hitboxes · F2 move log ·
      F3 stage-guide(2D)/skeleton(3D) · F4 3D settings · F5 inspector ·
      ` perf(2D)/orbit(3D)), local R restart + ENTER→character-select at
      matchEnd in 3D (was online-only), pad menu nav in 3D, F9 quick
      restart in 2D. 3D pause freezes the sim but keeps presenting the
      frame. FightScene lost ~150 lines of nav/pause/rematch code; 3D ~90.
      Verified live both renderers: ESC pause (sim frozen, resume works),
      F2 log in 3D, ENTER at 3D matchEnd → Select with render3d preserved.
- [x] **Phase 4 — stragglers** (2026-07-05): character select in 3D mode
      now shows the portrait bust on each side instead of the 2D sheet idle
      (matches the renderer; also covers future mesh-only fighters with no
      sheet); win-quote
      behavior already unified by the shared WinOverlay (Phase 2); 2D hint
      bar + 3D HUD legend aligned on the canonical keymap (ESC pause · F2
      move log); FightScene3D's stale "dev-only" header rewritten.
      **SPRINT 22 COMPLETE** — 3D is at 2D feature parity for pause, debug
      overlays, match-end navigation, gamepad menus, and select previews,
      and every new presentation feature now lands in both renderers via
      src/presentation + src/ui + fightShell.
- [x] **Encore — LIVE 3D idle previews on character select** (2026-07-05,
      user-requested): `renderer3d/SelectPreview3D.ts` (DanceRenderer's
      lightweight sibling) renders both picks' GLBs playing their own idle
      clips on a transparent full-viewport canvas over the select screen,
      framed onto the same side slots the 2D sprites use (close-plane trick:
      fighters ride z=+3.5 toward a fov-24 camera). Dynamically imported so
      three stays out of the 2D bundle; loaded views are cached per slot so
      cursor flicks are instant; portrait bust stays up while a GLB streams
      or when a fighter has no mesh (Phase-4 fallback chain intact); hidden
      behind the full-screen stage dialog; driven from the scene's Phaser
      update() (works headless). BONUS FIX en route: threeAssets' GLB gate
      rejected any content-type that wasn't `gltf-binary`, which silently
      capsule'd ALL models on static hosts serving .glb as octet-stream
      (python http.server, some CDNs) — now it rejects only `text/html`
      (the actual vite-SPA-fallback failure it guards against). Verified
      live: both meshes idle on the sides, cursor swap, portrait fallback
      on a 3D SOON fighter, hidden during stage pick, 0 console errors.

### Sprint 23 — Home stages + world-map pin editor (user-directed 2026-07-05, IN PROGRESS)
Goal: every fighter has a defined home stage (SFII-style — hovering a fighter on
select lights their home-stage pin on a Mars/Bombay-Beach map; arcade mode ends
there), and we get a local-dev **front-end editor** to place those map pins (the
first slice of a bigger creator tool). Feeds the **Arcade story mode** RFE's
"overhead map zooms to each stage's map location" beat.

**Done this turn — home-stage (re)assignments** (the `stage` field on each
CharacterDef; missing stages fail gracefully to RANDOM/default today):
- [x] Reassigned all 13 built fighters to their canonical home stage:
      vincent→van, catherine→ai-kitchen, freeman→chiba, kirby→neptune,
      marzipan→salton, yulia→chiba-roof, ygor→painted-canyon, flo→ski-inn,
      gene→hyperion, bodhi→dojo, chebel→mimos, rapha→escapes, cat→shipwreck.
      (All 13 built fighters now resolve to a real generated home stage.)
- [x] **Four new stages generated** from existing `assets/stage-inspo/` folders
      (Bombay Beach photo refs → 21:9 pixel-art per the locked stage look):
      **TVS** (painted-CRT outsider-art wall), **STAR BEACH** (lattice star
      pavilion on the salt flats), **LAST RESORT** (the "LAST STOP FOR THE BOMBAY
      BEACH RESORT" billboard), and **MUSEUM** (the stacked-shipping-container
      "Museum of Bombay Beach"). SCENES prompts added to `tools/gen-stage.mjs`,
      registered in `src/data/stages.ts`, QA'd by eye. tsc clean.
- [x] **AI KITCHEN** stage generated (2026-07-05) from `assets/stage-inspo/AI KITCHEN/`
      — the off-grid communal camp kitchen (orange pallet-racking beams, bulk-food
      shelves, desert-playa window). Catherine's home stage (was temporarily uranus).
- [x] **DOJO** stage generated (2026-07-05) from `assets/stage-inspo/DOJO/` — the
      acro-yoga/martial-arts training hall (black foam mats, lotus gong, taped
      instruction cards, crystal altar). Bodhi's home stage; art now exists.
- [x] **HYPERION** stage generated (2026-07-05) from `assets/stage-inspo/HYPERION/`
      — the neon-lit hacker/maker den (green+magenta LED strips, workbenches,
      3D printer, roll-up door). Gene's home stage; art now exists.
- [x] **THE ESCAPES** (id `escapes`) stage generated (2026-07-05) from
      `assets/stage-inspo/ESCAPES/` — the graffiti-bombed ghost-town compound
      (tagged shed + "BANK" sign, Mars salvage racking, blue trailer, red truck).
      Rapha's home stage; repointed rapha from the placeholder `the-escapes` →
      `escapes` (folder id). Re-rolled once for a crunchier pixel look + clear
      foreground.

**NEEDS CREATING — characters referenced but not yet built** (each is a full
7-step pipeline run + roster wiring; re-check the Martian Lore "privacy opt out"
column before starting — do NOT scaffold anyone marked NO AI PLEASE):
- [x] **vanessa** → saturn — 14th fighter, full pipeline built (24 moves,
      fatality "Fired and Glazed" w/ 4 panels, cloned/announcer VO incl.
      per-move call-out, sprite sheet + 3 projectiles). Wired into
      `roster.ts` (`playable:true`) and `characters/index.ts`.
- [ ] **earl** → star-beach   - [ ] **haidai** → altar
- [ ] **jack** → tvs   - [ ] **tao** → institute   - [ ] **jordan** → dome
- [ ] **neil** → the-range   - [ ] **dulcinee** → museum   - [ ] **puddles** → last-resort
      (Tao & Puddles already listed under the "Unlockable hidden characters" RFE.)

**NEEDS CREATING — stages referenced but no art yet:**
- [x] All home stages for the 13 built fighters now have art (escapes, hyperion,
      dojo, ai-kitchen generated 2026-07-05). None outstanding.
- [x] **museum** — generated (owner dulcinee still needs building).
- [ ] Orphan folder `assets/stage-inspo/BOMBAY BEACH/` exists with no owner
      (marzipan moved to salton) — user said leave dormant for now.

**Front-end dev editor — BUILT 2026-07-05 (dev-only; the Stage Pin tool):**
- [x] **Dev-write backbone: Vite dev-server middleware plugin** (`editorApi()`
      in `vite.config.ts`, `apply: 'serve'`). POST `/__editor/stage-pins` →
      validates/clamps the body to `{x,y}∈[0,1]` and rewrites
      `src/data/stage-pins.json`. Exists ONLY under `npm run dev`; absent from
      the prod build. This is the shared backbone the future character creator
      reuses. Verified: 200 + file written + out-of-range values clamped.
- [x] **Editor hub scene** (`EditorMenuScene`, key `EditorMenu`) — the "sub menu"
      reached from the title's **6 · DEV EDITOR** item (only pushed when
      `import.meta.env.DEV`; both editor scenes are only registered in dev in
      `main.ts`). Lists tools (today: STAGE PINS) + BACK; mouse/keyboard/pad nav.
- [x] **Stage Pin editor** (`StagePinEditorScene`, key `StagePinEditor`): the
      `ui-world-map` up top, a scrollable-free auto-fit list of all stages, ●/○
      placed markers. Click a stage → click the map to drop its pin (normalized
      0..1); pins are draggable; first placement auto-advances to the next
      unplaced stage; CLEAR PIN / SAVE / BACK buttons; live "N/M placed · unsaved"
      status. SAVE POSTs to the middleware. `StageEntry.pin` + a merge loop in
      `stages.ts` load the saved coords back onto the registry. tsc clean,
      237 vitest green. Verified live (render + place + auto-advance + save→disk).
- [x] **Select-screen wiring — DONE 2026-07-05.** All 27 authored pins render on
      the SelectScene world map as dim amber dots (no labels). Each side's
      currently hovered/held fighter lights its home-stage pin with a
      player-colored ring + the stage NAME label + a stage THUMBNAIL beneath the
      pin (connector line + colored border), driven per-frame from `redrawPins()`
      off `idx[p]` → `characters[id].stage` → `stageById().pin`. P2 shows once its
      pick is in play (always in 2P/online; after P1 locks in CPU/training/
      showcase); the shared-pin case nests P2's ring + tucks its label. All pin
      objects sit at depth < 10 so the stage-pick dialog's opaque overlay hides
      them. tsc clean, 251 vitest green; verified live (salton + hyperion
      highlights, thumbnails, dots all correct).
      Thumbnail layout revised 2026-07-05 (user call): thumbnails moved OFF the
      map into the left (P1) / right (P2) gutters flanking the map, each in a
      player-colored frame; the map itself now only shows the highlighted pin
      (ring) + stage-name label. `SIDE_THUMB_*` constants in SelectScene.
      Also replaced `van.jpg` with a cleaner full-van redraw (was `van2.png`)
      and re-encoded it to a standard baseline JPEG — the old file had a
      malformed JFIF density (11880x11879) that some decoders rejected; new one
      is density 1x1 and loads via both `<img>` and `createImageBitmap`.
- [x] **Music volume crash fixed** (same session): `HTMLMediaElement.volume`
      IndexSizeError from float rounding on the fade/duck interpolation landing a
      hair outside [0,1] — `src/audio/music.ts` now clamps every computed volume
      assignment via `clamp01()`.
- [ ] **Character creator** (skeleton not built yet — deferred): name /
      bring-or-generate art / **voice cloning** (VibeVoice / OmniVoice) / bio +
      move-list prompt / sprite gen / per-frame re-roll, reusing the dev-write
      backbone above. Ties into the **Custom character designer** RFE below.

### Long-term RFEs (roadmap, not scheduled)
- [ ] **Custom character designer dialog** — in-game UI that runs the
      photo→fighter pipeline: upload an inspo photo, pick a kit archetype,
      generate canonical/frames/portraits (the 7-step pipeline as a product)
- [ ] **Online multiplayer** — two-player versus from remote locations in the
      browser; engine determinism was built for rollback netcode from day one
- [ ] **Arcade story mode** — 1-player ladder: fight through every roster
      fighter in their home stage, with intro/ending story beats per
      character. Between fights, a stylized overhead map of Mars + Bombay
      Beach zooms into a defined map location associated with each stage as
      the player advances the ladder (wants CPU difficulty levels first).
      **Canon story arc (Vincent, 2026-07-08):** the run moves through the
      Off Grid world of Mars College and into the town of Bombay Beach,
      fighting each Martian, then **RJ** (Tao's first hench goon — the Sagat
      analog), and finally **Tao Ruspoli** — the end boss (M. Bison analog),
      aristocrat-turned-desert-patron and Biennale co-founder — to become
      **Champion of the Bombay Beach Biennale**. DATA STUB SHIPS NOW:
      character JSONs carry `arcade: { motivation, ending }` (SF2-style
      intro blurb + post-credits scene), authored in the creator's PROFILE
      step and written by the design-draft LLM from the fighter's lore —
      so every fighter accumulates story data before the mode exists.
- [ ] **Super bar + super move** — per-player meter builds over the fight;
      when full, each fighter gets one cinematic signature super (super
      freeze/flash ships with it). Promoted from the Icebox
- [ ] **Bonus stages** — SF2-style interludes between arcade-ladder fights
      where players break certain items against the clock (car-smash homage
      promoted from the Icebox; more item-break variants welcome)
- [ ] **Unlockable hidden characters** — secret fighters from town (Tao, RJ,
      Rapha, Anderson, Puddles, etc.) unlocked through play; characters are
      data files, so each is a pipeline run + an unlock condition
- [ ] **Expanded Martian roster** — more Mars College fighters beyond the
      launch eight; the pipeline is proven and the roster bible has room
- [ ] **Per-character double jump** — enable a double jump for certain
      acrobatic characters via a character-JSON flag (data-driven — no
      per-character engine special cases)
- [ ] **Veo motion smoothing** — upgrade keyframe animation to sampled
      motion-clip frames; the biggest visual-quality lever we have

### Combat mechanics — new archetypes to build (user-directed 2026-07-05)
Each becomes a VALID archetype to pick in the `move-authoring` skill once built;
every engine mechanic ships with a vitest (determinism rules). Current coverage
audit lives in the `move-authoring` skill.
- [ ] **Forward-forward (ff) attacks** — add `ff` as a `Motion` trigger; make
      dash-attacks a common, encouraged option
- [ ] **Directional + attack (Smash-style tilts/smashes)** — hold a direction +
      button for a distinct move (new input paradigm alongside motions)
- [ ] **More "get over here" pull moves** — plumbing exists (`projectile.pull`,
      Vine Spear); design more into kits
- [x] **Charge back-forward projectile** (true Guile Sonic Boom) — DONE 2026-07-07:
      added a new `cbf` motion (hold ← `CHARGE_TICKS` via `f.backCharge`, then →)
      mirroring `du`; `bf` sequence left intact for the 5 chars that use it. Test.
- [x] **`du` charge flash-kick exposed** — the engine plumbing was already built;
      now surfaced as a **Flash-kick archetype** in the moves creator (still no
      built-in roster char uses either — the CONTROL is available to pick).
- [ ] **More mash / rapid single-attack specials** (Chun-Li lightning legs,
      E. Honda hundred-hands, Blanka electricity) — `input.mash` exists, underused
- [ ] **Air command-specials / dives** — fire a motion special while airborne
- [ ] **Wall-kick / bounce moves** (Chun-Li, Vega) — wall-jump + bounce mobility
- [ ] **Replace install-style moves with catalog archetypes** — install/buff
      plumbing is DECLINED (not liked); swap Gratitude (Vanessa), Third Round
      (Lyosha), Microdose (Ygor), Breathwork/Presence (Freeman) for buildable
      archetypes where those moves are wanted

### VFX & smoothness (user-directed 2026-07-05)
- [ ] **More basic hit-spark overlay variety** — multiple scales + densities so
      characters vary and low sprite-count moves read smoother
- [ ] **Frame-trail effect on high-velocity attacks** — motion-smear/afterimage
      to cut choppiness where sprite counts are low
- [ ] **SOON: multi-frame VFX sprite-sheet gen in ONE pass** — get nano-banana to
      emit 9- or 16-frame effect grids in a single call, cut them up on import
      (low-res is fine); one call yields a whole animated effect. Unlocks the
      hit-spark variety + frame-trail work cheaply.

### Tooling & skills (canonical, 2026-07-05)
Character sprite work is codified as invokable skills in `.claude/skills/` and is
valid to lean on: **sprite-generation** (prompt craft), **sprite-qa** (DWPose/
alpha deterministic QA + `tools/qa/`), **move-authoring** (kit design + the
archetype→plumbing catalog — pick archetypes from here), **new-character**
(end-to-end orchestrator; lore-sheet fuzzy-search + the 7-step pipeline).

### Sprint 24 — proposed (low-hanging, high-value; 2026-07-05)
Theme: smoothness + showcase already-built mechanics (low engine risk).
- [x] Multi-frame VFX sprite-sheet generator (single nano-banana pass → 9/16
      grid) — DONE 2026-07-05: `tools/qa/gen-vfx-grid.mjs` + `vfx_grid.py`
      (key/inset/greyscale-normalize/centroid-center/edge+failed-key validate)
      + `vfx_grid_boomerang.py` (truncate-before-edge bloom loops) +
      `vfx_canonize.py`. Codified in the **hit-spark-generator** skill.
- [x] Hit-spark variety **library** — DONE 2026-07-05: 15 tintable greyscale
      strips + tags in `public/assets/vfx/sparks/` (`sparks.json`). Tags
      (light/heavy/slash/energy/spark/noise/sparse/…) drive pooling.
- [ ] **Wire spark playback into the renderer** (the anti-samey spec, in the
      hit-spark-generator skill): pick-per-hit from a TAG POOL, per-move/char
      `sparkTags` override, rotate+mirror to the attack angle, position/scale
      jitter, layer for heavies, play-once ~24–30fps in the hitstop — all
      driven by a DETERMINISTIC hash (tick+slot+hitcount), not `Math.random`.
- [ ] Frame-trail effect on high-velocity attacks (render-side)
- [ ] Wire the unused `du` charge + `mash` archetypes into 1–2 fighters (DATA
      ONLY — plumbing already exists, zero engine risk, immediate variety)

### Sprint 25 — Dev editor: Move Tuner + Sprite Editor + Character Scale (user-directed 2026-07-06)
Theme: turn the Sprint 23 dev-editor backbone into real content tools. All
dev-only (EditorMenuScene → tools; `import.meta.env.DEV`; `/__editor/*` Vite
middleware, no-op in the prod build).

**Move Tuner** (`src/ui/MoveTunerPanel.ts`, FightScene `tuner` mode):
- [x] Pick 2 fighters in a training sandbox; per-slot control Manual / CPU
      (low/med/high, `src/ai/difficulty.ts`) / Loop-a-move (approach→attack→
      retreat→wait, pause + timer; directional keys still nudge for positioning).
- [x] Live move inspector (frame data + hitbox) mutating the live `characters`
      registry; WRITE TO DISK → character JSON. Difficulty is the same dial
      attract-mode now randomizes.

**Skeleton overlay (2D, F3)** — DWPose keypoints baked into meta.json at pack time:
- [x] `pose_qa.py` persists per-cell keypoints; `pack-sheet.mjs` bakes them into
      `meta.skeletons` (shifted by the normalize dy); `FightScene.drawSkeleton`
      replays them live over the sprite (no runtime inference), colored like the
      QA montage. Body + hands (finger bones) + feet; FACE points dropped (bloat).
- [x] Hotkeys conformed 2D↔3D: F1 hitboxes · F2 move log · F3 skeleton · F5 stage guide.

**Sprite Editor** (`src/ui/SpriteEditorPanel.ts` + `spriteSheetModel.ts`, FightScene `spriteEditor` mode):
- [x] Live looping fighter + DOM sprite grid (shift-range / ctrl-toggle select,
      drag-swap, clipboard) + selected-cell preview w/ floor inset; resizable +
      collapsible panels.
- [x] Sprite ops: per-cell/batch scale/normalize/offset; regen keypoints (live
      DWPose via `/__editor/skeleton-regen`); regen a frame via nano-banana
      (`/__editor/gen-frame`).
- [x] Move ops: frame-data + hitbox sliders, draggable hitbox + joints on-canvas,
      auto-hitbox from the skeleton hand/foot cluster, soft silhouette box, floor line.
- [x] Non-destructive; WRITE composites the sheet → `/__editor/sheet` (timestamped
      backup to gitignored `assets/raw/sprite-edits/` before overwrite).
- [x] Follow-up UX pass: prompt textareas/input fields now receive fight-key
      keystrokes normally while focused; sprite cells can be flipped X/Y; Write
      Moves + Write Sheet + Commit became one checkbox-driven submit; special
      inputs are editable in-place (including no-motion/chord controls like
      Yulia's `PPP` Braid Lariat).

**Character Scale** (`src/data/characterScale.ts`, renamed from `spriteScale`):
- [x] `scale` is a uniform multiplier — art + hurt/hit boxes + joints +
      PROJECTILES + grab range — about the feet origin. Live-editable in both
      tools (re-bakes in place from a cached base, no drift); saved to JSON via
      the extended `/__editor/character` endpoint.

**Engine / driver / pipeline:**
- [x] `CpuDriver` performs EVERY motion special in the loop (added dp/du/360;
      idle/walk pseudo-poses). Regression test `src/ai/bot.test.ts`.
- [x] Restored vincent's Matrix Teleport to the MIRROR def (28/4/20, mirror:true,
      invulnFrom 14, invuln 24) — a parallel tuning pass had reverted it to a
      plain `behind` blink, breaking the Sprint 20 tests + the added frames.
- [x] `pack-sheet.mjs` SCALE_PAD now matches `pose_qa.py` HEADROOM=24 (baked
      keypoints/hitboxes were ~24px misregistered vs the packed art).
- [x] Python resolver (`tools/qa/resolve-python.mjs` + `run.mjs`) — bare `python3`
      may be too new (3.14) for rtmlib; auto-picks 3.11–3.13, honors `MK_PYTHON`.
- [x] `.gitignore`: unscoped non-frame `assets/raw/` (kept frames) to slim the repo.

**Priorities / follow-ups:**
- [ ] **Update combo/gameplay tests after auto-hitboxes are calculated for ALL
      fighters** (PRIORITY). Auto-hitboxes hug the art tighter than the old
      feel-tuned boxes (vincent's jab now reaches less far → the Sprint 19
      combo-scaling `≥5-hit` test fails). Don't chase it per-fighter — re-tune the
      whole roster via the editor, THEN update the tests to the new reach.
- [ ] **Roster floor + keypoint migration** — only vincent & gene are normalized
      + full-keypoint. Re-QA + `gen:pack --normalize` the other 12 (fixed
      SCALE_PAD), then flip global `SPRITE_FOOT_OFFSET_Y`→0 and zero every
      per-char `spriteOffsetY` (interim: vincent/gene = -16 cancel the global 16).
      ONE atomic pass — a half-migrated roster keeps offsets fighting the normalize.
- [ ] **Sprite Editor Phase 2: projectiles spawn from a named joint** (hand →
      fireball, head → fire-breath, floor → low) — editor authoring aid that
      writes spawnX/spawnY from the active cell's keypoint; engine stays pure.
- [ ] Editor sheet edits diverge from `assets/raw/frames` — a "re-pack from raw"
      reconciliation path (or warning) so a later `gen:pack` doesn't silently
      clobber in-editor pixel edits.

### Sprint 26 — Character Creator wizard (user-directed 2026-07-07, IN PROGRESS)
Theme: a dev-only, full-service **browser wizard** that runs the whole 7-step
pipeline from the front-end — zero (name + photo + description) → hero (playable
fighter) — eventually subsuming Move Tuner + Sprite Editor and gaining a
Cloudflare R2 publish/pull path. Full design + worked example in
`docs/CHARACTER_CREATOR.md` + `docs/CHARACTER_CREATOR_WALKTHROUGH.md`.

**Locked decisions:** one provider (Gemini text + nano-banana images) with a
per-character context cache · QA is advisory-only (edge-clearance warns, never
blocks) · everything assembled in an in-browser working model → `<id>.json` +
`meta.json` + `sheet.png` on write · `lore` block on CharacterDef · QA/pack/
normalize stack gets a ground-up rethink (wizard uses a lean pack path) · R2
bidirectional publish/pull · staged ref-chained sprite batches (jump normals ref
the approved jump image, crouch ref crouch, specials projectile-first).

**Built this turn (2026-07-07) — the scaffold, verified live w/ real nano-banana:**
- [x] Dev-only `CharacterCreatorScene` (grid backdrop + UiLayer DOM overlay,
      like Sprite Editor) + EditorMenu "CHARACTER CREATOR" entry + dev-only
      registration in `main.ts`.
- [x] Wizard shell (`src/ui/CharacterCreatorPanel.ts` + `creatorModel.ts`):
      7-step stepper, live stage-preview with diffusion shimmer, bake tray.
- [x] **D1 Seed** — name + desc + full-body/face photo → fires canonical +
      portrait → approval gate (approve/reroll) → gated Continue. Verified: real
      on-model canonical + portrait generated.
- [x] **D2 Profile** — client-side design draft (archetype auto-detected,
      color, lore, backstory, win-quotes/kiai/hurt lock-grids w/ pool reroll);
      stage + voice upload; **auto-fires the base sprite batch** (idle/walk/jump/
      crouch/block/fall/down) on entry; live preview **animates** the walk cycle
      as cells return. Verified: all 11 base cells generated real art.
- [x] Backend `/__editor/creator/gen` (nano-banana + ffmpeg key; **mock
      fallback** draws client placeholders when no GEMINI key / `MK_CREATOR_MOCK=1`
      so the flow is walkable with zero setup). Dev-only (`apply:'serve'`).

**Playable end-to-end — DONE 2026-07-07** (verified live in mock mode: seed →
profile → base batch → SHIP → reload → **playable MIRAGE vs VINCENT fight**,
503/503 assets, 0 load failures):
- [x] Engine-valid default kit (`buildFullCharacter`): 18 button normals +
      throw + specials mapped from archetype → engine fields (projectile/
      teleport/leap/forwardVel/grab/invuln/rehit), measured-default boxes.
- [x] SHIP writer: client composites base cells → sheet.png + meta.json; POST
      `/__editor/creator/write` writes `<id>.json` + portrait (+bust/ko copies) +
      **17 silent VO placeholders** (missing per-fighter assets otherwise hang the
      dev loader) + idempotent roster + `characters/index.ts` registration.
- [x] `martian-kombat-mock` launch config (`MK_CREATOR_MOCK=1`) so the whole
      flow is testable with zero API spend (nano-banana hit a monthly cap mid-test).

**Full pipeline in-browser — DONE 2026-07-07** (all verified live in mock mode):
- [x] **D3 attack sprites** — flat 3-phase cells (standing startup/active/recovery,
      crouch active/recovery, air single, specials 3-phase), ref-chained (jump→jump
      img, crouch→crouch img, standing/special→canonical), pooled 5-at-a-time.
- [x] **D6 RIG** — LOCAL Python DWPose via the existing `/__editor/skeleton-regen`
      (fal is ship-only, per direction) → keypoints baked into `meta.skeletons`;
      auto-hitboxes from the active-cell skeleton (`hitboxFromSkeleton`, render-scale
      converted) overlaid onto move data.
- [x] **Audio + music** — real ElevenLabs VO (`/creator/audio` + per-line
      `/creator/audio-clip`; announcer = Maverick, same as roster), per-line play +
      regen for kiai/hurt/victory + announcer; ElevenLabs music (`/creator/music`);
      **Fish voice-clone** (`/creator/voice-clone` → routes grunts through the clone);
      BYO voice/kiai/music routed into the write; silent-clip fallback so the loader
      never hangs.
- [x] **Fatality** (`/creator/fatality`, 4×16:9 panels) + **stage registration**
      (un-keyed 21:9 bg written + registered in `stages.ts` + claimed on the fighter)
      + **square portraits** (512²).
- [x] **UX** — drag-drop + batch + removable uploads; group/single-cell **preview
      switcher** + per-cell **scale** (bakes into refs + sheet) + **regen with the
      original prompt** pre-filled; **in-level backdrop** (stage textures the whole
      generator, fighter stands on the ground line); resizable/collapsible panels;
      **activity log** + running timers + red error cells; **3 victory quotes**.
- [x] **Persistence** — live-save every frame to gitignored `assets/raw/creator/<id>/`
      + debounced `state.json`; **RESUME** bar; **⤓ ZIP export** (playable bundle +
      raw progress, `/creator/export`).
- [x] **Canon edit path + throw frames** — creator attack generation now includes
      throw startup/active/recovery cells; Seed can reopen any playable roster
      fighter from raw JSON + packed sheet/meta/projectiles/portraits/fatalities,
      slice the sheet back into editable jobs, and preserve the original JSON as
      the write-back base instead of rebuilding tuned canon characters from a
      generic template.

**Editor UX + specials pass — DONE 2026-07-07 (all verified live in mock):**
- [x] **Specials editor** (the D5 table) — combined into a single **MOVES** step
      (SPRITES+SPECIALS merged; 7 steps → 6). Per special: full **archetype dropdown**
      (7 buildable catalog entries + helper descriptions that never hit the prompt),
      **controls dropdown** (archetype-sensible motions), **editable description**
      (drives the projectile + active-frame art), **swap from the drafted pool**
      (8 candidates), and **approve-before-gen** (gen buttons gated; batch skips
      unapproved). **Projectile-first chain** confirmed (projectile art from the
      description → active frame refs it → startup/recovery ref active).
- [x] **Projectile slots** — projectile-archetype specials render a projectile art
      slot (dashed placeholder / thumbnail); written to `projectile-<move>.png` on
      SHIP/export + asset-manifest rescan; non-projectile specials stay blank.
- [x] **Per-move animation player buttons** (top-left) — one per normal + special,
      grey until generated, lit when done, click to play the move's phase sequence.
- [x] **Real preview animations** — jump (idle→airborne arc→land), crouch, block,
      fall (idle→hit→fall→down) sequence real cells; added the **`hit`** base cell.
- [x] **In-level backdrop** — the generated stage textures the whole generator;
      fighter stands on the ground line; inspect panel OVERLAYS the dialog (never
      shifts the fighter). **Ghost "missing" cell slots** generate one cell.
- [x] **Cell realign** — per-cell scale + **x/y offset** (baked into preview, sheet,
      refs); **img2img regen** toggle; regen box **pre-fills the original prompt**.
- [x] **Character archetype dropdown** (5, with descriptions; re-rolls the kit).
- [x] **Per-line VO play/regen** + announcer (Maverick) via `/creator/audio-clip`.
- [x] **Pipeline frame naming** (`NN-cellname.png`) + **resume hardening** (image→
      done, orphaned-frame relink by cell name, clickable stepper, batch re-runs
      only failed cells) + periodic autosave + **activity log** (timers, error cells).

**Backlog (this sprint):**
- [x] **Creator ZIP/write hardening + Earl dogfood canonization checkpoint** —
      fixed `/creator/write` per-move `moveAudio`, deterministic raw-frame
      renaming after `block-crouch` and special renames, source-frame/projectile
      ZIP export, ZIP import/register, KO portrait regeneration, and preserved
      existing bust/KO assets for older drafts. Earl is the live dogfood bundle
      with corrected `assets/raw/frames/earl/` numbering and projectile source art.
- [x] **Sprite Editor follow-up fixes** — fight-key text entry works in prompt
      fields, selected cells can flip X/Y with skeletons mirrored, write actions
      are batched behind checkboxes, and loop/showcase input can execute charge
      motions plus button-chord specials (`PPP`/`KKK`/`LPLK`).
- [x] **Vincent creator/edit checkpoint** — current dogfood edits committed:
      re-packed/renumbered Vincent source frames with throw inserted before
      specials, updated packed sheet/meta/projectile, tuned `vincent.json`,
      Vincent home stage, cloned/generated Vincent voice assets, and stage/voice
      registry updates.
- [x] **CPU demo debug utilities** — menu-chosen demo and idle attract fights now
      keep F1/F2/F3 renderer debug controls live (hitboxes, move log, skeletons;
      plus renderer-specific debug keys) without making idle attract exit on
      those keys.
- [x] **Real Gemini design-draft** — D1 submit now posts name + one-line
      description + lore/backstory to `/__editor/creator/design`, which returns
      a strict creator `DesignDraft`: on-theme lore, win quotes, kiai/hurt/
      victory barks, buildable special names/descriptions, fatality, stage
      prompt, and music prompt. Missing key / mock mode keeps the local template.
- [x] **Full special archetype catalog in creator** — the Gemini design prompt
      and special-move dropdown now expose every buildable engine archetype
      from the move-authoring catalog, with projectile-family moves sharing
      projectile art generation, tuning, preview, ZIP/write export.
- [x] **Ben creator dogfood checkpoint** — Ben is registered as a playable
      fighter with JSON, roster/index entries, 62-frame packed sheet + skeleton
      meta, raw frame sources, two per-move projectiles (`quesadilla`,
      `hot-coffee`), portrait/bust/KO, announcer + 18 voice clips, voice-inspo,
      and 4 fatality panels. Kit in this checkpoint: Quesadilla (hcf+P),
      Hot Coffee (qcf+P), Kitchen Grandma (dp+P), Midnight Munchies (bf+P).
- [ ] Context cache §16 + richer regeneration controls for design-only rerolls.
      → SUPERSEDED by Sprint 27 (Character Studio), Phase 4.
- [ ] Advisory edge-QA badges; R2 publish/pull seams (local-mock first).
      → SUPERSEDED by Sprint 27, Phases 4–5.
- [ ] Consolidate: audit/tests + skills + CLAUDE.md; fold Tuner/Editor in.
      → SUPERSEDED by Sprint 27, Phases 0/3/5.

### Sprint 27 — Character Studio (PLANNED 2026-07-08, branch `feat/character-studio`)
Goal: unify Character Creator + Move Tuner + Sprite Editor into one modular
Character Studio over a single shared data model, one pack path, one prompt
library, and one coordinate contract — with an auto-pilot "images in →
shippable fighter out" mode, a graceful Adopt/upgrade path for legacy
characters, and a local-now/R2-later storage seam. **Full plan + audit
findings in `docs/CHARACTER_STUDIO.md`** (read that first; this is the
checkbox mirror). Part-4 decisions LOCKED with the user 2026-07-08: atomic
migration approved (inventory + rename + fill missing cells as part of it);
dogfood = ONE full real-API run of a new lore-sheet fighter, max one re-run
per asset, quality front-loaded via the §2.9 reference-chaining strategy
(canonical gate → crouch/jump anchors → a→b idle/walk → sequential special
refs); ben/earl get kits + themed fatalities; R2 = seam + local mock only;
projectile origin/consistency tooling is a first-class Phase-3 deliverable.
Second-pass directives (same day): the studio is a **FightScene mode**
(WYSIWYG — the character always stands in a valid fight scene; collapsible
panels; unified F1/F2/F3/F5 debug overlays; a TEST module for manual /
P1-vs-CPU / CPU-vs-CPU play as a pipeline step); **CLI ⇄ studio ⇄ skills
parity is in scope** (skills rewritten against tools/core so Claude Code
CLI character creation = the studio pipeline); sprite QA stays MINIMAL
(human QA + vision check of canonical/crouch/jump reference images only;
pose-rule QA deferred); fal never runs locally (skeletons are local Python;
fal is shipped-prod only); publishing owns stages (assign existing / create
named / clean up mismatches) with a later hide/delete lifecycle for
characters and stages. Third pass: **stage creation includes world-map pin
placement** — the Stage Pin editor folds into the studio's STAGES module as
a map overlay, so ALL dev tools live in the studio; access model (Claude's
call): modules stay separately addressable via EditorMenu deep links (Move
Tuner → MOVES+TEST, Sprite Editor → SPRITES, Stages & Map → STAGES) — one
implementation, many doors; only the standalone scene implementations
(StagePinEditorScene, the creator scene's own backdrop) retire.
- [x] Phase 0 — guardrails + cruft sweep (no API calls) — DONE 2026-07-08:
      orphan assets deleted (haidai portraits, flo rm-rf panels, catherine
      legacy projectile.png — manifest regenerated to legacyProj:[]);
      vanessa's `teleportal` gained its missing `voice:true`; ThreeFxSystem
      legacy-projectile load gated on the manifest (was 404ing for 15/16
      fighters every 3D match); `assets.audit.test.ts` grew four suites —
      bust check, orphan sweep (portraits/sprite dirs/fatality panels/
      per-move VO), sheet-meta shape, and a character schema lint with an
      explicit KNOWN_KIT_GAPS backfill list (ben/earl kit grammar, vanessa
      quotes) — 324→361 tests, and the meta check immediately caught + fixed
      real cruft: vincent's meta.json carried 3 duplicate pixel-identical
      throw-* tail frames. Coordinate contract now has ONE source:
      `src/render/coords.json` + typed accessor `src/render/coords.ts` +
      `tools/core/coords.mjs` (Node) + `tools/qa/coords.py` (Python) — every
      hand-copied FLOOR_FRAC/CELL_W/CELL_H/HEADROOM/SPRITE_FOOT_OFFSET_Y/
      1.32-art-margin in FightScene/SelectScene/BootScene/SpriteEditorPanel/
      spriteSheetModel/hitboxFromSkeleton/CharacterCreatorPanel/pack-sheet/
      frames-manifest/pose_qa/normalize_floor replaced with imports; the
      cell↔world transform now lives ONCE in `src/render/geometry.ts`
      (renderScale/footOffset/cellToWorld/worldToCell/cellBoxToHitbox) —
      FightScene, the Sprite Editor flatten, and the creator's auto-hitbox
      all delegate to it. characterScale baseCache → WeakMap keyed by def
      object (HMR-stale-base hazard gone). QA hygiene: vfx-grid experiments
      moved to `tools/vfx/` (skill paths updated), resolver now probes
      rtmlib+onnxruntime+cv2, `npm run gen:busts` added, RTMPose naming
      fixed. tsc clean, prod build clean, 357/361 vitest (the 4 fails are
      PRE-EXISTING data-vs-test drift at HEAD: vincent's creator-checkpoint
      qcb remaps + the cbf sonic-boom test — Phase 2/3 rewrites those tests
      against synthetic defs). Boot verified in-browser: 541 assets, 0 load
      failures, 0 failed network requests, no console errors.
- [x] Phase 1 — one pack path + one prompt library (no API calls). DONE so
      far (2026-07-08): `core/keying.mjs` — one chromaKey/SCALE_PAD/
      keyPadSquare/STAGE_COVER source; the vite FF_KEY_PAD missing-HEADROOM
      mismatch is FIXED (editor/creator cells now land in the exact packed
      cell space; creator preview re-anchored to the ORIGIN_FEET line to
      match). `core/packer.mjs` — packCharacter() extracted from
      pack-sheet.mjs (now a thin CLI with a usage guard) and served by a new
      `POST /__editor/pack` (same path, timestamped backup, works for
      creator chars with no manifest entry by deriving the grid from meta);
      writes meta v2 (version/floorFrac/headroom/normalized). GATE PASSED:
      chebel packed by the extracted packer is pixel-identical (0/7M px) to
      the pre-extraction HEAD code; NOTE the committed sheets of the 14
      non-vincent/gene fighters are PRE-headroom era (6.1M px differ from a
      fresh pack) — confirmed Phase 2 scope, committed sheets restored
      untouched. Editor-edit survival: SpriteSheetModel exports edited
      cells + touched skeletons; `/__editor/sheet` persists them to
      `assets/raw/edits/<id>/{cells/,skeletons.json}`; packer applies those
      overlays on any re-pack; `/__editor/gen-frame` now writes the UN-keyed
      regen + prompt sidecar back to `assets/raw/frames/<id>/NN-<cell>.png`
      — the "gen:pack silently clobbers editor edits" hazard is CLOSED.
      Verified: /pack E2E on chebel via curl (62 frames, backup, meta v2).
      ALSO DONE (2026-07-08, 1c/1d): the shared cell contract + generic pose
      library moved to `tools/core/cells.mjs` (CELLS merged best-of-both —
      frames-manifest craft + the creator's idle-flicker/walk-stride pins;
      LOW/LYING, buildJobs, gridFor; frames-manifest re-exports so importers
      are unchanged) and the prompt craft to `tools/core/prompts.mjs`
      (STYLE_ART, FRAME_RULES incl. the creator's same-size clause,
      canonicalFromPhoto/Description, portrait/defeat(+IMAGE_SAFETY-soft),
      spritePrompt, fatalityBeats). gen-frames + gen-canonical now import
      from core; `creatorModel.ts` imports the SAME library via `.d.mts`
      declarations (BASE_CELLS derives from core CELLS; KO prompt is now the
      reference-based defeat prompt) — creator fighters are prompted with
      the canon craft (C2 closed). `core/coords.mjs` made isomorphic (JSON
      import attribute) so browser bundles work. Audio: `elevenTts`/
      `elevenSfx`/`ELEVEN_VOICES` in lib.mjs — gen-audio + both creator
      audio endpoints share one implementation; the vite fatality endpoint
      reads the ONE fatalityBeats copy. tsc + prod build + dev transform all
      verified. FINAL 1e (2026-07-08): creator SHIP now packs SERVER-SIDE
      through packCharacter — the client bakes per-cell scale/offset into the
      shipped raw frames (`bakedCellB64`), the server writes them + a
      `.cellspace` marker (keyed, cell-space — the packer copies them
      through instead of re-keying/re-padding, which would have shrunk them)
      + the client skeletons as an edit overlay, then packs. Shipped sheets
      now have exactly ONE producer (composeSheet remains for ZIP export
      only; legacy sheetBase64 fallback kept). Discovered + fixed in passing:
      creator canon-reopens had ALREADY overwritten vincent/earl/ben's raw
      frames with keyed cells (a gen:pack would have double-padded them) —
      `.cellspace` markers written for all three; the other 13 dirs verified
      true raw-gen (896×1200 green). Prekeyed pack path verified pixel-equal
      in a sandbox. Skills refresh pass 1 done: sprite-generation points at
      core/prompts+cells and carries the §2.9 reference-chaining policy;
      sprite-qa carries the MINIMAL-QA posture (human QA primary, local
      skeletons only, no validate→regenerate loops, fal never local) + the
      packer/overlay/meta-v2 map. **Phase 1 COMPLETE** — tsc + prod build +
      357/361 (4 known pre-existing).
- [x] Phase 2 — atomic floor/skeleton migration — DONE 2026-07-08 (zero API
      cost, all local compute). `tools/migrate-floor.mjs` re-packed all 16
      fighters `--normalize` with FRESH RTMPose skeletons inferred from the
      exact packed cells (new packer `inferSkeletons` mode — registered with
      the shipped art by construction; overlays now apply AFTER normalize so
      final-space edits can't double-shift). Every fighter's grounded sole
      verified ON the 338 (FLOOR_FRAC) line — ben needed a follow-up
      per-cell floor-align (his creator cells were generated independently,
      so the roster's single-shift normalize left per-cell variance; 50
      grounded cells aligned, skeletons shifted in lockstep). meta v2 +
      62-65 skeletons per fighter, all 16. `spriteFootOffsetY` → 0 in
      coords.json; every per-char `spriteOffsetY` stripped; the creator's
      -12 default removed — the half-migrated floor model is GONE.
      Inventory sweep: every fighter has ALL expected cells, special phases,
      and projectile art (zero generation gaps). Projectile consistency:
      ben/earl/vincent's creator-written projectile art was 288×384 cells of
      mostly transparent padding vs the pipeline's content-filling 96×96 —
      all four normalized (content-cropped, squared, 96×96) with renderSize
      rescaled to preserve the user-dialed apparent size; the packer now
      skips projectile rewrites for prekeyed dirs (a forced scale=96:96 was
      aspect-distorting them). Roster hitbox pass:
      `tools/migrate-hitboxes.mjs` (a Node port of the exact Sprite-Editor
      hitboxFromSkeleton + cellBoxToHitbox math) rewrote the 18 button
      normals for 15 fighters from their active-cell skeletons —
      **catherine skipped**: her bo-staff reach is a PROP the skeleton
      can't see; a fist-only box on a staff poke is wrong, not tighter
      (specials/throws/variants keep hand-tuned values everywhere). The 4
      drifted engine tests rewritten against SYNTHETIC defs (qcb button
      routing, reflect, cbf charge, freeze asymmetry) so user kit-dialing
      can never break them again. The 3D FLOOR_FRACTION 0.1486 confirmed to
      be a stage-art composition constant (documented, unrelated to sprite
      coords). **361/361 vitest — the suite is FULLY GREEN for the first
      time since Sprint 25.** tsc + prod build clean.
- [~] Phase 3 — schema backfill DONE 2026-07-08 (8 images — the approved
      budget): ben + earl gained the full roster kit grammar
      (lights-chain ['lp','lk','clp','clk'], cancel on all four mediums,
      L/H variants on 7 specials following the gene idioms) and THEMED
      hand-authored fatalities generated from their creator canonicals via
      /creator/fatality — ben **"Dinner's Ready"** (`dinners-ready`: husk
      slapped on the comal → tortilla-pressed → flaming quesadilla flip →
      plated with grandmotherly disappointment) and earl **"The Final Mix"**
      (`final-mix`: dragged before the speaker wall → fader slam / bass
      warp → shatters into vinyl at the drop → "a perfect take"); generic
      finish-* panels deleted. Vanessa gained 2 on-voice win quotes.
      KNOWN_KIT_GAPS emptied — the schema lint now holds the WHOLE roster
      to the full standard. Panels vision-checked (montage) + serve 200.
      361/361, tsc clean. STILL OPEN in Phase 3 (the studio shell itself):
      FightScene studio mode + module rail + TEST/STAGES modules +
      EditorMenu deep links + projectile editor + module-scoped write
      endpoint + core/kit.mjs + Adopt flow v1.
- [~] Phase 3 (shell) — studio as a FightScene mode
      (collapsible module rail Identity/Look/Sprites/Moves/Audio/FX/Test/
      Ship over the live scene; creator panels re-hosted, standalone
      creator scene retires) mounting the existing Sprite Editor + Move
      Tuner panels over one CharacterProject; TEST module (manual /
      P1-vs-CPU / CPU-vs-CPU / loop drivers, all panels hideable); STAGES
      module (assign / create-in-flow + register + world-map pin placement
      as one transaction — Stage Pin editor folded in as the map overlay;
      registration-mismatch cleanup); EditorMenu → deep-link launcher into
      studio modules (standalone pin-editor/creator scenes retire);
      projectile editor (joint-anchored spawn, in-flight preview,
      ref-chained reroll);
      single character-write endpoint with module-scoped merges +
      provenance; `core/kit.mjs` full-grammar default kit (chains/variants/
      cancel — fixes the ben/earl regression) + themed fatality slots;
      backfill ben/earl kits + fatalities + vanessa quotes; Adopt flow v1
      (legacy upgrade checklist + diff view).
      NEARLY DONE (3b–3j, see changelog): shell/rail/TEST/STAGES/deep-links/
      projectile spawns/kit.mjs/backfill shipped earlier; 3j added the field
      add-remove controls (quotes/VO/specials + locked throw), skeleton
      badges + regen-missing, the live-driven wizard preview, and Adopt v1
      (checklist + WRITE diff — gene/catherine verify byte-identical).
      REMAINING: the single character-write endpoint with module-scoped
      merges + provenance (today: tuner shallow-merges moves, creator
      writes whole-def — fold both into one endpoint when Phase 4's job
      runner touches the write path anyway).
- [~] Phase 4 — auto-pilot + jobs + lore: `/__editor/jobs` runner (SSE
      progress, persistence, cost accounting, 429 backoff); auto-pilot DAG +
      headless `npm run studio:run`; skills refresh (new-character /
      move-authoring / sprite-generation / sprite-qa rewritten against
      tools/core → CLI and studio become one pipeline); `core/lore.mjs`
      (lore-sheet fetch, machine-enforced privacy opt-out,
      lore→always/fatality/VO propagation); creator FX module closes
      pipeline step 8; context cache §16 + seed/prompt manifest +
      estimated-cost UI (no auto-fire spends); QA minimal (local skeletons
      + canonical/anchor vision gate only); validated E2E in mock, then ONE
      full real-API dogfood run (one reroll max per asset).
      FOUNDATION LANDED (2026-07-08, see changelog): withBackoff (429/5xx)
      wrapping every provider helper + MK_GEN_MOCK $0 mock mode in lib.mjs;
      core/jobs.mjs runner (DAG deps, pooled concurrency, persistence +
      resume, cost accounting, cancel) + /__editor/jobs endpoints with SSE;
      core/pipeline.mjs asset DAG over the idempotent gen:* scripts +
      `npm run studio:run` (confirm-before-spend, --mock/--only/--force).
      RETIRED same day (Vincent): the core/lore.mjs sheet-search + the
      machine-enforced privacy opt-out gate — no opt-out check is needed
      for this game anymore; lore is typed/pasted into the creator.
      The two §2.8 PROFILE auto-fire hazards are FIXED (entry auto-batch +
      drop-zone auto-stage-gen — every spend is an explicit click now).
      REMAINING: manual creator mode onto jobs; studio cost-UI strip +
      jobs panel; headless design-scaffold for brand-new names (today the
      wizard/profile-script scaffolds, then the DAG takes over); FX module;
      context cache §16 + seed/prompt manifest; skills refresh pass 2;
      full-DAG mock E2E on a scratch fighter; then the real dogfood run.
      DOGFOOD: **TAO SHIPPED 2026-07-08 — the full real-API run is DONE**
      (see the changelog entry): 17th fighter, registered + playable +
      audit-green (372/372), ZERO rerolls needed across ~70 images.
      Outstanding for tao: a home stage (needs Biennale reference photos —
      assign/create via the STAGES module) and optional per-move vfx
      overlays (degrades to generic sparks).
- [ ] Phase 5 — storage seam + publish: StorageDriver (LocalRepoStorage /
      R2Storage per CHARACTER_CREATOR.md §6, env-gated local no-op);
      PUBLISH in SHIP; custom-characters registry + resolveAssetBase roster
      merge; `r2:push` / `r2:pull` canonize tools; roster/stage lifecycle
      (`hidden` flag + guided delete); docs + CLAUDE.md consolidation
      (roster count, creator status, studio pointers) + final skills sweep.

### Sprint 28 — Fighting-game standards (MKS-1) + MUGEN/IKEMEN parity (user-directed 2026-10-04)
Goal: compare against the long-running community standard (M.U.G.E.N /
IKEMEN GO), adopt its worthwhile standards, and build a benchmark that ports
a gold-standard character (Kung Fu Man) into our engine and proves it plays
the same. Full write-up + roadmap: `docs/FIGHTING_STANDARDS.md`; skills
**fighting-game-standards** + **mugen-import**.

**Phase A — standards foundation ✅ (2026-10-04)**
- [x] `src/bench/` frame-data lab — measures every move/physics by running
      `step()` (SF convention): startup, total, recovery, on hit/block,
      hitstop, pushback (CH), connect range; combo-route finder (verified
      best meterless combo) + chain-loop/infinite verifier
- [x] MKS-1 bands + hard rules (`src/bench/standards.ts`), audit, CLI
      (`npm run bench`, `--char`, `--md`, `--parity`, `--update-baseline`),
      generated `docs/FRAME_DATA.md`
- [x] CI ratchet `src/bench/balance.audit.test.ts` + `baseline.json`
      (14 known errors grandfathered)
- [x] `src/compat/mugen/` parsers (DEF/CNS/CMD/AIR/SFF header/stage DEF) +
      porter; `npm run mugen:fetch` / `mugen:import --fit`
- [x] Kung Fu Man ported at **100% parity** (90% raw → 100% fitted; HD
      `kfm720` also 100%); `parity.test.ts` guards engine semantics
- [x] Engine: per-move `hitstop` (number | [attacker, victim]), `chip`,
      `blockKnockback` (MUGEN pausetime / guard damage / guard.velocity) + vitests
- [x] Docs/skills: FIGHTING_STANDARDS.md, CLAUDE.md section, 2 new skills,
      move-authoring + new-character bench gates

**Phases B–E** (compliance fixes, engine parity primitives, content
import, tooling) are tracked in **`docs/handoff/02-PLAN.md`** — P3.5, P3.8,
P3.11, P4.0–P4.4, P10.7–P10.9 and decisions D8–D10 — not here.

### Icebox (do not start)
- **Attract-mode gag reels (3D)**: occasionally, instead of a demo fight, the
  attract rotation holds on a stage with one or two fighters doing weird
  bits for a little while — Thriller-style dance, taunts, yawning under a
  street lamp — then rolls back into the normal demo. Mixamo has full dance
  clips (Thriller Part 1-4, etc.); the 3D clip pipeline + renderer-side
  gesture overrides (intro/taunt pattern) already cover the plumbing: drop
  clips into the manifest, add an attract scheduler that picks fight vs gag.

*(new characters, super meter, and the bonus stage PROMOTED 2026-07-03 to
the Long-term RFEs above)* · stage
interactables · rage meter + ENOUGH., armored/vault dashes, backdash
i-frames (Sprint 8 deferred list; mash motions PROMOTED to Sprint 20 —
Kirby's cat scratch) · real counter/armor primitives (Freeman's
Presence/Breathwork upgrades) · gamepad
rumble · fullscreen button + scaling · RANDOM tile on character select ·
persistent win/loss stats · per-character victory song: a `victorySong`
attribute in the character JSON names a track in `music/victory/` that
overrides the random pick when that fighter wins · proximity normals
(close/far button variants — declined 2026-07-03 feel review: high art cost
across 8 rosters for marginal gain) · camera zoom/deadzone (declined —
fixed-screen SF2 framing is intentional).

---


<!-- verbatim: SPRINTBOARD "Agent handoff notes" (was the end of the file) -->

---
## Agent handoff notes

**2026-10-04 — MKS-1 Phase A done + unified plan, on branch
`feat/mks1-rescue-handoff` (pushed).** The backlog is
`docs/handoff/02-PLAN.md` (audit + MKS-1 merged). Next: the old machine runs
`docs/handoff/01-OLD-MACHINE-PASSOFF.md` (R2 rescue + canonical anchors,
pushed to the same branch), then this machine runs
`03-NEW-MACHINE-RESUME.md`. The MKS-1 data fixes are plan P4.0–P4.4
(14 ratcheted errors) — each fix must be
followed by `npm run bench -- --update-baseline` or the ratchet test fails
(it rejects fixed-but-still-listed errors). Raw MUGEN content is gitignored:
`npm run mugen:fetch` before any `mugen:import`. Landmines: vite-node can't
load scripts outside the repo root (put throwaway scripts in `tools/fg/`
and delete them); don't raise global hitstop before C1 (cancels drop).

*(rewritten 2026-07-08 end-of-session — the previous notes were Sprint-20 era)*

**Current work: Sprint 27 — Character Studio, branch `feat/character-studio`
(24 commits ahead of main, not merged).** The full plan + audit is
`docs/CHARACTER_STUDIO.md` (read it first); the Sprint 27 section above is
the checkbox mirror. Phases 0–2 are COMPLETE (one coords source
`src/render/coords.json` + accessors; one packer `tools/core/packer.mjs`
serving gen:pack + /__editor/pack + creator SHIP with edit-overlay
survival; one prompt library `tools/core/{cells,prompts,kit}.mjs`; the
ATOMIC floor migration — all 16 fighters normalized to the 338 feet line
with fresh per-cell RTMPose skeletons in meta v2, SPRITE_FOOT_OFFSET_Y and
every spriteOffsetY deleted, roster hitboxes re-derived from skeletons
(catherine's staff reach exempt), 361/361 vitest fully green). Phase 3 is
~90% done: the studio is LIVE — `StudioSelectScene` roster manager (DEV
EDITOR → CHARACTER STUDIO: cards for every fighter, EDIT/ONLINE-OFFLINE/
EXPORT-ZIP/DELETE, ＋NEW, IMPORT ZIP, WIP-draft shelf with ✕), FightScene
`studio` mode with the top rail (CREATOR/SPRITES/MOVES/STAGES/TEST), the
creator re-hosted WYSIWYG (right-docked wizard, the FIGHT SCENE is the
preview: `setStudioSubject` mounts the draft as the live slot-0 fighter on
a dynamic canvas — placeholder ghost → real cells as gens land; canon
reopen inherits assets + auto-opens from a roster EDIT), the `wireframe`
dev stage template, the completeness GAP BAR, projectile joint-anchored
spawns in the tuner, and the VO-text persistence layer
(CharacterDef.vo + MoveDef.voiceText, recovered roster-wide by
tools/migrate-vo.mjs and whisper-verified for the dogfooded fighters).

**Still open in Phase 3** (shrunk 2026-07-08 by the 3j batch — field
add/remove controls, skeleton badges + regen-missing, live-driven wizard
preview, and Adopt v1 are DONE, see the 3j changelog entry): the single
character-write endpoint with module-scoped merges + provenance (fold into
Phase 4's job-runner write path); transcribe/mark vincent's 2 SFX
call-outs properly if desired; stage-music coverage for all stages; repro
any remaining older-character load error (a null-sourceSize clamp guard is
in). Then Phase 4 (the /__editor/jobs runner, auto-pilot DAG +
`studio:run`, core/lore.mjs with machine-enforced privacy opt-out, FX
module, context cache, ONE full real-API dogfood run —
reference-chaining policy is locked in docs/CHARACTER_STUDIO.md §2.9 and
the sprite-generation skill) and Phase 5 (StorageDriver/R2 seam, publish,
docs consolidation, retire the standalone CharacterCreatorScene).

**Landmines / lessons this sprint:**
- Every fight flag must pass through VersusScene AND fightShell's
  restart/select routes — they re-enumerate payloads (the studio flag
  silently vanished there once).
- The UiLayer root is pointer-events:none; any new DOM panel must opt back
  in or its buttons are dead to real mice (JS .click() masks it).
- assets/raw/frames dirs with a `.cellspace` marker are KEYED CELL-SPACE
  (creator-written: vincent/earl/ben) — the packer copies them through;
  re-keying/re-padding them double-pads. The other 13 are true raw gens.
- Stale creator draft states can hold TEMPLATE VO/quotes — never let a
  draft outrank the character JSON / voiceLines table without checking
  (migrate-vo now refuses template drafts).
- gen-audio.mjs and pack-sheet.mjs are import-safe now (main guarded) —
  keep it that way for any tools/*.mjs that both export and execute.
- The homebrew ffmpeg broke mid-session (brew upgrade: leptonica →
  libtiff.5 gone); user fixed it. A no-ffmpeg transcription path exists:
  Apple `afconvert` → whisper in /opt/miniconda3/bin/python3.
- Dev-server restarts are REQUIRED after vite.config.ts edits (the editor
  endpoints live there); scene-code edits need a full browser reload.

**Deploy recipe (unchanged):** push to main → the `deploy` GitHub Actions
workflow builds + publishes to https://drmbt.github.io/martian-kombat/.
Do NOT force-push gh-pages. Never deploy twice in quick succession.

