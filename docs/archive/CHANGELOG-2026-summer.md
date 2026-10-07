# Changelog — 2026 summer (archived 2026-10-06)

> **Archived verbatim** from `SPRINTBOARD.md` (its `## Changelog` section,
> 2026-07-01 → 2026-10-06) by P1.1 of `docs/handoff/02-PLAN.md`. History,
> not current truth: claims below were true when written. Since P1.1 the
> per-commit changelog rule is retired — **git log is the changelog**.

<!-- verbatim below this line -->
## Changelog

*(newest first; add one entry per commit: date · scope · what changed · by whom/agent)*

- **2026-10-06 · docs · P6 shipped; P1 branch ready** — PR #3 merged and
  verified live (750/750 assets 200, media immutable); P6 branch deleted;
  `docs/p1-truth-in-docs` created; the P1 prompt points at it. — Claude (Opus 5.5)

- **2026-10-06 · infra · GitHub Pages unpublished (P2.5 done)** — the user
  deleted the Pages site; the API and drmbt.github.io/martian-kombat return
  404. martiankombat.com is the only public build. — Claude (Opus 5.5)

- **2026-10-06 · docs · P1 handoff + P2.5 status** — new
  `docs/handoff/05-NEXT-SPRINT-P1.md` (truth-in-docs sprint prompt, with
  re-measured sizes: SPRINTBOARD 3,763 lines / 260 KB, CLAUDE.md 461 / 30 KB);
  02-PLAN P1 refreshed. P2.5: the user approved unpublishing GitHub Pages but
  the agent's DELETE was blocked by the permission classifier — the user runs
  it. — Claude (Opus 5.5)

- **2026-10-06 · docs · 02-PLAN status refresh** — P0 marked ✅ in the status
  table (all five items were done); P2/P3/P4/P9 show their completed items;
  §0.4 branching, P0.5 and P1.7 now state the confirmed deploy path (Workers
  Builds from `main`, per-branch previews, one PR per sprint) instead of the
  retired "stack on feat/mks1-rescue-handoff"; P2.5 notes the README half is
  done. — Claude (Opus 5.5)

- **2026-10-06 · docs · README plays martiankombat.com (P2.5, part)** — the
  PLAY NOW link pointed at the frozen 2026-07-07 GitHub Pages build.
  Unpublishing Pages itself waits for the user's go-ahead. — Claude (Opus 5.5)

- **2026-10-06 · scenes/tools · one persistent asset loader, HTTP-only
  prefetch, eviction, versioned media (P6.1/P6.2/P6.6)** — on-demand loads
  run on the never-stopped `AssetHostScene` and settle per file (no more
  stranded promises / 12 s Versus waits); prefetch only warms the HTTP cache
  (≤ 2, paused in fights, off on data-saver/touch); fights and Select evict
  sheets they don't show; every media URL carries `?v=<sha8>` from
  `gen-asset-manifest` and `_headers` caches media `immutable`. Menu/attract
  memory 1.2 GB → ~125 MB RGBA; hang repro 12 s → 0.04 s. — Claude (Opus 5.5)

- **2026-10-06 · scenes · pause menu keyboard nav (P2.3)** — while paused,
  either player's bound directions plus arrows/WASD move the selection and any
  bound attack key or ENTER confirms (ENTER no longer also jumps to char
  select underneath). Browser-verified: ESC → ↓/S/↑ → ENTER restarts; P1 LP
  and P2 MK resume. — Claude (Opus 5.5)

- **2026-10-06 · assets/tools · Ben's sheet re-gridded under 4096 px + lint
  (P6.5)** — 1728×4224 (6×11, over many mobile GPUs' texture max) → 2016×3456
  (7×9) by `tools/regrid-sheet.mjs` (cells re-tiled in order, verified byte-
  identical; meta cols/rows updated). `fitGrid()` in `tools/core/cells.mjs`
  now picks every packer grid (CLI, dev `/__editor/pack`, creator SHIP) so no
  repack can exceed 4096; `assets.audit.test.ts` fails any sheet > 4096 px or
  whose size disagrees with its meta grid. Dev sheet-write endpoints also
  alpha-clean (P6.3). — Claude (Opus 5.5)

- **2026-10-06 · tools/assets · zero RGB under alpha = 0 in every sprite
  sheet (P6.3)** — dependency-free PNG codec `tools/core/png.mjs`; the packer,
  `mugen:sprites` and the dev sheet-write endpoints now zero the chroma-key
  RGB hidden under fully transparent pixels; one-time `tools/clean-alpha.mjs`
  cleaned the committed sheets: **125.2 → 67.4 MB** (19 sheets incl. kfm/rj/
  tao), each asserted alpha-identical and RGB-identical wherever A > 0.
  `mugen:sprites` reproduces the committed KFM sheet byte-for-byte. — Claude (Opus 5.5)

- **2026-10-06 · repo · remote branch cleanup (P9.1)** — deleted
  `feat/mks1-rescue-handoff`, `feat/character-studio`, `flo-char`,
  `spike/3d-renderer`, `marzi-char`; kept `feat/3d-mode`. — Claude (Opus 5.5)

- **2026-10-06 · docs · next-sprint handoff** — `docs/handoff/04-NEXT-SPRINT.md`
  (P6.1/6.2/6.3/6.6/6.5 on `perf/p6-loading-memory`); P2.2 verified live
  after the PR #2 deploy. — Claude (Opus 5.5)

- **2026-10-06 · data · Kung Fu Man scaled into the roster's height band** —
  his port mapped MUGEN's 93-px stand height to our tallest hurtbox (284), so
  his idle art stood 323 world px vs the roster's 201–279 (median 246);
  `scale: 0.79` (in `kfm.unlock.json`) resizes art + boxes + reach together →
  ~255. Parity test compares the unscaled JSON to the port. — Claude (Opus 5.5)

- **2026-10-06 · compat/tools/data/scenes/net · Kung Fu Man secret
  unlockable (D-KFM)** — SFF v2 sprite decoder + `npm run mugen:sprites`
  convert KFM's real MUGEN art (kfm720) into our sheet (wide 592-px cells via
  a per-character `cellW`) + portraits, and write `kfm.json` from the bench
  port (parity-pinned). Roster `secret` entry behind a "???" select tile:
  confirming it unlocks him for both players (online `unlock` message,
  remembered per browser). CC BY-NC: the game stays non-commercial while he
  ships. Staging documented (per-branch Cloudflare previews). — Claude (Opus 5.5)

- **2026-10-06 · engine/data/scenes/net/tools · pre-ship bug-fix pass** —
  trades resolve against the start-of-tick state (slot 0 no longer always
  wins; strike beats grab, grabs clash); SOCD cleaning in the engine (L+R =
  neutral, U+D = up); 3D is DEV/`?3d=1`-only and a saved 3D setting boots 2D
  (the title L/R trap); rematch moved from R (P1 light punch) to SPACE, all
  end-of-match keys wait for the KO arming delay; Cloudflare missing files
  404 instead of index.html; Ben/Earl throws work; 8 grabs reach the whole
  roster + a `grabFloor` in the kit grammar; 4 never-connect normals boxed on
  their real striking limb (MKS-1 errors 14 → 2); online compat hash =
  sim-only data + stage arenas + an engine fingerprint (PROTO 2) and
  `hashState` covers charge/dash/combo/buffer. 445 tests. — Claude (Opus 5.5)

- **2026-10-06 · tools/assets/tests · all 27 stages ultra-wide (D9
  complete)** — the last six stages shipped (mimos, painted-canyon,
  shipwreck, last-resort, saturn, ski-inn). `gen:outpaint` sides mode now
  corrects the model's regrade with a colour map fitted on the context it
  re-painted + a per-row residual faded over 240 px from the join (fixed
  last-resort's grey seam from an existing pass, no new call); `--from
  left=N,right=M` reuses a good side from an earlier try so only the bad
  side re-rolls; per-side `left`/`right` prompt text in
  `tools/stages-wide.mjs` + a global no-cloning / keep-the-sky line stopped
  the saturn + ski-inn left passes copying their signs. New audit: every
  registered stage must have `stages-wide/<id>.jpg`. ~76 image calls for
  all of D9. No R2 writes (P8.17). — Claude (Opus 5.5)

- **2026-10-06 · scenes/data/tools/assets · SF2 scrolling camera ON by
  default + ultra-wide stages (D9)** — every real fight (not the dev
  editors) runs `MatchRules.camera` with the arena from `stageArena(id)`
  (a pure function of stage id + build, so online peers agree); FightScene
  pins the HUD (`gfxScreen`, scroll factor 0) and draws the stage as a world
  object (tall art bottom-anchored). `tools/gen-outpaint.mjs` became a batch
  tool (`--all`, tall-source auto-pick, review flag, `--ship`) with per-stage
  style/edge prompts in `tools/stages-wide.mjs`; 21/27 stages reviewed +
  shipped to `public/assets/backgrounds/stages-wide/` (the rest in
  progress). Asset manifest gains `stageWide`; `withBackoff` retries network
  errors + env-tunable. No R2 writes (P8.17). — Claude (Opus 5.5)

- **2026-10-06 · engine/tools/docs · decisions D1–D10, MUGEN jump + charge,
  scroll prototype, outpaint test** — engine adopts MUGEN semantics (no
  takeoff-tick friction, `JUMP_SPEED_MULT` 1.4 keeps distances; charge =
  60-tick 4-way hold + 10-tick release window), KFM re-fit; optional
  `MatchRules.camera` (MUGEN/SF2 horizontal scroll, default off);
  `gen:outpaint` (two-pass side outpainting, incl. tall art) and
  `playtest:video` (fixed vs scroll comparison renders); `geminiImage`
  takes `imageSize`. Decisions + backlog in `docs/handoff/02-PLAN.md`.
  425/425 tests. — Claude (Opus 5.5)

- **2026-10-04 · docs/handoff · unified plan + machine-move pass-off** —
  merged the parallel full-repo audit (P0–P11) and the MKS-1 roadmap into
  `docs/handoff/02-PLAN.md` (one backlog; MKS-1 B–E mapped onto P3/P4/P10,
  new decisions D8–D10); wrote `01-OLD-MACHINE-PASSOFF.md` (canonical-anchor
  list incl. ben/tao/rj with no git fallback, verified `.gitignore` rules,
  private R2 `martiankombat-raw` contents spec, raw-sync contract, MKS-1
  determinism cross-check) and `03-NEW-MACHINE-RESUME.md`; archived the
  audit's original three docs in `docs/archive/handoff-2026-10-04-audit/`.
  Branch `feat/mks1-rescue-handoff`. — Claude (Opus 5.5)

- **2026-10-04 · bench/compat/engine/docs · Sprint 28 Phase A — MKS-1
  standards + MUGEN/IKEMEN parity** — researched M.U.G.E.N / IKEMEN GO
  (verified semantics against IKEMEN's MIT source) and built: the
  `src/bench/` frame-data lab (engine-measured startup/advantage/pushback/
  physics, verified combo finder, infinite verifier), MKS-1 bands + hard
  rules + CI ratchet (`balance.audit.test.ts`, 14 known errors in
  `baseline.json`), `src/compat/mugen/` parsers + porter, `npm run bench` /
  `mugen:fetch` / `mugen:import`, and a Kung Fu Man port at 100% measured
  parity (`src/bench/reference/`, bench-only, attributed CC BY-NC) guarded
  by `parity.test.ts`. Engine: optional per-move `hitstop`
  ([attacker, victim]), `chip`, `blockKnockback` (+ vitests; defaults
  unchanged). Findings: 4 never-connecting normals, 2 unperformable throws
  (earl/ben: no `input`), 6 throws that can't reach some opponents, vincent + ben infinite
  light loops (vincent's lk/clp/cmk drifted to 2f/12-active), and engine
  quirks (takeoff friction, charge needs 43 ticks, buffer expires in
  hitstop ≥ 9). Docs: `docs/FIGHTING_STANDARDS.md`, generated
  `docs/FRAME_DATA.md`, CLAUDE.md section, skills fighting-game-standards +
  mugen-import, bench gates in move-authoring/new-character. No roster data
  changed. — Claude (Opus 5.5)

- **2026-07-18 · audio · pre-buffer the menu theme at boot** — the menu music is
  HTMLAudio (separate from the Phaser loader) and only started fetching when
  MenuScene first called `playMusic('menu')`, so a fresh load had a cold
  buffering wait before the theme came in. Now `initMusic()` is kicked from
  BootScene.preload() (parallel to the essential asset loads, not after), and
  the moment the music manifest lands it `warmMusic('menu')` pre-buffers a menu
  track WITHOUT playing it. `start()` reuses that warmed element when the
  ctx+file match, so the theme plays the instant it's requested / autoplay
  unblocks on the first gesture. Verified: `menu/title.mp3` now begins loading
  at the very start of boot (before the announcer files). tsc + 379 tests clean.
  — Claude

- **2026-07-18 · scenes · pre-fight loading bar + asset-load inspector logging**
  — the VS screen now shows a real "STREAMING FIGHTERS… N%" progress bar
  (fraction of the fighter/VO/stage jobs resolved); on a warmed/repeat matchup
  it's instantly full and vanishes, so the remaining wait reads clearly as VS
  pacing, not a download. AssetLoader now logs to the console: `↓ load <group>
  (N files)`, `✓ ready <group> <ms>`, `· cache <group>` (already on disk), and
  exposes `window.__mkAssets()` → `{sprite, vo, fat, stage}` lists of what's been
  pulled locally. Confirmed the persistence question: a repeat matchup logs ZERO
  re-loads (the `done` set short-circuits before touching the loader) and the
  fight boots instantly from cache — assets DO persist in-session (Phaser cache)
  and across reloads (browser HTTP cache, `max-age=604800` per `_headers`); the
  re-run wait is the versus-clip pacing, not re-downloading. tsc + 379 tests
  clean. — Claude

- **2026-07-18 · scenes · progressive background prefetch (load-everything,
  prioritized)** — replaced the "load on select/versus" approach with a global
  background sweep that streams the WHOLE game in after the menu appears, in
  priority order, so by the time the player navigates it's already warm.
  `AssetLoader.prefetchAll` runs on the PERSISTENT Volume overlay's loader (the
  one scene that never shuts down, so it survives Boot→Menu→Select→Fight),
  kicked off 600ms after that overlay mounts. Tiers, high→low: stage thumbnails
  (small, fast) → fighter sheets (idles) → VO → fatality panels; each tier is
  concurrency-limited (6/4/3/3) and every asset is capped by a 20s timeout so a
  hung/404 download can't stall the sweep or block later tiers. On-demand
  selection loads (highlight→sheet, picker→stage, lock→VO) run on the ACTIVE
  scene's loader and, via the global dedupe, PREEMPT the sweep — a player's pick
  always jumps ahead. Removed the now-redundant per-Select bulk prefetch.
  Verified locally: the sweep starts from the menu (no nav) and loads all 18
  sheets; tsc + prod build + 379 tests clean. (Full loop-driven progression is
  only observable on a focused browser — a backgrounded tab pauses Phaser's
  step, which pauses the loader's file processing.) — Claude

- **2026-07-18 · scenes · lazy-load fixes (stage thumbnails, idle prefetch, VS
  never-hangs)** — deployed-build follow-ups to the lazy-load work, found by
  testing martiankombat.com: (1) the CHOOSE STAGE grid showed BLANK tiles —
  stage backgrounds weren't boot-loaded anymore and the picker never requested
  them; now `openStagePick` lazy-loads each `bg-stage-*` and drops the thumbnail
  in as it streams (verified: 27 tiles populate). (2) Sidebar idle animations
  were slow/absent on a cold connection (stuck on the head-portrait placeholder
  until the on-highlight sheet landed); Select now BACKGROUND-PREFETCHES every
  playable fighter's sheet on open (deferred 500ms so the highlighted two get
  the pipe first), so idles fill in and the versus hand-off is warm. (3) REAL
  regression: `VersusScene.startFight` awaited `ready` unbounded, and the 20s
  safety timer routed through it too — a stalled sheet/VO/stage download froze
  the VS screen FOREVER. Now it races `ready` against a `READY_CAP_MS` (12s)
  cap and shows a "STREAMING FIGHTERS…" line, so the fight always starts
  (FightScene.preload re-queues misses, degrades to capsules). 379 tests green,
  tsc + prod build clean. — Claude

- **2026-07-18 · infra/scenes · lazy asset loading (small boot, stream on
  demand)** — boot no longer downloads the whole game. `BootScene.preload()`
  now loads only the light menu set (portraits/busts/KO, world map, salton
  fallback bg, spark VFX, announcer, SFX ≈ 10 MB); the ~180 MB of per-fighter
  **sheets**, per-stage **backgrounds**, per-fighter **VO**, and **fatality
  panels** stream on demand via new `src/scenes/assetLoader.ts` +
  `assetQueue.ts` (promise-deduped, data-driven off `ROSTER` + character JSON).
  Wiring: Select highlight → sheet (head-portrait placeholder until the idle
  lands); lock-in → VO; stage-pick → bg. Versus pre-warms both fighters + stage;
  `FightScene`/`FightScene3D.preload()` is the hard barrier for every entry path
  (dev launch / Studio TEST / arcade / online-direct), instant when warmed.
  **Fatality panels load in the background DURING the fight** (per Vincent).
  VO requests gate on `VO_FIGHTERS` (playable roster) so a WIP/Studio draft's
  absent VO never 404-throws. Verified in-browser: boot pulls 0 sheets/stages/
  VO/fatalities; select streams only the highlighted fighter's sheet; a full
  match renders real sprites + stage + all 8 fatality panels mid-fight. Docs:
  new "Lazy asset loading — the load contract" in CLAUDE.md + notes in
  ASSET_CHECKLIST, the new-character skill, and CHARACTER_STUDIO (adding a
  character stays ZERO loader code, both pipeline + Studio SHIP). 379 tests
  green, tsc clean. — Claude

- **2026-07-14 · infra · Cloudflare Workers deploy (martiankombat.com) +
  asset diet** — moving hosting from GitHub Pages to **Cloudflare Workers
  Static Assets** (registrar + R2 all on Cloudflare; R2's zero egress is
  the win for an asset-heavy game). Added `wrangler.jsonc` (assets-only,
  `directory: ./dist`, SPA fallback — `name` must match the dashboard
  Worker) and expanded `.env.example` (VITE_ASSET_BASE for the future R2
  asset origin; CLOUDFLARE_/R2_ vars for CLI/CI + uploads, NOT needed for
  the dashboard build's own "build token"). **Workers/Pages both cap assets
  at 25 MiB/file + 20k files** — three fixes: (1) deleted `public/assets/
  meshes/` (333 MB FBX zips) + `public/assets/animations/` (77 MB FBX) from
  the served bundle — both were 100% unreferenced dead weight, moved to the
  gitignored `assets/raw/unused-3d-sources/`; (2) the three 30 MB character
  GLBs exceed the cap and the runtime GLTFLoader has NO Draco/meshopt
  decoder, so they're excluded from the upload via `public/.assetsignore`
  (`assets/3d/`) and kept in public/ for local dev; (3) the 4 `mesh3d`
  roster flags flipped off so 3D reads "SOON" — no broken 404 path ships.
  **TODO to restore 3D:** serve `assets/3d/` from R2 (custom domain
  `cdn.martiankombat.com`), add the `VITE_ASSET_BASE` seam in BootScene +
  threeAssets, re-enable the 4 mesh3d flags. The old `.github/workflows/
  deploy.yml` (GH Pages) still fires on push to main — remove it or it
  double-deploys. — Claude (Opus) + Vincent

- **2026-07-14 · assets+data+tools+docs · VO emotion system, roster lore
  backfill, and RJ v2 "The Living Skeleton" REBUILD** — three threads.
  **(1) Roster lore backfill:** every playable fighter now carries an
  `arcade: {motivation, ending}` block (16 authored from the Mars People
  lore sheet — only tao/rj had one) and an inline `lore:
  {tagline,personality,backstory}` (14 added). Vanessa's win quotes were
  chatbot-toned against a High-Priestess identity — reconciled; ben/earl/
  freeman/tao expanded off the 3-quote floor. Home stages assigned: tao →
  `institute`, rj → `last-resort`, ben → `dome`. NOTE: **flo has no row on
  the lore sheet** — her lore/arcade are DERIVED from Vincent's entry and
  marked inline; confirm the canon.
  **(2) VO emotion control (`tools/core/vo-emotion.mjs`, `docs/VO_EMOTION.md`):**
  Fish S1 reads a leading `(tag)` as an expression control it performs but
  never speaks. `withEmotion(charId, category, text)` resolves a tag from
  **context × temperament** (kiai→exertion, hurt→pain, victory→triumph,
  crossed with a per-fighter TEMPERAMENT table) and `gen-audio`'s `speak()`
  applies it — **on the Fish clone path ONLY**; ElevenLabs would read
  "(excited)" out loud. A leading `(raw)` is an explicit no-tag escape. Tags
  live in `gen-audio` `voiceLines` (synth recipe); the character JSON `vo`
  stays clean display text. Cloned + baked chebel/freeman/gene (64 clips,
  16 per-move call-outs) via an iterative soundboard-audition loop.
  **(3) RJ v2:** v1 "The Gatekeeper" archived to
  `assets/archive/rj-v1-gatekeeper/` + offlined, then rebuilt from new
  photos/voice sample and his (much weirder) LinkedIn persona — a deadpan
  erudite desert raconteur who calls himself a living skeleton above a
  miasma of ghosts. New canonical (dark beard, henley + black waistcoat, NO
  gun/ghosts), icon, bust, tilted KO; 62-cell sheet (bare-fisted boxer
  normals — the v1 manifest swung the BB gun in every normal); kit rewired
  to real plumbing — BB Gun (qcf projectile), Excavator Charge (bf rush),
  **World's Tallest Ghost is now the dp anti-air** (was a projectile), new
  **Rattlebones** hcb command grab (skeleton bear-hug, replaces
  scatter-flock), Evicted throw. 21 VO clips through a fresh clone; new
  **"For The Birds"** fatality (lighter → burnt husk → birdseed →
  Hitchcock pigeon swarm → he spits on the torso). Re-onlined; 379 tests
  green. `defeatPrompt` now forces the KO head-tilt. Skills updated
  (new-character, sprite-generation, sprite-qa).
  **Still open on RJ:** QA flags 4 cells Vincent hand-edited and I did NOT
  overwrite — `mp-active`/`hp-active` have **no reach** (fists barely pass
  the idle guard, so those hitboxes are honestly short) and `idle-b`/
  `walk-b` are near-identical to their partners (idle/walk won't visibly
  animate). Re-roll when convenient. `rj-kiai-5` ("Hyee-YAH!") was an
  inferred pick — Vincent never named a letter. — Claude (Opus) + Vincent

- **2026-07-09 · ui+assets+data · studio input fixes + boss raw frames +
  roster dial-in** — ENTER no longer dumps the studio to character select
  (fightShell's training-exit guard gained the missed `studio` flag) and
  the un-stepped number inputs beside sliders (Sprite Editor `slider()`,
  Move Tuner `numField()`) now honor fractional steps — character scale
  moves by 0.01 instead of browser-default integers. Committed the rj/tao
  raw source frames (assets/raw/frames/ is the one raw dir git KEEPS) and
  Vincent's in-studio tuning pass: catherine + yulia re-packed sheets/meta
  (sprite-size dialing) and scale/kit tweaks in catherine/freeman/rapha/
  yulia JSONs. — Claude (Fable) + Vincent

- **2026-07-08 · assets+data+tools · RJ "The Gatekeeper" SHIPS — 18th
  fighter, Tao's first hench goon (the Sagat analog), built AUTONOMOUSLY**
  — Vincent's brief: "look RJ up and pull it off." Research pass (web +
  lore sheet) found only the repo's own "Rapha (RJ's raccoon-wrangler)"
  breadcrumb; the first build interpreted RJ as the town RACCOON (full
  asset run: canonical/frames-in-flight/VO/Trash-Day fatality/icon) before
  Vincent supplied the real inspo photos + facts (ghost artist — World's
  Tallest Ghost — bird fosterer, BB gun, excavator). Raccoon assets purged,
  rebuilt from the photos: canonical (straw hat, denim, BB gun, belt ghost
  charm, ghost-flame aura — compact guard ✓), 62 cells + BB-pellet +
  tallest-ghost projectiles, "World's Tallest Ghost" fatality (the loser
  is draped, hoisted, and becomes the newest installation), stock gruff VO
  (Daniel low-style) + "R J!" announcer, square icon/bust/KO, kit =
  the Sagat mapping (BB Gun ↔ Tiger Shot, Scatter Flock dp ↔ Tiger
  Uppercut, Excavator Charge ↔ rush, Tallest Ghost trap, "Evicted" throw)
  with full grammar via core/kit.mjs, arcade gatekeeper story. Pipeline
  fixes found by the run: gen-frames' low-pose anchor now covers the
  `down` cell (unanchored, the model stood the KO pose back up — one
  reroll burned proving it), gen-icons falls back to the canonical for
  photo-less fighters. KNOWN QUIRK: `gen:busts --all` re-crops (byte-
  churns) every existing bust each run — roster busts restored from HEAD
  twice; make portrait_crop skip-existing sometime. Verified live: RJ vs
  TAO on salton, zero console errors, BB Gun + Tallest Ghost both spawning
  projectiles in-engine. 379/379 vitest, tsc + prod build clean. — Claude
  (Fable)

- **2026-07-08 · assets+data+tools · THE DOGFOOD RUN: TAO SHIPS — 17th
  fighter, the arcade end boss, ZERO rerolls** — prompt-craft fixes first
  (user-directed): portraitPrompt/defeatPrompt(+soft) are now SQUARE
  straight-on headshots; a new COMPACT_GUARD clause in both canonical
  builders bakes the §2.9 arm gate INTO the prompt (an extended arm ruins
  every punch's reach); tao's flavor carries his age (early 50s, grey
  temples — do NOT make him look young). Canonical regenerated to spec
  (compact conductor's guard, aged, embroidered burgundy suit, gold FX) and
  the §2.9 anchors vision-verified (crouch properly low, jump tucked).
  Full pipeline, all real API: 62 frame cells + 2 projectiles (montage QA:
  walk strides mirror, sweep low, KO lying head-left, throw alone,
  projectiles isolated + keyable — NOTHING rerolled), pack --normalize with
  62/62 fresh RTMPose skeletons (meta v2) — and the CLI pack now infers
  skeletons whenever --normalize runs (it silently shipped skeleton-less
  sheets for new fighters before; migrate-floor was the only caller that
  passed the flag); 18 button normals skeleton-refit (migrate-hitboxes
  --char tao); square icon + pose-centered bust + square KO; 16 VO clips +
  announcer "TAO!" + 5 per-move call-outs ALL through his Fish clone
  (whisper-verified: "The performance is over." / "Crescendo!" / "Smile!");
  "Final Critique" fatality (4 panels: director's frame → paparazzi flash →
  gallery-piece disintegration → the placard walk-away); tao.json hand-
  scaffolded from the design draft through core/kit.mjs grammar (chains/
  cancels/L-H variants, techable throw "The Dismissal", 1050 HP boss
  health, arcade motivation/ending persisted); gen-icons face probe accepts
  .png; announcer name table gained earl/ben/tao. haidai resurrected AGAIN
  via gen:busts --all (stale raw canonical) — orphan bust deleted, raws
  quarantined to assets/raw/retired/. Verified live: tao vs CPU gene on
  hyperion, zero console errors, knockdown/getup states, Paparazzi Flash
  projectile fired and CONNECTED (960→816). 372/372 vitest (audit + schema
  lint hold the 17-fighter roster), tsc + prod build clean. Outstanding:
  home stage (needs Biennale reference photos), optional per-move vfx.
  — Claude (Fable)

- **2026-07-08 · ui+tools+data · dogfood feedback batch 2 + TAO the end
  boss** — (a) privacy opt-out gate + lore-sheet search RETIRED (Vincent:
  not needed for this game) — core/lore.mjs + its tests deleted, gates
  stripped from the design endpoint / jobs enqueue / studio:run, CLAUDE.md +
  new-character/move-authoring skills + voice-inspo README updated.
  (b) canon-import fix: /__editor/creator/canon now returns the raw
  canonical (assets/raw/canonical — regens previously ran with NO reference
  for canon fighters), all real VO clips + per-move call-outs from
  public/assets/audio (silence placeholders filtered by size), and loadCanon
  registers them — gene verifies canonical ✓ + VO 17/17 ✓ (was ⚠/0).
  (c) the moves/animation player moved OUT of the wizard dialog into a
  lower-left dock beneath the live fighter. (d) ARCADE STORY STUB: character
  JSONs + DesignDraft carry `arcade: { motivation, ending }` (SF2-style
  intro + post-credits scene), the design-draft LLM writes them (world
  framing: through Mars College's Off Grid world into Bombay Beach, past
  RJ the hench goon — Sagat analog — to TAO the end boss — M. Bison
  analog — Champion of the Bombay Beach Biennale), PROFILE edits them;
  vision documented in CLAUDE.md + the arcade RFE + new-character skill;
  creatorDesignPrompt moved to core/prompts.mjs (designPrompt — one copy
  for vite + headless). (e) §2.8 auto-fire hazards FIXED: entering PROFILE
  no longer fires the 11-cell base batch (it burned a mock run today —
  would have been real money), stage-photo drop no longer auto-generates.
  (f) **TAO PROFILE GENERATED** (end boss): full-body inspo promoted to
  tao.jpg, boss FLAVOR/FACE in gen-canonical, Fish voice clone registered +
  whisper-verified ("You fight for art? I am the patron of art…"), real
  design draft (zoner; Paparazzi Flash cbf / Director's Cut trap / Duende
  Kick dp / Maestro's Advance hcf; per-move call-outs "Smile!"/"Action!"/
  "¡Olé!"; "Final Critique" fatality; arcade motivation/ending in his own
  voice) + canonical (burgundy embroidered suit, gold filigree FX, §2.9
  gate passed) — assembled as the WIP draft assets/raw/creator/tao/,
  verified loading in the studio. 366/366 (lore tests removed), tsc + prod
  build clean. — Claude (Fable)

- **2026-07-08 · tools · Sprint 27 Phase 4 foundation: backoff + mock mode +
  lore gate + jobs runner + headless auto-pilot** — (a) `withBackoff` in
  tools/lib.mjs: every provider helper (geminiImage, new shared geminiText,
  elevenTts/Sfx, fishTTS, openaiImage) retries 429/5xx with exponential
  backoff + jitter — wide pools are finally rate-limit-safe; the vite design
  endpoint's inline Gemini fetch folded into lib.geminiText. (b) MK_GEN_MOCK=1
  $0 mock mode AT THE HELPER LAYER: ffmpeg-drawn keyable figures + silence
  mp3s, so the whole pipeline (CLI + jobs + studio) is E2E-walkable unkeyed.
  (c) `tools/core/lore.mjs`: the Martian Lore sheet as machine-readable —
  public-CSV fetch with disk cache, RFC-4180 parser, fuzzy person lookup, and
  the HARD privacy gate (PrivacyOptOutError + a static offline fallback list)
  enforced at /__editor/creator/design (which now auto-injects sheet lore into
  drafts), the new /__editor/lore endpoint, jobs enqueue-dag, AND studio:run
  entry (verified live: gene resolves, Maya Luna/Roarke REFUSED, exit 2).
  (d) `tools/core/jobs.mjs`: the §2.4 job runner — DAG deps (key-based
  enqueueDag), pooled concurrency, persistence + interrupted-job resume,
  per-job cost accounting, cancel-with-dependent-skip; served by
  /__editor/jobs (list/enqueue-dag/cancel) + an SSE stream; 5 new vitests.
  (e) `tools/core/pipeline.mjs` + `npm run studio:run`: the asset auto-pilot
  DAG over the existing idempotent gen:* scripts (canonical→frames→pack,
  icons/busts/audio/fatality→manifest) with estimated-spend confirm before
  any real fire (--yes to skip, --mock, --only, --force). Mock smoke found +
  fixed THREE latent gen-canonical bugs: the portrait pass ignored --char
  (it resurrected the deleted haidai orphan from stale raws — haidai's
  FLAVOR/FACE entries removed), an undefined STYLE ReferenceError that would
  have crashed any NEW fighter's KO pass, and unknown --char ids being
  silently skipped (new fighters now get flavorless canonicals). Server-side
  runner verified E2E in-browser (SSE snapshot, jobs to done, state
  survives reload). 373/373 vitest (12 new), tsc + prod build clean.
  — Claude (Fable)

- **2026-07-08 · ui · Sprint 27 Phase 3j: creator finishers — field controls,
  rig badges, live-driven preview, Adopt v1** — quotes + kiai/hurt/victory VO
  get per-line add/remove (VO capped at the 6/6/4 on-disk clip contract;
  generated clips REINDEX on remove so `prefix-N` names keep matching their
  texts; VO slot lists + the gap-bar total now derive from the draft instead
  of a hardcoded 17); specials get ＋add/✕remove slots (removed moves return
  to the drafted pool) with the techable throw rendered as the LOCKED 5th
  special — canon rows lock archetype/controls, new drafts get a synthetic
  locked row whose call-out persists as `moves.throw.voiceText`; per-frame
  skeleton badges (⬢/⬡) on the tray cells + a Rig-step "regen missing
  keypoints only (N)" button; the wizard's preview/move buttons moved into
  the studio wizard column (they lived on the DETACHED left preview — dead
  UI in studio mode) and now drive the LIVE fighter via `host.loopMove`
  (idle/walk pseudo-poses, normals, motion specials — verified `attack:lp`
  and the qcf `rate-limit` executing in the live scene; module switch hands
  back manual control); **Adopt flow v1**: opening a canon fighter runs the
  roster-standard upgrade checklist (mirrors the audit/schema-lint: meta v2 +
  normalized, per-cell skeleton coverage, no spriteOffsetY, chains/cancel/
  variants, universal throw, ≥3 quotes, themed fatality, vo texts, per-move
  voiceText, portrait/bust/KO) + a structural WRITE diff of baseDef vs what
  SHIP would write — auto-opens when below standard, reopenable from the new
  gap-bar ⚕ chip; **gene AND catherine verify BYTE-IDENTICAL on
  reopen→write**. Found + fixed in passing: canon `sheetPlan` double-counted
  the throw-* cells (the "skeletons 65/68" gap-bar lie), and the move player
  drew a duplicate THROW button. 361/361, tsc + prod build clean, all flows
  verified in-browser on the mock server. — Claude (Fable)

- **2026-07-08 · data+tools · VO ground-truthing via whisper** — the recovered
  vo texts were spot-checked against the ACTUAL clips (Apple `afconvert`
  decode → whisper-small in the miniconda python — zero ffmpeg dependency;
  NOTE the homebrew ffmpeg broke mid-session on a brew upgrade
  (leptonica→libtiff.5) and the user has since fixed it). vincent/ben/earl
  rewritten from user-reviewed transcriptions ('Ihck!', 'Scheiße!', 'YEET!',
  matrix-teleport + rising-glyph marked '(SFX)'); vanessa verified CORRECT
  (whisper mangles her Portuguese — JSON is ground truth); gene/catherine/
  rapha found TEMPLATE-SHADOWED (stale draft states outranked the real
  voiceLines table) and restored from the table, which gene's clips match
  verbatim; migrate-vo now refuses template drafts. The other 9 fighters'
  texts are correct by construction (clips were generated from those same
  tables). 361/361. — Claude (Fable)

- **2026-07-08 · data+tools+ui · Sprint 27 Phase 3i: dogfood feedback batch —
  VO texts recovered + persisted** (user-directed). THE data-loss fix: the
  kiai/hurt/victory line TEXTS (and per-move call-outs) were never stored in
  character JSONs. New schema: `CharacterDef.vo {kiai,hurt,victory}` +
  `MoveDef.voiceText` (authoring metadata, engine ignores).
  `tools/migrate-vo.mjs` recovered ALL 16 fighters' vo blocks (priority:
  creator draft state.json → the committed gen-audio voiceLines tables →
  .prompt.txt sidecars) + per-move texts for gene/vanessa. STILL LOST (no
  text source anywhere; mp3s exist): vincent's 4 call-outs
  (matrix-teleport/redirect/rising-glyph/throw) + ben's 2
  (hot-coffee/quesadilla) — need human transcription or STT. Going forward
  the creator persists everything: moveAudioText moved onto the MODEL
  (serializes with drafts — it was panel-transient, the root cause),
  buildFullCharacter/buildFromBase write vo + voiceText, canon-reopen
  repopulates the editors from them, and the Gemini design pass now emits a
  lore-specific `voiceLine` per special (seeded into the per-move VO text).
  gen-audio.mjs main guarded behind isMain (importing voiceLines can never
  fire a TTS batch). MORE FIXES from the vincent dogfood: CREATOR
  auto-opens the fight's subject as a canon edit when entered from a
  roster-screen EDIT (wireframe stage = the NEW flow, starts fresh);
  gap-bar honesty for canon fighters — /creator/canon now reports the Fish
  voice clone (tools/voices.json: ben/earl/vincent/vanessa) + whether the
  home stage has music on disk, so those chips stop crying wolf; WIP draft
  DELETE (new /creator/delete-draft + ✕ chips on the roster screen's shelf,
  which now also lists canon-edit drafts labeled); the Phaser
  null-sourceSize crash on older fighters guarded (invalid frame index →
  clamp to 0 instead of killing the render loop). DEFERRED to the next
  passes (recorded from the same feedback): add/remove field controls for
  quotes + kiai/hurt/victory + specials slots (defaults 3/6/6/4/4); throw
  stays a SPECIAL (the 5th default — every fighter must carry one, lint
  enforces); per-frame skeleton badges + a "regen missing keypoints only"
  button (vincent reads 65/68 — likely no-pose cells like teleport
  dissolves); transcribe the 6 lost call-outs; repro the older-char load
  error beyond the guard. 361/361, tsc + build clean. — Claude (Fable)

- **2026-07-08 · ui · Sprint 27 Phase 3h: the creator is WYSIWYG — the fight
  scene IS the preview** (user-directed). CharacterCreatorPanel gained a
  scene-hosted mode: right-docked translucent wizard column, no opaque
  backdrop, its own preview column retired (kept detached so internals
  stay valid). FightScene gained `setStudioSubject(def, meta, canvas)`:
  slot 0 becomes a LIVE DRAFT — def into the live registry, cells on a
  dynamic canvas texture the wizard blits into as generations land
  (fireGen fast-path updates a single cell + refresh; a debounced full
  remount rides render()); placeholder ghost silhouettes stand in from the
  first frame of a fresh SEED and are supplanted cell-by-cell; canon
  reopen inherits the fighter's real sheet/def through the same mount.
  NEW: the `wireframe` dev stage template (programmatic sparse grid —
  horizon, perspective floor, accented FLOOR_Y feet line, scale posts,
  caption; the !hasBg purple fallback no longer paints over it) — NEW
  CHARACTER flows start there; editing an existing fighter opens on their
  home stage. NEW: the completeness GAP BAR under the stepper — ✓/⚠ chips
  for canonical/portrait/KO/cells n/N/throw/skeletons/lore/quotes/VO n per
  17/voice sample/music/fatality n per 4/stage — missing pieces are visible
  at a glance for drafts AND canon-reopened fighters (schema migration
  continues via applyKitGrammar on reopen). Verified live: ghost on the
  wireframe stage with the docked wizard, gap chips, resume + canon-edit
  chips. tsc clean. STILL OPEN (3h polish): preview-control buttons should
  drive the LIVE fighter (loop a move via the host), and a canon-reopen
  live-inherit spot-check. — Claude (Fable)

- **2026-07-08 · ui+tools · Sprint 27 Phase 3g: StudioSelect — the studio's
  roster-manager front door** (user-directed). DEV EDITOR → CHARACTER
  STUDIO now lands on `StudioSelectScene`: every fighter (online AND
  offline) as a portrait card with lifecycle actions — EDIT IN STUDIO
  (jumps to the rail at MOVES), TAKE OFFLINE / BRING ONLINE (new
  `/__editor/roster-flag` rewrites the roster.ts playable flag; offline
  keeps all files but leaves select/loader/audit), EXPORT .ZIP (new
  `/__editor/export-canon` bundles any CANON fighter from disk in the
  /creator/import round-trip layout — json + sprites + portraits + VO +
  fatality + stage art + raw sources), and DELETE… (new
  `/__editor/delete-character`, typed-id confirm: removes json + roster +
  index registrations + all public assets as one transaction, KEEPS
  assets/raw for recovery, rescans manifests). Plus ＋ NEW CHARACTER
  (straight into the CREATOR module), ⤒ IMPORT ZIP (existing import
  endpoint), a WIP-drafts shelf (unshipped creator runs via
  /creator/list), and a RELOAD prompt after roster changes (the boot
  loader reads the flag). The lifecycle work pulled forward from Phase 5
  §2.12 — "online/offline/publish/delete either" per the user. E2E
  verified: roster-flag round-trip byte-clean, vanessa exports a 40MB
  bundle, and a synthetic ztest fighter was created + deleted with zero
  residue (9 asset classes, registrations clean). 361/361, tsc clean.
  — Claude (Fable)

- **2026-07-08 · ui+tools · Sprint 27 Phase 3f: STAGES module** — the rail
  is now CREATOR / SPRITES / MOVES / STAGES / TEST. `src/ui/StagesPanel.ts`:
  the stage registry as a panel (per-stage world-map pin status + home-stage
  owner), a fighter ⇄ home-stage assignment row (writes `def.stage` through
  `/__editor/character`, which grew a validated `stage` field — set or
  clear; verified round-trip on vincent, file byte-identical after
  restore), and a WORLD-MAP PIN EDITOR jump — StagePinEditorScene gained a
  `returnTo` payload so BACK round-trips to the studio instead of dumping
  to the editor menu. Stage CREATION stays in CREATOR → PROFILE (noted in
  the panel); gen-in-flow rides the Phase 4 job runner. Verified live:
  panel renders all 27 stages with pins + owners. 361/361, tsc clean.
  — Claude (Fable)

- **2026-07-08 · ui · Sprint 27 Phase 3d: the creator wizard is a studio
  module** — CharacterCreatorPanel re-hosted as the rail's CREATOR module
  (lazily mounted over the live fight; drafts flush-save on unmount; the
  shimmer CSS + form-key isolation moved INTO the panel so any host works
  — typing in wizard fields can't drive the fight underneath). EditorMenu's
  CHARACTER CREATOR now launches the studio directly at the CREATOR module
  (no fighter pick needed to create one); the standalone
  CharacterCreatorScene stays registered but unrouted (retires in the
  Phase 5 cleanup). Verified live: rail CREATOR/SPRITES/MOVES/TEST with
  the wizard stepper + resume chips rendering, module swaps clean.
  361/361, tsc clean. — Claude (Fable)

- **2026-07-08 · tools+ui · Sprint 27 Phase 3c/3e: kit grammar + projectile
  spawn anchors** — `tools/core/kit.mjs`: THE roster-standard grammar
  (light chains, medium cancels, per-archetype L/H variant generation —
  projectile vx/ttl/damage axes, dp/rush damage+startup+forwardVel, grab
  damage; teleports/reversals/reflectors correctly get none) applied
  non-destructively by `buildFullCharacter` AND `buildFromBase` — a
  creator fighter can never ship mechanically thinner than the roster
  again (unit-verified incl. hand-tuned preservation). Projectile editor
  v1 in the Move Tuner (the MOVES module): spawnX/spawnY/renderSize now
  editable, plus a **spawn ⚓ joint** row — pick any of the ~23 body
  joints from the move's active-cell baked skeleton and SET writes its
  engine-space offset into the spawn (FightScene grew
  jointNamesFor/spawnFromJoint on the shared geometry transform; editor
  working-model joints win over the meta bake). Verified live: vincent's
  sigil-bolt spawn ← Rwri (20, −168). 361/361, tsc clean. Sprint 25's
  "projectiles spawn from a named joint" Phase-2 item: CLOSED. — Claude
  (Fable)

- **2026-07-08 · ui · studio route fix: VersusScene was dropping the flag** —
  User-reported: DEV EDITOR → CHARACTER STUDIO landed in plain training.
  Root cause: the VS-card VersusScene sits between Select and Fight and
  RE-ENUMERATES the fight payload — `studio`/`module` weren't in its list,
  so they silently vanished (the exact hop the first live test bypassed).
  VersusScene now carries them (with a warning comment: every fight flag
  must pass through), fightShell's restart/character-select routes and
  FightScene's shell opts forward studio/module (+ spriteEditor, which had
  the same latent gap on restart). Verified the REAL flow end-to-end in
  the browser: Select picks → stage → Versus → Fight shows CHARACTER
  STUDIO header + rail. 361/361, tsc clean. — Claude (Fable)

- **2026-07-08 · ui · post-migration polish: shadows up + corner volume** —
  With feet floor-normalized, the fighter shadows read low: every shadow
  anchor raised 6px (sprite shadows FLOOR_Y+10→+4, fallback ellipses
  +8→+2) so they hug the soles. VolumeOverlayScene reworked per user spec:
  a speaker BUTTON pinned to the far upper-right (click = mute on/off
  only), with a VERTICAL fader flying out beneath on rollover (top=100%,
  drag to set, auto-closes; unmutes on touch). Move Tuner + Sprite Editor
  panels now start at top:48px so they never cover the speaker (DOM always
  sits over the canvas overlay). Verified live on the van stage. Also
  verified the EditorMenu → CHARACTER STUDIO path end-to-end (rows render,
  Select carries studio:true, Fight mounts the rail + tuner). 361/361,
  build clean. — Claude (Fable)

- **2026-07-08 · ui · Sprint 27 Phase 3b: the Character Studio shell exists**
  — FightScene gained a `studio` mode: `src/ui/StudioRail.ts` (collapsible
  module rail) hosts the existing Sprite Editor + Move Tuner as lazily-
  mounted SPRITES / MOVES modules over the LIVE fight (panels gained
  setMounted; HUD show/hide extracted to setHudVisible); TEST deactivates
  everything for pure play with the F1/F2/F3 overlays. EditorMenu now leads
  with CHARACTER STUDIO, and MOVE TUNER / SPRITE EDITOR are deep links into
  the studio at their module (one implementation, many doors); Select
  forwards studio/module flags. Verified live: rail renders, modules mount/
  unmount + swap cleanly, TEST restores P2 + HUD, kirby loops with
  registered skeleton/boxes. 361/361, tsc clean. Legacy tuner/spriteEditor
  entry flags still work (unchanged paths). — Claude (Fable)

- **2026-07-08 · data+assets · Sprint 27 Phase 3a: schema backfill — the
  roster standard is universal** — ben + earl gained chains/cancel/L-H
  variants (gene idioms) and themed hand-authored fatalities generated from
  their creator canonicals (ben "Dinner's Ready", earl "The Final Mix" — 8
  images, the approved budget; generic finish-* panels deleted); vanessa
  gained her win quotes. KNOWN_KIT_GAPS emptied — the schema lint now
  enforces the full kit grammar for every playable fighter. 361/361, tsc
  clean, panels vision-checked + serving. — Claude (Fable)

- **2026-07-08 · assets+data+tools · Sprint 27 Phase 2: THE atomic floor/
  skeleton migration** — all 16 fighters re-packed normalized (feet verified
  on the 338 line) with fresh per-cell RTMPose skeletons in meta v2;
  SPRITE_FOOT_OFFSET_Y and every spriteOffsetY deleted (half-migrated floor
  model gone); ben per-cell floor-aligned; creator-written projectile art
  normalized to the 96×96 content-filled convention with apparent size
  preserved; roster hitbox pass from skeletons (15 fighters × 18 normals;
  catherine's staff reach exempt); 4 drifted engine tests rewritten against
  synthetic defs. **361/361 vitest — fully green for the first time since
  Sprint 25.** Zero API calls. — Claude (Fable)

- **2026-07-08 · tools+ui · Sprint 27 Phase 1e: creator SHIP through the
  shared packer — Phase 1 COMPLETE** — /creator/write now writes transform-
  baked cell frames + `.cellspace` marker + skeleton overlay, then runs
  packCharacter (one producer for every shipped sheet; composeSheet is
  ZIP-only). Packer gained a prekeyed mode (verified pixel-equal in a
  sandbox). Wrote `.cellspace` markers for vincent/earl/ben whose raw
  frames were already creator-overwritten keyed cells (double-pad hazard
  closed); other 13 dirs verified raw-gen. Skills pass 1: sprite-generation
  → core/prompts + §2.9 reference chaining; sprite-qa → minimal-QA posture
  + packer/overlay/meta-v2 map. — Claude (Fable)

- **2026-07-08 · tools+ui · Sprint 27 Phase 1c/1d: one prompt library +
  shared audio** — Cell contract + pose library → `tools/core/cells.mjs`
  (merged best-of-both poses), prompt craft → `tools/core/prompts.mjs`;
  gen-frames/gen-canonical AND creatorModel now compose from the same
  library (creator fighters get canon-quality prompts — C2 closed);
  `.d.mts` declarations bridge browser TS ↔ .mjs; coords.mjs isomorphic.
  ElevenLabs TTS/SFX + voice table unified in lib.mjs (gen-audio + creator
  endpoints); fatality default beats single-sourced. tsc + build + dev
  transform verified; 357/361 (4 known pre-existing). — Claude (Fable)

- **2026-07-08 · tools+ui · Sprint 27 Phase 1a/1b: one pack path** —
  `tools/core/keying.mjs` (one key/pad filter source — the vite copy's
  missing HEADROOM is fixed, so editor/creator cells finally match packed
  cells; creator preview re-anchored to ORIGIN_FEET) + `tools/core/packer.mjs`
  (packCharacter extracted from pack-sheet.mjs, proven pixel-identical on
  chebel; meta v2; new `POST /__editor/pack` with backup). Editor edits now
  SURVIVE re-packs: edited cells + touched skeletons persist to
  `assets/raw/edits/<id>/` (packer applies them as overlays) and gen-frame
  regens write the un-keyed art + prompt sidecar back to raw frames.
  pack-sheet CLI gained a usage guard (bare run used to mkdir a junk tree
  from argv[0] — the new orphan audit caught it). Discovery: the 14
  non-vincent/gene committed sheets are pre-HEADROOM era → Phase 2 scope.
  tsc clean; audit 54/54. — Claude (Fable)

- **2026-07-08 · data+tools+ui · Sprint 27 Phase 0: guardrails + cruft sweep** —
  One coordinate source (`src/render/coords.json` → TS/Node/Python accessors)
  replaces every hand-synced FLOOR_FRAC/CELL/HEADROOM/1.32 copy; one shared
  cell↔world transform (`src/render/geometry.ts`) replaces the 3 hand-rolled
  cellBoxToHitbox copies. Orphan assets deleted (haidai, flo rm-rf, catherine
  legacy projectile), ThreeFxSystem legacy-proj 404s gated, vanessa move-VO
  flag fixed, vincent meta duplicate throw frames removed. Audit test grew
  bust/orphan/meta-shape/schema-lint suites (324→361; KNOWN_KIT_GAPS tracks
  the ben/earl/vanessa Phase-3 backfill). characterScale base cache → WeakMap
  (HMR hazard). QA hygiene: vfx-grid experiments → tools/vfx/, resolver
  probes onnxruntime+cv2, gen:busts script. tsc + build clean; 4 remaining
  test fails are pre-existing data-vs-test drift (Phase 2/3). — Claude (Fable)

- **2026-07-08 · docs · Sprint 27 third pass: pin editor folds in, deep-link
  access model** — Stage creation in the studio now includes world-map pin
  placement (Stage Pin editor becomes the STAGES module's map overlay —
  every dev tool now lives in the studio). Access model decided: modules
  stay separately addressable via EditorMenu deep links; only the standalone
  scene implementations retire. `docs/CHARACTER_STUDIO.md` §2.1/§2.12 +
  Part 4 item 11. — Claude (Fable)

- **2026-07-08 · docs · Sprint 27 second-pass directives folded in** — The
  Character Studio plan now locks: FightScene-hosted WYSIWYG shell (studio
  is a fight-scene mode with collapsible panels + unified debug overlays +
  a TEST module for manual/CPU matches as a pipeline step), CLI⇄studio⇄
  skills parity as a core deliverable (skills rewritten against tools/core),
  minimal sprite QA (human QA + vision gate on canonical/crouch/jump refs
  only; pose-rule QA deferred; fal never local), and publishing-owned stage
  management (assign/create/cleanup now; hide/delete lifecycle in Phase 5).
  `docs/CHARACTER_STUDIO.md` §2.1/2.2/2.11/2.12 + Part 4 items 5–10.
  — Claude (Fable)

- **2026-07-08 · docs · Character Studio plan (Sprint 27)** — Full audit of
  the Character Creator / Sprite Editor / Move Tuner / tools+QA pipeline /
  character data tree, and the unification plan: `docs/CHARACTER_STUDIO.md`
  (audit findings incl. the FF_KEY_PAD-vs-HEADROOM pack mismatch, the two
  prompt libraries, the half-migrated floor model, the ben/earl schema
  regression, orphan assets, audit-test blind spots; target architecture:
  one `tools/core/` shared library, CharacterProject + meta v2, job runner,
  auto-pilot + manual modes, Adopt/upgrade flow, StorageDriver R2 seam;
  5-phase build plan + open questions). Sprint 27 section added; the three
  open Sprint 26 consolidation items marked superseded. Follow-up same day:
  Part-4 decisions locked with the user (atomic migration approved, full-run
  dogfood with one-reroll-max, ben/earl kits + themed fatalities, R2 seam
  only) and the reference-chaining generation strategy + projectile-tooling
  requirement captured as plan §2.9/§2.10. No code changes. — Claude (Fable)

- **2026-07-08 · ui · creator special archetype catalog expanded** — The
  Character Creator special dropdown and Gemini design-draft prompt now allow
  the full buildable engine catalog: fireballs/charge shots, flame cones,
  lobs, clouds, fuse detonations, traps, slow fields, pull and multi-projectiles,
  DP/flash-kick, rushes, mash/rehit, grab variants, teleports, reflectors,
  projectile-immune lariats, vault/leap, and yoga float. Projectile-family
  archetypes now all get projectile slots, tuning, preview flight, and export
  treatment. — Codex

- **2026-07-08 · assets+data · Ben playable creator checkpoint** — Added Ben
  as a registered playable fighter with creator-generated sprite sheet/meta
  (62 frames, skeletons baked for every frame), raw source frames, Quesadilla
  and Hot Coffee projectile art, portrait/bust/KO assets, four fatality panels,
  announcer line, kiai/hurt/victory VO, two per-move call-outs, voice-inspo, and
  asset-manifest entries. Also carries the current Earl/Vanessa/Vincent sprite
  sheet/meta/data edits from the working branch, removes stale `earl-home` /
  `vincent-home` stage registrations after those generated stage assets were
  dropped, and commits the local `.agents` skill mirror. — Codex

- **2026-07-08 · ui+tools · CPU demo debug overlays stay live** — `FightShell`
  now registers F2 move log and renderer debug keys even in CPU demo/showcase
  and idle attract fights, so F1 hitboxes and F3 skeleton overlays can be toggled
  while bots are demonstrating moves. Idle attract still exits on normal input,
  but no longer treats debug/perf keys as an exit command. Also hardened
  `gen-asset-manifest` to skip non-directory entries under `public/assets/sprites`
  so stray macOS `.DS_Store` files cannot break prebuild; regenerated the asset
  manifest after Vincent's legacy projectile removal. `tsc --noEmit` and
  `vite build` passed. — Codex

- **2026-07-08 · assets+data · Vincent creator/edit checkpoint** — Committed
  the current Vincent dogfood state before the next code pass: raw frames were
  re-packed/renumbered with throw cells inserted before specials, packed
  `sheet.png`/`meta.json` and `projectile-sigil-bolt.png` updated, legacy
  `projectile.png` removed, `vincent.json` tuning/scale bake/home-stage changes
  captured, Earl's home stage changed to `star-beach`, `vincent-home` registered,
  and Vincent voice clone/generated VO assets plus `tools/voices.json` updated.
  — Codex

- **2026-07-07 · ui · creator canon edit path + sprite-editor write/control fixes** —
  Character Creator now includes throw startup/active/recovery frames in the
  generated attack set, and can reopen a playable canon fighter from raw JSON +
  packed sheet/meta/projectiles/portraits/fatalities into editable creator jobs
  while preserving the existing JSON as the write-back base. Sprite Editor prompt
  fields now accept fight-key keystrokes while focused; selected cells can flip
  X/Y with skeletons mirrored; Write Moves / Write Sheet / Commit are batched
  behind checkboxes; special inputs can be reassigned in the move inspector.
  `CpuDriver` can now execute `cbf`, charge motions, pure button specials, and
  `PPP`/`KKK`/`LPLK` chords, fixing Yulia's Braid Lariat loop in the editor.
  `tsc --noEmit` and `vite build` passed. — Codex

- **2026-07-07 · ui+assets · creator ZIP/write hardening + Earl dogfood
  canonization** — Fixed the Character Creator's `WRITE + REGISTER` regression
  where `/creator/write` used `moveAudio` without reading it from the payload.
  Creator saves/downloads now derive raw filenames from the current model order,
  so newly inserted `block-crouch` shifts `hit/fall/down` and all later cells
  deterministically, and special renames update frame filenames instead of only
  remapping JSON keys. ZIP export now includes game-ready assets plus
  `assets/raw/frames/<id>/` source frames (including `projectile-<move>.png`);
  ZIP import copies assets, restores raw frames/progress, registers the fighter,
  registers a generated home stage, and rescans manifests. Polish now exposes
  Portrait/KO regeneration and write/export preserve existing bust/KO assets for
  old drafts. Earl is canonized as the current dogfood character with corrected
  raw-frame numbering, projectile art, home stage, fatality panels, VO/music, and
  manifest registration. Also carries the current Yulia sprite-editor tuning
  checkpoint. `tsc --noEmit`, `vite build`, and diff whitespace checks passed.
  — Codex

- **2026-07-07 · ui · block-crouch cell, Seed lore, fatality panel prompts/reroll,
  skeleton-follows-transform** — Added the missing **`block-crouch`** base cell
  (FightScene resolves it for crouch-guard; a creator character was shipping
  without it). Seed (D1) gains an **optional lore/backstory** field that overrides
  the drafted backstory in the exported JSON. Fatality is no longer a black box:
  four **editable per-panel prompt beats** (seeded from the default) each with a
  **reroll-this-panel** button (`/creator/fatality` now takes `panelPrompts` +
  `only`); beats persist in the draft. Investigated the "ZIP ignores sprite
  scale/position" report — `composeSheet` DOES bake per-cell scale/offX/offY into
  the packed sheet (verified: 0.5× + offX40 shrinks + shifts the cell), but it was
  NOT applying the same transform to `meta.skeletons`, so the in-game F3 skeleton
  drifted off moved art — now transformed to match (verified joint maps exactly).
  tsc clean; block-crouch wiring, lore→export, 4 panel editors + reroll, and the
  skeleton transform all verified in mock. — Claude

- **2026-07-07 · ui · creator↔sprite-editor skeleton parity + childed, persisted
  hitboxes** — Skeleton overlay is now a 1:1 port of `FightScene.drawSkeleton`:
  the SAME body groups (orange torso / blue arms / green legs), neck, per-finger
  hand fans, ankle→toe/heel foot bones, and joint-dot styling (face_* skipped).
  The points/labels were already identical (both come from `named_keypoints`, the
  full 133-pt wholebody set — `infer_keypoints.py` for the creator, the pack for
  the game), so a creator character's `meta.skeletons` drops into the game as-is.
  Hitboxes are now CHILDED to the sprite: the overlay anchor rides the current
  frame's art offset (`geom.ox/oy`), so the box moves with the fighter through a
  jump arc or anti-air rise, exactly as the in-game hitbox follows `f.y`. Manual
  hitbox drags now flush through the same debounced autosave (`scheduleSave` on
  drag-end) and were already in `serializeState`/`loadDraft`, so tweaks survive a
  refresh. Verified the exported character JSON carries every attribute an existing
  playable fighter has. tsc clean; 314/315 (pre-existing Sprint 19 fail); childing
  (+149px with a 100-cell rise), skeleton hands/feet, and persistence verified in
  mock. — Claude

- **2026-07-07 · ui · creator auto-hitbox now matches the Sprite Editor exactly**
  — Confirmed the scale FACTOR was already identical (`hurtStand.h·1.32/384`), but
  the creator's `autoHitboxesFromSkeleton` was OMITTING the vertical render offset
  (`SPRITE_FOOT_OFFSET_Y + spriteOffsetY`) that the Sprite Editor's
  `FightScene.cellBoxToHitbox` bakes into `y` — so creator auto boxes sat a few px
  off. Now applies it, so the two produce identical boxes. Also fixed the preview
  overlay anchor: it was pinned to the ground line (`floorY`) while
  `hitboxFromSkeleton` measures from the FLOOR_FRAC feet line (0.88), leaving the
  drawn/grabbable box ~60px below the limb — now anchored at the FLOOR_FRAC line so
  the box (auto + manual) tracks the hand it wraps, matching the skeleton overlay.
  tsc clean; identical scale factor, foot offset, and limb-tracking verified live
  in mock. — Claude

- **2026-07-07 · ui · preview skeleton + hitbox overlay toggles (draggable
  hitboxes)** — Added **skeleton** (greyed until DWPose has run) and **hitboxes**
  checkboxes above the animation viewer. The skeleton overlay replays the cell's
  baked DWPose joints (torso/arms/legs/neck) over the current frame's art; the
  hitbox overlay draws the fighter's hurtbox (blue) + the previewed move's hitbox
  (red) with corner handles. The move hitbox is editable at any time — drag the
  body to move it, drag a corner to scale it — writing `m.autoHitboxes[moveId]`
  (engine units) so edits flow straight to the exported JSON. Arriving on the Rig
  step turns both overlays on by default. tsc clean; toggles, RIG defaults,
  skeleton un-greying, and move/corner drag math all verified live in mock. — Claude

- **2026-07-07 · ui · regen chroma-key reinforcement + undo/reject regenerated
  frames** — On every keyable-art regen (sprite/canonical/portrait/ko/projectile,
  never a stage) the prompt is reinforced with the flat green chroma-key clause if
  an edited prompt dropped it, so the frame still keys cleanly. Regen no longer
  overwrites permanently: `fireGen` stashes the frame it replaces (`prevDataUrl`),
  and the inspector shows a **↶ Undo / ↷ Redo** button that flips between the
  regenerated frame and the one before it and writes whichever is shown back to
  disk — a worse regen can be rejected. tsc clean; chroma reinforcement + undo/redo
  round-trip verified live in mock. — Claude

- **2026-07-07 · ui+engine · projectile/stage → frame inspector, projectile
  scale fix, sprite-editor bake-down** — Moved the projectile + stage reprompt/
  regenerate OFF the wizard dialog and onto the frame inspector, where every other
  frame's prompt lives (dialog now just has a thumbnail + generate button). The
  projectile inspector also carries its size/spawn/auto-hitbox tuning, drawn LIVE:
  selecting the projectile cell stands the fighter idle and renders the projectile
  statically at its spawn with the collision box, so tuning is immediately visible.
  Fixed the projectile scale/hitbox math: preview + box + export now share one
  basis — 72·projScale px (the in-game default is 72), so auto-hitbox squares the
  visible alpha correctly (centered on its centroid) and the tuned values actually
  propagate. New render-only `ProjectileDef.renderSize` (scales with `def.scale`);
  the creator writes it from the size slider and FightScene reads it
  (PROJ_SIZE[moveId] → renderSize → 72). Sprite Editor gains **COMMIT — bake
  scale+offset → identity**: flattens the tuned character `scale` into the
  persisted geometry (hurtStand drives render size, so no pixel change) and bakes
  `spriteOffsetY` into the sheet pixels, then zeros both — overwrites sheet.png +
  meta + character.json with an identity transform. tsc clean; 314/315 tests (the
  1 fail is the pre-existing Sprint 19 combo-scaling case); projectile + stage
  inspectors, auto-hitbox, renderSize export all verified live in mock. — Claude

- **2026-07-07 · ui · jump preview + audio BYO chips + frame drop + projectile
  tuning** — Wizard preview: jump normals now play idle→jump→execute over a full
  jump arc. Every audio sample (announcer / kiai / hurt / victory / per-move
  call-out / stage music) gets a play + **download** + **upload(BYO)** chip that
  also accepts a dropped audio file. Sprite frame cells accept a dropped image
  file (BYO frame, normalized to the 288×384 cell) with a tiny hover download
  button. Specials editor gains **projectile tuning** — proj size / spawn x /
  spawn y sliders that drive the flying-projectile preview live and persist on
  export (projectile `spawnX/spawnY/box`), plus an **auto-hitbox** button that
  fits a square box around the projectile's visible alpha. Fixed special-gen
  paths to re-render MOVES so tuning UI appears post-gen. tsc clean; 18 audio
  chips + projectile sliders + auto-hitbox verified live in mock. — Claude

- **2026-07-07 · engine+ui+docs · charge controls + per-move audio + projectile
  persistence** — engine: new `cbf` motion (charge back→forward sonic boom) banked
  via `f.backCharge` like `du`, `bf` sequence untouched; `src/engine/specials.test.ts`
  locks in (a) a projectile persisting after its spawning move recovers — already
  correct, now tested — and (b) `cbf` firing only with the held charge (315 tests,
  1 pre-existing combo-scaling failure unrelated). Wizard: Sonic-boom + Flash-kick
  archetypes in the specials editor (emit `cbf`/`du` + leap/projectile), a per-special
  **call-out audio slot** (spoken VO via TTS/clone or SFX via ElevenLabs
  sound-generation, or BYO upload) that sets `voice:true` and writes
  `voice/<id>-move-<moveId>.mp3`, and anti-air specials now RISE in the preview.
  Docs: move-authoring skill + MOVES.md mark charge b,f/`cbf` + `du` as built and
  note projectile persistence. New endpoint `/creator/move-audio`. tsc clean;
  archetypes + audio row verified live in mock. — Claude

- **2026-07-07 · ui+tools · Character Creator — editor UX + specials pass** —
  merged SPRITES+SPECIALS into one **MOVES** step with a real specials editor:
  archetype dropdown (7-entry buildable catalog + prompt-free helper descriptions),
  controls dropdown, editable description, swap-from-pool (8 candidates), and
  approve-before-gen (gen gated, batch skips unapproved); projectile-first chain
  (description→projectile→active refs it) + per-move projectile art slots written
  on ship/export. Added per-move animation player buttons (grey→lit), real jump/
  crouch/block/fall preview sequences + a `hit` base cell, full-bleed in-level
  stage backdrop with the fighter grounded, inspect panel overlaying the dialog,
  ghost "missing" cell slots, per-cell scale + x/y offset (baked into preview/
  sheet/refs), img2img regen + prompt pre-fill, character-archetype dropdown,
  per-line VO play/regen + announcer (`/creator/audio-clip`), pipeline frame
  naming (`NN-cellname`), resume hardening (image→done, orphaned-frame relink,
  clickable stepper, failed-only batch re-run), periodic autosave, and an activity
  log with timers/error cells. tsc clean; each slice verified live in mock. Scoped
  to Panel/model/vite. — Claude
- **2026-07-07 · assets · earl inputs + earl voice clone** — added earl reference
  face (`earl-head.jpg`) + `voice-inspo/earl/` samples, removed the stale
  `vanessa.wav`, and registered earl's Fish voice-clone id in `tools/voices.json`
  (safe to commit; useless without the key). Test-character asset curation from the
  Character Creator dogfooding. — Vincent

- **2026-07-07 · tools+ui · Sprint 26: Character Creator — full in-browser pipeline** —
  the wizard now runs the whole character pipeline end-to-end from the front-end:
  D3 3-phase attack sprites (ref-chained, pooled), D6 rig via LOCAL DWPose
  (`/__editor/skeleton-regen`; fal is ship-only) → baked `meta.skeletons` +
  auto-hitboxes, real ElevenLabs VO (bulk + per-line play/regen, announcer =
  Maverick) + music + Fish voice-clone, fatality panels, stage gen→register,
  square portraits. UX: drag-drop/batch/removable uploads, preview switcher +
  per-cell scale (propagates into refs + sheet), regen pre-filled with the
  original prompt, full-bleed in-level stage backdrop with the fighter on the
  ground line, resizable/collapsible panels, activity log + timers + error cells.
  Persistence: live-save frames + `state.json` to gitignored `assets/raw/creator/`,
  RESUME bar, and a ⤓ ZIP export (playable bundle + raw progress). New endpoints:
  `/creator/{audio,audio-clip,music,fatality,voice-clone,save,state,list,export}`.
  Scoped to the 3 wizard files (Panel/model/vite) + this board. tsc clean; each
  slice verified live in mock mode. — Claude

- **2026-07-07 · tools+ui+data · Sprint 26: Character Creator — playable SHIP path** —
  engine-valid default kit (`buildFullCharacter`: 18 normals + throw + archetype-
  mapped specials) + SHIP writer (client composites sheet → `/__editor/creator/
  write` writes sheet/meta/JSON/portrait + 17 silent VO placeholders + idempotent
  roster/index registration) + `martian-kombat-mock` launch config. Verified live
  end-to-end in mock mode: seed → profile → base batch → SHIP → reload → playable
  MIRAGE-vs-VINCENT training fight, 503/503 assets, 0 load failures. Mock test char
  cleaned from the repo. tsc clean. — Claude
- **2026-07-07 · tools+ui+data · Sprint 26: Character Creator wizard scaffold** —
  dev-only browser wizard (`CharacterCreatorScene` + `CharacterCreatorPanel` +
  `creatorModel`) running the pipeline from the front-end. D1 Seed (name/desc/
  photo → canonical + portrait, approval gate) and D2 Profile (auto design draft,
  lock-grid reroll, stage/voice upload, auto base-sprite batch with an animating
  live preview) functional; D3–D8 stubbed. Backend `/__editor/creator/gen`
  (nano-banana + mock fallback). Full design spec + worked walkthrough in
  `docs/CHARACTER_CREATOR*.md`. Verified live end-to-end with real nano-banana
  (Mirage: canonical + portrait + 9 base cells). tsc clean. — Claude

- **2026-07-05 · assets · portrait bust re-crop pass** — reran
  `tools/qa/portrait_crop.py --all` across the roster so every `-bust.png`
  is framed pose-centered off the character's head keypoints (fixed
  eye-line, consistent scale) instead of a fixed crop box — keeps the
  roster visually matched now that Vanessa is in the mix. Straight-on
  selector icons untouched. — Claude

- **2026-07-05 · scenes+vite · dev-only Stage Pin editor + world-map
  wiring (Sprint 23)** — first slice of the planned dev-mode front-end
  editor. Vite dev-server middleware plugin (`editorApi()`, `apply:
  'serve'`) POSTs `/__editor/stage-pins` to write `src/data/stage-
  pins.json`, dev-only/no-op in prod — the reusable write backbone the
  character creator will build on. New `EditorMenuScene` (title's
  "6 · DEV EDITOR", dev-only) and `StagePinEditorScene` (click-place/
  drag pins, auto-advance, SAVE). SelectScene now renders all 27
  authored pins as dim dots on the world map, lighting the hovered/held
  fighter's home-stage pin with a player-colored ring + name label +
  side-gutter thumbnail. Also fixed a malformed-JFIF `van.jpg` (old file
  had a broken density header some decoders rejected) and a
  `music.ts` volume-clamp crash found while exercising the map. tsc
  clean, 251 vitest green. — Claude

- **2026-07-05 · assets+data · Sprint 23 stages: 8 new stages + home-stage
  reassignment** — generated TVS, STAR BEACH, LAST RESORT, MUSEUM,
  AI KITCHEN, DOJO, HYPERION, and ESCAPES (21:9 pixel-art from
  `assets/stage-inspo/`, registered in `src/data/stages.ts` with
  matching announcer VO lines). Reassigned bodhi/cat/catherine/freeman/
  kirby/marzipan/rapha/vincent/ygor/yulia to their canonical Martian
  Lore home stage. Also replaced `van.jpg` with a clean redraw. — Claude

- **2026-07-05 · data+assets · Vanessa, 14th fighter (full pipeline)** —
  full 7-step build: `vanessa.json` (24 moves), fatality "Fired and Glazed"
  (4 panels), Fish-cloned VO (kiai/hurt/victory + a per-move call-out) plus
  ElevenLabs announcer line, sprite sheet + 3 named-special projectiles
  (chocolate-head / little-helper / little-martian), home stage `saturn`
  (art already existed). Wired into `roster.ts` (`playable:true`) and
  `characters/index.ts`. — Claude

- **2026-07-05 · tools · third-party handlers: CorridorKey keyer + Fish voice
  cloning** — user-directed. (1) **`npm run gen:key` (`tools/corridorkey.mjs`
  + `corridorkey-helper.py`)**: one-command CorridorKey neural green-screen
  handler — self-bootstraps the sibling clone (git clone → `uv sync`, MLX
  extra on Apple Silicon), fetches the MLX weights via the working
  dead-repo workaround (env-var repo override, tag `v1.0.0`, sha256-checked),
  auto-resolves the green-checkpoint collision by stashing the unused
  backend's file in `checkpoints/.stash/`, then batches a character's raw
  frames (coarse chroma alpha hints → tiled MLX inference `--skip-existing` →
  EXR FG+Matte composed to straight-alpha PNGs in `assets/raw/keyed/<char>/`).
  Green-keyed projectiles included; custom-key (non-green) projectiles stay on
  ffmpeg. `pack-sheet.mjs` gains `--keyer corridor` (packs from keyed frames,
  scale/pad only; hard-fails on missing frames so a release bake can't
  silently mix in halo'd chromakey cells). Smoke-tested end-to-end on MLX
  (gene 20-lk-startup: glitch-FX keyed to real translucent color, no green
  halo; ~12s/frame). Full-roster re-key still parked for the release pass —
  docs/CORRIDORKEY.md updated. (2) **`npm run gen:voice`
  (`tools/gen-voice.mjs`)**: Fish Audio voice cloning (`FISH_API_KEY`) — drop
  real voice samples in `assets/voice-inspo/<char>/` (new README; privacy
  opt-out rule applies), clone registers a private model id in
  `tools/voices.json`; `gen-audio.mjs` now routes a registered fighter's
  kiai/hurt/victory/move VO through the clone via `fishTTS()` in `lib.mjs`
  (announcer + stage call-outs stay ElevenLabs). `--say "text"` writes test
  synths to `assets/raw/voice-tests/`. Untested against the live clone path
  (no samples on disk yet) — first real use: drop clips + `gen:voice --char
  <name>` + `gen:audio --char <name> --force`.
- **2026-07-05 · tools+scenes · clean boot: asset-existence manifest** — kills
  the boot-console errors (11 legacy `proj-<char>` images that only vincent/
  catherine actually have, 8 stage-name VOs that were never authored, a
  `vfx-bodhi-deep-tissue` that doesn't exist) — the audio ones were UNCAUGHT
  `EncodingError`s (a 404'd mp3 throws, not harmless). New
  `tools/gen-asset-manifest.mjs` scans `public/assets/` and writes
  `src/data/assetManifest.json` (stage VOs, legacy projectiles, per-move
  projectile/burst/vfx art that actually exist); BootScene imports it and
  gates every drift-prone load so the loader only requests real files. Wired
  into predev/prebuild next to gen-music (+ `npm run gen:assets`). Permanently
  ends the "blind-load → 404" class the memory note kept flagging. Verified on
  the prod build: boot completes with `failed: 0` (was 12), console clean
  (only the Phaser banner). — Claude

- **2026-07-05 · scenes+ai+data+assets · showcase demo + Flo/Gene polish**
  — user-directed (UNCOMMITTED; part of the same feel-pass push). (1)
  **CPU-vs-CPU showcase demo**: new main-menu "5 · DEMO MATCH" → pick both
  fighters + stage → a single-round CPU-vs-CPU match where both bots walk
  their FULL moveset (new `CpuDriver` showcase reel: every normal, a couple
  crouch normals, a jump, then each special) and the winner ALWAYS lands the
  fatality. Flows Menu→Select(showcase)→Versus→Fight with a `showcase` flag
  (winsNeeded 1, both bots). Verified by headless sim across 7 matchups:
  every one reaches `fatality` (not the mercy collapse) with 21-27 distinct
  moves shown. **BUG FIXED en route**: `enqueueMotion` never handled `hcb`,
  so the 7 hcb-fatality fighters (bodhi/cat/chebel/freeman/kirby/rapha/ygor)
  could NEVER land their fatality in ANY demo — now all motions
  (qcf/qcb/bf/hcb/hcf) are supported and the finisher retries until it lands.
  (2) **Flo Flame War** flame graphic offset to mouth height (render-only
  `PROJ_RENDER_OFFSET_Y`, -125) so it reads as fire-breathing; Flo + Gene
  sheets repacked from the user's edited raw frames. (3) **Gene VO** (new
  ElevenLabs lines): kiai "Force push!" / "Straight to prod!", hurt "Ah,
  fuck." / "Eden's down!", and a per-move call-out "Line goes up!" that
  fires on the move (new data-driven `MoveDef.voice` + `v-<char>-move-<id>`
  files + `attack-start.voiceLine` event → soundDirector). (4) **Gene win
  quotes**: bullish / context / out-of-tokens added; stale "rate-limited"
  quote dropped. tsc + build clean, 237/237, verified live (menu item,
  flame at mouth height, VO loaded, showcase runs). — Claude

- **2026-07-05 · engine+data+assets+renderer3d · feel & mechanics pass (SF2/MK
  UX)** — user-directed batch (UNCOMMITTED as of this entry; see handoff). (1)
  **Throws** toss SF2-style: the victim launches on a long high arc
  (`TOSS_VY`/`TOSS_KNOCKBACK_MULT`), slams, rebounds bigger (`TOSS_BOUNCE_VY`)
  — displaced across the screen, not a short knockdown (new `toss` HitPayload +
  `Action.tossed`). (2) **Finisher** = MK behavior: fumble the fatality and
  just LAND a normal on the dazed loser → they collapse, round ends (was:
  attacks whiffed in FINISH THEM). (3) **Jumps** higher (`JUMP_VEL_MULT` 1.12)
  and forward jumps cover ground (`jumpSpeedX`, default walk×`JUMP_SPEED_MULT`
  1.6, per-char overridable — no more walk-speed floaty hops). (4)
  **Projectiles** rescaled: sigil-bolt 72→112, fork-bomb 64→104, pop-tab-chain
  →104. (5) **Flo/Gene static field-mines swapped**: Smokescreen → **Flame
  War** (short-range Yoga-Flame breath); Rate Limit → **Line Goes Up**
  (short-range rising green-candlestick burst) — real short-range projectiles
  now, keeping the `qcb+P` slot so Burn One / 404 fatalities still fire; new
  projectile art generated (Gene's green candles on MAGENTA + `key` 0xFF00FF)
  + packed. (6) **3D camera** dollies back AND rises on vertical height (high
  jumps) on top of the horizontal-separation dolly. 3 new engine vitests + 2
  field-mine tests rewritten; 236/236, tsc + build clean, verified live.
  DEFERRED (own tasks): 2D dynamic camera (needs a world/HUD camera-split),
  wall/double-jumps (Cat/Kirby), close-range balance pass. — Claude

- **2026-07-05 · data+assets+renderer3d · Rapha, 13th fighter (full pipeline +
  3D mesh)** — RJ's raccoon-wrangler joins the roster (`playable:true`,
  `mesh3d:true`). Full 7-step build: `rapha.json` (23 moves; four named
  specials — Claw Machine, Tubs Fetch!, Pop-Tab Chain, Wind-Up — + throw; 5
  win quotes; Scrap Compactor fatality), 62-cell painted sheet + four
  projectile arts, portrait/KO/bust, 4 fatality panels, and a baked
  `rapha.glb` (4th 3D-capable fighter after vincent/yulia/flo). Backfills
  laubsauger's `a207272 added rapha` + the crouch-frame re-roll below.
  — laubsauger + Claude (parallel sessions)

- **2026-07-05 · renderer3d+engine+net+audio · 3D→production + online polish
  (changelog backfill)** — logging laubsauger's committed-today work that
  shipped without a SPRINTBOARD entry: **sub-tick render interpolation**
  (`2dee05f`) so 3D clip playback interpolates between engine ticks for
  smooth animation at any refresh; **renderer warmup during VS + a loading
  screen** (`9883404`) holding the sim behind LOADING… until models/stage/
  pipelines are up (no more fight-over-black-screen); **distinct per-character
  idle animations** in 3D (`e345958`); a **3D test scene / test-room**
  (`a082b42`); **taunt promoted to a real engine input** (`be06120`,
  deterministic + net-synced) and **taunt targeting the local player's
  fighter online** (`80ce97b`, was always slot 0); **net timesync** so both
  peers hold the same tick (`7fe2092`, V26/T45); **announcer VOs only on the
  final pick, louder + music-ducked** (`df6c5ce`); and a **GLB conversion
  fix** (`ba5e4eb`). — laubsauger (backfilled by Claude)

- **2026-07-05 · assets · Rapha crouch frames re-roll** — cells 29
  (clp-active), 36 (clk-recovery), 37 (cmk-active), 39 (chk-active), 40
  (chk-recovery) had rendered standing instead of the low crouch the pose
  text called for; re-rolled all five with `gen:frames --cells` using the
  low-pose anchor (fixed chk-active anchors the rest). First chk-recovery
  re-roll came back with a missing-arms artifact — re-rolled once more,
  clean. Also found `04-crouch.png` missing from `assets/raw/frames/rapha/`
  entirely (deleted pre-session, unrelated to this ask) which was silently
  dropping the "crouch" idle cell from the packed sheet/meta.json —
  regenerated it (took two tries, same standing-not-crouching failure mode)
  and repacked; `gen:pack` now reports the full 62/62 frames. — Claude

- **2026-07-05 · renderer3d+scenes · live 3D idle previews on character
  select** — new `SelectPreview3D` (transparent WebGPU canvas over the select
  screen, ThreeFighterView idle clips, close-plane framing onto the 2D side
  slots); SelectScene boots it via dynamic import in 3D mode, keeps the
  portrait bust as the streaming/no-mesh fallback, hides it behind the stage
  dialog, and drives it from update(). Views cached per slot — cursor flicks
  are instant, mirror picks get two instances. FIX: threeAssets GLB fetch now
  rejects only `text/html` (the vite SPA-fallback guard) instead of requiring
  `gltf-binary` — static hosts serving .glb as octet-stream were silently
  getting capsules everywhere. Verified live: meshes idle on both sides,
  swap on cursor move, portrait fallback for 3D SOON fighters, 0 errors.
  — Claude (Sprint 22 session)

- **2026-07-05 · scenes+ui · Sprint 22 Phase 4 (SPRINT COMPLETE): parity
  stragglers** — 3D-mode character select shows portrait busts on the sides
  (was: 2D sheet idles that didn't match the renderer and would break for
  mesh-only fighters); hint bar (2D) + HUD legend (3D) aligned on the
  canonical keymap; FightScene3D header updated (no longer "dev-only").
  Sprint 22 outcome: 3D at 2D feature parity (pause menu, F2 move log,
  match-end nav, pad menus, select previews) with the presentation stack
  shared end-to-end — pure logic in src/presentation, DOM chrome in src/ui,
  scene glue in fightShell. tsc clean, 233/233, verified live, 0 console
  errors. — Claude (Sprint 22 session)

- **2026-07-05 · scenes · Sprint 22 Phase 3: the shared FightShell** — new
  `src/scenes/fightShell.ts` composed by BOTH fight scenes: pause state +
  PauseMenu, the canonical keymap (ESC pause · F1 hitboxes · F2 move log ·
  R/ENTER/F9/click matchEnd nav), pad menu navigation, demo exits + hint,
  online rematch handshake/prompt, endNav guard. All the 3D→2D parity gaps
  this sprint was opened for are CLOSED: ESC in 3D opens the pause menu
  instead of dumping to the main menu, F2 is the move log in both renderers
  (3D skeleton→F3, inspector→F5), local R/ENTER work at 3D matchEnd,
  gamepads can drive the 3D pause/win screens, and 2D gains F9 quick
  restart. 3D pause halts the sim but keeps rendering the frame; nav out of
  3D preserves render3d into character select. FightScene/FightScene3D lost
  ~240 lines of duplicated nav code between them. Verified live in both
  renderers (pause freeze + resume, F2 log, ENTER→Select). tsc clean,
  233/233, zero console errors. — Claude (Sprint 22 session)

- **2026-07-05 · ui+scenes · Sprint 22 Phase 2: shared DOM UI chrome** —
  `renderer3d/hud/*` → `src/ui/`; new `UiLayer` (one canvas-tracking DOM
  layer per fight scene; components mount `inset:0` inside it — the
  anchor-style-copying hack is gone). New shared components: PauseMenu
  (action buttons + both fighters' native-scroll move lists via
  presentation/notation, pad/mouse nav), MoveLogOverlay (F2 input ticker +
  move FIFO, change-cached writes), RematchPrompt, DemoHint, LoadingOverlay.
  WinOverlay leveled up to the 2D feature set (winner-colored title,
  FATALITY tag, KO-portrait fallback chain, win quote, configurable prompt,
  onFirstShow hook) — 3D now gets the victory voice line + the 72-frame
  reveal beat it was missing. 2D FightScene swapped its Phaser pause
  container, win-screen container, and log texts for the shared DOM chrome
  (buildPauseOverlay/showWinScreen deleted); FightScene3D swapped its inline
  loading/rematch/demo-hint DOM for the components. Verified live on the
  static prod build (manual loop-step pump): ESC opens the DOM pause menu
  mid-fight, F2 shows live input tickers + move log, DOM win screen with
  fatality tag + Russian win quote, 3D fight renders HUD/banner/legend on
  the shared layer. tsc clean, 233/233 vitest, zero console errors.
  — Claude (Sprint 22 session)

- **2026-07-04 · presentation+scenes · Sprint 22 Phase 1: shared presentation
  layer (2D+3D)** — FightScene (2D) migrated onto the shared
  `snapTick`/`diffTick` (its private ~180-line presentTick detector deleted —
  the acknowledged post-Sprint-19 debt; the two copies had drifted on FIGHT!
  timing). New pure vitested modules in `src/presentation/`: `soundDirector`
  (the ONE event→audio table for both renderers; scenes execute cues via
  `runCues` in BootScene, victory-music behavior injectable — 2D keeps its
  onEnd→char-select), `hudModel` (ghost bar + combo, shared; drain unified on
  2D's rate), `banner` (pure bannerFor; 3D consumes it now, 2D in Phase 2),
  `notation` + `moveLog` (F2 log model + pause-menu move-list text).
  FightScene3D: handleEvents reduced to renderer fx only, snd()/voice()
  focus-gate wrappers deleted (play() gates centrally), ghost/combo fields
  replaced by HudModel, stage bounds now `STAGE3D_BOUNDS` in threeCoordinates
  (shared with LobbyScene). tsc clean, 233/233 vitest (27 new). Verified live
  (static prod build, headless — NOTE: preview tab is hidden so Phaser's RAF
  never fires; drive `window.__game.loop.step()` manually): full 2D CPU match
  end-to-end incl. fatality + win screen + victory-music navigation, full 3D
  CPU match incl. FATALITY banner slam + WinOverlay, zero console errors.
  — Claude (Sprint 22 session)

- **2026-07-05 · audio · stage-name announcer VO (Clyde)** — all 19 stages now
  have a spoken name call-out (`public/assets/audio/announcer/stage-<id>.mp3`),
  generated in the "Clyde — Vintage Male Radio Announcer" voice
  (`QMJTqaMXmGnG8TCm8WQG`). gen-audio uses Clyde ONLY for `stage-*` lines;
  Maverick stays for rounds/KO/fighter names (per-line voice switch). BootScene
  preloads them; `SelectScene.playStageVo` (already wired) calls them out on
  vote + on the resolved stage at launch. NOTE: needs the paid ElevenLabs key
  (professional library voice) + `--concurrency ≤3` (Starter plan's parallel
  cap). Verified: all 19 in the audio cache, no decode error. — Claude

- **2026-07-05 · net+scenes · online rematch on the same channel** — at the end
  of an online match each player sees a REMATCH prompt; press R/ENTER (or
  click/pad-confirm) to opt in, ESC to quit. When BOTH opt in it goes straight
  back to the shared character select — no room-code re-entry, no re-sync. Core
  logic is a Phaser-free `src/net/rematch.ts` `RematchLink` shared by FightScene
  (2D) and FightScene3D: it takes the finished match's transport, exchanges a
  `rematch` opt-in, and on agreement spins a fresh `LobbyController` on the SAME
  connection with `skipVerify` (peers already handshaked this session) →
  onReady → Select. Gotcha fixed: skipVerify makes onReady fire SYNCHRONOUSLY
  during controller construction, so the launch is deferred a tick (scene
  clock) — else it reads the not-yet-assigned controller ref (TDZ). bye/close
  → forfeit to menu. Verified live (two Chrome, prod build): match1 → both opt
  in → back in shared select (no code) → match2 runs in sync (chars identical,
  heads within 1 tick, 0 desync). — Claude

- **2026-07-05 · net+select · online pick-waiting + both-vote stage** — (1) after
  a player locks their fighter online they now see "waiting for <name> to choose
  their fighter…" instead of silently sitting/advancing; onBothLocked clears it
  and BOTH open the stage picker. (2) stage is chosen by BOTH players (was
  host-only): each casts a `stagePick` vote; the host reconciles (agree → that
  stage, disagree → coin flip between the two votes) and sends the authoritative
  `start`, so both launch on the identical stage (V25). `confirmStart` is now
  host-internal. 4 lobby vitests cover same-vote, disagreement (result ∈ the two
  votes over 12 trials), lone-guest-no-start. Verified live (two Chrome, prod
  build): waiting note shown, both peers reach the stage dialog, opposing votes
  resolve to one shared stage, sync intact. Local select untouched. — Claude

- **2026-07-05 · net+scenes · online reuses the real SelectScene (no duplicate
  picker)** — the custom mini-picker in LobbyScene is gone; online now hands off
  to the SAME `SelectScene` local 2-player uses (grid + side idle sprites +
  stage dialog). Split the net handshake: `hello` (proto+charHash+name) verifies
  on connect → `onReady` hands off to Select; `pick {charId}` is sent when a
  player locks their fighter on the shared grid; the HOST picks the stage and
  `confirmStart` commits the host-authoritative config. One `LobbyController`
  spans Lobby→Select (passed by reference, `setHooks` merges the pick/stage/
  start hooks). SelectScene online mode: local controls only its slot, the
  remote fighter fills from the wire, only the host drives the stage dialog
  (guest shows "waiting…"), then it launches Fight/Fight3D itself with the
  online payload — Versus is skipped online. Local/CPU/training select paths
  untouched (verified: both picks → stage → Versus, `online:false`). Verified
  live over two Chrome processes on the production build: both peers land in
  the shared selector, pick their own fighters (both slots reflect both picks),
  host picks stage, both launch in lockstep — chars identical, heads within
  1 tick, 0 desync. lobby.test rewritten for verify→ready→picks→start (7
  tests). — Claude

- **2026-07-04 · net · 3D-aware multiplayer + paste-anywhere (public 3D/MP)** —
  online now respects the renderer: the host announces its 2D/3D mode the
  instant the channel opens (new `mode` wire msg), the guest AUTO-ADOPTS it
  before picking (so 2D/3D can never cross-join and the guest's roster +
  launched scene always match the host). Lobby filters the char pool to
  mesh-capable fighters (vincent/yulia/flo) in 3D and launches `Fight3D` vs
  `Fight` per the agreed `render3d` in the start config. `FightScene3D` gained
  the same `online`→NetSession injection as `FightScene` (identical hooks,
  V18), with the 3D stage bounds baked into the host's rules so V25 holds in
  either renderer. Pasting a room code anywhere on the page jumps to join +
  fills it. Confirmed 3D + online are NOT dev-gated — reachable in the
  production build via the menu render toggle + ONLINE entry; verified in
  `npm run preview`: 3D fight renders (WebGPU), lobby 3D pools the 3 mesh
  chars, paste fills. Test-room + debug hotkeys kept as-is (per user). — Claude

- **2026-07-04 · net+scenes · online lobby + session injection, live-verified
  (SPEC T39 done, T40 core)** — `LobbyScene` (registered in main.ts, menu
  "3 · ONLINE" + `?dev=net`): host → room code + copy + "waiting", join → code
  entry, per-side character pick, drives the `LobbyController` handshake →
  launches `Fight` with an `OnlineFightData` payload. FightScene now takes that
  payload and builds a `NetSession` (rollback) instead of `FightSession` using
  the SAME tick hooks — proof of V18 (net vs local = session swap, scene code
  identical). Online disables pause (sim never freezes, V23). peerjs
  dynamic-imported → code-split into its own 91KB chunk, out of the 2D bundle.
  Handshake logic (`src/net/lobby.ts` `LobbyController` + `charDataHash`,
  V21) is unit-tested over loopback (6 vitests). **Live-verified** with a
  two-Chrome-process CDP harness (scratchpad `net-2proc.mjs`): two peers meet
  over the real peerjs broker + WebRTC DataChannel, both reach Fight, and their
  engine heads stay byte-identical in lockstep (tick 180/300/420/540 equal,
  0 desync, 0 halt) — V25 over the real network path. NOTE headless fully
  PAUSES non-visible tabs' rAF, so two-player smokes need two separate Chrome
  processes, not two tabs. REMAINING (T40): disconnect grace/rejoin + rematch.
  — Claude
- **2026-07-04 · net · WebRTC transport over PeerJS (SPEC T38, + rejoin spec
  V27/T46)** — `src/net/webrtc.ts`: `WebRtcTransport` wraps a peerjs
  DataConnection behind the same `Transport` iface as the loopback, so
  NetSession is transport-agnostic. `hostRoom()` claims a namespaced room id
  (5-char unambiguous code, no I/L/O/0/1) + waits for a guest; `joinRoom()`
  connects to it; both surface a `transport` promise + `onReconnect` hook.
  The room-owning Peer outlives any single DataConnection so a dropped peer
  can rebind into the same room — groundwork for T46 rejoin. Reliable+ordered
  channel (lockstep needs both). Not vitest-able (real broker); gated on
  typecheck+build; code-gen unit-tested. peerjs dep added. SPEC gains V27
  (grace window + host-authoritative resync, not instant forfeit) + T46. —
  Claude GGPO-style
  netplay behind the same Session surface as FightSession: predicted remote
  inputs (repeat-last), structuredClone snapshot ring, mispredict → restore
  at divergence + silent re-sim to head (presentation hooks fire once per
  tick, V24), input delay D=2, stall only past window W=10, confirmed-tick
  hash exchange (V20), stats() for the net HUD, onIssue for desync/
  disconnect. 7 vitests over loopback incl. the V25 keystone: confirmed
  timeline hash-equal to an offline step() replay of the same input log,
  under latency+jitter+15% loss. — Claude
- **2026-07-04 · net · transport seam + loopback test double (SPEC T36)** —
  `src/net/transport.ts`: `Transport` interface (send/onMessage/onStatus/
  close), typed `NetMsg` wire union (hello/start/input/hash/bye, PROTO=1),
  and `createLoopbackPair` — in-memory pair on a virtual tick clock with
  seeded-LCG latency/jitter/loss simulation (deterministic, no wall clock).
  5 vitests incl. seed reproducibility and post-send mutation isolation.
  NetSession (T37) tests will run entirely on this. — Claude
- **2026-07-04 · engine · net wire helpers (SPEC T35)** — `unpackInput`
  (inverse of packInput, 1024-combo round-trip vitest) and `hashState`
  (FNV-1a over float64 bit patterns of the numeric core: tick/phase/timer/
  wins + per-fighter x/y/vx/vy/facing/health/stun/hitstop/action +
  projectiles/pendingThrow) for netplay desync detection (V20/V22). Math-op
  audit: engine uses only abs/floor/max/min — exact IEEE ops, no trig/pow,
  cross-browser deterministic. — Claude
- **2026-07-04 · session · extract FightSession (SPEC T34, netplay groundwork)** —
  the duplicated fixed-timestep loops in FightScene + FightScene3D moved into
  `src/session/FightSession.ts`: one driver owns accumulator, 100ms delta
  clamp, KO slow-mo pacing, and the `step()` call; scenes hang presentation
  off `beforeTick`/`inputs`/`afterTick` hooks (2D keeps its perf split +
  snapshot diff, 3D keeps snapTick/diffTick order). Zero Phaser imports,
  5 vitests (tick-for-tick parity vs plain step loop, clamp, koSlow pacing,
  resetPacing, hook order). Behavior unchanged; NetSession (rollback, SPEC
  T37) swaps in behind the same `Session` surface. — Claude

- **2026-07-04 · renderer3d+tools · animation stabilization sweep** — root
  motion actually dead now: (1) vertical-axis detection went through
  matrix_world (FBX leaves the armature rotated -90°, so armature-space "up"
  kept a HORIZONTAL hips channel — the sideways drift in bows, reactions,
  victory wobble); (2) object-level location AND rotation fcurves stripped
  (some Mixamo clips animate the armature object itself — Z-slides, sideways
  punches). T-pose flash fixed (same-clip restart crossfaded an action
  against itself → bind-pose bleed; hard cut now). Dizzy stars: texture
  late-binds (white-square bug). matchEnd poses: winner plays win clip,
  loser lies in ko (engine leaves mercy-path losers 'dazed' → stun loop
  looked like looping death). GLB byte-cache kills the capsule blink on
  rematch (re-parse per consumer — SkeletonUtils.clone builds WebGL-class
  skeletons the WebGPU renderer silently skips: invisible fighters). HUD:
  dash pips inline with round stars, flush to the bar's outer end. — Claude

- **2026-07-04 · engine+renderer3d · dash stocks, taunts, variants, entry
  bow, directional/heavy/body hit reactions** — dash double-tap impulse now
  gated by a 2-stock pool (150-tick regen, engine + 4 vitests, HUD pips w/
  recharge fade); T = renderer-side taunt gesture; clip variant shuffle
  (`name#N`, tick-hash latch) cycles jab/hook/elbow/reaction/taunt
  alternates; round-1 intro bow; reactions pick side (front/back), weight
  (small/large), and height (body: stomach/liver) from the actual hit;
  uppercut landed as rising-glyph; HUD extracted to
  `src/renderer3d/hud/{FightHud,WinOverlay,FatalityOverlay}`; converter
  strips fcurves for bones the Tripo rig lacks (no pinkies — zero Blender
  warnings). GLB: 54 clips / 38 slots / 0 missing. 140 tests. Perf pass:
  71→112fps (half-res AO G-pass, material-recompile fix, billboard pool,
  cached HUD writes). Branch pushed to origin. — Claude

- **2026-07-04 · renderer3d · 3D spike T25–T27 + depth/beam/blood pass** —
  depth layers (gradient sky + moon, 4th skyline row, neon signs + halos,
  power cables, foreground bollards/walls), lamps rebuilt w/ TSL
  inverse-fresnel fake-volumetric beams (`beamMaterial` in ThreeStageView,
  technique from webgpu-threejs-tsl skill) + head glow + asphalt pool decals,
  2 shadow-casting lamps over the lane. Blood: fixed flat-lying mid-flight
  drops (shared instancing dummy kept splat X-rotation — full rotation.set
  now), circular drops, damage-tiered counts (3+dmg·0.45/0.75 cap 42, KO 70),
  smaller rarer splats. impactNorm piecewise warp (`attackClipTime`) lands
  authored hit frames on engine active-window open (vitest'd). Fatality
  cutscene = DOM panel slideshow from 2D jpgs; matchEnd win screen (winner
  portrait, loser -ko bust, winQuotes). Dizzy stars billboard. fps audit:
  82–108fps w/ AO+bloom+2 point-shadow lamps (headless WebGPU/Metal).
  Verification workflow: `scratchpad cdp-shot.mjs` (node 24 native WebSocket
  CDP driver — headless Chrome `--screenshot` can't wait for async GLB loads;
  real-time wait + JS eval + capture). — Claude
- **2026-07-04 · renderer3d+presentation · 3D spike T17–T24: full presentation
  parity + gore** — pure `src/presentation/tickEvents.ts` (`snapTick`/`diffTick`
  → typed events, 6 vitests; 2D migrates onto it post-Sprint-19). Fight3D now
  has: full audio parity via existing helpers (announcer cues, hit/block/
  whoosh/jump/projectile SFX, hurt/kiai voices, stage/victory music), DOM HUD
  with portrait pngs + ghost health bars + win pips + combo counter, spark/
  per-move-overlay billboards from the 2D vfx pngs, victim emissive flash
  (red+longer on counter), camera shake, MK blood (instanced ellipse drops,
  cone along impact velocity, dmg-scaled count/size w/ fat blobs, floor
  splats thinned + 4s fade, KO gush), projectiles as additive billboards
  (fixes black-fringe squares) + radial glow + PointLight that lights street
  and fighters. Perspective follow-cam default (V10 amended): midpoint lerp +
  separation dolly = real parallax vs depth-staggered building rows; night
  street placeholder stage (asphalt, sidewalk, lit windows, 2 overhead street
  lamps w/ shadow-casting warm pools + fake-volumetric cones, dense fog, dim
  moon key). Bloom default on. SkeletonHelper moved to scene root (was
  double-transformed). vincent-vs-vincent dev launch. — Claude
- **2026-07-04 · renderer3d · 3D spike T10–T12: stage box, light rig, post,
  settings** — placeholder test stage (grid floor + gridded back wall + side
  walls + horizon + fog) replaces the black void; three-point rig (warm key
  w/ shadows, cool fill, rim) + ACES/exposure so black outfits read; TSL post
  stack GTAO→bloom via `RenderPipeline` (AO on, bloom off by default, both
  toggleable); `threeRenderSettings.ts` DOM panel (F4: fps, res scale,
  shadow size, AO/bloom, exposure, per-light intensity, camera presets
  default/low/high, hitbox+skeleton) + official r185 Inspector on F3.
  Model facing fixed (GLB authored +X: 0°/180°, not ±90°), dev launch now
  vincent-vs-vincent to exercise mesh path on both sides. Verified via CDP:
  both fighters face each other, P2 played `attack/redirect` cast clip
  unflagged. — Claude
- **2026-07-04 · renderer3d+tools · 3D spike T7–T9 + T14–T16: vincent GLB
  animated in-game** — `tools/gen-mesh.mjs` (`npm run gen:mesh -- --char
  vincent`) drives headless Blender (`tools/blender_fbx_to_glb.py`): rig FBX +
  ~130 Mixamo clip FBXs (zips auto-extracted to `assets/raw/mesh-clips/`) →
  `public/assets/3d/characters/vincent/vincent.glb` (26 clips renamed to
  contract names, horizontal root motion stripped, vertical kept for pose,
  self-calibrating vertical-axis detection) + coverage report (24 mapped ·
  16 fallback · 0 missing). Runtime: `clipContract.ts`+json (action→clip map,
  V12 fallback chains, V13 class-based tick-sampled playback + crossfades,
  hitstop freezes clips) with 11 vitests; `ThreeFighterView` swaps capsule →
  skinned GLB (foot-origin, hurtStand-scaled, facing = rotation not mirror);
  per-frame lowest-bone ground snap + stage `Floor`-group auto-alignment
  (V14) so feet neither float nor poke through. HUD shows active clip +
  PLACEHOLDER flag. Verified via CDP headless Chrome (idle + knockdown).
  — Claude
- **2026-07-04 · renderer3d+scenes · 3D spike T3–T6: playable WebGPU scene** —
  `FightScene3D` behind `?dev=3d` (same `step()`/`KeyboardSource`/`CpuDriver`
  loop as FightScene, Three canvas + DOM HUD pinned over the Phaser canvas,
  F1 hitboxes / F9 rematch / ESC menu, `&boxes=1` for headless verification);
  `ThreeFightRenderer` (WebGPU, ortho camera, camera x-tracking, work lights,
  shadow floor), capsule `ThreeFighterView` placeholders sized off
  `hurtStand`, `ThreeHitboxDebug` cuboid pool straight from `worldBox`
  (hurt/body/startup/active/recovery/projectile/throw palette). three loads
  as a lazy chunk — production 2D bundle unchanged. Verified in headless
  Chrome WebGPU (`--enable-unsafe-webgpu --use-angle=metal`). — Claude
- **2026-07-04 · renderer3d · 3D spike T1+T2 (branch `spike/3d-renderer`)** —
  three@0.185.1 installed, real import paths verified (`three/webgpu`,
  `three/addons/inspector/Inspector.js`, TSL `GTAONode`/`BloomNode`,
  `GLTFLoader`); `src/renderer3d/threeCoordinates.ts` engine→Three mapping
  (WORLD_SCALE 0.01, floor→Y0, stage-centered X, ±0.18m lane cuboids) +
  6 vitests. Spec/tasks in `SPEC.md` (SDD flow), spike doc in
  `docs/THREE_D_RENDERER_SPIKE.md`. Vincent mesh + ~130 Mixamo clips staged
  under `public/assets/meshes/vincent/`. — Claude
- **2026-07-04 · data+assets · win-quote polish + Freeman crouch raw** — tightened
  SFII-style victory taunts for **Chebel, Flo, Gene, Kirby, Marzipan** (punchier
  rewrites; Flo's German de-unicoded to `scheisse`; Gene dropped one weak line),
  and committed the updated `freeman/04-crouch` raw frame (already baked into the
  packed sheet). Also lands two prior same-day commits that shipped without a
  changelog line: **`43631ef` — repack Freeman sprite sheet** (re-keyed/re-tiled
  from the existing 62 raw frames, no new art) and **`0702ad0` — Marzipan male
  voice** (parallel session). *(Claude)*
- **2026-07-04 · data+tools+assets+docs+scenes · Wave 2 chars Chebel + Ygor
  shipped (+ bundled parallel select-screen redesign)** — added **Chebel**
  ("The Spirit Deck", rushdown+summon, stage `mimos`) and **Ygor** ("Suave",
  projection zoner, stage `drive-in`): character JSONs, registry + roster
  (both `playable:true`), frames-manifest / gen-audio / gen-fatality entries,
  and full generated assets (62-cell sheets + projectile art, 16 VO lines each
  + announcer, portraits/KO/bust, 4 fatality panels each). Personality
  specials mapped onto proven plumbing (Ceremony→invuln DP, Microdose→teleport,
  oRACLE→slow-field). Added a reusable per-character generic-cell override seam
  (`spec.cells[id]`) and used it to fix Chebel's flickery idle-a/idle-b + a
  stray idle jaguar and to pin her `fall` backward. tsc clean, 134/134 tests,
  sprite QA passed. **This commit also lands a parallel session's uncommitted
  work** (per user request to commit the whole tree): select-screen redesign
  (`SelectScene.ts` +196, `BootScene.ts` world-map + side-profile `-bust.png`
  loads), `public/assets/ui/world-map.png`, and a bulk portrait+bust regen for
  all roster chars plus not-yet-wired Wave 2 portraits (earl/haidai/rapha/
  vanessa — busts present, orphaned until those fighters are built). All 12
  roster busts present, so the redesign is asset-complete for the live roster.
  *(Claude — Chebel/Ygor; parallel session — select redesign)*
- **2026-07-04 · data+tools+assets+docs · Sprint 21 shipped: Cat "Wet Paint"
  (+ Sprint 20 art landed)** — first roster expansion past the launch eight,
  pure data + generated art (zero engine changes). `cat.json`: light/fast
  painter-dancer trickster (health 980, walk 5.4), six-button dance kit with
  lights→lights/mediums chains, universal throw, and four specials all on
  existing plumbing — **Flour Bomb** (qcf+P, low `field`/`slowFactor` pigment
  puddle, feet-anchored render), **Thread of Life** (qcb+P, knockdown lash =
  Vine Spear minus `pull`), **Pirouette** (dp+K, `leap`+`invuln` reversal),
  **D. Catarina** (hcf+P old-lady cane whack; her lore ↓↓ has no engine motion
  so remapped to hcf and DECLARED BEFORE the qcf Flour Bomb so the shared tail
  doesn't steal it). NEW **Still Life** fatality (hcb+P — designed here, bible
  had none): paints the husk into an unflattering framed portrait. Full 7-step
  gen run (62-cell 8×8 sheet + 2 keyed projectiles, 16 grunts + `CAT!`
  announcer, 4 fatality panels; canonical/KO bust pre-existing) — 0 failures.
  `frames-manifest.mjs` cat pose dict; `index.ts`/`roster.ts` (playable);
  FightScene `PROJ_SIZE`/`PROJ_FEET_ANCHORED`; `gen-audio.mjs` gained a
  `--char` scope flag (so single-character runs don't touch parallel builds).
  4 new vitests (hcf/qcf order, both projectile specials, determinism) —
  **134/134 green, tsc + prod build clean**; art verified cell-by-cell via
  canvas render (live fight blocked only by the parallel Bodhi build's
  incomplete assets, not Cat). This commit also lands Sprint 20's staged art
  (regenerated sheets/portraits) that was awaiting go-ahead, plus in-flight
  Bodhi scaffolding and future-character raw canonicals from parallel sessions.
  — Claude

- **2026-07-04 · engine+data+tools+assets+docs · Sprint 20 shipped:
  personality specials + Burn One** — one signature special per fighter,
  three new engine primitives, all data-driven. (1) NEW mash input:
  `SpecialInput.mash: N` — fires when N fresh press edges of the button
  class sit in the input buffer and the final press is this tick
  (`mashedStrength`); Kirby's **Cat Scratch** (mash P). (2) NEW melee
  rehit: `MoveDef.rehit` lets one activation reconnect every N ticks
  through the active window (`Action.lastHitFrame` gates spacing) — hits
  refresh the reel, scale as a combo, and chip repeatedly through block;
  Cat Scratch + Yulia's **Spinning Star Kick** (charge d,u+K). (3) NEW
  pull projectile: `ProjectileDef.pull` — an UNBLOCKED hit snaps the
  victim to the owner's feet (85px, wall-clamped) mid-launch so the
  knockdown lands them right there; blocked = plain pushback; Marzipan's
  **Vine Spear** (bf+P). (4) NEW slow-fall float: `MoveDef.float {vy,
  gravity}` launches airborne at first active; `FighterState.floatGravity`
  overrides fall gravity during air/airAttack, cleared on touchdown and by
  applyHit; Freeman's **Yoga Float** (qcb+P) — 181-tick hang vs ~40 for a
  jump, air normals live. Riding existing plumbing: Gene's **Mana Burst**
  (bf+P logo fireball), Flo's **Blunt Puff** (qcf+K lingering rehit smoke
  ring), Vincent's **Matrix Teleport** (qcf+K, teleport-behind + invuln 14
  — cell art is CRIMSON runes because green FX keys out on the chroma
  screen). Flo's fatality is now **Burn One** (ignite the husk → roll the
  ash → smoke it; 4 panels generated, replaces rm -rf /, flo.json +
  gen-fatality.mjs prompts swapped). frames-manifest grew 3 pose cells per
  touched fighter (+3 projectile arts: mana-burst, vine-spear, blunt-puff);
  sheets regenerated + repacked (65/65/62/65/62/65/62 cells). CpuDriver
  needed nothing (mash specials are filtered out; motion specials picked
  up automatically). docs/CHARACTERS.md + docs/MOVES.md updated. 9 new
  vitests — 130/130 green, tsc clean, all four primitives verified live in
  the browser via the engine module. — Claude

- **2026-07-04 · engine+data · Sprint 19 shipped: cancels & chains** — all
  four items, engine + character data only (no renderer changes needed).
  (1) Chains: `chains: string[]` on a move lists the ids a CONTACTED move
  (hit or block — `hasHit`, never a whiff) may cancel into; consumed from
  the Sprint 18 action buffer at the top of updateFighter's attack case, so
  presses during hitstop chain naturally. All lights chain into all lights
  on every kit; light→medium where the kit wants it (Vincent lp→mp, Kirby
  lp→mp + lk→mk, Yulia lk→mk, Catherine lp→mp). (2) Special cancels:
  `cancel: true` normals (all non-knockdown mediums/heavies, roster-wide)
  cancel into any motion special on contact — grabs excluded (canceling
  into a command grab on a reeling victim is degenerate), one-fireball rule
  re-checked at cancel time. Window: contact → end of active +
  `CANCEL_WINDOW_TICKS` (8). (3) Combo damage scaling: `FighterState.
  comboHits` (victim-side) increments when a hit lands on an already-reeling
  (hitstun/airHit) fighter, resets the moment they stop reeling (hitstop
  holds it — freeze is time standing still); hits 1-2 full, then
  −`COMBO_SCALE_STEP`(10)%/hit to a `COMBO_SCALE_FLOOR` of 30%, integer
  math, ≥1 dmg; stun feeds on the SCALED damage so long strings can't also
  be free dizzies. Mash-jab midscreen naturally drops after ~5 hits from
  pushback — that's spacing, not a bug. (4) 11 new vitests (chain on
  hit/block, whiff never cancels, lights don't special-cancel, medium
  cancels on hit/block/not-whiff, scaling curve 45/45/40/36/31, 30% floor,
  drop-resets-scaling, chained-string determinism) — 121/121 green, tsc
  clean, verified live in the browser (dev training scene + engine module
  driven headless: same deltas). — Claude

- **2026-07-03 · engine+scenes · Sprint 18 shipped: input forgiveness + hit
  feedback** — all six items, engine-core only + renderer presentation.
  (1) Action input buffer: `FighterState.buffered` captures a fresh press in
  any unactionable state (incl. during hitstop) with the attack pick resolved
  at press time — motions keep their window, so wakeup reversals work — and
  fires it on the first actionable frame (TTL 8, consumed once, fireball rule
  re-checked). (2) Counterhits: startup/recovery clips (not active-frame
  trades) reel ×1.5 hitstun with +3 victim-only freeze and a `counter` action
  flag; FightScene diffs it into a red spark + layered crack + harder shake.
  (3) Landing recovery: new `landing` kind — 3 ticks plain jump, 6 after a
  whiffed air normal. (4) Per-fighter hitstop: `GameState.hitstop` →
  `FighterState.hitstop`; melee freezes both, projectiles the victim only,
  max() on stacked freezes, frozen fighters skip their update, timer/throw-
  tech pause while anyone's frozen, non-fight phases keep the whole-world KO
  freeze, projectiles fly through freezes. (5) Ground bounce: airHit rebounds
  once (invulnerable, `bounced` flag), throws inherit it; dust puff + thud on
  impacts. (6) Hitstop retuned 3/5/7/8 → 4/6/9/10. 17 new vitests (110/110),
  tsc clean, verified live (demo bots, ~5700 frames: asymmetric freezes,
  bounces, counters, landing countdown all observed; zero console errors).
  Committed (not pushed) on the user's go-ahead; the same commit carries a
  parallel session's uncommitted SPRINTBOARD docs edits (long-term RFE
  additions — same file, docs-only). — Claude

- **2026-07-03 · docs · long-term stretch goals added to the RFE roadmap** —
  user-requested, explicitly not current priorities: super bar + super move
  per player (promoted from the Icebox, carries the super-freeze note with
  it), arcade story mode expanded with its presentation concept (fight every
  fighter in their home stage; stylized overhead Mars/Bombay Beach map zooms
  into a location per stage between fights), SF2-style item-breaking bonus
  stages (absorbs the Icebox car-smash homage), unlockable hidden characters
  from town (Tao, RJ, Rapha, Anderson, Puddles, …), expanded Martian roster
  (promoted from the Icebox's "new characters"), and per-character double
  jump via a character-JSON flag. Icebox trimmed to match. No code changed.
  — Claude
  audited an industry-conventions "special sauce" list (36 items), a
  time-freeze follow-up, and the user's personal fix list against the engine
  and FightScene. Already covered (no action): hitstop, KO slow-mo, motion
  leniency, hit/hurt/push box separation, pushback + corner transfer,
  auto-facing, pre-jump frames, attack heights/block triangle,
  snap-to-ground, screen shake, per-type sparks, round/menu flow,
  fatality-as-cinematic. Biggest gap found: **action input buffering** —
  `freshPress` is an exact-tick check, so presses during recovery/hitstun/
  getup are silently dropped. Also found: global hitstop freezes a
  projectile's SHOOTER on hit (SF fireballs freeze the victim only).
  Planned **Sprint 18** (action buffering + reversal buffer, counterhits,
  landing recovery, per-fighter asymmetric hitstop, ground-impact bounce,
  hitstop-tuning playtest), **Sprint 19** (chains, special-cancel windows,
  combo damage scaling — promoted off the near-term roadmap), **Sprint 20**
  (seven personality specials — two NEW primitives: pull-projectile for
  Marzipan's vine spear, slow-fall float for Freeman; mash motion promoted
  from the S8 deferred list for Kirby's cat scratch; Vincent's matrix
  teleport reuses Gene's `teleport:'behind'` — plus Flo's fatality reworked
  to "Burn One"). Near-term roadmap gained: per-move hurtbox overrides,
  post-stun throw protection, height normalization + pack-time ground-
  baseline autodetect, post-fatality→victory-screen flow, attract-mode
  blink cleanup, sound priority/cooldowns, projectile-clash + throw-tech
  feedback. Icebox: proximity normals and camera zoom declined; super
  freeze rides the future super meter. Header advanced to Sprint 18
  (S17 shipped earlier today in a parallel session). No code changed.
  — Claude

- **2026-07-03 · audio+tools+scenes · voice-variant depth: 6 kiai / 6 hurt /
  4 victory per fighter** — `VOICE_COUNTS` in BootScene bumped from 4/4/3;
  `gen-audio.mjs` line lists expanded to match (incl. requested lines: Flo
  "Genau"/"Ah, OK", Gene "Mana Blast"/"Yeah"/"Oh yeah", Yulia "Fantastic",
  Marzipan "Please, collaborate with me"); all 128 numbered clips generated
  via ElevenLabs into `public/assets/audio/voice/`; deleted the 16 orphaned
  unnumbered `<char>-kiai/-hurt.mp3` clips (loader only requests numbered
  files). Slot counts are a BootScene↔gen-audio contract — noted in both
  files. *(Claude)*

- **2026-07-03 · engine+scenes+data+assets · Sprint 17 shipped: universal
  throws (LP+LK, techable) + dizzy/stun** — code complete, frames reviewed &
  APPROVED by the user (two re-roll rounds + manual raw edits, sheets packed
  from the approved raws), sitting in the working tree ready to commit.
  Engine: new `LPLK` cross-class chord
  (`throwChord` in step.ts, mirrors `comboPress`; staggered LP→LP+LK upgrades
  the jab via the existing early-chord kara rule), `throw` rides the existing
  `grab` plumbing plus a new `techable` flag — on connect the victim is held
  (`pendingThrow` on GameState, 12-tick window) and their own LP+LK techs it
  (both bounce apart through a 10-tick recoil, zero damage); expiry lands an
  unblockable knockdown. Throws whiff on airborne/hitstun/blockstun/airHit
  victims. Dizzy: `stun` accumulator on FighterState (gains = damage on clean
  hits only, decays 0.5/tick, threshold 250 → forced `dazed` ~3s once the
  reel/getup ends, resets on daze end or on the punish landing — no
  double-trigger). `dazed` REMOVED from `isInvulnerable` (dizzied fighters are
  fully vulnerable; safe because the finisher phase never resolves attacks).
  Renderer: circling-stars `vfx-dizzy` overlay (new generic in gen-vfx.mjs,
  one asset roster-wide) drawn above a dazed fighter's head; grab-thunk SFX on
  hold start; LP+LK shown in move log + pause move list. Data: `throw`
  MoveDef appended to all 8 JSONs (dmg 85/range 105; Yulia 100/115). Art: 24
  throw cells generated + packed (gen once → user review found opponent-
  bleed/edge-cropping in most startup/active frames → prompts rewritten to
  solo-mime "reaching" poses + a new global FRAME_RULES edge-margin rule in
  gen-frames.mjs → 15 cells re-rolled via `--cells`, Gene's originals kept;
  round 2: all 7 non-Gene `throw-active` cells re-rolled again as an active
  forward air-grab — arms extended toward the frame edge, hands clutching
  empty air behind a small impact flash).
  9 throw + 5 dizzy vitest cases; 95/95 green, tsc + build clean; verified
  live in the browser (throw hold→knockdown sequence, dazed + overlay).
  docs/MOVES.md §1.2/§1.3 updated with both specs. — Claude

- **2026-07-03 · docs · Sprint 17 planned: universal throws + dizzy/stun** —
  investigated the sprite-sheet pipeline's actual regeneration/reindex risk
  (traced `tools/pack-sheet.mjs` + `tools/frames-manifest.mjs` + `FightScene`
  cell resolution) to confirm append-only cell additions are 100% safe (no
  regen, no mapping breakage) while inserting into the shared `CELLS` array
  would reindex every character's button cells roster-wide — that finding
  shaped the Sprint 17 design: universal throw art is a per-character named
  special appended the normal way (attacker only; the victim reuses existing
  hit/knockdown cells, so zero new shared cells), and dizzy/stun ships via a
  VFX overlay (one generic asset, like the existing impact-spark system)
  rather than new body-pose art, since `dazed` is already a recognized
  `Action.kind` that renders today via the `hit`-cell fallback. Locked the
  throw input (LP+LK chord, close/grounded/unblockable, with teching) and
  scoped sprite gen to run first/in-background so art lands for review while
  engine work proceeds — explicitly no iterative frame QA/re-roll loop this
  sprint, that's a manual human pass. Sprint 16 closed out fully (all 5 boxes);
  pulled throws + dizzy off the near-term roadmap into their own sprint. No
  code changed. — Claude

- **2026-07-03 · input+scenes: gamepad menu navigation, three real controller
  bugs fixed** — the earlier "gamepad verified end-to-end" pass only exercised
  the *in-match* input path; menus, character select, settings, pause, and the
  win screen had zero pad wiring. Added `src/input/menu-nav.ts` (`MenuNav` +
  shared `menuNav` singleton): dpad/stick navigates, any punch or kick button
  (read from live bindings) or Start confirms, Select/Back opens the
  menu/backs out — wired into `MenuScene`, `SelectScene` (fighter grid +
  stage dialog), `SettingsScene`, `ControlsScene`, `VersusScene`, and
  `FightScene` (pause dialog, win screen, Start-to-pause mid-match). Also
  fixed the gamepad-only autoplay-unlock gap in `src/audio/music.ts` (browsers
  gate `<audio>` playback on a user gesture; only `pointerdown`/`keydown` were
  listened for, so a controller-only session never heard music — added a
  gamepad-press poll with re-arm-on-rejection).
  User playtesting surfaced three real bugs the synthetic-pad harness had
  missed, root-caused by reading Phaser source directly (not guessing):
  (1) **Phaser's per-scene `GamepadPlugin` drops stale-timestamp pads** —
  `Gamepad.update()` ignores any snapshot whose `timestamp < this._created`,
  and every scene start creates a fresh wrapper stamped "now"; Chrome only
  bumps a pad's timestamp on state *change*, so input froze after the first
  scene transition. Fix: read `navigator.getGamepads()` directly everywhere,
  never `scene.input.gamepad`. (2) **pad-triggered `scene.start()` calls
  queued inside `update()` sometimes never applied** on real hardware (the
  selection registered — confirmed via the `devLaunch` dev replay hook — but
  the next scene never rendered); keyboard/mouse escape this because their
  handlers run in Phaser's input phase, same-frame. Fix: `navDefer()` fires
  every pad-triggered scene transition from a macrotask between frames (a
  scene-active guard skips it if a double-press already queued two). (3)
  **`GamepadPlugin.stopListeners()` crashes on every scene shutdown** when a
  controller sits at a browser gamepad index > 0 (common after Bluetooth
  reconnects) — its wrapper array is sparse and indexed by controller index,
  so `this.gamepads[0].removeAllListeners()` throws on the hole, uncaught,
  killing the whole game loop mid-transition. This was the actual root cause
  of "select once, then stuck" and explains every earlier symptom. Fix: the
  gamepad plugin is now fully disabled (`input: { gamepad: false }` in
  `main.ts`); the one remaining Phaser-plugin consumer (`KeyboardSource` in
  `src/input/keyboard.ts`, the in-match fight input) now reads
  `navigator.getGamepads()` directly too, with pads compacted by connection
  order (first connected pad → P1, second → P2) instead of raw browser index.
  Added a dev-only on-screen error banner (`main.ts`, `window.onerror` +
  `unhandledrejection`) so a future silent freeze surfaces its stack instead
  of just "the game is stuck" — this is what caught bug (3).
  Verification: 9 new unit tests in `src/input/menu-nav.test.ts` (rising-edge
  seeding kills phantom presses from a button already held on load, buttons
  never auto-repeat, directions do, Start/Select vs. confirm mapping, a press
  held across a scene transition fires exactly once). In-browser: scripted a
  real-time (real `requestAnimationFrame`, non-deterministic-timing) synthetic
  pad through the full loop — title → menu → character select (both slots) →
  stage dialog → versus splash → fight → pause → settings — under the user's
  exact failure condition (pad at gamepad index 1, index 0 empty); zero
  errors, every transition landed. User confirmed fixed on real hardware.
  81/81 vitest, `tsc --noEmit` clean. — Claude

- **2026-07-03 · assets · yulia frame QA + new-roster inspo batch** — yulia:
  re-rolled `51-backbend-guillotine-active` and `55-volga-piledriver-recovery`
  (volga recovery prompt in `frames-manifest.mjs` tightened: compact dust puff
  kept away from the frame edges) and repacked her 8×7 sheet. Character-inspo:
  12 new candidate-fighter photos added (bodhi, cat, chebel, earl, haidai,
  katana, lyosha, rapha, seva, vanessa, xiao-chen, ygor + lyosha/ygor/seva
  face shots); the two unnamed MARS-PASSPORT jpgs were replaced by their
  named equivalents. Work from the parallel session, committed on user
  request. NOTE: the repo is public — these are photos of real people, same
  standing caveat as the original eight. — Claude

- **2026-07-03 · verify+assets · Sprint 16: gamepad path verified end-to-end +
  juice/VFX demo recorded** — synthetic standard-mapping pad injected into the
  preview browser (`navigator.getGamepads` monkeypatch; GOTCHA: Phaser's
  `Gamepad.update` drops pads whose `timestamp` predates the wrapper's
  `_created` — make the fake pad's timestamp a live `performance.now()`
  getter, and do NOT hand-dispatch `gamepadconnected` events without a
  `.gamepad` payload or the plugin queue crashes; `refreshPads()` polls every
  update anyway). Verified through the real fight loop: pad registration,
  dpad-right walks / left-stick walks back, X→LP Y→MP RB→HP A→LK B→MK,
  RT analog fires HK at 0.6 and stays idle at 0.2 (0.4 threshold), dpad
  QCF+X produced a live Sigil Bolt (motion buffer through the pad), and
  ControlsScene pad press-to-bind bound LB→LP then reset. Bindings and match
  settings restored to defaults afterward — **ready for the user's real
  controller playtest**. Recorded `juice-vfx-demo.mp4` (repo root, 31s,
  30fps): scripted Yulia vs zoner-CPU Vincent on CHIBA — jab/heavy sparks
  with hitstop, blocked sigil bolts, TWO Volga Piledrivers with the ground
  smoke cloud, ghost bars draining both ways, KO slow-mo into FINISH THEM!,
  and a scripted Heart Breaker fatality (all four panels) into the win
  screen. Captured via deterministic frame-dump (pump `loop.step`, canvas
  JPEG per 2 renders → local HTTP receiver → ffmpeg 30fps), immune to
  preview-tab rAF throttling. 72 tests green; prod build clean. — Claude

- **2026-07-03 · input+scenes · Sprint 16: control remapping** — bindings
  moved into settings: `bindings: [PlayerBindings, PlayerBindings]` with
  per-action keyboard keyCodes AND gamepad button indices (defaults = the old
  hardwired layout; deep-sanitized against corrupt storage). `KeyboardSource`
  now builds its key maps and pad lookups from settings at construction (each
  fight picks up the latest bindings) and captures every bound key so arrows/
  space stop scrolling the page; the left stick always drives movement,
  unremappable. New `ControlsScene` (Settings → CONTROLS → REBIND ►): P1/P2
  tabs, ten action rows × [KEYBOARD][GAMEPAD] press-to-bind cells (click →
  "PRESS…" → next key / next FRESH pad button binds; ESC cancels),
  same-device duplicates SWAP with the old binding so no action is ever
  orphaned, RESET BINDINGS + BACK rows. 72 tests green, tsc clean. Verified
  in-browser: rebound P1 LP→Q (persisted), MP→W swapped W/T with UP, P2
  untouched; in a live fight Q jabbed and the old R did nothing; reset row
  restored defaults. Gamepad-button binding exercised with the synthetic-pad
  harness in the controller-verification pass. — Claude

- **2026-07-03 · scenes+ai · Sprint 16: attract mode** — idle on the title for
  20s (keyboard/mouse/pad activity all reset the watchdog, pads polled since
  sticks don't emit events) → CPU-vs-CPU demo fight: random playable pair +
  random stage, HUD on, blinking "DEMO — PRESS ANY KEY" banner, `CpuDriver`
  driving BOTH slots (`botP1`). Any key/click/pad button exits to the title;
  in demo none of the human-match keybinds (pause/rematch/move-log) are
  registered. matchEnd auto-returns to the title after the win-screen beat
  (phaseFrame 300) or when the victory track ends, whichever lands first.
  72 tests green, tsc clean. Verified in-browser (throttled-tab loop pumping):
  idle → demo (marzipan vs freeman on chiba, both bots fighting to a
  roundEnd), keydown → straight back to Menu. NEW GOTCHA for preview
  verification: after a reload in a throttled tab the Boot loader can finish
  its list without ever firing 'complete' — resume the audio context, call
  `checkLoadQueue()` a few times, then pump `__game.loop.step(t)` manually;
  scene.start ops also only apply on pumped steps. — Claude

- **2026-07-03 · assets+tools+scenes · Sprint 16: impact-VFX overlay system** —
  new `tools/gen-vfx.mjs` (`npm run gen:vfx`, pooled, idempotent, prompt
  sidecars, MAGENTA chroma screen — never green): generates (a) three greyscale
  generic sparks (`public/assets/vfx/spark-{hit,heavy,block}.png`) tinted the
  attacker's character color at runtime, and (b) per-move overlay art that
  lives with the move like projectiles do
  (`public/assets/sprites/<char>/vfx-<moveId>.png`, prompts in the script's
  `PER_MOVE` dict). New render-only `vfx: {size, anchor: 'impact'|'ground'}`
  hint on `MoveDef` (engine never reads it) wires per-move art: shipped Yulia
  Volga Piledriver ground smoke + Vincent Rising Glyph energy column.
  FightScene: overlay sprites spawn from state-diffing in `presentTick` —
  every connecting hit picks per-move art if declared, else a generic spark
  (heavy for specials/H-buttons/55+ damage, small for the rest), block contact
  spawns an icy shield ripple; overlays grow + fade over ~14 render frames,
  fall back to the legacy flash circle when textures are missing (dev-404
  gotcha). BootScene loads generics + every declared per-move VFX. CLAUDE.md
  pipeline step 8 + command documented. 72 tests green, tsc clean. Verified
  in-browser through the real engine path: scripted jab → 90px tinted spark,
  HK → 135px heavy burst, 360+HP Volga Piledriver → 240px ground smoke under
  the piledriven victim (screenshot ftw — ghost bar visible in the same
  frame). — Claude

- **2026-07-03 · engine+scenes · Sprint 16: game-feel juice bundle** — hitstop:
  connecting hits freeze the whole world (fighters, projectiles, clock) for a
  beat, deterministic in-engine (`GameState.hitstop`, set in `applyHit`, gated
  at the top of `step()` AFTER input buffering so motions finished during the
  freeze still come out); scaled by button strength (L 3 / M 5 / H 7 ticks),
  specials + their projectiles hit hardest (8), lingering rehit clouds stay
  light (3) so tick damage doesn't stutter the match; blocked contact freezes
  too; trades keep the longest freeze; a KO's freeze carries into roundEnd
  before the bodies fly. Delayed red health drain: SF2 ghost bar in
  `drawHud` — lost health lingers red behind the live bar for ~half a second,
  then drains toward it (snaps up on refill/round reset); renderer-only. KO
  slow-motion: the round-ending hit plays at ~⅓ speed for the first 55
  phaseFrames of roundEnd/finisher (accumulator scaling in `update` — pure
  presentation, the tick sequence is identical). 72 tests green (4 new
  hitstop specs: strength scaling, world freeze incl. timer, special-via-
  projectile hardest, block freeze + round-reset clear). Verified live
  in-browser via a probed CPU fight: maxHitstop 8, ghost gap 160hp draining,
  tick rate 60→<21/s in the KO window, full intro→fight→finisher→fatality
  flow clean. — Claude

- **2026-07-03 · assets+data · MIMOS stage** — generated the MIMOS café-lounge
  stage from `assets/stage-inspo/MIMOS/` (orange-red pallet-rack lounge, pink
  star canopy, MAIS AMOR posters, coffee bar, ping-pong table at left, white
  gravel fighter foreground) via the locked pixel-art pipeline; `SCENES` line
  in `tools/gen-stage.mjs` + registry entry in `src/data/stages.ts` (19 stages).
  Verified in-browser (texture loads, boot clean) + tsc clean. Re-rolled once
  per user: first take read too clean/vector-flat — reworked the `SCENES` line
  to emphasize gritty weathered/lived-in clutter and MARS-grade dithering
  (first take backed up in scratchpad). Part of the still-uncommitted
  stage-art batch. *(Claude)*
- **2026-07-03 · docs · sprintboard/README/CLAUDE.md refresh + Sprint 16 plan** —
  reconciled stale checkboxes after the keyboard playtest (things mostly work):
  ticked S4 human playtest (controller playtest carried to S16), S5 roster
  frame QA + v2 sheets (done in S6/S7/S14), S11 Flo TRAINING verify, S13
  Freeman balance pass, S14 kirby KO bust; S8 deferred mechanics stay deferred.
  Planned **Sprint 16 — smoothness & playability**: controller playtest,
  impact-VFX overlay system (greyscale+tint generics & per-move art), attract
  mode (idle menu → CPU-vs-CPU demo), per-player control remapping in Settings,
  juice bundle (hitstop, delayed red health drain, KO slow-mo). Added approved
  near-term roadmap (combo chains/cancels, blocking feel, throws+teching,
  dizzy, damage scaling, CPU difficulty, round intros/victory poses, CRT
  toggle) and long-term RFEs (character designer dialog, online multiplayer,
  arcade story mode, Veo motion smoothing). Icebox rebuilt (dropped shipped
  items, added declined-for-now ideas). README status brought to 8/8 +
  19 stages + music; CLAUDE.md roster/commands touched up. — Claude

- **2026-07-03 · scenes+audio · quick-volume overlay + mouse-first settings +
  select QoL** — new `VolumeOverlayScene` pinned lower-right, launched once at
  boot above every scene: fades in on mouse motion, hides after ~2.6s (stays
  while muted/dragging); speaker click = master mute, fader drag = master
  volume, both persisted + applied live. New `masterVolume` (default 100%) and
  `muted` settings scale music AND SFX via `src/audio/volume.ts`
  (`effectiveSfxVolume`/`applyMusicVolume` — the one place volume math lives).
  Settings page: MASTER VOLUME row added; faders are real draggable tracks
  with handles; ROUND TIME / MATCH LENGTH step by horizontal drag or click to
  cycle; arrows still nudge; settings page and overlay live-sync when the
  other changes values. Character select: mouse now drives P1 then P2 in every
  mode (hover moves the active cursor, click confirms), and ENTER confirms in
  sequence P1 → P2 → stage. Verified in-browser: overlay reveal/mute/drag,
  fader + stepper drags, reset-defaults click, and a full two-player
  click/ENTER select into the VS screen. 68 tests green. — Claude

- **2026-07-02 · assets+engine+stages · Gene + Marzipan (8/8 playable) + pixel-art
  stage expansion + music/kirby assets** — bundles this session's fighter work with
  parallel-session stage & audio work into one snapshot commit.
  **Fighters (this session):** harvested Gene + Marzipan off the stale
  `origin/marzi-char` draft rather than merging it (would have reverted main's
  round-clock/winQuotes/leap/freeman/pipeline work). Cherry-picked branch-only
  assets — packed sprite sheets + per-move projectiles, fatality panels
  (`four-oh-four`/`compost`), voice grunts, the two character JSONs, raw canonicals
  + frame dumps + `MOVE_DURATIONS.md` — and **hand-ported** the engine mechanics
  they depend on onto current main: `teleport` (Diffusion), grab `heal` (Symbiosis),
  projectile `rehit` clouds (Spore Bloom), `slowFactor` slow-field (Rate Limit),
  + the chord-upgrade fix. Kept the branch canonicals (refined "never green"
  chroma-safe prompts the sprites came from). Registered both in `index.ts`/
  `roster.ts`/`FightScene.ts`/`frames-manifest.mjs`, authored `winQuotes` for each.
  Roster now 8/8 fully-built and playable, all with fatalities. 68 tests green
  (9 new), typecheck + build clean, 16 new assets 200 + both selectable in-browser.
  **Stages (parallel session):** locked 16-bit pixel-art look (`gen-stage.mjs`
  reworked, CLAUDE.md step 5 rewritten), existing stage backgrounds regenerated in
  the new style + 8 new stages registered in `stages.ts` (ALTAR, CHIBA ROOF,
  DODECAHEDRON, DOME, PAINTED CANYON, SKI INN, VAN, SALTON) with inspo folders;
  superseded cel-shade art archived under `_old/`.
  **Audio/misc (parallel session):** raw generated music tracks under
  `assets/raw/music/`; kirby KO/defeated bust regenerated from the new canonical.
  — Claude

- **2026-07-02 · engine+scenes · settings page (volumes, round clock, match
  length)** — new `SettingsScene` off the main menu (`4 · SETTINGS`): music
  volume (live), SFX volume (audible preview), round time (OFF/30/60/99s),
  match length (best of 1/3/5), reset-defaults row; W/S+A/D or mouse,
  persisted to localStorage via `src/settings.ts`. Engine: match rules moved
  into deterministic state — `initialState(..., rules?)` takes `MatchRules`
  (`roundTicks` 0 = clock off, `winsNeeded`), replacing the WINS_NEEDED /
  ROUND_TICKS constants at runtime; timer-off never time-ups, HUD shows ∞.
  `play()` now scales every SFX by the setting. Defaults (user-picked): music
  60% · SFX 80% · 60s rounds · best of 3. 4 new engine tests (59 green).
  Verified in-browser: fresh profile shows the new defaults; settings persist;
  OFF/best-of-5 flowed into a live fight (`rules {0,3}`, ∞ HUD). — Claude

- **2026-07-02 · audio+scenes · full music loop: title/versus/victory tracks +
  end-driven flow** — installed the Suno utility batch: `menu/title.mp3`
  (seamless title loop), 10 `versus/` clips, `victory/victory.mp3`, bonus 4th
  institute track (42 tracks total). Playback grew `once`/`onEnd` (play a
  single pass, caller reacts to the end) and `nextTrack()` (crossfade to a
  different track in the current context). Flow now: title loops menu→select,
  VS screen plays one random clip and **its end starts the fight** (timer
  fallback if no tracks/blocked audio), stage folders rotate to a fresh track
  between rounds (single tracks keep looping), victory plays once over the
  win-quote screen and **its end returns to character select** (click/ENTER
  skips, R rematches) where the title loop resumes. Smoke-tested end-to-end in
  browser: title → select → versus clip → clip-end fight (institute) →
  round-boundary rotations (institute-1→3→1) → matchEnd victory.mp3 →
  auto-return to select with title playing. Icebox: per-character `victorySong`
  attribute. — Claude

- **2026-07-02 · scenes+audio · SF2-style VS screen + music paradigm cleanup** —
  new `VersusScene` between stage confirm and Fight: portraits slide in on
  black (P2 mirrored to face off), name plates, red-burst VS pop, stage name,
  blinking INSERT COIN homage; 3.4s hold, any key/click skips. Music contexts
  simplified to the final paradigm: `menu/` loops from title through character
  select, fades into `versus/` on the VS screen, stage music runs the fight,
  `victory/` fades in over the win-quote screen. Removed the `select/` and
  `fatality/` contexts (menu carries over; fatalities will be video cutscenes
  with baked-in audio). Scaffold/README/manifest updated. Verified in-browser:
  select → VS screen → auto-advance → fight playing salton stage track.
  `menu/`, `versus/`, `victory/` still await tracks (Suno prompts handed to
  user). — Claude

- **2026-07-02 · assets · stage music tracks installed** — copied 29 mp3s from
  `assets/raw/music/Martian Kombat/` into `public/assets/audio/music/stages/<id>/`
  (kebab-cased filenames), regenerated `manifest.json`. Every stage has music
  except `dome` — `DOJO.mp3` had no matching stage so it went to
  `stages/default/` and covers dome via the fallback chain. Multi-track stages:
  altar (3), institute (3), chiba/drive-in/estates/saturn/shipwreck/ski-inn/van
  (2 each). Verified in-browser: salton/altar/chiba fights played their own
  tracks, dome fell back to default; mp3s stream (206) with zero failed
  requests. Menu/select/victory/fatality folders still await tracks. — Claude

- **2026-07-02 · audio+tools · stage/menu music playback scaffold** — new
  `src/audio/music.ts`: streaming HTMLAudio music keyed to named subfolders of
  `public/assets/audio/music/` (`menu/`, `select/`, `victory/`, `fatality/`,
  `stages/<id>/` + `stages/default/` fallback; see README there). Multi-track
  folders pick randomly and rotate on end; single tracks loop; empty folders
  degrade gracefully (select falls back to menu, victory/fatality keep stage
  music). `tools/gen-music-manifest.mjs` (`npm run gen:music`, auto via
  predev/prebuild) scans folders → `manifest.json`; `--scaffold` creates the
  context dirs. Wired into Boot/Menu/Select/Fight (stage music on create,
  victory/fatality overlays on phase transitions); autoplay-block handled via
  first-gesture retry. `pickTrack` unit-tested (5 tests). Verified in-browser:
  menu → select fallback → fight stage-default chain all played. **No tracks
  committed yet — drop mp3s in and run `npm run gen:music`.** — Claude
- **2026-07-02 · assets+data+engine · Sprint 14: Kirby rebuild (Firebreather)** —
  reimagined Kirby as an acrobatic fire-breathing contortionist; stripped every
  tea/teacup/match reference (canonical flavor, manifest `always`, bible, win
  quotes). Face-shot ref merged into `gen-canonical` (`FACE[]`); new select icon.
  New kit, all on existing engine primitives: Fire Breath (qcf+P cone), Sonic
  Scream (qcb+P knockdown rings), Cartwheel (dp+K invuln anti-air), L/M/H variants.
  Promoted legacy 23-cell → v2 56-cell sheet (8×7) + 2 keyed per-move projectiles;
  grunts refreshed; removed stale bare `projectile.png`. Fatality Hot Yoga (hcb+P)
  + 4 panels. Updated the no-fatality KO-branch test (kirby now owns one). 50 tests
  green, build clean. Scoped commit: Kirby files only (stage-restyle work left
  untouched, pending its own approval). *(Claude)*
- **2026-07-02 · assets · stage art restyle: retro pixel-art pass (USER
  APPROVED, uncommitted)** — regenerated all 11 stages (10 + salton) via reworked
  `tools/gen-stage.mjs`: style contract switched from cel-shaded cartoon to
  16-bit retro pixel-art anchored on the salton-shoreline render (style ref
  copied to `assets/stage-inspo/style-ref-salton.jpg`, passed as first
  reference for every stage); hard "walkable floor to the bottom edge, no
  blank bands, no foreground obstructions" contract (fixes drive-in deadspace
  + chiba blocked floor); salton remade in 21:9 (now 1680×720 at its legacy
  path, no code changes); script now parallel via `pool()`
  (`--concurrency N`, default 4) with per-stage log-and-skip errors. Previous
  art offlined to `public/assets/backgrounds/stages/_old/` and raws to
  `assets/raw/stages/_old/`. drive-in was re-rolled once for a continuous
  ground surface. Awaiting user approval before commit. Second pass: 4 NEW
  stages generated from new inspo folders (chiba-roof, dodecahedron,
  painted-canyon, ski-inn) with scene prompts in `gen-stage.mjs` and entries
  in `src/data/stages.ts` (roster now 15 stages); verified in-browser — all
  stage textures load, menu renders new salton. Pre-existing unrelated
  console error: `proj-yulia` (missing
  `public/assets/sprites/yulia/projectile.png`). All 15 approved by user.
  Third pass: previous wrecked-structure dodecahedron render renamed to new
  stage DOME (id `dome`; its inspo refs moved to `assets/stage-inspo/DOME/`);
  DODECAHEDRON regenerated from a new user photo
  (`assets/stage-inspo/DODECAHEDRON/image.png` — intact skeletal dodecahedron
  silhouetted at blue-hour dusk, owl perched on top, camp lights on horizon).
  Registry now 16 stages; both textures verified loading in-browser. Fourth
  pass: ALTAR (desert ritual altar, solar-panel wall, flowers/silver vessels)
  and VAN (graffiti sprinter on sunset playa) generated from new inspo
  folders; van re-rolled once — first take kept photographic detail, prompt
  gained an explicit "redraw everything as pixel art" line. Registry now 18
  stages; both verified loading in-browser. Fifth pass: van re-rolled again
  per user (centered, three-quarter angle, invented front end the ref photo
  crops off); CLAUDE.md pipeline step 5 rewritten to document the stage
  workflow (style-ref anchor, 21:9/1680×720, floor contract, SCENES dict +
  `src/data/stages.ts` registry, `npm run gen:stages`); stage-select dialog
  grid now auto-sizes to the option count (SelectScene `layoutStageGrid`:
  picks the 4–10 column layout with the largest fitting 21:9 thumbs, centers
  rows — the old fixed 4-col grid already overflowed 540px at 19 tiles).
  Verified: 55 tests green, tsc clean, dialog shows all 19 tiles in 5 cols
  in-browser, WASD/arrow row-jumps follow the computed column count. *(Claude)*
- **2026-07-02 · assets · Flo frame QA fixes** — cleaned up Flo cells flagged for
  duplicate/extra-limb artifacts: re-rolled 5 via `gen-frames --cells` (lk-active,
  mk-recovery, clk-recovery, cmk-recovery, chk-active), and the user manually
  fixed/QC'd further cells (down, hk-active, clp-recovery). Repacked Flo's 8×8
  sheet (59 frames, alpha verified transparent). *(Claude + user)*

- **2026-07-02 · tools+assets · Freeman frame QA re-rolls** — added a `--cells`
  targeted-regen flag to `gen-frames.mjs` (regenerates ONLY the named cells —
  bare id or `NN-id` stem — force-overwriting, anchor-first still honored,
  projectiles skipped). Re-rolled 5 Freeman cells flagged for extra-limb /
  double-body artifacts (lk-startup, hk-active, clp-recovery, cmp-recovery,
  clk-active), user-QA'd, repacked the 8×7 sheet (alpha verified). Restored an
  unvetted `45-jmk.png` to the committed version first. *(Claude)*

- **2026-07-02 · tools+assets+data · Sprint 13: pipeline concurrency + Freeman** —
  Parallelized the gen pipeline: `lib.mjs` `pool()`/`concurrencyArg()`,
  `gen-frames.mjs` fans cells out (anchor-first, default conc 6), `gen-audio.mjs`
  pools announcer/voice/sfx (default 4). Freeman built end-to-end: 56-cell v2
  manifest entry (counter/turtle yogi, white-gold chi, specials Presence/
  Breathwork/Sun Salutation), 56 frames @ 219s (~5.5× vs serial, 0 failures),
  packed 8×7 sheet, freeman-kiai/-hurt grunts, `freeman.json` (flo-derived
  normals + three engine-valid specials, invuln/leap/forwardVel), registered +
  roster-unlocked. In-browser TRAINING verified: selectable, renders, INSTITUTE
  stage, all three specials fire (move-log confirmed). Fatality **Ego Death**
  (hcb+P): freeman `FATALITIES` entry + 4 generated panels (husk → white-gold
  lotus petals) + `fatality` block in JSON. `gen-fatality` also pooled;
  `gen:audio`/`gen:fatality` npm scripts added; CLAUDE.md documents fatality as
  pipeline step 7. Engine untouched; 50 tests green, typecheck clean. *(Claude)*

- **2026-07-02 · scenes+assets+data · Sprint 12: win-quote screen** — SFII-style
  post-match taunt: winner portrait vs beaten-and-bloodied loser portrait +
  random win quote, built in `FightScene.showWinScreen` on the matchEnd phase
  (engine stays pure). Added `winQuotes[]` to CharacterDef + all 5 playable
  JSONs; `gen-canonical.mjs` now emits `<id>-ko.png` defeated busts (all 8
  generated); BootScene loads them with a greyed-portrait fallback. CLAUDE.md +
  CHARACTERS.md rules updated. 50 tests green, build clean, both win directions
  verified in-browser. *(Claude)*

- **2026-07-02 · merge · flo-char → main** — merged the collaborator's Flo
  feature branch into main. Engine files (step.ts, types.ts, FightScene.ts)
  auto-merged cleanly alongside main's Sprint-10 UI-polish work; resolved
  conflicts in .gitignore (kept "commit raw frames" policy), SPRINTBOARD (kept
  both sprint sections), and flo canonical (kept collaborator's amber-glyph
  regen). 50 tests green, build clean. *(Claude)*

- **2026-07-02 · engine+data+assets · Sprint 11b: Flo PLAYABLE + fatality** —
  engine grew lobbed/fused/detonating projectiles, `field` smoke, projectile
  `knockdown`, and the charge `du` motion (banked charge counter, not a longer
  input buffer); flo.json + roster unlock; rm -rf / fatality panels. 49 tests
  green, build clean. In-browser verify still owed (Chrome extension was
  disconnected). Roster now 5/8 playable. *(Claude)*

- **2026-07-02 · assets+tools · Sprint 11: Flo asset set complete** — canonical
  (amber glyphs, chroma-safe), 59-cell v2 sheet packed + meta.json, 5 keyed
  projectiles, grunts. `gen-canonical.mjs`: `--char` filter + missing-source
  guard (assets/raw was wiped — regen from inspo works). `gen-audio.mjs`:
  per-grunt style/stability overrides. AGENTS.md symlinked to CLAUDE.md.
  NOT YET PLAYABLE: no flo.json — his kit needs engine work (delayed-detonation
  projectile, smoke occlusion, floor trap, charge motion). GOTCHA: block-crouch
  resisted the low anchor 3× — the one-off fix was adding the geometric
  "figure occupies ONLY the BOTTOM HALF of the frame" rule to the pose text
  (scratchpad regen-flo-block-crouch.mjs); consider baking that rule into the
  shared CELLS block-crouch/crouch prompts. *(Claude)*

- **2026-07-02 · assets+scenes · Sprint 10: 10 stages + stage select +
  parallax** — gen-stage.mjs turns each stage-inspo folder into a 21:9
  painted stage (all photos as refs); stages.ts registry; `stage` home-stage
  field in character JSONs; stage-select dialog (RANDOM default, home
  badges); FightScene parallax slides the extra 300px of 21:9 art opposite
  the fighters' midpoint; rematch keeps the stage. 41 tests green; verified
  in-browser. NEW GOTCHA: in the preview browser the Boot loader stalls on
  the audio tail (list N / inflight 0) — `game.sound.context.resume()` then
  `bootScene.load.checkLoadQueue()` and pump the loop. *(Claude)*

- **2026-07-02 · engine+assets+ai · Sprint 6** — named multi-specials w/
  conventional motions; fatality pipeline (finisher→cutscene→matchEnd) with
  Yulia's Heart Breaker; Vincent v2 53-cell sheet; CPU mode; 34 tests green;
  demo re-recorded with CPU-executed fatality. Gotcha: preview-tab rAF now
  free-runs — call `game.loop.stop()` before manual-stepping captures.
  *(Claude)*

- **2026-07-02 · engine+assets+ui · Sprint 5: six-button combat + art QA** —
  six buttons × stand/crouch/air with QCF+P specials (motion inputs live);
  Yulia on v2 50-cell sheet incl. her 8 QA'd regens; magenta-screen projectile
  fix; face-shot icons ×8; ESC move-list pause; meta.json name-driven cell
  lookup with legacy fallback. 27 tests green; verified in browser (rune
  visible mid-flight, pause overlay, debug boxes, crouch art). *(Claude)*

- **2026-07-01 · roster+engine · Sprint 4 (all but deploy/playtest)** —
  Catherine & Kirby playable (frames gen'd via pipeline, 2 Catherine pose
  regens needed; Jazzper dog + fire-cone projectile sprites); engine:
  projectile `height`/`ttl` + chip damage w/ 1-HP floor; gamepad merged into
  input source; grunts for both (Jessica/Laura voices); roster 4/8 playable.
  Verified in browser: catherine-vs-kirby with both projectiles live on
  screen. 21 tests green. Public deploy awaits user approval. *(Claude)*

- **2026-07-01 · audio+scenes · Sprint 3 complete** — ElevenLabs announcer
  (17 lines) + 6 SFX + 4 grunts via `gen-audio.mjs`; canonical painted-cel art
  for the remaining 6 Martians + keyed portraits via `gen-canonical.mjs`;
  Boot/Menu/Select scenes; FightScene: init(data) char pairing, audio via
  state-diff `presentTick`, combo counter, HUD portraits, mirror-match tint,
  matchEnd→rematch/reselect. Fixed `lib.mjs` sidecar regex (`[a-z]+` missed
  ".mp3" → prompts overwrote every audio file; now `[a-z0-9]+`). Verified
  in-browser: menu→select→fight flow, 16/16 audio keys cached, portraits
  keyed. 18 tests green. *(Claude)*

- **2026-07-01 · assets+scene · Sprint 2 complete** — user locked painted-cel
  style + salton-shoreline stage; built keyframe pipeline (gen-frames /
  frames-manifest / pack-sheet); generated + packed full sprite sets for
  Vincent & Yulia (23 cells each + Vincent projectile); scaled character JSON
  geometry ~2× to sprite proportions; FightScene renders sheets with state→cell
  mapping, tints, stage bg, capsule fallback; `window.__game` debug handle.
  Gotchas learned: use gemini-3-pro-image (not flash) for pose frames; use
  ffmpeg `chromakey` ~0.15 without `despill` (bleaches greens); transparent
  sheets preview dark in image viewers — composite before judging. 18 tests
  still green. *(Claude)*

- **2026-07-01 · tools · Sprint 2 style tests** — `tools/lib.mjs` (env loader,
  gemini/openai image helpers w/ prompt sidecars + skip/--force) and
  `tools/gen-style-test.mjs`; generated 6 character style candidates
  (digitized / painted-cel / pixel) + 4 Salton Sea stages into
  `assets/raw/style-tests/` (gitignored). Models verified live:
  gemini-3-pro-image, gemini-3.1-flash-image, veo-3.1, gpt-image-2. *(Claude)*

- **2026-07-01 · engine · Sprint 1 complete** — Vite+Phaser+TS+vitest scaffold;
  deterministic 60hz fight core in `src/engine/` (zero Phaser imports); walk /
  dash / jump / crouch / facing; frame-data combat with hit/block/low logic,
  knockdowns, projectiles (clash + one-per-owner rule), corner knockback
  transfer; best-of-3 round flow with KO/time-up; Vincent & Yulia as JSON;
  FightScene with capsule placeholders, HUD, F1 debug boxes; 18 vitest specs
  incl. determinism replay. Verified live in browser (walk-in + hit exchange
  drained both bars). Throws + chip damage deferred to Sprint 4. *(Claude)*

- **2026-07-01 · scaffold · Sprint 0 complete** — repo initialized; CLAUDE.md,
  SPRINTBOARD.md, README.md, .gitignore, .env.example, docs/CHARACTERS.md written;
  8 inspo photos committed; pushed to GitHub. *(Claude)*
