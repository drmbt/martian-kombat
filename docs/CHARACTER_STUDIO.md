# Character Studio — unification plan

> **Status:** PLAN (Sprint 27 proposal, 2026-07-08). This document is the result of a
> full audit of the Character Creator, Sprite Editor, Move Tuner, the tools/QA
> pipeline, and the character data/asset tree. It defines the target architecture
> for a single unified "Character Studio" that creates, tunes, imports, exports,
> and upgrades complete characters — and the phased build plan to get there.
> Supersedes the tool-consolidation items left open in Sprint 25/26; builds on
> (does not replace) `docs/CHARACTER_CREATOR.md` §6 (R2) and §16 (context cache).

---

## Part 1 — Audit findings (the state of the world, 2026-07-08)

Sixteen fighters are playable. Three dev tools coexist as separate EditorMenu
entries (Character Creator, Move Tuner, Sprite Editor), all writing through the
`/__editor/*` Vite middleware. The creator can take a photo to a playable fighter
end-to-end, but the tools disagree with each other and with the CLI pipeline in
ways that make every character expensive to finish and risky to touch.

### 1.1 Conflicting/duplicate systems (the big five)

**C1 — Two pack paths with incompatible coordinate conventions.** *(load-bearing bug)*
`tools/pack-sheet.mjs` scales cells into a `HEADROOM = 24` safe zone (feet 24px
above the cell bottom, matching `pose_qa.py`). The creator's client-side
`composeSheet()` and the vite `FF_KEY_PAD` filter (`vite.config.ts:28`) pad feet
to the *bottom edge* — no headroom — despite a comment claiming they match
pack-sheet. Every cell regenerated through `/__editor/gen-frame` or shipped via
the creator sits ~24px lower and slightly larger than a pipeline-packed cell.
Re-packing a creator character with `pack-sheet.mjs` shifts its art. The
creator also skips floor-normalize entirely (the SHIP stub promises it; the
lean write path doesn't do it) and papers over it with a default
`spriteOffsetY: -12`.

**C2 — Two prompt libraries.** `tools/frames-manifest.mjs` (1,765 lines of
battle-hardened pose prompts, LOW/LYING anchors, per-char `always` invariants,
projectile-first special sequencing) vs `src/ui/creatorModel.ts`
(`BASE_CELLS`/`ATTACK_CELLS`/`specialCells` — a shorter, generic re-derivation).
Canon fighters get the hand-tuned strings; creator fighters get the generic
ones. This is the single biggest quality gap between CLI-built and
creator-built fighters. Style/canonical/KO/chroma clauses are also
copy-pasted across `gen-canonical.mjs`, `gen-frames.mjs`, `gen-icons.mjs`,
`creatorModel.ts`, and `CharacterCreatorPanel.ts`.

**C3 — Half-migrated floor/offset model.** A global
`SPRITE_FOOT_OFFSET_Y = 16` (FightScene) plus per-char `spriteOffsetY` fight
the pack-time normalize. Current roster split (from meta/JSON evidence):
- floor-aligned, no offset: bodhi, cat, chebel, earl, kirby, vincent, ygor, yulia
- hand-tuned `spriteOffsetY`: ben −12 (untouched creator default), catherine −8,
  flo +2, freeman −12, gene −3, marzipan +8, rapha +2; vanessa 0 (noise)
- `meta.skeletons` baked for only 6/16 (ben, earl, gene, vanessa, vincent, yulia)
Nothing in meta.json records whether a sheet was normalized — the only
evidence is the offset field. Sprint 25's verdict stands: this must be fixed
in **one atomic pass**, and hitbox re-tunes (auto-boxes hug art tighter) are
what's been blocking the known `314/315` combo-scaling test failure.

**C4 — Constant sprawl guarded only by comments.** `FLOOR_FRAC = 0.88` in 6+
files (TS + Python, plus a bare `0.88` in CharacterCreatorPanel); the `1.32`
art-margin fudge as a bare literal in 8 places; `CELL_W/CELL_H` in 3+;
`HEADROOM` in 2 (plus the vite outlier that *should* have it, see C1);
`SPRITE_FOOT_OFFSET_Y` in 2. The cell→engine-hitbox transform
(`cellBoxToHitbox`) is hand-rolled 3–4×, and the creator's copy has already
drifted once (documented in its own comment). The skeleton overlay renderer
exists twice. `ThreeStageView.ts` has its own un-cross-referenced floor
constant tuned against the *old* 0.95 floor.

**C5 — No merge protocol / no single source of truth per character.** Move
Tuner shallow-merges `moves` into `<id>.json`; the creator's canon path
rebuilds the character wholesale (it preserves the original JSON as a base,
but a re-ship can still clobber tuner edits); the Sprite Editor writes
`sheet.png` composited from *packed* cells, never back to
`assets/raw/frames/<id>/` — so a later `gen:pack` silently destroys all
in-editor pixel edits, joint drags, and normalizes. Three skeleton stores
(meta, sheet model, creator model). The live `characterScale` base cache is
module-global and never invalidated on HMR (stale re-bake hazard).

### 1.2 Schema + asset drift

- **ben & earl** (newest, creator-scaffolded) are the only fighters with **zero
  `chains`, zero `variants`, zero `cancel`** and a generic placeholder fatality
  (`id: "finish"`, hcb+P). The creator's default-kit builder never emits the
  SF2 chain/cancel/variant grammar the other 14 have. This is the live schema
  regression — new characters ship mechanically *thinner* than old ones.
- **vanessa**: 1 win quote (roster norm is 3–6); an orphan per-move VO clip
  (`vanessa-move-teleportal.mp3`) whose move lacks `voice: true`.
- **Orphan assets** invisible to the audit test: `portraits/haidai*` (3 files,
  no character), `fatalities/flo/rm-rf-*` (superseded by burn-one),
  `sprites/catherine/projectile.png` (+ its `assetManifest.legacyProj` entry).
- **`assets.audit.test.ts` blind spots**: doesn't check `-bust.png` (BootScene
  hard-loads it), doesn't detect orphans/extras, doesn't lint JSON schema
  (a stub kit passes cleanly), doesn't validate meta shape.
- **ThreeFxSystem bug**: unconditionally loads legacy `projectile.png` for
  every fighter (404s for 15/16 every 3D match); BootScene gates this
  correctly via the manifest.
- **CLAUDE.md is stale**: says roster is 8 and the creator is "still pending."

### 1.3 Missing capabilities

- **No VFX step** in the creator (pipeline step 8) — creator fighters get no
  per-move `vfx:` overlays or spark wiring.
- **Lore is one-directional and shallow.** The design draft (Gemini) produces
  lore/quotes/VO/specials, but lore never feeds *image* prompts (no
  `always`-from-lore clause, no lore-aware fatality beats). There is no tool
  that consults the Martian Lore sheet (the `new-character` skill does it
  manually); the privacy opt-out check is prompt-side only.
- **Fatality prompt help is thin**: the canon roster's hand-authored 4-beat
  cinematics + HUSK victim token + IMAGE_SAFETY-soft-fallback craft
  (gen-fatality/gen-canonical) is not shared with the creator, which uses a
  generic template with no safety retry.
- **No reproducibility spine**: no seed capture anywhere; prompts persist in
  creator state but no unified prompt/seed manifest ships with a character;
  the §16 context cache (the token-cost lever the spec is architected around)
  is unbuilt.
- **No R2 / publish path**: spec'd in `CHARACTER_CREATOR.md` §6
  (StorageDriver, publish↑/canonize↓/load↔, env vars) but zero code exists.
- **QA cruft**: `tools/qa/` mixes load-bearing QA (pose_qa, infer_keypoints,
  normalize_floor, resolve-python) with the hit-spark grid experiment
  (vfx_grid*.py, gen-vfx-grid.mjs) and `__pycache__`; "DWPose" naming persists
  though the model is RTMPose; the python resolver probes only for rtmlib
  (an interpreter with a broken onnxruntime passes, then fails late);
  `portrait_crop.py` has no npm script or endpoint (busts silently go stale).

### 1.4 What already works and should be kept

- The `/__editor/*` middleware backbone (dev-only by construction) and mock
  mode (`MK_CREATOR_MOCK=1`) — the whole wizard is walkable at zero cost.
- The creator's draft persistence + resume (`assets/raw/creator/<id>/`),
  canon-reopen (preserving the original JSON as write-back base), ZIP
  export/import, per-panel fatality beats, per-line VO regen, Fish voice
  clone, design draft with privacy-opt-out language.
- `hitboxFromSkeleton` + `strikeKind` (genuinely shared), the keypoint
  extraction pattern (`infer_keypoints.py` imports from `pose_qa.py` — "one
  place that knows how to talk to rtmlib"), `pool()`/`skip()`/`saveAsset()`
  in `tools/lib.mjs`, the asset manifest gate, the audit test's *concept*.
- The Sprite Editor's non-destructive model + timestamped backups + the
  scale/offset bake-down ("commit to identity") mechanism.
- `docs/CHARACTER_CREATOR.md`'s R2 §6 and context-cache §16 designs — sound,
  just unbuilt.

---

## Part 2 — Target architecture: Character Studio

One dev tool. One data model. One pack path. One prompt library. One
coordinate contract. Local disk today, R2 tomorrow, via one storage seam.

### 2.1 The shape

**Character Studio** replaces the three EditorMenu entries with a single
scene: a persistent left rail of **modules** over one shared, live
**CharacterProject**:

```
IDENTITY   name · refs · lore (typed / lore-sheet fetch) · design draft · privacy gate
LOOK       canonical · portraits (icon/bust/ko) · color · stage
SPRITES    the Sprite Editor grid, embedded: cells · regen · keypoints · normalize
MOVES      kit table + the Move Tuner sandbox, embedded: frame data · hitboxes ·
           specials (archetype catalog) · projectiles · chains/variants/cancel
AUDIO      VO lines · voice clone · per-move call-outs · music · BYO
FX         per-move VFX overlays · spark wiring · fatality (beats + panels)
SHIP       readiness audit · normalize+pack · write/register · ZIP · publish (R2)
```

Move Tuner's fight sandbox and the Sprite Editor's grid don't get rewritten —
they get *mounted* as the MOVES and SPRITES modules over the shared project
(they are already panels over FightScene; the studio hosts the same panels).
The standalone EditorMenu entries survive one release as thin aliases that
open the studio at the right module, then retire.

**Two drive modes over the same job graph:**
- **Auto-pilot** ("simple mode"): name + 1–3 images (+ optional voice sample,
  stage photo, lore text) → the full pipeline runs unattended → a shippable,
  audit-green fighter. No further interaction required. Every step's output
  is recorded so it can be re-opened and dialed in manual mode afterward.
- **Manual** ("director mode"): today's wizard behavior — approval gates at
  each step, per-cell rerolls, per-panel fatality beats, per-line VO.

Auto-pilot is not a new pipeline: it is the manual pipeline with all gates
pre-approved and sane defaults, executed server-side by the job runner
(§2.4) so a closed laptop lid doesn't strand a half-generated fighter in
browser state.

### 2.2 One shared core: `tools/core/`

Plain ESM, imported by the CLI scripts, the vite middleware (which already
dynamic-imports `tools/lib.mjs`), and — for the pure-data parts — the browser.
This is the model `infer_keypoints.py` already proves out. Contents:

| module | owns | retires |
|---|---|---|
| `constants.mjs` | `FLOOR_FRAC`, `HEADROOM`, `CELL_W/H`, `ART_MARGIN` (the 1.32), `ORIGIN_FEET`, chroma colors | 6+ hand-synced copies; generates `tools/qa/constants.py` so Python reads the same values |
| `keying.mjs` | `keyPadFilter({headroom, square, stage, keyColor})` → ffmpeg vf strings | pack-sheet's inline filter, vite `FF_KEY_PAD`/`FF_KEY_PAD_SQUARE`/`FF_STAGE`, gen-icons/gen-canonical copies. **Fixes C1's filter half.** |
| `cells.mjs` | the cell contract: `CELLS`, `V2_BUTTONS`, `buildJobs()`, LOW/LYING anchors, per-char overrides — `frames-manifest.mjs` promoted | `creatorModel.ts` `BASE_CELLS`/`ATTACK_CELLS`/`specialCells`. **Fixes C2's structure half.** |
| `prompts.mjs` | `stylePrompt`, `framePrompt(pose, always)`, `canonicalPrompt`, `portraitPrompt`, `koPrompt(+soft fallback)`, `projectilePrompt`, `fatalityBeats(lore)`, `alwaysFromLore(draft)`, chroma clause | every duplicated prompt string; both rosters get the battle-hardened craft + the sprite-generation skill's antidotes. **Fixes C2's quality half.** |
| `packer.mjs` | `packSheet(cells, {normalize}) → {sheetPng, meta}` — one tiler, meta v2 writer, skeleton baking, floor normalize (single implementation; the JS `normalizeCells` twin retires or delegates) | pack-sheet's tiler, `composeSheet()`, `/__editor/sheet`'s ad-hoc write. **Fixes C1.** |
| `geometry.mjs` | `renderScale(def)`, `cellToWorld`, `cellBoxToHitbox`, `worldToCell` — THE coordinate transform, one copy | FightScene/SpriteEditor/Creator's 3–4 hand-rolled copies. **Fixes C4.** |
| `audio.mjs` | `elevenTts`, `sfxGen`, `musicGen`, voice-ID tables (beside the existing `fishTTS`) | vite's re-declared `elevenTts` + inline fetches, gen-audio's private copies |
| `kit.mjs` | default-kit builder emitting **full grammar** (chains, L/M/H variants, cancel windows, themed fatality slot) + the archetype catalog (one copy, feeding the design-draft prompt, the creator dropdown, and the move-authoring skill) | `buildFullCharacter`'s thin kit (the ben/earl regression), the 3 archetype-list copies |
| `lore.mjs` | lore-sheet fetch (public CSV export) + fuzzy match + **hard privacy-opt-out check** + `lore → always/fatality/VO` propagation | the manual skill-side lookup; makes the opt-out machine-enforced |

CLI scripts become thin wrappers over core (they keep their `npm run gen:*`
interfaces — nothing about the CLI workflow changes); vite endpoints call the
same functions. One implementation, two front doors.

### 2.3 One data model: CharacterProject + meta v2

**CharacterProject** generalizes `assets/raw/creator/<id>/` into *the* on-disk
working state for every character, canon or draft:

```
assets/projects/<id>/            (gitignored, like raw/)
  project.json     — draft state, prompts, seeds, approvals, provenance log
  frames/          — raw generated/uploaded cells (pipeline-compatible naming)
  audio/ portraits/ fatality/ stage/
```

Rules that fix C5:
- **Raw frames are the source of truth for pixels.** Every sprite-editor pixel
  edit / regen / normalize writes back to `frames/` (per-cell), not just the
  packed sheet. `sheet.png` becomes a *build artifact*: always produced by
  `packer.mjs` server-side from raw frames. `gen:pack` can no longer clobber
  editor work because they're the same path.
- **`<id>.json` writes go through one endpoint** with module-scoped merges
  (moves vs identity vs audio flags) + a provenance note in `project.json`.
  Opening a canon fighter hydrates the project *from* the repo (the creator's
  canon-reopen already does this); shipping writes back through the same
  single path.
- **meta.json v2**: adds `version: 2`, `normalized: true`, `floorFrac`,
  `headroom`, and keeps `skeletons` mandatory. Loaders keep reading v1;
  the studio and audit flag v1 sheets as "needs upgrade."
- Every generation records `{prompt, refs, seed?, model, cost}` in
  `project.json` — the reproducibility manifest the pipeline's `.prompt.txt`
  sidecars only half-provide today.

### 2.4 Job runner (the `/__editor/jobs` backbone from the spec)

A small server-side queue in the middleware: named jobs (`canonical`,
`frames:batch`, `pack`, `qa`, `audio`, `fatality`, `vfx`, `publish`) with
progress events (SSE), persistence across page reloads, per-job cost
accounting, and pooled concurrency with 429 backoff (which the pipeline still
lacks). Auto-pilot = a job DAG; manual mode = the same jobs fired one at a
time. The CLI can enqueue the same jobs (`npm run studio:run -- --char x
--auto`), so headless full-character builds stop being a hand-run 7-step
checklist.

### 2.5 One coordinate contract (the atomic migration)

End state (per Sprint 25's own verdict, now actually scheduled):
- All 16 sheets re-packed from existing raw frames via `packer.mjs` with
  normalize ON → meta v2 with skeletons for everyone. **Zero API cost** —
  raw frames already exist for the whole roster.
- `SPRITE_FOOT_OFFSET_Y` → 0 (deleted), every `spriteOffsetY` → removed from
  JSONs, the creator's `-12` default → removed.
- `ThreeStageView`'s floor constant derived from the shared constant, not
  hand-tuned.
- Auto-hitboxes proposed for the whole roster from the baked skeletons,
  reviewed in the MOVES module, then the Sprint-19 combo test updated once —
  clearing the standing `314/315` failure instead of carrying it.

### 2.6 Storage seam: local now, R2 next

Implement `CHARACTER_CREATOR.md` §6 as spec'd: a `StorageDriver` with
`LocalRepoStorage` (today's behavior: write into `public/assets` +
`src/data`) and `R2Storage` (S3-compatible; env-gated; no-ops to
`public/assets/custom/<id>/` when creds are absent so the resolve/merge/pull
path is exercised locally). SHIP grows **PUBLISH** (push bundle →
`custom/<id>/`, append to `custom-characters.json`) and the CLI grows
`npm run r2:pull -- --char <id>` (canonize ↓ into the repo, run `gen:assets`
+ audit). The prod Worker (key-proxying serverless backend) stays a later
deliverable; the seam ships now so it's a base-URL swap later.

### 2.7 Legacy upgrade: the "Adopt" flow

Open any canon fighter in the studio → it runs an **upgrade checklist** and
shows a diff before writing:
- meta v1 → v2 re-pack (+ skeletons if missing — local Python, free)
- schema lint: missing chains/variants/cancel (ben, earl), placeholder
  fatality, thin winQuotes (vanessa), orphaned per-move audio flags
- floor: `spriteOffsetY` present → normalize + zero it
- assets: missing bust / vfx / per-move art vs the manifest
Each item is fix-in-place (free) or generate (costed, shown before firing).
This is how old characters "gracefully get updated to new standards" — the
same machinery, not a separate migration script.

### 2.8 Cost discipline

- **Mock-first everywhere**: every job runs in mock mode; auto-pilot is
  E2E-testable at $0.
- **No auto-fire spends**: remove the two PROFILE auto-fire hazards (entry
  auto-batch, drop-zone auto-stage-gen); every real API call is behind an
  explicit click or the explicit auto-pilot start, with a per-step and
  total **estimated-call counter** shown before firing (a full character is
  ~70 images + ~20 TTS; the UI should say so).
- **Context cache (§16)**: per-character cached ref bundle so repeated frame
  calls stop re-uploading the canonical/refs — the spec's main token lever,
  scheduled here.
- **Seed capture** where the API supports it + prompt manifest (§2.3) so a
  reroll can be a true retry.
- **Reuse before regen**: adopt/migration passes are pack/QA-only (local);
  ben/earl kit backfill is JSON-only except their 2 themed fatality panels
  sets (~8 images total) if we choose to regenerate those.
- **429 backoff** in the shared pool (finally), so concurrency can go up
  safely instead of failing batches.

### 2.9 Reference-chaining generation strategy *(locked with the user, 2026-07-08)*

Quality comes from giving the model the **right reference images**, not from
QA-reroll loops. The shared prompt/cells library encodes this chain for both
rosters (it generalizes gen-frames' projectile-first sequencing and the
creator's jump→jump refs into one explicit policy):

1. **Canonical first, then validate before anything else.** Gate check: arms
   must NOT be extended far forward (an extended-arm canonical kills the
   horizontal variety of every punch generated from it). Same check applies
   to the crouch/jump anchors below.
2. **Crouch and jump anchors early.** Generate the crouch and jump cells
   right after the canonical and use them as the reference for their whole
   move families (crouching normals ref the crouch anchor, air normals ref
   the jump anchor) — pose variety comes from the anchor, not the prompt.
3. **Idle/walk pairs chain a→b.** `idle-b` references `idle-a` (not the
   canonical); `walk-b` references `walk-a` — so loop frames stay coherent
   with deliberate small variation instead of flickering.
4. **Specials chain sequentially:** startup references the **idle** cell;
   the **projectile** is generated alone (inspo only, never the canonical);
   the **active** cell references startup + projectile + idle (all three);
   the **recovery** references active + idle. Where we're coming from and
   going to is always in the reference set.
5. **One re-run per asset, max.** QA is advisory; a flagged cell gets one
   targeted reroll with a corrected prompt/reference, then ships or is left
   for a manual pass. No automated validate-regenerate loops.

### 2.10 Projectile consistency + origin tooling *(gap called out by the user)*

Projectiles today have no front-end fix path: inconsistent art scale/keying
across a kit, no way to correct the spawn origin, and hitbox/origin edits
live only in JSON. The MOVES module gets a **projectile editor**: per-
projectile preview in flight over the stage, spawn point set from a named
skeleton joint on the active cell (the pending Sprint 25 Phase-2 item),
scale/renderSize/box sliders on the shared geometry transform, and reroll
that follows the §2.9 reference chain (inspo-only refs). The Adopt flow
audits projectile art consistency (dimensions, key color, naming
`projectile-<moveId>.png`) across the whole roster.

### 2.11 QA, audits, and guardrails

- **Advisory QA badges** (spec §11): pose_qa's edge-bleed/floor/extra-limb
  rules exposed via a `/qa` job; per-cell warn badges in SPRITES; never
  blocks. The montage trick stays for humans.
- **`assets.audit.test.ts` grows**: bust check, orphan detection (extra files
  not owned by any roster char), meta-v2 shape check, and a **schema lint**
  (every playable fighter has chains/variants/cancel where its archetype
  expects them, ≥3 winQuotes, a non-placeholder fatality id).
- **Cleanups folded in**: delete haidai portraits / flo rm-rf panels /
  catherine legacy projectile.png (+ manifest entry), fix the vanessa VO
  flag, gate ThreeFxSystem's legacy projectile load behind the manifest,
  move vfx-grid experiments out of `tools/qa/`, fix "DWPose"→RTMPose naming,
  make the python resolver probe onnxruntime too, give `portrait_crop.py` an
  npm script, invalidate the characterScale base cache on character write,
  update CLAUDE.md (roster count, creator status, studio pointers).

---

## Part 3 — Phased build plan

Ordered so that every phase leaves the repo shippable, the cheap/structural
work lands before anything spends tokens, and the coordinate migration (the
only genuinely disruptive step) happens exactly once, early, with its test
fallout handled inside the same phase.

### Phase 0 — Guardrails + cruft sweep *(no API calls, no behavior risk)*
- [ ] Delete orphans (haidai, rm-rf, catherine projectile.png + manifest entry);
      fix vanessa `voice:true`; gate ThreeFxSystem legacy-projectile load
- [ ] Extend `assets.audit.test.ts`: bust, orphans, schema lint, meta shape
      (lint will initially FAIL on ben/earl/vanessa — that's the point; mark
      the specific known gaps as expected-fail until Phase 3 backfills them)
- [ ] `tools/core/constants.mjs` + generated `qa/constants.py`; replace all
      copies of FLOOR_FRAC/HEADROOM/CELL_*/1.32/SPRITE_FOOT_OFFSET_Y with
      imports (pure refactor, values unchanged)
- [ ] `tools/core/geometry.mjs`: one `cellBoxToHitbox`/`renderScale`; all
      three tools import it
- [ ] QA dir hygiene: move vfx-grid experiments to `tools/vfx/`, drop
      `__pycache__`, RTMPose naming, resolver probes onnxruntime,
      `npm run gen:busts` for portrait_crop
- [ ] characterScale base-cache invalidation on `/__editor/character` write

### Phase 1 — One pack path + one prompt library *(no API calls)*
- [ ] `tools/core/keying.mjs` — and fix the vite `FF_KEY_PAD` headroom
      mismatch (C1): all regen/creator cells get HEADROOM=24 like the pipeline
- [ ] `tools/core/packer.mjs` — pack-sheet.mjs, `/__editor/sheet`, and the
      creator write path all call it server-side; `composeSheet()` retires;
      meta v2 emitted; single floor-normalize implementation
- [ ] Sprite Editor writes cell edits back to raw frames (project dir), then
      re-packs — the `gen:pack`-clobbers-edits hazard dies here
- [ ] `tools/core/cells.mjs` + `prompts.mjs` — frames-manifest promoted;
      creatorModel imports the shared cell contract + prompt builders
      (creator fighters start getting canon-quality prompts)
- [ ] `tools/core/audio.mjs`; vite + gen-audio share TTS + voice tables
- [ ] Verify: repack one normalized char (vincent) byte-diff-equal (or
      pixel-equal) against current sheet before touching the roster

### Phase 2 — The atomic floor/skeleton migration *(local compute only)*
- [ ] Re-pack all 16 from raw frames: normalize + skeletons + meta v2
- [ ] Delete `SPRITE_FOOT_OFFSET_Y` + every `spriteOffsetY`; derive the 3D
      floor constant from shared constants
- [ ] Cell + projectile inventory sweep: per-fighter list of missing /
      misnamed / inconsistent cells and projectile art (dimensions, key
      color, naming); renames applied; the (small) generation gap list
      presented with cost before firing
- [ ] Roster hitbox pass: skeleton-measured boxes proposed per fighter,
      eyeballed in the tuner, written; update the Sprint-19 combo test →
      **suite goes fully green for the first time since Sprint 25**
- [ ] In-game verification across several pairings + canvas-render sheet QA
      (the montage workflow) — no browser-preview dependence

### Phase 3 — Studio shell + schema backfill *(JSON-only; ~8 images optional)*
- [ ] `CharacterStudioScene`: module rail, shared CharacterProject model,
      Sprite Editor + Move Tuner panels mounted as SPRITES/MOVES modules;
      EditorMenu entries become aliases
- [ ] Single character-write endpoint with module-scoped merges + provenance;
      canon-reopen hydrates a project; ZIP import/export moves to the project
      layout
- [ ] `tools/core/kit.mjs`: full-grammar default kit + one archetype catalog;
      design-draft prompt emits chains/variants/cancel + themed fatality
- [ ] Projectile editor in MOVES (§2.10): joint-anchored spawn point,
      in-flight preview, renderSize/box on shared geometry, ref-chained
      reroll — closes the "no frontend way to fix projectiles" gap
- [ ] Backfill ben + earl kits (chains/variants/cancel) + themed fatalities
      (~8 panels, approved) + vanessa quotes; schema lint goes green
- [ ] Adopt flow v1: upgrade checklist + diff view over the audit/lint

### Phase 4 — Auto-pilot + jobs + lore *(mock-tested; one real dogfood run)*
- [ ] `/__editor/jobs` runner: SSE progress, persistence, cost accounting,
      pooled concurrency + 429 backoff; manual mode migrates onto jobs
- [ ] Auto-pilot DAG: seed → design → canonical → frames → pack → rig(QA) →
      audio → fatality → vfx → ship, gates pre-approved; headless CLI
      entry point (`npm run studio:run`)
- [ ] `tools/core/lore.mjs`: lore-sheet fetch + fuzzy match + machine-enforced
      privacy opt-out; `alwaysFromLore` feeds frame prompts; lore-aware
      fatality beats + IMAGE_SAFETY soft-fallback (shared with gen-fatality)
- [ ] Creator FX module: per-move VFX overlays + spark wiring (closes
      pipeline step 8); fatality beats get the canon craft library
- [ ] Cost UI: estimated-call counters, no auto-fire, context cache §16,
      seed/prompt manifest
- [ ] Reference-chaining policy (§2.9) implemented in `core/cells.mjs` +
      the job DAG: canonical gate, crouch/jump anchors, a→b idle/walk,
      sequential special refs, one-reroll-max
- [ ] **End-to-end validation**: full auto-pilot run in mock ($0), then ONE
      real FULL run on a new lore-sheet fighter (opt-out checked; ~70 images
      + ~20 TTS), advisory QA only, max one re-run per asset

### Phase 5 — Storage seam + publish *(no API calls; R2 optional)*
- [ ] `StorageDriver` + `LocalRepoStorage` + `R2Storage` (env-gated, local
      no-op fallback path exercised in dev); PUBLISH in SHIP;
      `custom-characters.json` + `resolveAssetBase` roster merge;
      `npm run r2:push/pull` canonize tools
- [ ] Docs: CLAUDE.md refresh, ASSET_CHECKLIST points at the studio, skills
      (`new-character`, `sprite-qa`, `move-authoring`) updated to route
      through core/ + studio; SPRINTBOARD consolidation

### Sequencing notes
- Phases 0–2 are pure consolidation — they de-risk everything after and cost
  no tokens. Phase 2 is the only step that changes gameplay-visible geometry;
  it's isolated so its test fallout is one contained event.
- Phase 3 before 4: auto-pilot must scaffold *full-grammar* kits or we mint
  more ben/earls.
- Real-API spending happens exactly twice: optional ben/earl fatality panels
  (Phase 3, ~8 images) and the single dogfood run (Phase 4).

---

## Part 4 — Decisions (user, 2026-07-08)

1. **Atomic migration: APPROVED** — do it where it fits best. Vincent, Ben,
   Yulia and Earl have been manually dialed, but inconsistency and missing
   sprites remain; starting from scratch on the coordinate/pack layer is
   acceptable. Expect to (a) inventory missing/inconsistent cells per
   fighter during Phase 2 and generate the gaps (small, costed list
   presented before firing), and (b) rename assets where needed for
   consistency. Projectile consistency/origin fixing must get a real
   front-end answer (→ §2.10).
2. **Dogfood: FULL RUN** of a new fighter — but **no QA validation loops**:
   at most one re-run per asset, with quality front-loaded via the §2.9
   reference-chaining strategy (right prompt + right reference images the
   first time).
3. **ben/earl: kits + themed fatalities** (~8 panel images via the upgraded
   design-draft + fatality craft library).
4. **R2: seam + local mock only** this build; real bucket is a later env
   flip.

Defaults adopted for the remaining minor questions (flag if wrong):
- EditorMenu entries become studio aliases for one release, then retire.
- The dev server fetches the public lore sheet (read-only CSV export) at
  design time; the privacy opt-out column becomes machine-enforced.
- Packing becomes server-side-only (dev server + ffmpeg required for SHIP);
  the client compositor is deleted; mock mode keeps a walkable stub.
- The dogfood subject will be a new fighter chosen from the lore sheet
  (opt-out column re-checked first), proposed before the run starts.
