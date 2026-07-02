# Martian Kombat — Sprintboard

> **Protocol:** This file is the single source of truth for project state and the
> agent handoff sheet. Before **every commit/push**: tick the boxes you completed,
> append a changelog entry, and update the handoff notes if work is mid-flight.
> Unchecked boxes in the active sprint = the backlog. Do not silently add scope;
> new ideas go to the Icebox.

**Current sprint: 2** · MVP target: two humans on one keyboard, character select
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

### Sprint 2 — Asset pipeline (photos → sprite sheets)
Goal: `npm run gen:*` turns an inspo photo into a game-ready animated fighter.
- [x] Style test samples generated (`tools/gen-style-test.mjs`): 3 art styles ×
      Vincent/Yulia (gemini-3-pro-image) + 4 stage tests (2 from user's
      `assets/stage-inspo/` refs; salton-shoreline via gpt-image-2) —
      **awaiting user style approval before pipeline build-out**
- [ ] `tools/style.md`: lock the approved art-style prompt
- [ ] `gen-character-sheet.mjs`: inspo photo → stylized turnaround (nano-banana)
- [ ] `gen-motion.mjs`: character sheet + move prompt → Veo clip (FAL fallback)
- [ ] `clip-to-sheet.mjs`: ffmpeg frame extraction → bg removal → trim → packed
      sheet + JSON atlas in `public/assets/sprites/<name>/`
- [ ] Prompt sidecar logging (`.prompt.txt`) + idempotent/`--force` behavior
- [ ] Full sprite sets for **Vincent** and **Yulia** (idle, walk, jump, crouch,
      jab, heavy, sweep, special, block, hit, KO) wired into the fight scene
- [ ] One stage background (GPT Image): Bombay Beach / Salton Sea sunset

### Sprint 3 — Real characters, sound, presentation
Goal: it looks and sounds like a real (janky, charming) fighting game.
- [ ] Vincent + Yulia fully tuned: frame data pass, specials with motion inputs
      (quarter-circle etc.) via the input buffer
- [ ] ElevenLabs: announcer pack (character names, "ROUND ONE", "FIGHT!", "K.O.")
- [ ] ElevenLabs/SFX: hit, block, whiff, jump sounds; per-character grunt + taunt
- [ ] Character select screen (portraits from GPT Image; all 8 shown, 2 playable)
- [ ] Main menu + results screen; full game loop menu→select→fight→results→menu
- [ ] HUD polish: portraits on health bars, round pips, combo counter

### Sprint 4 — MVP ship
Goal: itch.io-able build; roster pipeline proven repeatable.
- [ ] Third + fourth fighters (Catherine w/ Jazzper assist, Kirby fire breath) to
      prove the pipeline scales to weirder move sets
- [ ] Gamepad support finished
- [ ] Balance/feel pass: damage values, chip damage, throw range, timer
- [ ] Playtest with 2+ humans, fix top-5 feel complaints
- [ ] `npm run build` deployed (GitHub Pages or itch.io) — **MVP SHIPPED**

### Icebox (post-MVP, do not start)
Remaining roster (Flo, Freeman, Gene, Marzipan) · new characters · single-player
arcade mode + CPU opponent · super meter/EX moves · stage variety + interactables ·
rollback netplay (engine determinism already paid for) · training mode · fatalities
("Kombat" earns it) · music generation · mobile/touch.

---

## Changelog

*(newest first; add one entry per commit: date · scope · what changed · by whom/agent)*

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

**State:** Sprint 1 done, nothing mid-flight. Game is playable: `npm run dev`,
P1 WASD+F/G/H, P2 arrows+K/L/;, F1 toggles hitbox view. **Next action:** Sprint 2,
first box — write `tools/style.md` (the shared art-style prompt) and test it on
two characters via nano-banana before building the rest of the pipeline.
**Gotchas:** `.env` in repo root (gitignored) has all four keys populated.
Character JSONs cast through `unknown` in `src/data/characters/index.ts` (JSON
imports widen literal types) — runtime schema validation is an Icebox item, so
a typo'd `height` field fails silently; be careful hand-editing frame data.
Stun `Action.frame` counts DOWN; attack/knockdown/getup count UP. Chip damage
and throws intentionally absent until Sprint 4.
