# Martian Kombat — CLAUDE.md

2D versus fighting game (Street Fighter / Mortal Kombat style) featuring characters
from Mars College, an off-grid art residency near Bombay Beach, CA. All visual and
audio assets are AI-generated from real inspiration photos via scripted pipelines.
Live at <https://martiankombat.com>. (`AGENTS.md` is a symlink to this file.)

## Ground rules for agents

1. **Read `SPRINTBOARD.md` first** (short true status + standing landmines),
   then the backlog **`docs/handoff/02-PLAN.md`** (§0 protocol, §1 status, the
   phase you're on, the newest Handoff-log entries). Tick the backlog
   checkboxes and update the handoff notes **in the same commit as the work;
   git log is the changelog.** If you stop mid-task, leave a handoff note.
2. **Never commit `.env`** or print key values. Key NAMES (see `.env.example`):
   generation — `GEMINI_API_KEY` (nano-banana images + Veo), `OPENAI_API_KEY`
   (GPT Image), `ELEVENLABS_API_KEY` (SFX/announcer/stock voices),
   `FISH_API_KEY` (cloned voices), `FAL_KEY` (unused fallback), `CORRIDORKEY_DIR`;
   deploy/R2 — `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `R2_BUCKET`,
   `R2_RAW_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`;
   runtime — `VITE_ASSET_BASE` (not secret; only wired on `feat/3d-mode`).
3. **No paid generation without approval** — any Gemini / OpenAI / ElevenLabs /
   Fish call needs a go-ahead with an estimated call count (02-PLAN D6). **No R2
   writes** (`npm run raw:push`) until 02-PLAN P8.17 makes it no-clobber.
4. **MVP first.** Lean, playable, ugly-is-fine beats polished-and-unfinished. Add
   plumbing (data-driven design, clean seams) so fancy comes later without rewrites.
5. **Determinism is sacred** in the fight core: no `Math.random()`, no wall-clock
   time, no Phaser/DOM/rendering state, no `any` inside `src/engine/`.
6. **Branches:** never push to `main` (it auto-deploys) or force-push. One branch
   + PR per sprint; test on its Workers preview; the user merges. `docs/DEPLOY.md`.

## Tech stack

- **Engine:** Phaser 3 + TypeScript (strict) + Vite. Phaser handles rendering,
  input, spritesheet animation, audio, scenes — **not** arcade physics.
- **Fight core** (`src/engine/`): pure TypeScript, fixed 60 ticks/sec,
  `(state, inputs) -> state`. Unit-tested, and the base of the shipped
  **rollback netcode** (`src/session/NetSession.ts`, GGPO-style, over
  WebRTC/PeerJS in `src/net/`).
- **Characters are data, not code:** one JSON per fighter in
  `src/data/characters/` (frame data, hitboxes, moves, VO texts, sprite refs).
  Adding a character must never require touching engine code.
- **3D renderer** (`src/renderer3d/`, `FightScene3D`, three.js): frozen —
  reachable only in dev or with `?3d=1` (02-PLAN D5/P11).
- **Hosting:** Cloudflare Workers Static Assets, built by Workers Builds from
  `main`, per-branch previews; private R2 mirror for gitignored raws.
- **Asset pipeline:** Node (+ Python QA) scripts in `tools/`, run via `npm run gen:*`.

## Directory layout

```
src/
  engine/        # deterministic fight core: state, physics, hitboxes, inputs, frame data
  session/       # FightSession (local) + NetSession (rollback) behind one Session API
  net/           # WebRTC/PeerJS transport, lobby, rematch
  scenes/        # Boot, AssetHost (persistent loader), Menu, Select, Versus, Fight,
                 # Fight3D, Dance, Lobby, Settings, Controls, VolumeOverlay; dev-only:
                 # EditorMenu, StagePinEditor, StudioSelect, CharacterCreator (legacy)
  presentation/  # pure event/HUD/banner/move-log/sound logic shared by 2D + 3D
  ui/            # DOM chrome (HUD, pause, win, fatality) + dev panels (Studio)
  render/        # coords.json + geometry.ts — the ONE cell↔world transform
  renderer3d/    # frozen three.js renderer
  ai/            # CpuDriver — CPU opponent (tick-hash decisions, motion-input queue)
  audio/         # music playback (context folders) + volume math
  input/         # keyboard+gamepad fight input + rebinding; gamepad menu nav; no touch
  data/          # characters/*.json, roster.ts, stages.ts (stage index),
                 # assetManifest.json (generated), assetUrl.ts, unlocks.ts
  bench/         # MKS-1 frame-data lab, standards, audit, CI ratchet, parity
    reference/   # bench-only ported references (KFM) — never in ROSTER
  compat/mugen/  # MUGEN / IKEMEN GO parsers (DEF/CNS/CMD/AIR/SFF/stage) + porter
tools/           # gen-*.mjs asset generators, lib.mjs (API helpers, pool, backoff)
  core/          # shared: packer, prompts, cells, kit grammar, coords, jobs, VO emotion
  qa/            # Python DWPose/alpha QA, floor normalize, portrait crops
  fg/            # fighting-game CLIs: bench, mugen:fetch/import/sprites, playtest video
  vfx/           # single-pass VFX grid generator + canonizers
assets/
  character-inspo/ stage-inspo/ voice-inspo/   # source photos/voice (committed)
  raw/           # gen intermediates (GITIGNORED; private R2 mirror, docs/RAW_ASSET_STORE.md)
public/assets/   # game-ready, committed: sprites/ backgrounds/ portraits/ audio/
                 # fatalities/ vfx/ ui/ (3d/ is excluded from the deploy)
docs/            # design docs; docs/handoff/ = plan + session prompts; docs/archive/ = history
                 # (incl. SPEC.md — code comments cite its ids as `SPEC Vnn/Tnn`)
```

## Asset pipeline (pointers)

Photo → canonical → pose keyframes → QA → key + pack → portraits → VO → fatality
panels (→ optional VFX); stages are a separate generator + outpaint. The full
step-by-step reference (models, gotchas, concurrency, backoff) is
**`docs/TOOLS.md`**; the command checklist for a new fighter or stage is
**`docs/ASSET_CHECKLIST.md`**. Invoke the skills for that work (see Conventions).
Hard rules that live here:

- Scripts are idempotent and resumable: they skip any asset that already
  SHIPS in `public/` (`shippedState`, `tools/lib.mjs`); `--force` regens. Raw
  output goes to `assets/raw/` (gitignored); only game-ready files land in
  `public/assets/`. Log each prompt to a `.prompt.txt` sidecar.
- Image gen uses `gemini-3-pro-image` (never flash). Stages keep the locked
  16-bit pixel-art look and the floor contract; character art keeps the locked
  painted-cel style (`tools/style.md`). FX must be keyable (never green).
- QA raw frames BEFORE packing (`gen:qa`), never the packed sheet. There is ONE
  packer (`tools/core/packer.mjs`); Sprite-Editor overlays in
  `assets/raw/edits/<id>/` survive re-packs; `.cellspace` frame dirs
  (vincent/earl/ben) are already keyed — never re-key or re-pad them.
- **Coordinate contract:** every render constant lives once in
  `src/render/coords.json` (accessors `src/render/coords.ts`,
  `tools/core/coords.mjs`, `tools/qa/coords.py`) and the cell↔world transform
  once in `src/render/geometry.ts`. Never re-declare FLOOR_FRAC / cell dims /
  HEADROOM / the 1.32 art margin. Collision `scale` ≠ render scale — see
  `docs/CHARACTER_STUDIO.md`.
- After any asset change: `npm run gen:assets` (rescans `public/assets/` →
  `src/data/assetManifest.json`) and `npm run test` (the asset audit in
  `src/data/assets.audit.test.ts` fails with a precise list of what a playable
  fighter or stage is missing).

## Lazy asset loading — invariants

Boot loads only the light menu set; fighter sheets, VO, stage backgrounds and
fatality panels stream on demand through `src/scenes/assetLoader.ts`
(`AssetLoader.fighter/fighterVO/stage/fatality`, one persistent
`AssetHostScene` loader, every file settles). The queues
(`src/scenes/assetQueue.ts`) are data-driven from `ROSTER` + character JSON, so
**adding a character needs zero loader code.** Detail: `docs/TOOLS.md`.

- Any scene or UI that shows a fighter sprite, plays VO, or draws a stage must
  `await AssetLoader.*` (or add a `preload()` barrier). FightScene's
  `preload()` is the hard barrier for every entry path.
- VO is requested ONLY for playable-roster ids (a 404'd mp3 throws an uncaught
  EncodingError); a missing PNG is harmless.
- Only call `AssetLoader.retainOnly` (eviction) where nothing on screen still
  shows the evicted textures.
- Every media URL carries a content version (`assetUrl()` in
  `src/data/assetUrl.ts`, hashes from `gen-asset-manifest`) because
  `public/_headers` caches media `immutable` — **any new code that loads a
  file from `public/assets/` must wrap its path in `assetUrl()`**, or a
  regenerated file stays stale for a year.

## Commands

```
npm run dev / build / preview      # Vite (predev/prebuild regenerate music + asset manifests)
npm run test / typecheck           # vitest (engine, asset audit, MKS-1 ratchet, KFM parity) / tsc
npm run bench [-- --char <id>]     # MKS-1 audit (--md, --parity kfm, --update-baseline)
npm run gen:assets / gen:music     # rescan public/assets/ / music folders -> manifests
npm run gen:frames|gen:qa|gen:pack|gen:key -- --char <id>   # sprites (see docs/TOOLS.md)
npm run gen:busts | gen:stages | gen:outpaint | gen:worldmap | gen:audio | gen:voice
npm run gen:fatality | gen:vfx | gen:mesh | gen:styletest
node tools/gen-canonical.mjs --char <id>   # canonical sheet (regen anchor) + KO bust
npm run studio:run                 # Character Studio auto-pilot DAG (CLI)
npm run mugen:fetch | mugen:import | mugen:sprites   # MUGEN reference content (gitignored raws)
npm run raw:pull | raw:verify | raw:status | raw:manifest   # private R2 mirror (raw:push/snapshot: see rule 3)
npm run playtest:video -- --stage <id>   # fixed vs scrolling camera comparison video
```

Paid-API generators (`gen:frames/stages/outpaint/worldmap/audio/voice/fatality/
vfx/styletest`, `gen-canonical`, `studio:run`) need approval first (rule 3);
`gen:qa/pack/busts/key/mesh/assets/music` are local.

## Lore, roster, stages

- **Lore source:** the public **Martian Lore** Google Sheet
  (<https://docs.google.com/spreadsheets/d/1C8Kr5BJAopZXzsWJTcOvaySBvmEcQqPJgyXZ76Uohgo/>,
  **Mars People** tab) drives archetypes, move names, quotes and VO so each
  fighter reads as *the actual person*. (The former privacy opt-out rule was
  retired by Vincent on 2026-07-08 — no opt-out check is needed.)
- **Roster:** 18 playable fighters in `src/data/roster.ts`, each with the full
  standard the asset audit + schema lint enforce (six-button kit, chains/
  cancels/variants, motion specials + techable throw, fatality, win quotes,
  KO portrait, `vo` block, `arcade` story block). Design bible:
  `docs/CHARACTERS.md`.
- **Kung Fu Man (secret unlock):** MUGEN's reference fighter with real
  Elecbyte art, **CC BY-NC — the game must stay non-commercial while he
  ships.** `secret: true`, not `playable`, always LAST in `ROSTER` (online
  sends grid indices). `src/data/characters/kfm.json` is **generated** — never
  hand-edit it; edit `src/bench/reference/kfm.unlock.json` and run
  `npm run mugen:sprites`. Raw MUGEN content stays out of git and R2.
- **Stages:** 27, registered in `STAGES` (`src/data/stages.ts`, the stage
  index). Every fight uses the SF2 pan-only scrolling camera over 3.5:1 art
  (`public/assets/backgrounds/stages-wide/`). A character's `stage` field is
  its home stage (a missing one falls back gracefully).
- **Arcade canon** (mode unbuilt, 02-PLAN P10.1; every JSON already carries
  `arcade: { motivation, ending }`): the ladder runs through the Off Grid world
  of Mars College into Bombay Beach, fighting each Martian, then **RJ** (Tao's
  hench goon, the Sagat analog), then **Tao Ruspoli**, the end boss (Bison
  analog; Biennale co-founder), to become **Champion of the Bombay Beach
  Biennale**.

## Dev tooling (dev-only)

The title's `7 · DEV EDITOR` (dev builds only) opens the stage-pin editor and
the **Character Studio** (roster manager + WYSIWYG creator, sprite editor, move
tuner, stages, test — all over the live fight scene), writing to disk through
the `editorApi()` Vite middleware in `vite.config.ts`. **Never expose
dev-editor UI in the shipped build:** everything is `apply:'serve'` +
`import.meta.env.DEV`. Restart the dev server after `vite.config.ts` edits.
Reference: `docs/CHARACTER_STUDIO.md`. Debug hotkeys (2D and 3D): F1 hitboxes ·
F2 move log · F3 skeleton · F5 stage guide.

## Fighting-game standards — MKS-1

Benchmarked against M.U.G.E.N / IKEMEN GO via Kung Fu Man, ported at 100%
measured parity. Write-up `docs/FIGHTING_STANDARDS.md`; generated tables
`docs/FRAME_DATA.md`; skills **fighting-game-standards** + **mugen-import**.
- **Measure, never read** — frame data is what `step()` does (`src/bench/`).
  Measured startup = `startup + 1`; on hit = `hitstun − active − recovery`;
  on block = `blockstun − active − recovery`.
- **Bench gate:** any change to a move's frame data, hitbox or damage, or a
  fighter's movement → `npm run bench -- --char <id>` before committing.
  `npm run test` ratchets MKS-1 errors (`src/bench/baseline.json`; after a fix,
  `npm run bench -- --update-baseline` in the same commit) and keeps the KFM
  port at 100% parity (an engine-semantics change fails it by name).
- Optional per-move MUGEN-parity fields: `hitstop` (N or [attacker, victim]),
  `chip`, `blockKnockback`.

## Conventions

- TypeScript strict mode. No `any` in `src/engine/`.
- Commit messages: imperative, scoped — `engine: add throw teching`,
  `assets: pack kirby sprite sheet`, `tools: veo clip extraction`.
- Every engine behavior change ships with a vitest covering it.
- 60fps is a feature. If a change drops frames on a mid laptop, it doesn't merge.
- Skills in `.claude/skills/` (also `.agents/skills/`): **sprite-generation**
  (pose-prompt craft), **sprite-qa** (DWPose/alpha QA, hitboxes, portraits),
  **move-authoring** (kit design + the archetype→plumbing catalog),
  **new-character** (end-to-end orchestrator), **hit-spark-generator** (VFX
  grids + playback spec), **fighting-game-standards** (MKS-1, the bench) and
  **mugen-import**. Invoke them for that work.
