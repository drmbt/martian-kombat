# Martian Kombat — Unified Plan (2026-10-04)

> **Status:** ACTIVE — the single working backlog. It merges the two
> sessions run on 2026-10-04:
> 1. the **full-repo audit** (5 parallel deep-dives + direct verification
>    after ~11 weeks of inactivity; last commit `fbb5a28`, 2026-07-18), and
> 2. **MKS-1 / Sprint 28 Phase A** — the MUGEN / IKEMEN GO parity study,
>    the `src/bench/` frame-data lab + CI ratchet, and the Kung Fu Man
>    port at 100% measured parity (rationale and numbers:
>    `docs/FIGHTING_STANDARDS.md`; its §10 roadmap is folded in here).
>
> Until P1.1 restructures `SPRINTBOARD.md`, **this file supersedes
> SPRINTBOARD's "Current"/handoff sections** and FIGHTING_STANDARDS §10.
> The original audit documents are preserved verbatim in
> `docs/archive/handoff-2026-10-04-audit/`.
>
> **Branch:** everything from 2026-10-04 lives on
> `feat/mks1-rescue-handoff` (pushed). It reaches `main` by PR after the
> rescue lands (D7).
>
> | File | Run where | Purpose |
> |---|---|---|
> | `01-OLD-MACHINE-PASSOFF.md` | the ORIGINAL dev machine | rescue raw assets → private R2 + commit canonical anchors, on this branch |
> | `02-PLAN.md` (this file) | everywhere | the backlog |
> | `03-NEW-MACHINE-RESUME.md` | this (new) machine, after the rescue | restore + baseline + start the plan |
> | `RESCUE_REPORT.md` | written by the old machine | what was rescued, versions, gaps |

---

## 0. How to work this plan (session protocol)

1. **Start of every session:** `git pull` → read §1 status table + the
   **Handoff log** at the bottom → `git status --untracked-files=all` (other
   sessions may have WIP in this checkout — never touch, stage, or commit
   files you didn't create) → baseline `npx tsc --noEmit && npx vitest run`.
2. **Pick work in phase order** unless the user directs otherwise. P1 and P2
   are independent and can swap. P3 builds on the MKS-1 engine seams already
   on this branch (per-move `hitstop`/`chip`/`blockKnockback`) and uses the
   bench as its acceptance tool. P4 data fixes are independent of P3. P5
   after P3.
3. **Re-verify before fixing.** Items tagged **[V]** were verified during the
   audit by direct code reading or a probe sim; **[A]** were reported by an
   audit agent with evidence but not independently re-checked. For both:
   reproduce first (failing vitest for engine/data; a probe or browser repro
   for UI), then fix. Line numbers drift — re-locate by symbol, they're
   marked `~` when approximate.
4. **Branching (D7, 2026-10-06): for now, commit phase work to
   `feat/mks1-rescue-handoff` and open one bigger PR later.** The general
   policy below applies once the user switches back to PR-per-phase.
   `main` is believed to auto-deploy martiankombat.com via a
   Cloudflare dashboard Git build (confirm with the user in P0.5). Work on
   one branch per phase (`fix/p2-player-traps`, `fix/p3-engine-correctness`,
   …), small scoped commits (CLAUDE.md conventions: `engine: …`, `ui: …`,
   `tools: …`), open a PR per phase, and let the user merge. Never push to
   `main` or force-push without an explicit OK.
5. **Every engine behavior change ships with a vitest** (CLAUDE.md rule) and
   must keep determinism (no Math.random / wall clock / Phaser in
   `src/engine/`).
6. **No API spend without approval.** Anything that calls Gemini / OpenAI /
   ElevenLabs / Fish needs a ⛔ D6 go-ahead with an estimated image/call count.
7. **Close out each session:** tick boxes here, append a dated entry to the
   Handoff log (done / next / gotchas). Once P1.1 lands, SPRINTBOARD's backlog
   points at this file — don't duplicate items there.
8. **Verify commands:** `npx tsc --noEmit` · `npx vitest run` ·
   `npm run bench` (MKS-1 audit; `-- --char <id>` per fighter) ·
   `npx vite build --outDir /tmp/mk-dist` (avoids the prebuild hooks that
   rewrite tracked manifests; use `npm run build` when you *want* manifests
   regenerated) · browser via `.claude/launch.json` → `martian-kombat`.
   **Gotcha:** the Claude desktop browser pane throttles to ~2–10 fps while
   hidden, and screenshots go stale. Probe state through `window.__game`
   (dev only), e.g. `__game.scene.getScenes(true).map(s => s.scene.key)`,
   rather than relying on timing or screenshots, or ask the user to show the
   pane.

---

## 1. Status at a glance

| Phase | Theme | Size | State |
|---|---|---|---|
| P0 | Restore raw assets + baseline (old-machine rescue → new machine) | S | ☐ |
| MKS-1 A | Standards foundation: bench lab, ratchet, KFM parity, MUGEN parsers | M | ✅ 2026-10-04 |
| P1 | Truth-in-docs & agent context diet | M | ☐ |
| P2 | Player-facing traps + cheap infra/security fixes | M | ☐ |
| P3 | Fight-core correctness & feel (engine, test-first) | M–L | ☐ |
| P4 | Character data, balance, schema lint | M | ☐ |
| P5 | CPU opponent + difficulty | M | ☐ |
| P6 | Loading, memory, bundle, render perf | L | ☐ |
| P7 | Mobile & link-sharing | M | ☐ |
| P8 | Asset pipeline & tooling hygiene | L | ☐ |
| P9 | Repo weight & history (decision-gated) | M | ☐ |
| P10 | Features & content (arcade mode first) | L | ☐ |
| P11 | 3D mode: freeze (or delete) | S | ☐ |

**After MKS-1 Phase A:** **411/411 vitest** (26 files, ~6s; the ratchet
test measures the roster in ~4s); `tsc` clean; build unchanged in shape.
`npm run bench`: 18 fighters, **14 MKS-1 errors** (in `src/bench/baseline.json`).

**Facts at audit time** (use as the "before" for comparisons):
18 playable fighters (`src/data/roster.ts`), 27 stages
(`src/data/stages.ts`), modes = VS CPU / 2P / Online (WebRTC rollback) /
Training / Demo / Settings + dev-only Character Studio. `tsc` clean;
**379/379 vitest** in ~3s. Prod build: 7s; main chunk **2,017 KB min / 498 KB
gzip** (Phaser ≈1,441 KB), three.js chunk 958 KB (lazy). `dist` = 1,091 files
/ 293 MB (excl. 3D). 18 sprite sheets = **124 MB**. `.git` pack **2.13 GiB**.
Engine: **5.2 µs/tick**, state clone 12 µs, hash 1.6 µs, state ≈1 KB JSON
(rollback has huge headroom). Live site **martiankombat.com** = Cloudflare
Workers Static Assets (`wrangler.jsonc`), serving the HEAD build.
`drmbt.github.io/martian-kombat` still serves a **frozen 2026-07-07** build.

---

## 2. Decision gates — ask the user, don't assume

| ID | Decision | Blocks |
|---|---|---|
| **D1** | The repo is **public** and holds `assets/voice-inspo/` (255 MB of raw voice recordings of real Martians — enough to clone their voices) plus `assets/character-inspo/` photos (76 MB). Keep public, move to the private R2 bucket + `git rm`, or purge from history too? (The game-level privacy opt-out was retired by Vincent 2026-07-08; this is a separate exposure question.) | P9.2, P9.5 |
| **D2** | One-time history rewrite (`git filter-repo`) to cut `.git` from 2.1 GB to ~1.1 GB (or ~0.5 GB with D1/P9.3/P9.4). Rewrites all SHAs, force-push, everyone re-clones. | P9.5 |
| **D3** | **Game or platform?** Is the goal a polished game, or a platform where Martians build and publish their own fighters? This decides whether Character Studio Phases 4–5 (jobs/cost UI, R2 publish, custom-character registry, auth/moderation) get finished or frozen as an internal tool. | P8.15, P10 scope |
| **D4** | Touch controls: none (friendly gate only), simplified (stick + 3–4 buttons, easy specials), or full six-button. | P7.4 |
| **D5** | 3D mode: freeze behind a dev flag (recommended), delete (~4.3k lines + three.js), or ship (needs meshes for the roster + R2 per `feat/3d-mode`). | P11, P9.6 |
| **D6** | Any paid generation (per batch, with an estimated call count). | P4.7, P10.6, any regen |
| **D7** | Confirm the deploy/branch policy: does `main` auto-deploy? PR-per-phase OK? Unpublish GitHub Pages? When does `feat/mks1-rescue-handoff` merge? | P0.5, P2.5 |
| **D8** | **Fight feel vs the reference** (numbers in FIGHTING_STANDARDS §5): raise hitstop toward KFM (ours 4/6/9/10 vs ~8–15; only after P3.5)? make mediums/heavies plus on hit so links exist? make lights/mediums safer on block? walk speed toward 1.2–1.5 CH/s (ours ~1.0, KFM 1.55)? | P4.4, P3.5 follow-up |
| **D9** | Arena width: ours is 3.0 character-heights walkable on a fixed screen, KFM's stage ~6.6. Optional horizontal camera scroll into the 21:9 art's overscan (SF2-style, no zoom; camera zoom was declined earlier). | P10.9 |
| **D10** | Engine quirks the bench found: takeoff friction (forward jump = 0.85 × `jumpSpeedX`) and charge bleed (a charge needs `CHARGE_TICKS` + 8 = 43 ticks). Fix (changes every fighter's feel, re-fit KFM) or keep and document as house feel? | P3.11 |

### Decisions recorded 2026-10-06 (wizard round with the user)

| ID | Decision | Effect on the plan |
|---|---|---|
| D7 | **Stack on `feat/mks1-rescue-handoff`**; one bigger PR later (not PR-per-phase for now). | §0.4: commit phase work to this branch until the user says otherwise. |
| D7b | **Unpublish GitHub Pages**; README → martiankombat.com. | P2.5 unblocked. |
| D5 | **Freeze 3D** (dev-only / `?3d=1`). | P2.1 + P11 as written. |
| D3 | **Platform now** — finish Character Studio phases 4–5 (jobs/cost UI, R2 publish, custom-fighter registry, auth/moderation). | New **P12**; P8.15 = wire, don't delete; P2.7 (dev-server hardening) becomes a prerequisite. |
| D1 | **Move `assets/voice-inspo/` + `assets/character-inspo/` to the private R2 bucket** and `git rm` them (no history rewrite now; D2 later). | P9.2 unblocked. |
| D4 | **Gate card now, simplified touch later.** | P7.2 now; P7.4 = stick + 3–4 buttons, later. |
| D8 | **All four feel changes**, each A/B-playtested before going roster-wide: KFM hitstop (~8/12/12/15, after P3.5), plus-on-hit mediums/heavies (links), safer on block (lights ≈ −2..+1, mediums ≈ −4), walk toward ~1.5 CH/s. | New **P3.12**. |
| D9 (2026-10-06, after the videos) | **SF2 camera ON BY DEFAULT** (fighters always on screen) and **every stage outpainted to ultra-wide 3.5:1**; stages with TALL art outpaint from it and show only its bottom 3.5:1 band until a Marvel vs Capcom-style vertical camera. **Do not write to R2** until the raw-sync logic is updated (see P8.17). | P10.9 E2 done; P8.17 new. |
| D9 (first pass) | Wanted to SEE it first: render a fixed-vs-scroll playtest comparison (stacked video); test automated outpainting for wider stages (D6 approved for 2 stages × ≤ 3 tries); the 1680×1440 "stages tall" set (Marvel vs Capcom-style high-jump WIP) may get side-outpainting later. | P10.9 E2 in progress. |
| D10 | **Adopt MUGEN semantics**: no ground friction on the jump takeoff tick, with each fighter's `jumpSpeedX` rescaled to keep MUGEN-like distances (~1.0 CH); MUGEN charge = hold ≥ **60** ticks, down-back/up-back count (4-way `$`), then forward/up + button within **10** ticks of release. | P3.11 rewritten. |

---

## 3. Guardrails (don't break these while fixing)

- **Determinism:** `src/engine/` pure TS, fixed 60 Hz, no `Math.random`/clock/
  Phaser/DOM/`any`. Verified clean at audit: keep it that way.
- **Netcode:** engine or sim-relevant data changes require both peers to run
  the same build. P3.10 adds a build check to the lobby; until then don't
  deploy engine changes during someone's online session.
- **One packer** (`tools/core/packer.mjs`). Edit overlays in
  `assets/raw/edits/<id>/` must survive any repack. Frame dirs with a
  `.cellspace` marker (vincent/earl/ben) hold KEYED cell-space art: never
  re-key or re-pad them.
- **Never restore `assets/raw/jobs/`** onto a dev machine until P2.8 lands:
  the job runner auto-resumes queued paid jobs at dev-server start.
- **Don't regenerate committed art** without D6. Sheet post-processing (P6.3)
  must be proven pixel-identical where alpha > 0.
- **Lazy-load contract** (CLAUDE.md): any scene that shows a fighter, plays
  VO, or draws a stage must `await AssetLoader.*`. VO is only queued for
  playable-roster ids (a 404'd mp3 throws EncodingError).
- **Dev tooling stays dev-only** (`apply:'serve'` + `import.meta.env.DEV`).
- **MKS-1 ratchet + parity guard** (`src/bench/`): `balance.audit.test.ts`
  fails on a NEW MKS-1 error *and* on a fixed error still listed in
  `src/bench/baseline.json` — after fixing data, run
  `npm run bench -- --update-baseline` in the same commit.
  `parity.test.ts` keeps the committed Kung Fu Man port at 100%: an engine
  change that moves timing/physics semantics fails it by metric name. If
  the change is intended, re-fit (`npm run mugen:fetch && npm run
  mugen:import -- --def assets/raw/mugen/chars/kfm/kfm.def --id kfm --fit`)
  and record the semantic change in FIGHTING_STANDARDS §4/§6.
- **Third-party reference content stays out of git and out of R2:**
  `assets/raw/mugen/` (KFM is CC BY-NC) is re-fetchable with
  `npm run mugen:fetch`; only derived, attributed tables are committed
  (`src/bench/reference/`), and references never enter `ROSTER`.
- **Other sessions' WIP:** never stage or modify files another session
  created unless the user says that work is yours.

---

## P0 — Rescue (old machine) → restore + baseline (new machine)

- [x] **P0.1 Old machine: run `01-OLD-MACHINE-PASSOFF.md`.** Done 2026-10-04 — see `RESCUE_REPORT.md`. Private R2
      mirror of every gitignored asset + snapshot, `tools/raw-sync.mjs`,
      canonical regen anchors committed (§ "Canonical anchors" in that file),
      `RESCUE_REPORT.md`, all pushed to `feat/mks1-rescue-handoff`. The user
      copies `.env` to the new machine privately (never git, never R2).
- [x] **P0.2 New machine: run `03-NEW-MACHINE-RESUME.md`.** Done 2026-10-06: 949/949 restored + verified, 18/18 anchors, jobs not restored. `.env` key
      NAMES check; `brew install rclone`; `npm ci`; `npm run raw:pull`;
      `npm run raw:verify` → 0 mismatches; `assets/raw/jobs/` NOT restored;
      every roster fighter has its anchor. If an anchor is missing, the git
      fallback is `git show 6c39409^:assets/raw/canonical/<id>.png` (16
      fighters + `ko/` variants; **ben, tao, rj were never in git** — the
      old machine is their only source).
- [x] **P0.3 Baseline.** Done 2026-10-06 (numbers in the Handoff log). `tsc`, `vitest` (expect 411+), `npx vite build
      --outDir /tmp/mk-dist`, `npm run bench` (must reproduce
      `docs/FRAME_DATA.md` exactly — the engine is deterministic across
      machines; a diff means a data or environment drift). Record in the
      Handoff log.
- [x] **P0.4 Reconcile in-flight work.** Done 2026-10-04: the MUGEN/IKEMEN
      parity work is MKS-1 Phase A, committed on `feat/mks1-rescue-handoff`
      and folded into this plan (P3, P4, P10.7–P10.9).
- [x] **P0.5 Deploy/branch policy (D7).** Decided 2026-10-06 (stack on this branch; see §2). Confirm how martiankombat.com
      deploys (dashboard Git build on `main`?), whether branch pushes make
      preview builds, the PR-per-phase flow, and when this branch merges.

## P1 — Truth-in-docs & agent context diet

*Why first: the "read SPRINTBOARD before anything" rule makes every agent
session ingest ~250 KB (~60k+ tokens) plus a 24 KB CLAUDE.md, much of it
stale. Fixing that makes every later session cheaper and less misled.*

- [ ] **P1.1 Restructure `SPRINTBOARD.md` (3,570 lines → ≤ ~200).**
      - Move the changelog (≈ lines 1487–3503, 141 KB, 129 entries)
        verbatim to `docs/archive/CHANGELOG-2026-summer.md`.
      - Move completed Sprints 0–27 detail to `docs/archive/SPRINTS-2026-summer.md`.
      - New SPRINTBOARD = (a) ≤30-line TRUE status (§1 facts), (b) "Backlog →
        `docs/handoff/02-PLAN.md`" plus the long-term RFEs
        de-duplicated, (c) a pruned Icebox (drop shipped items: fullscreen,
        rematch, timesync, etc.), (d) handoff notes.
      - New protocol line: *"update backlog checkboxes + handoff notes in the
        same commit; git log is the changelog."* The per-commit changelog
        rule was already being skipped: commits f3ea7da, ab6e7ac, 3dd5d7d,
        890077b, 71671f1 and 0c738ee have no entries.
      - Fix known stale claims while moving:
        - header "Sprint 22 / 13 playable / 19 stages" (`:9-11`);
        - "feat/character-studio 24 ahead, not merged" (`:3509`; it's merged);
        - "16 fighters / other 13" (`:3516`, `:3555`);
        - deploy recipe "GitHub Actions → Pages" (`:3567-3569`; the workflow
          was removed in 0c738ee);
        - "workflow still fires" (`:1591-1593`);
        - Sprints 23/26 "IN PROGRESS" and 27 "PLANNED" (`:808/1083/1230`);
        - "6 · DEV EDITOR" (now 7);
        - "no fighter uses du" (`:962-964`; flo/yulia do);
        - `spriteOffsetY` prose (`:702-715`, deleted);
        - Tao "no stage" (`:1452`) vs institute (`:1603`).
- [ ] **P1.2 Slim + correct `CLAUDE.md` (380 lines/24.5 KB → ~130–150).**
      `AGENTS.md` is a symlink to it.
      - **Fix:**
        - "Sixteen fighters" → 18 (`:276`);
        - "no backoff today" → `withBackoff` exists (`tools/lib.mjs:~120`);
          the real gap is that network errors and middleware direct calls
          aren't wrapped;
        - rollback is "later" (`:29`) → shipped;
        - add online/3D/Cloudflare;
        - directory layout missing `net/ session/ presentation/ render/
          renderer3d/ ui/` (`bench/`, `compat/`, `tools/fg/` were added by
          MKS-1);
        - keep the short MKS-1 section (already a pointer to the doc +
          skills);
        - scene list missing 7 scenes;
        - dangling "see Architecture" (`:19`);
        - "seven steps" vs 8 listed (`:155`);
        - key list missing `FISH_API_KEY`, `CLOUDFLARE_*`, `R2_*`,
          `VITE_ASSET_BASE`;
        - commands missing `studio:run`, `gen:assets`, `gen:worldmap`,
          `gen:busts`, `raw:*`;
        - lazy-load section contradicted by `prefetchAll`: rewrite as the 5
          invariants.
      - **Move out:**
        - pipeline steps 1–8 detail (`:61-183`) → the skills +
          `docs/ASSET_CHECKLIST.md`;
        - editor/Studio sections (`:302-366`) → `docs/CHARACTER_STUDIO.md`;
        - concurrency notes → a tools doc.
      - **Keep:** ground rules, stack, determinism, layout, commands,
        pointers.
- [ ] **P1.3 README.** Link martiankombat.com (not the dead Pages URL); 18
      fighters (generate the table from `roster.ts`); the real modes; remove
      unbuilt claims (Yulia rage meter `:24`, Freeman armor `:19`, "GPT Image
      makes stages" `:11`); stack incl. Cloudflare.
- [ ] **P1.4 Archive obsolete docs → `docs/archive/`.**
      - `CHARACTER_CREATOR.md` + `_WALKTHROUGH` (fold §6 R2, §9 open
        questions, §16 context cache into `CHARACTER_STUDIO.md` first);
      - `SPEC.md` (carry open T41–T46 online items into P10.5);
      - `THREE_D_RENDERER_SPIKE.md`, `WAVE2-VO-CHECKLIST.md`,
        `FATALITY-VIDEO-PROMPTS.md`;
      - `MOVE_DURATIONS.md` (covers 6/18 fighters; reads the JSON, not the
        engine): delete — superseded by the generated, engine-measured
        `docs/FRAME_DATA.md` (`npm run bench -- --md`).
      - `CHARACTER_STUDIO.md`: add a status header (built vs planned), tick
        its boxes, fix "Sixteen".
      - `CHARACTERS.md`: add tao/rj/ben, fix earl to the shipped kit, mark
        haidai dropped.
      - `SPEC.md:14-15,20,44` and `3D_CHARACTER_PIPELINE.md:13` point at the
        deleted `public/assets/meshes`.
- [ ] **P1.5 Purge retired privacy-gate language** (retired 2026-07-08):
      `.claude/skills/new-character/SKILL.md:3` (description; contradicts its
      own `:28`), `docs/ASSET_CHECKLIST.md:35`,
      `docs/CHARACTER_STUDIO.md:162,239,536,619`,
      `docs/CHARACTER_CREATOR.md:174,229`, `SPRINTBOARD.md:845-847`.
      Acceptance: `grep -rn "opt-out" .claude docs CLAUDE.md` → archive-only
      hits.
- [ ] **P1.6 Skills.** (MKS-1 added `fighting-game-standards` and
      `mugen-import`, and bench gates in move-authoring / new-character.)
      - Replace `.agents/skills/` (a stale one-time Codex mirror from 148a19c
        that still names the privacy gate and old `tools/qa/*vfx*` paths)
        with a symlink to `.claude/skills`, like `AGENTS.md` → `CLAUDE.md`.
      - Fix `.claude` drift:
        - new-character says "7-step" + gen-style-test for step 1 (→
          `gen-canonical`), and says to author VO in gen-audio (→ the
          character JSON `vo` block is the source of truth, see P8.6);
        - sprite-generation's "locked" reference chaining (idle-b←idle-a,
          walk-b←walk-a, startup←idle) isn't implemented in CLI `gen-frames`:
          implement in P8 or label studio-only;
        - sprite-qa mentions fal (no fal code exists).
- [ ] **P1.7 `docs/DEPLOY.md`.** Cover:
      - the real deploy path: Workers Static Assets with assets-only
        `wrangler.jsonc`, presumably a dashboard Git build (confirm in P0.5);
      - the `_headers` cache policy and `public/.assetsignore`;
      - the two R2 buckets: PUBLIC `martiankombat-assets` (future CDN/3D) and
        PRIVATE `martiankombat-raw` (gitignored source, `raw:*`);
      - `VITE_ASSET_BASE` (only wired on `feat/3d-mode`);
      - GitHub Pages status (P2.5).

## P2 — Player-facing traps + cheap infra/security fixes (one PR)

- [x] **P2.1 3D trap — HIGH [V].** *Done 2026-10-06: `render3dAllowed()` (DEV or `?3d=1`) gates the chip, L/R and pad L/R; `sanitize` migrates a saved `render3d:true` to 2D (`src/settings.test.ts`); verified in a prod build (saved 3D boots 2D, L/R inert, `?3d=1` still works).* On the title menu, ←/→/A/D
      (`MenuScene.ts:~201`) or the RENDER chip (`:~75-85`) flips to 3D and
      **persists** it (`:~216-217`). In 3D, `SelectScene.pickable()`
      (`:~181`) requires `mesh3d`, which no roster entry has since 0d18a75,
      so **every fighter is locked and no match can start**. The 3D attract
      pool is empty (`MenuScene.ts:~292-297`), and DanceScene runs 45s with
      zero dancers (`:~194`).
      **Fix:** in prod (`!import.meta.env.DEV`) hide the chip, ignore L/R,
      force `render3d=false` on settings load (migrate a persisted `true`),
      and drop Dance/3D from the attract pool. Keep 3D reachable in DEV or via
      `?3d=1`.
      **Accept:** prod build: L/R on the menu changes nothing; a saved
      `render3d:true` boots 2D; attract never starts DanceScene; a unit test
      for the settings migration.
- [x] **P2.2 Cloudflare 404 fallback — HIGH [A, verified live by agent].** *Done 2026-10-06 in `wrangler.jsonc` (`"none"`; no client routes exist). The curl acceptance runs after the next deploy.*
      `wrangler.jsonc` `"not_found_handling": "single-page-application"`
      returns `index.html` with HTTP 200 for any missing `.png`/`.mp3`, and
      `public/_headers` then caches it for 7 days. That brings back the
      EncodingError class the asset manifest was built to prevent. The game
      has no client routes.
      **Fix:** `"none"`.
      **Accept (after deploy):** `curl -sI https://martiankombat.com/assets/nope.png` → 404.
- [ ] **P2.3 Pause menu has no keyboard nav — MED [A].** Only the gamepad
      feeds `pauseMenu.move/confirm` (`fightShell.ts:~186-199`), yet the hint
      says "◄► choose, attack confirms". Add arrows/WASD + attack keys +
      Enter.
      **Accept:** browser — ESC → arrows → Enter works for P1 and P2
      bindings.
- [x] **P2.4 Rematch key = P1 light punch — MED [V].** *Done 2026-10-06: rematch = SPACE (ignored if bound to an attack); SPACE/ENTER/click all wait for `endNavArmedAt`; prompts updated. Verified in a prod build: mashing R through matchEnd does nothing, SPACE rematches.* P1's LP is key R
      (`settings.ts:28`, keyCode 82), and `fightShell.ts:~101,~144` bind
      `keydown-R` to restart. Mashing through a KO restarts the match and
      skips the win screen.
      **Fix:** use a non-attack key (Enter/Start), and gate all end-of-match
      navigation on `endNavArmedAt` (`:~245`).
      **Accept:** mashing R through a KO always shows the win screen.
- [ ] **P2.5 Unpublish stale GitHub Pages ⛔ D7.** It serves the 2026-07-07
      build (8 fighters), and the README links there. Disable it (repo
      Settings → Pages, or `gh api -X DELETE repos/drmbt/martian-kombat/pages`
      after confirmation), or replace it with a redirect page.
- [ ] **P2.6 Remove shipped orphans [A].**
      - **KEEP `public/assets/backgrounds/stages tall/`** — not an orphan: the
        user's 1680×1440 upward-expanded stages for future Marvel vs
        Capcom-style high-jump air fighting (D9). Move it out of
        `public/` (unreferenced, so it ships for nothing) to
        `assets/stages-tall/` and fix the `ai-kitchn` typo — don't delete;
      - `public/assets/backgrounds/stages/_old/` (11 files, 2.3 MB);
      - `public/dev/glb-viewer.html` (live in prod, broken: imports
        `/node_modules`);
      - `public/assets/sprites/vanessa/projectile-little-helper.png` (no
        move references it: confirm);
      - 3D `*.job.json` / `*.report.json` sidecars.
      - Keep `public/assets/vfx/sparks/` (P10.2).
      Then `npm run gen:assets` and run the audit test. The R2 mirror from the
      rescue is the backup.
- [ ] **P2.7 Dev-server hardening — MED security [A].** The `editorApi()`
      plugin in `vite.config.ts` has ~28 POST endpoints with no Origin check,
      and `readJsonBody` accepts `text/plain`. Any web page open while
      `npm run dev` runs can POST to localhost: spend API credits, call
      `delete-character`, write files.
      **Fix in one guard:**
      - reject unless `Host`/`Origin` is localhost/127.0.0.1 on the dev port,
        and require `Content-Type: application/json`;
      - validate every id/name used in a path with `/^[a-z0-9][a-z0-9-]*$/`
        (known gaps: skeleton-regen `c.name` ~L307; creator/write `fat.id`
        ~L1321; export `fat.id` ~L1111);
      - escape names written into `roster.ts`/`stages.ts` (~L138/147; an
        apostrophe breaks the build);
      - confine zip import (`cpSync` ~L1176) to its own fighter id.
      Note: `server.host` is unset (localhost-only); never run `vite --host`
      until this lands.
      **Accept:** curl with a foreign Origin → 403, `text/plain` → 415,
      `../x` id → 400.
- [ ] **P2.8 Job runner auto-resumes paid work — MED cost [V].**
      `tools/core/jobs.mjs:~31` `queueMicrotask(() => this.tick())`, and
      `load()` re-queues `running` jobs. Restarting the dev server (or a
      Ctrl-C'd `studio:run`) silently re-spends, even for another character.
      **Fix:** load interrupted/queued jobs as `paused`, and require an
      explicit, character-scoped resume. Update `src/data/jobs.test.ts`
      (also move it to `tools/` or `src/tools-tests/`, since it tests a tools
      module).
- [ ] **P2.9 `loadEnv` + mock consistency [V/A].** `tools/lib.mjs:~51-53`
      reads `.env` unconditionally at import, so with no `.env` every tool
      and the middleware throw. That breaks `MK_GEN_MOCK` zero-setup and makes
      endpoints 400 instead of mocking.
      **Fix:** tolerate a missing `.env`, let `process.env` win, strip
      quotes.
      `/__editor/gen-frame` ignores `MK_CREATOR_MOCK`, so the
      `martian-kombat-mock` launch config still spends. The direct-call
      endpoints (ElevenLabs sfx/music, Fish) ignore `MK_GEN_MOCK`.
      **Accept:** with no `.env` + mock vars, the creator flow and
      `studio:run --mock` complete with zero network calls.
- [ ] **P2.10 `npm audit fix`** (dev-only postcss/nanoid via vite; no
      majors). Defer vite 8 / vitest 5 / TS 7. **Do not** migrate to Phaser 4.

## P3 — Fight-core correctness & feel (engine; failing test first)

*Builds on MKS-1 (P0.4 done). One commit per fix; failing vitest first.
After each fix: full suite + `npm run bench` (no new MKS-1 errors) + the
KFM parity test. Synthetic fighters for engine tests already exist:
`src/bench/fixtures.ts` (`testChar`, `testMove`) — reuse them for P3.0.*

- [ ] **P3.0 Freeze engine test fixtures.** `src/engine/engine.test.ts`
      (130 tests) reads the LIVE roster JSON ~64×, so a Move Tuner write to
      e.g. `vincent.json` silently changes engine coverage. Move to frozen
      fixture defs (`src/bench/fixtures.ts` `testChar`/`testMove`, or
      `src/engine/__fixtures__/`). Keep one roster smoke test.
- [x] **P3.1 No trades: slot 0 always wins — HIGH [V].** *Done 2026-10-06: `resolveAttacks` detects against the start-of-tick state, then applies; strike beats grab, grab vs grab clashes (`src/engine/trades.test.ts`, fails on the old code).*
      `resolveAttacks` (`step.ts:~981-1000`) loops slot 0 then 1, reading the
      live `f.action`. Slot 0's `applyHit` puts slot 1 into hitstun before
      slot 1 is evaluated, despite the comment "snapshot both attacks first".
      Online, slot 0 = host.
      **Fix:** snapshot both attackers (action, resolved move, active window,
      hitbox rects, invuln) before applying any hit; then apply. Mind
      `pendingThrow`.
      **Test:** Yulia mirror, both LP on the same tick → both take damage.
      (This is the "always trade" baseline; MUGEN-style priority —
      Hit/Miss/Dodge — is P10.7 C5 on top of it.)
- [x] **P3.2 SOCD: L+R walks forward AND blocks — HIGH [V].** *Done 2026-10-06: `cleanSocd` at the top of `step()`; rule in FIGHTING_STANDARDS §4 (`src/engine/socd.test.ts`, fails on the old code: 108 blocking ticks).*
      `holdingForward` is checked before back (`step.ts:~807`), and
      `isBlocking` (`:~854-856`) accepts `walkF` while `holdingBack`.
      Measured: advanced 192px while blocking 6/6 MP.
      **Fix:** clean inside the engine (so online agrees): L+R → neutral;
      U+D → up. Record the rule in FIGHTING_STANDARDS §4 (MKS-1 has no
      SOCD rule yet; IKEMEN resolves L+R to neutral).
      **Test:** hold L+R under MP pressure → no advance, no block.
- [ ] **P3.3 Crouch hurtbox by id prefix — MED [V].**
      `defenderHurtRect` (`step.ts:~847`) uses
      `moveId.startsWith('c')`, so specials like chebel `ceremony`, kirby
      `cartwheel`, yulia `cossack-spiral` and rapha `claw-machine` get the
      crouch hurtbox (~100px short). Crouch-blockstun conversely uses the
      standing box.
      **Fix:** record stance at attack start (`action.crouching`) or an
      explicit MoveDef flag; blockstun keeps the stance.
      **Test:** `ceremony` uses `hurtStand`.
- [ ] **P3.4 Held button auto-repeats normals — MED [V].**
      `pickAttack` (`step.ts:~475`) checks `i[b]` (held). Holding HP fires
      ~6 attacks in 3s.
      **Fix:** edge-triggered (fresh press via the buffer) for normals; make
      sure LP+LK chord throws and mash/charge paths still work.
      **Test:** hold HP 180 ticks → 1 attack.
- [ ] **P3.5 Buffer ages during hitstop — MED [V, both sessions].** The
      buffer timer (8) keeps counting during 9–13 tick hitstop, so a cancel
      pressed in the first frames after a heavy connects is dropped (measured:
      hitstop 9 drops a tick-1 cancel; hitstop 12 drops almost all early
      cancels). IKEMEN's standard: `Input.PauseOnHitPause = 1`.
      **Fix:** freeze buffer aging while in hitstop.
      **Test:** flip the pinned quirk test in `src/bench/framedata.test.ts`
      ("known engine quirks") to expect `cancelled` for both cases.
      **Unblocks:** any hitstop increase (D8).
- [ ] **P3.6 Special priority = JSON key order — MED [A].** (`step.ts:~452`)
      A DP with overshoot (f,d,df,f+P) yields the fireball for vincent,
      chebel, rj, vanessa and ben.
      **Fix:** explicit priority (e.g. 360/mash > dp > hcf/hcb > qcf/qcb >
      charge > du/bf), then strength, then key as a stable tiebreak.
      **Test:** f,d,df,f+P → DP for those 5.
- [ ] **P3.7 Small engine fixes [A].**
      - Stationary blast (`vx=0`) always pushes the victim left (`~:1174`):
        use the attacker's facing.
      - Corner pushback (`~:976`) also shoves a fullscreen projectile
        shooter: melee only.
      - `STRENGTH_BITS['LPLK']` is undefined in fatality input parsing
        (`~:1345-1351`): handle it, plus mash.
      - `hash.ts:~14` `KINDS` is missing `'taunt'`.
      - Dead clamp `buf.length - 18` with a buffer of 15 (`~:209`).
      - The projectile rect is rebuilt inline (`~:1139/1160`): use
        `projRect()`.
      - Remove `types.ts:~278 spriteOffsetY`.
      - Remove the stray `comment` key in `vincent.json` `jhk`.
- [ ] **P3.8 Juggle limit + chain limit (MKS-1 C2).** Today only combo
      scaling (floor 30%) brakes loops, and the bench proves true infinites
      exist (vincent `clp>lk` 15 midscreen / 16+ corner, ben `clk>clp`).
      **Fix:** adopt MUGEN juggle points — a per-victim pool (`airjuggle`,
      15) and an optional per-move `juggle` cost, refilled on landing/reset —
      plus ground **hitstun decay** with combo length so light chains end by
      themselves even with bad data.
      **Accept:** after P4.3 restores Vincent's data, *and* with that data
      unrestored on a scratch copy, the bench reports no `infinite` (the
      engine rule must hold even for broken data). vitests for both.
- [ ] **P3.9 Split `step.ts` (1,550 lines) — pure refactor, after
      P3.1–P3.8.** Modules: input / attack / combat / projectiles / phases.
      Dedupe gravity integration (×5), attack-start construction (×3) and the
      KO pop (×3); fatality parsing should reuse `pickAttack`.
      **Guard:** record final `hashState` of 3 long seeded random-input sims
      before the refactor and assert they're identical after.
- [x] **P3.10 Online compatibility guard.** *Done 2026-10-06: one compat hash = sim-only char data (`NON_SIM_KEYS` ignores quotes/VO/names/vfx) + the stage-arena table (D9) + `simFingerprint` (a scripted 900-tick match through `step()`, so engine changes are caught without a version bump); PROTO 2; `hashState` now covers charge, dash stocks, combo count, buffered press and the input buffer.*
      - Add a build/engine-version field to the lobby hello and refuse
        mismatched peers.
      - `charDataHash` currently includes win quotes/VO/lore text (a typo fix
        breaks cross-version play): hash only sim-relevant fields.
      - `hashState` skips buffer, charge, dash stocks and combo count:
        include them so divergence is caught early.

- [x] **P3.11 MUGEN jump + charge semantics (D10 decided).** Done
      2026-10-06: `JUMP_SPEED_MULT` 1.6 → 1.4 (distances held within
      0.01 CH), `CHARGE_TICKS` 60 + `CHARGE_RELEASE_TICKS` 10, KFM re-fit
      (jumpSpeedX 8.754 → MUGEN's own 7.634), quirk tests flipped, 6 new tests.
      - Jump: no ground friction on the takeoff tick (forward jump vx =
        `jumpSpeedX` exactly); rescale every fighter's `jumpSpeedX` (×0.85,
        measured) so distances stay MUGEN-like (~1.0 CH, KFM 1.03).
      - Charge: MUGEN `~60$B, F, x` — a hold streak of ≥ 60 ticks where
        down-back/up-back count as back (and down-left/right count as down),
        then the opposite direction + button within 10 ticks of release; no
        bleed. `CHARGE_TICKS` → 60.
      - Flip the quirk tests in `src/bench/framedata.test.ts`, re-fit KFM
        (its port's jumpSpeedX compensation disappears), `npm run bench -- --md`,
        update FIGHTING_STANDARDS §4/§6 and the move-authoring skill.
- [ ] **P3.12 Feel pass (D8 decided) — A/B before roster-wide.** After
      P3.5: KFM-like hitstop (~8/12/12/15); mediums/heavies +2..+5 on hit
      (raise `hitstun`); lights ≈ −2..+1 and mediums ≈ −4 on block (raise
      `blockstun` / trim recovery); walk toward ~1.5 CH/s. Do each as a global
      constant or a per-class data transform behind a dev toggle, playtest
      A/B (record clips), then apply, re-bench, re-baseline.

## P4 — Character data, balance, schema lint

*Every item here has a measured acceptance: `npm run bench -- --char <id>`
shows the error gone, then `npm run bench -- --update-baseline` in the same
commit (the ratchet rejects a fixed error that's still listed). Full table of
the 14 errors: FIGHTING_STANDARDS §6.1.*

- [x] **P4.0 Four normals can never hit anyone — HIGH [V, bench].** *Done 2026-10-06: the auto-hitbox reproduced the bad boxes (DWPose missed the extended limb), so the boxes were placed on the active cells' forward-most opaque pixels. Vincent `clk` now connects but measures −9 on block (P4.3).*
      vincent `clk` (reach 22 px, bodies touch at 102), flo `lk` (34 vs 88),
      kirby `cmp` (17 vs 94), tao `chp` (hitbox behind the body, −3).
      Pose-measured boxes from the wrong limb/side. Re-derive from the active
      cell's skeleton (Sprite Editor auto-hitbox), then sanity-check:
      `hitbox.x + w` must exceed the push-box front + opponent hurtbox back.

- [x] **P4.1 Ben & Earl throws do nothing — HIGH [V].** *Done 2026-10-06 (LPLK, 85 damage, knockdown, range per P4.2).* `moves.throw` has
      no `input` and `damage: 0` (`grab.range` 64), so LP+LK just jabs.
      Set `input: {button:'LPLK'}`, damage ≈85, techable, and range per P4.2.
- [x] **P4.2 Grab reach can't connect — HIGH [V, bench].** *Done 2026-10-06: ranges = widest roster gap + ~10 px, written PRE-scale (ranges scale with `scale`); `kit.mjs` `grabFloor` + `src/data/kit.test.ts`. MKS-1 errors 14 → 2 (the P4.3 infinites).* Bodies stop at
      front + front, so a grab shorter than that never reaches. The bench's
      cross-matchup `throw-out-of-range` rule IS the requested test (already
      in CI via the ratchet). Measured: ygor throw 79 (misses even the
      mirror, 88), bodhi Table Work L 77 (mirror 84) and M 89 (misses
      vincent/yulia/catherine/kirby/ben), rapha throw 90 (misses
      vincent/yulia/catherine/ben), vanessa throw 91 (misses vincent 91),
      marzipan Symbiosis L 95 (misses vincent 95), plus earl/ben (P4.1).
      Fix to `range ≥ max separation + 8..10`; add the same rule to
      `tools/core/kit.mjs` so the creator can't produce it.
- [ ] **P4.3 Vincent retune — HIGH balance [V, both sessions].** `lk`
      s1/a12/r5, `clp` s1/a9/r7, `cmk` s1/a12/r9 (measured 2f startup; the
      older docs had `lk` 5/3/10); `lk` chains into itself, so mashing LK
      gives 15–19 hits into a dizzy (others: 3–4); the bench measures the
      `clp>lk` loop at 15 midscreen / 16+ corner. Ben's `clk>clp` is also
      infinite in the corner — shorten it the same way. Throw range 165 with 8 active
      frames (median ≈100). Bring to roster norms (lights s3–4/a2–3, `cmk`
      s6–8, throw ≈100, no self-chain outside the light-chain rule). He was
      the Move-Tuner dogfood fighter, so ask the user whether any of it was
      intentional.
- [ ] **P4.4 Other outliers + MKS-1 warnings sweep [A + bench].** The
      bench lists 84 on-block, 58 on-hit, 46 startup and 43 damage band
      warnings; sweep them per fighter, identity-aware (a grappler may sit at
      band edges on purpose — FIGHTING_STANDARDS §8). Feel-wide changes are
      ⛔ D8. Known outliers:
      - catherine H mise-en-place 188 dmg (3 knives on one tick; fireballs
        60–80): ≈90 total, or stagger the knives.
      - yulia `clp` startup 9 (median 4).
      - catherine fan: check.
      - marzipan gravity 0.62 (~58 ticks airtime vs ~45): ask if intended.
- [ ] **P4.5 Extend the schema lint** (`src/data/assets.audit.test.ts`; today
      it only checks a throw *exists*, `:~172`). Measured rules (throw input /
      damage / reach, never-connects, infinites, band checks) already live in
      the MKS-1 ratchet (`src/bench/`) — don't duplicate them; keep this lint
      for static/asset shape. Add:
      - throw has input + damage > 0 + reach (P4.2);
      - normals startup ≥ 3 and active ≤ ~6 (explicit allow-list for
        intentional exceptions);
      - damage ≤ 2× the roster median per class;
      - no self-chains outside the light chain;
      - every sheet ≤ 4096 px per side (P6.5);
      - `meta.version === 2` for all (P8.8);
      - `<id>-ko.png` ≠ `<id>.png` by hash (P4.7);
      - canonical anchor exists per fighter (P8.1).
- [ ] **P4.6 Load-time validation (DEV).** `src/data/characters/index.ts`
      just casts the JSON. Add a dev-only validator (reuse the lint logic)
      that throws precise messages at boot.
- [ ] **P4.7 Earl's KO portrait is a byte-copy of `earl.png` [V]** (identical
      sha1). Generate the real defeated bust (the `gen-canonical` KO pass, 1
      image, ⛔ D6) and add the lint check.
- [ ] **P4.8** The `cbf` charge motion is built but unused. Note it in the
      move-authoring skill as available. No action otherwise.

## P5 — CPU opponent

*Measured: Vincent spamming fireballs KOs the CPU in 13–17s at every level,
taking 0 damage at medium/high. The bot is a per-tick hash with no state
machine; it crouch-blocks ~18% of the time (a 45% per-tick coin flip on a
0-frame read), walks into projectiles, never anti-airs or punishes, and uses
specials only from >190px, including the throw, which therefore always whiffs.*

- [ ] **P5.1 Difficulty choice in VS CPU.** `FightScene.ts:~320-324`
      hardcodes aggression 1, while `src/ai/difficulty.ts` exists (used only
      by the tuner/demo). Add Easy / Normal / Hard (+ "Martian"?) to select
      or settings, and persist it.
- [ ] **P5.2 Make levels mean skill, not just attack rate** (`bot.ts:~225`;
      at 1.7 the back-off branch can't trigger, `:~280`). Per level:
      - reaction delay (read the opponent's action N ticks late, e.g.
        20/12/6);
      - block probability per decision (not per tick);
      - block or jump projectiles (stop walking into them);
      - anti-air on approaching jumps;
      - punish whiffed/unsafe-on-block moves using frame data — use the
        bench's MEASURED numbers (`measureCharacter` in `src/bench/`, pure
        TS, ~150 ms per fighter: precompute at fight load or at build time),
        never the raw JSON fields;
      - use chains/cancels;
      - throw only in range.
- [ ] **P5.3 Test `decide()`** (the 71 bot tests only cover the motion-input
      loop driver). Add sim tests:
      - fireball spam vs Normal for 30s → CPU blocks ≥ X% and takes < Y%;
      - Hard anti-airs ≥ Z% of jump-ins;
      - same seed → same decisions.
      The CPU never runs online, but keep it tick-hash deterministic for
      replays.

## P6 — Loading, memory, bundle, render perf

- [ ] **P6.1 AssetLoader can hang for the session — HIGH [V, code].**
      `ensure()` (`src/scenes/assetLoader.ts:~57-77`) resolves on the
      CALLING scene's `load.once(COMPLETE)`. Phaser's `LoaderPlugin.shutdown`
      removes all listeners, so if Select stops mid-download (highlight a
      fighter or pick a stage, then reach Versus before the ~7 MB sheet
      lands), the promise never settles and stays in `inflight` forever.
      Every later Versus with that fighter waits the 12s cap (971f4e2
      band-aid) for the rest of the session, and each dead key stalls
      prefetch by 20s.
      **Fix:**
      - run all AssetLoader loads on ONE persistent scene's loader (the
        always-running Volume overlay, or a dedicated hidden Loader scene);
      - resolve per file and handle `LOAD_ERROR`;
      - route `FightScene.preload` through the dedupe (it bypasses it today
        and can double-download);
      - then remove the 12s cap.
      **Accept:** browser repro (highlight → immediate lock → Versus,
      repeated) never waits; one load per key in the `[MK assets]` log.
- [ ] **P6.2 `prefetchAll` decodes everything — HIGH mobile [A].**
      (`assetLoader.ts:~110`, kicked off by `VolumeOverlayScene.ts:~135`.)
      From the menu it downloads every stage/sheet/VO/fatality (~165 MB
      first visit) and decodes all 18 sheets as textures, ≈**523 MB RGBA**
      (2304×3072×4 B each) — a tab-crash risk on phones and iPads. Each
      sheet that lands mid-fight is a synchronous ~30 MB texture upload, so
      expect hitches.
      **Fix:**
      - warm the HTTP cache only (`fetch(url, {priority:'low'})`) and decode
        on demand (select highlight / versus);
      - pause prefetch while a fight is active; concurrency ≤ 2;
      - skip or shrink on `navigator.connection?.saveData` and coarse
        pointers (P7).
      **Accept:** after 2 min on the menu, `__game.textures` holds ≤ 2
      fighter sheets; no frame spikes in a fight.
- [ ] **P6.3 Zero RGB under alpha=0 in sheets — HIGH value [A, measured on
      copies].** The packer leaves chroma-key garbage under transparent
      pixels. Measured: freeman 8.79 → 3.98 MB; all 18 sheets 124 → **68 MB
      (−45%)** as plain PNG, lossless, no runtime change.
      **Fix:** a post-pack step in `tools/core/packer.mjs` plus a one-time
      `tools/clean-alpha.mjs` over the committed sheets. It must assert alpha
      is identical and RGB is identical wherever A > 0.
- [ ] **P6.4 WebP (after P6.3).** Lossless 48 MB (−61%), q90 16.7 MB (−87%).
      Phaser loads webp and Safari 14+ is fine. Decide lossless vs q90 by eye
      on 3 fighters. Also portraits 4.2 → 0.7 MB, fatalities 13.6 → 9.3 MB,
      stages 6.6 → 4.7 MB. Packer + asset queue + manifest emit/consume
      `.webp`.
- [ ] **P6.5 Ben's sheet is 1728×4224 [A]**, over the 4096 max texture on
      some GPUs. Re-grid ≤ 4096/side (`gridFor` in `tools/core/cells.mjs`),
      re-meta, and add a lint check.
- [ ] **P6.6 Cache-busting.** Media URLs aren't hashed (7-day cache) while
      frame data ships in hashed immutable JS, so after a repack a returning
      player runs new frame data against an old sheet. Emit `?v=<sha8>` per
      file from `tools/gen-asset-manifest.mjs` → `assetManifest.json`, use it
      in `assetQueue`/`BootScene`, then mark media `immutable` in
      `public/_headers`.
- [ ] **P6.7 Dev code ships to players [V].** About 213 KB of the main chunk
      is dev-only:
      - `CharacterCreatorPanel` 115 KB, `creatorModel` 25, `SpriteEditorPanel`
        23, `MoveTunerPanel` 11, the editor scenes, and
        `tools/core/{prompts,cells,kit}.mjs`;
      - plus 31 `/__editor/*` strings and the generation prompts.
      **Cause:** static imports at `FightScene.ts:28-33` and
      `main.ts:14-17`; the DEV spread at `main.ts:76` only skips
      registration.
      **Fix:**
      - `if (import.meta.env.DEV) await import(...)` for editor scenes and
        panels;
      - extract the ~520 lines of studio/tuner/sprite-editor code from
        `FightScene` into a dynamically loaded `src/studio/StudioController.ts`;
      - move the hard-coded per-move projectile render tables
        (`FightScene.ts:~61-87`) into the character JSON.
      **Accept:** `grep -c __editor dist/assets/*.js` → 0; main chunk
      −~200 KB.
- [ ] **P6.8 Prod debug surface.** `window.__game`, `__mkAssets`, `__r3d`
      and the `[MK assets]` console spam → DEV or `?debug=1` only.
- [ ] **P6.9 Shadow bake hitch.** `ensureShadowTexture`
      (`FightScene.ts:~1022`) does readback + canvas blur + upload the first
      time each cell appears, a spike on every new move. Pre-bake per fighter
      during Versus, or at pack time.
- [ ] **P6.10 Small.**
      - `AssetLoader.ready` is unused.
      - `SPRITE_FOOT_OFFSET_Y` (0) is vestigial.
      - `renderer3d/warmup.ts` is imported both statically and dynamically
        (build warning).
      - The 2D in-fight hint hard-codes default keys and mislabels F3
        (`FightScene.ts:~579`).
      - `FightScene.ts:~299,301` read `this.online` before it's assigned
        (`:~307`).
      - The fight-flag set is hand-copied in ~7 places (VersusScene,
        fightShell restart/select, SelectScene ESC/pad back `:~816`): make
        one `FightFlags` type + a copy helper.
- [ ] **P6.11 Initial load UX.** Black screen while the ~500 KB gz bundle
      downloads, and attract shows black while loading. Add an inline
      HTML/CSS loader in `index.html` that Phaser removes on boot.
- [ ] **P6.12 (optional) Music → 128 kbps MP3:** 97 → ~68 MB. Skip Opus
      (Safari support is uneven).

## P7 — Mobile & link-sharing

*People will mostly meet this game as a link opened on a phone. Today a phone
can tap through the menus into a fight with zero controls, and the prefetch
can exhaust its memory.*

- [ ] **P7.1 OpenGraph/Twitter meta** + a 1200×630 share image (from the
      title art), a description and `theme-color` in `index.html`. Links in
      Discord/iMessage currently preview as nothing.
- [ ] **P7.2 Touch gate.** On `(pointer: coarse)` with no gamepad, show a
      card: "Plays with a keyboard or controller (Bluetooth pads work on
      phones)" with [Watch a demo fight] and [Continue anyway].
- [ ] **P7.3 Mobile memory budget** (depends on P6.2/P6.4/P6.5): verify on a
      real iPhone/iPad or with Safari Web Inspector.
- [ ] **P7.4 ⛔ D4 touch controls.** Scope with the user before building.
      Touch controls were removed 2026-07-02.

## P8 — Asset pipeline & tooling hygiene

- [ ] **P8.1 Regen anchors are committed** (by the rescue). Add the lint
      check from P4.5: every playable fighter has a canonical anchor.
- [ ] **P8.2 `gen-frames` hides failures [V].** (`tools/gen-frames.mjs:~89-91`
      logs and exits 0, so the pipeline marks frames done.) Exit non-zero
      with a failure summary.
- [ ] **P8.3 `studio:run --force` breaks busts [A].**
      `tools/core/pipeline.mjs:~43` appends `--force` to every step;
      `portrait_crop.py` rejects it, so busts fail and the manifest step is
      skipped. Forward `--force` only to steps that accept it.
- [ ] **P8.4 `gen-canonical` clobbers icons [A].** Its crop pass
      (`gen-canonical.mjs:~117-128`) writes `portraits/<id>.png`, which
      `gen-icons` owns. Restrict it to `-bust`/`-ko`.
- [ ] **P8.5 Skip checks look at gitignored intermediates [A].**
      (`gen-stage.mjs:~101`, `gen-icons.mjs:~51`, the gen-canonical KO pass,
      `gen-worldmap`.) On a fresh clone they re-spend on assets already
      committed in `public/`. Check the shipped output; regenerate only with
      `--force`.
- [ ] **P8.6 One generation file per fighter — kill the 8-table drift [A].**
      Per-fighter generation data is spread over:
      - `frames-manifest.mjs` CHARACTERS (1,930 lines; earl/ben missing, so
        `gen:frames`/`gen:pack`/`gen:key`/`studio:run` fail for them);
      - `gen-canonical` FLAVOR/FACE/REUSE;
      - `gen-fatality` FATALITIES (gene/marzipan prompts missing; no
        sidecars);
      - `gen-audio` voiceLines (**drifted from the JSON `vo` blocks in 12
        places**: vincent, chebel, freeman, gene, rj. `gen:audio --char
        vincent --force` would regenerate OLD lines);
      - `gen-icons` ROSTER (still the launch 8) / TWEAKS;
      - `gen-stage` SCENES;
      - `gen-vfx` PER_MOVE;
      - `core/vo-emotion` TEMPERAMENT.
      **Target:** `tools/fighters/<id>.gen.json`. NOT under `src/`:
      `characters/index.ts` bundles `src/data` JSON, which would ship ~137 KB
      of prompts. VO text is read from the character JSON `vo` block (the
      single source of truth).
      **Steps:** (a) gen-audio reads the JSON `vo` (fixes the drift; add a
      test), (b) fatality, (c) canonical/icons, (d) the frames split + add
      earl/ben.
      **Accept:** no per-fighter tables left in `tools/*.mjs`.
- [ ] **P8.7 `.cellspace` dirs receive raw frames [A, likely].** `gen-frames`
      and `/__editor/gen-frame` (`vite.config.ts:~360-371`) write raw green
      frames into vincent/earl/ben's prekeyed dirs, and the packer copies
      them through un-keyed. Key on write, or write raw to a sibling dir.
- [ ] **P8.8 Meta v2 fields lost [A].** `/__editor/sheet` (a
      browser-composited sheet + meta) dropped
      `version/floorFrac/headroom/normalized` from ben, bodhi and catherine's
      `meta.json`. Fix the writer to merge v2 fields, restore those three,
      and lint it (P4.5).
- [ ] **P8.9 "One packer" in fact.** `/__editor/sheet` bypasses
      `packCharacter`, and `/__editor/pack` + normalize doesn't re-infer
      skeletons the way CLI `--normalize` does. Converge: the sheet endpoint
      writes overlays, then calls `packCharacter`.
- [ ] **P8.10** The packer's scratch dir is inside the tracked frames dir
      (`packer.mjs:~47`) and left behind on a crash. Use `os.tmpdir()` +
      `finally` cleanup.
- [ ] **P8.11 Prune [A, grep-verified no refs].**
      - **Delete:**
        - `tools/migrate-{floor,hitboxes,vo}.mjs` (done; git keeps
          history);
        - `tools/gen-style-test.mjs` (Sprint-2 experiment; stage style
          contradicts the lock; the only `OPENAI_API_KEY` user);
        - `assets/raw/frames/yulia-legacy-23cell/` (12 MB, unreferenced; R2
          has it);
        - the `tools/voices.json` "pseudo" entry;
        - `FAL_KEY` from `.env.example` (no code);
        - `CharacterCreatorScene` (registered, never started), plus
          `CharacterCreatorPanel`'s probably-dead `renderStub` (`:~1661`)
          and its stale "D3–D7 are stubs" header (`:2-4`).
      - **Move:** the 3D trio (`gen-mesh.mjs`, `mesh-manifest.mjs`,
        `blender_fbx_to_glb.py`; inputs deleted in 0d18a75; hard-coded
        Blender path `gen-mesh.mjs:~21`) → `feat/3d-mode` or `tools/archive/`,
        and drop the `gen:mesh` script.
      - **Rewrite:** `tools/style.md` (stage style contradicts the locked
        pixel-art look; frame rules differ from `core/prompts`), or archive
        it.
      - **Decide:** `StagePinEditorScene` is still reachable (EditorMenu +
        studio STAGES): finish folding it in or accept it.
- [ ] **P8.12** Add `gen:canonical` and `gen:icons` npm scripts (documented
      but missing). Document `MK_PYTHON`, `MK_GEN_MOCK`, `MK_CREATOR_MOCK`
      and `GEMINI_TEXT_MODEL` in `.env.example`. Fix the `URL.pathname`
      paths-with-spaces bug in the two manifest scripts.
- [ ] **P8.13 Split `vite.config.ts` (1,348 lines) → `tools/dev-server/`**
      (after P2.7):
      - a route table + shared helpers for the mock gate (×9), reference-
        image scratch writes (×3) and body parsing;
      - async exec instead of `execFileSync` (ffmpeg/python/zip currently
        freeze the dev server);
      - a JSON roster/stage registry + `import.meta.glob` instead of
        regex-editing `roster.ts`/`stages.ts`/`characters/index.ts` (the
        index insert anchors on `import vanessa`).
- [ ] **P8.14 Cost levers (next time you generate).**
      - Changed-prompt-only regen: compare against the `.prompt.txt`
        sidecar.
      - Gemini Batch API (~50% off) for the ~45 independent cells.
      - Upload the canonical once instead of base64 on ~60 calls.
      - `withBackoff` on network errors and on the middleware's direct calls.
      - One model-id constant (`'gemini-3-pro-image'` is hard-coded 12×).
      - Baseline ≈ 65–70 images per fighter, ~$9 at list price (verify
        current pricing).
- [ ] **P8.15 (D3 = platform now)** Endpoints with zero callers:
      `/__editor/jobs`, `/jobs/stream`, `/__editor/pack` — WIRE them (Studio
      Phase 4 jobs/cost UI, see P12), don't delete.
- [ ] **P8.16** `corridorkey.mjs` clones an unpinned third-party HEAD. Pin
      the commit recorded in RESCUE_REPORT (`97e55a4` — also what the new
      machine's sibling clone is on, set up 2026-10-06).
- [ ] **P8.17 Make `raw:push` no-clobber before the next push (⛔ user:
      "not ready to test yet").** Today `rclone copy --checksum` REPLACES any
      R2 object whose local copy changed, so one push from a machine with a
      stale/edited file overwrites the good version in `martiankombat-raw`
      (only the 2026-10 snapshot would survive). Add `--ignore-existing` by
      default + an explicit `--overwrite` (or versioned keys), a dry-run
      preview, and a test; then push the local-only raw sets that exist only
      on the new machine: `assets/raw/stages-wide/` (outpaint tries + prompt
      sidecars), `assets/raw/playtest/`, `assets/raw/keyed/kirby/`. Until
      then: **no `raw:push`, no R2 writes of any kind.**

## P9 — Repo weight & history (all ⛔; the R2 mirror is the backup)

- [ ] **P9.1 Delete merged/stale remote branches ⛔:** `feat/character-studio`
      (0 ahead), `flo-char` (0), `spike/3d-renderer` (0), `marzi-char` (2
      superseded draft commits). **Keep `feat/3d-mode`** (R2 GLB seam +
      `docs/3D_MODE_R2.md`).
- [ ] **P9.2 (D1 decided: move to private R2 + `git rm`, no history
      rewrite yet)** voice-inspo / photos exposure (see §2). `raw-sync` must
      learn to pull these paths (they become ignored once removed).
      `assets/general-inspo/vanessa.wav` is an exact 16 MB duplicate of the
      voice-inspo copy, and `stage-inspo/DOME/Untitled` duplicates
      `Untitled2.png`.
- [ ] **P9.3** Root demo mp4s (23.7 MB: `gameplay-demo`, `juice-vfx-demo`,
      `moves-*`) → the public R2 bucket or YouTube; `git rm`; fix links.
- [ ] **P9.4** `assets/raw/frames` (510 MB tracked; genuinely source):
      keep, move to Git LFS, or switch to private R2 + manifest
      (`raw-sync` already supports it). Every Cloudflare deploy clones the
      repo.
- [ ] **P9.5 ⛔ D2** `git filter-repo`: drop deleted paths
      (`public/assets/meshes` + `animations` FBX/zip ≈278 MB, old
      `assets/raw/*` dirs ≈140 MB) and superseded `sheet.png` blobs (406 MB
      from ~40 repacks). 2.1 → ~1.1 GB, or ~0.5 GB with P9.2–P9.4. Only
      after `raw:verify` passes; coordinate the force-push and re-clones.
- [ ] **P9.6 ⛔ D5** The 3D GLBs (`public/assets/3d`, ~105 MB, excluded
      from deploy by `.assetsignore`) → R2 per `docs/3D_MODE_R2.md`
      (`feat/3d-mode`); `git rm`.

## P10 — Features & content (after P2–P6)

- [ ] **P10.1 Arcade mode — the headline feature. Spec first
      (`docs/ARCADE.md`), user review, then build.**
      - **Already in place:**
        - every fighter's JSON has `arcade.{motivation, ending}`;
        - home stages and map pins exist (`src/data/stage-pins.json`);
        - RJ (Sagat analog) and Tao (end boss, Bison analog) are built,
          with 1020/1050 HP.
      - **Needs:**
        - a ladder through the Mars College world into Bombay Beach;
        - a difficulty ramp (P5);
        - map travel between fights;
        - intro and ending screens;
        - boss treatment for RJ/Tao (AI aggression, maybe armor/no-chip);
        - continue, credits, and the "Champion of the Bombay Beach
          Biennale" ending.
      - **Design calls:** unlock Tao/RJ on clear, or leave them playable as
        now? Difficulty select at arcade start?
- [ ] **P10.2 Wire the hit-spark library.** `public/assets/vfx/sparks/` (15
      strips + `sparks.json`) is generated but nothing in `src/` reads it.
      Follow the `hit-spark-generator` skill's playback-variety spec (tinted
      per attacker), hooked into FightScene `presentTick`.
- [ ] **P10.3 Stage music for 10 stages** (fall back to default today):
      ai-kitchen, dojo, dome (empty folder), escapes, hyperion, last-resort,
      mimos, museum, star-beach, tvs. The user makes the tracks in Suno →
      `public/assets/audio/music/stages/<id>/` → `npm run gen:music`.
- [ ] **P10.4 Flow polish.**
      - Remember the last picks after a match (today it resets to
        Vincent/Yulia).
      - Make the ~13s post-match sequence skippable or shorter.
      - "Random opponent" in VS CPU.
      - 3D never plays "ROUND ONE" (2D only, `FightScene.ts:~634`), and the
        2D/3D banner strings have drifted (2D has no PERFECT). If 3D stays
        frozen, ignore; else unify on the DOM `FightHud`/`AnnouncerBanner`/
        `FatalityOverlay` components.
      - Tao's home stage (needs Biennale reference photos).
- [ ] **P10.5 Online hardening (only if going public).**
      - Inputs on an unreliable/unordered DataChannel
        (`ordered:false, maxRetransmits:0`; today reliable/ordered at
        `src/net/webrtc.ts:~124`, which wastes the 8-frame redundancy).
      - Self-host the PeerJS broker (today public `0.peerjs.com`) and use a
        paid TURN (today shared community creds).
      - Finish rejoin (the `'resync'` message `transport.ts:~20` +
        `PeerLink.onReconnect` are half-built).
      - Network-status UI.
      - Desync recovery instead of a hard halt.
      - The stale "lockstep" comment at `webrtc.ts:~60`.
      - SPEC T41–T46 leftovers.
- [ ] **P10.6 ⛔ D6 content regen backlog:** marzipan frames, bodhi active
      cells, RJ v2's 4 flagged cells (`SPRINTBOARD.md:~1631-1636`), a
      roster-wide CorridorKey re-key (`docs/CORRIDORKEY.md`), and the 16
      inspo'd-but-unbuilt Martians (haidai, jack, jordan, neil, dulcinee,
      puddles, …).
- [ ] **P10.7 Combat parity primitives (MKS-1 Phase C; each ships with a
      vitest + bench/parity run).** Ordered by feel-per-effort:
      - **C3 per-phase hurtboxes** derived from the baked DWPose skeletons
        (MUGEN Clsn2 parity: whiff punishes, low profiles, extended limbs) —
        the biggest feel lever; no new art needed;
      - C4 multiple / per-phase hitboxes (Clsn1 parity: multi-hit sweeps,
        two-part moves; KFM's palm/upper are ported as first hit today);
      - C5 priority & trade rules (MUGEN Hit/Miss/Dodge) on top of P3.1;
      - C6 attack attributes + invuln classes (strike / throw / projectile
        as data; generalizes `projImmune`; includes throw protection after
        stun);
      - C7 power meter + supers + superpause (MUGEN 3000 / 1000-per-level,
        IKEMEN life-to-power 0.7 / 0.6) — the "super bar" RFE; unlocks EX
        moves and ported supers;
      - C8 `ff` and double-quarter motions; per-character run vs dash;
      - C9 air recovery / tech;
      - C10 optional IKEMEN systems: guard points, just-defend; rage meter
        (README promises one for Yulia);
      - new archetypes from the old list: tilts, air specials, wall-kick,
        rekka, armor, air throws.
- [ ] **P10.8 Content import (MKS-1 Phase D)** — play a community fighter
      side by side with ours:
      - D1 SFF v2/v1 sprite decoder (port IKEMEN `image.go`, MIT;
        `parseSff` already reads the directory);
      - D2 action-map packer (FIGHTING_STANDARDS §7) → a dev-only,
        gitignored KFM sheet so the port is playable in training;
      - D3 MUGEN stage import (DEF + BG layers → 21:9 composite, floor from
        `zoffset`, arena from camera bounds; `parseStageDef` exists);
      - D4 export a Martian fighter as MUGEN/IKEMEN DEF/CNS/AIR/CMD (run our
        cast inside IKEMEN — the reverse parity test);
      - D5 more references (licence-checked; the importer is generic).
- [ ] **P10.9 Tooling & feel (MKS-1 Phase E).** *E2 DONE 2026-10-06 (D9):
      the SF2 scrolling camera is on by default for every real fight
      (FightScene: `stageArena()` → `MatchRules.camera`; HUD screen-pinned on
      `gfxScreen`; editors keep the fixed screen); all stages outpainted to
      3.5:1 (`public/assets/backgrounds/stages-wide/`, tall sources shown by
      their bottom band). Earlier progress notes:* the engine camera exists (`MatchRules.camera`, `cameraX`,
      `arenaBounds`; default off; 5 tests); `npm run playtest:video`
      renders fixed-vs-scroll comparisons (sent: chiba-roof, drive-in);
      `npm run gen:outpaint` widens stages — the two-pass `sides` mode is
      seamless on normal 21:9 AND the 1680×1440 tall art (try1/try2 in
      `assets/raw/stages-wide/`), the one-pass `pillar` mode is not (seams,
      ghost duplicates). **Next for E2:** user verdict on the videos → wire
      the camera into FightScene behind a setting (HUD scroll-factor 0,
      background as a world object), then outpaint the remaining stages
      (⛔ D6: ~2 calls per stage).
      - E1 training: SF6-style frame meter, input display, dummy
        record/playback; show bench numbers live in the Studio MOVES module;
      - E2 ⛔ D9 optional camera scroll into the 21:9 overscan;
      - E3 alternate palettes (hue-shift shader) for mirror matches;
      - E4 CPU-vs-CPU matchup matrix (deterministic seeds) for win rates.

## P12 — Platform: Character Studio phases 4–5 (D3 = platform now)

*Prerequisites: P2.7 (dev-server hardening) and P2.8 (paused job resume) —
anything that lets Martians build fighters must not spend money or write
files unasked. Full design: `docs/CHARACTER_STUDIO.md` Phases 4–5 (+ the R2
§6 / open questions §9 being folded in by P1.4).*

- [ ] **P12.1 Jobs + cost UI** — wire `/__editor/jobs` + `/jobs/stream`
      into the Studio: queued/running/paused jobs, per-job and per-fighter
      cost estimates (P8.14 pricing), explicit character-scoped resume.
- [ ] **P12.2 Auto-pilot run** — `studio:run` DAG from the UI, with the
      MKS-1 bench as a ship gate (zero errors before SHIP).
- [ ] **P12.3 Publish to R2** — a publish path for player-made fighters
      (the PUBLIC bucket `martiankombat-assets`, or a new one), a
      custom-fighter registry the game loads at runtime (not `roster.ts`),
      and the `StorageDriver` seam from the Studio plan.
- [ ] **P12.4 Accounts, auth, moderation** — who may publish, review queue,
      takedown; scope with the user before building.
- [ ] **P12.5 Retire `CharacterCreatorScene`** (registered, never started).

## P11 — 3D mode (⛔ D5)

- [ ] Recommended: **freeze.** P2.1 already gates it in prod. Keep
      `src/renderer3d` + the engine/renderer seam (zero cost). No maintenance
      until there are meshes for the roster and R2 hosting
      (`feat/3d-mode`). Its known issues, if it's ever revived:
      - warmup replaces itself without disposing (leaks a WebGPU device +
        GLBs, `warmup.ts:~66`);
      - `FightScene3D.ts:~415` LOADING forever on boot failure;
      - AO + bloom + 2048 soft shadows at 2× DPR every match (heavy);
      - the HUD/banner/fatality are duplicated vs 2D.
      If D5 = delete: remove `src/renderer3d` (~3.4k lines), the 3D
      scene/UI (~0.9k), DanceScene, the `three` dependency, and the `RENDER`
      settings.

---

## Appendix A — Already in place (don't rebuild)

- Per-strength hitstop, counterhits, an 8-tick input buffer, chains and
  cancels, combo scaling, landing recovery, dash stocks, ground bounce,
  SF2-style throw toss with a 12-tick tech window, dizzy, no chip KOs, KO
  slow-mo.
- True GGPO-style rollback: input delay 2, repeat-last prediction, window 10,
  `structuredClone` snapshots, a hash check every 60 ticks, timesync, and
  `charDataHash` pinning.
- Phaser listeners are cleaned up on shutdown; the DOM HUD writes only on
  change; per-frame allocations are small.
- `withBackoff` (429/5xx) on provider helpers; `MK_GEN_MOCK` mock mode; the
  jobs runner with DAG/persistence; `studio:run`.
- The audit test (`assets.audit.test.ts`): asset completeness, orphan sweep,
  meta shape, kit-grammar lint.
- **MKS-1 (2026-10-04):** `src/bench/` engine-measured frame data (startup,
  advantage, pushback, physics), verified best-combo finder + infinite
  verifier, bands + hard rules + CI ratchet (`npm run bench`,
  `docs/FRAME_DATA.md`); `src/compat/mugen/` DEF/CNS/CMD/AIR/SFF/stage
  parsers + porter (`npm run mugen:fetch`, `mugen:import --fit`); Kung Fu
  Man (+ HD `kfm720`) at 100% parity guarded by `parity.test.ts`; optional
  per-move `hitstop` ([attacker, victim]), `chip`, `blockKnockback`.

## Appendix B — Measurement recipes

- **Engine cost:** a throwaway vitest that steps `initialState('vincent',
  'yulia', characters)` for 60k ticks with LCG-random inputs; time `step`,
  `structuredClone(state)` and `hashState`. Delete the file afterwards.
- **Bundle attribution:** `npx vite build --outDir /tmp/mk-dist --sourcemap`,
  then sum the source-map segment lengths per source path (or use
  `source-map-explorer`). Use `npx`; don't add the dependency.
- **Sheet savings:** on COPIES only, zero RGB where A=0 (python/numpy in the
  QA env, or ffmpeg `geq`) and compare sizes; `cwebp -lossless` / `-q 90`.

---

## Handoff log

*(newest first; one entry per session: date · who · done · next · gotchas)*

- **2026-10-06 · pre-ship bug-fix pass (Claude Opus 5.5).** Done: P2.1,
  P2.2, P2.4, P3.1, P3.2, P3.10, P4.0, P4.1, P4.2 (details on each item).
  445/445 tests (34 files), tsc clean, MKS-1 errors 14 → 2, prod build main
  chunk 499.5 KB gz (unchanged). Browser-verified in a `vite preview` prod
  build: saved 3D boots 2D and L/R is inert, `?3d=1` still reaches 3D,
  mashing R through match end no longer restarts, SPACE rematches, a fight
  loads `bg-stage-wide-dojo` with the camera on.
  **Next:** open the one big PR for this branch (D7) once the user OKs it;
  P2.2's curl check after that deploy; then P4.3 (Vincent/Ben infinites) or
  P3.12 feel pass.
  **Gotchas:** with the browser pane hidden there are NO animation frames at
  all — drive Phaser by hand: `__game.step(t, 16.7)` in a loop (see this
  entry's session). Character grab ranges / hitboxes in JSON are PRE-`scale`
  (the bench reports baked values: ben 64 → 76). PROTO is 2 now: an old tab
  can't join a new one (by design).

- **2026-10-06 · D9 finished: camera on + 27/27 wide stages (Claude Opus 5.5).**
  SF2 scrolling camera on by default (`318d8ec`); every registered stage has
  3.5:1 art in `public/assets/backgrounds/stages-wide/` (tall sources show
  their bottom band), enforced by the new wide-art audit. 432/432 tests, tsc
  clean. ~76 image calls for all of D9 (incl. the first test round).
  **Next:** P8.17 (make `raw:push` no-clobber) BEFORE any R2 push — the
  wide-stage raws (`assets/raw/stages-wide/`, ~27 dirs of passes + prompt
  sidecars) are local-only until then; then P1.
  **Gotchas:** shipped files before the colour-map change (21 stages +
  mimos/painted-canyon/shipwreck) were composited with the older
  mean-offset method — re-running their `--try N` re-composites
  `tryN-sides.wide.jpg` with the new method (the raw passes are reused), so
  REVIEW before re-shipping. No pixel metric predicts the real rejects
  (cloned props, redrawn edges): `reviewFlag` only says the model regraded
  the frame; visual review of the band is the gate. Re-run
  `gen-asset-manifest.mjs` after any `--ship` (the dev server only scans at
  start). A hidden browser pane pauses Phaser's RAF loop — in-game checks
  need the pane visible.

- **2026-10-06 · decisions round + D9/D10 work (Claude Opus 5.5).**
  Recorded D1–D10 (§2 "Decisions recorded"). Set up **CorridorKey** on this
  machine: sibling clone `../CorridorKey` at `97e55a4` (= the old machine
  and upstream HEAD), uv env with the MLX extra, MLX weights (SHA-256 OK);
  `.env` `CORRIDORKEY_DIR` repointed to the sibling (it held an old-machine
  path); end-to-end proof: `gen:key --char kirby` keyed all 64 frames in
  ~5:44 (~5.4 s/frame, M5 Max) → `assets/raw/keyed/kirby/` (not repacked).
  **D10 / P3.11 done** (MUGEN jump + charge). **D9:** engine camera,
  outpaint tool + test (8 image calls: chiba-roof 2 tries, drive-in 1),
  comparison videos (`assets/raw/playtest/`). Bench now charges cbf moves
  as down-back (no walk-back), so charge projectiles measure at true point
  blank. 425/425 tests, 14 MKS-1 errors (unchanged).
  **Next:** user verdict on the scroll videos + outpaint quality; then P1.
  **Gotchas:** this ffmpeg build has no `drawtext` (the video tool draws
  its own bitmap font); vite-node can't run scripts outside the repo.

- **2026-10-06 · new machine, resume Step 1 (Claude Opus 5.5).** P0.2 +
  P0.3 done on `feat/mks1-rescue-handoff` (`73b84cf`). `.env` key names
  match RESCUE_REPORT §6 (13 expected keys set, plus `VITE_ASSET_BASE`;
  `GEMINI_TEXT_MODEL`/`MK_PYTHON` absent = code defaults). Installed rclone
  1.75.1 → `npm ci` → `raw:pull`: 949 files / 706 MB in ~50 s,
  `verify` 949 OK / 0 missing / 0 mismatched; `assets/raw/jobs/` empty;
  18/18 roster anchors present. Baseline: `tsc` clean, **419/419 vitest**
  (27 files), `vite build` main chunk 2,016.90 KB / 497.75 KB gz (= audit),
  `npm run bench -- --md` reproduces `docs/FRAME_DATA.md` byte-for-byte
  (14 MKS-1 errors) — the engine measures identically on both machines.
  **Next:** Step 2 decisions round (D7, D5, D3, D4, D1, D8, D9, D10), then
  the PR for this branch and P1.
  **Gotchas:** `CORRIDORKEY_DIR` in `.env` points at a path that doesn't
  exist here — fix it before `gen:key` (the tool can self-bootstrap a
  clone; pin it to `97e55a4` per P8.16). `npm ci` warns that fsevents'
  install script wasn't approved (`npm approve-scripts`) — harmless.

- **2026-10-04 · MKS-1 session (Claude Opus 5.5).** Built MKS-1 Phase A
  (see Appendix A), then merged the audit plan and the MKS-1 roadmap into
  this file, wrote `01-OLD-MACHINE-PASSOFF.md` (supersedes the audit's
  rescue prompt: same R2 contract, plus the canonical-anchor list, R2
  contents spec, branch flow, MKS-1 determinism cross-check) and
  `03-NEW-MACHINE-RESUME.md`, archived the original audit docs, and pushed
  everything to `feat/mks1-rescue-handoff`. No roster data changed.
  **Next:** the user runs 01 on the original machine → copies `.env` → runs
  03 here → P0.2/P0.3 → decisions round → P1/P2.
  **Gotchas:** vite-node can't load scripts outside the repo root (put
  throwaway scripts in `tools/fg/` and delete them); `assets/raw/mugen/`
  exists only on this machine (re-fetchable, never mirror it); don't raise
  hitstop before P3.5.

- **2026-10-04 · audit session (Claude Opus 5.5).** Ran the full audit and
  wrote `01-RESCUE-old-machine.md` (raw-asset rescue → private R2 bucket
  `martiankombat-raw` + committed canonical anchors + `tools/raw-sync.mjs`)
  and this plan. No code changes; ran `npm ci` (node_modules now present).
  **Next:** the user runs 01 on the original machine, copies `.env` over,
  then starts a session here with `03-NEXT-SESSION-PROMPT.md` → P0.
  *(Those two files are now archived in
  `docs/archive/handoff-2026-10-04-audit/`, superseded by
  `01-OLD-MACHINE-PASSOFF.md` / `03-NEW-MACHINE-RESUME.md`.)*
  **Gotchas:**
  - A parallel session ("Feature parity with Mugen/Ikemen Go") was writing
    uncommitted `src/compat/mugen/*.ts` + `assets/raw/mugen/` in this
    checkout, referencing a not-yet-present `docs/FIGHTING_STANDARDS.md`.
    By the end of the audit it had also added `src/bench/`,
    `tools/fg/import-mugen.ts`, and **uncommitted engine edits**
    (`step.ts`/`types.ts`: per-move `hitstop`/`chip`/`blockKnockback`, MUGEN
    `pausetime`/guard semantics). That's the same file as P3, so rebase P3
    onto that work once it's committed rather than fixing in parallel.
  - The browser pane throttles when hidden (see §0.8).
