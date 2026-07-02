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
  scenes/        # Phaser scenes: Boot, Menu, CharacterSelect, Fight, Results
  data/
    characters/  # one JSON per character (frame data, moves, asset refs)
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

1. **Canonical character sheet** — `tools/gen-character-sheet.mjs`: nano-banana
   (Gemini image API) takes `assets/character-inspo/<name>.jpg` + a style prompt and
   produces a stylized full-body turnaround in the game's shared art style
   (defined once in `tools/style.md` so all characters match).
2. **Motion clips** — `tools/gen-motion.mjs`: Veo (via Gemini API or FAL fallback)
   animates the canonical sheet per move ("idle stance", "roundhouse kick", …),
   locked camera, side view, flat background.
3. **Frames → sheet** — `tools/clip-to-sheet.mjs`: ffmpeg extracts stills,
   background is keyed/removed, frames are trimmed + packed into a sprite sheet
   with a JSON atlas in `public/assets/sprites/<name>/`.
4. **Stills** — GPT Image (OpenAI) for stage backgrounds, UI, portraits, logo.
5. **Audio** — ElevenLabs for announcer VO ("ROUND ONE… FIGHT!"), per-character
   grunts/taunts, and hit SFX.

Pipeline rules: scripts must be idempotent and resumable (skip files that exist,
`--force` to regen). Raw output goes to `assets/raw/` (gitignored); only packed,
game-ready files land in `public/assets/` (committed). Log prompts used into a
sidecar `.prompt.txt` next to each generated asset so results are reproducible.

## Commands

```
npm run dev        # Vite dev server
npm run build      # production build
npm run test       # vitest — engine unit tests (determinism, hitboxes, frame data)
npm run gen:sheet -- --char vincent    # character sheet from inspo photo
npm run gen:motion -- --char vincent --move idle
npm run gen:pack -- --char vincent    # clips -> sprite sheet + atlas
```

(Scripts land in Sprint 2; keep this section updated as they materialize.)

## The roster

Eight fighters at MVP (photos in `assets/character-inspo/`), full move-set design
in `docs/CHARACTERS.md`: Catherine (bo staff + chef, dog Jazzper assist),
Flo (angry German hacker, spliff smoke), Freeman (yogi/meditator), Gene (AI-startup
hacker, genAI glitch moves), Kirby (flexible yogi, tea sipper, fire breath),
Marzipan (dreadlocked vegan biologist), Vincent (tai chi + digital wizardry, black
cloak), Yulia (tall Russian yogi, rage mechanics). More characters come later —
which is why characters are data files, not code.

## Conventions

- TypeScript strict mode. No `any` in `src/engine/`.
- Commit messages: imperative, scoped — `engine: add throw teching`,
  `assets: pack kirby sprite sheet`, `tools: veo clip extraction`.
- Every engine behavior change ships with a vitest covering it.
- 60fps is a feature. If a change drops frames on a mid laptop, it doesn't merge.
