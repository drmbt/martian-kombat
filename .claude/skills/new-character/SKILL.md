---
name: new-character
description: End-to-end orchestrator for adding a complete playable fighter to Martian Kombat — the ordered 7-step asset pipeline with its decision gates (privacy opt-out, lore-sheet fuzzy search for flavor, plumbing mapping, JSON-from-skeleton, roster + audit last). Use when asked to build, add, scaffold, or finish a new character. Delegates to the move-authoring, sprite-generation, and sprite-qa skills.
---

# New character — end-to-end build

**Sprint 27 note: the Character Studio is the primary front door now**
(`DEV EDITOR → CHARACTER STUDIO` → ＋NEW CHARACTER — the WYSIWYG wizard runs
the same pipeline in-browser with a live fighter preview and a completeness
gap bar). This skill remains the CLI path; both share `tools/core/`
(cells/prompts/kit/packer/coords), so the craft is identical either way.

A fighter isn't "done" until all seven asset classes exist and `assets.audit`
passes — INCLUDING the schema lint: chains/cancels/L-H variants (apply
`tools/core/kit.mjs` grammar), a techable throw (the locked 5th default
special), ≥3 winQuotes, a themed (non-placeholder) fatality, AND the
persisted `vo` block (kiai/hurt/victory line TEXTS in the character JSON) +
per-move `voiceText` for any `voice: true` move — the mp3s are runtime
artifacts, the JSON texts are the durable source (the Sprint 27 recovery
lesson). Also author the `arcade: { motivation, ending }` story block —
the SF2-style intro (why they set out) + post-credits ending for arcade
mode (a stub mode today; the canon arc runs through Mars College's Off Grid
world into Bombay Beach, past RJ the hench goon, to Tao Ruspoli the end
boss, crowning the Champion of the Bombay Beach Biennale). Steps have hard ordering dependencies and a few easy-to-forget
gates. Follow this order; delegate the deep work to the paired skills.

*(The former privacy opt-out gate was retired by Vincent on 2026-07-08 — no
opt-out check is needed anymore.)*

## Gate 1 — gather flavor from the lore sheet (fuzzy search by name)

The public Martian Lore sheet is the canon for who this person is:
`https://docs.google.com/spreadsheets/d/1C8Kr5BJAopZXzsWJTcOvaySBvmEcQqPJgyXZ76Uohgo/`

Fuzzy-search the WHOLE document for the character's name and pull every hit into
context (bio, caption, running jokes, links, media refs) — these drive the
archetype, move names, win quotes, and VO so the fighter reads as the real
person, not a trope. Workflow:

- Fetch the CSV export and grep the name (case-insensitive, also try nickname /
  discord handle):
  `https://docs.google.com/spreadsheets/d/1C8Kr5BJAopZXzsWJTcOvaySBvmEcQqPJgyXZ76Uohgo/export?format=csv`
  (the **Mars People** tab is the main map; if a tab needs a specific `gid`, use
  `/gviz/tq?tqx=out:csv&gid=<GID>` or the `.../export?format=csv&gid=<GID>` form).
- Include the matching rows verbatim as flavor context.
- Cross-reference `docs/CHARACTERS.md` (roster bible) and `docs/MOVES.md`.

Use the SAME fuzzy-search-the-lore-sheet pattern when orchestrating a **stage**
prompt (search the location/scene name; combine with `assets/stage-inspo/`).

## Step order

1. **Canonical sheet** — `gen-style-test` / place the approved
   `assets/raw/canonical/<id>.png`. Locked style: `tools/style.md` (painted cel).
2. **Author the JSON** — `src/data/characters/<id>.json`, driven by the
   **move-authoring** skill: pick a template, map every special to REAL plumbing
   (never author an unbuilt mechanic), estimate hitboxes from the canonical POSE
   SKELETON. Register the import in `src/data/characters/index.ts`. Add the
   character's poses to `tools/frames-manifest.mjs` (`moves6`, `extra.projectiles`,
   `extra.specialRefs`) using the **sprite-generation** skill's prompt craft.
3. **Generate frames** — `gen:frames --char <id>` (sequential specials,
   projectile-first, FX kept keyable).
4. **QA the raw frames** — **sprite-qa** skill: `gen:qa --frames-dir ...` BEFORE
   packing; fix flagged cells with targeted `--cells` re-rolls; snap active-cell
   hitboxes to the pose-measured values.
5. **Pack** — `gen:pack --char <id> --normalize` (floor-aligned).
6. **Portraits** — `gen-icons --char <id>` for the straight-on `<id>.png` selector
   icon; `tools/qa/portrait_crop.py --char <id>` for the pose-centered
   `<id>-bust.png`; `gen-canonical` for the `<id>-ko.png` defeated bust.
7. **VO** — voice-clone if a real sample exists (`gen:voice`, drop clips in
   `assets/voice-inspo/<id>/`); author lines in `gen-audio` (`announcerLines` +
   `voiceLines`: exactly 6 kiai / 6 hurt / 4 victory; cloned chars route through
   Fish automatically). Cloned lines get emotion-tagged by context×temperament
   (`tools/core/vo-emotion.mjs`); add the fighter to its `TEMPERAMENT` table and
   audition on a soundboard before baking — see `docs/VO_EMOTION.md`. Announcer
   name callout uses ElevenLabs (needs paid plan).
8. **Fatality** — panel prompts in `gen-fatality` FATALITIES + `gen:fatality`
   (4 panels). The JSON `fatality` block's `id` must match.
9. **VFX** (optional) — per-move overlays in `gen-vfx` PER_MOVE; degrades
   gracefully to generic sparks if skipped.

## Gate 2 — make it playable, LAST

Add `{ id, name, playable: true }` to `src/data/roster.ts` **only after the
assets exist** (else `assets.audit` fails early). Then:

- `npm run gen:assets` (rescan the manifest so the loader sees the new files).
- `npm run test` — `assets.audit` must go green (it lists any missing asset
  class), plus all engine tests.
- Verify in the preview: the character loads with no 404s / console errors.

**No loader wiring is needed.** Assets lazy-load on demand (boot stays small;
sheets/VO/stages/fatality stream via `src/scenes/assetLoader.ts`, keyed off
`ROSTER` playable + the character JSON). Registering the fighter `playable: true`
with its assets on disk is the whole contract — the sheet streams on select
highlight, VO on lock-in, the fatality during the fight. Just confirm in the
preview that highlighting the new fighter shows its animated idle (not a stuck
head-portrait), and that a full match renders their sprite + plays their VO. See
CLAUDE.md → "Lazy asset loading — the load contract".

## Home stage

Each JSON may carry `stage:"<id>"` (badged on select, arcade ends there). A home
stage whose art doesn't exist yet degrades gracefully — fine to assign before the
stage is generated.
