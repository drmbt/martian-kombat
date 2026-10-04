# Old-machine pass-off — run on the ORIGINAL dev machine

> Supersedes the audit's `01-RESCUE-old-machine.md` (archived in
> `docs/archive/handoff-2026-10-04-audit/`): same R2 contract, plus the
> explicit canonical-anchor list, the full R2 contents spec, the branch flow,
> and an MKS-1 determinism cross-check. Expect ~30–60 min, mostly upload.
>
> **Flow:** (1) you do the human checklist below → (2) paste the agent
> prompt (Part 2) into Claude Code in the old machine's `martian-kombat`
> checkout → (3) it commits + pushes to `feat/mks1-rescue-handoff` →
> (4) you copy `.env` to the new machine → (5) run `03-NEW-MACHINE-RESUME.md`
> there.

---

## Part 1 — Human checklist (do these yourself)

**Cloudflare dashboard (one bucket, one token, nothing else):**

1. **R2 → Create bucket** → name **`martiankombat-raw`**, default location,
   public access **OFF**, **no** custom domain, **no** r2.dev URL.
2. **R2 → Manage R2 API Tokens → Create API token** → permission **Object
   Read & Write**, scoped to bucket `martiankombat-raw` (add
   `martiankombat-assets` too only if you want one token for both), no expiry
   or a long one. Keep the **Access Key ID**, **Secret Access Key**, and the
   **S3 endpoint** `https://<accountid>.r2.cloudflarestorage.com`.
3. **Leave untouched:** the public bucket `martiankombat-assets`, the Worker /
   Workers Builds that serve martiankombat.com, its custom domain, DNS, and
   GitHub Pages. (Pushing a *branch* may produce a preview build if Workers
   Builds has non-production branch builds on — harmless.)

**Old machine `.env`** (append; names exactly, values from step 2):

```
R2_ACCESS_KEY_ID=…
R2_SECRET_ACCESS_KEY=…
R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
R2_RAW_BUCKET=martiankombat-raw
```

Keep the existing `R2_BUCKET=martiankombat-assets` (the separate public
bucket). Have Homebrew available (the agent installs `rclone`).

**Afterwards:** copy that machine's `.env` into the new machine's repo root
over a private channel (AirDrop / password manager / USB). Never commit it,
never upload it to R2.

---

## Where everything lives after the rescue (the contract)

### In git — branch `feat/mks1-rescue-handoff`

**Tier 1 — canonical regen anchors (commit; small, irreplaceable).** A file
is an anchor when a generator reads it as a *reference input* for a shipped
fighter. Losing one means a fighter can never be regenerated consistently.

| Fighter | Path(s) to commit | Read by | Git-history fallback |
|---|---|---|---|
| vincent | `assets/raw/style-tests/char-vincent-b-painted.png` (+ `.prompt.txt`) **and** `assets/raw/canonical/vincent.png` | CLI tools read the style-test; the Studio reads `canonical/` | `6c39409^` |
| yulia | `assets/raw/style-tests/char-yulia-b-painted.png` (+ `.prompt.txt`) **and** `assets/raw/canonical/yulia.png` | same | `6c39409^` |
| catherine, flo, kirby, freeman, gene, marzipan, bodhi, cat, chebel, ygor, rapha, vanessa | `assets/raw/canonical/<id>.png` (+ `.prompt.txt`) | gen-frames, gen-fatality, gen-icons, gen-canonical, Studio | `6c39409^` |
| earl | `assets/raw/canonical/earl.png` | Studio (creator-built) | `6c39409^` (older design) |
| **ben** | `assets/raw/canonical/ben.png` ← copy of `assets/raw/creator/ben/img/canonical.png` | Studio | **none — old machine only** |
| **tao** | `assets/raw/canonical/tao.png` (+ prompt) | gen-frames, gen-fatality | **none — old machine only** |
| **rj** | `assets/raw/canonical/rj.png` (+ prompt) | gen-frames, gen-fatality | **none** (`assets/archive/rj-v1-gatekeeper/canonical-rj.png` is the OLD v1 design, not a substitute) |

Also Tier 1 (same directories, so they come along):
- `assets/raw/canonical/ko/**` — the raw KO/defeat generations behind every
  `<id>-ko.png` (~0.5 MB each);
- any other `assets/raw/canonical/<name>.png` for inspo'd-but-unbuilt
  Martians (e.g. haidai) — paid generations, keep them;
- `assets/raw/stages/salton.png` (+ prompt) — the **world-map style anchor**
  (`tools/gen-worldmap.mjs` `STYLE_REF`).

Expected Tier 1 total ≈ 20 MB (history shows ~0.45 MB per canonical).

**Tier 2 — ask the user (⛔ Gate 3):** `assets/raw/creator/<id>/state.json`
for each Studio draft, especially **unshipped WIP drafts** — small text files
holding design work (lore, kit, VO, prompts) that exists nowhere else.
Recommend: commit if each ≤ 1 MB. The drafts' `img/` folders stay R2-only.

**Already in git (no action):** `assets/raw/frames/` (source frames),
`assets/raw/edits/` (Sprite Editor overlays), `assets/*-inspo/`,
`assets/archive/`, everything in `public/`, `tools/voices.json`.

**`.gitignore` rules** (verified in a scratch repo — keep the existing
comment block, extend it to say "canonical = regen anchors = source"):

```
assets/raw/*
!assets/raw/frames/
!assets/raw/edits/
!assets/raw/canonical/
!assets/raw/style-tests/
assets/raw/style-tests/*
!assets/raw/style-tests/char-*-b-painted.*
!assets/raw/stages/
assets/raw/stages/*
!assets/raw/stages/salton.png
!assets/raw/stages/salton.prompt.txt
# Tier 2, only if approved:
!assets/raw/creator/
assets/raw/creator/*/*
!assets/raw/creator/*/state.json
```

### In the PRIVATE R2 bucket `martiankombat-raw`

| Key prefix | Contents | Why |
|---|---|---|
| `repo/<repo-relative path>` | **every gitignored file under `assets/`** (minus junk + `assets/raw/mugen/`) — expected: `raw/canonical/`, `raw/style-tests/`, `raw/creator/` (drafts: `state.json` + `img/` with every generated cell, canonical, portrait), `raw/keyed/` (CorridorKey output — free to redo, slow), `raw/qa/` (DWPose reports — the packer bakes skeletons from `qa/<id>/report.json`), `raw/stages/`, `raw/icons/`, `raw/vfx/`, `raw/fatalities/`, `raw/world-map.png`, `raw/music/`, `raw/voice-tests/`, `raw/sprite-edits/` (timestamped sheet backups), `raw/jobs/`, `assets/veo-clips/`, `assets/frame-dumps/` | the only copy of paid generation output not in git |
| `repo/<repo-relative path>` | **tracked heavy media, mirrored as backup**: `assets/voice-inspo/`, `assets/character-inspo/`, `assets/stage-inspo/`, `assets/general-inspo/`, `assets/raw/frames/`, `assets/raw/edits/`, `assets/archive/`, root `*.mp4` | lets the plan's P9 moves (voice-inspo exposure D1, raw frames out of git, mp4s) happen without losing anything |
| `snapshots/2026-10-rescue-<hostname>/<path>` | server-side frozen copy of the ignored set | insurance against a later buggy push |

Never in R2: `.env*`, `node_modules/`, `dist/`, `.vite/`, Python caches, and
`assets/raw/mugen/` (third-party CC BY-NC, re-fetchable via
`npm run mugen:fetch`). The committed index of the ignored set is
`assets/raw-store.manifest.json`.

### Elsewhere

- **Public bucket `martiankombat-assets`:** unchanged now. The agent lists
  its top-level prefixes + sizes (read-only) for the report. Planned future
  occupants: 3D GLBs (P9.6, if D5 ships 3D) and the demo mp4s (P9.3).
- **Worker serving martiankombat.com:** unchanged now (P2.2 later flips
  `not_found_handling` to `"none"` in `wrangler.jsonc`).
- **New machine only, by hand:** `.env`.

---

## Part 2 — Agent prompt (paste everything below the line)

---

You are running on the ORIGINAL development machine for Martian Kombat (a
Phaser/TypeScript fighting game). Development is moving to a new machine with
a fresh clone that lacks everything gitignored here. Your job is a narrowly
scoped infra task: make this machine's unique state recoverable, on branch
**`feat/mks1-rescue-handoff`**. Do NOT do the usual "read SPRINTBOARD first"
ritual. Do read `CLAUDE.md` (context) and, after switching branches in step
3, `docs/handoff/01-OLD-MACHINE-PASSOFF.md` Part 1 (the contract: anchor
list, R2 layout, `.gitignore` rules) and `docs/handoff/02-PLAN.md` §3
(guardrails).

### Hard rules

- **Never print, log, commit, or upload secret values.** `.env` keys by NAME
  only. Never upload `.env*` anywhere.
- **Nothing destructive:** no deleting local files, no `git clean`, no
  history rewrite, no force-push, no branch deletion; R2 uploads use
  `rclone copy` (never `sync`, never `--delete-*`); don't touch the public
  bucket `martiankombat-assets` except read-only listing; no Worker / Pages
  / DNS changes.
- **Don't edit `SPRINTBOARD.md` or `CLAUDE.md`** (restructured on the new
  machine in P1; edits here cause conflicts) — this overrides the
  "update SPRINTBOARD before every commit" rule. Report to
  `docs/handoff/RESCUE_REPORT.md` instead.
- **No paid generation APIs** (Gemini / OpenAI / ElevenLabs / Fish).
- **Don't modify `assets/raw/canonical/` or any other raw file until the R2
  push + snapshot (step 6) has succeeded.**
- Stop at each ⛔ gate and wait for the user. Everything else, proceed.
- Commits: imperative + scoped (`infra: …`, `tools: …`, `docs: …`), ending
  with the attribution line your environment specifies.

### Contract (implement exactly)

| Thing | Value |
|---|---|
| Private bucket | `martiankombat-raw` |
| Object keys | `repo/<repo-relative path>`, e.g. `repo/assets/raw/canonical/tao.png` |
| Snapshot | `snapshots/2026-10-rescue-<hostname>/<repo-relative path>` (server-side copy of the ignored set) |
| Env names | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_RAW_BUCKET` (leave `R2_BUCKET`, the public bucket, alone) |
| Manifest (committed) | `assets/raw-store.manifest.json` (schema below) |
| Tool (committed) | `tools/raw-sync.mjs` + npm scripts `raw:manifest`, `raw:push`, `raw:pull`, `raw:verify`, `raw:status`, `raw:snapshot` |
| Transport | `rclone` via child-process env only (no `rclone.conf`): `RCLONE_CONFIG_MKRAW_TYPE=s3`, `_PROVIDER=Cloudflare`, `_ACCESS_KEY_ID`, `_SECRET_ACCESS_KEY`, `_ENDPOINT`, `_ACL=private`, `_NO_CHECK_BUCKET=true`; remote `mkraw:` |
| Branch | `feat/mks1-rescue-handoff` (push there, never to `main`) |
| Report | `docs/handoff/RESCUE_REPORT.md` |

Manifest schema (sorted by `path`, 2-space JSON, trailing newline):

```json
{
  "version": 1,
  "bucket": "martiankombat-raw",
  "prefix": "repo/",
  "generatedAt": "<ISO timestamp>",
  "sourceHost": "<hostname>",
  "ignored": [ { "path": "assets/raw/creator/ben/img/canonical.png", "bytes": 412345, "sha256": "…" } ],
  "trackedMirrored": { "files": 1234, "bytes": 1234567890 },
  "snapshots": ["snapshots/2026-10-rescue-<hostname>/"]
}
```

### 1 — Preflight on the CURRENT checkout (read-only)

1. `git fetch --all --prune`; report `git status --short
   --untracked-files=all`, `git stash list`, `git log --branches --not
   --remotes --oneline`, local branches without upstream, current branch and
   ahead/behind vs `origin/main` (expected `fbb5a28` unless something newer
   was pushed).
2. Inventory the ignored set: `git ls-files --others --ignored
   --exclude-standard` (drop `node_modules/`, `dist/`, `.vite/`,
   `__pycache__/`, `*.pyc`, `*.asd`, `.DS_Store`). Table: top-level dir under
   `assets/raw/` (and `assets/veo-clips/`, `assets/frame-dumps/`, anything
   else) → files → bytes.
3. **Anchor census** for every id in `src/data/roster.ts`: which of
   `assets/raw/canonical/<id>.png`, `assets/raw/style-tests/char-<id>-b-painted.png`
   and `assets/raw/creator/<id>/img/canonical.png` exist, with size, mtime
   and sha256. Flag ids with none (search `~` for `<id>*canonical*` /
   `<id>.png` in other checkouts before calling anything lost) and ids where
   the creator canonical and `canonical/<id>.png` differ.
4. `.env`: which key NAMES are set / empty / absent among `GEMINI_API_KEY,
   OPENAI_API_KEY, ELEVENLABS_API_KEY, FISH_API_KEY, FAL_KEY,
   GEMINI_TEXT_MODEL, CORRIDORKEY_DIR, MK_PYTHON, CLOUDFLARE_ACCOUNT_ID,
   CLOUDFLARE_API_TOKEN, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
   R2_ENDPOINT, R2_RAW_BUCKET`.
5. Tooling versions for the report: `node -v`, `ffmpeg -version | head -1`,
   the QA Python (`MK_PYTHON` or `node tools/qa/resolve-python.mjs`) + `pip
   freeze | grep -iE "rtmlib|onnxruntime|opencv|numpy|whisper"`,
   `../CorridorKey` git commit, Blender path/version if `tools/gen-mesh.mjs`
   references one, `rclone version` if installed.

**⛔ Gate 1:** show the summary (unpushed commits, stashes, dirty files,
ignored-set table, anchor census, `.env` names). Propose how to preserve any
local git work (step 2) and wait.

### 2 — Preserve local git work (only if Gate 1 found any)

Before switching branches: each diverged/unpushed branch, stash
(`git stash branch`), or untracked-not-ignored file set goes to its own
`rescue/<hostname>/<name>` branch, committed and pushed. Never merge them
anywhere. Ignored files are untouched by branch switches.

### 3 — Switch to the hand-off branch + baseline

1. `git switch feat/mks1-rescue-handoff` (it tracks
   `origin/feat/mks1-rescue-handoff`), `npm ci`.
2. `npx tsc --noEmit` and `npx vitest run` → expect **411/411** green.
3. **MKS-1 determinism cross-check:** `npm run bench -- --md`, then
   `git diff --stat docs/FRAME_DATA.md`. Expect **no diff** — the engine is
   deterministic, so this machine must reproduce the numbers measured on the
   new one. If it differs, report the diff and restore the file
   (`git checkout docs/FRAME_DATA.md`); don't commit it.

### 4 — R2 access

1. `brew install rclone` if missing (ask first if Homebrew is absent).
2. **⛔ Gate 2:** confirm with the user that the bucket + token exist and the
   four `R2_*` names are set (names only), then verify with a harmless
   listing through the env-configured remote. Never print the env.

### 5 — Write `tools/raw-sync.mjs` (+ npm scripts, `.env.example`, test)

Node ESM, no new dependencies, import-safe (guard `main`, repo convention).

- Load `.env` itself, **tolerating a missing file**, real `process.env`
  wins, strip surrounding quotes (don't reuse `loadEnv()` from
  `tools/lib.mjs` — it throws without `.env`).
- Fail fast and friendly if `rclone` is missing or any `R2_*` is empty;
  build `RCLONE_CONFIG_MKRAW_*` only for the child process.
- Selection: **ignored set** = `git ls-files --others --ignored
  --exclude-standard -- assets` minus the junk patterns and minus
  `assets/raw/mugen/**`; **tracked set** = `git ls-files -- assets` + root
  `*.mp4`. Feed rclone with `--files-from` temp lists (repo root as source).
- Subcommands:
  - `manifest` — sha256 every ignored-set file → the manifest + tracked summary;
  - `push [--tracked]` — `rclone copy --checksum --transfers 8` to
    `mkraw:$R2_RAW_BUCKET/repo/`; never deletes; then `manifest`;
  - `snapshot <name>` — server-side copy of the ignored set to
    `snapshots/<name>/` and record it in the manifest;
  - `pull [--include-jobs] [--overwrite]` — copy every manifest `ignored`
    path back; default `--ignore-existing`; **exclude
    `assets/raw/jobs/**` unless `--include-jobs`** (the Studio job runner
    auto-resumes queued paid jobs on dev-server start); then `verify`;
  - `verify` — re-hash manifest entries; OK / missing / mismatched counts;
    non-zero exit on mismatch (missing = warning);
  - `status` — files/bytes per category, local vs manifest.
- Export the pure helpers (selection filtering, manifest building/sorting)
  and add a vitest beside `src/data/jobs.test.ts` that exercises them on a
  temp dir (no rclone, no network).
- npm scripts `raw:manifest|push|pull|verify|status|snapshot` →
  `node tools/raw-sync.mjs <cmd>`.
- `.env.example`: add `R2_RAW_BUCKET=martiankombat-raw` with a comment (the
  PRIVATE store for gitignored source/backups, distinct from the public
  `R2_BUCKET`; `rclone` required for `raw:*`).

### 6 — Push to R2 FIRST, snapshot, verify

1. `npm run raw:push -- --tracked`. Report files/bytes per category.
2. `npm run raw:snapshot -- 2026-10-rescue-<hostname>`.
3. Round-trip proof: `rclone check --one-way --files-from <ignored list> .
   mkraw:martiankombat-raw/repo` (or `pull` into a scratch worktree +
   `verify`). Zero mismatches required.
4. Read-only: list top-level prefixes + sizes of the public bucket
   `martiankombat-assets` for the report.

### 7 — Commit the canonical anchors (Part 1 contract)

1. For every roster id lacking `assets/raw/canonical/<id>.png`: COPY (never
   move) the best source in — `assets/raw/creator/<id>/img/canonical.png`
   for creator-built fighters (expected: ben, maybe earl/tao/rj), the
   painted style-test for vincent/yulia. When a creator canonical and an
   existing `canonical/<id>.png` differ, the NEWER one (the one the current
   sheet was generated from — compare mtimes with
   `public/assets/sprites/<id>/sheet.png`) becomes `canonical/<id>.png`;
   both are already in the R2 snapshot, and the report says which won.
   Never change which file the CLI tools read for vincent/yulia.
2. Missing anchor with no local source → recover from git history if listed
   in Part 1 (`git show 6c39409^:assets/raw/canonical/<id>.png > …`), else
   report it as **LOST** (ben/tao/rj have no fallback).
3. Update `.gitignore` with the Tier 1 rules from Part 1 (Tier 2 lines only
   after ⛔ Gate 3).
4. Size check: Tier 1 > 60 MB → stop and ask.
5. **⛔ Gate 3:** show the anchor list (id → path → size → source), any
   conflicts/losses, and the Tier 2 draft list with sizes; ask whether to
   commit the drafts' `state.json`.
6. `git add` exactly those paths (+ `.gitignore`); confirm with
   `git diff --cached --stat` that nothing else (and no `.env*`) is staged.
7. `npm run raw:manifest` (anchors that are now tracked drop out of
   `ignored`; the snapshot still holds them).

### 8 — Commit, report, push

1. Separate scoped commits:
   - `infra: commit canonical regen anchors (un-ignore assets/raw/canonical)`
   - `tools: raw-sync — private R2 mirror for gitignored assets + manifest`
     (tool, test, scripts, `.env.example`, manifest, and a short
     `docs/RAW_ASSET_STORE.md`: the contract table, commands, jobs-exclusion
     and mugen-exclusion rationale)
   - `docs: rescue report` — `docs/handoff/RESCUE_REPORT.md`: preflight;
     anchor census + what was committed (id → path → size → source);
     conflicts / LOST anchors; R2 totals per category; snapshot prefix;
     round-trip result; public-bucket listing; rescue branches pushed;
     `.env` name checklist; tooling versions; the MKS-1 determinism
     cross-check result; anything uncertain.
2. **⛔ Gate 4:** show the commit list + `git diff --stat
   origin/feat/mks1-rescue-handoff` and get a go-ahead.
3. `git pull --rebase origin feat/mks1-rescue-handoff`, then
   `git push origin feat/mks1-rescue-handoff` (fast-forward only).
4. Final message: a one-screen summary, then the new-machine steps:

   ```
   # on the NEW machine (after copying .env into the repo root)
   git fetch origin && git switch feat/mks1-rescue-handoff && git pull
   brew install rclone
   npm ci
   npm run raw:pull
   npm run raw:verify
   # then paste docs/handoff/03-NEW-MACHINE-RESUME.md into Claude Code
   ```
