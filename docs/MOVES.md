# Martian Kombat — Move System Bible

> **This document is the prompt.** Edit it in plain English; the buildout will
> implement exactly what's written here. Nothing in this file changes the
> codebase by existing — it is design only, to be edited then executed.
> Anything marked ⚙ NEW is a mechanic the engine doesn't have yet and will be
> built when its first character needs it.

---

## 1. System rules (the SFII Turbo paradigm)

### 1.1 Button-variant specials (L/M/H)
Every special can be performed with **Light, Medium, or Heavy** (of its punch
or kick class), and the button changes the move — speed, range, damage,
travel, recovery. The classic trade: **L = fast/safe/short, H = slow/strong/
far (or the reverse for mobility moves: H = less travel, more damage)**.
Each special below defines its own L→H axis in one line.
**Status: ✅ implemented** (`variants: {l,m,h}` per special; the triggering
button's strength selects the patch).

### 1.2 Universal basics (every character)
- 6 buttons: LP/MP/HP + LK/MK/HK, each with stand / crouch (↓+button) / air
  (jump+button) versions. *(exists)*
- Block: hold back; crouch-block for lows; overheads (air attacks) must be
  blocked standing. *(exists)*
- Chip damage on everything but lights; chip can't KO. *(exists)*
- **Forward dash**: double-tap forward. *(exists)*
- **Back-dash / evade**: double-tap back — a quick, slightly evasive hop with
  brief low-invulnerability. *(exists as a slide; ⚙ NEW: i-frames)*
- **Jump-back**: up-back already works; some characters get modified jumps
  (float, high arc, wall jump) noted per character.
- **Universal throw** (*✅ implemented, Sprint 17*): **LP+LK pressed together**
  (a cross-class chord; staggered presses within a few ticks upgrade the lone
  jab/short into the throw, same kara rule as PPP/KKK). Close range only,
  **unblockable**, grounded-vs-grounded only — whiffs on airborne, hitstunned,
  blockstunned, or launched victims (no throw loops, no ticking a reeling
  opponent). Knocks down. **Teching:** the grabbed player pressing their own
  LP+LK inside a ~12-tick window escapes it — both bounce apart through a
  short recoil, nobody takes damage. Damage sits between a medium and a heavy
  (85 base; Yulia 100 — grappler tax) with range ~105 (Yulia 115), well under
  every command grab: it's a guard-mixup tool, not a combo starter. Victim
  art reuses hit/fall/down cells; only the attacker has bespoke
  `throw-startup/-active/-recovery` cells. In the JSON it's an ordinary
  `MoveDef` named `throw`: `input: {button:'LPLK'}` + `grab: {range}` +
  `techable: true`, declared LAST so motion specials keep pick priority.
- **Dizzy/stun** (*✅ implemented, Sprint 17*): every **connecting** hit (never
  a block) adds its damage to the victim's `stun` meter, which decays 0.5/tick;
  crossing 250 forces a helpless `dazed` spell (~3s, fully vulnerable, can't
  act or block, circling-stars overlay) once the current reel/knockdown ends.
  The meter resets when the daze expires or the punish lands — no
  double-dizzies. Throwing a dizzied victim is the intended punish path.

### 1.3 Input vocabulary
| Notation | Meaning | Engine status |
|---|---|---|
| qcf | ↓ ↘ → + button | exists |
| qcb | ↓ ↙ ← + button | exists |
| b,f | ← then → (dash motion) | exists |
| dp | → ↓ ↘ (dragon punch) | ✅ exists |
| hcb / hcf | half circle | ✅ exists |
| charge b,f / charge d,u | hold 2s, then opposite + button | ⚙ NEW |
| 360 | full circle + button | ✅ exists (simplified: ↓+←+→ inside the window — the practical "270") |
| 3P / 3K | all three punches / kicks together | ✅ exists (2+ of the class pressed together) |
| LP+LK | universal throw chord (cross-class) | ✅ exists (`input.button: 'LPLK'`) |
| mash P/K | repeated presses sustain the move | ⚙ NEW |

### 1.4 Move role taxonomy (cover these per character)
**Projectile** (zone) · **Anti-air** (swat jumps, i-frames) · **Mobility**
(advance/escape/cross-up) · **Command grab** (unblockable, grapplers) ·
**Defensive** (counter, armor, reflector, install) · **Trap/Field** (delayed
or lingering hazards).

### 1.5 Unique-basics menu (assign sparingly, 1–2 per character)
Slide (crouch MK or HK travels forward, hits low) · Float jump (low gravity
hangtime) · High/short jump arcs · Wall jump · Blink back-dash (teleport
instead of hop) · Armored dash · Crawl · Double jump · Hover/glide.

### 1.6 Fatalities
One per character, triggered in the FINISH THEM window (scaffolding exists;
Yulia's Heart Breaker is the template — 4 generated panels, generic burnt-husk
victim so any opponent works). Panel prompts live in `tools/gen-fatality.mjs`.

---

## 2. The Eight (current roster)

### VINCENT — "The Cloakwright" · Shoto (Ryu)
The measuring stick. Honest tools at every range.
- **Basics:** standard everything; crisp walk speed.
- [x] **Sigil Bolt** — qcf+P · projectile *(exists)*. L: slow drifting orb ·
  M: standard · H: fast bolt. One on screen.
- [x] **Rising Glyph** — dp+P · anti-air ⚙ NEW (dp motion, i-frames). Teal glyph
  uppercut. L: short & safe · H: full launch, more damage, more whiff risk.
- [x] **Cloud Hands** — qcb+K · mobility strike (rework of current qcb+P
  version). Advancing triple-palm flow that glides over lows (hurricane-kick
  analog). L: one palm, short · H: three hits, ~half screen.
- [x] **Redirect** — qcb+P · defensive reflector. Push-hands parry stance;
  reflects projectiles back as wireframes; L/M/H = stance duration.
- **Matrix Teleport** — qcf+K · mobility ⚙ Sprint 20. Dissolves into
  falling runes (invulnerable) and reappears behind the opponent.
- [x] **Fatality — "Blue Screen":** he traces a full sigil circle; the opponent
  disintegrates row-by-row into cascading wireframe/code.

### YULIA — "Volga Fury" · Grappler (Zangief)
Slow, terrifying, wants to be inside your guard.
- **Basics:** slowest walk, highest jump; no slide. [ ] forward dash armor
  (⚙ NEW armor — deferred with the rage meter).
- [x] **Cossack Spiral** — b,f+K · mobility strike *(exists)*. **L: fast, most
  travel, least damage · M: balanced · H: barely moves, hits like a truck,
  hard knockdown** (the user's canonical example — implement exactly this).
- [x] **Volga Piledriver** — 360+P · command grab ⚙ NEW. Unblockable, huge
  damage. L: short range · H: more range & damage, slower.
- [ ] **ENOUGH.** — hcb+K · running command grab ⚙ NEW. Dashes in and slams;
  requires rage ≥ 50% (rage meter from CHARACTERS.md, ⚙ NEW).
- [x] **Backbend Guillotine** — qcb+K · overhead *(exists)*. L: faster, less
  damage · H: slower, bigger arc, knockdown.
- [x] **Braid Lariat** — 3P · defensive spin ⚙ NEW. Upper-body projectile
  immunity while active (Zangief lariat).
- **Spinning Star Kick** — charge d,u+K · advancing multi-hit ⚙ Sprint 20
  (melee-rehit). Inverted helicopter spin that travels; L/M/H = distance
  and hit count.
- [x] **Fatality — "Heart Breaker"** *(shipped)*.

### CATHERINE — "The Chef de Guerre" · Weapon mid-range (Rolento / Chun hybrid)
Longest pokes in the game; the staff is never not in her hands.
- **Basics:** [ ] unique forward dash = **staff-vault hop** (deferred; Staff
  Vault the special covers the role). [x] slide on crouch HK (staff sweep now
  travels forward).
- [x] **Mise en Place** — qcf+P · projectile *(exists)*. **L: 1 knife, fast ·
  M: 2 knives · H: 3-knife fan, slow, spread** (button = knife count).
- [x] **Order Up! (Jazzper)** — qcb+P · low projectile *(exists)*. L: Jazzper
  stops ⅓ screen · M: ⅔ · H: full screen. Must be crouch-blocked.
- [x] **Staff Vault** — dp+K · mobility ⚙ NEW. Pole-vault arc; L: hop in place
  (evade lows) · M: over mid-range · H: full cross-up over the opponent.
- [x] **86'd** — hcb+K · command grab ⚙ NEW. Staff-vault kick off their chest;
  she bounces away to safety after.
- [x] **Fatality — "Dinner Service":** knives pin the opponent; she plates the
  result with a sprig of garnish; Jazzper drags it off-screen.

### FLO — "Kernel Panic" · Trap zoner (Dhalsim's patience, Blanka's menace)
Wants you standing exactly where the traps are.
- **Basics:** lanky rangy normals; backdash is a grumpy shuffle (extra
  distance); no slide.
- **Fork Bomb** — qcf+P · lobbed trap projectile. Laptop arcs and detonates
  into terminal windows after a beat. L: lands close · M: mid · H: far.
- **Smokescreen** — qcb+P · field. Spliff exhale hides Flo and his moves.
  L: small puff, brief · H: wall of smoke, lingers.
- **Root Access** — charge d,u+K · trap anti-air ⚙ NEW (charge). Floor cable
  snares and pops the opponent up. Button = distance in front.
- **sudo kill** — hcf+P · close blast ⚙ NEW (hcf). Short-range terminal
  flame-out (Yoga Flame analog) to punish rushdown.
- **Blunt Puff** — qcf+K · lingering projectile ⚙ Sprint 20. A fat smoke
  ring drifts slowly forward, tick damage while it hangs. L: short hang ·
  H: faster drift.
- **Fatality — "Burn One":** lighter out — the husk goes up in flames,
  the ash gets rolled into an enormous cigarette, and he smokes it.
  (Replaced "rm -rf /", Sprint 20.)

### FREEMAN — "The Still Point" · Charge fighter (Guile)
Two perfect tools and infinite patience.
- **Basics:** slow serene walk; **float jump** (long meditative hangtime);
  no forward dash — he doesn't hurry.
- **Prana Boom** — charge b,f+P · projectile ⚙ NEW (charge). A mantra ring
  with near-instant recovery; walks calmly behind it. L/M/H = speed.
- **Lotus Flash** — charge d,u+K · anti-air ⚙ NEW. Rising lotus backflip,
  i-frames. The hard "do not jump at me" answer.
- **Presence** — qcb+P · counter ⚙ NEW (counter-stance). If struck during
  the pose, he's suddenly behind you, palm extended. L/M/H = stance length.
- **Breathwork** — 3P · install ⚙ NEW. Absorbs exactly one hit (armor) while
  the calm lasts.
- **Yoga Float** — qcb+P · mobility ⚙ Sprint 20 (slow-fall primitive).
  Lotus-position high jump with a drifting descent; air normals stay live
  the whole way down.
- **Fatality — "Ego Death":** one exhale; the opponent comes apart into
  drifting petals of light, leaving only their outline sitting in lotus.

### GENE — "Prompt Injection" · Teleport trickster (Dhalsim / Seth)
Nothing he shows you is necessarily real.
- **Basics:** **blink back-dash** (short teleport instead of a hop);
  glitch-float on jump descent (hold up ⚙ NEW).
- **Hallucination** — qcf+P · fake projectile. A glitchy clone walks forward
  and pops. L: slow shamble · H: sprints. Clashes with real projectiles.
- **Diffusion** — dp+3P / dp+3K · teleport ⚙ NEW. Dissolves into denoising
  static; P = reappear behind opponent, K = retreat to the corner.
- **Rate Limit** — qcb+P · field. A "429" zone that slows enemy projectiles
  and dashes inside it. L/M/H = field size.
- **Prompt Injection** — hcb+K · gimmick grab ⚙ NEW. Mind-hack touch:
  briefly reverses the opponent's left/right inputs.
- **Mana Burst** — bf+P · projectile ⚙ Sprint 20. A magenta orb stamped
  with the Eden Art Labs logo. L/M/H = speed.
- **Fatality — "404":** the opponent compresses into JPEG artifacts, then a
  dialog box: `fighter not found`. It gets clicked away.

### KIRBY — ⟪ REFACTOR PENDING — old kit retired ⟫ · Speed rushdown (Chun-Li)
**No teacup. No fire from the mouth.** (Frames deleted; sheet regenerates
from whatever this section says when edited.) Working proposal, contortion +
gossip themed:
- **Basics:** fastest walk in the game; **wall jump**; slide on crouch HK.
- **Lightning Gossip Legs** — mash K · flurry ⚙ NEW (mash). A blur of
  impossible-angle kicks while she looks bored.
- **Scorpion Wheel** — qcb+K · mobility. Advancing contortion cartwheel over
  lows. L: one rotation · H: full-screen wheel.
- **Rumor Mill** — qcf+P · short projectile. A whispered rumor as a visible
  ripple that travels ⅓ screen and rattles (brief stun, low damage).
- **Backbend Bridge** — dp+K · anti-air/evade ⚙ NEW. Drops into a bridge
  under attacks, then snaps up into an overhead flip kick.
- **Cat Scratch** — mash P (5 presses) · rapid multi-hit ⚙ Sprint 20
  (mash-input + melee-rehit primitives). Lightning-legs claw flurry;
  chips through block, scales as a combo.
- **Fatality — "The Last Word":** she whispers something we never hear; the
  opponent's soul visibly leaves their body out of sheer embarrassment.

### MARZIPAN — "Photosynthesizer" · Summoner zoner (Dhalsim's garden)
Controls the battlefield; the battlefield is alive.
- **Basics:** **float jump** (drifts like a seed); no dash — a rooted step;
  unique slide on crouch HK (kudzu slide).
- **Overgrowth** — qcf+P · delayed trap/anti-air. Plants a seed; a vine
  column erupts one beat later. L: at her feet · M: mid · H: far.
- **Spore Bloom** — qcb+P · field. Drifting mushroom cloud, slow tick
  damage. L/M/H = drift distance.
- **Symbiosis** — hcb+P · command grab ⚙ NEW. Kudzu-wrap; drains health and
  **heals her** for a portion.
- **Photosynthesis** — 3P · install ⚙ NEW. Stands in sunlight; slowly
  regenerates while not moving (cancelled by any action).
- **Vine Spear** — bf+P · pull projectile ⚙ Sprint 20 (pull primitive).
  "Get over here": unblocked hit drags the victim to his feet into a
  knockdown; blocked is plain pushback. L: short reach · H: faster.
- **Fatality — "Compost":** vines pull the opponent gently into the earth;
  a single desert flower blooms where they stood. She waters it.

---

## 3. The Next Eight (no photos/icons yet — kits ready for when they arrive)

### HAI DAI — Balinese monk, tai chi, Raiden energy · Mobile shoto-plus
- **Basics:** temple float (brief hover at jump apex); serene fast walk.
- **Thunder Palm** — qcf+P · projectile. A slow orb of storm-light; L/M/H = speed.
- **Torpedo** — b,f+P · flying mobility strike (Raiden superman dash).
  L: half screen · H: full screen, knockdown, big whiff recovery.
- **Storm Step** — dp+3K · teleport ⚙ NEW. Vanishes in a thunderclap,
  reappears airborne above the opponent.
- **Rising Knee of the Temple** — dp+K · anti-air with i-frames.
- **Fatality — "Cloudburst":** calls one precise lightning bolt; reuses the
  burnt-husk asset; rain falls only on the husk.

### LUCY — violent feminist fintech, ramen · Rushdown with reach
- **Basics:** aggressive dash (longest in game); slide on crouch MK.
- **Noodle Whip** — qcf+P · mid-range lash (stretchy-limb analog). L: fast
  poke · H: full-noodle reach, slow.
- **Hostile Takeover** — b,f+K · dash grab ⚙ NEW. Closes and slams; L/M/H = distance.
- **Market Crash** — charge d,u+P · anti-air ⚙ NEW. A red candlestick chart
  spikes up under the airborne opponent.
- **Chopstick Pin** — dp+P · counter ⚙ NEW. Catches a limb mid-attack and
  pins it; free follow-up.
- **Fatality — "Liquidation":** the opponent sinks into a giant ramen bowl;
  chopsticks descend; the broth goes still.

### BODHI — pacifist bodyworker, Thai massage · Pacifist grappler
Hurts you therapeutically. All his grabs look like treatments.
- **Basics:** no forward dash (walks with intention); float jump-back.
- **Deep Tissue** — 360+P · command grab ⚙ NEW. "You hold a lot of tension."
  Massive damage, and **he audibly apologizes**.
- **Pressure Point** — hcb+P · stun touch ⚙ NEW. Low damage, long stagger.
- **Palm Wave** — qcf+P · zero-damage push. Enormous pushback; corner tool.
- **Grounding Breath** — 3P · armor install (one hit).
- **Fatality — "Total Release":** a final adjustment; the opponent's
  skeleton aligns in a glow, they exhale, and ascend. Peaceful. Weirdly the
  most unsettling fatality in the game.

### VANESSA — pottery, clay heads, maroon witch, red-riding-hood · Trap zoner
- **Basics:** cloak blink back-dash; slow spooky walk.
- **Thrown Vessel** — qcf+P · rolling projectile. A clay head rolls along
  the ground (low). L: short roll · H: full screen.
- **Kiln Blast** — hcf+P · close flame cone ⚙ NEW (Yoga Flame analog).
- **Little Helper** — qcb+P · trap. Places a clay head that bites the first
  thing that steps on it. Two may exist at once.
- **Red Veil** — dp+3P · teleport ⚙ NEW. The hood drops; she's elsewhere.
- **Fatality — "Fired & Glazed":** the opponent stiffens into greenware,
  glaze washes over them, and they shatter on the kiln floor.

### LYOSHA — fit flexible Russian, banya spa · Charge fighter (Guile body, Blanka soul)
- **Basics:** slide on crouch HK (wet spa tiles); backflip evade.
- **Steam Boom** — charge b,f+P · projectile ⚙ NEW. A rolling wall of steam
  with instant recovery.
- **Venik Flash** — charge d,u+K · anti-air ⚙ NEW. Somersault strike with a
  birch-branch swat at the apex.
- **Cold Plunge** — b,f+K · rolling mobility strike (Blanka ball as a
  cannonball into the plunge pool). L/M/H = distance.
- **Third Round** — 3P · install. Banya heat: brief armor + faster walk.
- **Fatality — "Full Contrast":** steams the opponent lobster-red, then the
  ice plunge — they shatter like a dropped icicle.

### EARL — short trumpeter, afro, heart sunglasses · Funky sound zoner
- **Basics:** skip-step dash (on beat); float jump with hang (crowd-surf).
- **Brass Blast** — qcf+P · projectile. A visible note; **button = pitch**:
  L travels flat, M arcs, H is a slow fat whole-note that hits twice.
- **The Solo** — dp+P · anti-air. Rising scale, notes trailing, i-frames.
- **Mute** — qcb+K · debuff field ⚙ NEW. Drops a practice mute; inside it
  the opponent's walk and startup slow (the groove is gone).
- **Crescendo** — mash P · push wall ⚙ NEW. A building wall of sound;
  massive pushback on release.
- **Fatality — "Final Note":** one impossibly pure note; the opponent
  vibrates, cracks, and crumbles like a wine glass. His heart sunglasses
  never move.

### CHARLIE — builder, construction, tools · Armored bruiser (T. Hawk weight class)
- **Basics:** **armored forward dash** ⚙ NEW; no backdash (doesn't retreat);
  slow heavy jump.
- **Nail Gun** — qcf+P · rapid projectile. Three quick short-range nails;
  L/M/H = spread pattern.
- **Hammer Arc** — dp+P · anti-air. Overhead framing-hammer swing, huge.
- **Scaffold Rush** — b,f+K · armored charge ⚙ NEW. Shoulder-first through
  projectiles.
- **Demolition** — 360+P · command grab ⚙ NEW. Suplexes the opponent
  through the floorboards; dust and permit violations everywhere.
- **Fatality — "Condemned":** he bricks a wall around the standing opponent
  in four panels, hangs a CONDEMNED sign, taps it twice.

### CHEBEL — photographer, witchy visualist, candles, incense · Illusionist
- **Basics:** dissolve blink back-dash; ghost-float jump (slow fall).
- **Flashbulb** — qcf+P · stun projectile. Short-range burst of light;
  brief white-out stagger. L/M/H = range.
- **Long Exposure** — qcb+P · decoy ⚙ NEW. Leaves a stationary afterimage
  of herself; enemies hit it and it develops into nothing.
- **Incense Drift** — hcf+P · field ⚙ NEW. A curl of smoke that drifts and
  ticks damage, candle-lit.
- **Dark Room** — dp+3K · teleport-swap ⚙ NEW. Trades places with her
  Long Exposure decoy. The mixup is the character.
- **Fatality — "Overexposure":** she raises the camera; the flash goes off;
  all that remains is a burnt film silhouette (husk asset) developing slowly
  in the red dark-room light.

---

## 4. Editing guide

- Rename anything; the names here are first drafts.
- Per special, the implementable knobs are: input · role · damage/stun ·
  projectile (speed/arc/ttl/height/count) · forward travel · i-frames ·
  armor · knockdown · L/M/H axis. State them in plain English.
- Per character, the basics knobs are: walk/back speed · jump (height,
  gravity, float) · dash type (hop/slide/blink/armored/none) · slide on
  crouch kicks · wall jump.
- Delete moves you don't want; three good specials beat five muddy ones
  (Guile ships with two).
- ⚙ NEW mechanics get built in this order of need once this doc is locked:
  dp motion → charge → L/M/H variants → command grabs → 360 → counters/
  installs/armor → teleports/decoys → mash moves → debuff fields.
