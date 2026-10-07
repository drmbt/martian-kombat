# Asset generation checklist — new character / new stage

The **audit test** (`src/data/assets.audit.test.ts`, part of `npm run test`) is
the source of truth: it FAILS with a precise list the moment a playable fighter
or a stage is missing a class of game-ready assets. Add the data, run the
generators below, run `npm run gen:assets`, then run the tests — green means
complete. (`npm run gen:assets` rescans `public/assets/` into
`src/data/assetManifest.json` so the loader only requests files that exist — a
missing sprite never 404s and a missing mp3 never throws.)

**Loading is automatic — no wiring step.** The game lazy-loads assets on demand
(boot stays small; sheets/VO/stages/fatality panels stream select → versus →
fight via `src/scenes/assetLoader.ts`). The queue helpers are data-driven off
`ROSTER` + the character JSON, so a fighter registered `playable: true` with its
assets on disk is picked up with **zero loader code** — the same for characters
made through Claude Code or shipped from the frontend Character Studio. You only
touch the loader if you add a NEW asset *class* or a new UI surface that shows a
fighter/stage (then it must `await AssetLoader.*`). See `docs/TOOLS.md` →
"Lazy asset loading" (and the invariants in CLAUDE.md).

All `gen:*` scripts are idempotent (skip existing files; `--force` regens).
Raw output lands in `assets/raw/` (gitignored); packed/game-ready files land in
`public/assets/` (committed). Prompts are logged to a `.prompt.txt` sidecar.

## New character — the seven steps

**Ask first:** the canonical, frames, icon, audio and fatality generators call
paid APIs (QA, pack and busts are local) — get the user's go-ahead with an estimated call count (02-PLAN D6). `npm run studio:run
-- --char <id> --mock` dry-runs the whole DAG at $0 and prints that estimate.
The Character Studio (`7 · DEV EDITOR`, dev builds) runs the same steps with a
live preview.

A fighter isn't "done" until **all seven** produce committed art AND the audit
test is green (optional VFX is an eighth, unaudited step). Order matters (later steps consume earlier outputs).

1. **Data** — add `src/data/characters/<id>.json` (frame data, hitboxes, moves,
   `winQuotes`, a `fatality` block) and register the fighter in
   `src/data/roster.ts` (`playable: true` — do this LAST, once the assets
   exist, or the audit fails early). Include the `vo` block (6 kiai / 6 hurt /
   4 victory line texts, the durable source) and an `arcade` block. Add a
   generator-script entry in `tools/frames-manifest.mjs` (poses +
   `extra.projectiles` prompts) and mirror the name + VO texts into
   `tools/gen-audio.mjs` (its CLI still reads its own tables until 02-PLAN
   P8.6). Then `npm run bench -- --char <id>`: zero new MKS-1 errors.
2. **Canonical sheet** (once) — `node tools/gen-canonical.mjs --char <id>`
   (add the fighter's inspo/face entry in the script) from
   `assets/character-inspo/<name>.jpg` → `assets/raw/canonical/<id>.png`;
   approve it before anything downstream uses it.
3. **Pose keyframes** — `npm run gen:frames -- --char <id> --concurrency 6`.
   Crouch/lying cells need the low-pose anchor trick (pass a second low
   reference; see `tools/frames-manifest.mjs` + the sprite-generation skill).
   Then QA the RAW frames: `npm run gen:qa -- --char <id> --frames-dir
   assets/raw/frames/<id>` (sprite-qa skill) and re-roll flagged `--cells`.
4. **Pack** — `npm run gen:pack -- --char <id> --normalize` → `public/assets/sprites/<id>/
   sheet.png` + `meta.json` (+ keyed per-move `projectile-*.png`). Inspect the
   sheet before trusting it (montage QA — headless-torso / phantom-leg /
   clone guards).
5. **Portraits** — `node tools/gen-icons.mjs --char <id>` → the straight-on
   `portraits/<id>.png`; `npm run gen:busts` → the pose-centered
   `<id>-bust.png`; `gen-canonical` (step 2) also writes the beaten
   `<id>-ko.png`.
6. **Audio** — `npm run gen:audio -- --char <id> --concurrency 3`: the name
   call-out + 6 kiai / 6 hurt / 4 victory lines (the exact counts the loader
   and the audit expect). A per-move call-out is opt-in: set `voice: true` on
   the move + a `moves: { <moveId>: 'text' }` entry in gen-audio.
7. **Fatality panels** — `npm run gen:fatality -- --char <id>` → 4 cutscene
   panels under `public/assets/fatalities/<id>/<fatality-id>-<n>.jpg`.

Optional (not audited, gated by the manifest): per-move impact VFX
(`npm run gen:vfx`), per-move projectile art (part of `gen:frames`), a baked 3D
mesh (`npm run gen:mesh`, sets `mesh3d: true`).

Then: `npm run gen:assets && npm run test` → the audit for `<id>` goes green.

## New stage — three touches + the VO

1. Drop reference photos in `assets/stage-inspo/<FOLDER>/` (folder name,
   lowercased, spaces→dashes, becomes the stage id).
2. Add a scene line to the `SCENES` dict in `tools/gen-stage.mjs`.
3. Register the stage in the `STAGES` array in `src/data/stages.ts`.
4. Generate the art: `npm run gen:stages -- --stage <id>` (21:9 pixel-art,
   packed to `public/assets/backgrounds/stages/<id>.jpg`).
4b. Widen it for the scrolling camera: add a `DESC` entry (look / scene /
   sides — written after LOOKING at the art) to `tools/stages-wide.mjs`, run
   `npm run gen:outpaint -- --stage <id>`, review
   `assets/raw/stages-wide/<id>/try1-sides.wide.jpg`, re-roll bad sides with
   `--try 2 --from left=1` (or `right=1`), then `--ship --try N`. The
   wide-art audit fails until `public/assets/backgrounds/stages-wide/<id>.jpg`
   exists.
5. Generate the name call-out: add `'stage-<id>': 'SPOKEN NAME!'` to
   `announcerLines` in `tools/gen-audio.mjs`, then
   `npm run gen:audio --concurrency 1` (the stage-name voice is a paid
   ElevenLabs library voice; concurrency 1 avoids the 409 "already_running"
   conflict). Music is optional — drop tracks into
   `public/assets/audio/music/stages/<id>/` and run `npm run gen:music`.

Then: `npm run gen:assets && npm run test` → the stage-VO audit goes green.
