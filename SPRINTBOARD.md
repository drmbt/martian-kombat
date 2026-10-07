# Martian Kombat — Sprintboard

> **Protocol:** this board is the short, TRUE status + the agent handoff
> sheet. The working backlog is **`docs/handoff/02-PLAN.md`** — tick its
> checkboxes and update the handoff notes (here and/or 02-PLAN's Handoff
> log) **in the same commit as the work; git log is the changelog.** Don't
> duplicate 02-PLAN items here; new ideas go to the RFEs or the Icebox below.
> History (Sprints 0–28, the 2026-summer changelog, old handoff notes) lives
> in `docs/archive/SPRINTS-2026-summer.md` and
> `docs/archive/CHANGELOG-2026-summer.md`.

## Status (2026-10-06)

- **Live:** <https://martiankombat.com> — Cloudflare Workers Static Assets,
  built by Workers Builds on every push to `main`. Every pushed branch gets a
  preview at `https://<branch-with-dashes>-martian-kombat.stayprompin.workers.dev`
  (the "Workers Builds: martian-kombat" check links it). One branch + PR per
  sprint; the user merges. GitHub Pages was unpublished 2026-10-06. Details:
  `docs/DEPLOY.md`.
- **Roster:** 18 playable fighters (`src/data/roster.ts`): vincent, yulia,
  catherine, flo, freeman, gene, kirby, marzipan, bodhi, cat, chebel, ygor,
  rapha, vanessa, earl, ben, tao (arcade end boss), rj (Tao's hench goon).
  Each has a six-button kit, motion-input specials + techable throw, a
  fatality, win quotes, KO portrait and VO. Plus **Kung Fu Man** — the MUGEN
  reference fighter, a secret "???" unlock (real Elecbyte art, CC BY-NC ⇒ the
  game stays non-commercial while he ships).
- **Stages:** 27 (`src/data/stages.ts`), 16-bit pixel art, each with 3.5:1
  ultra-wide art under the SF2 pan-only scrolling camera (on by default).
- **Modes (title menu):** 1 VS CPU · 2 Two Players · 3 Online (WebRTC/PeerJS
  with rollback) · 4 Training · 5 Demo match · 6 Settings · attract-mode demo
  on idle · `7 DEV EDITOR` (dev builds only: Character Studio, stage-pin
  editor). 3D mode is frozen: dev or `?3d=1` only.
- **Health:** `tsc` clean · 490/490 vitest (37 files) · `npm run bench`:
  2 MKS-1 errors (Vincent `clp>lk`, Ben `clk>clp` infinites — 02-PLAN P4.3).
- **Plan progress:** P0 ✅ · MKS-1 Phase A ✅ · P1 ✅ (this branch) · P2
  2.1–2.5 ✅ · P3 3.1/3.2/3.10/3.11 ✅ · P4 4.0–4.2 ✅ · P6 6.1/6.2/6.3/6.5/6.6
  ✅ · P9.1 ✅. **Next:** P2.6–P2.10, then P3. Status table: 02-PLAN §1.

## Backlog

→ **`docs/handoff/02-PLAN.md`** (phases P1–P12, decision gates D1–D10 and
the user's recorded answers, guardrails, dated Handoff log).

## Long-term RFEs (not in 02-PLAN; unscheduled)

Already tracked in 02-PLAN, so not repeated here: arcade mode (P10.1), hit-
spark library wiring (P10.2), stage music (P10.3), flow polish (P10.4),
online hardening (P10.5), the content regen backlog incl. marzipan/bodhi
cells and more Martians (P10.6), combat primitives — per-phase hurtboxes,
multi-hitboxes, priority, invuln classes incl. throw protection, super
meter + supers, `ff`/dash motions, air tech, rage meter, tilts/air specials/
wall-kicks/armor (P10.7), MUGEN content import (P10.8), training tools and
CPU matchup matrix (P10.9), CPU difficulty (P5), Character Studio platform
(P12), 3D (P11).

- [ ] **Bonus stages** — SF2-style item-break interludes between arcade
      fights (car-smash homage first).
- [ ] **More unlockable hidden characters** — town fighters (Anderson,
      Puddles, …) unlocked through play; the Kung Fu Man "???" tile is the
      seam (`src/data/unlocks.ts`).
- [ ] **Per-character double jump** — a character-JSON flag, no
      per-character engine code.
- [ ] **Veo motion smoothing** — sampled motion-clip frames instead of
      keyframes; the biggest visual-quality lever.
- [ ] **Frame-trail / afterimage** on high-velocity attacks (render-side).
- [ ] **Replace install-style moves** (declined plumbing) with catalog
      archetypes: Gratitude (Vanessa), Microdose (Ygor), Breathwork/Presence
      (Freeman).
- [ ] **Use the built `du` / `mash` archetypes in more kits** (data only).
- [ ] **Better blocking feel** — proximity guard, block-release timing.
- [ ] **Round-intro walk-ins / poses** and an in-fight victory pose.
- [ ] **Post-fatality flow** — resolve back through the fight screen
      instead of cutting straight to the win screen.
- [ ] **Attract-mode text** — "INSERT COIN" and "DEMO — PRESS ANY KEY"
      blink out of phase; merge, sync or drop one.
- [ ] **Sound priority + cooldowns** (multi-hit clouds stack into mush) and
      a counter-hit sound.
- [ ] **Clash/tech feedback** — projectile clashes vanish silently; add a
      spark + sound; give throw techs their own flash.
- [ ] **CRT/scanline filter** toggle in Settings.

## Icebox (do not start)

- Attract-mode gag reels (3D: Mixamo dance clips between demo fights).
- Stage interactables.
- Armored / vault dashes, backdash i-frames.
- Gamepad rumble.
- RANDOM tile on character select (stage select already has one).
- Persistent win/loss stats.
- Per-character victory song (`victorySong` in the character JSON overriding
  the random `music/victory/` pick).
- *Declined, don't re-propose:* proximity normals (close/far variants, art
  cost); camera zoom (D9: pan-only).

## Agent handoff notes

**Current:** P1 truth-in-docs is done on `docs/p1-truth-in-docs` (PR open;
the user merges). Next session: P2.6–P2.10 (02-PLAN), then P3. The dated
session log is 02-PLAN's **Handoff log**; this section keeps only standing
landmines.

**Standing landmines (still true):**
- Any new runtime load from `public/assets/` must go through `assetUrl()`
  (media is cached `immutable`). Run `npm run gen:assets` (or
  `npm run build`) after changing media; `npx vite build` skips the
  prebuild and ships stale versions.
- MKS-1 ratchet: after fixing a balance error, `npm run bench --
  --update-baseline` in the same commit, or `balance.audit.test.ts` fails.
- `kfm.json` is generated (`npm run mugen:sprites`); edit
  `src/bench/reference/kfm.unlock.json` instead. Raw MUGEN content is
  gitignored (`npm run mugen:fetch`) and never goes to R2.
- No `raw:push` (R2 writes) until P8.17 makes it no-clobber. No paid
  generation without a D6 go-ahead. Never restore `assets/raw/jobs/` before
  P2.8 (the job runner auto-resumes paid jobs).
- `assets/raw/frames/<id>/` dirs with a `.cellspace` marker (vincent, earl,
  ben) hold KEYED cell-space art — the packer copies them through; never
  re-key or re-pad.
- Every fight flag must pass through VersusScene AND fightShell's
  restart/select routes (they re-enumerate payloads).
- The UiLayer root is `pointer-events:none`; a new DOM panel must opt back in
  or its buttons are dead to real mice (JS `.click()` hides this).
- `tools/*.mjs` that both export and execute must guard `main` (import-safe).
- Restart the dev server after `vite.config.ts` edits (the `/__editor/*`
  endpoints live there).
- vite-node can't load scripts outside the repo root (put throwaway scripts
  in `tools/fg/` and delete them).
- The hidden desktop browser pane gives no animation frames: drive Phaser
  with `__game.step(t, 16.7)` from a `setInterval`, probe via `window.__game`.
