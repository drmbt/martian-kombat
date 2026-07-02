# Martian Kombat — Character Bible

Move-set and personality design for each fighter. This drives asset generation
prompts (`tools/`) and frame-data JSON (`src/data/characters/`). Every character
needs the **standard kit** plus their signature moves.

**Standard kit (every character):** idle, walk fwd/back, dash, jump, crouch,
stand/crouch block, light attack (jab), heavy attack, sweep (knockdown low),
throw, hit-react, KO fall, win pose. Specials use motion inputs (↓↘→ + attack).

**Every character also needs** (drives the post-match SFII-style win screen): a
`winQuotes: string[]` array in their JSON (in-character victory taunts, the
screen picks one at random) and a beaten-and-bloodied *defeated* portrait
(`public/assets/portraits/<id>-ko.png`, produced by `tools/gen-canonical.mjs`).

**Archetype language:** rushdown (fast, close-range), zoner (keep-away,
projectiles), grappler (slow, big damage up close), counter (punishes
aggression), puppet/assist (controls a second entity).

---

## Catherine — "The Chef de Guerre"
**Archetype:** mid-range weapon rushdown with an assist.
**Look:** chef's apron over desert-wear, bo staff, knife bandolier; Jazzper the
dog at her side.
- Bo staff normals give her the longest pokes in the game.
- **Mise en Place** (↓↘→+L): flings a fan of three kitchen knives — projectile.
- **Order Up!** (↓↙←+H): Jazzper dashes across the screen ankle-height — low
  assist that hits while Catherine moves freely (puppet-lite plumbing test).
- **86'd** (throw special): staff-vault kick off the opponent's chest.
- Win pose: plates a dish; Jazzper barks.
- Win quotes: "You came to my kitchen underseasoned." / "Order up. One knockout,
  plated hot." / "Jazzper had you. I just watched."

## Flo — "Kernel Panic"
**Archetype:** technical zoner with traps.
**Look:** tall, lanky, permanent scowl, spliff, black hoodie, mechanical keyboard.
- Long limbs = rangy, cranky-looking normals.
- **Fork Bomb** (↓↘→+L): lobs a laptop that detonates into cascading terminal
  windows — delayed-explosion projectile.
- **Smokescreen** (↓↙←+L): spliff exhale creates a lingering cloud that hides
  his moves (visual-occlusion mechanic).
- **Root Access** (↓↘→+H): floor cable-snare — trap that pops the opponent up.
- Win pose: types furiously, mutters in German; "works on my machine."
- Win quotes: "Works on my machine. Not on your face." / "Segmentation fault.
  That was you." / "I have logged this loss. Read the trace yourself."

## Freeman — "The Still Point"
**Archetype:** counter/turtle.
**Look:** loose linen, mala beads, serene half-smile, bare feet.
- Slow walk, but the best defensive frame data in the game.
- **Presence** (↓↙←+L): meditation counter-stance — if struck during the pose,
  teleports behind the attacker with a palm strike.
- **Breathwork** (hold H): charges "inner peace" armor — absorbs one hit.
- **Sun Salutation** (↓↘→+H): flowing yoga sequence that's also a 3-hit combo,
  ending in crow pose that hops over lows.
- Win pose: sits, exhales; screen briefly desaturates to calm.
- Win quotes: "I did not resist you. There was nothing to resist." / "Breathe.
  You are still here. Barely." / "Stillness wins the fight you never start."

## Gene — "Prompt Injection"
**Archetype:** chaotic zoner, screen-control gimmicks.
**Look:** startup tee under blazer, AR glasses, energy-drink aura.
- **Hallucination** (↓↘→+L): spawns a glitchy, half-rendered clone that walks
  forward and pops — fake-out projectile.
- **Diffusion** (↓↙←+H): Gene dissolves into denoising static and re-renders a
  half-screen away — teleport with i-frames on the noisy frames.
- **Rate Limit** (↓↘→+H): throws a "429" barrier that slows opponent projectiles
  and dashes inside its field.
- Hit sparks render as corrupted JPEG artifacts. Win pose: pitches an invisible
  investor, valuation counter spinning overhead.
- Win quotes: "You were out of tokens before you started." / "I pitched. You got
  liquidated." / "Nice try. I already fine-tuned past you."

## Kirby — "Spill the Tea"
**Archetype:** flexible rushdown with a fire install.
**Look:** yoga wear, teacup that never spills, knowing smirk.
- Contortionist normals: attacks come from angles that look anatomically illegal.
- **Scalding Sip** (↓↘→+L): sips, then spits a short-range fire cone.
- **Hot Gossip** (↓↙←+L): whisper projectile — slow-moving rumor cloud that
  briefly reverses opponent's left/right inputs on hit (gimmick, post-MVP OK).
- **Full Kettle** (↓↘→+H, install): finishes the tea — next 5 seconds all
  normals gain fire trails and chip damage.
- Win pose: bridge pose while refilling the cup.
- Win quotes: "Oh, we are absolutely telling everyone about this." / "You fold
  better than a lawn chair, darling." / "The tea? Still full. You? Not so much."

## Marzipan — "Photosynthesizer"
**Archetype:** zoner/summoner, battlefield control.
**Look:** long dreads, earth-tone patchwork, seed pouches, barefoot.
- **Overgrowth** (↓↘→+L): plants a seed; a beat later a vine erupts as an
  anti-air column — delayed zoning.
- **Spore Bloom** (↓↙←+L): mushroom cloud that drifts and does slow ticking
  damage while it lingers.
- **Symbiosis** (↓↘→+H): kudzu-wrap command grab — drains health, heals her.
- All damage numbers are cruelty-free. Win pose: a desert flower blooms where
  the opponent fell; she waters it.
- Win quotes: "Even weeds grow stronger than that." / "A flower blooms where you
  fell. Cruelty-free." / "I have composted better fighters than you."

## Vincent — "The Cloakwright"
**Archetype:** flowing footsies with projectile-reflect utility.
**Look:** long black flowing cloak (cloth-sim showcase), calm tai chi posture,
faint glyphs orbiting his hands.
- Tai chi normals: circular, deceptive range, strong whiff-punishes.
- **Redirect** (↓↙←+L): push-hands parry that *reflects projectiles* as digital
  wireframes of themselves.
- **Cloud Hands** (↓↘→+L): advancing triple palm flow, each palm cancelable.
- **Sigil Storm** (↓↘→+H): traces a glyph that fires a slow homing rune — the
  cloak billows fully open, screen dims.
- Win pose: cloak settles; a single glyph blinks out like a cursor.
- Win quotes: "The cursor blinks. Your session has ended." / "Water does not
  strike. It arrives where you are not." / "I redirected everything you had. It
  was never much."

## Yulia — "Volga Fury"
**Archetype:** grappler with a rage comeback mechanic.
**Look:** very tall, athletic, braid, deceptively calm until she isn't.
- Longest throw range in the game; flexible high kicks as anti-airs.
- **Rage meter (unique plumbing):** fills as she takes damage. Below 50% it's
  cosmetic; above 50% her specials gain armor and damage; at 100% her portrait
  catches fire.
- **Cossack Spiral** (↓↘→+L): low spinning sweep-slide under projectiles.
- **Backbend Guillotine** (↓↙←+H): matrix-lean under a high attack into a
  standing suplex.
- **ENOUGH.** (360°+H, rage ≥50%): command grab — lifts, stares, slams. Screen
  shakes disproportionately.
- Win pose: cracks neck, re-braids hair, already bored.
- Win quotes: "Was that your rage? I did not feel it." / "Stand up. Or don't. It
  changes nothing." / "I have already forgotten your name."

---

## Asset-prompt notes

- Shared style prompt lives in `tools/style.md` (Sprint 2) — every character
  sheet must cite it verbatim so the roster reads as one game.
- Stage 1: Bombay Beach shoreline at sunset — rusted swing-set in the shallows,
  Salton Sea glare, distant geodesic domes. Stage 2 (post-MVP): Mars College
  campus at night, string lights, dust.
- Announcer (ElevenLabs): gravel-voiced, slightly cosmic. Needs each fighter's
  name, "ROUND ONE/TWO/FINAL ROUND", "FIGHT!", "K.O.", "PERFECT", "MARTIAN
  VICTORY".
