> **SUPERSEDED (archived 2026-10-04).** Original output of the 2026-10-04 audit session, kept verbatim for provenance. The live documents are `docs/handoff/01-OLD-MACHINE-PASSOFF.md`, `docs/handoff/02-PLAN.md` and `docs/handoff/03-NEW-MACHINE-RESUME.md`. Do not work from this file.

# Next-session kickoff prompt (run on the NEW machine)

> **Prerequisites:** (1) `01-RESCUE-old-machine.md` has been run on the
> original machine and pushed; (2) you've copied that machine's `.env` into
> this repo's root over a private channel. Then open Claude Code here and
> paste everything below the line.

---

We're resuming Martian Kombat after a ~3-month gap, on a new machine. A full
audit was done on 2026-10-04. Its output is the working backlog:
**`docs/handoff/02-REMEDIATION-PLAN.md`**. Read its §0 (session protocol),
§1 (status), §2 (decision gates) and §3 (guardrails) fully before doing
anything, then skim the phases. Until phase P1 restructures it, that plan
supersedes the "Current"/handoff sections of `SPRINTBOARD.md`. You don't
need to read the whole 250 KB SPRINTBOARD; consult specific sections only
when an item points at them.

## Step 1 — P0 (restore + baseline)

1. `git pull`. Read `docs/handoff/RESCUE_REPORT.md` (written by the rescue
   on the old machine). If it doesn't exist, stop and tell me.
2. Check `.env` exists. Report key NAMES that are set/empty vs the
   RESCUE_REPORT checklist. **Never print values.**
3. `brew install rclone` if missing → `npm ci` → `npm run raw:pull` →
   `npm run raw:verify` (must be 0 mismatches). Confirm `assets/raw/jobs/`
   was NOT restored. Confirm every roster fighter has its canonical anchor
   (`assets/raw/canonical/<id>.png`, or the painted style-test for
   vincent/yulia).
4. Baseline: `npx tsc --noEmit`, `npx vitest run`,
   `npx vite build --outDir /tmp/mk-dist`. Compare against the plan's §1
   facts (379 tests; main chunk 2,017 KB min / 498 KB gz).
5. `git status --untracked-files=all` and `git log --oneline -15`: find out
   whether the parallel MUGEN/IKEMEN parity work (`src/compat/mugen/`,
   `docs/FIGHTING_STANDARDS.md`) was committed, and summarize it for me
   (P0.4). Don't touch it.

## Step 2 — Get the decisions out of the way in one go

Ask me, in a single multiple-choice round, the decision gates from §2 that
block near-term work. Give your recommendation for each:
- **D7:** deploy/branch policy: does `main` auto-deploy? PR per phase? Unpublish GitHub Pages?
- **D5:** 3D: freeze / delete / ship.
- **D3:** game vs platform.
- **D4:** touch-controls scope.
- **D1:** voice-inspo/photos exposure in the public repo.

Leave **D2** (history rewrite) and **D6** (API spend) until they're needed.
Record my answers in the plan's §2 table and the Handoff log.

## Step 3 — Execute the plan

- Order: **P1 → P2 → P3 → P4 → P5 → P6**, then P7/P8, then P10.
  P1 and P2 are independent. P3 must first reconcile with the MUGEN parity
  work.
- **Git:** one branch + PR per phase (`fix/p2-player-traps` etc.). Branch
  each phase from `main` unless it truly depends on an unmerged one. Small
  scoped commits (CLAUDE.md conventions). Don't push to `main` or
  force-push without my OK.
- **Per item:** re-verify first ([A] items especially). For engine/data
  fixes, write the failing vitest first, then fix. After each item, run
  `tsc` + `vitest`. For UI items, verify in the browser preview: probe
  `window.__game` state, because the pane throttles when hidden.
- **Parallelism is fine:** independent phases (e.g. P1 docs vs P3 engine)
  can go to subagents in separate worktrees. Keep each PR reviewable (aim
  for < ~600 changed lines excluding moved docs).
- **Ask before any:** paid API call (D6, with an estimated count), branch
  deletion, history rewrite, GitHub/Cloudflare setting change, or
  regeneration of committed art.
- **End of each session:** tick boxes in `02-REMEDIATION-PLAN.md` and
  append a Handoff log entry (done / next / gotchas). After P1.1 lands,
  SPRINTBOARD stays slim: no per-commit changelog, since git log is the
  changelog.

Start with Step 1 now and report back before Step 2.
