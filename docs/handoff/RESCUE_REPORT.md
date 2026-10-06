# Rescue report — original dev machine, 2026-10-04

> Written by the old machine's rescue run (`01-OLD-MACHINE-PASSOFF.md`,
> Claude Opus 5.5) for the new machine's `03-NEW-MACHINE-RESUME.md`.
> Host: `Vincents-MacBook-Air.local` (macOS 15.7.4, arm64).

## TL;DR

- **Every gitignored asset on this machine is now in the private bucket
  `martiankombat-raw`** under `repo/` (964 files, 708.7 MB), along with a backup of the
  tracked heavy media (2,469 files, 975.0 MB). A frozen server-side copy is at
  `snapshots/2026-10-rescue-Vincents-MacBook-Air/`. The round-trip check
  found 0 differences: 964/964 matching for both `repo/` and the snapshot, and a local re-hash of 964 OK.
- **All 18 roster fighters now have a committed canonical anchor** in
  `assets/raw/canonical/`. **Nothing is LOST**, but two were close: **ben's**
  only copy was in a Studio export zip in `~/Downloads`, and **earl's** current
  design was only in his export zips.
- **The new machine should expect** this machine's ignored set to be
  smaller than the plan assumed. 14 canonicals, all style-tests and all stage
  raws were `git rm`'d in `6c39409` (2026-07-06) and were *not* on disk here
  anymore; they came back from git history (`6c39409^`). This machine never
  had `assets/raw/keyed/`, `music` files, `world-map.png`, `veo-clips/`,
  `frame-dumps/` or any `jobs/` files.
- MKS-1 determinism cross-check: **identical**. `npm run bench -- --md`
  reproduced `docs/FRAME_DATA.md` byte-for-byte.

## 1 · Preflight (git)

| Check | Result |
|---|---|
| Branch | already on `feat/mks1-rescue-handoff` = origin (`536b28c`), 4 ahead of `origin/main` (`fbb5a28`) |
| Dirty / untracked files | none |
| Stashes | none |
| Unpushed commits (`git log --branches --not --remotes`) | none |
| Local branches without upstream | `feat/3d-mode`, `feat/sprite-editor`, `feat/sprite-qa-hitbox-floor-and-fight-tuning`. All three tips are contained in remote branches |
| `feat/character-studio` | local is "ahead 7" of its origin, but all 7 are in `origin/main` |
| **Rescue branches pushed** | **none needed** (Step 2 was a no-op) |

## 2 · Ignored-set inventory (before anchors were committed)

`git ls-files --others --ignored --exclude-standard -- assets`, minus junk:

| Dir | Files | MB | Notes |
|---|---:|---:|---|
| `raw/unused-3d-sources` | 211 | 409.3 | bulk of the set |
| `raw/sprite-edits` | 60 | 119.3 | timestamped Sprite-Editor sheet backups |
| `raw/rescue-exports` | 101 | 119.4 | Studio export bundles copied in from `~/Downloads` for this rescue (below) |
| `raw/creator` | 137 | 23.2 | 15 Studio drafts (`state.json` + `img/` for ben, earl, gale, tao, vincent) |
| `raw/qa` | 27 | 10.7 | DWPose reports (13 fighters) |
| `raw/fatalities` | 24 | 9.3 | |
| `raw/vfx` | 30 | 8.9 | |
| `raw/voice-tests` | 355 | 3.2 | |
| `raw/canonical` | 8 | 2.1 | **only tao + rj** (+ `ko/`) |
| `raw/icons` | 4 | 1.2 | tao, rj |
| `raw/favicon` | 5 | 1.0 | |
| `raw/retired` | 2 | 1.0 | haidai canonical + KO |
| **Total** | **964** | **708.7** | |

`raw/stages/`, `raw/music/` and `raw/jobs/` exist but are empty (only
`.DS_Store`). `assets/raw/mugen/` isn't present on this machine.

**`raw/rescue-exports/`** holds files that were outside the repo and are now
mirrored and snapshotted: `ben.zip` (Studio export, 2026-07-08; Ben's only
canonical), `earl (4).zip` (latest of five earl exports, 2026-07-07),
`vincent/` (unzipped export, 2026-07-07), and `martian-kombat-assets-raw.zip` /
`martian-kombat-assets-raw-frames.zip` (2026-07-06 zips of the then-raw
frames). The originals are still in `~/Downloads`. The four older earl
exports there weren't copied.

## 3 · Anchor census → what was committed

Census at preflight (`canonical/<id>.png`, painted style-test, Studio
`creator/<id>/img/canonical.png`):

| Fighter | On disk here | Other sources found |
|---|---|---|
| vincent, yulia | none | `6c39409^`: canonical **and** painted style-test (byte-identical to each other) |
| catherine, flo, freeman, gene, kirby, marzipan, bodhi, cat, chebel, ygor, rapha, vanessa | none | `6c39409^` canonical (+ prompt) |
| earl | none | `6c39409^` (older design) · `~/Downloads/earl*.zip` Studio canonical (current design) |
| **ben** | **none**, and `creator/ben/img/` has no `canonical.png` | **`~/Downloads/ben.zip` only** |
| tao | `canonical/tao.png` (438,789 B, 07-08 20:34) **and** `creator/tao/img/canonical.png` (451,127 B, 07-08 20:18). They differ | |
| rj | `canonical/rj.png` (439,617 B) | |

Committed (`assets/raw/canonical/`, plus the style-test and stage anchors):

| Fighter | Path(s) | Bytes | Source |
|---|---|---:|---|
| vincent | `canonical/vincent.png`, `style-tests/char-vincent-b-painted.png` (+ `.prompt.txt`), `canonical/ko/vincent.*` | 410,719 | git `6c39409^` |
| yulia | `canonical/yulia.png`, `style-tests/char-yulia-b-painted.png` (+ `.prompt.txt`), `canonical/ko/yulia.*` | 441,981 | git `6c39409^` |
| catherine | `canonical/catherine.*`, `ko/catherine.*` | 488,606 | git `6c39409^` |
| flo | `canonical/flo.*`, `ko/flo.*` | 418,896 | git `6c39409^` |
| freeman | `canonical/freeman.*`, `ko/freeman.*` | 449,793 | git `6c39409^` |
| gene | `canonical/gene.*`, `ko/gene.*` | 375,613 | git `6c39409^` |
| kirby | `canonical/kirby.*`, `ko/kirby.*` | 370,381 | git `6c39409^` |
| marzipan | `canonical/marzipan.*`, `ko/marzipan.*` | 452,712 | git `6c39409^` |
| bodhi | `canonical/bodhi.*`, `ko/bodhi.*` | 341,762 | git `6c39409^` |
| cat | `canonical/cat.*`, `ko/cat.*` | 498,797 | git `6c39409^` |
| chebel | `canonical/chebel.*`, `ko/chebel.*` | 495,325 | git `6c39409^` |
| ygor | `canonical/ygor.*`, `ko/ygor.*` | 380,356 | git `6c39409^` |
| rapha | `canonical/rapha.*`, `ko/rapha.*` | 449,643 | git `6c39409^` |
| vanessa | `canonical/vanessa.*`, `ko/vanessa.*` | 337,250 | git `6c39409^` |
| **earl** | `canonical/earl.png` | 65,192 | **Studio canonical** from `rescue-exports/earl (4).zip` (`raw/img/canonical.png`, sha256 `9ed04d3e…`, identical in all 5 exports); `ko/earl.*` from `6c39409^` |
| **ben** | `canonical/ben.png` | 59,604 | **Studio canonical** from `rescue-exports/ben.zip` (`raw/img/canonical.png`, sha256 `1c0ce102…`) |
| tao | `canonical/tao.*`, `ko/tao.*` | 438,789 | on disk (unchanged) |
| rj | `canonical/rj.*`, `ko/rj.*` | 439,617 | on disk (unchanged) |
| world-map style | `stages/salton.png` (+ `.prompt.txt`) | | git `6c39409^` |

Total Tier 1: **72 files, 17.6 MB** (plus Tier 2: 7 `state.json`, 0.6 MB).
The 62 history-restored files are byte-identical to blobs git already
stores, so they cost no repo size. Only **17 blobs (2.8 MB) are new**: ben,
earl, the tao/rj sets, and the drafts. ben and earl have no `.prompt.txt`
sidecar because the Studio didn't write one; their design prompts live in the
R2-only `creator/<id>/state.json`.

**Conflicts and how they were resolved:**
- **tao:** `canonical/tao.png` (grey hair) matches the shipped frames, and
  gen-frames/gen-fatality read it, so it stays. The Studio copy (brown hair)
  is an earlier iteration and is R2-only.
- **earl:** the Studio canonical (288×384, keyed) matches the current sprites
  (paisley shirt, short-ish hair). The `6c39409^` canonical (896×1200, wild
  hair, fighting pose) is the pre-Studio design. The Studio one won; the old
  one stays in git history.
- **ben, earl:** these anchors are 288×384 keyed cell-space PNGs (Studio
  format), not 896×1200 chroma-green painted sheets like the CLI fighters.
  That's fine for the Studio, which reads `canonical/<id>.png`.

**LOST:** nothing.

**Tier 2 (approved at Gate 3):** committed `state.json` for the unshipped
drafts **gale, guile, mira, mirage, nova, zephyr** (4–17 KB each; these look
like Studio smoke-test drafts) and **tao** (566 KB). The eight shipped-fighter
drafts (ben, catherine, earl, flo, gene, rapha, vincent, yulia: 1.3–1.8 MB
each) stay **R2-only** and are listed by name in `.gitignore`. Their bulk is
base64 copies of committed media: checked on ben, 4/4 fatality panels and
16/17 VO clips are byte-identical to `public/assets/`. Every `img/` folder
stays R2-only.

## 4 · R2

| | |
|---|---|
| Bucket | `martiankombat-raw` (private) |
| Pushed: ignored set | 964 files, 708.7 MB |
| Pushed: tracked mirror | 2,469 files, 975.0 MB |
| Snapshot | `snapshots/2026-10-rescue-Vincents-MacBook-Air/` (964 files, 708.7 MB, server-side copy) |
| Round trip | `npm run raw:verify -- --remote` (`rclone check --one-way --checksum`): 0 differences: 964/964 matching for both `repo/` and the snapshot, and a local re-hash of 964 OK |
| Manifest | `assets/raw-store.manifest.json`: after the anchors were committed, `ignored` lists **949** entries (the 15 newly tracked files dropped out; the snapshot still holds them); `raw:verify` 949 OK; `trackedMirrored` 2,469 files / 1,022,325,182 B |

Per-category totals (ignored set, as pushed):

| Category | Files | MB |
|---|---:|---:|
| raw/unused-3d-sources | 211 | 409.3 |
| raw/rescue-exports | 101 | 119.4 |
| raw/sprite-edits | 60 | 119.3 |
| raw/creator | 137 | 23.2 |
| raw/qa | 27 | 10.7 |
| raw/fatalities | 24 | 9.3 |
| raw/vfx | 30 | 8.9 |
| raw/voice-tests | 355 | 3.2 |
| raw/canonical | 8 | 2.1 |
| raw/icons | 4 | 1.2 |
| raw/favicon | 5 | 1.0 |
| raw/retired | 2 | 1.0 |
| **Total ignored** | **964** | **708.7** |
| tracked mirror: assets/raw/frames, voice-inspo, stage-inspo, character-inspo, general-inspo, archive, raw/edits + 5 root mp4s | 2,469 | 975.0 |

`repo/` total: **3,433 objects, 1.77 GB** (`rclone size`). During the push one
transient broken pipe (`assets/general-inspo/vanessa.wav`) succeeded on
rclone retry 2/3. Exit 0. Throughput was ~3.5–4.3 MiB/s, ~7.5 min total.

**Public bucket `martiankombat-assets`: not listed.** The R2 token is scoped
to `martiankombat-raw` only, and `ListObjectsV2` returned 403 AccessDenied.
That's correct least-privilege. List it from the dashboard, or with a token
that has read on that bucket, if P9.3/P9.6 needs the numbers.

## 5 · Baseline on this machine

| Check | Result |
|---|---|
| `npm ci` | ok |
| `npx tsc --noEmit` | clean |
| `npx vitest run` | **411/411** before this rescue's commits; **419/419** after (adds `src/data/rawSync.test.ts`) |
| **MKS-1 determinism** (`npm run bench -- --md` → `git diff --stat docs/FRAME_DATA.md`) | **no diff**. 18 fighters, same 14 MKS-1 errors as the baseline |

## 6 · `.env` key names (this machine; values never read into the log)

| Name | State |
|---|---|
| `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `FISH_API_KEY`, `FAL_KEY` | set |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_RAW_BUCKET` | set (added for the rescue; `R2_RAW_BUCKET=martiankombat-raw`) |
| `R2_BUCKET`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | set (added alongside the R2 keys) |
| `CORRIDORKEY_DIR` | set (machine-specific path; check it on the new machine) |
| `GEMINI_TEXT_MODEL`, `MK_PYTHON` | absent (code defaults) |

Copy this `.env` to the new machine privately.

## 7 · Tooling versions (this machine)

| Tool | Version |
|---|---|
| node | v26.4.0 (npm 11.17.0) |
| ffmpeg | 8.1.2 |
| QA python (`resolvePython()`) | `python3.13` → `/opt/miniconda3/bin/python3.13` (3.13.9). rtmlib 0.0.15, onnxruntime 1.24.4, opencv(-contrib)-python 5.0.0.93, numpy 2.3.5, openai-whisper 20250625 |
| CorridorKey (`../CorridorKey`) | `97e55a4` (2026-05-28) |
| Blender (`tools/gen-mesh.mjs`) | 3.3.1 at `/Applications/Blender.app` |
| rclone | v1.75.1 (Homebrew; installed for the rescue) |

## 8 · Notes for the new machine / uncertain

- **`assets/raw/canonical/` is now tracked.** `gen-canonical.mjs` and the
  Studio write there, so a regen will show up as a diff. That's by design:
  canonicals are source now.
- **The `6c39409^` canonicals predate 2026-07-06.** If any of those 14
  fighters got a new canonical on this machine after that date, it was
  already gone before the rescue. None was found on disk or elsewhere under
  `~` (I searched with Spotlight plus `~/Downloads`).
- **earl's shipped KO portrait is a placeholder.**
  `public/assets/portraits/earl-ko.png` is byte-identical to `earl.png` (no
  beaten-up variant). `canonical/ko/earl.png` is the *old* design's KO. Add
  this to the P4/P10 asset gaps.
- **Not restored on purpose:** `haidai` (retired; it lives in
  `assets/raw/retired/` → R2, and in `6c39409^`), the a-digitized/c-pixel
  style tests, the other stage raws, and the old raw icons. All of these are
  still in git history at `6c39409^` if anyone needs them.
- **Follow-up idea (P8):** Studio `state.json` should reference generated
  media by path instead of embedding base64. That would drop shipped drafts
  to ~150 KB and make all of them committable.
