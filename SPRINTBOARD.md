# Martian Kombat — Sprintboard

> **Protocol:** This file is the single source of truth for project state and the
> agent handoff sheet. Before **every commit/push**: tick the boxes you completed,
> append a changelog entry, and update the handoff notes if work is mid-flight.
> Unchecked boxes in the active sprint = the backlog. Do not silently add scope;
> new ideas go to the Icebox.

**Current sprint: 21 (Cat) SHIPPED — roster now 12 playable (Bodhi, Chebel, Ygor added)** · MVP shipped
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
