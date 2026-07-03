# Martian Kombat — Sprintboard

> **Protocol:** This file is the single source of truth for project state and the
> agent handoff sheet. Before **every commit/push**: tick the boxes you completed,
> append a changelog entry, and update the handoff notes if work is mid-flight.
> Unchecked boxes in the active sprint = the backlog. Do not silently add scope;
> new ideas go to the Icebox.

**Current sprint: 4** · MVP target: two humans on one keyboard, character select
(≥2 fully-built fighters), best-of-3 rounds, health bars + timer, basic + special
moves, AI-generated sprites/stage/audio.

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
- [ ] Playtest with 2+ humans, fix top-5 feel complaints ← **needs humans**
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
- [ ] Remaining roster frame QA (user does per-character passes like Yulia's)
- [ ] v2 sheets + native art for Vincent, Catherine, Kirby

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
- [ ] Deferred: rage meter + ENOUGH., armored/vault dashes, backdash
      i-frames, charge + mash motions (first users: Freeman, Flo, Kirby)

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
- [ ] In-browser TRAINING-mode verification (blocked: Chrome extension not
      connected in this session)

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
- [ ] Balance pass on Freeman's normals (currently flo's numbers) + counter/armor
      mechanics (Presence teleport-behind, Breathwork hit-absorb) if the engine
      grows buff/counter support — approximated with invuln for MVP.

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
- [ ] Regenerate kirby's KO/defeated bust (`portraits/kirby-ko.png`) from the new
      canonical — still the old tea-era art (cosmetic; win-screen loser portrait).

### Icebox (post-MVP, do not start)
Remaining roster (Gene, Marzipan) · new characters · single-player
arcade mode + CPU opponent · super meter/EX moves · stage interactables ·
rollback netplay (engine determinism already paid for) · training mode · fatalities
("Kombat" earns it) · music generation · mobile/touch · per-character victory
song: a `victorySong` attribute in the character JSON names a track in
`music/victory/` that overrides the random pick when that fighter wins.

---

## Changelog

*(newest first; add one entry per commit: date · scope · what changed · by whom/agent)*

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

**State:** Sprint 12 — post-match win-quote screen shipped (winner taunts a
beaten loser portrait + random win quote; `FightScene.showWinScreen`, engine
untouched). `winQuotes[]` on all 5 playable JSONs; `<id>-ko.png` defeated busts
generated for all 8 via `gen-canonical.mjs`. When building Freeman/Gene/Marzipan,
their `winQuotes` are already authored in docs/CHARACTERS.md (copy into the JSON)
and their KO portraits already exist. Sprint 11 — Flo is PLAYABLE (assets +
engine plumbing + flo.json + rm -rf / fatality; roster 5/8). Next action: in-browser TRAINING verification of Flo (was blocked on the Chrome extension), then Freeman/Gene/Marzipan via the same recipe (their kits need: Freeman charge b,f — trivial 'bf' exists — plus counter-stance + hit-absorb armor; Gene teleport + slow-field). NOTE: `assets/raw/` was wiped and partially regenerated — only flo's canonical exists; regen others via `node tools/gen-canonical.mjs --char <id>` before any frame work on them. docs/MOVES.md is the living move spec (checkboxes = implementation state); edit it and re-run the buildout. Three QA-ready characters: vincent, yulia, catherine. **DEPLOY RECIPE CHANGED:** just push to main —
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

MVP live at https://drmbt.github.io/martian-kombat/
(repo now public per user; NOTE: `assets/character-inspo/` photos of real
people are therefore public too — flag to the user if that ever needs
revisiting). Only unchecked box: human playtest. Redeploy recipe: `npm run
build && cd dist && git init -q && git checkout -qb gh-pages && git add -A &&
git commit -qm deploy && git push -f
https://github.com/drmbt/martian-kombat.git gh-pages:gh-pages && cd .. && rm
-rf dist/.git`. **Next (post-MVP, pick from Icebox):** remaining roster
(Flo/Freeman/Gene/Marzipan — canonical art already exists, just needs
manifest flavors + JSONs + grunts), motion inputs, throws, CPU opponent.
**Gotchas:** `.env` in repo root (gitignored), all
four keys live. Frame-gen: ALWAYS `gemini-3-pro-image`; keying: `chromakey`
~0.15, never despill (bleaches Yulia's bandana/hair); transparent sheet PNGs
look navy in previews — composite over grey before judging keying. Cell order
in `tools/frames-manifest.mjs` is a contract with `FightScene.actionToCell` —
append only. Character JSONs cast through `unknown` (no runtime validation).
Stun `Action.frame` counts DOWN; attack/knockdown/getup count UP. Chip damage
and throws intentionally absent until Sprint 4. Preview-browser tabs throttle
rAF — step the loop via `window.__game.loop.step(t)` when verifying headless.
