# Asset generation checklist — new character / new stage

The **audit test** (`src/data/assets.audit.test.ts`, part of `npm run test`) is
the source of truth: it FAILS with a precise list the moment a playable fighter
or a stage is missing a class of game-ready assets. Add the data, run the
generators below, run `npm run gen:assets`, then run the tests — green means
complete. (`npm run gen:assets` rescans `public/assets/` into
`src/data/assetManifest.json` so the loader only requests files that exist — a
missing sprite never 404s and a missing mp3 never throws.)

All `gen:*` scripts are idempotent (skip existing files; `--force` regens).
Raw output lands in `assets/raw/` (gitignored); packed/game-ready files land in
`public/assets/` (committed). Prompts are logged to a `.prompt.txt` sidecar.

## New character — the seven steps

A fighter isn't "done" until **all seven** produce committed art AND the audit
test is green. Order matters (later steps consume earlier outputs).

1. **Data** — add `src/data/characters/<id>.json` (frame data, hitboxes, moves,
   `winQuotes`, a `fatality` block) and register the fighter in
   `src/data/roster.ts` (`playable: true`). Add a generator-script entry for
   the character in `tools/frames-manifest.mjs` (poses + `extra.projectiles`
   prompts) and a name + VO lines in `tools/gen-audio.mjs`.
   - Respect the **privacy opt-out** (lore sheet): never scaffold anyone marked
     "NO AI PLEASE".
2. **Canonical sheet** (once) — `npm run gen:styletest` from an inspo photo in
   `assets/character-inspo/<name>.jpg`; approve the painted-cel candidate.
3. **Pose keyframes** — `npm run gen:frames -- --char <id> --concurrency 6`.
   Crouch/lying cells need the low-pose anchor trick (pass a second low
   reference; see `tools/frames-manifest.mjs` + the memory note).
4. **Pack** — `npm run gen:pack -- --char <id>` → `public/assets/sprites/<id>/
   sheet.png` + `meta.json` (+ keyed per-move `projectile-*.png`). Inspect the
   sheet before trusting it (montage QA — headless-torso / phantom-leg /
   clone guards).
5. **Portraits** — `node tools/gen-canonical.mjs --char <id>` (no npm alias)
   → `portraits/<id>.png`, `<id>-bust.png`, and the beaten `<id>-ko.png`.
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
5. Generate the name call-out: add `'stage-<id>': 'SPOKEN NAME!'` to
   `announcerLines` in `tools/gen-audio.mjs`, then
   `npm run gen:audio --concurrency 1` (the stage-name voice is a paid
   ElevenLabs library voice; concurrency 1 avoids the 409 "already_running"
   conflict). Music is optional — drop tracks into
   `public/assets/audio/music/stages/<id>/` and run `npm run gen:music`.

Then: `npm run gen:assets && npm run test` → the stage-VO audit goes green.
