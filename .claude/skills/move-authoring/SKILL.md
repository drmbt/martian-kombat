---
name: move-authoring
description: How to design a balanced Martian Kombat fighter's move set and write the character JSON against the engine's ACTUAL plumbing — the catalog of supported special-move archetypes (SF2/MK grammar) with their JSON shapes, which archetypes are NOT yet built, the coordinate/input conventions, and the SF2 character templates. Use when creating or editing a character's moves/specials/hitboxes in src/data/characters/, mapping a fighter concept to a kit, or deciding whether a move needs new engine code.
---

# Move authoring — design a kit on real plumbing

Characters are pure data (`src/data/characters/<id>.json`); adding one never
touches engine code — **as long as every move maps to plumbing that already
exists.** The cardinal error is designing a move whose mechanic isn't built
(e.g. an "install" buff) and discovering it at wiring time. Check this catalog
first; if a move needs a mechanic marked ❌, either pick a different archetype or
flag it as an explicit engine task.

## Input grammar (SF2 + MK), and what the engine supports

`Motion` = `'qcf' | 'qcb' | 'bf' | 'cbf' | 'dp' | 'hcb' | 'hcf' | '360' | 'du'`.
`button` = `'punch' | 'kick' | 'PPP' | 'KKK' | 'LPLK'`. Or `input.mash: N` (no
motion — N fresh presses of a button class).

- **qcf** ↓↘→ = offensive special (fireballs, advancing)
- **dp** →↓↘ = anti-air / reversal
- **qcb** ↓↙← = advancing / teleport / lob
- **bf** back→forward (sequence, NOT a held charge) = rush / horizontal
- **cbf** hold ← then → (TRUE charge, `CHARGE_TICKS`) = SONIC BOOM / charge projectile ✅
- **du** hold ↓ then ↑ (TRUE charge, `CHARGE_TICKS`) = FLASH KICK / charge anti-air ✅
- **hcb / hcf** half-circles = command grabs, bigger specials
- **360** full circle = command grab
- **Forward-forward (ff) is NOT a special trigger** (dashes are double-tap
  movement only) — ❌.

The grammar: quarter-circle = offense, DP = anti-air, `cbf` = charge projectile
(sonic boom), `du` = charge vertical (flash kick), `bf` = horizontal rush,
mash = sustained, 360/hcb = grab. Both charges bank a facing-relative hold
(`f.backCharge` / `f.charge`) for `CHARGE_TICKS`, then fire on the opposite +
button — the whole held-charge control the creator's Sonic-boom / Flash-kick
archetypes emit.

## The plumbing catalog (✅ build with these) — field → JSON shape

All boxes are `{x,y,w,h}` in engine origin space: **x forward from center
(x=144 px in the 288-wide cell), y up from feet (feet = 0.95×384 = 365), facing
right.** `worldBox`: `l = f.x + box.x`, `t = f.y + box.y`. Every move has
`startup/active/recovery/damage/hitstun/blockstun/knockback/height` + optional
`variants:{l,h}` (L/M/H, merged over the base).

- **Straight projectile (fireball)** — `hitbox:null`, `projectile:{vx,spawnX,
  spawnY,box,damage,hitstun,blockstun,knockback,ttl}`. Optional render-only
  `renderSize` (px, square draw size; FightScene falls back to PROJ_SIZE[moveId]
  then 72 — the character creator writes it from its projectile-size slider,
  scales with `def.scale`). (gene mana-burst)
- **Anti-air reversal (DP)** — `dp`+P, tall `hitbox`, `invuln:N`, `knockdown`,
  `leap:{vx,vy}` (rises at first active frame). (vincent rising-glyph)
- **Advancing / hurricane** — `forwardVel:N` (forward drift over startup+active),
  optional `projImmune`. (vincent cloud-hands)
- **Horizontal rush / torpedo** — `bf`+P, `forwardVel` (high), `hitbox`,
  `knockdown`. (vanessa euc-crash)
- **Charge projectile (sonic boom)** — `cbf`+P, `hitbox:null`, `projectile:{…}`.
  Hold back to charge, then forward. The projectile persists independently after
  the move recovers (dies only on screen-exit / TTL / hit).
- **Charge vertical (flash kick)** — `du`+K, `leap`/`vault`, `invuln`.
- **Mash / rapid-tap** — `input:{button,mash:N}`, `hitbox`, often `rehit`.
- **Command grab** — `360` or `hcb`+P, `grab:{range}`, `damage`, `knockdown`,
  optional `grabRecoil`, `heal`. (catherine order-up / claw)
- **Universal throw** — `input:{button:'LPLK'}`, `grab:{range}`, `techable:true`.
  EVERY character gets one.
- **Teleport** — `teleport:{mode:'behind'|'retreat'}`, `invuln`. `behind` = cross
  to the far side (cross-up); `retreat` = snap to own corner. (gene diffusion)
- **Lobbed arc → lingering cloud** — `projectile:{vx,vy(neg=up),gravity,box,
  rehit,ttl}` (survives hits, ticks every `rehit`). (marzipan spore-bloom)
- **Fuse + detonate (delayed blast)** — `projectile:{vx,fuse,detonate:{box,
  damage,ttl}}`. (gene hallucination, flo fork-bomb)
- **Stationary trap** — `projectile:{vx:0,ttl,rehit}` (sits and bites).
- **Slow / zoning field** — `projectile:{vx:0,field:true,slowFactor,ttl}` (never
  collides; slows enemy shots). (ygor oracle)
- **Pull ("get over here")** — `projectile:{pull:true,knockdown}`. (marzipan
  vine-spear)
- **Multi-projectile fan** — `projectile:{count:N,spreadVX,spreadY}`. (catherine
  mise-en-place)
- **Reflector** — `reflect:true` (bounces enemy projectiles startup+active).
- **Vault / launch** — `vault:{vx,vy}` (launch airborne at first active).
- **Yoga float** — `float:{vy,gravity,vx?}`.
- **Short-range flame/cone** — a straight `projectile` with small `ttl`.

## NOT yet built (❌ — needs engine work; do not author as if present)

- **Install / buff / stance** (empower next special, timed speed/armor buff).
- **Rekka** (chainable multi-part special).
- **Forward-forward (ff)** special trigger.
- **Armor / hyper-armor** (absorb a hit mid-move).
- **Air command-specials / dives** (air normals + `float` exist; a special fired
  in the air is unverified — treat as a gap).
- **Air-throws** (grab currently hard-requires `grounded(d)` in step.ts — no
  eligibility flag to relax it).
- **Side-switch / over-the-shoulder throw** (icebox, 2026-07-05: not "push
  them back," but reposition the victim to the attacker's far side on
  connect — a throw-flavored cross-up). Nobody has one yet. Cheap to add
  when wanted: facing already auto-corrects toward the opponent every tick
  (`f.facing = o.x > f.x ? 1 : -1`), so swapping the victim's x past the
  attacker at throw-connect (same moment `toss` applies velocity today) is
  the whole trick — no new facing logic needed. Reuses the position-swap
  idea already proven by `teleport:{mode:'behind'}`.

If a concept needs one of these, either substitute an archetype from the catalog
or open it as an explicit deterministic-core engine task (with a vitest, per the
determinism rules) — never fake it in JSON.

## Character templates → required kit (all buildable today)

| Template | Kit pieces (all ✅) |
|---|---|
| Balanced hero | fireball, DP anti-air, advancing special, throw |
| Zoner | fireball, lob/trap/field for keep-away, teleport OR DP, throw |
| Grappler | command grab (360/hcb), a rush or reflector to close, throw |
| Rushdown | forwardVel advancing string, fast normals, throw |
| Trap / setplay | stationary trap + fuse/detonate, a projectile, teleport, throw |
| Mobility trickster | teleport, vault/float, a projectile, throw |
| Bruiser / tank | big slow hitboxes, command grab, throw |

## Author flow (do this order)

1. **Fuzzy-search the Martian Lore sheet by the character's name** (see the
   new-character skill for the CSV-export workflow) and read `docs/CHARACTERS.md`
   /`docs/MOVES.md` — the running jokes, props, and archetype drive the kit so it
   reads as *the actual person*. Respect the **privacy opt-out** column.
2. Pick a template, then map each kit piece to a catalog archetype above.
3. Start hitboxes/ranges from the CANONICAL POSE SKELETON (run the sprite-qa
   pose pass on the canonical) — estimate boxes from where the limbs are, not
   guesses.
4. After frames generate, run sprite-qa and snap the active-cell hitboxes to the
   pose-measured values (confidence-gated).
5. `npm run test` — every engine behavior a move relies on must already be
   covered; if you touched the engine, ship a vitest.
