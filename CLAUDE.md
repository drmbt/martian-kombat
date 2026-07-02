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

1. **Canonical character sheet** — `tools/gen-canonical.mjs --char <name>`
   (`gemini-3-pro-image`): `assets/character-inspo/<name>.jpg` + the locked
   style prompt (`tools/style.md`, approved 2026-07-01: painted cel) + the
   character's FLAVOR entry → stylized full-body fighter on chroma green in
   `assets/raw/canonical/<name>.png`. (Vincent/Yulia originally reused
   style-test canon from `gen-style-test.mjs`.) `assets/raw/` is gitignored —
   canonicals may be gone on a fresh checkout; regen before any frame work.
   CHROMA RULE: character effects/props must never be green or teal (they die
   in the key) — use amber/orange/red/violet; cool-colored projectile art goes
   on a magenta screen with `extra.projectiles.<id>.key = '0xFF00FF'`.
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
4. **Stills** — GPT Image (`gpt-image-2`) for stage backgrounds, UI, portraits.
5. **Audio** — ElevenLabs for announcer VO ("ROUND ONE… FIGHT!"), per-character
   grunts/taunts, and hit SFX.

Pipeline rules: scripts must be idempotent and resumable (skip files that exist,
`--force` to regen). Raw output goes to `assets/raw/` (gitignored); only packed,
game-ready files land in `public/assets/` (committed). Log prompts used into a
sidecar `.prompt.txt` next to each generated asset so results are reproducible.

### New-fighter checklist (proven on Flo, 2026-07-02)

1. `npm run gen:canonical -- --char <id>` → QA the image (chroma rule above)
2. Add the character to `tools/frames-manifest.mjs` (`layout:'v2'`, `moves6`,
   per-character `always` invariant, `extra.projectiles` prompts)
3. `npm run gen:frames -- --char <id>` → QA via contact sheet → delete bad
   cells → rerun (pass 2 low-anchors the crouch family to `chk-active`).
   Stubborn low cells: add the geometric rule "the ENTIRE figure occupies
   ONLY the BOTTOM HALF of the frame" — anatomy adjectives alone lose
4. `npm run gen:pack -- --char <id>` → composite sheet over grey to QA keying
5. Grunts in `tools/gen-audio.mjs` (pick a voice; per-grunt style/stability
   overrides supported), fatality panels in `tools/gen-fatality.mjs`
6. `src/data/characters/<id>.json` + register in `characters/index.ts` +
   flip `playable` in `data/roster.ts`. GOTCHA: declare longer-motion
   specials BEFORE shorter ones sharing a button class (every hcf input
   contains a valid qcf tail; declaration order is the tiebreaker)
7. New kit mechanics go in the engine as data-driven flags on
   MoveDef/ProjectileDef (never hardcode a character) + a vitest each

## Commands

```
npm run dev        # Vite dev server
npm run build      # production build
npm run test       # vitest — engine unit tests (determinism, hitboxes, frame data)
npm run gen:styletest              # style candidates + stage tests
npm run gen:canonical -- --char flo    # inspo photo -> canonical sheet + portrait
npm run gen:frames -- --char vincent   # pose keyframes from canonical sheet
npm run gen:pack -- --char vincent     # key + pack -> sheet.png + meta.json
npm run gen:audio                  # announcer/grunts/sfx (additive, skips existing)
npm run gen:fatality -- --char flo     # 16:9 fatality cutscene panels
npm run gen:stages                 # stage-inspo folders -> 21:9 stage art
```

All gen scripts are idempotent (skip existing files; `--force` regens,
`--all` for every character).

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
