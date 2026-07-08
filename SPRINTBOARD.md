# Martian Kombat — Sprintboard

> **Protocol:** This file is the single source of truth for project state and the
> agent handoff sheet. Before **every commit/push**: tick the boxes you completed,
> append a changelog entry, and update the handoff notes if work is mid-flight.
> Unchecked boxes in the active sprint = the backlog. Do not silently add scope;
> new ideas go to the Icebox.

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
      the player advances the ladder (wants CPU difficulty levels first)
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
- [ ] Phase 3 (shell) — studio as a FightScene mode
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
- [ ] Phase 4 — auto-pilot + jobs + lore: `/__editor/jobs` runner (SSE
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
- [ ] Phase 5 — storage seam + publish: StorageDriver (LocalRepoStorage /
      R2Storage per CHARACTER_CREATOR.md §6, env-gated local no-op);
      PUBLISH in SHIP; custom-characters registry + resolveAssetBase roster
      merge; `r2:push` / `r2:pull` canonize tools; roster/stage lifecycle
      (`hidden` flag + guided delete); docs + CLAUDE.md consolidation
      (roster count, creator status, studio pointers) + final skills sweep.

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

## Changelog

*(newest first; add one entry per commit: date · scope · what changed · by whom/agent)*

- **2026-07-08 · ui · Sprint 27 Phase 3h: the creator is WYSIWYG — the fight
  scene IS the preview** (user-directed). CharacterCreatorPanel gained a
  scene-hosted mode: right-docked translucent wizard column, no opaque
  backdrop, its own preview column retired (kept detached so internals
  stay valid). FightScene gained `setStudioSubject(def, meta, canvas)`:
  slot 0 becomes a LIVE DRAFT — def into the live registry, cells on a
  dynamic canvas texture the wizard blits into as generations land
  (fireGen fast-path updates a single cell + refresh; a debounced full
  remount rides render()); placeholder ghost silhouettes stand in from the
  first frame of a fresh SEED and are supplanted cell-by-cell; canon
  reopen inherits the fighter's real sheet/def through the same mount.
  NEW: the `wireframe` dev stage template (programmatic sparse grid —
  horizon, perspective floor, accented FLOOR_Y feet line, scale posts,
  caption; the !hasBg purple fallback no longer paints over it) — NEW
  CHARACTER flows start there; editing an existing fighter opens on their
  home stage. NEW: the completeness GAP BAR under the stepper — ✓/⚠ chips
  for canonical/portrait/KO/cells n/N/throw/skeletons/lore/quotes/VO n per
  17/voice sample/music/fatality n per 4/stage — missing pieces are visible
  at a glance for drafts AND canon-reopened fighters (schema migration
  continues via applyKitGrammar on reopen). Verified live: ghost on the
  wireframe stage with the docked wizard, gap chips, resume + canon-edit
  chips. tsc clean. STILL OPEN (3h polish): preview-control buttons should
  drive the LIVE fighter (loop a move via the host), and a canon-reopen
  live-inherit spot-check. — Claude (Fable)

- **2026-07-08 · ui+tools · Sprint 27 Phase 3g: StudioSelect — the studio's
  roster-manager front door** (user-directed). DEV EDITOR → CHARACTER
  STUDIO now lands on `StudioSelectScene`: every fighter (online AND
  offline) as a portrait card with lifecycle actions — EDIT IN STUDIO
  (jumps to the rail at MOVES), TAKE OFFLINE / BRING ONLINE (new
  `/__editor/roster-flag` rewrites the roster.ts playable flag; offline
  keeps all files but leaves select/loader/audit), EXPORT .ZIP (new
  `/__editor/export-canon` bundles any CANON fighter from disk in the
  /creator/import round-trip layout — json + sprites + portraits + VO +
  fatality + stage art + raw sources), and DELETE… (new
  `/__editor/delete-character`, typed-id confirm: removes json + roster +
  index registrations + all public assets as one transaction, KEEPS
  assets/raw for recovery, rescans manifests). Plus ＋ NEW CHARACTER
  (straight into the CREATOR module), ⤒ IMPORT ZIP (existing import
  endpoint), a WIP-drafts shelf (unshipped creator runs via
  /creator/list), and a RELOAD prompt after roster changes (the boot
  loader reads the flag). The lifecycle work pulled forward from Phase 5
  §2.12 — "online/offline/publish/delete either" per the user. E2E
  verified: roster-flag round-trip byte-clean, vanessa exports a 40MB
  bundle, and a synthetic ztest fighter was created + deleted with zero
  residue (9 asset classes, registrations clean). 361/361, tsc clean.
  — Claude (Fable)

- **2026-07-08 · ui+tools · Sprint 27 Phase 3f: STAGES module** — the rail
  is now CREATOR / SPRITES / MOVES / STAGES / TEST. `src/ui/StagesPanel.ts`:
  the stage registry as a panel (per-stage world-map pin status + home-stage
  owner), a fighter ⇄ home-stage assignment row (writes `def.stage` through
  `/__editor/character`, which grew a validated `stage` field — set or
  clear; verified round-trip on vincent, file byte-identical after
  restore), and a WORLD-MAP PIN EDITOR jump — StagePinEditorScene gained a
  `returnTo` payload so BACK round-trips to the studio instead of dumping
  to the editor menu. Stage CREATION stays in CREATOR → PROFILE (noted in
  the panel); gen-in-flow rides the Phase 4 job runner. Verified live:
  panel renders all 27 stages with pins + owners. 361/361, tsc clean.
  — Claude (Fable)

- **2026-07-08 · ui · Sprint 27 Phase 3d: the creator wizard is a studio
  module** — CharacterCreatorPanel re-hosted as the rail's CREATOR module
  (lazily mounted over the live fight; drafts flush-save on unmount; the
  shimmer CSS + form-key isolation moved INTO the panel so any host works
  — typing in wizard fields can't drive the fight underneath). EditorMenu's
  CHARACTER CREATOR now launches the studio directly at the CREATOR module
  (no fighter pick needed to create one); the standalone
  CharacterCreatorScene stays registered but unrouted (retires in the
  Phase 5 cleanup). Verified live: rail CREATOR/SPRITES/MOVES/TEST with
  the wizard stepper + resume chips rendering, module swaps clean.
  361/361, tsc clean. — Claude (Fable)

- **2026-07-08 · tools+ui · Sprint 27 Phase 3c/3e: kit grammar + projectile
  spawn anchors** — `tools/core/kit.mjs`: THE roster-standard grammar
  (light chains, medium cancels, per-archetype L/H variant generation —
  projectile vx/ttl/damage axes, dp/rush damage+startup+forwardVel, grab
  damage; teleports/reversals/reflectors correctly get none) applied
  non-destructively by `buildFullCharacter` AND `buildFromBase` — a
  creator fighter can never ship mechanically thinner than the roster
  again (unit-verified incl. hand-tuned preservation). Projectile editor
  v1 in the Move Tuner (the MOVES module): spawnX/spawnY/renderSize now
  editable, plus a **spawn ⚓ joint** row — pick any of the ~23 body
  joints from the move's active-cell baked skeleton and SET writes its
  engine-space offset into the spawn (FightScene grew
  jointNamesFor/spawnFromJoint on the shared geometry transform; editor
  working-model joints win over the meta bake). Verified live: vincent's
  sigil-bolt spawn ← Rwri (20, −168). 361/361, tsc clean. Sprint 25's
  "projectiles spawn from a named joint" Phase-2 item: CLOSED. — Claude
  (Fable)

- **2026-07-08 · ui · studio route fix: VersusScene was dropping the flag** —
  User-reported: DEV EDITOR → CHARACTER STUDIO landed in plain training.
  Root cause: the VS-card VersusScene sits between Select and Fight and
  RE-ENUMERATES the fight payload — `studio`/`module` weren't in its list,
  so they silently vanished (the exact hop the first live test bypassed).
  VersusScene now carries them (with a warning comment: every fight flag
  must pass through), fightShell's restart/character-select routes and
  FightScene's shell opts forward studio/module (+ spriteEditor, which had
  the same latent gap on restart). Verified the REAL flow end-to-end in
  the browser: Select picks → stage → Versus → Fight shows CHARACTER
  STUDIO header + rail. 361/361, tsc clean. — Claude (Fable)

- **2026-07-08 · ui · post-migration polish: shadows up + corner volume** —
  With feet floor-normalized, the fighter shadows read low: every shadow
  anchor raised 6px (sprite shadows FLOOR_Y+10→+4, fallback ellipses
  +8→+2) so they hug the soles. VolumeOverlayScene reworked per user spec:
  a speaker BUTTON pinned to the far upper-right (click = mute on/off
  only), with a VERTICAL fader flying out beneath on rollover (top=100%,
  drag to set, auto-closes; unmutes on touch). Move Tuner + Sprite Editor
  panels now start at top:48px so they never cover the speaker (DOM always
  sits over the canvas overlay). Verified live on the van stage. Also
  verified the EditorMenu → CHARACTER STUDIO path end-to-end (rows render,
  Select carries studio:true, Fight mounts the rail + tuner). 361/361,
  build clean. — Claude (Fable)

- **2026-07-08 · ui · Sprint 27 Phase 3b: the Character Studio shell exists**
  — FightScene gained a `studio` mode: `src/ui/StudioRail.ts` (collapsible
  module rail) hosts the existing Sprite Editor + Move Tuner as lazily-
  mounted SPRITES / MOVES modules over the LIVE fight (panels gained
  setMounted; HUD show/hide extracted to setHudVisible); TEST deactivates
  everything for pure play with the F1/F2/F3 overlays. EditorMenu now leads
  with CHARACTER STUDIO, and MOVE TUNER / SPRITE EDITOR are deep links into
  the studio at their module (one implementation, many doors); Select
  forwards studio/module flags. Verified live: rail renders, modules mount/
  unmount + swap cleanly, TEST restores P2 + HUD, kirby loops with
  registered skeleton/boxes. 361/361, tsc clean. Legacy tuner/spriteEditor
  entry flags still work (unchanged paths). — Claude (Fable)

- **2026-07-08 · data+assets · Sprint 27 Phase 3a: schema backfill — the
  roster standard is universal** — ben + earl gained chains/cancel/L-H
  variants (gene idioms) and themed hand-authored fatalities generated from
  their creator canonicals (ben "Dinner's Ready", earl "The Final Mix" — 8
  images, the approved budget; generic finish-* panels deleted); vanessa
  gained her win quotes. KNOWN_KIT_GAPS emptied — the schema lint now
  enforces the full kit grammar for every playable fighter. 361/361, tsc
  clean, panels vision-checked + serving. — Claude (Fable)

- **2026-07-08 · assets+data+tools · Sprint 27 Phase 2: THE atomic floor/
  skeleton migration** — all 16 fighters re-packed normalized (feet verified
  on the 338 line) with fresh per-cell RTMPose skeletons in meta v2;
  SPRITE_FOOT_OFFSET_Y and every spriteOffsetY deleted (half-migrated floor
  model gone); ben per-cell floor-aligned; creator-written projectile art
  normalized to the 96×96 content-filled convention with apparent size
  preserved; roster hitbox pass from skeletons (15 fighters × 18 normals;
  catherine's staff reach exempt); 4 drifted engine tests rewritten against
  synthetic defs. **361/361 vitest — fully green for the first time since
  Sprint 25.** Zero API calls. — Claude (Fable)

- **2026-07-08 · tools+ui · Sprint 27 Phase 1e: creator SHIP through the
  shared packer — Phase 1 COMPLETE** — /creator/write now writes transform-
  baked cell frames + `.cellspace` marker + skeleton overlay, then runs
  packCharacter (one producer for every shipped sheet; composeSheet is
  ZIP-only). Packer gained a prekeyed mode (verified pixel-equal in a
  sandbox). Wrote `.cellspace` markers for vincent/earl/ben whose raw
  frames were already creator-overwritten keyed cells (double-pad hazard
  closed); other 13 dirs verified raw-gen. Skills pass 1: sprite-generation
  → core/prompts + §2.9 reference chaining; sprite-qa → minimal-QA posture
  + packer/overlay/meta-v2 map. — Claude (Fable)

- **2026-07-08 · tools+ui · Sprint 27 Phase 1c/1d: one prompt library +
  shared audio** — Cell contract + pose library → `tools/core/cells.mjs`
  (merged best-of-both poses), prompt craft → `tools/core/prompts.mjs`;
  gen-frames/gen-canonical AND creatorModel now compose from the same
  library (creator fighters get canon-quality prompts — C2 closed);
  `.d.mts` declarations bridge browser TS ↔ .mjs; coords.mjs isomorphic.
  ElevenLabs TTS/SFX + voice table unified in lib.mjs (gen-audio + creator
  endpoints); fatality default beats single-sourced. tsc + build + dev
  transform verified; 357/361 (4 known pre-existing). — Claude (Fable)

- **2026-07-08 · tools+ui · Sprint 27 Phase 1a/1b: one pack path** —
  `tools/core/keying.mjs` (one key/pad filter source — the vite copy's
  missing HEADROOM is fixed, so editor/creator cells finally match packed
  cells; creator preview re-anchored to ORIGIN_FEET) + `tools/core/packer.mjs`
  (packCharacter extracted from pack-sheet.mjs, proven pixel-identical on
  chebel; meta v2; new `POST /__editor/pack` with backup). Editor edits now
  SURVIVE re-packs: edited cells + touched skeletons persist to
  `assets/raw/edits/<id>/` (packer applies them as overlays) and gen-frame
  regens write the un-keyed art + prompt sidecar back to raw frames.
  pack-sheet CLI gained a usage guard (bare run used to mkdir a junk tree
  from argv[0] — the new orphan audit caught it). Discovery: the 14
  non-vincent/gene committed sheets are pre-HEADROOM era → Phase 2 scope.
  tsc clean; audit 54/54. — Claude (Fable)

- **2026-07-08 · data+tools+ui · Sprint 27 Phase 0: guardrails + cruft sweep** —
  One coordinate source (`src/render/coords.json` → TS/Node/Python accessors)
  replaces every hand-synced FLOOR_FRAC/CELL/HEADROOM/1.32 copy; one shared
  cell↔world transform (`src/render/geometry.ts`) replaces the 3 hand-rolled
  cellBoxToHitbox copies. Orphan assets deleted (haidai, flo rm-rf, catherine
  legacy projectile), ThreeFxSystem legacy-proj 404s gated, vanessa move-VO
  flag fixed, vincent meta duplicate throw frames removed. Audit test grew
  bust/orphan/meta-shape/schema-lint suites (324→361; KNOWN_KIT_GAPS tracks
  the ben/earl/vanessa Phase-3 backfill). characterScale base cache → WeakMap
  (HMR hazard). QA hygiene: vfx-grid experiments → tools/vfx/, resolver
  probes onnxruntime+cv2, gen:busts script. tsc + build clean; 4 remaining
  test fails are pre-existing data-vs-test drift (Phase 2/3). — Claude (Fable)

- **2026-07-08 · docs · Sprint 27 third pass: pin editor folds in, deep-link
  access model** — Stage creation in the studio now includes world-map pin
  placement (Stage Pin editor becomes the STAGES module's map overlay —
  every dev tool now lives in the studio). Access model decided: modules
  stay separately addressable via EditorMenu deep links; only the standalone
  scene implementations retire. `docs/CHARACTER_STUDIO.md` §2.1/§2.12 +
  Part 4 item 11. — Claude (Fable)

- **2026-07-08 · docs · Sprint 27 second-pass directives folded in** — The
  Character Studio plan now locks: FightScene-hosted WYSIWYG shell (studio
  is a fight-scene mode with collapsible panels + unified debug overlays +
  a TEST module for manual/CPU matches as a pipeline step), CLI⇄studio⇄
  skills parity as a core deliverable (skills rewritten against tools/core),
  minimal sprite QA (human QA + vision gate on canonical/crouch/jump refs
  only; pose-rule QA deferred; fal never local), and publishing-owned stage
  management (assign/create/cleanup now; hide/delete lifecycle in Phase 5).
  `docs/CHARACTER_STUDIO.md` §2.1/2.2/2.11/2.12 + Part 4 items 5–10.
  — Claude (Fable)

- **2026-07-08 · docs · Character Studio plan (Sprint 27)** — Full audit of
  the Character Creator / Sprite Editor / Move Tuner / tools+QA pipeline /
  character data tree, and the unification plan: `docs/CHARACTER_STUDIO.md`
  (audit findings incl. the FF_KEY_PAD-vs-HEADROOM pack mismatch, the two
  prompt libraries, the half-migrated floor model, the ben/earl schema
  regression, orphan assets, audit-test blind spots; target architecture:
  one `tools/core/` shared library, CharacterProject + meta v2, job runner,
  auto-pilot + manual modes, Adopt/upgrade flow, StorageDriver R2 seam;
  5-phase build plan + open questions). Sprint 27 section added; the three
  open Sprint 26 consolidation items marked superseded. Follow-up same day:
  Part-4 decisions locked with the user (atomic migration approved, full-run
  dogfood with one-reroll-max, ben/earl kits + themed fatalities, R2 seam
  only) and the reference-chaining generation strategy + projectile-tooling
  requirement captured as plan §2.9/§2.10. No code changes. — Claude (Fable)

- **2026-07-08 · ui · creator special archetype catalog expanded** — The
  Character Creator special dropdown and Gemini design-draft prompt now allow
  the full buildable engine catalog: fireballs/charge shots, flame cones,
  lobs, clouds, fuse detonations, traps, slow fields, pull and multi-projectiles,
  DP/flash-kick, rushes, mash/rehit, grab variants, teleports, reflectors,
  projectile-immune lariats, vault/leap, and yoga float. Projectile-family
  archetypes now all get projectile slots, tuning, preview flight, and export
  treatment. — Codex

- **2026-07-08 · assets+data · Ben playable creator checkpoint** — Added Ben
  as a registered playable fighter with creator-generated sprite sheet/meta
  (62 frames, skeletons baked for every frame), raw source frames, Quesadilla
  and Hot Coffee projectile art, portrait/bust/KO assets, four fatality panels,
  announcer line, kiai/hurt/victory VO, two per-move call-outs, voice-inspo, and
  asset-manifest entries. Also carries the current Earl/Vanessa/Vincent sprite
  sheet/meta/data edits from the working branch, removes stale `earl-home` /
  `vincent-home` stage registrations after those generated stage assets were
  dropped, and commits the local `.agents` skill mirror. — Codex

- **2026-07-08 · ui+tools · CPU demo debug overlays stay live** — `FightShell`
  now registers F2 move log and renderer debug keys even in CPU demo/showcase
  and idle attract fights, so F1 hitboxes and F3 skeleton overlays can be toggled
  while bots are demonstrating moves. Idle attract still exits on normal input,
  but no longer treats debug/perf keys as an exit command. Also hardened
  `gen-asset-manifest` to skip non-directory entries under `public/assets/sprites`
  so stray macOS `.DS_Store` files cannot break prebuild; regenerated the asset
  manifest after Vincent's legacy projectile removal. `tsc --noEmit` and
  `vite build` passed. — Codex

- **2026-07-08 · assets+data · Vincent creator/edit checkpoint** — Committed
  the current Vincent dogfood state before the next code pass: raw frames were
  re-packed/renumbered with throw cells inserted before specials, packed
  `sheet.png`/`meta.json` and `projectile-sigil-bolt.png` updated, legacy
  `projectile.png` removed, `vincent.json` tuning/scale bake/home-stage changes
  captured, Earl's home stage changed to `star-beach`, `vincent-home` registered,
  and Vincent voice clone/generated VO assets plus `tools/voices.json` updated.
  — Codex

- **2026-07-07 · ui · creator canon edit path + sprite-editor write/control fixes** —
  Character Creator now includes throw startup/active/recovery frames in the
  generated attack set, and can reopen a playable canon fighter from raw JSON +
  packed sheet/meta/projectiles/portraits/fatalities into editable creator jobs
  while preserving the existing JSON as the write-back base. Sprite Editor prompt
  fields now accept fight-key keystrokes while focused; selected cells can flip
  X/Y with skeletons mirrored; Write Moves / Write Sheet / Commit are batched
  behind checkboxes; special inputs can be reassigned in the move inspector.
  `CpuDriver` can now execute `cbf`, charge motions, pure button specials, and
  `PPP`/`KKK`/`LPLK` chords, fixing Yulia's Braid Lariat loop in the editor.
  `tsc --noEmit` and `vite build` passed. — Codex

- **2026-07-07 · ui+assets · creator ZIP/write hardening + Earl dogfood
  canonization** — Fixed the Character Creator's `WRITE + REGISTER` regression
  where `/creator/write` used `moveAudio` without reading it from the payload.
  Creator saves/downloads now derive raw filenames from the current model order,
  so newly inserted `block-crouch` shifts `hit/fall/down` and all later cells
  deterministically, and special renames update frame filenames instead of only
  remapping JSON keys. ZIP export now includes game-ready assets plus
  `assets/raw/frames/<id>/` source frames (including `projectile-<move>.png`);
  ZIP import copies assets, restores raw frames/progress, registers the fighter,
  registers a generated home stage, and rescans manifests. Polish now exposes
  Portrait/KO regeneration and write/export preserve existing bust/KO assets for
  old drafts. Earl is canonized as the current dogfood character with corrected
  raw-frame numbering, projectile art, home stage, fatality panels, VO/music, and
  manifest registration. Also carries the current Yulia sprite-editor tuning
  checkpoint. `tsc --noEmit`, `vite build`, and diff whitespace checks passed.
  — Codex

- **2026-07-07 · ui · block-crouch cell, Seed lore, fatality panel prompts/reroll,
  skeleton-follows-transform** — Added the missing **`block-crouch`** base cell
  (FightScene resolves it for crouch-guard; a creator character was shipping
  without it). Seed (D1) gains an **optional lore/backstory** field that overrides
  the drafted backstory in the exported JSON. Fatality is no longer a black box:
  four **editable per-panel prompt beats** (seeded from the default) each with a
  **reroll-this-panel** button (`/creator/fatality` now takes `panelPrompts` +
  `only`); beats persist in the draft. Investigated the "ZIP ignores sprite
  scale/position" report — `composeSheet` DOES bake per-cell scale/offX/offY into
  the packed sheet (verified: 0.5× + offX40 shrinks + shifts the cell), but it was
  NOT applying the same transform to `meta.skeletons`, so the in-game F3 skeleton
  drifted off moved art — now transformed to match (verified joint maps exactly).
  tsc clean; block-crouch wiring, lore→export, 4 panel editors + reroll, and the
  skeleton transform all verified in mock. — Claude

- **2026-07-07 · ui · creator↔sprite-editor skeleton parity + childed, persisted
  hitboxes** — Skeleton overlay is now a 1:1 port of `FightScene.drawSkeleton`:
  the SAME body groups (orange torso / blue arms / green legs), neck, per-finger
  hand fans, ankle→toe/heel foot bones, and joint-dot styling (face_* skipped).
  The points/labels were already identical (both come from `named_keypoints`, the
  full 133-pt wholebody set — `infer_keypoints.py` for the creator, the pack for
  the game), so a creator character's `meta.skeletons` drops into the game as-is.
  Hitboxes are now CHILDED to the sprite: the overlay anchor rides the current
  frame's art offset (`geom.ox/oy`), so the box moves with the fighter through a
  jump arc or anti-air rise, exactly as the in-game hitbox follows `f.y`. Manual
  hitbox drags now flush through the same debounced autosave (`scheduleSave` on
  drag-end) and were already in `serializeState`/`loadDraft`, so tweaks survive a
  refresh. Verified the exported character JSON carries every attribute an existing
  playable fighter has. tsc clean; 314/315 (pre-existing Sprint 19 fail); childing
  (+149px with a 100-cell rise), skeleton hands/feet, and persistence verified in
  mock. — Claude

- **2026-07-07 · ui · creator auto-hitbox now matches the Sprite Editor exactly**
  — Confirmed the scale FACTOR was already identical (`hurtStand.h·1.32/384`), but
  the creator's `autoHitboxesFromSkeleton` was OMITTING the vertical render offset
  (`SPRITE_FOOT_OFFSET_Y + spriteOffsetY`) that the Sprite Editor's
  `FightScene.cellBoxToHitbox` bakes into `y` — so creator auto boxes sat a few px
  off. Now applies it, so the two produce identical boxes. Also fixed the preview
  overlay anchor: it was pinned to the ground line (`floorY`) while
  `hitboxFromSkeleton` measures from the FLOOR_FRAC feet line (0.88), leaving the
  drawn/grabbable box ~60px below the limb — now anchored at the FLOOR_FRAC line so
  the box (auto + manual) tracks the hand it wraps, matching the skeleton overlay.
  tsc clean; identical scale factor, foot offset, and limb-tracking verified live
  in mock. — Claude

- **2026-07-07 · ui · preview skeleton + hitbox overlay toggles (draggable
  hitboxes)** — Added **skeleton** (greyed until DWPose has run) and **hitboxes**
  checkboxes above the animation viewer. The skeleton overlay replays the cell's
  baked DWPose joints (torso/arms/legs/neck) over the current frame's art; the
  hitbox overlay draws the fighter's hurtbox (blue) + the previewed move's hitbox
  (red) with corner handles. The move hitbox is editable at any time — drag the
  body to move it, drag a corner to scale it — writing `m.autoHitboxes[moveId]`
  (engine units) so edits flow straight to the exported JSON. Arriving on the Rig
  step turns both overlays on by default. tsc clean; toggles, RIG defaults,
  skeleton un-greying, and move/corner drag math all verified live in mock. — Claude

- **2026-07-07 · ui · regen chroma-key reinforcement + undo/reject regenerated
  frames** — On every keyable-art regen (sprite/canonical/portrait/ko/projectile,
  never a stage) the prompt is reinforced with the flat green chroma-key clause if
  an edited prompt dropped it, so the frame still keys cleanly. Regen no longer
  overwrites permanently: `fireGen` stashes the frame it replaces (`prevDataUrl`),
  and the inspector shows a **↶ Undo / ↷ Redo** button that flips between the
  regenerated frame and the one before it and writes whichever is shown back to
  disk — a worse regen can be rejected. tsc clean; chroma reinforcement + undo/redo
  round-trip verified live in mock. — Claude

- **2026-07-07 · ui+engine · projectile/stage → frame inspector, projectile
  scale fix, sprite-editor bake-down** — Moved the projectile + stage reprompt/
  regenerate OFF the wizard dialog and onto the frame inspector, where every other
  frame's prompt lives (dialog now just has a thumbnail + generate button). The
  projectile inspector also carries its size/spawn/auto-hitbox tuning, drawn LIVE:
  selecting the projectile cell stands the fighter idle and renders the projectile
  statically at its spawn with the collision box, so tuning is immediately visible.
  Fixed the projectile scale/hitbox math: preview + box + export now share one
  basis — 72·projScale px (the in-game default is 72), so auto-hitbox squares the
  visible alpha correctly (centered on its centroid) and the tuned values actually
  propagate. New render-only `ProjectileDef.renderSize` (scales with `def.scale`);
  the creator writes it from the size slider and FightScene reads it
  (PROJ_SIZE[moveId] → renderSize → 72). Sprite Editor gains **COMMIT — bake
  scale+offset → identity**: flattens the tuned character `scale` into the
  persisted geometry (hurtStand drives render size, so no pixel change) and bakes
  `spriteOffsetY` into the sheet pixels, then zeros both — overwrites sheet.png +
  meta + character.json with an identity transform. tsc clean; 314/315 tests (the
  1 fail is the pre-existing Sprint 19 combo-scaling case); projectile + stage
  inspectors, auto-hitbox, renderSize export all verified live in mock. — Claude

- **2026-07-07 · ui · jump preview + audio BYO chips + frame drop + projectile
  tuning** — Wizard preview: jump normals now play idle→jump→execute over a full
  jump arc. Every audio sample (announcer / kiai / hurt / victory / per-move
  call-out / stage music) gets a play + **download** + **upload(BYO)** chip that
  also accepts a dropped audio file. Sprite frame cells accept a dropped image
  file (BYO frame, normalized to the 288×384 cell) with a tiny hover download
  button. Specials editor gains **projectile tuning** — proj size / spawn x /
  spawn y sliders that drive the flying-projectile preview live and persist on
  export (projectile `spawnX/spawnY/box`), plus an **auto-hitbox** button that
  fits a square box around the projectile's visible alpha. Fixed special-gen
  paths to re-render MOVES so tuning UI appears post-gen. tsc clean; 18 audio
  chips + projectile sliders + auto-hitbox verified live in mock. — Claude

- **2026-07-07 · engine+ui+docs · charge controls + per-move audio + projectile
  persistence** — engine: new `cbf` motion (charge back→forward sonic boom) banked
  via `f.backCharge` like `du`, `bf` sequence untouched; `src/engine/specials.test.ts`
  locks in (a) a projectile persisting after its spawning move recovers — already
  correct, now tested — and (b) `cbf` firing only with the held charge (315 tests,
  1 pre-existing combo-scaling failure unrelated). Wizard: Sonic-boom + Flash-kick
  archetypes in the specials editor (emit `cbf`/`du` + leap/projectile), a per-special
  **call-out audio slot** (spoken VO via TTS/clone or SFX via ElevenLabs
  sound-generation, or BYO upload) that sets `voice:true` and writes
  `voice/<id>-move-<moveId>.mp3`, and anti-air specials now RISE in the preview.
  Docs: move-authoring skill + MOVES.md mark charge b,f/`cbf` + `du` as built and
  note projectile persistence. New endpoint `/creator/move-audio`. tsc clean;
  archetypes + audio row verified live in mock. — Claude

- **2026-07-07 · ui+tools · Character Creator — editor UX + specials pass** —
  merged SPRITES+SPECIALS into one **MOVES** step with a real specials editor:
  archetype dropdown (7-entry buildable catalog + prompt-free helper descriptions),
  controls dropdown, editable description, swap-from-pool (8 candidates), and
  approve-before-gen (gen gated, batch skips unapproved); projectile-first chain
  (description→projectile→active refs it) + per-move projectile art slots written
  on ship/export. Added per-move animation player buttons (grey→lit), real jump/
  crouch/block/fall preview sequences + a `hit` base cell, full-bleed in-level
  stage backdrop with the fighter grounded, inspect panel overlaying the dialog,
  ghost "missing" cell slots, per-cell scale + x/y offset (baked into preview/
  sheet/refs), img2img regen + prompt pre-fill, character-archetype dropdown,
  per-line VO play/regen + announcer (`/creator/audio-clip`), pipeline frame
  naming (`NN-cellname`), resume hardening (image→done, orphaned-frame relink,
  clickable stepper, failed-only batch re-run), periodic autosave, and an activity
  log with timers/error cells. tsc clean; each slice verified live in mock. Scoped
  to Panel/model/vite. — Claude
- **2026-07-07 · assets · earl inputs + earl voice clone** — added earl reference
  face (`earl-head.jpg`) + `voice-inspo/earl/` samples, removed the stale
  `vanessa.wav`, and registered earl's Fish voice-clone id in `tools/voices.json`
  (safe to commit; useless without the key). Test-character asset curation from the
  Character Creator dogfooding. — Vincent

- **2026-07-07 · tools+ui · Sprint 26: Character Creator — full in-browser pipeline** —
  the wizard now runs the whole character pipeline end-to-end from the front-end:
  D3 3-phase attack sprites (ref-chained, pooled), D6 rig via LOCAL DWPose
  (`/__editor/skeleton-regen`; fal is ship-only) → baked `meta.skeletons` +
  auto-hitboxes, real ElevenLabs VO (bulk + per-line play/regen, announcer =
  Maverick) + music + Fish voice-clone, fatality panels, stage gen→register,
  square portraits. UX: drag-drop/batch/removable uploads, preview switcher +
  per-cell scale (propagates into refs + sheet), regen pre-filled with the
  original prompt, full-bleed in-level stage backdrop with the fighter on the
  ground line, resizable/collapsible panels, activity log + timers + error cells.
  Persistence: live-save frames + `state.json` to gitignored `assets/raw/creator/`,
  RESUME bar, and a ⤓ ZIP export (playable bundle + raw progress). New endpoints:
  `/creator/{audio,audio-clip,music,fatality,voice-clone,save,state,list,export}`.
  Scoped to the 3 wizard files (Panel/model/vite) + this board. tsc clean; each
  slice verified live in mock mode. — Claude

- **2026-07-07 · tools+ui+data · Sprint 26: Character Creator — playable SHIP path** —
  engine-valid default kit (`buildFullCharacter`: 18 normals + throw + archetype-
  mapped specials) + SHIP writer (client composites sheet → `/__editor/creator/
  write` writes sheet/meta/JSON/portrait + 17 silent VO placeholders + idempotent
  roster/index registration) + `martian-kombat-mock` launch config. Verified live
  end-to-end in mock mode: seed → profile → base batch → SHIP → reload → playable
  MIRAGE-vs-VINCENT training fight, 503/503 assets, 0 load failures. Mock test char
  cleaned from the repo. tsc clean. — Claude
- **2026-07-07 · tools+ui+data · Sprint 26: Character Creator wizard scaffold** —
  dev-only browser wizard (`CharacterCreatorScene` + `CharacterCreatorPanel` +
  `creatorModel`) running the pipeline from the front-end. D1 Seed (name/desc/
  photo → canonical + portrait, approval gate) and D2 Profile (auto design draft,
  lock-grid reroll, stage/voice upload, auto base-sprite batch with an animating
  live preview) functional; D3–D8 stubbed. Backend `/__editor/creator/gen`
  (nano-banana + mock fallback). Full design spec + worked walkthrough in
  `docs/CHARACTER_CREATOR*.md`. Verified live end-to-end with real nano-banana
  (Mirage: canonical + portrait + 9 base cells). tsc clean. — Claude

- **2026-07-05 · assets · portrait bust re-crop pass** — reran
  `tools/qa/portrait_crop.py --all` across the roster so every `-bust.png`
  is framed pose-centered off the character's head keypoints (fixed
  eye-line, consistent scale) instead of a fixed crop box — keeps the
  roster visually matched now that Vanessa is in the mix. Straight-on
  selector icons untouched. — Claude

- **2026-07-05 · scenes+vite · dev-only Stage Pin editor + world-map
  wiring (Sprint 23)** — first slice of the planned dev-mode front-end
  editor. Vite dev-server middleware plugin (`editorApi()`, `apply:
  'serve'`) POSTs `/__editor/stage-pins` to write `src/data/stage-
  pins.json`, dev-only/no-op in prod — the reusable write backbone the
  character creator will build on. New `EditorMenuScene` (title's
  "6 · DEV EDITOR", dev-only) and `StagePinEditorScene` (click-place/
  drag pins, auto-advance, SAVE). SelectScene now renders all 27
  authored pins as dim dots on the world map, lighting the hovered/held
  fighter's home-stage pin with a player-colored ring + name label +
  side-gutter thumbnail. Also fixed a malformed-JFIF `van.jpg` (old file
  had a broken density header some decoders rejected) and a
  `music.ts` volume-clamp crash found while exercising the map. tsc
  clean, 251 vitest green. — Claude

- **2026-07-05 · assets+data · Sprint 23 stages: 8 new stages + home-stage
  reassignment** — generated TVS, STAR BEACH, LAST RESORT, MUSEUM,
  AI KITCHEN, DOJO, HYPERION, and ESCAPES (21:9 pixel-art from
  `assets/stage-inspo/`, registered in `src/data/stages.ts` with
  matching announcer VO lines). Reassigned bodhi/cat/catherine/freeman/
  kirby/marzipan/rapha/vincent/ygor/yulia to their canonical Martian
  Lore home stage. Also replaced `van.jpg` with a clean redraw. — Claude

- **2026-07-05 · data+assets · Vanessa, 14th fighter (full pipeline)** —
  full 7-step build: `vanessa.json` (24 moves), fatality "Fired and Glazed"
  (4 panels), Fish-cloned VO (kiai/hurt/victory + a per-move call-out) plus
  ElevenLabs announcer line, sprite sheet + 3 named-special projectiles
  (chocolate-head / little-helper / little-martian), home stage `saturn`
  (art already existed). Wired into `roster.ts` (`playable:true`) and
  `characters/index.ts`. — Claude

- **2026-07-05 · tools · third-party handlers: CorridorKey keyer + Fish voice
  cloning** — user-directed. (1) **`npm run gen:key` (`tools/corridorkey.mjs`
  + `corridorkey-helper.py`)**: one-command CorridorKey neural green-screen
  handler — self-bootstraps the sibling clone (git clone → `uv sync`, MLX
  extra on Apple Silicon), fetches the MLX weights via the working
  dead-repo workaround (env-var repo override, tag `v1.0.0`, sha256-checked),
  auto-resolves the green-checkpoint collision by stashing the unused
  backend's file in `checkpoints/.stash/`, then batches a character's raw
  frames (coarse chroma alpha hints → tiled MLX inference `--skip-existing` →
  EXR FG+Matte composed to straight-alpha PNGs in `assets/raw/keyed/<char>/`).
  Green-keyed projectiles included; custom-key (non-green) projectiles stay on
  ffmpeg. `pack-sheet.mjs` gains `--keyer corridor` (packs from keyed frames,
  scale/pad only; hard-fails on missing frames so a release bake can't
  silently mix in halo'd chromakey cells). Smoke-tested end-to-end on MLX
  (gene 20-lk-startup: glitch-FX keyed to real translucent color, no green
  halo; ~12s/frame). Full-roster re-key still parked for the release pass —
  docs/CORRIDORKEY.md updated. (2) **`npm run gen:voice`
  (`tools/gen-voice.mjs`)**: Fish Audio voice cloning (`FISH_API_KEY`) — drop
  real voice samples in `assets/voice-inspo/<char>/` (new README; privacy
  opt-out rule applies), clone registers a private model id in
  `tools/voices.json`; `gen-audio.mjs` now routes a registered fighter's
  kiai/hurt/victory/move VO through the clone via `fishTTS()` in `lib.mjs`
  (announcer + stage call-outs stay ElevenLabs). `--say "text"` writes test
  synths to `assets/raw/voice-tests/`. Untested against the live clone path
  (no samples on disk yet) — first real use: drop clips + `gen:voice --char
  <name>` + `gen:audio --char <name> --force`.
- **2026-07-05 · tools+scenes · clean boot: asset-existence manifest** — kills
  the boot-console errors (11 legacy `proj-<char>` images that only vincent/
  catherine actually have, 8 stage-name VOs that were never authored, a
  `vfx-bodhi-deep-tissue` that doesn't exist) — the audio ones were UNCAUGHT
  `EncodingError`s (a 404'd mp3 throws, not harmless). New
  `tools/gen-asset-manifest.mjs` scans `public/assets/` and writes
  `src/data/assetManifest.json` (stage VOs, legacy projectiles, per-move
  projectile/burst/vfx art that actually exist); BootScene imports it and
  gates every drift-prone load so the loader only requests real files. Wired
  into predev/prebuild next to gen-music (+ `npm run gen:assets`). Permanently
  ends the "blind-load → 404" class the memory note kept flagging. Verified on
  the prod build: boot completes with `failed: 0` (was 12), console clean
  (only the Phaser banner). — Claude

- **2026-07-05 · scenes+ai+data+assets · showcase demo + Flo/Gene polish**
  — user-directed (UNCOMMITTED; part of the same feel-pass push). (1)
  **CPU-vs-CPU showcase demo**: new main-menu "5 · DEMO MATCH" → pick both
  fighters + stage → a single-round CPU-vs-CPU match where both bots walk
  their FULL moveset (new `CpuDriver` showcase reel: every normal, a couple
  crouch normals, a jump, then each special) and the winner ALWAYS lands the
  fatality. Flows Menu→Select(showcase)→Versus→Fight with a `showcase` flag
  (winsNeeded 1, both bots). Verified by headless sim across 7 matchups:
  every one reaches `fatality` (not the mercy collapse) with 21-27 distinct
  moves shown. **BUG FIXED en route**: `enqueueMotion` never handled `hcb`,
  so the 7 hcb-fatality fighters (bodhi/cat/chebel/freeman/kirby/rapha/ygor)
  could NEVER land their fatality in ANY demo — now all motions
  (qcf/qcb/bf/hcb/hcf) are supported and the finisher retries until it lands.
  (2) **Flo Flame War** flame graphic offset to mouth height (render-only
  `PROJ_RENDER_OFFSET_Y`, -125) so it reads as fire-breathing; Flo + Gene
  sheets repacked from the user's edited raw frames. (3) **Gene VO** (new
  ElevenLabs lines): kiai "Force push!" / "Straight to prod!", hurt "Ah,
  fuck." / "Eden's down!", and a per-move call-out "Line goes up!" that
  fires on the move (new data-driven `MoveDef.voice` + `v-<char>-move-<id>`
  files + `attack-start.voiceLine` event → soundDirector). (4) **Gene win
  quotes**: bullish / context / out-of-tokens added; stale "rate-limited"
  quote dropped. tsc + build clean, 237/237, verified live (menu item,
  flame at mouth height, VO loaded, showcase runs). — Claude

- **2026-07-05 · engine+data+assets+renderer3d · feel & mechanics pass (SF2/MK
  UX)** — user-directed batch (UNCOMMITTED as of this entry; see handoff). (1)
  **Throws** toss SF2-style: the victim launches on a long high arc
  (`TOSS_VY`/`TOSS_KNOCKBACK_MULT`), slams, rebounds bigger (`TOSS_BOUNCE_VY`)
  — displaced across the screen, not a short knockdown (new `toss` HitPayload +
  `Action.tossed`). (2) **Finisher** = MK behavior: fumble the fatality and
  just LAND a normal on the dazed loser → they collapse, round ends (was:
  attacks whiffed in FINISH THEM). (3) **Jumps** higher (`JUMP_VEL_MULT` 1.12)
  and forward jumps cover ground (`jumpSpeedX`, default walk×`JUMP_SPEED_MULT`
  1.6, per-char overridable — no more walk-speed floaty hops). (4)
  **Projectiles** rescaled: sigil-bolt 72→112, fork-bomb 64→104, pop-tab-chain
  →104. (5) **Flo/Gene static field-mines swapped**: Smokescreen → **Flame
  War** (short-range Yoga-Flame breath); Rate Limit → **Line Goes Up**
  (short-range rising green-candlestick burst) — real short-range projectiles
  now, keeping the `qcb+P` slot so Burn One / 404 fatalities still fire; new
  projectile art generated (Gene's green candles on MAGENTA + `key` 0xFF00FF)
  + packed. (6) **3D camera** dollies back AND rises on vertical height (high
  jumps) on top of the horizontal-separation dolly. 3 new engine vitests + 2
  field-mine tests rewritten; 236/236, tsc + build clean, verified live.
  DEFERRED (own tasks): 2D dynamic camera (needs a world/HUD camera-split),
  wall/double-jumps (Cat/Kirby), close-range balance pass. — Claude

- **2026-07-05 · data+assets+renderer3d · Rapha, 13th fighter (full pipeline +
  3D mesh)** — RJ's raccoon-wrangler joins the roster (`playable:true`,
  `mesh3d:true`). Full 7-step build: `rapha.json` (23 moves; four named
  specials — Claw Machine, Tubs Fetch!, Pop-Tab Chain, Wind-Up — + throw; 5
  win quotes; Scrap Compactor fatality), 62-cell painted sheet + four
  projectile arts, portrait/KO/bust, 4 fatality panels, and a baked
  `rapha.glb` (4th 3D-capable fighter after vincent/yulia/flo). Backfills
  laubsauger's `a207272 added rapha` + the crouch-frame re-roll below.
  — laubsauger + Claude (parallel sessions)

- **2026-07-05 · renderer3d+engine+net+audio · 3D→production + online polish
  (changelog backfill)** — logging laubsauger's committed-today work that
  shipped without a SPRINTBOARD entry: **sub-tick render interpolation**
  (`2dee05f`) so 3D clip playback interpolates between engine ticks for
  smooth animation at any refresh; **renderer warmup during VS + a loading
  screen** (`9883404`) holding the sim behind LOADING… until models/stage/
  pipelines are up (no more fight-over-black-screen); **distinct per-character
  idle animations** in 3D (`e345958`); a **3D test scene / test-room**
  (`a082b42`); **taunt promoted to a real engine input** (`be06120`,
  deterministic + net-synced) and **taunt targeting the local player's
  fighter online** (`80ce97b`, was always slot 0); **net timesync** so both
  peers hold the same tick (`7fe2092`, V26/T45); **announcer VOs only on the
  final pick, louder + music-ducked** (`df6c5ce`); and a **GLB conversion
  fix** (`ba5e4eb`). — laubsauger (backfilled by Claude)

- **2026-07-05 · assets · Rapha crouch frames re-roll** — cells 29
  (clp-active), 36 (clk-recovery), 37 (cmk-active), 39 (chk-active), 40
  (chk-recovery) had rendered standing instead of the low crouch the pose
  text called for; re-rolled all five with `gen:frames --cells` using the
  low-pose anchor (fixed chk-active anchors the rest). First chk-recovery
  re-roll came back with a missing-arms artifact — re-rolled once more,
  clean. Also found `04-crouch.png` missing from `assets/raw/frames/rapha/`
  entirely (deleted pre-session, unrelated to this ask) which was silently
  dropping the "crouch" idle cell from the packed sheet/meta.json —
  regenerated it (took two tries, same standing-not-crouching failure mode)
  and repacked; `gen:pack` now reports the full 62/62 frames. — Claude

- **2026-07-05 · renderer3d+scenes · live 3D idle previews on character
  select** — new `SelectPreview3D` (transparent WebGPU canvas over the select
  screen, ThreeFighterView idle clips, close-plane framing onto the 2D side
  slots); SelectScene boots it via dynamic import in 3D mode, keeps the
  portrait bust as the streaming/no-mesh fallback, hides it behind the stage
  dialog, and drives it from update(). Views cached per slot — cursor flicks
  are instant, mirror picks get two instances. FIX: threeAssets GLB fetch now
  rejects only `text/html` (the vite SPA-fallback guard) instead of requiring
  `gltf-binary` — static hosts serving .glb as octet-stream were silently
  getting capsules everywhere. Verified live: meshes idle on both sides,
  swap on cursor move, portrait fallback for 3D SOON fighters, 0 errors.
  — Claude (Sprint 22 session)

- **2026-07-05 · scenes+ui · Sprint 22 Phase 4 (SPRINT COMPLETE): parity
  stragglers** — 3D-mode character select shows portrait busts on the sides
  (was: 2D sheet idles that didn't match the renderer and would break for
  mesh-only fighters); hint bar (2D) + HUD legend (3D) aligned on the
  canonical keymap; FightScene3D header updated (no longer "dev-only").
  Sprint 22 outcome: 3D at 2D feature parity (pause menu, F2 move log,
  match-end nav, pad menus, select previews) with the presentation stack
  shared end-to-end — pure logic in src/presentation, DOM chrome in src/ui,
  scene glue in fightShell. tsc clean, 233/233, verified live, 0 console
  errors. — Claude (Sprint 22 session)

- **2026-07-05 · scenes · Sprint 22 Phase 3: the shared FightShell** — new
  `src/scenes/fightShell.ts` composed by BOTH fight scenes: pause state +
  PauseMenu, the canonical keymap (ESC pause · F1 hitboxes · F2 move log ·
  R/ENTER/F9/click matchEnd nav), pad menu navigation, demo exits + hint,
  online rematch handshake/prompt, endNav guard. All the 3D→2D parity gaps
  this sprint was opened for are CLOSED: ESC in 3D opens the pause menu
  instead of dumping to the main menu, F2 is the move log in both renderers
  (3D skeleton→F3, inspector→F5), local R/ENTER work at 3D matchEnd,
  gamepads can drive the 3D pause/win screens, and 2D gains F9 quick
  restart. 3D pause halts the sim but keeps rendering the frame; nav out of
  3D preserves render3d into character select. FightScene/FightScene3D lost
  ~240 lines of duplicated nav code between them. Verified live in both
  renderers (pause freeze + resume, F2 log, ENTER→Select). tsc clean,
  233/233, zero console errors. — Claude (Sprint 22 session)

- **2026-07-05 · ui+scenes · Sprint 22 Phase 2: shared DOM UI chrome** —
  `renderer3d/hud/*` → `src/ui/`; new `UiLayer` (one canvas-tracking DOM
  layer per fight scene; components mount `inset:0` inside it — the
  anchor-style-copying hack is gone). New shared components: PauseMenu
  (action buttons + both fighters' native-scroll move lists via
  presentation/notation, pad/mouse nav), MoveLogOverlay (F2 input ticker +
  move FIFO, change-cached writes), RematchPrompt, DemoHint, LoadingOverlay.
  WinOverlay leveled up to the 2D feature set (winner-colored title,
  FATALITY tag, KO-portrait fallback chain, win quote, configurable prompt,
  onFirstShow hook) — 3D now gets the victory voice line + the 72-frame
  reveal beat it was missing. 2D FightScene swapped its Phaser pause
  container, win-screen container, and log texts for the shared DOM chrome
  (buildPauseOverlay/showWinScreen deleted); FightScene3D swapped its inline
  loading/rematch/demo-hint DOM for the components. Verified live on the
  static prod build (manual loop-step pump): ESC opens the DOM pause menu
  mid-fight, F2 shows live input tickers + move log, DOM win screen with
  fatality tag + Russian win quote, 3D fight renders HUD/banner/legend on
  the shared layer. tsc clean, 233/233 vitest, zero console errors.
  — Claude (Sprint 22 session)

- **2026-07-04 · presentation+scenes · Sprint 22 Phase 1: shared presentation
  layer (2D+3D)** — FightScene (2D) migrated onto the shared
  `snapTick`/`diffTick` (its private ~180-line presentTick detector deleted —
  the acknowledged post-Sprint-19 debt; the two copies had drifted on FIGHT!
  timing). New pure vitested modules in `src/presentation/`: `soundDirector`
  (the ONE event→audio table for both renderers; scenes execute cues via
  `runCues` in BootScene, victory-music behavior injectable — 2D keeps its
  onEnd→char-select), `hudModel` (ghost bar + combo, shared; drain unified on
  2D's rate), `banner` (pure bannerFor; 3D consumes it now, 2D in Phase 2),
  `notation` + `moveLog` (F2 log model + pause-menu move-list text).
  FightScene3D: handleEvents reduced to renderer fx only, snd()/voice()
  focus-gate wrappers deleted (play() gates centrally), ghost/combo fields
  replaced by HudModel, stage bounds now `STAGE3D_BOUNDS` in threeCoordinates
  (shared with LobbyScene). tsc clean, 233/233 vitest (27 new). Verified live
  (static prod build, headless — NOTE: preview tab is hidden so Phaser's RAF
  never fires; drive `window.__game.loop.step()` manually): full 2D CPU match
  end-to-end incl. fatality + win screen + victory-music navigation, full 3D
  CPU match incl. FATALITY banner slam + WinOverlay, zero console errors.
  — Claude (Sprint 22 session)

- **2026-07-05 · audio · stage-name announcer VO (Clyde)** — all 19 stages now
  have a spoken name call-out (`public/assets/audio/announcer/stage-<id>.mp3`),
  generated in the "Clyde — Vintage Male Radio Announcer" voice
  (`QMJTqaMXmGnG8TCm8WQG`). gen-audio uses Clyde ONLY for `stage-*` lines;
  Maverick stays for rounds/KO/fighter names (per-line voice switch). BootScene
  preloads them; `SelectScene.playStageVo` (already wired) calls them out on
  vote + on the resolved stage at launch. NOTE: needs the paid ElevenLabs key
  (professional library voice) + `--concurrency ≤3` (Starter plan's parallel
  cap). Verified: all 19 in the audio cache, no decode error. — Claude

- **2026-07-05 · net+scenes · online rematch on the same channel** — at the end
  of an online match each player sees a REMATCH prompt; press R/ENTER (or
  click/pad-confirm) to opt in, ESC to quit. When BOTH opt in it goes straight
  back to the shared character select — no room-code re-entry, no re-sync. Core
  logic is a Phaser-free `src/net/rematch.ts` `RematchLink` shared by FightScene
  (2D) and FightScene3D: it takes the finished match's transport, exchanges a
  `rematch` opt-in, and on agreement spins a fresh `LobbyController` on the SAME
  connection with `skipVerify` (peers already handshaked this session) →
  onReady → Select. Gotcha fixed: skipVerify makes onReady fire SYNCHRONOUSLY
  during controller construction, so the launch is deferred a tick (scene
  clock) — else it reads the not-yet-assigned controller ref (TDZ). bye/close
  → forfeit to menu. Verified live (two Chrome, prod build): match1 → both opt
  in → back in shared select (no code) → match2 runs in sync (chars identical,
  heads within 1 tick, 0 desync). — Claude

- **2026-07-05 · net+select · online pick-waiting + both-vote stage** — (1) after
  a player locks their fighter online they now see "waiting for <name> to choose
  their fighter…" instead of silently sitting/advancing; onBothLocked clears it
  and BOTH open the stage picker. (2) stage is chosen by BOTH players (was
  host-only): each casts a `stagePick` vote; the host reconciles (agree → that
  stage, disagree → coin flip between the two votes) and sends the authoritative
  `start`, so both launch on the identical stage (V25). `confirmStart` is now
  host-internal. 4 lobby vitests cover same-vote, disagreement (result ∈ the two
  votes over 12 trials), lone-guest-no-start. Verified live (two Chrome, prod
  build): waiting note shown, both peers reach the stage dialog, opposing votes
  resolve to one shared stage, sync intact. Local select untouched. — Claude

- **2026-07-05 · net+scenes · online reuses the real SelectScene (no duplicate
  picker)** — the custom mini-picker in LobbyScene is gone; online now hands off
  to the SAME `SelectScene` local 2-player uses (grid + side idle sprites +
  stage dialog). Split the net handshake: `hello` (proto+charHash+name) verifies
  on connect → `onReady` hands off to Select; `pick {charId}` is sent when a
  player locks their fighter on the shared grid; the HOST picks the stage and
  `confirmStart` commits the host-authoritative config. One `LobbyController`
  spans Lobby→Select (passed by reference, `setHooks` merges the pick/stage/
  start hooks). SelectScene online mode: local controls only its slot, the
  remote fighter fills from the wire, only the host drives the stage dialog
  (guest shows "waiting…"), then it launches Fight/Fight3D itself with the
  online payload — Versus is skipped online. Local/CPU/training select paths
  untouched (verified: both picks → stage → Versus, `online:false`). Verified
  live over two Chrome processes on the production build: both peers land in
  the shared selector, pick their own fighters (both slots reflect both picks),
  host picks stage, both launch in lockstep — chars identical, heads within
  1 tick, 0 desync. lobby.test rewritten for verify→ready→picks→start (7
  tests). — Claude

- **2026-07-04 · net · 3D-aware multiplayer + paste-anywhere (public 3D/MP)** —
  online now respects the renderer: the host announces its 2D/3D mode the
  instant the channel opens (new `mode` wire msg), the guest AUTO-ADOPTS it
  before picking (so 2D/3D can never cross-join and the guest's roster +
  launched scene always match the host). Lobby filters the char pool to
  mesh-capable fighters (vincent/yulia/flo) in 3D and launches `Fight3D` vs
  `Fight` per the agreed `render3d` in the start config. `FightScene3D` gained
  the same `online`→NetSession injection as `FightScene` (identical hooks,
  V18), with the 3D stage bounds baked into the host's rules so V25 holds in
  either renderer. Pasting a room code anywhere on the page jumps to join +
  fills it. Confirmed 3D + online are NOT dev-gated — reachable in the
  production build via the menu render toggle + ONLINE entry; verified in
  `npm run preview`: 3D fight renders (WebGPU), lobby 3D pools the 3 mesh
  chars, paste fills. Test-room + debug hotkeys kept as-is (per user). — Claude

- **2026-07-04 · net+scenes · online lobby + session injection, live-verified
  (SPEC T39 done, T40 core)** — `LobbyScene` (registered in main.ts, menu
  "3 · ONLINE" + `?dev=net`): host → room code + copy + "waiting", join → code
  entry, per-side character pick, drives the `LobbyController` handshake →
  launches `Fight` with an `OnlineFightData` payload. FightScene now takes that
  payload and builds a `NetSession` (rollback) instead of `FightSession` using
  the SAME tick hooks — proof of V18 (net vs local = session swap, scene code
  identical). Online disables pause (sim never freezes, V23). peerjs
  dynamic-imported → code-split into its own 91KB chunk, out of the 2D bundle.
  Handshake logic (`src/net/lobby.ts` `LobbyController` + `charDataHash`,
  V21) is unit-tested over loopback (6 vitests). **Live-verified** with a
  two-Chrome-process CDP harness (scratchpad `net-2proc.mjs`): two peers meet
  over the real peerjs broker + WebRTC DataChannel, both reach Fight, and their
  engine heads stay byte-identical in lockstep (tick 180/300/420/540 equal,
  0 desync, 0 halt) — V25 over the real network path. NOTE headless fully
  PAUSES non-visible tabs' rAF, so two-player smokes need two separate Chrome
  processes, not two tabs. REMAINING (T40): disconnect grace/rejoin + rematch.
  — Claude
- **2026-07-04 · net · WebRTC transport over PeerJS (SPEC T38, + rejoin spec
  V27/T46)** — `src/net/webrtc.ts`: `WebRtcTransport` wraps a peerjs
  DataConnection behind the same `Transport` iface as the loopback, so
  NetSession is transport-agnostic. `hostRoom()` claims a namespaced room id
  (5-char unambiguous code, no I/L/O/0/1) + waits for a guest; `joinRoom()`
  connects to it; both surface a `transport` promise + `onReconnect` hook.
  The room-owning Peer outlives any single DataConnection so a dropped peer
  can rebind into the same room — groundwork for T46 rejoin. Reliable+ordered
  channel (lockstep needs both). Not vitest-able (real broker); gated on
  typecheck+build; code-gen unit-tested. peerjs dep added. SPEC gains V27
  (grace window + host-authoritative resync, not instant forfeit) + T46. —
  Claude GGPO-style
  netplay behind the same Session surface as FightSession: predicted remote
  inputs (repeat-last), structuredClone snapshot ring, mispredict → restore
  at divergence + silent re-sim to head (presentation hooks fire once per
  tick, V24), input delay D=2, stall only past window W=10, confirmed-tick
  hash exchange (V20), stats() for the net HUD, onIssue for desync/
  disconnect. 7 vitests over loopback incl. the V25 keystone: confirmed
  timeline hash-equal to an offline step() replay of the same input log,
  under latency+jitter+15% loss. — Claude
- **2026-07-04 · net · transport seam + loopback test double (SPEC T36)** —
  `src/net/transport.ts`: `Transport` interface (send/onMessage/onStatus/
  close), typed `NetMsg` wire union (hello/start/input/hash/bye, PROTO=1),
  and `createLoopbackPair` — in-memory pair on a virtual tick clock with
  seeded-LCG latency/jitter/loss simulation (deterministic, no wall clock).
  5 vitests incl. seed reproducibility and post-send mutation isolation.
  NetSession (T37) tests will run entirely on this. — Claude
- **2026-07-04 · engine · net wire helpers (SPEC T35)** — `unpackInput`
  (inverse of packInput, 1024-combo round-trip vitest) and `hashState`
  (FNV-1a over float64 bit patterns of the numeric core: tick/phase/timer/
  wins + per-fighter x/y/vx/vy/facing/health/stun/hitstop/action +
  projectiles/pendingThrow) for netplay desync detection (V20/V22). Math-op
  audit: engine uses only abs/floor/max/min — exact IEEE ops, no trig/pow,
  cross-browser deterministic. — Claude
- **2026-07-04 · session · extract FightSession (SPEC T34, netplay groundwork)** —
  the duplicated fixed-timestep loops in FightScene + FightScene3D moved into
  `src/session/FightSession.ts`: one driver owns accumulator, 100ms delta
  clamp, KO slow-mo pacing, and the `step()` call; scenes hang presentation
  off `beforeTick`/`inputs`/`afterTick` hooks (2D keeps its perf split +
  snapshot diff, 3D keeps snapTick/diffTick order). Zero Phaser imports,
  5 vitests (tick-for-tick parity vs plain step loop, clamp, koSlow pacing,
  resetPacing, hook order). Behavior unchanged; NetSession (rollback, SPEC
  T37) swaps in behind the same `Session` surface. — Claude

- **2026-07-04 · renderer3d+tools · animation stabilization sweep** — root
  motion actually dead now: (1) vertical-axis detection went through
  matrix_world (FBX leaves the armature rotated -90°, so armature-space "up"
  kept a HORIZONTAL hips channel — the sideways drift in bows, reactions,
  victory wobble); (2) object-level location AND rotation fcurves stripped
  (some Mixamo clips animate the armature object itself — Z-slides, sideways
  punches). T-pose flash fixed (same-clip restart crossfaded an action
  against itself → bind-pose bleed; hard cut now). Dizzy stars: texture
  late-binds (white-square bug). matchEnd poses: winner plays win clip,
  loser lies in ko (engine leaves mercy-path losers 'dazed' → stun loop
  looked like looping death). GLB byte-cache kills the capsule blink on
  rematch (re-parse per consumer — SkeletonUtils.clone builds WebGL-class
  skeletons the WebGPU renderer silently skips: invisible fighters). HUD:
  dash pips inline with round stars, flush to the bar's outer end. — Claude

- **2026-07-04 · engine+renderer3d · dash stocks, taunts, variants, entry
  bow, directional/heavy/body hit reactions** — dash double-tap impulse now
  gated by a 2-stock pool (150-tick regen, engine + 4 vitests, HUD pips w/
  recharge fade); T = renderer-side taunt gesture; clip variant shuffle
  (`name#N`, tick-hash latch) cycles jab/hook/elbow/reaction/taunt
  alternates; round-1 intro bow; reactions pick side (front/back), weight
  (small/large), and height (body: stomach/liver) from the actual hit;
  uppercut landed as rising-glyph; HUD extracted to
  `src/renderer3d/hud/{FightHud,WinOverlay,FatalityOverlay}`; converter
  strips fcurves for bones the Tripo rig lacks (no pinkies — zero Blender
  warnings). GLB: 54 clips / 38 slots / 0 missing. 140 tests. Perf pass:
  71→112fps (half-res AO G-pass, material-recompile fix, billboard pool,
  cached HUD writes). Branch pushed to origin. — Claude

- **2026-07-04 · renderer3d · 3D spike T25–T27 + depth/beam/blood pass** —
  depth layers (gradient sky + moon, 4th skyline row, neon signs + halos,
  power cables, foreground bollards/walls), lamps rebuilt w/ TSL
  inverse-fresnel fake-volumetric beams (`beamMaterial` in ThreeStageView,
  technique from webgpu-threejs-tsl skill) + head glow + asphalt pool decals,
  2 shadow-casting lamps over the lane. Blood: fixed flat-lying mid-flight
  drops (shared instancing dummy kept splat X-rotation — full rotation.set
  now), circular drops, damage-tiered counts (3+dmg·0.45/0.75 cap 42, KO 70),
  smaller rarer splats. impactNorm piecewise warp (`attackClipTime`) lands
  authored hit frames on engine active-window open (vitest'd). Fatality
  cutscene = DOM panel slideshow from 2D jpgs; matchEnd win screen (winner
  portrait, loser -ko bust, winQuotes). Dizzy stars billboard. fps audit:
  82–108fps w/ AO+bloom+2 point-shadow lamps (headless WebGPU/Metal).
  Verification workflow: `scratchpad cdp-shot.mjs` (node 24 native WebSocket
  CDP driver — headless Chrome `--screenshot` can't wait for async GLB loads;
  real-time wait + JS eval + capture). — Claude
- **2026-07-04 · renderer3d+presentation · 3D spike T17–T24: full presentation
  parity + gore** — pure `src/presentation/tickEvents.ts` (`snapTick`/`diffTick`
  → typed events, 6 vitests; 2D migrates onto it post-Sprint-19). Fight3D now
  has: full audio parity via existing helpers (announcer cues, hit/block/
  whoosh/jump/projectile SFX, hurt/kiai voices, stage/victory music), DOM HUD
  with portrait pngs + ghost health bars + win pips + combo counter, spark/
  per-move-overlay billboards from the 2D vfx pngs, victim emissive flash
  (red+longer on counter), camera shake, MK blood (instanced ellipse drops,
  cone along impact velocity, dmg-scaled count/size w/ fat blobs, floor
  splats thinned + 4s fade, KO gush), projectiles as additive billboards
  (fixes black-fringe squares) + radial glow + PointLight that lights street
  and fighters. Perspective follow-cam default (V10 amended): midpoint lerp +
  separation dolly = real parallax vs depth-staggered building rows; night
  street placeholder stage (asphalt, sidewalk, lit windows, 2 overhead street
  lamps w/ shadow-casting warm pools + fake-volumetric cones, dense fog, dim
  moon key). Bloom default on. SkeletonHelper moved to scene root (was
  double-transformed). vincent-vs-vincent dev launch. — Claude
- **2026-07-04 · renderer3d · 3D spike T10–T12: stage box, light rig, post,
  settings** — placeholder test stage (grid floor + gridded back wall + side
  walls + horizon + fog) replaces the black void; three-point rig (warm key
  w/ shadows, cool fill, rim) + ACES/exposure so black outfits read; TSL post
  stack GTAO→bloom via `RenderPipeline` (AO on, bloom off by default, both
  toggleable); `threeRenderSettings.ts` DOM panel (F4: fps, res scale,
  shadow size, AO/bloom, exposure, per-light intensity, camera presets
  default/low/high, hitbox+skeleton) + official r185 Inspector on F3.
  Model facing fixed (GLB authored +X: 0°/180°, not ±90°), dev launch now
  vincent-vs-vincent to exercise mesh path on both sides. Verified via CDP:
  both fighters face each other, P2 played `attack/redirect` cast clip
  unflagged. — Claude
- **2026-07-04 · renderer3d+tools · 3D spike T7–T9 + T14–T16: vincent GLB
  animated in-game** — `tools/gen-mesh.mjs` (`npm run gen:mesh -- --char
  vincent`) drives headless Blender (`tools/blender_fbx_to_glb.py`): rig FBX +
  ~130 Mixamo clip FBXs (zips auto-extracted to `assets/raw/mesh-clips/`) →
  `public/assets/3d/characters/vincent/vincent.glb` (26 clips renamed to
  contract names, horizontal root motion stripped, vertical kept for pose,
  self-calibrating vertical-axis detection) + coverage report (24 mapped ·
  16 fallback · 0 missing). Runtime: `clipContract.ts`+json (action→clip map,
  V12 fallback chains, V13 class-based tick-sampled playback + crossfades,
  hitstop freezes clips) with 11 vitests; `ThreeFighterView` swaps capsule →
  skinned GLB (foot-origin, hurtStand-scaled, facing = rotation not mirror);
  per-frame lowest-bone ground snap + stage `Floor`-group auto-alignment
  (V14) so feet neither float nor poke through. HUD shows active clip +
  PLACEHOLDER flag. Verified via CDP headless Chrome (idle + knockdown).
  — Claude
- **2026-07-04 · renderer3d+scenes · 3D spike T3–T6: playable WebGPU scene** —
  `FightScene3D` behind `?dev=3d` (same `step()`/`KeyboardSource`/`CpuDriver`
  loop as FightScene, Three canvas + DOM HUD pinned over the Phaser canvas,
  F1 hitboxes / F9 rematch / ESC menu, `&boxes=1` for headless verification);
  `ThreeFightRenderer` (WebGPU, ortho camera, camera x-tracking, work lights,
  shadow floor), capsule `ThreeFighterView` placeholders sized off
  `hurtStand`, `ThreeHitboxDebug` cuboid pool straight from `worldBox`
  (hurt/body/startup/active/recovery/projectile/throw palette). three loads
  as a lazy chunk — production 2D bundle unchanged. Verified in headless
  Chrome WebGPU (`--enable-unsafe-webgpu --use-angle=metal`). — Claude
- **2026-07-04 · renderer3d · 3D spike T1+T2 (branch `spike/3d-renderer`)** —
  three@0.185.1 installed, real import paths verified (`three/webgpu`,
  `three/addons/inspector/Inspector.js`, TSL `GTAONode`/`BloomNode`,
  `GLTFLoader`); `src/renderer3d/threeCoordinates.ts` engine→Three mapping
  (WORLD_SCALE 0.01, floor→Y0, stage-centered X, ±0.18m lane cuboids) +
  6 vitests. Spec/tasks in `SPEC.md` (SDD flow), spike doc in
  `docs/THREE_D_RENDERER_SPIKE.md`. Vincent mesh + ~130 Mixamo clips staged
  under `public/assets/meshes/vincent/`. — Claude
- **2026-07-04 · data+assets · win-quote polish + Freeman crouch raw** — tightened
  SFII-style victory taunts for **Chebel, Flo, Gene, Kirby, Marzipan** (punchier
  rewrites; Flo's German de-unicoded to `scheisse`; Gene dropped one weak line),
  and committed the updated `freeman/04-crouch` raw frame (already baked into the
  packed sheet). Also lands two prior same-day commits that shipped without a
  changelog line: **`43631ef` — repack Freeman sprite sheet** (re-keyed/re-tiled
  from the existing 62 raw frames, no new art) and **`0702ad0` — Marzipan male
  voice** (parallel session). *(Claude)*
- **2026-07-04 · data+tools+assets+docs+scenes · Wave 2 chars Chebel + Ygor
  shipped (+ bundled parallel select-screen redesign)** — added **Chebel**
  ("The Spirit Deck", rushdown+summon, stage `mimos`) and **Ygor** ("Suave",
  projection zoner, stage `drive-in`): character JSONs, registry + roster
  (both `playable:true`), frames-manifest / gen-audio / gen-fatality entries,
  and full generated assets (62-cell sheets + projectile art, 16 VO lines each
  + announcer, portraits/KO/bust, 4 fatality panels each). Personality
  specials mapped onto proven plumbing (Ceremony→invuln DP, Microdose→teleport,
  oRACLE→slow-field). Added a reusable per-character generic-cell override seam
  (`spec.cells[id]`) and used it to fix Chebel's flickery idle-a/idle-b + a
  stray idle jaguar and to pin her `fall` backward. tsc clean, 134/134 tests,
  sprite QA passed. **This commit also lands a parallel session's uncommitted
  work** (per user request to commit the whole tree): select-screen redesign
  (`SelectScene.ts` +196, `BootScene.ts` world-map + side-profile `-bust.png`
  loads), `public/assets/ui/world-map.png`, and a bulk portrait+bust regen for
  all roster chars plus not-yet-wired Wave 2 portraits (earl/haidai/rapha/
  vanessa — busts present, orphaned until those fighters are built). All 12
  roster busts present, so the redesign is asset-complete for the live roster.
  *(Claude — Chebel/Ygor; parallel session — select redesign)*
- **2026-07-04 · data+tools+assets+docs · Sprint 21 shipped: Cat "Wet Paint"
  (+ Sprint 20 art landed)** — first roster expansion past the launch eight,
  pure data + generated art (zero engine changes). `cat.json`: light/fast
  painter-dancer trickster (health 980, walk 5.4), six-button dance kit with
  lights→lights/mediums chains, universal throw, and four specials all on
  existing plumbing — **Flour Bomb** (qcf+P, low `field`/`slowFactor` pigment
  puddle, feet-anchored render), **Thread of Life** (qcb+P, knockdown lash =
  Vine Spear minus `pull`), **Pirouette** (dp+K, `leap`+`invuln` reversal),
  **D. Catarina** (hcf+P old-lady cane whack; her lore ↓↓ has no engine motion
  so remapped to hcf and DECLARED BEFORE the qcf Flour Bomb so the shared tail
  doesn't steal it). NEW **Still Life** fatality (hcb+P — designed here, bible
  had none): paints the husk into an unflattering framed portrait. Full 7-step
  gen run (62-cell 8×8 sheet + 2 keyed projectiles, 16 grunts + `CAT!`
  announcer, 4 fatality panels; canonical/KO bust pre-existing) — 0 failures.
  `frames-manifest.mjs` cat pose dict; `index.ts`/`roster.ts` (playable);
  FightScene `PROJ_SIZE`/`PROJ_FEET_ANCHORED`; `gen-audio.mjs` gained a
  `--char` scope flag (so single-character runs don't touch parallel builds).
  4 new vitests (hcf/qcf order, both projectile specials, determinism) —
  **134/134 green, tsc + prod build clean**; art verified cell-by-cell via
  canvas render (live fight blocked only by the parallel Bodhi build's
  incomplete assets, not Cat). This commit also lands Sprint 20's staged art
  (regenerated sheets/portraits) that was awaiting go-ahead, plus in-flight
  Bodhi scaffolding and future-character raw canonicals from parallel sessions.
  — Claude

- **2026-07-04 · engine+data+tools+assets+docs · Sprint 20 shipped:
  personality specials + Burn One** — one signature special per fighter,
  three new engine primitives, all data-driven. (1) NEW mash input:
  `SpecialInput.mash: N` — fires when N fresh press edges of the button
  class sit in the input buffer and the final press is this tick
  (`mashedStrength`); Kirby's **Cat Scratch** (mash P). (2) NEW melee
  rehit: `MoveDef.rehit` lets one activation reconnect every N ticks
  through the active window (`Action.lastHitFrame` gates spacing) — hits
  refresh the reel, scale as a combo, and chip repeatedly through block;
  Cat Scratch + Yulia's **Spinning Star Kick** (charge d,u+K). (3) NEW
  pull projectile: `ProjectileDef.pull` — an UNBLOCKED hit snaps the
  victim to the owner's feet (85px, wall-clamped) mid-launch so the
  knockdown lands them right there; blocked = plain pushback; Marzipan's
  **Vine Spear** (bf+P). (4) NEW slow-fall float: `MoveDef.float {vy,
  gravity}` launches airborne at first active; `FighterState.floatGravity`
  overrides fall gravity during air/airAttack, cleared on touchdown and by
  applyHit; Freeman's **Yoga Float** (qcb+P) — 181-tick hang vs ~40 for a
  jump, air normals live. Riding existing plumbing: Gene's **Mana Burst**
  (bf+P logo fireball), Flo's **Blunt Puff** (qcf+K lingering rehit smoke
  ring), Vincent's **Matrix Teleport** (qcf+K, teleport-behind + invuln 14
  — cell art is CRIMSON runes because green FX keys out on the chroma
  screen). Flo's fatality is now **Burn One** (ignite the husk → roll the
  ash → smoke it; 4 panels generated, replaces rm -rf /, flo.json +
  gen-fatality.mjs prompts swapped). frames-manifest grew 3 pose cells per
  touched fighter (+3 projectile arts: mana-burst, vine-spear, blunt-puff);
  sheets regenerated + repacked (65/65/62/65/62/65/62 cells). CpuDriver
  needed nothing (mash specials are filtered out; motion specials picked
  up automatically). docs/CHARACTERS.md + docs/MOVES.md updated. 9 new
  vitests — 130/130 green, tsc clean, all four primitives verified live in
  the browser via the engine module. — Claude

- **2026-07-04 · engine+data · Sprint 19 shipped: cancels & chains** — all
  four items, engine + character data only (no renderer changes needed).
  (1) Chains: `chains: string[]` on a move lists the ids a CONTACTED move
  (hit or block — `hasHit`, never a whiff) may cancel into; consumed from
  the Sprint 18 action buffer at the top of updateFighter's attack case, so
  presses during hitstop chain naturally. All lights chain into all lights
  on every kit; light→medium where the kit wants it (Vincent lp→mp, Kirby
  lp→mp + lk→mk, Yulia lk→mk, Catherine lp→mp). (2) Special cancels:
  `cancel: true` normals (all non-knockdown mediums/heavies, roster-wide)
  cancel into any motion special on contact — grabs excluded (canceling
  into a command grab on a reeling victim is degenerate), one-fireball rule
  re-checked at cancel time. Window: contact → end of active +
  `CANCEL_WINDOW_TICKS` (8). (3) Combo damage scaling: `FighterState.
  comboHits` (victim-side) increments when a hit lands on an already-reeling
  (hitstun/airHit) fighter, resets the moment they stop reeling (hitstop
  holds it — freeze is time standing still); hits 1-2 full, then
  −`COMBO_SCALE_STEP`(10)%/hit to a `COMBO_SCALE_FLOOR` of 30%, integer
  math, ≥1 dmg; stun feeds on the SCALED damage so long strings can't also
  be free dizzies. Mash-jab midscreen naturally drops after ~5 hits from
  pushback — that's spacing, not a bug. (4) 11 new vitests (chain on
  hit/block, whiff never cancels, lights don't special-cancel, medium
  cancels on hit/block/not-whiff, scaling curve 45/45/40/36/31, 30% floor,
  drop-resets-scaling, chained-string determinism) — 121/121 green, tsc
  clean, verified live in the browser (dev training scene + engine module
  driven headless: same deltas). — Claude

- **2026-07-03 · engine+scenes · Sprint 18 shipped: input forgiveness + hit
  feedback** — all six items, engine-core only + renderer presentation.
  (1) Action input buffer: `FighterState.buffered` captures a fresh press in
  any unactionable state (incl. during hitstop) with the attack pick resolved
  at press time — motions keep their window, so wakeup reversals work — and
  fires it on the first actionable frame (TTL 8, consumed once, fireball rule
  re-checked). (2) Counterhits: startup/recovery clips (not active-frame
  trades) reel ×1.5 hitstun with +3 victim-only freeze and a `counter` action
  flag; FightScene diffs it into a red spark + layered crack + harder shake.
  (3) Landing recovery: new `landing` kind — 3 ticks plain jump, 6 after a
  whiffed air normal. (4) Per-fighter hitstop: `GameState.hitstop` →
  `FighterState.hitstop`; melee freezes both, projectiles the victim only,
  max() on stacked freezes, frozen fighters skip their update, timer/throw-
  tech pause while anyone's frozen, non-fight phases keep the whole-world KO
  freeze, projectiles fly through freezes. (5) Ground bounce: airHit rebounds
  once (invulnerable, `bounced` flag), throws inherit it; dust puff + thud on
  impacts. (6) Hitstop retuned 3/5/7/8 → 4/6/9/10. 17 new vitests (110/110),
  tsc clean, verified live (demo bots, ~5700 frames: asymmetric freezes,
  bounces, counters, landing countdown all observed; zero console errors).
  Committed (not pushed) on the user's go-ahead; the same commit carries a
  parallel session's uncommitted SPRINTBOARD docs edits (long-term RFE
  additions — same file, docs-only). — Claude

- **2026-07-03 · docs · long-term stretch goals added to the RFE roadmap** —
  user-requested, explicitly not current priorities: super bar + super move
  per player (promoted from the Icebox, carries the super-freeze note with
  it), arcade story mode expanded with its presentation concept (fight every
  fighter in their home stage; stylized overhead Mars/Bombay Beach map zooms
  into a location per stage between fights), SF2-style item-breaking bonus
  stages (absorbs the Icebox car-smash homage), unlockable hidden characters
  from town (Tao, RJ, Rapha, Anderson, Puddles, …), expanded Martian roster
  (promoted from the Icebox's "new characters"), and per-character double
  jump via a character-JSON flag. Icebox trimmed to match. No code changed.
  — Claude
  audited an industry-conventions "special sauce" list (36 items), a
  time-freeze follow-up, and the user's personal fix list against the engine
  and FightScene. Already covered (no action): hitstop, KO slow-mo, motion
  leniency, hit/hurt/push box separation, pushback + corner transfer,
  auto-facing, pre-jump frames, attack heights/block triangle,
  snap-to-ground, screen shake, per-type sparks, round/menu flow,
  fatality-as-cinematic. Biggest gap found: **action input buffering** —
  `freshPress` is an exact-tick check, so presses during recovery/hitstun/
  getup are silently dropped. Also found: global hitstop freezes a
  projectile's SHOOTER on hit (SF fireballs freeze the victim only).
  Planned **Sprint 18** (action buffering + reversal buffer, counterhits,
  landing recovery, per-fighter asymmetric hitstop, ground-impact bounce,
  hitstop-tuning playtest), **Sprint 19** (chains, special-cancel windows,
  combo damage scaling — promoted off the near-term roadmap), **Sprint 20**
  (seven personality specials — two NEW primitives: pull-projectile for
  Marzipan's vine spear, slow-fall float for Freeman; mash motion promoted
  from the S8 deferred list for Kirby's cat scratch; Vincent's matrix
  teleport reuses Gene's `teleport:'behind'` — plus Flo's fatality reworked
  to "Burn One"). Near-term roadmap gained: per-move hurtbox overrides,
  post-stun throw protection, height normalization + pack-time ground-
  baseline autodetect, post-fatality→victory-screen flow, attract-mode
  blink cleanup, sound priority/cooldowns, projectile-clash + throw-tech
  feedback. Icebox: proximity normals and camera zoom declined; super
  freeze rides the future super meter. Header advanced to Sprint 18
  (S17 shipped earlier today in a parallel session). No code changed.
  — Claude

- **2026-07-03 · audio+tools+scenes · voice-variant depth: 6 kiai / 6 hurt /
  4 victory per fighter** — `VOICE_COUNTS` in BootScene bumped from 4/4/3;
  `gen-audio.mjs` line lists expanded to match (incl. requested lines: Flo
  "Genau"/"Ah, OK", Gene "Mana Blast"/"Yeah"/"Oh yeah", Yulia "Fantastic",
  Marzipan "Please, collaborate with me"); all 128 numbered clips generated
  via ElevenLabs into `public/assets/audio/voice/`; deleted the 16 orphaned
  unnumbered `<char>-kiai/-hurt.mp3` clips (loader only requests numbered
  files). Slot counts are a BootScene↔gen-audio contract — noted in both
  files. *(Claude)*

- **2026-07-03 · engine+scenes+data+assets · Sprint 17 shipped: universal
  throws (LP+LK, techable) + dizzy/stun** — code complete, frames reviewed &
  APPROVED by the user (two re-roll rounds + manual raw edits, sheets packed
  from the approved raws), sitting in the working tree ready to commit.
  Engine: new `LPLK` cross-class chord
  (`throwChord` in step.ts, mirrors `comboPress`; staggered LP→LP+LK upgrades
  the jab via the existing early-chord kara rule), `throw` rides the existing
  `grab` plumbing plus a new `techable` flag — on connect the victim is held
  (`pendingThrow` on GameState, 12-tick window) and their own LP+LK techs it
  (both bounce apart through a 10-tick recoil, zero damage); expiry lands an
  unblockable knockdown. Throws whiff on airborne/hitstun/blockstun/airHit
  victims. Dizzy: `stun` accumulator on FighterState (gains = damage on clean
  hits only, decays 0.5/tick, threshold 250 → forced `dazed` ~3s once the
  reel/getup ends, resets on daze end or on the punish landing — no
  double-trigger). `dazed` REMOVED from `isInvulnerable` (dizzied fighters are
  fully vulnerable; safe because the finisher phase never resolves attacks).
  Renderer: circling-stars `vfx-dizzy` overlay (new generic in gen-vfx.mjs,
  one asset roster-wide) drawn above a dazed fighter's head; grab-thunk SFX on
  hold start; LP+LK shown in move log + pause move list. Data: `throw`
  MoveDef appended to all 8 JSONs (dmg 85/range 105; Yulia 100/115). Art: 24
  throw cells generated + packed (gen once → user review found opponent-
  bleed/edge-cropping in most startup/active frames → prompts rewritten to
  solo-mime "reaching" poses + a new global FRAME_RULES edge-margin rule in
  gen-frames.mjs → 15 cells re-rolled via `--cells`, Gene's originals kept;
  round 2: all 7 non-Gene `throw-active` cells re-rolled again as an active
  forward air-grab — arms extended toward the frame edge, hands clutching
  empty air behind a small impact flash).
  9 throw + 5 dizzy vitest cases; 95/95 green, tsc + build clean; verified
  live in the browser (throw hold→knockdown sequence, dazed + overlay).
  docs/MOVES.md §1.2/§1.3 updated with both specs. — Claude

- **2026-07-03 · docs · Sprint 17 planned: universal throws + dizzy/stun** —
  investigated the sprite-sheet pipeline's actual regeneration/reindex risk
  (traced `tools/pack-sheet.mjs` + `tools/frames-manifest.mjs` + `FightScene`
  cell resolution) to confirm append-only cell additions are 100% safe (no
  regen, no mapping breakage) while inserting into the shared `CELLS` array
  would reindex every character's button cells roster-wide — that finding
  shaped the Sprint 17 design: universal throw art is a per-character named
  special appended the normal way (attacker only; the victim reuses existing
  hit/knockdown cells, so zero new shared cells), and dizzy/stun ships via a
  VFX overlay (one generic asset, like the existing impact-spark system)
  rather than new body-pose art, since `dazed` is already a recognized
  `Action.kind` that renders today via the `hit`-cell fallback. Locked the
  throw input (LP+LK chord, close/grounded/unblockable, with teching) and
  scoped sprite gen to run first/in-background so art lands for review while
  engine work proceeds — explicitly no iterative frame QA/re-roll loop this
  sprint, that's a manual human pass. Sprint 16 closed out fully (all 5 boxes);
  pulled throws + dizzy off the near-term roadmap into their own sprint. No
  code changed. — Claude

- **2026-07-03 · input+scenes: gamepad menu navigation, three real controller
  bugs fixed** — the earlier "gamepad verified end-to-end" pass only exercised
  the *in-match* input path; menus, character select, settings, pause, and the
  win screen had zero pad wiring. Added `src/input/menu-nav.ts` (`MenuNav` +
  shared `menuNav` singleton): dpad/stick navigates, any punch or kick button
  (read from live bindings) or Start confirms, Select/Back opens the
  menu/backs out — wired into `MenuScene`, `SelectScene` (fighter grid +
  stage dialog), `SettingsScene`, `ControlsScene`, `VersusScene`, and
  `FightScene` (pause dialog, win screen, Start-to-pause mid-match). Also
  fixed the gamepad-only autoplay-unlock gap in `src/audio/music.ts` (browsers
  gate `<audio>` playback on a user gesture; only `pointerdown`/`keydown` were
  listened for, so a controller-only session never heard music — added a
  gamepad-press poll with re-arm-on-rejection).
  User playtesting surfaced three real bugs the synthetic-pad harness had
  missed, root-caused by reading Phaser source directly (not guessing):
  (1) **Phaser's per-scene `GamepadPlugin` drops stale-timestamp pads** —
  `Gamepad.update()` ignores any snapshot whose `timestamp < this._created`,
  and every scene start creates a fresh wrapper stamped "now"; Chrome only
  bumps a pad's timestamp on state *change*, so input froze after the first
  scene transition. Fix: read `navigator.getGamepads()` directly everywhere,
  never `scene.input.gamepad`. (2) **pad-triggered `scene.start()` calls
  queued inside `update()` sometimes never applied** on real hardware (the
  selection registered — confirmed via the `devLaunch` dev replay hook — but
  the next scene never rendered); keyboard/mouse escape this because their
  handlers run in Phaser's input phase, same-frame. Fix: `navDefer()` fires
  every pad-triggered scene transition from a macrotask between frames (a
  scene-active guard skips it if a double-press already queued two). (3)
  **`GamepadPlugin.stopListeners()` crashes on every scene shutdown** when a
  controller sits at a browser gamepad index > 0 (common after Bluetooth
  reconnects) — its wrapper array is sparse and indexed by controller index,
  so `this.gamepads[0].removeAllListeners()` throws on the hole, uncaught,
  killing the whole game loop mid-transition. This was the actual root cause
  of "select once, then stuck" and explains every earlier symptom. Fix: the
  gamepad plugin is now fully disabled (`input: { gamepad: false }` in
  `main.ts`); the one remaining Phaser-plugin consumer (`KeyboardSource` in
  `src/input/keyboard.ts`, the in-match fight input) now reads
  `navigator.getGamepads()` directly too, with pads compacted by connection
  order (first connected pad → P1, second → P2) instead of raw browser index.
  Added a dev-only on-screen error banner (`main.ts`, `window.onerror` +
  `unhandledrejection`) so a future silent freeze surfaces its stack instead
  of just "the game is stuck" — this is what caught bug (3).
  Verification: 9 new unit tests in `src/input/menu-nav.test.ts` (rising-edge
  seeding kills phantom presses from a button already held on load, buttons
  never auto-repeat, directions do, Start/Select vs. confirm mapping, a press
  held across a scene transition fires exactly once). In-browser: scripted a
  real-time (real `requestAnimationFrame`, non-deterministic-timing) synthetic
  pad through the full loop — title → menu → character select (both slots) →
  stage dialog → versus splash → fight → pause → settings — under the user's
  exact failure condition (pad at gamepad index 1, index 0 empty); zero
  errors, every transition landed. User confirmed fixed on real hardware.
  81/81 vitest, `tsc --noEmit` clean. — Claude

- **2026-07-03 · assets · yulia frame QA + new-roster inspo batch** — yulia:
  re-rolled `51-backbend-guillotine-active` and `55-volga-piledriver-recovery`
  (volga recovery prompt in `frames-manifest.mjs` tightened: compact dust puff
  kept away from the frame edges) and repacked her 8×7 sheet. Character-inspo:
  12 new candidate-fighter photos added (bodhi, cat, chebel, earl, haidai,
  katana, lyosha, rapha, seva, vanessa, xiao-chen, ygor + lyosha/ygor/seva
  face shots); the two unnamed MARS-PASSPORT jpgs were replaced by their
  named equivalents. Work from the parallel session, committed on user
  request. NOTE: the repo is public — these are photos of real people, same
  standing caveat as the original eight. — Claude

- **2026-07-03 · verify+assets · Sprint 16: gamepad path verified end-to-end +
  juice/VFX demo recorded** — synthetic standard-mapping pad injected into the
  preview browser (`navigator.getGamepads` monkeypatch; GOTCHA: Phaser's
  `Gamepad.update` drops pads whose `timestamp` predates the wrapper's
  `_created` — make the fake pad's timestamp a live `performance.now()`
  getter, and do NOT hand-dispatch `gamepadconnected` events without a
  `.gamepad` payload or the plugin queue crashes; `refreshPads()` polls every
  update anyway). Verified through the real fight loop: pad registration,
  dpad-right walks / left-stick walks back, X→LP Y→MP RB→HP A→LK B→MK,
  RT analog fires HK at 0.6 and stays idle at 0.2 (0.4 threshold), dpad
  QCF+X produced a live Sigil Bolt (motion buffer through the pad), and
  ControlsScene pad press-to-bind bound LB→LP then reset. Bindings and match
  settings restored to defaults afterward — **ready for the user's real
  controller playtest**. Recorded `juice-vfx-demo.mp4` (repo root, 31s,
  30fps): scripted Yulia vs zoner-CPU Vincent on CHIBA — jab/heavy sparks
  with hitstop, blocked sigil bolts, TWO Volga Piledrivers with the ground
  smoke cloud, ghost bars draining both ways, KO slow-mo into FINISH THEM!,
  and a scripted Heart Breaker fatality (all four panels) into the win
  screen. Captured via deterministic frame-dump (pump `loop.step`, canvas
  JPEG per 2 renders → local HTTP receiver → ffmpeg 30fps), immune to
  preview-tab rAF throttling. 72 tests green; prod build clean. — Claude

- **2026-07-03 · input+scenes · Sprint 16: control remapping** — bindings
  moved into settings: `bindings: [PlayerBindings, PlayerBindings]` with
  per-action keyboard keyCodes AND gamepad button indices (defaults = the old
  hardwired layout; deep-sanitized against corrupt storage). `KeyboardSource`
  now builds its key maps and pad lookups from settings at construction (each
  fight picks up the latest bindings) and captures every bound key so arrows/
  space stop scrolling the page; the left stick always drives movement,
  unremappable. New `ControlsScene` (Settings → CONTROLS → REBIND ►): P1/P2
  tabs, ten action rows × [KEYBOARD][GAMEPAD] press-to-bind cells (click →
  "PRESS…" → next key / next FRESH pad button binds; ESC cancels),
  same-device duplicates SWAP with the old binding so no action is ever
  orphaned, RESET BINDINGS + BACK rows. 72 tests green, tsc clean. Verified
  in-browser: rebound P1 LP→Q (persisted), MP→W swapped W/T with UP, P2
  untouched; in a live fight Q jabbed and the old R did nothing; reset row
  restored defaults. Gamepad-button binding exercised with the synthetic-pad
  harness in the controller-verification pass. — Claude

- **2026-07-03 · scenes+ai · Sprint 16: attract mode** — idle on the title for
  20s (keyboard/mouse/pad activity all reset the watchdog, pads polled since
  sticks don't emit events) → CPU-vs-CPU demo fight: random playable pair +
  random stage, HUD on, blinking "DEMO — PRESS ANY KEY" banner, `CpuDriver`
  driving BOTH slots (`botP1`). Any key/click/pad button exits to the title;
  in demo none of the human-match keybinds (pause/rematch/move-log) are
  registered. matchEnd auto-returns to the title after the win-screen beat
  (phaseFrame 300) or when the victory track ends, whichever lands first.
  72 tests green, tsc clean. Verified in-browser (throttled-tab loop pumping):
  idle → demo (marzipan vs freeman on chiba, both bots fighting to a
  roundEnd), keydown → straight back to Menu. NEW GOTCHA for preview
  verification: after a reload in a throttled tab the Boot loader can finish
  its list without ever firing 'complete' — resume the audio context, call
  `checkLoadQueue()` a few times, then pump `__game.loop.step(t)` manually;
  scene.start ops also only apply on pumped steps. — Claude

- **2026-07-03 · assets+tools+scenes · Sprint 16: impact-VFX overlay system** —
  new `tools/gen-vfx.mjs` (`npm run gen:vfx`, pooled, idempotent, prompt
  sidecars, MAGENTA chroma screen — never green): generates (a) three greyscale
  generic sparks (`public/assets/vfx/spark-{hit,heavy,block}.png`) tinted the
  attacker's character color at runtime, and (b) per-move overlay art that
  lives with the move like projectiles do
  (`public/assets/sprites/<char>/vfx-<moveId>.png`, prompts in the script's
  `PER_MOVE` dict). New render-only `vfx: {size, anchor: 'impact'|'ground'}`
  hint on `MoveDef` (engine never reads it) wires per-move art: shipped Yulia
  Volga Piledriver ground smoke + Vincent Rising Glyph energy column.
  FightScene: overlay sprites spawn from state-diffing in `presentTick` —
  every connecting hit picks per-move art if declared, else a generic spark
  (heavy for specials/H-buttons/55+ damage, small for the rest), block contact
  spawns an icy shield ripple; overlays grow + fade over ~14 render frames,
  fall back to the legacy flash circle when textures are missing (dev-404
  gotcha). BootScene loads generics + every declared per-move VFX. CLAUDE.md
  pipeline step 8 + command documented. 72 tests green, tsc clean. Verified
  in-browser through the real engine path: scripted jab → 90px tinted spark,
  HK → 135px heavy burst, 360+HP Volga Piledriver → 240px ground smoke under
  the piledriven victim (screenshot ftw — ghost bar visible in the same
  frame). — Claude

- **2026-07-03 · engine+scenes · Sprint 16: game-feel juice bundle** — hitstop:
  connecting hits freeze the whole world (fighters, projectiles, clock) for a
  beat, deterministic in-engine (`GameState.hitstop`, set in `applyHit`, gated
  at the top of `step()` AFTER input buffering so motions finished during the
  freeze still come out); scaled by button strength (L 3 / M 5 / H 7 ticks),
  specials + their projectiles hit hardest (8), lingering rehit clouds stay
  light (3) so tick damage doesn't stutter the match; blocked contact freezes
  too; trades keep the longest freeze; a KO's freeze carries into roundEnd
  before the bodies fly. Delayed red health drain: SF2 ghost bar in
  `drawHud` — lost health lingers red behind the live bar for ~half a second,
  then drains toward it (snaps up on refill/round reset); renderer-only. KO
  slow-motion: the round-ending hit plays at ~⅓ speed for the first 55
  phaseFrames of roundEnd/finisher (accumulator scaling in `update` — pure
  presentation, the tick sequence is identical). 72 tests green (4 new
  hitstop specs: strength scaling, world freeze incl. timer, special-via-
  projectile hardest, block freeze + round-reset clear). Verified live
  in-browser via a probed CPU fight: maxHitstop 8, ghost gap 160hp draining,
  tick rate 60→<21/s in the KO window, full intro→fight→finisher→fatality
  flow clean. — Claude

- **2026-07-03 · assets+data · MIMOS stage** — generated the MIMOS café-lounge
  stage from `assets/stage-inspo/MIMOS/` (orange-red pallet-rack lounge, pink
  star canopy, MAIS AMOR posters, coffee bar, ping-pong table at left, white
  gravel fighter foreground) via the locked pixel-art pipeline; `SCENES` line
  in `tools/gen-stage.mjs` + registry entry in `src/data/stages.ts` (19 stages).
  Verified in-browser (texture loads, boot clean) + tsc clean. Re-rolled once
  per user: first take read too clean/vector-flat — reworked the `SCENES` line
  to emphasize gritty weathered/lived-in clutter and MARS-grade dithering
  (first take backed up in scratchpad). Part of the still-uncommitted
  stage-art batch. *(Claude)*
- **2026-07-03 · docs · sprintboard/README/CLAUDE.md refresh + Sprint 16 plan** —
  reconciled stale checkboxes after the keyboard playtest (things mostly work):
  ticked S4 human playtest (controller playtest carried to S16), S5 roster
  frame QA + v2 sheets (done in S6/S7/S14), S11 Flo TRAINING verify, S13
  Freeman balance pass, S14 kirby KO bust; S8 deferred mechanics stay deferred.
  Planned **Sprint 16 — smoothness & playability**: controller playtest,
  impact-VFX overlay system (greyscale+tint generics & per-move art), attract
  mode (idle menu → CPU-vs-CPU demo), per-player control remapping in Settings,
  juice bundle (hitstop, delayed red health drain, KO slow-mo). Added approved
  near-term roadmap (combo chains/cancels, blocking feel, throws+teching,
  dizzy, damage scaling, CPU difficulty, round intros/victory poses, CRT
  toggle) and long-term RFEs (character designer dialog, online multiplayer,
  arcade story mode, Veo motion smoothing). Icebox rebuilt (dropped shipped
  items, added declined-for-now ideas). README status brought to 8/8 +
  19 stages + music; CLAUDE.md roster/commands touched up. — Claude

- **2026-07-03 · scenes+audio · quick-volume overlay + mouse-first settings +
  select QoL** — new `VolumeOverlayScene` pinned lower-right, launched once at
  boot above every scene: fades in on mouse motion, hides after ~2.6s (stays
  while muted/dragging); speaker click = master mute, fader drag = master
  volume, both persisted + applied live. New `masterVolume` (default 100%) and
  `muted` settings scale music AND SFX via `src/audio/volume.ts`
  (`effectiveSfxVolume`/`applyMusicVolume` — the one place volume math lives).
  Settings page: MASTER VOLUME row added; faders are real draggable tracks
  with handles; ROUND TIME / MATCH LENGTH step by horizontal drag or click to
  cycle; arrows still nudge; settings page and overlay live-sync when the
  other changes values. Character select: mouse now drives P1 then P2 in every
  mode (hover moves the active cursor, click confirms), and ENTER confirms in
  sequence P1 → P2 → stage. Verified in-browser: overlay reveal/mute/drag,
  fader + stepper drags, reset-defaults click, and a full two-player
  click/ENTER select into the VS screen. 68 tests green. — Claude

- **2026-07-02 · assets+engine+stages · Gene + Marzipan (8/8 playable) + pixel-art
  stage expansion + music/kirby assets** — bundles this session's fighter work with
  parallel-session stage & audio work into one snapshot commit.
  **Fighters (this session):** harvested Gene + Marzipan off the stale
  `origin/marzi-char` draft rather than merging it (would have reverted main's
  round-clock/winQuotes/leap/freeman/pipeline work). Cherry-picked branch-only
  assets — packed sprite sheets + per-move projectiles, fatality panels
  (`four-oh-four`/`compost`), voice grunts, the two character JSONs, raw canonicals
  + frame dumps + `MOVE_DURATIONS.md` — and **hand-ported** the engine mechanics
  they depend on onto current main: `teleport` (Diffusion), grab `heal` (Symbiosis),
  projectile `rehit` clouds (Spore Bloom), `slowFactor` slow-field (Rate Limit),
  + the chord-upgrade fix. Kept the branch canonicals (refined "never green"
  chroma-safe prompts the sprites came from). Registered both in `index.ts`/
  `roster.ts`/`FightScene.ts`/`frames-manifest.mjs`, authored `winQuotes` for each.
  Roster now 8/8 fully-built and playable, all with fatalities. 68 tests green
  (9 new), typecheck + build clean, 16 new assets 200 + both selectable in-browser.
  **Stages (parallel session):** locked 16-bit pixel-art look (`gen-stage.mjs`
  reworked, CLAUDE.md step 5 rewritten), existing stage backgrounds regenerated in
  the new style + 8 new stages registered in `stages.ts` (ALTAR, CHIBA ROOF,
  DODECAHEDRON, DOME, PAINTED CANYON, SKI INN, VAN, SALTON) with inspo folders;
  superseded cel-shade art archived under `_old/`.
  **Audio/misc (parallel session):** raw generated music tracks under
  `assets/raw/music/`; kirby KO/defeated bust regenerated from the new canonical.
  — Claude

- **2026-07-02 · engine+scenes · settings page (volumes, round clock, match
  length)** — new `SettingsScene` off the main menu (`4 · SETTINGS`): music
  volume (live), SFX volume (audible preview), round time (OFF/30/60/99s),
  match length (best of 1/3/5), reset-defaults row; W/S+A/D or mouse,
  persisted to localStorage via `src/settings.ts`. Engine: match rules moved
  into deterministic state — `initialState(..., rules?)` takes `MatchRules`
  (`roundTicks` 0 = clock off, `winsNeeded`), replacing the WINS_NEEDED /
  ROUND_TICKS constants at runtime; timer-off never time-ups, HUD shows ∞.
  `play()` now scales every SFX by the setting. Defaults (user-picked): music
  60% · SFX 80% · 60s rounds · best of 3. 4 new engine tests (59 green).
  Verified in-browser: fresh profile shows the new defaults; settings persist;
  OFF/best-of-5 flowed into a live fight (`rules {0,3}`, ∞ HUD). — Claude

- **2026-07-02 · audio+scenes · full music loop: title/versus/victory tracks +
  end-driven flow** — installed the Suno utility batch: `menu/title.mp3`
  (seamless title loop), 10 `versus/` clips, `victory/victory.mp3`, bonus 4th
  institute track (42 tracks total). Playback grew `once`/`onEnd` (play a
  single pass, caller reacts to the end) and `nextTrack()` (crossfade to a
  different track in the current context). Flow now: title loops menu→select,
  VS screen plays one random clip and **its end starts the fight** (timer
  fallback if no tracks/blocked audio), stage folders rotate to a fresh track
  between rounds (single tracks keep looping), victory plays once over the
  win-quote screen and **its end returns to character select** (click/ENTER
  skips, R rematches) where the title loop resumes. Smoke-tested end-to-end in
  browser: title → select → versus clip → clip-end fight (institute) →
  round-boundary rotations (institute-1→3→1) → matchEnd victory.mp3 →
  auto-return to select with title playing. Icebox: per-character `victorySong`
  attribute. — Claude

- **2026-07-02 · scenes+audio · SF2-style VS screen + music paradigm cleanup** —
  new `VersusScene` between stage confirm and Fight: portraits slide in on
  black (P2 mirrored to face off), name plates, red-burst VS pop, stage name,
  blinking INSERT COIN homage; 3.4s hold, any key/click skips. Music contexts
  simplified to the final paradigm: `menu/` loops from title through character
  select, fades into `versus/` on the VS screen, stage music runs the fight,
  `victory/` fades in over the win-quote screen. Removed the `select/` and
  `fatality/` contexts (menu carries over; fatalities will be video cutscenes
  with baked-in audio). Scaffold/README/manifest updated. Verified in-browser:
  select → VS screen → auto-advance → fight playing salton stage track.
  `menu/`, `versus/`, `victory/` still await tracks (Suno prompts handed to
  user). — Claude

- **2026-07-02 · assets · stage music tracks installed** — copied 29 mp3s from
  `assets/raw/music/Martian Kombat/` into `public/assets/audio/music/stages/<id>/`
  (kebab-cased filenames), regenerated `manifest.json`. Every stage has music
  except `dome` — `DOJO.mp3` had no matching stage so it went to
  `stages/default/` and covers dome via the fallback chain. Multi-track stages:
  altar (3), institute (3), chiba/drive-in/estates/saturn/shipwreck/ski-inn/van
  (2 each). Verified in-browser: salton/altar/chiba fights played their own
  tracks, dome fell back to default; mp3s stream (206) with zero failed
  requests. Menu/select/victory/fatality folders still await tracks. — Claude

- **2026-07-02 · audio+tools · stage/menu music playback scaffold** — new
  `src/audio/music.ts`: streaming HTMLAudio music keyed to named subfolders of
  `public/assets/audio/music/` (`menu/`, `select/`, `victory/`, `fatality/`,
  `stages/<id>/` + `stages/default/` fallback; see README there). Multi-track
  folders pick randomly and rotate on end; single tracks loop; empty folders
  degrade gracefully (select falls back to menu, victory/fatality keep stage
  music). `tools/gen-music-manifest.mjs` (`npm run gen:music`, auto via
  predev/prebuild) scans folders → `manifest.json`; `--scaffold` creates the
  context dirs. Wired into Boot/Menu/Select/Fight (stage music on create,
  victory/fatality overlays on phase transitions); autoplay-block handled via
  first-gesture retry. `pickTrack` unit-tested (5 tests). Verified in-browser:
  menu → select fallback → fight stage-default chain all played. **No tracks
  committed yet — drop mp3s in and run `npm run gen:music`.** — Claude
- **2026-07-02 · assets+data+engine · Sprint 14: Kirby rebuild (Firebreather)** —
  reimagined Kirby as an acrobatic fire-breathing contortionist; stripped every
  tea/teacup/match reference (canonical flavor, manifest `always`, bible, win
  quotes). Face-shot ref merged into `gen-canonical` (`FACE[]`); new select icon.
  New kit, all on existing engine primitives: Fire Breath (qcf+P cone), Sonic
  Scream (qcb+P knockdown rings), Cartwheel (dp+K invuln anti-air), L/M/H variants.
  Promoted legacy 23-cell → v2 56-cell sheet (8×7) + 2 keyed per-move projectiles;
  grunts refreshed; removed stale bare `projectile.png`. Fatality Hot Yoga (hcb+P)
  + 4 panels. Updated the no-fatality KO-branch test (kirby now owns one). 50 tests
  green, build clean. Scoped commit: Kirby files only (stage-restyle work left
  untouched, pending its own approval). *(Claude)*
- **2026-07-02 · assets · stage art restyle: retro pixel-art pass (USER
  APPROVED, uncommitted)** — regenerated all 11 stages (10 + salton) via reworked
  `tools/gen-stage.mjs`: style contract switched from cel-shaded cartoon to
  16-bit retro pixel-art anchored on the salton-shoreline render (style ref
  copied to `assets/stage-inspo/style-ref-salton.jpg`, passed as first
  reference for every stage); hard "walkable floor to the bottom edge, no
  blank bands, no foreground obstructions" contract (fixes drive-in deadspace
  + chiba blocked floor); salton remade in 21:9 (now 1680×720 at its legacy
  path, no code changes); script now parallel via `pool()`
  (`--concurrency N`, default 4) with per-stage log-and-skip errors. Previous
  art offlined to `public/assets/backgrounds/stages/_old/` and raws to
  `assets/raw/stages/_old/`. drive-in was re-rolled once for a continuous
  ground surface. Awaiting user approval before commit. Second pass: 4 NEW
  stages generated from new inspo folders (chiba-roof, dodecahedron,
  painted-canyon, ski-inn) with scene prompts in `gen-stage.mjs` and entries
  in `src/data/stages.ts` (roster now 15 stages); verified in-browser — all
  stage textures load, menu renders new salton. Pre-existing unrelated
  console error: `proj-yulia` (missing
  `public/assets/sprites/yulia/projectile.png`). All 15 approved by user.
  Third pass: previous wrecked-structure dodecahedron render renamed to new
  stage DOME (id `dome`; its inspo refs moved to `assets/stage-inspo/DOME/`);
  DODECAHEDRON regenerated from a new user photo
  (`assets/stage-inspo/DODECAHEDRON/image.png` — intact skeletal dodecahedron
  silhouetted at blue-hour dusk, owl perched on top, camp lights on horizon).
  Registry now 16 stages; both textures verified loading in-browser. Fourth
  pass: ALTAR (desert ritual altar, solar-panel wall, flowers/silver vessels)
  and VAN (graffiti sprinter on sunset playa) generated from new inspo
  folders; van re-rolled once — first take kept photographic detail, prompt
  gained an explicit "redraw everything as pixel art" line. Registry now 18
  stages; both verified loading in-browser. Fifth pass: van re-rolled again
  per user (centered, three-quarter angle, invented front end the ref photo
  crops off); CLAUDE.md pipeline step 5 rewritten to document the stage
  workflow (style-ref anchor, 21:9/1680×720, floor contract, SCENES dict +
  `src/data/stages.ts` registry, `npm run gen:stages`); stage-select dialog
  grid now auto-sizes to the option count (SelectScene `layoutStageGrid`:
  picks the 4–10 column layout with the largest fitting 21:9 thumbs, centers
  rows — the old fixed 4-col grid already overflowed 540px at 19 tiles).
  Verified: 55 tests green, tsc clean, dialog shows all 19 tiles in 5 cols
  in-browser, WASD/arrow row-jumps follow the computed column count. *(Claude)*
- **2026-07-02 · assets · Flo frame QA fixes** — cleaned up Flo cells flagged for
  duplicate/extra-limb artifacts: re-rolled 5 via `gen-frames --cells` (lk-active,
  mk-recovery, clk-recovery, cmk-recovery, chk-active), and the user manually
  fixed/QC'd further cells (down, hk-active, clp-recovery). Repacked Flo's 8×8
  sheet (59 frames, alpha verified transparent). *(Claude + user)*

- **2026-07-02 · tools+assets · Freeman frame QA re-rolls** — added a `--cells`
  targeted-regen flag to `gen-frames.mjs` (regenerates ONLY the named cells —
  bare id or `NN-id` stem — force-overwriting, anchor-first still honored,
  projectiles skipped). Re-rolled 5 Freeman cells flagged for extra-limb /
  double-body artifacts (lk-startup, hk-active, clp-recovery, cmp-recovery,
  clk-active), user-QA'd, repacked the 8×7 sheet (alpha verified). Restored an
  unvetted `45-jmk.png` to the committed version first. *(Claude)*

- **2026-07-02 · tools+assets+data · Sprint 13: pipeline concurrency + Freeman** —
  Parallelized the gen pipeline: `lib.mjs` `pool()`/`concurrencyArg()`,
  `gen-frames.mjs` fans cells out (anchor-first, default conc 6), `gen-audio.mjs`
  pools announcer/voice/sfx (default 4). Freeman built end-to-end: 56-cell v2
  manifest entry (counter/turtle yogi, white-gold chi, specials Presence/
  Breathwork/Sun Salutation), 56 frames @ 219s (~5.5× vs serial, 0 failures),
  packed 8×7 sheet, freeman-kiai/-hurt grunts, `freeman.json` (flo-derived
  normals + three engine-valid specials, invuln/leap/forwardVel), registered +
  roster-unlocked. In-browser TRAINING verified: selectable, renders, INSTITUTE
  stage, all three specials fire (move-log confirmed). Fatality **Ego Death**
  (hcb+P): freeman `FATALITIES` entry + 4 generated panels (husk → white-gold
  lotus petals) + `fatality` block in JSON. `gen-fatality` also pooled;
  `gen:audio`/`gen:fatality` npm scripts added; CLAUDE.md documents fatality as
  pipeline step 7. Engine untouched; 50 tests green, typecheck clean. *(Claude)*

- **2026-07-02 · scenes+assets+data · Sprint 12: win-quote screen** — SFII-style
  post-match taunt: winner portrait vs beaten-and-bloodied loser portrait +
  random win quote, built in `FightScene.showWinScreen` on the matchEnd phase
  (engine stays pure). Added `winQuotes[]` to CharacterDef + all 5 playable
  JSONs; `gen-canonical.mjs` now emits `<id>-ko.png` defeated busts (all 8
  generated); BootScene loads them with a greyed-portrait fallback. CLAUDE.md +
  CHARACTERS.md rules updated. 50 tests green, build clean, both win directions
  verified in-browser. *(Claude)*

- **2026-07-02 · merge · flo-char → main** — merged the collaborator's Flo
  feature branch into main. Engine files (step.ts, types.ts, FightScene.ts)
  auto-merged cleanly alongside main's Sprint-10 UI-polish work; resolved
  conflicts in .gitignore (kept "commit raw frames" policy), SPRINTBOARD (kept
  both sprint sections), and flo canonical (kept collaborator's amber-glyph
  regen). 50 tests green, build clean. *(Claude)*

- **2026-07-02 · engine+data+assets · Sprint 11b: Flo PLAYABLE + fatality** —
  engine grew lobbed/fused/detonating projectiles, `field` smoke, projectile
  `knockdown`, and the charge `du` motion (banked charge counter, not a longer
  input buffer); flo.json + roster unlock; rm -rf / fatality panels. 49 tests
  green, build clean. In-browser verify still owed (Chrome extension was
  disconnected). Roster now 5/8 playable. *(Claude)*

- **2026-07-02 · assets+tools · Sprint 11: Flo asset set complete** — canonical
  (amber glyphs, chroma-safe), 59-cell v2 sheet packed + meta.json, 5 keyed
  projectiles, grunts. `gen-canonical.mjs`: `--char` filter + missing-source
  guard (assets/raw was wiped — regen from inspo works). `gen-audio.mjs`:
  per-grunt style/stability overrides. AGENTS.md symlinked to CLAUDE.md.
  NOT YET PLAYABLE: no flo.json — his kit needs engine work (delayed-detonation
  projectile, smoke occlusion, floor trap, charge motion). GOTCHA: block-crouch
  resisted the low anchor 3× — the one-off fix was adding the geometric
  "figure occupies ONLY the BOTTOM HALF of the frame" rule to the pose text
  (scratchpad regen-flo-block-crouch.mjs); consider baking that rule into the
  shared CELLS block-crouch/crouch prompts. *(Claude)*

- **2026-07-02 · assets+scenes · Sprint 10: 10 stages + stage select +
  parallax** — gen-stage.mjs turns each stage-inspo folder into a 21:9
  painted stage (all photos as refs); stages.ts registry; `stage` home-stage
  field in character JSONs; stage-select dialog (RANDOM default, home
  badges); FightScene parallax slides the extra 300px of 21:9 art opposite
  the fighters' midpoint; rematch keeps the stage. 41 tests green; verified
  in-browser. NEW GOTCHA: in the preview browser the Boot loader stalls on
  the audio tail (list N / inflight 0) — `game.sound.context.resume()` then
  `bootScene.load.checkLoadQueue()` and pump the loop. *(Claude)*

- **2026-07-02 · engine+assets+ai · Sprint 6** — named multi-specials w/
  conventional motions; fatality pipeline (finisher→cutscene→matchEnd) with
  Yulia's Heart Breaker; Vincent v2 53-cell sheet; CPU mode; 34 tests green;
  demo re-recorded with CPU-executed fatality. Gotcha: preview-tab rAF now
  free-runs — call `game.loop.stop()` before manual-stepping captures.
  *(Claude)*

- **2026-07-02 · engine+assets+ui · Sprint 5: six-button combat + art QA** —
  six buttons × stand/crouch/air with QCF+P specials (motion inputs live);
  Yulia on v2 50-cell sheet incl. her 8 QA'd regens; magenta-screen projectile
  fix; face-shot icons ×8; ESC move-list pause; meta.json name-driven cell
  lookup with legacy fallback. 27 tests green; verified in browser (rune
  visible mid-flight, pause overlay, debug boxes, crouch art). *(Claude)*

- **2026-07-01 · roster+engine · Sprint 4 (all but deploy/playtest)** —
  Catherine & Kirby playable (frames gen'd via pipeline, 2 Catherine pose
  regens needed; Jazzper dog + fire-cone projectile sprites); engine:
  projectile `height`/`ttl` + chip damage w/ 1-HP floor; gamepad merged into
  input source; grunts for both (Jessica/Laura voices); roster 4/8 playable.
  Verified in browser: catherine-vs-kirby with both projectiles live on
  screen. 21 tests green. Public deploy awaits user approval. *(Claude)*

- **2026-07-01 · audio+scenes · Sprint 3 complete** — ElevenLabs announcer
  (17 lines) + 6 SFX + 4 grunts via `gen-audio.mjs`; canonical painted-cel art
  for the remaining 6 Martians + keyed portraits via `gen-canonical.mjs`;
  Boot/Menu/Select scenes; FightScene: init(data) char pairing, audio via
  state-diff `presentTick`, combo counter, HUD portraits, mirror-match tint,
  matchEnd→rematch/reselect. Fixed `lib.mjs` sidecar regex (`[a-z]+` missed
  ".mp3" → prompts overwrote every audio file; now `[a-z0-9]+`). Verified
  in-browser: menu→select→fight flow, 16/16 audio keys cached, portraits
  keyed. 18 tests green. *(Claude)*

- **2026-07-01 · assets+scene · Sprint 2 complete** — user locked painted-cel
  style + salton-shoreline stage; built keyframe pipeline (gen-frames /
  frames-manifest / pack-sheet); generated + packed full sprite sets for
  Vincent & Yulia (23 cells each + Vincent projectile); scaled character JSON
  geometry ~2× to sprite proportions; FightScene renders sheets with state→cell
  mapping, tints, stage bg, capsule fallback; `window.__game` debug handle.
  Gotchas learned: use gemini-3-pro-image (not flash) for pose frames; use
  ffmpeg `chromakey` ~0.15 without `despill` (bleaches greens); transparent
  sheets preview dark in image viewers — composite before judging. 18 tests
  still green. *(Claude)*

- **2026-07-01 · tools · Sprint 2 style tests** — `tools/lib.mjs` (env loader,
  gemini/openai image helpers w/ prompt sidecars + skip/--force) and
  `tools/gen-style-test.mjs`; generated 6 character style candidates
  (digitized / painted-cel / pixel) + 4 Salton Sea stages into
  `assets/raw/style-tests/` (gitignored). Models verified live:
  gemini-3-pro-image, gemini-3.1-flash-image, veo-3.1, gpt-image-2. *(Claude)*

- **2026-07-01 · engine · Sprint 1 complete** — Vite+Phaser+TS+vitest scaffold;
  deterministic 60hz fight core in `src/engine/` (zero Phaser imports); walk /
  dash / jump / crouch / facing; frame-data combat with hit/block/low logic,
  knockdowns, projectiles (clash + one-per-owner rule), corner knockback
  transfer; best-of-3 round flow with KO/time-up; Vincent & Yulia as JSON;
  FightScene with capsule placeholders, HUD, F1 debug boxes; 18 vitest specs
  incl. determinism replay. Verified live in browser (walk-in + hit exchange
  drained both bars). Throws + chip damage deferred to Sprint 4. *(Claude)*

- **2026-07-01 · scaffold · Sprint 0 complete** — repo initialized; CLAUDE.md,
  SPRINTBOARD.md, README.md, .gitignore, .env.example, docs/CHARACTERS.md written;
  8 inspo photos committed; pushed to GitHub. *(Claude)*

---

## Agent handoff notes

*(overwrite this section each handoff — what's mid-flight, gotchas, next action)*

**Wave 2 roster expansion (2026-07-04, IN FLIGHT — separate session from the
Sprint 20 note below, do not collide):** user-directed multi-phase job to add
8 new fighters. Eligible pool = inspo photos with BOTH a full-body
`assets/character-inspo/<name>.jpg` and a `face/` shot (12 qualified). Chosen
8: **bodhi, cat, chebel, earl, haidai, rapha, vanessa, ygor** (user swapped
katana + xiao-chen out for rapha + vanessa 2026-07-04; benched: katana,
xiao-chen, lyosha, seva — reasons in docs/CHARACTERS.md). Phase plan with
approval gates: (1) character-sheet designs → appended to `docs/CHARACTERS.md`
as "Wave 2 roster — PROPOSED v2, lore-informed", **awaiting user audit**.
v2 redesigned all 8 around the Martian Lore sheet (Mars People tab — now
cited in CLAUDE.md "Lore source" with a HARD privacy rule: never build
anyone marked NO AI PLEASE). Biggest lore swings: Bodhi = Thai-bodywork
grappler (not surfer), Chebel = animal-spirit-card summoner, Haidai =
Balinese vibration priest (sash = saput poleng), Earl = "The Madd Wikkid"
audio-engineer zoner, Ygor = VJ Suave projection zoner (not photographer).
Xiao-Chen has no lore row — flagged lore-light. (2) canonical
painted-cel images into `assets/raw/canonical/` → approve; (3) character
JSONs + winQuotes + VO soundbite samples → approve; (4) parallel full asset
gen (frames/pack/audio/portraits/fatalities/vfx); (5) wire up + make the
select screen grid scale past 8. (Benched-char gotchas for Wave 3:
xiao-chen's inspo is `xiao-chen.jpg` but the face shot is
`face/xiaochen.jpg`; seva's full-body is only 240px.) Next action: user
edited `docs/WAVE2-VO-CHECKLIST.md` 2026-07-04 (NOTE: edits left some
categories short of the 6/6/4 VOICE_COUNTS contract — cat 2 victory, chebel
5/5/2, earl 5 kiai, rapha 5 kiai + 3 victory, ygor 5 kiai + 3 victory;
draft fill-ins for re-approval before running gen-audio). CANONICALS +
PORTRAITS DONE 2026-07-04: all 8 in `assets/raw/canonical/` + 160px crops
and KO busts in `public/assets/portraits/` via gen-canonical.mjs (FLAVOR +
FACE entries added for the 8). Gen gotchas learned: (a) color words in
CAPS in a flavor prompt can get rendered as literal text (bodhi's first
canonical spelled "AMBER" — reworded + regened); (b) gemini IMAGE_SAFETY
sometimes rejects the gory DEFEAT bust prompt (cat) — script now
log-and-skips + falls back to a bloodless DEFEAT_SOFT variant
automatically; (c) chebel's fixed portrait crop is tight on the forehead
(knee-up pose) — acceptable, per-char crop offset is the fix if wanted;
(d) ygor's canonical cap has garbled "MARS"-ish lettering — user to judge;
(e) rapha's canonical regened WITHOUT Tubs (user call — companion entities
stay out of canonicals; Tubs gets his own assist cell, Jazzper pattern).
Canonicals approved (Rapha regened Tubs-free). NOW BUILDING FIGHTERS ONE AT
A TIME (vertical slice first, then parallelize). **BODHI scaffolded
2026-07-04** — grappler, pure data, tsc clean + 130/130 tests:
`src/data/characters/bodhi.json` (2 command grabs Deep Tissue 360+P /
Table Work qcb+K, Ascendant dp+P anti-air, Retrograde qcf+K low slide, LPLK
throw; NOTE Table Work's lore "side-switch" dropped to cosmetic — engine
teleport+grab combo untested, stayed on proven grab plumbing), registered in
index.ts, roster.ts (playable:FALSE until sheet packs), frames-manifest.mjs
(`always` line pins wardrobe + suppresses zodiac glyphs to Ascendant only,
GOLD never green — 62 cells, no projectile/companion cells since he has
neither), gen-audio.mjs (announcer BODHI! + voiceLines 6/6/4, Harry voice
freeman-style calm settings). **SPRITE SHEET DONE 2026-07-04** — 62 frames
generated + packed to public/assets/sprites/bodhi/{sheet.png,meta.json},
playable:true, tsc clean. QA re-rolls done (targeted `--cells`): 37/38/39
(cmk/chk crouch cells) had parka-hem phantom-legs + a headless torso —
fixed by rewriting those poses (deep-squat framing, "hem is NOT a leg",
"one head with beanie") AND deleting the poisoned chk-active anchor so it
regened clean before the cells that anchor to it; 48 (deep-tissue-active)
had a SECOND BODY (clone) from "hoisting an unseen opponent" — fixed by
rewriting to mime the grab through empty air ("COMPLETELY ALONE, no
clone"). LESSON for remaining chars: grab/throw actives must say "empty
air / no second person", and low crouch cells need explicit "parka/skirt
hem is not a leg" + head-visible guards. NOTE hit Gemini monthly spend cap
mid-QA (429 RESOURCE_EXHAUSTED); user raised it. **BODHI 100% COMPLETE
2026-07-04** — all 7 pipeline steps done: sheet+meta, portrait+ko, 4
fatality panels (`full-realignment`, added to gen-fatality.mjs FATALITIES;
QA: panel-4 "GOLD star-chart disc" rendered the literal word GOLD on a coin
→ reworded to "amber zodiac ephemeris wheel, NO text/letters/coin" + re-ran
just that panel), announcer BODHI! + 16 voice clips (6/6/4). tsc clean. He
is the finished reference implementation — the first Wave 2 fighter fully
shipped. LESSON banked: fatality/effect prompts must avoid ALL-CAPS color
words next to nouns (renders as text) — same class of bug as bodhi's
canonical "AMBER". Next: repeat for cat(parallel session)/chebel/earl/
haidai/rapha/vanessa/ygor (Tubs +
Little-Martians + Suave-creatures + jaguar = separate assist/projectile
cells, Jazzper pattern). Select-screen already auto-sizes to ROSTER length
(SelectScene.ts:22) so >8 grid is handled; BootScene loads sheets for all
ROSTER ids (missing sheet = Phaser loaderror, non-fatal, capsule fallback).
VO checklist gaps still to backfill before gen-audio for cat/chebel/earl/
rapha/ygor (short of 6/6/4).

**State (2026-07-04, Sprint 20 SHIPPED — uncommitted, awaiting the user's
go-ahead; next sprint not yet cut):** 8/8
fighters playable with fatalities, 20 stages, full music loop, settings +
controls pages, CPU + training + attract modes, VS screen, win-quote screen.
Sprint 19 committed + pushed in `a27fa90`. **Sprint 20 (personality
specials + Burn One) is fully implemented in the working tree** — 130/130
vitest, tsc clean, all four new primitives verified live in the browser.
Touched: `src/engine/{types,step}.ts`, `src/engine/engine.test.ts`, all 7
new-move `src/data/characters/*.json`, `tools/{frames-manifest,
gen-fatality}.mjs`, `docs/{CHARACTERS,MOVES}.md`, regenerated sheets under
`public/assets/sprites/<char>/` + `public/assets/fatalities/flo/burn-one-*`.
- **Next action:** user reviews + commits Sprint 20, then cut the next
  sprint from the near-term roadmap (top candidates per the feel review:
  proximity guard/blocking feel, per-move hurtbox overrides, CPU difficulty
  levels, round intros/victory poses).
- **Where the Sprint 20 code landed:** (1) mash input — `SpecialInput.mash:
  N`, `mashedStrength()` counts press edges across the whole input buffer,
  final press must be this tick; CpuDriver ignores mash specials (filters
  on `input.motion`). (2) melee rehit — `MoveDef.rehit` + `Action.
  lastHitFrame`; the hasHit skip in resolveAttacks becomes conditional.
  Rehit hits land while the victim is still reeling → they scale as one
  combo and re-chip through block. (3) pull projectile — after applyHit in
  updateProjectiles: if `p.pull` and the victim ISN'T in blockstun, snap
  their x to owner ± 85 (stage-clamped), zero vx; the knockdown launch then
  drops them at the owner's feet. (4) float — `f.floatGravity` replaces
  def.gravity in the 'air'/'airAttack' physics only (never airHit), cleared
  at every FLOOR_Y touchdown and in applyHit. If a future move wants float
  VARIANTS, note VariantPatch has no `float` field yet. (5) Vincent's
  teleport cells are CRIMSON (green FX would chroma-key away — same lesson
  as the old teal sigil-bolt). (6) New specials were APPENDED after `throw`
  in frames-manifest specials dicts — cells resolve by name, order is
  cosmetic, but keep appending.
- **Where the Sprint 19 code landed:**
  (1) Cancels live at the TOP of updateFighter's attack case: a buffered
  press (Sprint 18 `f.buffered`, pick resolved at press time) cancels the
  current move once it has contacted (`a.hasHit` — set on hit AND block,
  never whiff) inside contact→active-end+`CANCEL_WINDOW_TICKS`(8). Chain
  legality is `chains: string[]` on the move (data, engine has zero
  per-character cases); special-cancel legality is `cancel: true` + target
  has `input` + target has no `grab`. One-fireball rule re-checked at cancel
  time. The canceled-into move advances to frame 1 the same tick (matches
  the chord-upgrade path just below it — keep them consistent).
  (2) `FighterState.comboHits` is VICTIM-side: applyHit increments it when
  the victim was already in hitstun/airHit, else sets 1; step()'s stun-decay
  loop zeroes it whenever the fighter isn't reeling (frozen reels keep it).
  Scaling: hits 1-2 full, −10%/hit, floor 30% (`scaleForCombo`, integer
  math, min 1 dmg); stun gains use the SCALED damage. Links that connect on
  the exact tick hitstun expires count as a NEW combo (victim passed through
  idle) — accepted simplification. Mash-jab strings drop midscreen after ~5
  hits from pushback; corner strings run longer. If S20 adds a renderer
  combo counter off engine state, `comboHits` is already there.
- **Where the Sprint 18 code landed:**
  (1) `FighterState.buffered` (`BufferedAction`): pick resolved at PRESS
  time (motion windows stay honest for reversals), executed in
  updateFighter's default branch before live pickAttack, TTL 8, cleared on
  execution. Capture happens in step()'s per-slot input loop, gated on
  `BUFFERABLE` set ∪ frozen, fight phase only. (2) hitstop is per-fighter
  now (`f.hitstop`): melee → both, projectiles → victim only, counter → +3
  victim side; frozen fighters skip updateFighter/facing/stun-decay/attack
  resolution entirely (a frozen attacker's active hitbox is inert);
  body-push, timer, and the pendingThrow tech countdown pause while EITHER
  side is frozen; projectiles keep flying. Non-fight phases still hard-
  freeze the whole world so the KO thunk carries into roundEnd. (3) `landing`
  is a new ActionKind — anything that switches on action kinds (bot, future
  UI) should treat it like getup; it's in the renderer's crouch-cell bucket.
  (4) `airHit` bounce: `bounced` flag on the Action; bounced airHit is
  invulnerable (isInvulnerable) or juggle loops would eat the sweep-invuln
  test; applyHit resets it on fresh launches (juggles re-arm the bounce).
  (5) Counterhit = defender in attack startup OR recovery, NOT active
  (active-frame same-tick contact stays a plain trade); flag rides the
  victim's action so the renderer state-diff sees it with zero extra
  plumbing.
- **Feel numbers now live:** HITSTOP 4/6/9/10 (was 3/5/7/8),
  COUNTER_HITSTUN_MULT 1.5, COUNTER_HITSTOP_BONUS 3, ACTION_BUFFER_TICKS 8,
  LANDING_TICKS 3, LANDING_WHIFF_TICKS 6, BOUNCE_VY 3.2. All in
  `src/engine/constants.ts` — the user's subjective feel pass may want to
  nudge these; every one is covered by a test that reads the constant, so
  retuning won't break the suite.
- **Known non-issues:** console shows pre-existing `proj-<char>` 404
  process errors for characters with no legacy projectile art — BootScene
  loads those speculatively by design, not a Sprint 18 regression. Trades
  are still slot-0-first (resolveAttacks reads live actions, so P1's hit
  interrupts P2's same-tick attack before it resolves) — pre-existing
  behavior, left alone; true simultaneous trades would need the snapshot
  the comment already claims.
NOTE: a parallel session may work this repo simultaneously — commit with
explicit paths only if that's still true when you pick this up.
**After Sprint 17:** a parallel session ran a full game-feel review (industry-
conventions audit + user fix list) and re-planned the pipeline — see the
Sprint 18/19/20 sections above and the 2026-07-03 "Sprints 18–20 planned"
changelog entry for the full reasoning. Order is now **Sprint 18 (input
buffering + hit feedback) → Sprint 19 (cancels & chains) → Sprint 20
(personality specials + Flo fatality rework)**; combo chains/cancels and
damage scaling moved OFF the generic near-term roadmap and into Sprint 19.
Near-term roadmap (now Sprint-18/19/20 leftovers): per-move hurtbox
overrides, post-stun throw protection, CPU difficulty levels, round intros/
victory poses, height normalization, post-fatality flow, attract-mode blink
cleanup, sound priority/cooldowns, clash/tech feedback, CRT toggle. Long-term
RFEs unchanged: character designer dialog, online multiplayer, arcade story
mode, Veo motion smoothing. docs/MOVES.md is the living move spec
(checkboxes = implementation state); edit it and re-run the buildout.
**DEPLOY RECIPE:** just push to main —
the `deploy` workflow builds and publishes (do NOT force-push gh-pages
anymore; that pipeline is retired and was the wedge source). If a deploy run
fails with `deployment_queued` timeouts, check for a phantom via
`gh api repos/drmbt/martian-kombat/pages/deployments/<sha>` (empty status =
limbo) and POST `<sha>/cancel`; the queue self-heals ~2h after the last
mid-deploy cancellation. Never deploy twice in quick succession. **NEW GOTCHAS:** (1) crouch /
low poses: the model copies the standing canonical's height no matter what the
text says — pass a SECOND reference image with the desired low pose (e.g. the
character's own chk-active frame) and say "copy the body height of the second
reference"; scratchpad one-off did this for Yulia's 04/07 (bake into
gen-frames when doing the next character). (2) Projectile art must not sit
near the key color — Vincent's teal rune died on green screen; use
`extra.projectileKey` + a magenta screen for cool-colored projectiles.
(3) Renderer resolves cells BY NAME from meta.json with fallback chains
(FightScene.attackCells) — new sheets can add cells freely; never rename old
ones. Legacy-art fallback means new buttons LOOK samey on vincent/catherine/
kirby until their v2 sheets are generated (frames-manifest `layout:'v2'` +
`moves6` is the pattern — Yulia is the template).

Live at https://drmbt.github.io/martian-kombat/
(repo public per user; NOTE: `assets/character-inspo/` photos of real
people are therefore public too — flag to the user if that ever needs
revisiting).
**Gotchas:** `.env` in repo root (gitignored), all
four keys live. Frame-gen: ALWAYS `gemini-3-pro-image`; keying: `chromakey`
~0.15, never despill (bleaches Yulia's bandana/hair); transparent sheet PNGs
look navy in previews — composite over grey before judging keying. Cell order
in `tools/frames-manifest.mjs` is a contract with `FightScene.actionToCell` —
append only. Character JSONs cast through `unknown` (no runtime validation).
Stun `Action.frame` counts DOWN; attack/knockdown/getup count UP (and `dazed`
now counts UP to DIZZY_TICKS). Universal throws exist (LP+LK, `techable`
grab); command grabs untouched. Preview-browser tabs throttle
rAF — step the loop via `window.__game.loop.step(t)` when verifying headless.
