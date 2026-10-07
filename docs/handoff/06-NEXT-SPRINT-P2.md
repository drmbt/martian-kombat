# Next sprint — P2 leftovers: orphans, dev-server hardening, paid-job safety (handoff prompt)

Paste everything below the line into a new Claude Code session opened on
this repo. It is self-contained.

---

You're picking up **Martian Kombat** (Phaser 3 + TypeScript fighting game,
live at https://martiankombat.com, deployed by Cloudflare Workers Builds from
`main`). The last two PRs were P1 (truth-in-docs, PR #4: SPRINTBOARD is now a
short status board, CLAUDE.md slimmed, docs archived) and P8.6(a) (VO line
texts now come only from the character JSON, PR #5). Your sprint is **P2.6–
P2.10** in `docs/handoff/02-PLAN.md`: ship-weight orphans, the dev-server
security hole, paid jobs that silently re-spend, `.env`/mock consistency, and
`npm audit fix`. No gameplay or engine changes.

## Before you change anything

1. Work on **`fix/p2-cleanup-hardening`** (already created from `main` and
   pushed): `git checkout fix/p2-cleanup-hardening && git pull`. Never push
   to `main`; open a PR at the end and let the user merge. Preview:
   https://fix-p2-cleanup-hardening-martian-kombat.stayprompin.workers.dev
2. Read `CLAUDE.md`, `SPRINTBOARD.md`, then in `docs/handoff/02-PLAN.md`: §0
   (protocol), §2 (decisions — don't re-ask), §3 (guardrails), **P2.6–P2.10**,
   and the newest **Handoff log** entries.
3. Baseline: `npx tsc --noEmit && npx vitest run` (expect **514/514, 38
   files**) and `npm run bench` (expect **2 MKS-1 errors**, the known
   Vincent/Ben infinites).

## Scope (in this order; every item is tagged [A] or [V] — reproduce first)

1. **P2.7 dev-server hardening (security, do first).** One guard in the
   `editorApi()` plugin (`vite.config.ts`): localhost-only `Host`/`Origin`,
   `Content-Type: application/json` required, id validation on every path
   segment, escaped names in `roster.ts`/`stages.ts` writes, zip import
   confined to its own id. Accept: foreign Origin → 403, `text/plain` → 415,
   `../x` id → 400 (curl against `npm run dev`). Add a vitest for the guard
   function. Don't break the Studio: exercise one write (e.g. the Move Tuner
   WRITE) in the browser after.
2. **P2.8 job runner auto-resume.** Interrupted/queued jobs load as `paused`;
   resuming is explicit and character-scoped. Update `src/data/jobs.test.ts`.
3. **P2.9 `loadEnv` + mock.** Missing `.env` tolerated, `process.env` wins,
   quotes stripped; `/__editor/gen-frame` honours `MK_CREATOR_MOCK`; the
   direct ElevenLabs/Fish calls in `vite.config.ts` honour `MK_GEN_MOCK`.
   Accept: no `.env` + mock vars → creator flow and `studio:run --mock`
   finish with zero network calls.
4. **P2.6 orphans.** Move `public/assets/backgrounds/stages tall/` →
   `assets/stages-tall/` (KEEP it — D9 future art; fix the `ai-kitchn` typo;
   check `tools/gen-outpaint.mjs` / `stages-wide.mjs` for that path and
   update them), delete `stages/_old/`, `public/dev/glb-viewer.html`, the
   unused vanessa projectile (confirm no move uses it), 3D job/report
   sidecars. Then `npm run gen:assets` + `npx vitest run`.
5. **P2.10** `npm audit fix` (no majors; never Phaser 4).

## Rules that bite

- **No paid API calls** (D6), **no R2 writes** (`raw:push` — P8.17), never
  restore `assets/raw/jobs/`. Mock everything (`MK_GEN_MOCK=1`).
- Restart the dev server after every `vite.config.ts` edit.
- Before moving/deleting any file: `grep -rn "<name>" src tools .claude docs
  CLAUDE.md vite.config.ts package.json` and fix every hit.
- Tick the 02-PLAN boxes and add a Handoff-log entry **in the same commit as
  the work** — git log is the changelog.

## Verifying

`npx tsc --noEmit` · `npx vitest run` · `npm run bench` (2 errors) ·
`npm run build` leaves `git status` clean · the curl checks above · one
Studio write in the browser · the branch preview loads and plays a match.

## Done looks like

A PR from `fix/p2-cleanup-hardening` → `main` with P2.6–P2.10 ticked, a
dated Handoff-log entry, all checks green. Report to the user and stop: they
merge. Next after P2: **P3** (fight-core correctness, failing test first).
