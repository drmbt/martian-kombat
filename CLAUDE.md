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
  scenes/        # Phaser scenes: Boot, Menu, Select, Versus, Fight, Settings, VolumeOverlay
  ai/            # CpuDriver — CPU opponent (tick-hash decisions, motion-input queue)
  audio/         # music playback (context folders) + volume math
  input/         # touch controls (on-screen pad)
  data/
    characters/  # one JSON per character (frame data, moves, asset refs)
    stages.ts    # stage registry — the game's stage index
  ui/            # health bars, timers, combo counters
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
   (Veo motion clips + still sampling is the post-MVP smoothness upgrade.)
3. **Key + pack** — `tools/pack-sheet.mjs`: ffmpeg colorkey/despill, scale to
   288×384 cells, tile into `public/assets/sprites/<name>/sheet.png` + meta.json.
4. **Portraits** — `tools/gen-canonical.mjs` crops a head-and-shoulders portrait
   (`public/assets/portraits/<name>.png`) from the canonical, AND generates a
   beaten-and-bloodied *defeated* bust (`<name>-ko.png`, chroma-keyed) that the
   post-match win-quote screen shows for the loser. Both are idempotent/`--force`.
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
   grunts/taunts, and hit SFX. Music tracks (Suno, generated outside the repo
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

Every character needs, alongside frame data: a `winQuotes: string[]` array in
their JSON (SFII-style victory taunts — the win screen picks one at random), a
`<name>-ko.png` defeated portrait (produced by `gen-canonical.mjs`), and a
`fatality` block + generated panels (step 7). Missing any degrades gracefully
(generic "..." quote; greyed normal portrait; no fatality offered).

Pipeline rules: scripts must be idempotent and resumable (skip files that exist,
`--force` to regen). Raw output goes to `assets/raw/` (gitignored); only packed,
game-ready files land in `public/assets/` (committed). Log prompts used into a
sidecar `.prompt.txt` next to each generated asset so results are reproducible.

Concurrency: `gen-frames.mjs`, `gen-audio.mjs`, and `gen-fatality.mjs` fan their
API calls out through `pool()` in `tools/lib.mjs` (`--concurrency N`; default
6 frames / 4 audio / 4 fatality panels). A
v2 character's ~50–60 cells are independent, so this is ~5× faster than serial
(measured: Freeman 56 frames in ~220s vs ~20 min). `gen-frames` still generates
the low-pose anchor cell (`chk/sweep-active`) FIRST, then pools the rest, so
legacy anchored crouch cells stay correct — keep that two-phase order if you
touch it. Failures log-and-skip (resumable), they never abort the batch. The
real ceiling is the provider's image rate limit, not the code: if you push
`--concurrency` up and start seeing 429s, add retry/backoff before going wider
(no backoff today). ffmpeg packing stays serial (local, cheap).

## Commands

```
npm run dev        # Vite dev server
npm run build      # production build
npm run test       # vitest — engine unit tests (determinism, hitboxes, frame data)
npm run gen:styletest              # style candidates + stage tests
npm run gen:frames -- --char vincent   # pose keyframes (add --concurrency N)
npm run gen:pack -- --char vincent     # key + pack -> sheet.png + meta.json
npm run gen:stages -- --stage van      # 21:9 pixel-art stage (--force, --concurrency N)
npm run gen:audio                      # announcer + grunts + sfx (--concurrency N)
npm run gen:fatality -- --char vincent # 4 cutscene panels (--concurrency N)
npm run gen:music                      # rescan music folders -> manifest.json
```

All gen scripts are idempotent (skip existing files; `--force` regens,
`--all` for every character). `gen:frames` and `gen-audio` run concurrently
(`--concurrency N`, default 6 / 4).

## The roster

All eight fighters are fully built and playable, each with a six-button kit,
named motion-input specials, and a fatality (photos in `assets/character-inspo/`,
full move-set design in `docs/CHARACTERS.md`): Catherine (bo staff + chef, dog
Jazzper assist), Flo (angry German hacker, spliff smoke), Freeman
(yogi/meditator), Gene (AI-startup hacker, genAI glitch moves), Kirby (acrobatic
fire-breathing contortionist), Marzipan (dreadlocked vegan biologist), Vincent
(tai chi + digital wizardry, black cloak), Yulia (tall Russian yogi). More
characters come later — which is why characters are data files, not code.

## Conventions

- TypeScript strict mode. No `any` in `src/engine/`.
- Commit messages: imperative, scoped — `engine: add throw teching`,
  `assets: pack kirby sprite sheet`, `tools: veo clip extraction`.
- Every engine behavior change ships with a vitest covering it.
- 60fps is a feature. If a change drops frames on a mid laptop, it doesn't merge.
