# New-machine resume — run HERE after the old machine's rescue

> Supersedes the audit's `03-NEXT-SESSION-PROMPT.md` (archived in
> `docs/archive/handoff-2026-10-04-audit/`).
>
> **Prerequisites:** (1) `01-OLD-MACHINE-PASSOFF.md` ran on the original
> machine and pushed to `feat/mks1-rescue-handoff`; (2) you copied that
> machine's `.env` into this repo's root privately. Then open Claude Code here
> and paste everything below the line.

---

We're resuming Martian Kombat on a new machine after a ~3-month gap. Two
sessions on 2026-10-04 produced the working backlog,
**`docs/handoff/02-PLAN.md`** (a full-repo audit merged with the MKS-1
fighting-game-standards work). Read its header, §0 (session protocol), §1
(status), §2 (decision gates), §3 (guardrails) and the Handoff log before
doing anything; skim the phases. It supersedes SPRINTBOARD's
"Current"/handoff sections until P1.1 — don't read the whole SPRINTBOARD.

## Step 1 — P0.2/P0.3: restore + baseline

1. `git fetch origin && git switch feat/mks1-rescue-handoff && git pull`.
   Read `docs/handoff/RESCUE_REPORT.md` (written on the old machine). If it
   doesn't exist, stop and tell me.
2. `.env` exists? Report key NAMES set/empty vs the report's checklist.
   **Never print values.**
3. `brew install rclone` if missing → `npm ci` → `npm run raw:pull` →
   `npm run raw:verify` (0 mismatches). Confirm `assets/raw/jobs/` was NOT
   restored. Confirm every roster fighter has its anchor
   (`assets/raw/canonical/<id>.png`; vincent/yulia also the painted
   style-test). `assets/raw/mugen/` may already exist here — it's
   third-party reference content, leave it (re-fetch: `npm run mugen:fetch`).
4. Baseline: `npx tsc --noEmit`, `npx vitest run` (expect ≥ 411 green incl.
   the raw-sync test the rescue added), `npx vite build --outDir
   /tmp/mk-dist`, and `npm run bench -- --md` followed by
   `git diff --stat docs/FRAME_DATA.md` (expect no diff; restore it if any
   and report). Compare with §1's facts; record in the Handoff log.

Report back before Step 2.

## Step 2 — Decisions, in at most two rounds

Ask me the §2 gates that block near-term work as multiple choice, each with
your recommendation:
- **D7** deploy/branch policy — does `main` auto-deploy? PR per phase? When
  to merge `feat/mks1-rescue-handoff` (recommended: PR now — the engine
  change is default-neutral and the suite is green)? Unpublish GitHub Pages?
- **D5** 3D: freeze / delete / ship.
- **D3** game vs platform.
- **D4** touch-controls scope.
- **D1** voice-inspo / photos exposure in the public repo.
- **D8** fight feel vs the reference (hitstop after P3.5, plus-on-hit
  mediums/heavies, block safety, walk speed).
- **D9** arena width / camera scroll.
- **D10** fix or keep the takeoff-friction and charge-bleed quirks.

Leave **D2** (history rewrite) and **D6** (API spend) until needed. Record
the answers in §2 and the Handoff log.

## Step 3 — Execute the plan

- First, per D7: open the PR `feat/mks1-rescue-handoff` → `main`.
- Order: **P1 → P2 → P3 → P4 → P5 → P6**, then P7/P8, then P10. P1 and P2
  are independent. P4 data fixes can run alongside P3 (different files).
- **Git:** one branch + PR per phase (`fix/p2-player-traps`, …), branched
  from `main` once the hand-off branch has merged. Small scoped commits
  (CLAUDE.md conventions). No pushes to `main`, no force-push, without my OK.
- **Per item:** re-verify first; engine/data fixes start with a failing
  vitest (synthetic fighters: `src/bench/fixtures.ts`). After each item:
  `tsc` + `vitest` + `npm run bench` (no new MKS-1 errors). Data fixes that
  clear an MKS-1 error run `npm run bench -- --update-baseline` in the same
  commit. Engine changes that move timing semantics fail the KFM parity
  test — re-fit only if the change is intended (§3). UI items: verify in the
  browser preview by probing `window.__game` (the pane throttles when hidden).
- **Parallelism is fine** for independent phases (subagents in separate
  worktrees); keep each PR reviewable (< ~600 changed lines excluding moved
  docs).
- **Ask before any** paid API call (D6, with an estimated count), branch
  deletion, history rewrite, GitHub/Cloudflare setting change, or
  regeneration of committed art.
- **End of each session:** tick boxes in `02-PLAN.md` and append a Handoff
  log entry (done / next / gotchas). After P1.1 lands, SPRINTBOARD stays
  slim and git log is the changelog.

Start with Step 1 now and report back before Step 2.
