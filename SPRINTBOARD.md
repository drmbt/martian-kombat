# Martian Kombat — Sprintboard

> **Protocol:** This file is the single source of truth for project state and the
> agent handoff sheet. Before **every commit/push**: tick the boxes you completed,
> append a changelog entry, and update the handoff notes if work is mid-flight.
> Unchecked boxes in the active sprint = the backlog. Do not silently add scope;
> new ideas go to the Icebox.

**Current sprint: 1** · MVP target: two humans on one keyboard, character select
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

### Sprint 1 — Fight core (playable with placeholder boxes)
Goal: two rectangles can fight each other and it already *feels* like a fighter.
- [ ] Vite + Phaser 3 + TypeScript + vitest project scaffold, `npm run dev` works
- [ ] Deterministic fight loop: fixed 60hz tick, `(state, inputs) -> state`, zero
      Phaser imports in `src/engine/`, unit tests prove same inputs → same state
- [ ] Input layer: keyboard mapping for P1/P2, per-tick input snapshot, input
      buffer (for specials later); gamepad stubbed
- [ ] Movement: walk, dash, jump (pre-jump frames), crouch, facing swap
- [ ] Combat: hurtboxes/hitboxes from frame data, startup/active/recovery phases,
      hitstun/blockstun, standing + crouching block, pushback, throws optional
- [ ] Health, round timer, KO detection, best-of-3 round flow, round-reset
- [ ] Debug rendering: draw boxes + frame-phase colors (toggle with F1)
- [ ] Two placeholder characters defined **as JSON frame data** (jab, heavy,
      sweep, one special each) proving the data-driven pipeline
- [ ] Fight scene renders placeholder rects/capsules; hit sparks as flashes

### Sprint 2 — Asset pipeline (photos → sprite sheets)
Goal: `npm run gen:*` turns an inspo photo into a game-ready animated fighter.
- [ ] `tools/style.md`: one shared art-style prompt (test on 2 characters, lock it)
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

- **2026-07-01 · scaffold · Sprint 0 complete** — repo initialized; CLAUDE.md,
  SPRINTBOARD.md, README.md, .gitignore, .env.example, docs/CHARACTERS.md written;
  8 inspo photos committed; pushed to GitHub. *(Claude)*

---

## Agent handoff notes

*(overwrite this section each handoff — what's mid-flight, gotchas, next action)*

**State:** Sprint 0 done, nothing mid-flight. **Next action:** start Sprint 1,
first box — Vite + Phaser + TS scaffold. **Gotchas:** `.env` lives in repo root
(gitignored) with all four keys already populated; branch is `main`; the fight
core must stay Phaser-free from the first line of code — that constraint is
cheapest enforced from commit one.
