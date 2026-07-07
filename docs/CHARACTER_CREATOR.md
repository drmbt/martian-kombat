# Character Creator Wizard — design spec

> Status: **DESIGN (iterating)** · owner: Vincent · target: Sprint 26
> A dev-mode, full-service, browser-driven wizard that takes a fighter from
> **zero** (name + photo + description) to **hero** (fully playable, audit-green),
> running the whole 7-step asset pipeline from the browser — auto first passes,
> dialable tuning at every step. Eventually subsumes Move Tuner + Sprite Editor and
> gains a Cloudflare R2 publish/pull path so user characters reach the shipped game.

> **Worked example:** `CHARACTER_CREATOR_WALKTHROUGH.md` dry-runs every dialog (D1–D8) with dummy
> data — UI, assets list, JSON state, and the exact prompts+images sent at each step.

## Locked decisions (2026-07-06)
- **One provider — Gemini — for BOTH text and images.** All dialog/LLM authoring runs on Gemini
  (text) and all image gen on nano-banana (`gemini-3-pro-image`). Because it's one provider, we keep
  **one Gemini context cache per character** (§16): inspo photo + `style.md` + the growing character
  bible JSON, plus the canonical once approved. Text drafts and every image prompt reference the cache
  instead of re-sending — the token-cost lever. *(Supersedes the earlier OpenAI decision.)*
- **QA in the wizard is advisory-only — it never blocks.** A returned cell that fails a check gets a
  **warning badge on its thumbnail** + a suggestion to regenerate; the user decides. When they regen,
  they give LLM guidance text and choose whether to feed the bad image back in (img2img) or start clean.
  Edge-clearance (pixels bleeding off the edge) is the one check we implement now.
- **Everything is assembled in an in-browser working model** (extends `spriteSheetModel.ts`) that
  becomes, on WRITE, exactly three artifacts: the **character `<id>.json`**, the **`meta.json`**, and the
  **packed `sheet.png`**. `docs/MOVES.md` is design-only/advisory (no code reads it) — the wizard does
  NOT write it; `docs/MOVE_DURATIONS.md` is derived and regenerated from the JSON.
- **`lore` block confirmed** — optional `{tagline,personality,backstory}` on `CharacterDef` (engine
  ignores; arcade reads later).
- **The QA + pack + normalization stack needs a ground-up rethink** (§11a) — the current
  `pose_qa.py`/normalize machinery is cruft we're designing around, not endorsing. Build the wizard's
  pack path to bypass it cleanly; plan the whole pipeline to minimize cruft. Assets keep landing in
  today's locations so repo/dev flows are preserved.
- **R2 is bidirectional and drives a dev/prod backend split** (see §6). Scaffold now,
  set up env; when the site is published with good env, *publish writes to R2*; provide a
  **pull-back/canonize** tool to bring R2 assets into the repo for anything worth keeping.
- **Move Tuner & Sprite Editor stay as-is for now**; the wizard *embeds/harvests* them and
  eventually reaches feature parity, at which point the standalone entries retire.

---

## 1. Definition of Done — everything a new character needs
Source of truth = `src/data/assets.audit.test.ts`. The wizard is "done" when the audit is green.

**Data (`src/data/characters/<id>.json`)**
- Identity: `id, name, color, stage?, winQuotes[]` (≥3), `fatality{id,name,input,panels}`
- Physics: `health, walkSpeed, backSpeed, jumpVel, gravity, prejumpFrames`, `scale?`, `spriteOffsetY?`
- Hurtboxes: `bodyBox, hurtStand, hurtCrouch`
- Moves: **27 base** (`lp mp hp lk mk hk`·`clp cmp chp clk cmk chk`·`jlp jmp jhp jlk jmk jhk`·`throw`) + **3–5 specials**

**Sprites** `sprites/<id>/sheet.png` + `meta.json` (cell-name→index, baked `skeletons`)
**Portraits** `portraits/<id>.png` · `<id>-bust.png` · `<id>-ko.png`
**Audio** `announcer/<id>.mp3` · 6× `voice/<id>-kiai-N` · 6× `-hurt-N` · 4× `-victory-N`
**Fatality** `fatalities/<id>/<fatId>-1..N.jpg`
**Registration** import in `characters/index.ts` · `ROSTER` entry (`playable:true`) · poses in `frames-manifest.mjs` · VO text in `gen-audio.mjs`
**Optional (manifest-gated, degrade gracefully)** per-move `projectile/-burst/vfx` art · 3D `glb` · home stage + pin · cloned Fish voice

---

## 2. Dependency graph — what gates what
```
name + inspo photo + description   ← the only required human inputs
        ├──(text)──► LLM DESIGN DRAFT (Gemini): archetype, kit, specials, quotes,
        │            16 VO lines, fatality concept, color, home-stage guess  [fires instantly]
        └──► CANONICAL (full-body ref on green)  ◄── THE ONE HARD GATE
                 ├──► FRAMES ──► PACK ──► sheet+meta ──► QA/skeleton   (long pole, 10–30 min)
                 ├──► PORTRAITS (icon/bust/ko, ~2 min)
                 ├──► FATALITY panels (~3 min)
                 └──► per-move VFX (~1 min/effect)
  voice sample (BYO) ──► Fish CLONE ──► re-route gen:audio         [independent of images]
  VO text (from draft) ──► gen:audio (ElevenLabs / clone)          [needs text only]
  stage inspo (BYO)  ──► gen:stage ──► pin                         [fully independent]
```
**Two tracks the wizard exploits to hide latency:** the *image track* (slow, background) and the
*text track* (instant LLM, human-edited). The user works text while images bake. Canonical is the
only mandatory wait.

**Sprite gen is gated on TWO things, not one:** canonical *approved* **AND** a text-complete profile
(bio, fighting style, moves baseline in the JSON). We learn as much as possible about the character
*before* spending a single sprite call. The canonical bake is filled by the profile Q&A (§3).

**Sprites are a chain of approved batches, each feeding the next as its reference image** (this is the
quality lever — it honors the pipeline's low-pose-anchor + crouch-from-crouch gotchas):
```
canonical ─► idle + walk                (approve)
          ─► jump, crouch, block, fall, down   (approve)   ← LOW/LYING framing constraints
 approved jump   ─► jump normals (jlp…jhk)      (ref = jump image)
 approved crouch ─► crouch normals (clp…chk)    (ref = crouch image)
 canonical       ─► standing normals (lp…hk)    (ref = canonical)
 specials (4 slots, each cookable in parallel from the UI; each internally sequential):
   projectile (approve) ─► active frames (ref = projectile + inspo) ─► startup/recovery (ref = active)
          ─► skeleton + auto-hitboxes (fal DWPose)   ← AFTER specials, once every cell exists
          ─► FINAL floor-normalize (single pass, shifts art + baked keypoints) ← the very end only
```
Within a batch, independent cells fan out concurrently (`pool()`, 6-wide); only the special chains go
sequential. **Collision boxes are MEASURED, not authored:** `bodyBox`/`hurtStand`/`spriteOffsetY` from
the canonical silhouette+skeleton once it's approved; `hurtCrouch` from the approved crouch base.
**No normalization until the very end** — cells stay un-normalized through gen/QA so edge checks are
honest, then one final floor-align pass. Portraits, fatality panels, and VO synth only need the
canonical / locked text, so they **bake in the background** after Phase C and are reviewed near the end.

---

## 3. Wizard phases & pacing
Layout: **left stepper** (phases + status dots) · **main panel** · **persistent bottom "Bake Tray"**
(all in-flight jobs — canonical, a frames-grid filling cell-by-cell, portraits, audio, fatality — with
progress bars + thumbnails as they land). The tray is the trick: something is always cooking while the
user does text work.

| Phase | User does | Async in the tray |
|---|---|---|
| **A · Seed** | name → auto-slug `id`; inspo image (drag-drop **or** generate-from-prompt); one-line description; optional stage inspo + **voice-sample upload prompt** | 🔥 `gen-canonical` fires on submit; `design` draft fires; stage gen + voice clone if provided |
| **B · Profile** *(while canonical bakes)* | the Q&A that teaches the wizard the character **before any sprite spend**: personality, **backstory (for arcade mode)**, fighting style, freeform input that steers the move roll. LLM proposes archetype/style/color. Review + edit + **lock/batch-reroll** (§3b): victory quotes, kiai, hurt lines, backstory options. Stage from image-or-desc (enforce 16-bit + salton ref). **Fills the character JSON baseline** (identity, physics, quotes, VO text, a moves skeleton) | canonical baking; stage gen; voice clone |
| **C · Look gate** | **the one hard gate**: Accept / Re-roll (tweak prompt) / Upload-your-own canonical. Now we have canonical + full profile | on Accept → background-bake **portraits + fatality panels + VO synth** (gate nothing, reviewed in F) |
| **D · Sprites** *(staged, approved, live preview lower-left like Sprite Editor)* | **B1** idle + walk → approve · **B2** jump, crouch, block, fall, down → approve (measure `hurtCrouch` here) · **B3** jump normals (ref=jump), crouch normals (ref=crouch), standing normals (ref=canonical) — watch each land, **tune startup/active/recovery**, **reroll a single sprite** (from base ref, or img2img on the bad cell with guiding text) | each batch fans out concurrently; keypoints bake per-cell as sprites land |
| **E · Specials** | **4-slot table** — each row: name · **controls dropdown** (archetype-sensible combos) · short description · **Reroll** (instant, from the pre-gen pool) · **Generate** · async state chip. Cook multiple slots at once; while slot 1 bakes, start slot 2. Each internally: **projectile first** → active (ref=proj+inspo) → startup/recovery (ref=active). **Click a completed row → the fighter performs it** in the preview; rows auto-play as they finish | special chains gen; pool feeds instant rerolls |
| **F · Rig** | **skeleton + auto-hitboxes** (fal DWPose) across every cell now that all exist; review/edit boxes + per-move timing | keypoints/boxes compute |
| **G · Polish** | review background-baked **portraits / fatality panels / audio**; approve/reroll; optional per-move **VFX** | reroll jobs |
| **H · Ship** | home-stage **pin** (already gen'd in Phase B); **FINAL floor-normalize pass**; write files → register → `gen:assets` → **run audit in-browser** → green → **PLAY NOW** / **PUBLISH** | normalize + write |

### 3b. Two interaction patterns used everywhere
**Lock / batch-reroll** (for candidate sets — victory quotes, kiai, hurt, backstory options, special
slots): the wizard shows N candidates; the user **locks** the keepers and hits **"reroll unlocked"**,
which regenerates only the open slots as one batch. The cheap LLM gets consolidated context (the locked
items + the character profile) so new candidates stay consistent and complementary. Repeat until happy.
Nothing is committed to the JSON until the set is approved.

**Single-sprite reroll** (for one bad cell): two modes —
1. **Fresh from base ref** — regenerate from the correct base (canonical for standing, the approved
   jump image for jump moves, the approved crouch image for crouch moves) with the user's guiding text.
2. **Img2img edit** — feed the *bad* sprite back in with a text instruction ("straighten the front leg,
   lower the hips") for a targeted fix.
Timing (startup/active/recovery) is editable inline per move without any regen — it's just JSON.

---

## 4. Backend plumbing

### 4a. Dev — extend the `/__editor/*` Vite middleware (`apply:'serve'`, absent in prod)
Existing: `stage-pins, character, sheet, skeleton-regen, gen-frame`.

**Core new piece — an async JOB RUNNER** (gen scripts take minutes; a POST can't block):
- `POST /__editor/jobs {kind,args}` → spawn the matching gen script as a child process → `{jobId}`
- `GET  /__editor/jobs/:id` → `{status, progress, log, artifacts[]}` (parse per-cell stdout → live grid)
- `POST /__editor/jobs/:id/cancel` · optional SSE `…/stream`
- kinds wrap existing scripts: `canonical, frames, pack, portraits, audio, voice, fatality, vfx, stage, mesh`
- resumable (scripts already skip existing files) → cancel/reopen is cheap

**New non-job endpoints:**
- `POST /__editor/upload` — inspo image / voice sample / stage inspo → `assets/character-inspo/<id>.jpg` etc.
- `POST /__editor/design` — Gemini kit draft (§5), synchronous (~seconds); reads/writes the char context cache
- `POST /__editor/register` — codegen `roster.ts` + `characters/index.ts` + `frames-manifest.mjs` + `gen-audio.mjs` VO block for `<id>`
- `POST /__editor/audit` — run `gen:assets` + audit test → gap list
- `POST /__editor/publish` — R2 push (§6); no-ops to local mock when creds absent

### 4b. Prod — the shipped-game path (R2-backed)
The shipped site has no Vite middleware. When R2 env is configured, the wizard's generate/publish
calls target a **serverless backend** (Cloudflare Worker/Pages Function) that (a) proxies generation
so API keys never touch the browser, and (b) writes the asset bundle to R2 under `custom/<id>/…`.
Same wizard UI; the **storage adapter** (§6) swaps by environment. (The Worker itself is a later
deliverable — this pass scaffolds the adapter seam + env so dev works and prod is a drop-in.)

---

## 5. LLM design-draft step (Gemini, auto first-pass, dialable)
One call turns `{name, description, inspoImage}` into a complete **editable** draft. Grounded by
`tools/style.md`, the **move-authoring archetype catalog** (never invents unbuildable mechanics), the
lore sheet (fuzzy match, **privacy opt-out enforced**), and the character JSON schema. Every emitted
field is a re-rollable / hand-editable widget.

Output (schema-constrained JSON): `archetype`, `color`, `stageGuess`, `personality`, `backstory` (arcade),
`moves` (27 with tuned frame data), `specials[]` (name + motion + **archetype id from the catalog** +
params), `winQuotes[]`, `vo{kiai[6],hurt[6],victory[4]}`, `fatality{id,name,input,panels,panelPrompts[]}`,
`posePrompts{}` (per sprite cell + special phase — feeds `gen-frames`). Drafting **all** text up front
(incl. special frame-data + pose prompts) means later sprite/special gen is pure execution, no LLM
round-trips interleaved with image gen.

**Two-tier LLM:** the **smart** model runs the big initial draft (Phase B) and full special re-gens;
a **cheap** model runs single-item rerolls (one quote / VO line / pose-prompt tweak) with consolidated
context. Keeps per-edit latency and cost low without dumbing down the initial pass.

---

## 6. Cloudflare R2 — bidirectional (publish ↑ / canonize ↓ / load ↔)

**A storage-adapter interface with two impls** — `LocalRepoStorage` (dev middleware → writes into the
repo, i.e. straight-to-canon) and `R2Storage` (S3-compatible). The publish step picks by environment.

**Publish ↑** `POST /__editor/publish` (dev) / Worker (prod) bundles a character's asset set + JSON and
uploads under `custom/<id>/…`, then appends to a **custom-character registry** (`custom-characters.json`,
remote-fetchable) with the char's `cdnBase`.

**Load ↔ (bring user chars into the shipped game)** — an asset-base indirection `resolveAssetBase(charId)`
returns `/assets` for built-ins or the char's `cdnBase` for customs; BootScene loads sheet/portraits/
audio/fatality through it. The custom registry is merged into `ROSTER` at boot.

**Canonize ↓ — the pull-back tool you asked for:** `npm run r2:pull -- --char <id>` (`--list`, `--all`)
downloads a character's full R2 bundle → `public/assets/**` + `src/data/characters/<id>.json`, registers
it, runs `gen:assets` + audit. Result: a user-generated character becomes an ordinary committed,
canon fighter. `npm run r2:push -- --char <id>` is the manual inverse.

**Env (`.env.example`):** `R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
R2_PUBLIC_BASE` (CDN URL). All absent → publish no-ops to `public/assets/custom/<id>/` + local registry,
exercising the *same* resolve/merge/pull path, so flipping to a real bucket is a base-URL swap.

---

## 7. Example prompts per step
Concrete first-pass prompts the wizard sends. All character-image prompts prepend `tools/style.md`'s
locked base; all are re-rollable with user edits.

**Canonical** (`gen-canonical`, Gemini `gemini-3-pro-image`, from the inspo photo):
> `<style.md character base>` A full-body fighting-game character sheet of the person in the reference
> photo, standing neutral fighting stance, facing right, feet on an invisible ground line just above the
> bottom edge, centered. Keep face, hair, build and wardrobe recognizable. `<description-derived flavor:
> e.g. "flowing black cloak, faint violet sigils on the palms (never green)">`. Background: solid flat
> chroma-key green #00B140, uniform, no shadow/floor/text/border.

**Design draft** (`design`, Gemini, schema-constrained — system + user):
> *System:* You design fighters for Martian Kombat, a data-driven SF2/MK-style game. Emit ONLY valid
> JSON matching the provided schema. Specials MUST map to an archetype id from this catalog: `<paste
> buildable-archetype list>` — never invent mechanics. Honor SF2 frame-data norms (light 3–5 startup,
> heavy 8–12, projectile 13). Respect the lore sheet's privacy opt-out.
> *User:* Name: `<name>`. Description: `<description>`. Lore match (if any): `<fuzzy match>`. Produce
> archetype, color, home-stage guess, 27 tuned moves, 3–5 named specials (motion+button+archetype+
> params), 3 win quotes, 16 VO lines (6 kiai / 6 hurt / 4 victory), a fatality concept (id/name/input/
> 4 panel prompts), and one pose prompt per special phase.

**Special pose frame** (`gen-frames`, per special phase, cross-refs prior phases + projectile + inspo):
> `<style.md frame rules>` Same character as reference. `<pose from specialPosePrompts, e.g. "mid-cast:
> both palms thrust forward, violet sigil ring blazing at the fingertips, weight forward on the front
> foot, cloak flaring back">`. All FX keyable violet/silver — NEVER green. Chroma-key green #00B140 bg.

**VO line** (`gen-audio`, ElevenLabs or Fish clone) — text authored by the design draft, e.g. kiai
`"Alignment!"`, hurt `"Ngh—!"`, victory `"You anchored the dirt. I anchored the cosmos."`

**Fatality panel** (`gen-fatality`, 16:9): the design draft's `panelPrompts[]`, e.g.
> Cinematic 16:9 fatality panel: `<name>` `<beat: "raises both palms as a violet sigil-storm engulfs the
> screaming opponent">`, dramatic rim light, painted cel-shaded style, full-bleed, no text/UI.

**Stage** (`gen-stage`, optional BYO) — reuse the locked `STAGE_STYLE` prompt + the salton style-ref anchor.

---

## 8. Build order (when we start)
1. **Job-runner backbone** (`/__editor/jobs` + registry) — hardest new plumbing, unblocks all.
2. **Wizard shell** — dev-gated `CharacterCreatorScene`: stepper + Bake Tray + live preview + EditorMenu entry.
3. **A→C slice** — upload → Gemini design draft → Profile Q&A (lock/reroll) → canonical gate → JSON baseline.
4. **Phase D sprite batches** — B1→B4 staged/approved, ref-chained, live preview, per-cell reroll, per-move timing, fal skeleton/auto-hitbox.
5. **Phase E specials** — projectile-first chains + lock/reroll; two-tier LLM wiring.
6. **Phase F/G** — background portraits/fatality/audio review + pin + register + audit + PLAY NOW.
7. **R2 seams** — storage adapter + `resolveAssetBase` + custom registry + publish/pull (local mock first).
8. **Consolidate** — update audit/tests, skills, CLAUDE.md; fold Tuner/Editor into the wizard; wire prod Worker.

---

## 9. Still open / to discuss
- Prod serverless backend (Cloudflare Worker) shape + auth (who can create in the shipped game?).
- Moderation/safety gate on user-uploaded photos before generation in prod.
- Do custom (R2) characters appear in the main roster, or a separate "Custom" tab until canonized?
- **fal for DWPose** — the wizard runs skeleton/auto-hitbox via a fal endpoint (browser-friendly, no
  local Python) instead of / in addition to the local `pose_qa.py`. Confirm fal is the skeleton route
  in-wizard, with local `pose_qa.py` as the canonize-time backstop.
- *(Resolved)* Frame-bake latency — handled by staged **batch approval + live preview** (§3), not a
  quick-draft sheet. The user is always looking at/tuning the last batch while the next bakes.
- **Revisit: pull hitbox tuning earlier?** Move *timing* is tuned live in D4/D5; hitboxes are
  auto-measured + edited in the D6 rig pass (after specials). Open whether a move should also expose its
  hitbox at D4/D5 so feel+box tune together, vs. the single consolidated rig pass. (Timing-now is fine.)

## 10. Suggested order/efficiency edits (for review)
1. **Background-bake portraits + fatality panels + VO synth** the instant canonical is approved — they
   need only the canonical/locked text, gate nothing, and are reviewed in Phase F. No dedicated wait.
2. **Bake keypoints per-cell as each sprite lands** (cheap) so the skeleton overlay + auto-hitbox is
   live the moment a move appears — the user tunes that move immediately; Phase F "review all" is then a
   fast sanity sweep, not a blocking generation pass.
3. **Draft ALL text in Phase B** (incl. special frame-data + pose prompts) so image gen never waits on
   an LLM round-trip mid-bake.
4. **Fan out within each batch, sequential only across batches** — idle-a/-b + walk-a/-b together; the
   five pose-bases together; the nine normals pooled. Only special chains are serial.
5. **Fire the next batch the instant the prior is approved** (tight pipelining) — e.g. approving idle/
   walk immediately kicks the pose-base batch so it's partly done by the time the user looks.
6. **Two-tier LLM** (§5) — cheap for single rerolls, smart for the initial draft + full special re-gen.

---

## 11. Wizard QA standard (lean; the full `pose_qa.py` is the canonize-time backstop)

The in-wizard bar is deliberately minimal so the loop stays fast; the heavy DWPose/pose-rule QA only
runs when a character is pulled back to the repo to be canonized (§14 pull path).

Per **keyed cell** (run on the ffmpeg-keyed PNG, *pre-pack, un-normalized*):
1. **Edge-clearance** — decode alpha; the outer 2-px border ring on all four sides must be ≥99%
   transparent. Any opaque pixels at an edge = subject cropped/oversized or a key halo → flag the cell
   red, offer reroll. (This is the ONLY hard gate for now, per direction.)
2. **Non-empty / sanity fill** — opaque area within a sane band (not a blank/failed gen, not a full-frame
   blob). Fail → reroll.
3. **(soft) single-silhouette** — one connected opaque blob above a min size (catches a stray second
   figure / detached limb chunk). Warn, don't block.

Once, **post-canonical-approval** — *measure*, don't author:
4. From the canonical silhouette + fal skeleton: feet-Y (sole), head-top, shoulder/hip width →
   `hurtStand` (head-to-feet × shoulder width), `bodyBox` (torso, narrower), render `spriteOffsetY`.
   `hurtCrouch` measured the same way from the approved **crouch** base (Phase D B2).

**Very end only** (Phase H):
5. **Floor-normalize** every cell to one plane (median grounded sole → origin), re-bake `meta.skeletons`
   shifted by the same `dy`. Single pass. Nothing is normalized before this — edge checks stay honest
   and boxes (feet-relative) are invariant under the shift.

`FLOOR_FRAC` / `HEADROOM` / `SCALE_PAD` must still match the pack contract (CLAUDE.md coordinate rule);
the final normalize is the only place they bite.

---

## 12. Dialogs — order & contents

**D1 · Seed.** name (→ slug `id` + `NAME`); inspo image (drag-drop **or** "generate from a prompt"
box); one-line description; voice-sample upload prompt.
→ On submit: fire `gen-canonical` + the **big design-draft LLM pass** (§13). *Fires nothing sprite-y.*

**D2 · Profile + Stage** *(canonical baking).* Left: Q&A that teaches the character — personality,
**backstory** (arcade), fighting style, freeform "what should their moves feel like". LLM proposes
archetype / `color` / physics defaults (editable). Lock-grid (§3b) for **victory quotes / kiai / hurt**.
Right: **Stage** — upload image or type a description → `gen:stage` (auto-injects 16-bit + salton
style-ref, §14) + **stage music** (ElevenLabs, §15); the panel **populates as art returns**, then
**place it on the world map** to set the location. Fatality concept (name + input) picked here too.
→ Writes the **JSON baseline** (identity, physics, quotes, VO text, fatality stub, moves skeleton).

**D3 · Canonical gate.** Big green preview → Accept / Re-roll (prompt tweak) / Upload-your-own.
→ On Accept: **measure** `bodyBox`/`hurtStand`/`spriteOffsetY` (§11.4); background-bake **portraits +
fatality panels + VO synth**.

**D4 · Base sprites + normals.** Live preview lower-left. B1 idle/walk ✓ → B2 jump/crouch/block/fall/
down ✓ (measure `hurtCrouch`) → B3 the nine normals (ref-chained). Per cell: edge-QA chip, single-cell
reroll (from-base or img2img), inline startup/active/recovery tuning.

**D5 · Specials (4-slot table).** Row = name · controls dropdown · description · Reroll · Generate ·
state chip. Multiple slots cook at once; projectile-first chain internally; click a done row → fighter
performs it; auto-play on completion.

**D6 · Rig.** fal DWPose across all cells → auto-hitboxes; review/edit boxes + timing per move.

**D7 · Polish.** Review background portraits / fatality panels / audio; approve/reroll; optional VFX.

**D8 · Ship.** Final normalize → write files → register → `gen:assets` → in-browser audit → green →
PLAY NOW / PUBLISH.

---

## 13. Template JSON + fill-logic (which dialog fills what, by what rule)

```jsonc
{
  "id":   "<slug(name)>",                 // D1  user
  "name": "<UPPER(name)>",                // D1  user
  "color": "#8b5cf6",                     // D2  LLM (archetype palette) → editable
  "stage": "<stageGuess|chosen>",         // D2  LLM guess, set on map-place
  "lore": {                               // D2  LLM + user  (NEW optional block; engine ignores)
    "tagline": "...", "personality": "...", "backstory": "..." },   // backstory drives arcade
  "winQuotes": ["...", "...", "..."],     // D2  LLM lock-grid → approved set
  "health": 1000, "walkSpeed": 3.2, "backSpeed": 3.3,   // D2  archetype defaults → editable
  "jumpVel": 18, "gravity": 0.9, "prejumpFrames": 4, "scale": 1.0,
  "spriteOffsetY": -12,                   // D3  MEASURED from canonical
  "bodyBox":   { "x": -44, "y": -248, "w": 88,  "h": 248 },  // D3 MEASURED
  "hurtStand": { "x": -54, "y": -262, "w": 108, "h": 262 },  // D3 MEASURED
  "hurtCrouch":{ "x": -54, "y": -165, "w": 108, "h": 165 },  // D4-B2 MEASURED (crouch base)
  "moves": {
    // 27 normals: frame data drafted D2 (archetype), sprites D4, timing tuned live, hitbox D6 auto
    "lp": { "startup": 4, "active": 3, "recovery": 7, "damage": 30, "hitstun": 12,
            "blockstun": 8, "knockback": 3, "hitbox": null /*→D6*/, "height": "mid" },
    /* …26 more… */
    // specials: chosen D5 from the pool; input from controls dropdown; projectile params D5
    "<special-id>": { "name": "...", "input": { "motion": "qcf", "button": "punch" },
                      "startup": 13, "active": 2, "recovery": 24, "height": "mid",
                      "hitbox": null, "projectile": { /* … */ }, "vfx": { /* … */ } }
  },
  "fatality": { "id": "...", "name": "...", "input": { "motion": "hcb", "button": "punch" },
                "panels": 4 }             // concept D2; panels approved D7
}
```

**Sidecars the wizard writes alongside the JSON:**
- `characters/<id>.creator.json` — the **pre-generated candidate pool**: extra special
  `{name,description,archetypeId,controlsHint,tags}` beyond the 4 shown (instant rerolls, no LLM call),
  plus alt quotes/VO. Consumed by D5's Reroll button. Not shipped.
- `src/data/moveIdeas.json` — **shared unused-move catalog** (append-only, all characters). When a
  char's own pool is exhausted, D5 pulls archetype-matched ideas from here; on wizard completion the
  char's leftover unused candidates are appended back. Cuts LLM calls across the whole roster.

**Controls dropdown source** — `CONTROLS_BY_ARCHETYPE` (shortlists sensible motion+button per type):
`projectile → [qcf+P, qcf+K, hcf+P]` · `anti-air/dp → [dp+P, dp+K]` · `charge-proj → [ [b]f+P ]` ·
`command-grab → [hcb+P, 360+P]` · `rush/advance → [qcf+K, hcf+K]` · `reversal → [qcb+P]`. (Ids are the
`move-authoring` catalog archetypes so nothing unbuildable is offered.)

---

## 14. Template image-gen prompts (parameterized; all extend `tools/style.md`)

`{...}` = wizard-filled slots. Every character prompt appends the locked style base + frame rules from
`tools/style.md` (painted cel, `#00B140` green, full-body, feet on invisible ground, facing right).

- **Canonical** (from inspo photo): *"Full-body fighting-game character sheet of {desc}, {flavor:
  signature garb/props always visible}, neutral confident standing pose, arms relaxed, facing right.
  {STYLE_BASE}. Solid flat chroma-green background."*
- **Idle-a / idle-b** (ref = canonical): *"…same character, relaxed fighting idle, weight settled, BOTH
  feet flat, chest {a: neutral | b: risen on the breath}. NOT an attack, no raised knee/kick/lunge."*
- **Walk-a / walk-b** (ref = canonical): *"…mid-stride walk, {a: left | b: right} foot forward, torso
  upright, clearly distinct from idle."*
- **Pose bases** (ref = canonical): jump *"crouched then airborne, knees tucked, whole figure lifted"*;
  **crouch** *"{LOW: squatting EXTREMELY low, hips at heel height, figure ONLY in the BOTTOM HALF}"*;
  block *"guard up, forearms shielding, braced"*; fall *"knocked backward off balance, mid-air"*;
  **down** *"{LYING: flat on back, a HORIZONTAL shape along the BOTTOM QUARTER}"*.
- **Standing normal** (ref = canonical): *"…performing {move.name}: {move.poseVerb, e.g. 'a fast jab',
  'a heavy roundhouse'}, {phase: startup wind-up | active full extension | recovery return}, weight on
  {foot}. One clear action, no extra limbs."*
- **Jump normal** (ref = **approved jump image**): *"…the SAME airborne pose as the reference, now
  {move.poseVerb} in the air; copy the body height and airborne framing of the reference."*
- **Crouch normal** (ref = **approved crouch image**): *"…the SAME low crouch as the reference, now
  {move.poseVerb} while staying low; copy the body height of the reference — do NOT stand up."*
- **Special projectile** (ref = **inspo images ONLY**, never canonical): *"{proj.desc, e.g. 'a spinning
  violet sigil disc'}, keyable {violet/silver/blue/gold} energy, no character, on solid chroma-green.
  Side view, travelling right."*
- **Special active** (ref = projectile + inspo): *"…{char} at the release of {special.name}, {pose},
  hand/limb thrust toward the projectile; the {proj} leaving the hand."*
- **Special startup/recovery** (ref = **approved active frame**): *"…the frame just {before/after} the
  active pose above — {gathering / settling} — same character, same scale."*
- **Portrait icon** (`gen-icons`): straight-on head-and-shoulders, neutral, chroma-green.
- **Bust** (`portrait_crop.py`): pose-centered crop of the canonical off head keypoints (no new gen).
- **KO portrait** (`gen-canonical` defeated): beaten, bruised, downcast, chroma-green.
- **Fatality panel N** (ref = canonical + generic victim): *"16:9 cinematic cutscene, {panelBeat[N]},
  {char} executing {fatality.name}, dramatic lighting, gore stylized."*
- **Stage** (ref = `assets/stage-inspo/style-ref-salton.jpg` FIRST, then user refs): *"{stage.desc},
  redraw as {STAGE_STYLE: gritty 16-bit retro pixel-art anchored on the salton style ref}. 21:9. Bottom
  quarter is a continuous textured walkable ground plane edge-to-edge touching the bottom; no props or
  people in the fighter strip."*

---

## 15. Stage music prompt (ElevenLabs music endpoint)

New `gen:music-track` job → ElevenLabs music `compose`, writes a loopable theme to
`public/assets/audio/music/stages/<id>/` (the existing folder-scan `gen:music` picks it up).

Template: *"A loopable {length ~60–90s} instrumental battle theme for a versus fighting-game stage set
in {stage.desc / vibe words}. {archetype vibe: e.g. 'gritty desert dub-techno' / 'neon synthwave' /
'tribal percussion + drone'}. Driving mid-tempo (~{bpm} BPM), strong rhythmic loop, no vocals, clean
loop point, mixed to sit under SFX."* — bpm/vibe seeded from the stage description; the user can edit
the prompt and re-roll before it's committed. (Announcer + character VO stay ElevenLabs/Fish per
existing routing; this only adds stage music.)

---

## 11a. QA / pack / normalize — tracked debt (rethink, don't endorse)

The current `pose_qa.py` + `normalize_floor.py` + `pack-sheet.mjs` stack (DWPose, HEADROOM/SCALE_PAD/
FLOOR_FRAC must-match constants, floor normalization) is **cruft we are deliberately designing around.**
For the wizard:
- Build a **new, lean pack path** for in-wizard writes that bypasses the old QA + normalization and
  writes straight from the in-browser working model → `sheet.png` + `meta.json` in today's locations.
- Advisory edge-clearance is the only gate (§11). Skeleton via **fal**, not local Python.
- **Design so it's all testable here and preserved in the repo** — local dev keeps writing to the exact
  paths it uses now; nothing about the wizard forces a second source of truth.
- **Follow-up (post-wizard):** unify/replace the old QA+normalize machinery so there's ONE pack path,
  not two. Track as its own sprint item; the wizard's lean path is the prototype for that convergence.

## 11b. "Measure, don't author" — how `bodyBox` / `hurtStand` / `spriteOffsetY` get set

Right after the canonical is **approved** (D3), one measurement pass sets the collision geometry from
pixels instead of guesses. All boxes are **feet-origin, y-negative-up** (the engine's `Box` convention).

1. **Alpha bounds** — key the canonical, find the opaque bounding box: `topY` (head crown), `botY`
   (grounded sole = the **feet origin**), `leftX`/`rightX` (widest silhouette).
2. **fal skeleton** (same DWPose we run on cells) refines it: ankle/heel keypoints confirm the sole
   plane; shoulder & hip x-spread give a torso width that isn't thrown off by an outstretched
   arm/prop; head-top keypoint confirms crown.
3. **Derive:**
   - `hurtStand` = full silhouette height (`botY→topY`) × shoulder-ish width, centered on the spine x.
   - `bodyBox` = torso-only: hip-to-shoulder height × the narrower hip/shoulder width (the "core" that
     sweeps/bodies collide with), inset from `hurtStand`.
   - `spriteOffsetY` = the render nudge that lands the measured sole on the floor plane at the current
     `scale` — computed, not eyeballed.
   - `hurtCrouch` = the same measurement re-run on the **approved crouch base** (D4-B2), which is why
     crouch has to be approved before this box is final.
4. All of it is **editable** afterward in the D6 rig step (drag the boxes) — measurement is the first
   pass, not the last word. Values are stored un-normalized; the final floor pass (D8) shifts art +
   keypoints, and since boxes are feet-relative they need no re-measure.

---

## 16. Context cache — one Gemini cache per character (the token-cost spine)

Because text (Gemini) and images (nano-banana) are the same provider, the wizard maintains **one
cached context per character** and every call references it instead of re-uploading:

- **Seed the cache at D1** with the **stable, reused** inputs: the inspo photo, `tools/style.md`
  (style base + frame rules), and the character-flavor line. These never change per character → cache
  once, pay once.
- **Grow it at milestones:** append the approved **canonical** image + the **character bible JSON** as
  it's finalized (identity, lore, kit, pose-prompt bible). Later image prompts ("same character as the
  cached reference, now …") lean on the cached canonical for consistency without re-sending it each call.
- **What references the cache:** the design draft (T1), every single-item reroll, and every image gen
  (canonical, portraits, KO, all sprite batches, specials, fatality). Only the *delta* (the specific
  pose instruction + the immediate ref image for a ref-chained cell) is sent per call.
- **Persist the cache id** in `<id>.creator.json` so resuming the wizard (or a reroll days later) reuses
  it. Cache lifetime is bounded — on expiry, re-seed from the same stable inputs (deterministic).

Net effect: character reasoning is paid **once** (T1), the heavy inputs are uploaded **once** (cache
seed), and the long tail of image + reroll calls carries only small deltas.

---

## 17. The prompt map — all "prompt magic", when it's created, where it batches

**Key move: ONE big Gemini text call (T1) at D1 emits the entire prompt bible** — not just the kit and
copy, but *every downstream image prompt* (canonical, each normal, each special phase, portraits,
fatality panels, stage) plus the stage-music prompt and all VO text. So character reasoning is a single
billable call; everything after is **pure execution of pre-written prompts** against the cache. Rerolls
draw from over-generated pools (§13) — usually zero additional LLM calls.

**T1 · Design-draft (Gemini text, D1 submit) — the one big call. Emits:**
- `archetype, color, physics, lore{tagline,personality,backstory}`
- `moves` (27 normals w/ frame data) + `specials[4]` + **`specialPool[]`** (extra names/desc/archetype/
  controls for instant rerolls)
- `winQuotes[6+]`, `vo{kiai[6],hurt[6],victory[4]}` (+ a few extras each)
- `fatality{concept,input,panelPrompts[4]}`
- `stage{guess, imagePrompt, musicPrompt}`
- **`imagePrompts{}`** — the pose bible: canonical, idle-a/b, walk-a/b, the 5 pose bases, 9 standing +
  6 jump + 6 crouch normal prompts, and per-special {projectile, active, startup, recovery}.

| # | Prompt | Created | Executed | Engine | Refs (beyond cache) | Output |
|---|---|---|---|---|---|---|
| I1  | Canonical | T1 | D1 | nano-banana | inspo photo | `raw/canonical/<id>.png` |
| I2  | Portrait icon | T1 | D3 bg | nano-banana | canonical | `portraits/<id>.png` |
| I3  | KO portrait | T1 | D3 bg | nano-banana | canonical | `portraits/<id>-ko.png` |
| —   | Bust | — | D3 bg | crop (no gen) | canonical + head kpts | `portraits/<id>-bust.png` |
| I4  | idle-a/b, walk-a/b | T1 | D4-B1 | nano-banana | canonical | 4 cells |
| I5  | jump/crouch/block/fall/down | T1 | D4-B2 | nano-banana | canonical (+LOW/LYING) | 5 base cells |
| I6a | 9 standing normals | T1 | D4-B3 | nano-banana | canonical | 9 cells |
| I6b | 6 jump normals | T1 | D4-B3 | nano-banana | **approved jump img** | 6 cells |
| I6c | 6 crouch normals | T1 | D4-B3 | nano-banana | **approved crouch img** | 6 cells |
| I7  | per special ×4: proj→active→startup→recovery | T1 | D5 | nano-banana | proj: inspo only · phases: prior phase | ~4 cells/special |
| I8  | 4 fatality panels | T1 | D3 bg | nano-banana | canonical + generic victim | `fatalities/<id>/*.jpg` |
| I9  | Stage | T1 | D2 | nano-banana | **salton style-ref FIRST** + user refs | `backgrounds/stages/<id>.jpg` |
| I10 | per-move VFX (opt) | T1 | D7 | nano-banana | magenta screen | `sprites/<id>/vfx-*.png` |
| A1  | Announcer name | T1 | D3 bg | ElevenLabs TTS | — | `announcer/<id>.mp3` |
| A2  | 16 VO lines | T1 (text) | D3 bg | ElevenLabs / Fish clone | voice sample if BYO | `voice/<id>-{kiai,hurt,victory}-N.mp3` |
| A3  | Stage music | T1 (text) | D2 | ElevenLabs `compose` | — | `audio/music/stages/<id>/*.mp3` |

**Where batching cuts cost:**
1. **T1 is the batch** — all reasoning + every prompt string in one Gemini call against the seeded
   cache. No per-asset "write me a prompt" round-trips.
2. **Over-generate pools in T1** (specials, quotes, VO) → rerolls are pool draws, not calls; exhausted
   pools fall back to the shared `moveIdeas.json` before ever hitting the LLM again.
3. **Context cache (§16)** — heavy inputs uploaded once; every image/reroll sends only its delta.
4. **Optional grid-gen lever** — nano-banana can emit an N×N grid in a single call (proven by the
   hit-spark grid generator). A batch of same-ref normals *could* be one grid call sliced on import
   (big cost cut) — but per-cell gen keeps quality + single-cell reroll cleaner. Offer grid-gen as an
   opt-in "fast/cheap draft", per-cell as the default. (Decision noted, not locked.)
5. **Image calls themselves aren't token-text** — the cost there is per-image; batching help comes from
   the cache (no repeated ref uploads) and from not regenerating (pools + advisory-only QA).
