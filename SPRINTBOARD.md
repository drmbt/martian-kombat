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

### Icebox (post-MVP, do not start)
Remaining roster (Flo, Freeman, Gene, Marzipan) · new characters · single-player
arcade mode + CPU opponent · super meter/EX moves · stage variety + interactables ·
rollback netplay (engine determinism already paid for) · training mode · fatalities
("Kombat" earns it) · music generation · mobile/touch.

---

## Changelog

*(newest first; add one entry per commit: date · scope · what changed · by whom/agent)*

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

**State:** MVP SHIPPED — live at https://drmbt.github.io/martian-kombat/
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
