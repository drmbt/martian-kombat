# Next sprint — P1 truth-in-docs & agent context diet (handoff prompt)

Paste everything below the line into a new Claude Code session opened on
this repo. It is self-contained; the agent should not need this
conversation.

---

You're picking up **Martian Kombat** (Phaser 3 + TypeScript fighting game,
live at https://martiankombat.com, deployed by Cloudflare Workers Builds from
`main`). The last sprint (PR #3, P6) fixed asset loading and memory: one
persistent asset loader, a prefetch that only warms the HTTP cache, alpha-cleaned
sheets (125 → 67 MB), content-versioned media URLs and immutable caching.
Your sprint is **P1: truth-in-docs & agent context diet**. It is a
**documentation-only** sprint: no gameplay, engine, asset or tool behaviour
changes.

**Why it matters:** every agent session is told to read `SPRINTBOARD.md`
first. That file is **3,763 lines / 260 KB** (~65k tokens) and mostly
history. `CLAUDE.md` is **461 lines / 30 KB** and still growing. Both carry
stale claims that have misled earlier sessions. The goal is that a fresh
agent can read what it needs in a few thousand tokens and trust all of it.

## Before you change anything

1. **PR #3 (`perf/p6-loading-memory`) must be merged first**: P1 rewrites
   files that PR touched. If `git log main` doesn't contain the P6 commits
   (`scenes: one persistent asset loader…`), stop and ask the user.
   Otherwise run `git checkout main && git pull` and create
   **`docs/p1-truth-in-docs`**. Never push to `main`; open a PR at the end
   and let the user merge.
2. Read, in order: `CLAUDE.md`; `docs/handoff/02-PLAN.md` §0 (protocol), §2
   (decisions; don't re-ask), §3 (guardrails), **P1** (all seven items), and
   the newest **Handoff log** entries. Skim `SPRINTBOARD.md` only by its
   headings (`grep -n "^##\|^###" SPRINTBOARD.md`) before reading any section.
3. Baseline, so you can prove nothing else moved: `npx tsc --noEmit &&
   npx vitest run` (expect **490/490, 37 files**) and `npm run bench`
   (expect **2 MKS-1 errors**: the known Vincent/Ben infinites).

## Scope (in this order)

The plan's P1 items carry audit-time line numbers (2026-10-04) that have
drifted. **Re-locate every claim by its text before editing it.**

1. **P1.1: shrink `SPRINTBOARD.md` to about 200 lines.**
   - Move the changelog (`## Changelog` at ~`:1524` to the end of its
     entries, 145 entries) **verbatim** to
     `docs/archive/CHANGELOG-2026-summer.md`.
   - Move completed Sprint 0–27 detail to
     `docs/archive/SPRINTS-2026-summer.md`.
   - The new board holds:
     - a 30-line-or-shorter TRUE status: 18 playable fighters + Kung Fu Man
       (secret), 27 stages, the modes, live URL, deploy flow;
     - a pointer: backlog → `docs/handoff/02-PLAN.md`;
     - the long-term RFEs, de-duplicated against 02-PLAN;
     - a pruned Icebox (drop items already shipped);
     - the handoff notes.
   - Fix the stale claims listed under P1.1 as you move them.
   - **Protocol change (part of P1.1):** "update the backlog checkboxes and
     the handoff notes in the same commit; **git log is the changelog**."
     Update every place that states the old per-commit-changelog rule:
     `CLAUDE.md` ground rule 1, 02-PLAN §0.7, the board's own header, and
     the skills (`grep -rn "changelog" CLAUDE.md docs/handoff .claude`).
     Until that commit lands, follow the old rule.
2. **P1.2: slim and correct `CLAUDE.md` (aim ~150–180 lines; it's
   `AGENTS.md` too, via symlink).**
   - Apply every fix listed under P1.2 (fighter count, `withBackoff`,
     rollback shipped, missing dirs, scenes, keys, commands).
   - The lazy-load section was already corrected by P6. Condense it to its
     invariants, and keep **verbatim** the rule that any runtime load from
     `public/assets/` goes through `assetUrl()` (media is cached
     `immutable`).
   - Move the long pipeline / Studio / concurrency detail out to
     `docs/ASSET_CHECKLIST.md`, the skills, `docs/CHARACTER_STUDIO.md` and a
     tools doc. Leave a one-line pointer for each.
   - Never drop a hard rule. Keep: ground rules, determinism, the KFM
     licence + generated-file rule, the MKS-1 bench gate, the
     no-R2-write / no-paid-generation rules, the coordinate contract
     pointer, dev-only tooling.
3. **P1.3: README.** The play link is already fixed. Make the rest true:
   - an 18-fighter table generated from `src/data/roster.ts` (KFM noted as
     secret);
   - the real modes;
   - remove unbuilt claims (Yulia rage meter, Freeman armor, "GPT Image makes
     stages");
   - the stack, including Cloudflare.
4. **P1.4: archive obsolete docs** into `docs/archive/` per the list in
   P1.4. Fold the named sections into `CHARACTER_STUDIO.md` first, and give
   it a built-vs-planned status header. Update `CHARACTERS.md` (tao/rj/ben,
   earl's shipped kit, haidai dropped). `MOVE_DURATIONS.md` is deleted, since
   `docs/FRAME_DATA.md` is the generated replacement.
5. **P1.5: purge the retired privacy opt-out language.** Accept:
   `grep -rn "opt-out" .claude docs CLAUDE.md` returns only archive hits and
   the CLAUDE.md line that records the retirement.
6. **P1.6: skills.** Replace `.agents/skills/` (a stale Codex mirror) with a
   symlink to `.claude/skills`. Fix the drift named in P1.6:
   - new-character's step list and VO source;
   - sprite-generation's reference chaining: label it studio-only;
   - sprite-qa's "fal" mention.
7. **P1.7: write `docs/DEPLOY.md`.** Cover:
   - Workers Static Assets (`wrangler.jsonc`, `not_found_handling: none`);
   - Workers Builds from `main` and the per-branch preview aliases;
   - `public/_headers`: media `immutable` because URLs carry `?v=<sha8>`
     (`src/data/assetUrl.ts` + `tools/gen-asset-manifest.mjs`), rules must
     not overlap, and the music `manifest.json` still revalidates;
   - `public/.assetsignore`;
   - the two R2 buckets (public `martiankombat-assets`, private
     `martiankombat-raw` via `raw:*`; no writes until P8.17);
   - `VITE_ASSET_BASE` (only on `feat/3d-mode`);
   - GitHub Pages: unpublished 2026-10-06 (P2.5); martiankombat.com is the only site.

## Rules that bite

- **Moving a doc breaks references.** Before you move or delete any file,
  `grep -rn "<filename>" src tools .claude docs CLAUDE.md vite.config.ts
  package.json` and fix every hit. Comments in `src/` and `tools/` cite
  `SPRINTBOARD`, `docs/CHARACTER_*`, `SPEC.md` and others. Editing comments is
  fine; changing code behaviour is not.
- **Verbatim means verbatim.** Archived changelog and sprint text is history.
  Move it with a script (`sed -n 'a,bp'`), never by retyping, and diff the
  line counts before and after.
- **Don't invent facts.** When a doc claims something, verify it against the
  code (roster, scenes in `src/main.ts`, `package.json` scripts, `.env.example`
  key names) before restating it. Never print `.env` values.
- No R2 writes (`raw:push`), no paid generation, no engine or asset changes.
  Kung Fu Man's files are generated: don't touch them.

## Verifying

- `npx tsc --noEmit` · `npx vitest run` (490/490) · `npm run bench`
  (2 errors) · `npm run build` leaves `git status` clean. The asset audit and
  bench must not notice that this sprint happened.
- A link check for moved docs: every relative `.md` link in
  `CLAUDE.md`, `README.md`, `SPRINTBOARD.md`, `docs/**/*.md` (excluding
  `docs/archive/`) and `.claude/skills/**` resolves to an existing file. A
  20-line node script is fine; don't commit it unless it's useful as a test.
- Report the before/after sizes: SPRINTBOARD and CLAUDE.md lines and KB.
  Also report the approximate tokens a fresh session must read under the
  new protocol.

## Done looks like

A PR from `docs/p1-truth-in-docs` → `main` with P1.1–P1.7 ticked in
02-PLAN, a dated Handoff-log entry (with before/after sizes), and all
checks green. Then report to the user and stop: they merge. Next in the
plan after P1: P2 leftovers (P2.6–P2.10), then P3.
