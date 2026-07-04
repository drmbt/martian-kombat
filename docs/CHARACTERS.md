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
- **Blunt Puff** (↓↘→+K): blows a fat lingering smoke-ring projectile that
  drifts forward and ticks damage while it hangs in the air.
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
- **Yoga Float** (↓↙←+P): a serene lotus-position high jump with a slow,
  drifting descent — air normals stay live all the way down (Dhalsim drift).
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
- **Mana Burst** (←→+P): a blazing magenta energy orb stamped with the Eden
  Art Labs logo — his straightforward "we raised a round" fireball.
- Hit sparks render as corrupted JPEG artifacts. Win pose: pitches an invisible
  investor, valuation counter spinning overhead.
- Win quotes: "You were out of tokens before you started." / "I pitched. You got
  liquidated." / "Nice try. I already fine-tuned past you."

## Kirby — "Firebreather"
**Archetype:** acrobatic fire-breathing rushdown — fast, fragile, never stops moving.
**Look:** fitted athletic yoga wear, barefoot, absurdly flexible; a smug smile and
a faint orange ember heat-shimmer at the lips. No teacup, nothing in her mouth.
- Contortionist normals: standing-splits, backbends and handsprings — attacks
  come from angles that look anatomically illegal. Her heavy is a vertical
  standing-split kick (heel above her own head).
- **Fire Breath** (↓↘→+P): draws a deep breath and spits a short-range cone of
  fire — a ttl-limited fire projectile (button strength picks range/damage).
- **Sonic Scream** (↓↙←+P): a piercing shout that blasts concentric shockwave
  rings forward — a disjointed sound-wave projectile that pushes back and staggers.
- **Cartwheel** (→↓↘+K): a rising acrobatic cartwheel-handspring kick with
  invulnerable startup — her reversal / anti-air (the "cartwheel triangle roll").
- **Cat Scratch** (mash P): rapid-fire claw flurry — lightning-legs style;
  drum any punches five times fast and she multi-hits with scaling chip.
- Win pose: drops into a one-handed bridge and blows a wisp of smoke off a fingertip.
- Win quotes: "Oh, we are absolutely telling everyone about this." / "You fold
  better than a lawn chair, darling." / "I bend, you break — now sit down and cool off."

## Marzipan — "Photosynthesizer"
**Archetype:** zoner/summoner, battlefield control.
**Look:** long dreads, earth-tone patchwork, seed pouches, barefoot.
- **Overgrowth** (↓↘→+L): plants a seed; a beat later a vine erupts as an
  anti-air column — delayed zoning.
- **Spore Bloom** (↓↙←+L): mushroom cloud that drifts and does slow ticking
  damage while it lingers.
- **Symbiosis** (↓↘→+H): kudzu-wrap command grab — drains health, heals her.
- **Vine Spear** (←→+P): "get over here" — a thorn-tipped vine lance that
  DRAGS the victim to his feet and dumps them in a knockdown if unblocked.
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
- **Matrix Teleport** (↓↘→+K): dissolves into falling digital runes and
  reappears behind the opponent — pure mobility, invulnerable while gone.
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
- **Spinning Star Kick** (charge ↓↑+K): inverted helicopter spin kick that
  travels forward and multi-hits — her spinning-bird-kick homage.
- Win pose: cracks neck, re-braids hair, already bored.
- Win quotes: "Was that your rage? I did not feel it." / "Stand up. Or don't. It
  changes nothing." / "I have already forgotten your name."

---

# Wave 2 roster — PROPOSED v2, lore-informed (awaiting approval, 2026-07-04)

Eight new fighters chosen from the inspo pool (everyone with both a full-body
`assets/character-inspo/<name>.jpg` AND a `face/` shot). Designs are grounded
in the **Martian Lore sheet, Mars People tab** (see CLAUDE.md → Lore source);
each entry cites its lore hook. Privacy check done 2026-07-04: none of the
eight opted out ("NO AI PLEASE" = Maya Luna, Peter, Roarke, Summer — never
build these four).

Benched this wave, revisit for Wave 3: **Katana** (war-fan assassin design
drafted and shelved — lore is thin: "swish (sword sounds)", bass, Tool Camp
mural), **Xiao-Chen** (lore row is empty — needs real lore before she'll read
as a person), **Lyosha** (welder-builder, "you must be strong, otherwise why
even exist?" — ready-made bruiser), **Seva** (Neuromancer network engineer +
Starting Strength coach — cyber-grappler; his only full-body inspo is 240px,
needs a new photo).

Every design below maps onto existing engine plumbing (projectiles, traps,
counter stances, armor/install buffs, command grabs, floats, assists — all
shipped in Wave 1 kits; nearest analogue named per move). No engine changes;
characters remain pure data.

## Bodhi — "The Alignment"
**Archetype:** grappler — his throws are therapeutic. Allegedly.
**Lore hook:** teaches Thai bodywork, founded the bodywork camp, organizes the
Community Lab ("Commie Lab"), "very knowledgeable about astrology."
**Look:** mustard parka with fur hood over tan tank, yellow shorts, maroon
beanie, black high-tops; serene professional smile of a man about to fold you
in half for your own good. Faint zodiac glyphs when specials fire.
- Deceptively athletic; best walk speed of any grappler — he approaches like
  it's an appointment you already booked.
- **Deep Tissue** (360°+P): signature command grab — a full Thai-massage
  cobra stretch applied at competitive speed; huge damage, victim stands up
  visibly straighter (brief extra hitstun — "aligned").
- **Table Work** (↓↙←+H, close): grabs and walks the opponent's spine with a
  knee — side-switches on release (Symbiosis plumbing, positional twist).
- **Ascendant** (→↓↘+P): rising open-palm anti-air; a constellation flashes
  behind him — which one depends on button strength (art variant only).
- **Retrograde** (↓↘→+K): low sliding entry under projectiles (Cossack
  Spiral plumbing) — "everything comes back around."
- Win pose: presses palms together, cracks his own back louder than any hit
  in the match, checks an ephemeris pocket chart, nods.
- Win quotes: "Your chart said this would happen." / "That tension you were
  holding? Released." / "Book a follow-up. You have deep-rooted issues."
- VO soundbites: "Breathe out." (grab connect) · "Realigned." (KO) ·
  "Saturn says no." (taunt) · soft exhale kiai.

## Cat — "Wet Paint"
**Archetype:** trickster rushdown with ground control and an alter ego.
**Lore hook:** Portuguese mixed-media painter who *makes her own paint from
flour and mineral pigments*, built a communal loom ("The Thread of Life"),
hosts improv theatre, sassy fearless poker player, embodies "D. Catarina" —
an old Portuguese lady who complains about the weather — every Sunday.
**Look:** white sundress splashed with living orange/magenta/blue paint, long
dark hair, barefoot dancer's posture; the dress repaints itself between rounds.
- Dance normals: pirouette kicks and flamenco heel stomps with sneaky range.
- **Flour Bomb** (↓↘→+P): lobs a sack of homemade pigment that bursts into a
  floor puddle — standing in it slows the opponent's walk speed (Root Access
  trap plumbing, area-slow variant).
- **Thread of Life** (↓↙←+P): a loom-thread lash that trips into knockdown
  at mid range — woven, not thrown (Vine Spear plumbing minus the drag).
- **Pirouette** (→↓↘+K): rising spin kick trailing a rainbow ribbon —
  invulnerable-startup reversal (Cartwheel plumbing).
- **D. Catarina** (↓↙←→+P, hcf — ↓↓ isn't an engine motion): for one beat
  she IS the old lady — headscarf, cane whack that crumples on counterhit
  (global counterhit bonus), one weather complaint (a slow high-reward
  command poke; pure theatre). Declared before Flour Bomb so the qcf tail
  doesn't steal the hcf.
- **Fatality — Still Life** (↓↙←+P, hcb): flings living paint that pins the
  husk to a giant white canvas, then live-paints it — the husk dissolves
  brushstroke by brushstroke into wet smears — into a finished, deliberately
  unflattering framed portrait on an easel; she signs it and blows a kiss.
- Win pose: live-paints the fallen opponent's portrait on an easel, shows it
  to the camera, signs it. It is unflattering.
- Win quotes: "I painted you better than you fought." / "Poker rule: you
  blinked first." / "I mispell words, querido. Not punches."
- VO soundbites: "Sai da frente!" (special) · "Obrigada, querido." (KO) ·
  as D. Catarina: "Que tempo horrível…" · bright "Ha!" kiai.

## Chebel — "The Spirit Deck"
**Archetype:** rushdown with summon mixups — the cards choose the pressure.
**Lore hook:** Mimos cafe founder-caretaker, Brazilian multimedia artist and
filmmaker, reads an animal-spirit tarot deck, opens rituals with tea ceremony,
co-created Rainbow Road (projection golf-cart) with Ygor, can ride a unicycle
"but is still not very confident of doing it in the desert."
**Look:** brown crop top, oxblood shorts, strap sandals, long dark hair
mid-whip (her inspo photo is already a head-height kick); a card deck at her
hip glows faintly.
- Kick-forward normals — her jab is a lead-leg teep; the deck does the rest.
- **Spirit Draw** (↓↘→+P): draws a card and releases a glowing projected
  animal spirit — L: hummingbird (fast, straight dart), H: jaguar (slower
  lunging pounce that hits mid) — button picks the animal (Fireball plumbing,
  two art/speed variants).
- **Crescent Moon Kick** (↓↘→+K): stepping axe kick — overhead, must be
  blocked standing (her photo, weaponized).
- **Ceremony** (↓↙←+P): tea-ceremony stance — a parry window; on a
  successful parry she sips and gains a short damage buff, "centered"
  (Presence counter plumbing, buff payoff instead of teleport).
- **Unicycle Rush** (←→+K): wobbling unicycle charge that crosses up on the
  far version — the wobble is deterministic, the fear is real.
- Win pose: draws a card, shows it to the camera (it's the opponent,
  reversed), a projected spirit curls around her, she sips tea.
- Win quotes: "The deck told me this morning. I just delivered." / "This
  card? You. Reversed." / "Sit. Have tea. Reflect."
- VO soundbites: "The spirits are loud today." (round start) · "Reversed."
  (KO) · "Chá?" (taunt) · sharp exhale kiai.

## Earl — "The Madd Wikkid"
**Archetype:** sound zoner with recorded-playback traps.
**Lore hook:** his actual former stage name. Decades producing and
engineering records, AAA-game audio director, plays piano/trumpet/bass,
teaches music theory on Mars, owns "an excessive amount of field recording
gear," fronts a fictional cartoon band, The Unhung Zeros.
**Look:** enormous silver-grey afro, paisley shirt, heart-shaped sunglasses,
grey goatee; visible sine-wave distortion ripples off his normals.
- **Sine Wave** (↓↘→+P): a wobbling orb projectile — button strength sets
  the wavelength: L floats slow and fat, H is a fast flat line.
- **Field Recorder** (↓↙←+P): plants a recorder on a mini tripod that arms,
  then plays back a delayed burst of sound when the opponent comes near —
  stationary trap, one on screen (Root Access plumbing, proximity pop).
- **Brass Section** (→↓↘+P): rising trumpet-blast uppercut — anti-air with
  a brass-stab hit (Cartwheel-class reversal arc, sound-flavored).
- **Drop the Bass** (↓↓+H): subwoofer stomp — short-range ground quake that
  trips grounded opponents (Overgrowth-class column, floor-hugging).
- Win pose: The Unhung Zeros — his cartoon band — flicker in behind him and
  play a two-second sting; Earl conducts, then waves them off, unimpressed.
- Win quotes: "You got filtered, baby." / "That was the demo take. Imagine
  the master." / "I don't abide charlatans. Or whatever that was."
- VO soundbites: "Wrong key, darling." (taunt) · "From the top." (round
  start) · "Mixed. Mastered. Shipped." (KO) · trumpet-stab kiai.

## Haidai — "The Vibration Priest"
**Archetype:** counter-priest — punishes force by returning it aligned.
**Lore hook:** "the vibration alignment priest" — Silicon Valley →
anthropological researcher and digital cultural preservationist → Balinese
priest working with energetic calendars and AI-deployed ancient wisdom.
Officiated Gene and Vanessa's wedding on Mars. The black-and-white checkered
sash in his inspo photo reads as Balinese *saput poleng* — the sacred cloth
of balance. Keep it central in every generated asset.
**Look:** crisp white shirt, long black skirt, checkered poleng sash, long
grey-black hair half-tied; unshakably serene.
- Slowest walk in the game; never out of position anyway.
- **Poleng Ward** (↓↙←+P): counter stance wrapped in the checkered cloth —
  if struck, he redirects and the attacker lands thrown on his other side
  (Presence plumbing, side-switch payoff).
- **Resonance** (↓↘→+P): a slow expanding vibration ring that gains damage
  the farther it travels — the only projectile in the game that rewards full
  screen distance (fireball plumbing, distance-scaled damage tiers by
  strength as the data approximation).
- **Auspicious Day** (↓↓+P): consults the energetic calendar — a brief
  ritual; if uninterrupted, his next special is empowered (Breathwork-style
  install, one charge).
- **Procession** (hold H): slow advancing walk with upper-body armor ending
  in a single palm that wall-bounces (Still Water, renamed to what it is).
- Win pose: sprinkles a water blessing over the fallen opponent with a
  frangipani flower, bows exactly as deep as they earned.
- Win quotes: "Today was simply not your auspicious day." / "Your vibration
  was off. Consider it aligned." / "I married your friends, you know. I bury
  hubris for free."
- VO soundbites: "Align." (special) · "Om swastiastu." (round start bow) ·
  a single struck-bell tone (hit confirm) · calm "Mm." (taunt).

## Rapha — "The TabBastard"
**Archetype:** puppet/assist — the roster's first true puppet character.
**Lore hook:** his actual lore-sheet alias. Toy maker and designer by trade,
perfect attendance since the Brahman zero year, founding Data Daddy, built
the Render Beast mars computer with Vincent in 2025, pop-tab enthusiast, and
in 2026 built **Tubs — "an open clawd bot in yellow top tubs."** Tubs fights
with him.
**Look:** black cap, dusty black tee, faded camo pants, barefoot, trimmed
beard, unbothered blue-eyed stare; a squat yellow storage-tub robot with one
claw arm (Tubs) idles behind him; a long chain of pop tabs swings from his
belt.
- Rapha's own normals are short, calm and functional — toymaker hands. The
  range comes from the robot.
- **Tubs, Fetch!** (↓↘→+P): Tubs scuttles forward ankle-height and
  claw-pinches — low assist that hits while Rapha moves freely (Order Up!
  plumbing; THE puppet-archetype test case).
- **Pop-Tab Chain** (↓↙←+P): whips the belt chain in a shallow arc of
  glittering pop tabs — short multi-hit projectile fan (Mise en Place
  plumbing).
- **Wind-Up** (↓↘→+K): sets a tin wind-up toy marching slowly forward until
  it pops in a spring-loaded burst — delayed trap (Fork Bomb-class timing on
  Root Access-class placement).
- **Claw Machine** (360°+P, close): Tubs clamps the opponent in its claw,
  hoists, and Rapha tips the tub — puppet-assisted command grab (Symbiosis
  plumbing, no heal, bigger damage).
- Win pose: sits cross-legged; Tubs trundles over and hands him a cold drink;
  he cracks it and threads the fresh tab onto the chain.
- Win quotes: "Tubs did most of it. I supervised." / "Every tab on this
  chain outlasted someone. Welcome aboard." / "I build toys sturdier than
  you."
- VO soundbites: "Tubs. Fetch." (assist) · sharp two-note whistle (Claw
  Machine) · "Add it to the chain." (KO) · "Perfect attendance, baby."
  (taunt).

## Vanessa — "The High Priestess"
**Archetype:** summoner/ritualist zoner — the battlefield fills with clay.
**Lore hook:** her lore-sheet caption is "Mars High Priestess." Original name
Nyx; renamed **Moonchild** by Pseudo — "the bridge and creator of worlds."
Part of the Mars founding group, partner of Gene. Creator of the ancestor
cult (local clay), the cacao gratitude ceremony (chocolate heads served at
Midterms rituals), and the **Little Martians** — clay sculptures who are
Earth-life's descendants from a distant future, speaking to her through
dreams and living on as her AI characters.
**Look:** pink-and-teal geometric zip dress with a hot-pink center stripe,
black sock-sneakers, wild curly auburn hair, hands-on-hips certainty; small
clay Little Martian figurines orbit her during specials, moonlit accents.
- Ritual normals: unhurried, deliberate palm and knee strikes — she moves
  like every hit was scheduled on a ceremonial calendar.
- **Little Martian** (↓↘→+P): sets down a clay figurine that wakes up and
  toddles forward, bursting into dream-static on contact — walking creature
  projectile; L/H picks the figurine and pace (Hallucination-class art on
  fireball plumbing).
- **Chocolate Head** (↓↙←+P): lobs a ceremonial cacao head in an arc; it
  shatters into a lingering incense cloud that ticks damage (Spore
  Bloom-class lob + linger).
- **Lucid Gate** (↓↙←+K): dissolves into dream-mist and re-forms a
  half-screen away — teleport with i-frames mid-fade (Diffusion plumbing,
  moonlit art).
- **Gratitude** (↓↓+P): a beat of cacao ceremony — install; if uninterrupted
  her next special is empowered (Auspicious Day-class, one charge).
- Win pose: tiny clay Little Martians ring the fallen opponent; she places a
  chocolate head at their feet like an offering, under a sudden moonbeam.
- Win quotes: "The Little Martians dreamed this ending months ago." / "Say
  thank you. The ceremony requires it." / "Nyx. Moonchild. High Priestess.
  Tonight: winner."
- VO soundbites: "The ancestors are watching." (round start) · "Wake up."
  (KO) · whispered "Dream." (Lucid Gate) · low ceremonial hum (taunt).

## Ygor — "Suave"
**Archetype:** projection zoner — hand-drawn creatures control the screen.
**Lore hook:** new-media artist of VJ Suave (animation + projection roaming
25+ countries), AI-psychedelia project *microdosys*, avid stoner, building
the oRACLE booth, co-created Rainbow Road with Chebel — projections thrown
from Appa, the old golf cart. His lore-sheet caption: *"This was not a
microdosis."*
**Look:** worn cap over shaggy hair, yellow tee with red leopard print, dark
work pants, vintage camera on a neck strap; his hands glow like a projector
lens when specials start.
- Normals are quick and lens-first; he fights like he's framing you.
- **Suave Creature** (↓↘→+P): projects a glowing hand-drawn critter that
  lopes forward along the ground — projectile with animated-being art, L/H
  pick the creature and speed (Sigil Bolt plumbing, art variants).
- **oRACLE** (↓↙←+P): plants the oRACLE booth — a stationary trap that
  emits a psychedelic pulse on a timer, one on screen (Root Access plumbing).
- **Microdose** (↓↓+P): install — colors bloom and his walk speed and
  projectile cadence rise for a few seconds. The H version blooms
  noticeably harder; he looks briefly concerned (Breathwork-class timed buff).
- **Rainbow Road** (↓↙←+K): Appa the golf cart putts across the screen
  ankle-height trailing a rainbow projection — low assist while Ygor moves
  freely (Order Up! plumbing; Chebel cameos as the driver — her deck, his
  road).
- Win pose: projects a tiny animated creature that hops onto his shoulder;
  he tips the cap, exhales… something.
- Win quotes: "This was not a microdosis." / "I projected your defeat two
  rounds ago. Nice render." / "Suave, mano. Suave."
- VO soundbites: "Suave…" (drawn out, on install) · "Não foi microdose!"
  (KO) · slow impressed "Whoa." (when hit by a heavy — yes, on HIT) ·
  relaxed chuckle (taunt).

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
