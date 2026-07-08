# Martian Kombat — CLAUDE.md

2D versus fighting game (Street Fighter / Mortal Kombat style) featuring characters
from Mars College, an off-grid art residency near Bombay Beach, CA. All visual and
audio assets are AI-generated from real inspiration photos via scripted pipelines.

## Ground rules for agents

1. **Read `SPRINTBOARD.md` before doing anything.** It is the single source of truth
   for what's done, what's in flight, and what's next. Update its checkboxes and
   append to its changelog **before every commit**. It doubles as the agent handoff
   sheet — if you stop mid-task, write a handoff note there.
2. **Never commit `.env`** or print key values. Keys available (see `.env.example`):
   `GEMINI_API_KEY` (nano-banana image gen + Veo video), `OPENAI_API_KEY`
   (GPT Image), `ELEVENLABS_API_KEY` (SFX/voice), `FAL_KEY` (fal.ai fallback route
   for nano-banana/Veo).
3. **MVP first.** Lean, playable, ugly-is-fine beats polished-and-unfinished. Add
   plumbing (data-driven design, clean seams) so fancy comes later without rewrites.
4. **Determinism is sacred** in the fight core (see Architecture). No `Math.random()`,
   no wall-clock time, no rendering state inside `src/engine/`.

## Tech stack

- **Engine:** Phaser 3 + TypeScript + Vite. Phaser handles rendering, input,
  spritesheet animation, audio, scenes. We do **not** use Phaser arcade physics
  for combat — fighting games need frame-exact logic.
- **Fight core:** custom, in `src/engine/` — pure TypeScript, zero Phaser imports.
  Fixed timestep at 60 ticks/sec. Takes `(state, inputs) -> state`. This keeps it
  unit-testable and leaves the door open for rollback netcode later.
- **Character definitions are data, not code:** each character is a JSON file in
  `src/data/characters/` (frame data, hitboxes, move lists, sprite references).
  Adding a character must never require touching engine code.
- **Asset pipeline:** Node scripts in `tools/`, run via `npm run gen:*`. See below.

## Directory layout

```
src/
  engine/        # deterministic fight core: state, physics, hitboxes, inputs, frame data
  scenes/        # Phaser scenes: Boot, Menu, Select, Versus, Fight, Settings, Controls, VolumeOverlay
  ai/            # CpuDriver — CPU opponent (tick-hash decisions, motion-input queue)
  audio/         # music playback (context folders) + volume math
  input/         # keyboard.ts: fight input, keyboard+gamepad OR-merged, press-to-bind
                 # via settings.ts; menu-nav.ts: shared gamepad poller for menu/UI
                 # navigation (title, select, settings, pause, win screen) — no
                 # on-screen touch controls (removed 2026-07-02, mouse covers menus)
  data/
    characters/  # one JSON per character (frame data, moves, asset refs)
    stages.ts    # stage registry — the game's stage index
tools/           # asset generation scripts (Node, hit the APIs in .env)
assets/
  character-inspo/  # source photos of real people (committed, the ground truth)
  raw/              # gen intermediates: veo clips, frame dumps (GITIGNORED)
public/assets/
  sprites/       # packed sprite sheets + JSON atlases (committed)
  backgrounds/   # stage art (committed)
  audio/         # sfx, voice, music (committed)
docs/            # design docs, CHARACTERS.md roster bible
```

## Asset generation pipeline

The pipeline turns a photo of a real person into a game-ready sprite sheet:

1. **Canonical character sheet** — `tools/gen-style-test.mjs` (nano-banana,
   `gemini-3-pro-image`): `assets/character-inspo/<name>.jpg` + the locked style
   prompt (`tools/style.md`, approved 2026-07-01: painted cel) → stylized
   full-body fighter on chroma green. Approved canon lives in
   `assets/raw/style-tests/char-*-b-painted.png`.
2. **Pose keyframes** — `tools/gen-frames.mjs` (`gemini-3-pro-image`, never
   flash): canonical sheet + pose prompts from `tools/frames-manifest.mjs`.
   Legacy chars: 23 cells; v2 chars (`layout:'v2'`, `moves6`): 50 cells for
   the six-button layout. Cells are resolved BY NAME from meta.json in
   `FightScene` (with legacy fallbacks) — add cells freely, never rename.
   GOTCHA: for crouch/lying poses the model copies the standing canonical's
   height regardless of prompt text — pass a second low-pose reference image
   and instruct "copy the body height of the second reference".
   **Specials generate SEQUENTIALLY, projectile-first, each phase referencing
   the earlier phases + projectile + inspo; projectiles reference ONLY inspo
   images, never the canonical (it drags the character in); all FX must be
   keyable (violet/silver/blue/gold, never green).**
   (Veo motion clips + still sampling is the post-MVP smoothness upgrade.)
2b. **QA the raw frames BEFORE packing** — `npm run gen:qa -- --char <name>
   --frames-dir assets/raw/frames/<name>` runs deterministic DWPose/alpha
   validation (edge-bleed on native frames, floor plane, extra-limb, per-group
   pose rules) and MEASURES hitboxes from the skeleton. Fix flagged cells with a
   targeted `--cells` re-roll, then pack. **Never QA the packed sheet** (scaling
   hides edge bleed). Vision is a last resort: one batched montage of only the
   failing cells. Full canon in the **`sprite-qa` skill** — invoke it for any
   sprite gen/validation/hitbox/portrait work. `gen:qa` (+ `pack --normalize`)
   need a Python with `rtmlib`/onnxruntime; the resolver (`tools/qa/run.mjs` /
   `resolve-python.mjs`) auto-picks 3.11–3.13. If a too-new bare `python3` (e.g.
   Homebrew 3.14, no wheels) breaks it, set `MK_PYTHON=/path/to/python`.
3. **Key + pack** — `tools/pack-sheet.mjs`: ffmpeg colorkey/despill, scale to
   288×384 cells, tile into `public/assets/sprites/<name>/sheet.png` + meta.json.
   Pass `--normalize` to floor-align every cell (median grounded sole → origin
   plane) so all fighters share one plane, and bake the QA skeleton keypoints
   (`meta.skeletons`, body+hands+feet) shifted to match. The pack `SCALE_PAD` MUST
   stay identical to `pose_qa.py`'s cell scale/pad (HEADROOM) or keypoints/hitboxes
   misregister.
   For release-quality keying of effect-heavy sprites (flames/smoke/glow),
   `npm run gen:key -- --char <name>` runs the CorridorKey neural keyer —
   self-bootstrapping (clones/installs the sibling repo, MLX weights on Apple
   Silicon) and batches all raw frames → `assets/raw/keyed/<name>/`; then pack
   with `--keyer corridor`. ffmpeg stays the fast iteration default; see
   `docs/CORRIDORKEY.md`.
4. **Portraits** — the straight-on selector icon (`<name>.png`) is generated by
   `tools/gen-icons.mjs` (`gemini-3-pro-image`). The head-and-shoulders **bust**
   (`<name>-bust.png`) is a POSE-CENTERED crop of the canonical —
   `tools/qa/portrait_crop.py --all` frames every bust off the head keypoints
   (fixed eye-line, consistent scale) so the roster matches; never a fixed crop
   box, and it must NOT overwrite the straight-on `<name>.png`. `gen-canonical.mjs`
   also makes the beaten-and-bloodied *defeated* bust (`<name>-ko.png`, chroma-
   keyed) the post-match win-quote screen shows for the loser. Idempotent/`--force`.
5. **Stages** — `tools/gen-stage.mjs` (`npm run gen:stages`, `gemini-3-pro-image`).
   Adding a stage is a three-touch job: (a) drop reference photos in
   `assets/stage-inspo/<FOLDER>/` — the folder name, lowercased with spaces→dashes,
   becomes the stage id; (b) add a scene line to the `SCENES` dict inside the
   script; (c) register the stage in the `STAGES` array in `src/data/stages.ts` —
   that array is the game's stage index (BootScene preloads from it, the
   stage-select dialog lists it; the dialog grid auto-sizes to any count).
   **Locked stage look (approved 2026-07-02): gritty 16-bit retro pixel-art**
   anchored on `assets/stage-inspo/style-ref-salton.jpg`, which the script
   passes as the FIRST reference image for every stage — don't drift back to
   cel-shade, and keep the "redraw as pixel art" language for photo-heavy refs.
   **Always 21:9**, packed via ffmpeg cover-crop to a 1680×720 jpg in
   `public/assets/backgrounds/stages/<id>.jpg` (committed; raw gen in
   `assets/raw/stages/`). **Floor contract:** the bottom quarter of every stage
   is a continuous, textured, walkable ground plane running edge-to-edge and
   touching the bottom of the frame — no blank bands, no props/people in the
   fighter strip (the `STAGE_STYLE` prompt in the script enforces this; keep it
   intact). Stages generate concurrently (`--concurrency N`, default 4).
   GPT Image (`gpt-image-2`) remains the route for non-stage stills (UI art).
6. **Audio** — ElevenLabs for announcer VO ("ROUND ONE… FIGHT!"), per-character
   grunts/taunts, and hit SFX. When a real voice sample exists, clone the actual
   person's voice instead: drop clips in `assets/voice-inspo/<name>/` (see its
   README; the lore sheet's **privacy opt-out column applies**), run
   `npm run gen:voice -- --char <name>` (Fish Audio, `FISH_API_KEY`; registers
   a private model id in `tools/voices.json`), and `gen:audio` automatically
   routes that fighter's kiai/hurt/victory VO through the clone (announcer +
   stage call-outs always stay ElevenLabs). Music tracks (Suno, generated outside the repo
   scripts) drop into `public/assets/audio/music/<context>/` (`menu/`,
   `versus/`, `victory/`, `stages/<id>/` + `stages/default/` fallback);
   `npm run gen:music` rescans folders into `manifest.json` (runs automatically
   via predev/prebuild).
7. **Fatality panels** — `tools/gen-fatality.mjs` (`gemini-3-pro-image`, 16:9):
   4 full-bleed cutscene panels per character from the canonical + a generic
   burnt-husk victim, scaled to 1280×720 into
   `public/assets/fatalities/<name>/<fatality-id>-<n>.jpg` (committed). Panel
   prompts live in the script's `FATALITIES` dict; the matching `fatality` block
   in the character JSON (`id`, `name`, `input`, `panels`) wires the FINISH THEM
   trigger. **A full asset-generation run for a new character is all seven steps**
   — a fighter isn't "done" until their fatality panels exist too.
8. **Impact VFX** — `tools/gen-vfx.mjs` (`npm run gen:vfx`, `gemini-3-pro-image`
   on a MAGENTA screen, chroma-keyed): (a) greyscale generic hit sparks in
   `public/assets/vfx/` (spark-hit / spark-heavy / spark-block), tinted the
   attacker's color at runtime — these are global, not per-character; and
   (b) per-move overlay art that lives with the move like projectiles do —
   `public/assets/sprites/<char>/vfx-<moveId>.png`, wired by an optional
   render-only `vfx: {size, anchor: 'impact'|'ground'}` block on the move in
   the character JSON (prompts in the script's `PER_MOVE` dict). FightScene
   plays them by state-diffing in `presentTick`; missing art falls back to the
   generic spark, then to a plain flash.

Every character needs, alongside frame data: a `winQuotes: string[]` array in
their JSON (SFII-style victory taunts — the win screen picks one at random), a
`<name>-ko.png` defeated portrait (produced by `gen-canonical.mjs`), and a
`fatality` block + generated panels (step 7). Missing any degrades gracefully
(generic "..." quote; greyed normal portrait; no fatality offered).

**Practical command checklist** for generating a whole new character or stage
lives in `docs/ASSET_CHECKLIST.md`. Two guardrails keep the boot clean and the
roster honest: (1) `src/data/assets.audit.test.ts` (in `npm run test`) FAILS
with a precise list when a playable fighter or a stage is missing a class of
game-ready assets; (2) `npm run gen:assets`
(`tools/gen-asset-manifest.mjs`, auto-run on predev/prebuild) rescans
`public/assets/` into `src/data/assetManifest.json` so the loader only ever
requests files that exist — a missing sprite never 404s, a missing mp3 never
throws. Run both after any asset generation.

Pipeline rules: scripts must be idempotent and resumable (skip files that exist,
`--force` to regen). Raw output goes to `assets/raw/` (gitignored); only packed,
game-ready files land in `public/assets/` (committed). Log prompts used into a
sidecar `.prompt.txt` next to each generated asset so results are reproducible.

Concurrency: `gen-frames.mjs`, `gen-audio.mjs`, and `gen-fatality.mjs` fan their
API calls out through `pool()` in `tools/lib.mjs` (`--concurrency N`; default
6 frames / 4 audio / 4 fatality panels). A
v2 character's shared cells + normals are independent, so this is ~5× faster
than serial (measured: Freeman 56 frames in ~220s vs ~20 min). `gen-frames`
order: (1) low-pose anchor cell (`chk/sweep-active`) FIRST so legacy anchored
crouch cells stay correct, (2) shared cells + normals POOLED concurrently,
(3) named specials SEQUENTIALLY (projectile-first, phases cross-referencing) —
keep this three-phase order if you touch it. Failures log-and-skip (resumable), they never abort the batch. The
real ceiling is the provider's image rate limit, not the code: if you push
`--concurrency` up and start seeing 429s, add retry/backoff before going wider
(no backoff today). ffmpeg packing stays serial (local, cheap).

## Commands

```
npm run dev        # Vite dev server
npm run build      # production build
npm run test       # vitest — engine unit tests (determinism, hitboxes, frame data)
npm run gen:styletest              # style candidates + stage tests
npm run gen:frames -- --char vincent   # pose keyframes (--concurrency N, --cells a,b)
npm run gen:qa -- --char vincent --frames-dir assets/raw/frames/vincent  # DWPose/alpha QA (pre-pack)
npm run gen:pack -- --char vincent     # key + pack -> sheet.png + meta.json (--normalize)
npm run gen:busts                      # pose-centered bust crops -> <id>-bust.png (resolved python)
npm run gen:stages -- --stage van      # 21:9 pixel-art stage (--force, --concurrency N)
npm run gen:audio                      # announcer + grunts + sfx (--concurrency N)
npm run gen:fatality -- --char vincent # 4 cutscene panels (--concurrency N)
npm run gen:vfx                        # impact sparks + per-move overlays (--concurrency N)
npm run gen:music                      # rescan music folders -> manifest.json
npm run gen:key -- --char vincent      # CorridorKey neural re-key -> assets/raw/keyed/ (--setup-only, --backend, --force)
npm run gen:voice -- --char gene       # Fish Audio voice clone from assets/voice-inspo/<name>/ (--say "test", --list)
```

All gen scripts are idempotent (skip existing files; `--force` regens,
`--all` for every character). `gen:frames` and `gen-audio` run concurrently
(`--concurrency N`, default 6 / 4).

## Lore source — the Martian Lore sheet

The public **Martian Lore** Google Sheet is the canonical source of lore for
future characters and stages — reference it whenever designing a new fighter,
stage, win quotes, or VO:
<https://docs.google.com/spreadsheets/d/1C8Kr5BJAopZXzsWJTcOvaySBvmEcQqPJgyXZ76Uohgo/>
The **Mars People** tab maps each Martian to discord handle, caption, bio,
lore, links, and media references (photo/voice-sample folders). Bios and
running jokes there should drive archetypes, move names, quotes and VO so each
fighter reads as *the actual person*, not a generic trope.
**HARD RULE: respect the "privacy opt out" column.** Anyone marked
"NO AI PLEASE" (as of 2026-07: Maya Luna, Peter, Roarke, Summer) must never be
scaffolded as a fighter, generated as an asset, or referenced by name in game
content. Re-check that column before starting any new character.

## The roster

All eight fighters are fully built and playable, each with a six-button kit,
named motion-input specials, and a fatality (photos in `assets/character-inspo/`,
full move-set design in `docs/CHARACTERS.md`): Catherine (bo staff + chef, dog
Jazzper assist), Flo (angry German hacker, spliff smoke), Freeman
(yogi/meditator), Gene (AI-startup hacker, genAI glitch moves), Kirby (acrobatic
fire-breathing contortionist), Marzipan (dreadlocked vegan biologist), Vincent
(tai chi + digital wizardry, black cloak), Yulia (tall Russian yogi). More
characters come later — which is why characters are data files, not code.

Each character JSON carries an optional `stage: "<id>"` **home-stage** field
(the stage-select dialog badges it; arcade mode will end there). A home stage
whose art doesn't exist yet fails gracefully (falls back to RANDOM/default), so
it's fine to assign a fighter a stage before that stage is generated.

## Dev-mode front-end editor (BUILT — Sprints 23 & 25; dev-only)

All of this is **dev-only**: registered/reachable only under `import.meta.env.DEV`
via the title's `7 · DEV EDITOR` item → `EditorMenuScene`, and it writes to disk
through a **Vite dev-server middleware plugin** (`editorApi()` in `vite.config.ts`,
`apply:'serve'`) whose `/__editor/*` POST endpoints are compiled OUT of the prod
build. That middleware is the shared backbone the future character creator reuses.

Built tools (see SPRINTBOARD Sprint 25 for detail):
- **Stage Pin editor** — place each stage's pin on the select-screen world map
  (`/__editor/stage-pins`).
- **Move Tuner** (`src/ui/MoveTunerPanel.ts`) — 2 fighters in a training sandbox;
  per-slot Manual / CPU (low/med/high, `src/ai/difficulty.ts`) / Loop-a-move;
  live frame-data + hitbox inspector; WRITE → character JSON (`/__editor/character`).
- **Sprite Editor** (`src/ui/SpriteEditorPanel.ts` + `spriteSheetModel.ts`) —
  sprite grid (select/reorder/clipboard), per-cell scale/normalize/offset, regen
  keypoints (live DWPose, `/__editor/skeleton-regen`), regen a frame via
  nano-banana (`/__editor/gen-frame`), draggable hitbox + skeleton joints,
  auto-hitbox from the skeleton, floor line + soft silhouette box. WRITE composites
  the sheet → `/__editor/sheet` (timestamped backup before overwrite).
- **2D skeleton overlay (F3)** — DWPose keypoints are baked into `meta.skeletons`
  at pack time and replayed live over the sprite (no runtime inference). Debug
  hotkeys are unified 2D↔3D: **F1 hitboxes · F2 move log · F3 skeleton · F5 stage guide**.

**Character `scale`** (`src/data/characterScale.ts`, was `spriteScale`): one
uniform multiplier that resizes EVERYTHING about a fighter's size + reach — art
(via `hurtStand.h`), hurtboxes, hitboxes, joints, projectiles, grab range — about
the feet origin. Baked at load by `applyScale`; live-edited by `setCharacterScale`
(re-bakes in place from a cached base). **Two scales exist and differ**: the
collision `scale` vs the render scale `hurtStand.h*1.32/CELL_H`. Anything drawn
over the ART (skeleton, auto-hitbox, soft box) uses the RENDER scale; collision
boxes use `scale`. Do not conflate them.

**Coordinate contract** (bit us repeatedly, see Sprint 25): `pack-sheet.mjs`'s
`SCALE_PAD` MUST equal `pose_qa.py`'s `load_raw_cells` scale/pad (`HEADROOM=24`),
or baked keypoints/hitboxes silently misregister with the packed art. `FLOOR_FRAC`
(0.88) MUST match across `normalize_floor.py`, `pose_qa.py`, `FightScene.ts`,
`SelectScene.ts`. Normalize to `FLOOR_FRAC` OR hand-tune `spriteOffsetY` — never
both (the roster is mid-migration: only vincent & gene are normalized).

Still pending (SPRINTBOARD): the **character-creator skeleton** (name,
bring-or-generate art, voice cloning, bio+move-list prompt, sprite gen with
per-frame re-rolls) that wraps the 7-step pipeline. Do not expose any dev-editor
UI in the shipped build.

## Conventions

- TypeScript strict mode. No `any` in `src/engine/`.
- Commit messages: imperative, scoped — `engine: add throw teching`,
  `assets: pack kirby sprite sheet`, `tools: veo clip extraction`.
- Every engine behavior change ships with a vitest covering it.
- 60fps is a feature. If a change drops frames on a mid laptop, it doesn't merge.
- Character sprite work is codified as invokable skills in `.claude/skills/`:
  **sprite-generation** (pose-prompt craft), **sprite-qa** (deterministic
  DWPose/alpha validation), **move-authoring** (kit design + the archetype→
  plumbing catalog — the source of truth for which move mechanics are buildable),
  **new-character** (end-to-end orchestrator), and **hit-spark-generator**
  (single-pass NxN VFX grids + the anti-samey playback spec). Invoke them for
  that work.
