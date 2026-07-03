# Martian Kombat — Sprintboard

> **Protocol:** This file is the single source of truth for project state and the
> agent handoff sheet. Before **every commit/push**: tick the boxes you completed,
> append a changelog entry, and update the handoff notes if work is mid-flight.
> Unchecked boxes in the active sprint = the backlog. Do not silently add scope;
> new ideas go to the Icebox.

**Current sprint: 18 — input forgiveness + hit feedback** · MVP shipped
2026-07-02 (8/8 fighters playable, 19 stages, full music loop, fatalities,
CPU + training modes, settings). Sprint 17 (universal throws + dizzy/stun)
shipped 2026-07-03 (frames approved, sitting in the working tree). Sprints
18–20 planned 2026-07-03 from the game-feel review: input forgiveness →
cancels/chains → personality specials + Flo fatality rework. Long-term RFEs
live in their own roadmap section below.

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

### Sprint 18 — Input forgiveness + hit feedback (planned 2026-07-03)
Goal: the "special sauce" pass from the 2026-07-03 game-feel review (industry-
conventions list audited against the engine — most of it we already have; these
are the gaps). Sim stays strict, controls get forgiving, hits get legible.
All engine work; every item ships with vitest coverage.
- [ ] **Action input buffering + reversal buffer** — the #1 gap: a button
      press only registers on an actionable tick today (`freshPress` is an
      exact-tick check), so presses during recovery/hitstun/blockstun/getup/
      prejump/landing are silently dropped. Buffer presses ~6–8 ticks with a
      consumed flag (one press never fires twice); the first actionable frame
      executes the buffered action. Covers wakeup reversals + landing buffer
      in the same change.
- [ ] **Counterhits** — defender hit during their own attack's startup or
      recovery: bonus hitstun (+25–50%), +2–4 hitstop, distinct spark tint +
      sharper sound (renderer side via state-diff, like all VFX)
- [ ] **Landing recovery** — 2–4 tick generic jump landing, 4–8 ticks after
      a whiffed air normal (landing currently cancels straight to idle,
      making jumps consequence-free)
- [ ] **Per-fighter (asymmetric) hitstop** — split `GameState.hitstop` into
      per-fighter freeze counters: projectile hits freeze the VICTIM only
      (today the global freeze stops the shooter too — SF fireballs don't);
      melee keeps both frozen, trades keep the longest. Opens the attacker/
      defender asymmetry lever for counterhits and heavies.
- [ ] **Ground-impact bounce** — SF-style bounce off the floor on knockdowns
      and throws (small vy rebound + dust-puff VFX) instead of the flat stick
- [ ] Feel-tuning playtest alongside the above: consider raising base hitstop
      (L4 / M6 / H9, specials 10–12)

### Sprint 19 — Cancels & chains (planned 2026-07-03)
Goal: combos become deliberate, not accidental (moved up from the near-term
roadmap by the feel review; Sprint 18's buffering makes cancels land naturally).
- [ ] Chain rules: lights chain into lights (light→medium where a kit wants
      it) — data-driven flags on moves, not engine special cases
- [ ] Special-cancel windows: medium/heavy normals cancel into specials on
      hit or block during a cancel window
- [ ] Combo damage scaling (later hits in a combo do less)
- [ ] Engine tests: chain windows, cancel-on-hit vs -on-block vs whiff (no
      cancel), scaling math, determinism

### Sprint 20 — Personality specials + Flo fatality rework (planned 2026-07-03)
Goal: one signature "that's SO them" move per fighter + Flo's new fatality.
Asset gen front-loaded/parallel like Sprint 17; cells append-only as always.
New engine primitives called out — everything else rides existing plumbing.
- [ ] **Gene — Mana Burst**: projectile stamped with the Eden Art Labs logo
      (existing projectile primitives)
- [ ] **Marzipan — vine spear** ("get over here"): projectile that DRAGS the
      opponent to Marzipan on hit, becomes a knockdown throw if unblocked —
      NEW pull-projectile primitive
- [ ] **Yulia — spinning star kick** (Chun-Li spinning bird kick — existing
      leap/forwardVel primitives)
- [ ] **Flo — blunt smoke puff**: blows a smoke projectile (existing
      primitives)
- [ ] **Kirby — cat scratch**: mash-punch rapid attack (Chun-Li lightning
      legs) — NEW mash-motion input type, promoted from the Sprint 8
      deferred list
- [ ] **Vincent — matrix teleport**: dissolves into green digital runes,
      reappears behind the opponent — `teleport:'behind'` already exists
      (Gene's Diffusion); this is art/VFX + wiring
- [ ] **Freeman — yoga float**: Dhalsim-style high jump with slow held-pose
      descent — NEW slow-fall/float mobility primitive
- [ ] **Flo fatality replaced — "Burn One"**: lighter ignites the husk →
      grinds the ash → rolls it into a cigarette → smokes it. 4 panels via
      `gen-fatality.mjs` (replaces rm -rf /); fatality block in flo.json
      updated
- [ ] docs/CHARACTERS.md + docs/MOVES.md updated with the new moves; engine
      tests for the two new primitives

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
- [ ] **1-player arcade story mode** — ladder of CPU fights with intro/ending
      story beats per character (wants CPU difficulty levels first)
- [ ] **Veo motion smoothing** — upgrade keyframe animation to sampled
      motion-clip frames; the biggest visual-quality lever we have

### Icebox (do not start)
New characters (pipeline is proven; the roster bible has room) · super
meter/EX moves (super freeze/flash ships with them when they land) · stage
interactables · rage meter + ENOUGH., armored/vault dashes, backdash
i-frames (Sprint 8 deferred list; mash motions PROMOTED to Sprint 20 —
Kirby's cat scratch) · real counter/armor primitives (Freeman's
Presence/Breathwork upgrades) · bonus stage (car-smash homage) · gamepad
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

- **2026-07-03 · docs · Sprints 18–20 planned from the game-feel review** —
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

**State (2026-07-03, Sprint 17 SHIPPED + COMMITTED, Sprint 18 next):** 8/8
fighters playable with fatalities, 20 stages, full music loop, settings +
controls pages, CPU + training + attract modes, VS screen, win-quote screen.
**Sprint 17 (universal throws + dizzy/stun) is fully implemented, tested
(95/95 vitest, tsc + build clean), verified live in the browser, frame-
reviewed and approved by the user (two re-roll rounds + manual raw edits),
and committed** in `03ad717` (`engine+data+assets+audio: universal throws +
dizzy/stun (Sprint 17), voice-variant depth` — bundled with a parallel
session's voice-variant work, see below). **Sprint 18 (input forgiveness +
hit feedback) is fully scoped in the section above and is the next planned
sprint** — nobody has started it yet. What's on record for whoever picks
this up:
- Throw frame re-roll history, for the record: (1) prompts rewritten to
  solo-mime "reaching" poses (no opponent/clothes in frame) + a global
  FRAME_RULES rule that nothing may touch the frame edges (edge-cropped
  content shows a hard line in-game); Gene's 3 originals and all non-Kirby
  recoveries kept. (2) every `throw-active` except Gene's re-rolled again as
  an ACTIVE forward grab: arms fully extended toward the right frame edge,
  hands actively clutching the empty air, a small impact flash obscuring the
  hands (per-character flavor color). Targeted re-rolls stay cheap:
  `node tools/gen-frames.mjs --char X --cells throw-active` (force-regens
  only the named cells), then `npm run gen:pack -- --char X`.
- **Next action: Sprint 18** (see the section above for full scope: action
  input buffering + reversal buffer, counterhits, landing recovery,
  per-fighter asymmetric hitstop, ground-impact bounce, hitstop-tuning
  playtest). All engine work, every item ships with vitest coverage, no new
  art needed.
- **Where the Sprint 17 code landed:** engine — `throwChord`/`LPLK` chord + pendingThrow
  tech window + `techable` flag in step.ts/types.ts/constants.ts (constants:
  THROW_TECH_TICKS 12, THROW_TECH_PUSH 6, THROW_TECH_RECOIL 10,
  STUN_THRESHOLD 250, STUN_DECAY 0.5/tick, DIZZY_TICKS 180). `dazed` was
  REMOVED from `isInvulnerable` — deliberate, dizzied fighters must be
  punishable; the finisher-window daze is unaffected (that phase never calls
  resolveAttacks, and updateFighter never runs for the loser there, which is
  also why the dazed case's new frame-count/timeout can't end a finisher
  daze). Renderer — persistent `dizzySprites` overlay pair in FightScene
  (hidden on fatality/win-screen early-return paths — remember those if you
  add more overlays), `pendingThrow` added to TickSnapshot for the grab SFX.
- **Gotchas hit this sprint:** (1) a back-WALKING blocker legitimately
  retreats out of throw range — body push settles fighters at ~(wA+wB)/2 ≈
  80-88px apart, so throw range must clear ~88 to ever connect vs big-body
  crouchers (hence 105/115, still under every command grab's 110-150).
  (2) On tech, do NOT drop both fighters to `idle` — the victim's still-held
  chord would fire an instant counter-throw the same tick; they get a
  10-tick blockstun-shaped recoil instead. (3) Marzipan's prompts use "he"
  — the sprint brief's throw prompt said "her"; fixed in the manifest.
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
