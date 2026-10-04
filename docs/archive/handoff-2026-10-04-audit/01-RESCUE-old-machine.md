> **SUPERSEDED (archived 2026-10-04).** Original output of the 2026-10-04 audit session, kept verbatim for provenance. The live documents are `docs/handoff/01-OLD-MACHINE-PASSOFF.md`, `docs/handoff/02-PLAN.md` and `docs/handoff/03-NEW-MACHINE-RESUME.md`. Do not work from this file.

# Raw-asset rescue — prompt for the ORIGINAL dev machine

> **How to use:** on the machine that built Martian Kombat over the summer, open
> Claude Code in the `martian-kombat` checkout and paste everything below the
> line as your first message. It is self-contained (it does not need this file
> to be pulled first). Expect ~30–60 min, most of it upload time.
>
> **Before you start, have ready:** a Cloudflare login with R2 enabled (you'll
> be asked to create one bucket + one R2 API token in the dashboard).
>
> **Afterwards (manual, not via git/R2):** copy that machine's `.env` to the new
> machine over a private channel (AirDrop / password manager / USB). Never
> commit it, never upload it to R2.

---

You are running on the ORIGINAL development machine for Martian Kombat (a
Phaser/TypeScript fighting game; read `CLAUDE.md` for context but DO NOT do
the usual "read SPRINTBOARD first" ritual — this is a narrowly-scoped infra
task). Development is moving to a different computer that has a fresh clone
of `github.com/drmbt/martian-kombat` but is missing everything gitignored on
this machine. An audit (2026-10-04) found that **the canonical character
sheets — the identity anchors every sprite regeneration starts from — were
never committed** (`assets/raw/canonical/` is gitignored; tao/rj's were never
in git at all), so the new machine cannot regenerate any fighter.

**Your job:** make this machine's unique, uncommitted state recoverable from
the new machine, by (A) committing the small irreplaceable regen anchors to
git, and (B) mirroring ALL of `assets/` (plus root demo `*.mp4`s) to a
PRIVATE Cloudflare R2 bucket with a committed manifest and a sync tool, so the
new machine can `npm run raw:pull` once it has the `.env`.

## Hard rules

- **Never print, log, commit, or upload secret values.** Report `.env` keys by
  NAME only. Never upload `.env*` to R2.
- **Nothing destructive.** Do not delete local files, do not `git clean`, do
  not rewrite history, do not force-push, do not delete branches, do not
  touch the PUBLIC asset bucket `martiankombat-assets` or any Worker/Pages
  settings. R2 uploads use `rclone copy` (never `sync`, never `--delete-*`).
- **Do not edit `SPRINTBOARD.md` or `CLAUDE.md`** (a restructure of both is
  planned on the new machine; editing them here causes merge conflicts). This
  overrides the usual "update SPRINTBOARD before every commit" rule for this
  task. Write your report to `docs/handoff/RESCUE_REPORT.md` instead.
- **Do not run any paid generation API** (Gemini/OpenAI/ElevenLabs/Fish).
- Stop and ask the user at each ⛔ gate. Everything else you may do without
  asking.
- Commit messages: imperative + scoped (e.g. `infra: commit canonical regen
  anchors`), ending with the attribution line your environment specifies.

## Contract the new machine depends on — implement EXACTLY

| Thing | Value |
|---|---|
| Private bucket | `martiankombat-raw` (no public access, no custom domain) |
| Object key layout | `repo/<repo-relative path>` — e.g. `repo/assets/raw/canonical/tao.png` |
| Frozen insurance copy | server-side copy of the ignored set to `snapshots/2026-10-rescue-<hostname>/<repo-relative path>` |
| Env var names (in `.env`, never committed) | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT` (`https://<accountid>.r2.cloudflarestorage.com`), `R2_RAW_BUCKET=martiankombat-raw` (existing `R2_BUCKET=martiankombat-assets` is the separate PUBLIC bucket — leave it) |
| Manifest (committed) | `assets/raw-store.manifest.json` — see schema below |
| Sync tool (committed) | `tools/raw-sync.mjs` + npm scripts `raw:manifest`, `raw:push`, `raw:pull`, `raw:verify`, `raw:status` |
| Transport | `rclone` (external binary, `brew install rclone`), configured ONLY through child-process env vars (no `rclone.conf`): `RCLONE_CONFIG_MKRAW_TYPE=s3`, `_PROVIDER=Cloudflare`, `_ACCESS_KEY_ID`, `_SECRET_ACCESS_KEY`, `_ENDPOINT`, `_ACL=private`, `_NO_CHECK_BUCKET=true`; remote name `mkraw:` |
| Report | `docs/handoff/RESCUE_REPORT.md` |

Manifest schema (sorted by `path`, stable formatting so diffs are clean):

```json
{
  "version": 1,
  "bucket": "martiankombat-raw",
  "prefix": "repo/",
  "generatedAt": "<ISO timestamp>",
  "sourceHost": "<hostname>",
  "ignored": [ { "path": "assets/raw/canonical/tao.png", "bytes": 412345, "sha256": "…" } ],
  "trackedMirrored": { "files": 1234, "bytes": 1234567890 }
}
```

`ignored` lists every git-IGNORED file under `assets/` that was pushed (git
does not know about these, so the manifest is the only index). Tracked files
are mirrored too (as a backup ahead of a planned move of heavy tracked media
out of git) but only summarized, since git already indexes them.

## Steps

### 1 — Preflight: find ALL unique local state (read-only)

1. `git fetch --all --prune`, then report:
   - `git status --short --untracked-files=all` (what's modified / untracked
     but NOT ignored);
   - `git stash list`;
   - commits on any local branch not on any remote:
     `git log --branches --not --remotes --oneline`;
   - local branches with no upstream; current branch and its ahead/behind vs
     `origin/main` (origin/main should be `fbb5a28` from 2026-07-18 unless
     something newer was pushed).
2. Inventory everything gitignored under `assets/` and the repo root:
   `git ls-files --others --ignored --exclude-standard` (exclude
   `node_modules/`, `dist/`, `.vite/`, `__pycache__/`, `*.pyc`, `*.asd`,
   `.DS_Store`). Produce a table: top-level dir under `assets/raw/` (and
   `assets/veo-clips/`, `assets/frame-dumps/`, anything else) → file count →
   size. Expected categories include `canonical/`, `style-tests/`, `creator/`
   (Character Studio drafts), `keyed/`, `qa/`, `stages/`, `icons/`, `vfx/`,
   `fatalities/`, `world-map/`, `music/`, `voice-tests/`, `sprite-edits/`
   (timestamped pack backups), `jobs/` (job-runner state), `mugen/`.
3. `.env`: confirm it exists; list which key NAMES are set (non-empty) vs
   empty vs absent, compared against what the code reads:
   `GEMINI_API_KEY, OPENAI_API_KEY, ELEVENLABS_API_KEY, FISH_API_KEY,
   FAL_KEY, GEMINI_TEXT_MODEL, CORRIDORKEY_DIR, MK_PYTHON, CLOUDFLARE_ACCOUNT_ID,
   CLOUDFLARE_API_TOKEN, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
   R2_ENDPOINT, R2_RAW_BUCKET`. Names only.
4. Look for other machine-local state that matters, and note it for the
   report: `../CorridorKey` (record its git commit hash — the tool clones an
   unpinned HEAD), the Python used for QA (`MK_PYTHON` or the resolver's pick
   via `node tools/qa/resolve-python.mjs` if it prints one — record Python
   version and `pip freeze | grep -iE "rtmlib|onnxruntime|opencv|numpy|whisper"`),
   `ffmpeg -version | head -1`, `node -v`, Blender path/version if
   `tools/gen-mesh.mjs` references one, `rclone version` if installed.

**⛔ Gate 1:** show the user the preflight summary (unpushed commits, stashes,
untracked-not-ignored files, ignored-set table with sizes, `.env` key names).
If there are unpushed commits or stashes, propose how to preserve them (see
step 4) and wait for a go-ahead.

### 2 — Cloudflare R2 setup

1. Ensure `rclone` is installed (`brew install rclone` if missing — ask first
   if Homebrew isn't present).
2. Ask the user to create, in the Cloudflare dashboard:
   - **R2 → Create bucket** → name `martiankombat-raw`, default location, and
     leave public access OFF. (Alternatively, if `CLOUDFLARE_API_TOKEN` in
     `.env` has R2 edit rights, you may run `npx wrangler r2 bucket create
     martiankombat-raw` with that token injected via env — don't echo it.)
   - **R2 → Manage R2 API Tokens → Create API token** → permission "Object
     Read & Write", scoped to buckets `martiankombat-raw` (and optionally
     `martiankombat-assets`), no expiry or a long one. Put the Access Key ID,
     Secret, and the S3 endpoint into this machine's `.env` as
     `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, and add
     `R2_RAW_BUCKET=martiankombat-raw`. (If R2 creds already exist in `.env`
     for the 3D work, reusing them is fine if their scope includes the new
     bucket.)
3. **⛔ Gate 2:** wait for the user to confirm, then verify access with a
   harmless call through the tool you're about to write (or a one-off
   env-configured `rclone lsd mkraw:` / `rclone ls mkraw:martiankombat-raw
   --max-depth 1`). Never print the env.

### 3 — Write `tools/raw-sync.mjs` (+ npm scripts, .env.example)

Node ESM, no new npm dependencies, style consistent with `tools/lib.mjs`.
Guard `main` so the module is import-safe (repo convention). Requirements:

- Load `.env` itself, **tolerating a missing `.env`** and letting real
  `process.env` values win (do NOT reuse `loadEnv()` from `tools/lib.mjs` —
  it throws without a `.env`). Strip optional surrounding quotes.
- Fail fast with a friendly message if `rclone` is missing or any `R2_*`
  var is empty. Build the `RCLONE_CONFIG_MKRAW_*` env for the child process
  only; never print it.
- File selection: the **ignored set** = `git ls-files --others --ignored
  --exclude-standard -- assets` (filtered of the junk patterns above); the
  **tracked set** = `git ls-files -- assets` plus root `*.mp4`. Feed rclone
  via `--files-from` temp lists (repo root as source), so key = `repo/` +
  repo-relative path.
- Subcommands:
  - `manifest` — hash (sha256) every ignored-set file → write
    `assets/raw-store.manifest.json` per the schema (sorted, 2-space JSON,
    trailing newline) + the tracked summary.
  - `push [--tracked]` — `rclone copy` the ignored set (and with
    `--tracked`, the tracked set too) to `mkraw:$R2_RAW_BUCKET/repo/`,
    `--checksum`, `--transfers 8`, progress to stderr. Never deletes. Then
    regenerates the manifest.
  - `pull [--include-jobs] [--overwrite]` — `rclone copy` from
    `mkraw:$R2_RAW_BUCKET/repo/` to the repo root for every path in the
    manifest's `ignored` list (and nothing tracked — git owns those).
    Default `--ignore-existing` so local work is never clobbered.
    **By default EXCLUDE `assets/raw/jobs/**`**: the Character Studio job
    runner auto-resumes queued jobs from `assets/raw/jobs/state.json` on dev-
    server start and would silently re-spend API money on the new machine.
    Then run `verify`.
  - `verify` — re-hash local files listed in the manifest; print counts of
    OK / missing / mismatched; exit non-zero on mismatch (missing is a
    warning, since `pull` may have excluded jobs).
  - `status` — counts + bytes per top-level category, local vs manifest.
- npm scripts in `package.json`: `raw:manifest`, `raw:push`, `raw:pull`,
  `raw:verify`, `raw:status` → `node tools/raw-sync.mjs <cmd>`.
- `.env.example`: add `R2_RAW_BUCKET=martiankombat-raw` with a comment that
  this PRIVATE bucket holds the gitignored source/backups (distinct from the
  public `R2_BUCKET`), and note rclone is required for `raw:*`.

### 4 — Preserve unpushed git work (only if Gate 1 found any)

- Unpushed commits on `main` that fast-forward `origin/main`: leave them for
  step 6's push (they go first, in order).
- Anything else (diverged `main`, other local-only branches, stashes,
  untracked-not-ignored files): push each to a branch named
  `rescue/<hostname>/<original-name>` (stashes: `git stash branch` onto a
  rescue branch, commit, push). Do NOT merge them into main. List them in the
  report.

### 5 — Commit the regen anchors to git (small, irreplaceable)

Rule: a file is a **regen anchor** if a generator reads it as a REFERENCE
INPUT for a shipped fighter (not a regenerable output). Concretely:

- `assets/raw/canonical/**` (every `<id>.png` + `.prompt.txt`, plus any KO /
  defeat reference images that live there);
- `assets/raw/style-tests/char-*-b-painted.*` (vincent's and yulia's
  canonicals per `tools/frames-manifest.mjs`);
- for every fighter in `src/data/roster.ts` whose canonical/identity
  reference exists ONLY under `assets/raw/creator/<id>/` (creator-built
  fighters: likely earl, ben, tao, rj, and possibly vincent), COPY (don't
  move) it to `assets/raw/canonical/<id>.png` (+ its prompt sidecar if any).
  Verify by grepping `vite.config.ts` / `tools/` for how the creator stores the
  canonical; if ambiguous, ask.

Then:

1. Verify every roster fighter now has `assets/raw/canonical/<id>.png` (or the
   painted style-test for vincent/yulia). List any that don't — those are
   lost unless found elsewhere on disk (search `~` for `<id>*canonical*`
   / `<id>.png` under other checkouts before declaring loss).
2. Update `.gitignore` to re-include them — keep the existing
   `assets/raw/*` + `!assets/raw/frames/` + `!assets/raw/edits/` structure
   and add `!assets/raw/canonical/`, plus `!assets/raw/style-tests/`,
   `assets/raw/style-tests/*`, `!assets/raw/style-tests/char-*-b-painted.*`.
   Update the comment block to explain "canonical = regen anchors = source".
3. Size check: if the anchors total > 60 MB, **⛔ stop and ask** (expected ≈
   10–20 MB; canonicals are ~400 KB each).
4. `git add` exactly those paths; confirm with `git diff --cached --stat` that
   nothing else (and no `.env*`) is staged.

### 6 — Push to R2, snapshot, verify round-trip

1. `npm run raw:push -- --tracked` (mirrors everything; the tracked half is
   backup for the planned "move voice-inspo / raw frames / mp4s out of git"
   decision). Report bytes/files per category. R2 cost is negligible (~$0.015
   /GB-month, zero egress).
2. Server-side copy the IGNORED set to
   `snapshots/2026-10-rescue-<hostname>/` (`rclone copy` remote→remote with
   the same `--files-from` list; no re-upload) — an immutable-by-convention
   insurance copy in case a later buggy `push` overwrites something.
3. Round-trip proof: `pull` into a scratch clone or temp dir (e.g.
   `git worktree add /tmp/mk-verify origin/main` → copy the new
   `raw-sync.mjs` + manifest in → `raw:pull` → `raw:verify`), or at minimum
   `rclone check --one-way --files-from <ignored list> . mkraw:martiankombat-raw/repo`.
   Report the result; zero mismatches required.

### 7 — Commit, report, push

1. Commits (separate, scoped):
   - `infra: commit canonical regen anchors (un-ignore assets/raw/canonical)`
   - `tools: raw-sync — private R2 mirror for gitignored assets + manifest`
     (tool, package.json scripts, .env.example, `assets/raw-store.manifest.json`,
     and a short `docs/RAW_ASSET_STORE.md` explaining the contract table above,
     the commands, and the jobs-exclusion rationale)
   - `docs: rescue report` — `docs/handoff/RESCUE_REPORT.md` containing:
     preflight findings; what was committed (anchor list + sizes); R2 totals
     per category; snapshot prefix; round-trip verify result; fighters with
     MISSING anchors (if any); rescue branches pushed; `.env` key-name
     checklist (set/empty/absent — names only); machine tooling versions
     (python + packages, ffmpeg, node, rclone, CorridorKey commit, Blender);
     anything you were unsure about.
2. **⛔ Gate 3:** show the user the commit list + `git diff --stat origin/main`
   and get a go-ahead to push.
3. `git pull --rebase origin main` (the new machine may have pushed handoff
   docs under `docs/handoff/` — those are new files and won't conflict), then
   `git push origin main` (fast-forward only; if it isn't, push to
   `rescue/<hostname>/main` instead and say so).
4. Final message to the user: one screen summary + the exact steps for the
   new machine:
   ```
   # on the NEW machine
   git pull
   # copy .env over privately (AirDrop / password manager), into the repo root
   brew install rclone
   npm ci
   npm run raw:pull
   npm run raw:verify
   ```
