// The shared frame layout for every character's sprite sheet, and the
// per-character pose flavor. Cell order is a CONTRACT with the renderer
// (src/scenes/FightScene.ts actionToCell) — never reorder, only append.

export const CELL_W = 288;
export const CELL_H = 384;
export const COLS = 6;
export const ROWS = 4;

/** Shared cells 0..10, then 3 phases per move: light 11-13, heavy 14-16,
 *  sweep 17-19, special 20-22. */
export const CELLS = [
  { id: 'idle-a', pose: 'relaxed fighting stance, hands up in guard, weight on back foot' },
  { id: 'idle-b', pose: 'same fighting stance, chest slightly risen mid-breath, hands drifted a few centimeters' },
  { id: 'walk-a', pose: 'walking forward mid-stride, front foot planted, guard up' },
  { id: 'walk-b', pose: 'walking forward opposite stride, back foot planted, guard up' },
  { id: 'crouch', pose: 'crouching down VERY low on deeply bent knees, buttocks near the heels, body compact, guard tight to the chin — NOT standing' },
  { id: 'jump', pose: 'airborne mid-jump, knees tucked up, arms balanced' },
  { id: 'block', pose: 'standing block, forearms crossed high in front of the face, braced backward' },
  { id: 'block-crouch', pose: 'blocking while crouched VERY low on deeply bent knees, buttocks near the heels, forearms shielding the face, curled compact — NOT standing' },
  { id: 'hit', pose: 'reeling from a hit, head snapped back, torso twisted off balance, grimace' },
  { id: 'fall', pose: 'launched backwards through the air, body horizontal, limbs flailing' },
  { id: 'down', pose: 'knocked out COLD, lying FLAT on their back on the ground, body fully horizontal stretched along the bottom edge of the frame, head to one side, limbs sprawled — NOT standing, NOT sitting' },
];

export const MOVES = ['light', 'heavy', 'sweep', 'special'];

// Geometric constraint beats pose adjectives for low stances: give the model
// a composition rule it can verify, not anatomy words it can fudge.
export const LOW =
  'squatting EXTREMELY low with knees fully folded and hips at heel height — the entire figure occupies ONLY the BOTTOM HALF of the frame, nothing but empty green in the top half';
export const LYING =
  'lying completely FLAT on their back on the ground — the entire figure is a HORIZONTAL shape stretched along the BOTTOM QUARTER of the frame, nothing but empty green in the top three quarters';

// ---- v2 sheet layout: six buttons × stand/crouch/air ----
// stand moves get 3 cells (startup/active/recovery), crouch moves 2
// (active/recovery), air moves 1. Cell names are looked up from meta.json by
// the renderer, with fallbacks for legacy 23-cell sheets.
export const V2_BUTTONS = ['lp', 'mp', 'hp', 'lk', 'mk', 'hk'];

/** Ordered generation/pack job list for a character spec. */
export function buildJobs(spec) {
  // A character may override any shared generic-cell pose via spec.cells
  // (e.g. to stop an idle-loop from flickering or pin a fall direction) —
  // named specials/normals still come from moves6.
  const jobs = CELLS.map((c) => ({ id: c.id, pose: spec.cells?.[c.id] ?? c.pose }));
  if (spec.layout === 'v2') {
    for (const b of V2_BUTTONS) {
      for (const phase of ['startup', 'active', 'recovery']) {
        jobs.push({ id: `${b}-${phase}`, pose: spec.moves6.stand[b][phase] });
      }
    }
    for (const b of V2_BUTTONS) {
      for (const phase of ['active', 'recovery']) {
        jobs.push({ id: `c${b}-${phase}`, pose: `${spec.moves6.crouch[b][phase]}, ${LOW}` });
      }
    }
    for (const b of V2_BUTTONS) {
      jobs.push({ id: `j${b}`, pose: `airborne mid-jump, ${spec.moves6.air[b]}` });
    }
    // named specials, in declaration order (cells: <special-id>-<phase>)
    for (const [sid, phases] of Object.entries(spec.moves6.specials)) {
      for (const phase of ['startup', 'active', 'recovery']) {
        jobs.push({ id: `${sid}-${phase}`, pose: phases[phase] });
      }
    }
  } else {
    for (const move of MOVES) {
      for (const phase of ['startup', 'active', 'recovery']) {
        jobs.push({ id: `${move}-${phase}`, pose: spec.moves[move][phase] });
      }
    }
  }
  return jobs;
}

export function gridFor(spec) {
  const n = buildJobs(spec).length;
  const cols = spec.layout === 'v2' ? 8 : COLS;
  return { cols, rows: Math.ceil(n / cols) };
}

export const CHARACTERS = {
  vincent: {
    canonical: 'assets/raw/style-tests/char-vincent-b-painted.png',
    layout: 'v2',
    moves6: {
      stand: {
        lp: {
          startup: 'coiling a quick straight palm strike, rear palm chambered at the hip',
          active: 'straight palm strike fully extended at chest height, cloak snapping forward',
          recovery: 'retracting the palm, weight settling back into stance',
        },
        mp: {
          startup: 'chambering a short double-palm push, palms stacked at his side',
          active: 'short double-palm push thrust forward at chest height, faint crimson red shimmer at the palms',
          recovery: 'palms drawing back into a tai chi guard',
        },
        hp: {
          startup: 'winding into a spinning double-palm push, cloak wrapping around the body',
          active: 'double-palm push fully extended, cloak flared wide, burst of crimson red energy at the palms',
          recovery: 'completing the spin, cloak settling, arms lowering',
        },
        lk: {
          startup: 'weight shifting back, front foot lifting for a quick low toe kick',
          active: 'quick snapping toe kick at shin height, cloak swaying',
          recovery: 'the foot returning softly to stance',
        },
        mk: {
          startup: 'arms flowing as one leg chambers across his body for a crescent kick',
          active: 'crescent kick sweeping at chest height, cloak arcing with the motion — exactly one foot on the ground',
          recovery: 'the kicking leg landing back into a settled tai chi stance',
        },
        hk: {
          startup: 'coiling into a spin, cloak wrapping tight, one leg chambered high',
          active: 'spinning high crescent kick fully extended at head height, cloak flared in a full circle, crimson red energy trail — exactly one foot on the ground',
          recovery: 'the spin completing, cloak settling around him, both feet planted',
        },
      },
      crouch: {
        lp: {
          active: 'short palm strike snapped out at waist height from the squat',
          recovery: 'palm pulled back to guard, still coiled in the squat',
        },
        mp: {
          active: 'rising palm thrust angled upward out of the squat, crimson red shimmer trailing',
          recovery: 'the arm settling down, weight sinking back into the squat',
        },
        hp: {
          active: 'both palms thrust powerfully straight upward out of the squat, cloak rising, crimson red energy burst (anti-air)',
          recovery: 'arms lowering from overhead, settling back into the squat',
        },
        lk: {
          active: 'squatting on his left leg, his RIGHT leg snapping a quick kick forward at ankle height',
          recovery: 'the kicking leg pulled back beneath him, both feet planted in the squat',
        },
        mk: {
          active: 'squatting on his bent left leg while his RIGHT leg is fully extended forward along the ground in a long low kick, cloak pooled around him',
          recovery: 'sliding the extended leg back beneath his body into a compact squat',
        },
        hk: {
          active: 'low circular leg sweep fully extended along the ground, cloak fanned out',
          recovery: 'rising from the sweep back toward stance',
        },
      },
      air: {
        lp: 'throwing a quick downward-angled palm strike',
        mp: 'a double-palm thrust angled 45 degrees downward, crimson red shimmer',
        hp: 'an overhead double-fist hammer blow swung downward, cloak billowing above him',
        lk: 'a sharp knee strike raised toward the opponent',
        mk: 'a side kick extended at a downward angle, cloak trailing',
        hk: 'a flying spinning crescent kick — RIGHT leg fully extended with a crimson red energy trail, LEFT leg tucked beneath him, both legs clearly attached',
      },
      specials: {
        'sigil-bolt': {
          startup: 'tracing a glowing crimson red arcane glyph in the air with one finger, eyes focused',
          active: 'palm thrust forward launching a bright crimson red glowing rune projectile, cloak blown back',
          recovery: 'follow-through with palm open, glyph light fading from the fingertips',
        },
        'cloud-hands': {
          startup: 'both palms beginning a flowing circular cloud-hands motion, crimson red light gathering between them',
          active: 'advancing forward as his palms flow in circles, a blurred triple palm strike, crimson red light trailing each palm',
          recovery: 'the flowing motion settling, palms returning to center, crimson red light fading',
        },
        'rising-glyph': {
          startup: 'coiling low, one palm charging with a blazing crimson-red glyph, knees deeply bent ready to spring',
          active: 'a rising glyph uppercut — leaping upward, palm driving a blazing crimson-red sigil skyward, cloak trailing below, both feet off the ground',
          recovery: 'descending from the rise, cloak settling around him, the glyph light fading',
        },
        redirect: {
          startup: 'settling into a push-hands stance, palms circling, a faint crimson red ward beginning to shimmer in front of him',
          active: 'palms extended in a deflecting circle, a shimmering translucent crimson red ward-plane hovering in front of his hands',
          recovery: 'the ward dissolving, hands drawing back to guard',
        },
        throw: {
          startup: 'one open hand reaching out to catch at wrist height in front of him, cloak billowing',
          active: 'lunging forward, both arms fully extended toward the right frame edge, hands clawed and actively grabbing the empty air, a small crimson red impact flash obscuring his hands, cloak snapping forward',
          recovery: 'settling back into his calm stance, cloak resettling, palms lowering',
        },
        // NOTE: the lore says GREEN matrix runes, but green FX on the chroma
        // green screen is unkeyable (the sigil-bolt lesson) — crimson kit color
        'matrix-teleport': {
          startup: 'his body beginning to dissolve from the feet upward into columns of falling crimson-red digital rune glyphs, calm behind his sunglasses',
          active: 'almost fully dissolved — a man-shaped cascade of crimson-red digital rune glyphs streaming upward, only the sunglasses and the cloak outline still readable inside the rune column',
          recovery: 'rematerializing out of falling crimson runes mid-step, cloak settling around him, adjusting his sunglasses with one finger',
        },
      },
    },
    extra: {
      projectiles: {
        'sigil-bolt': {
          prompt:
            'A single glowing CRIMSON RED arcane rune sigil energy ball projectile with bright white-hot core, spinning, painted cel-shaded anime style, small, centered, on solid flat chroma-key green background #00B140, no character, no text, no watermark.',
        },
      },
    },
  },
  catherine: {
    canonical: 'assets/raw/canonical/catherine.png',
    layout: 'v2',
    // the staff kept vanishing between frames — this rides along on EVERY prompt
    always:
      'She is ALWAYS holding her long wooden bo staff — the staff must be clearly visible in this frame, gripped in one or both hands (or planted upright in one hand where the pose says so). Never draw her without the staff.',
    moves6: {
      stand: {
        lp: {
          startup: 'drawing the bo staff back beside the hip, coiled for a thrust',
          active: 'bo staff thrust fully extended forward at chest height, sharp and direct',
          recovery: 'retracting the bo staff back to a ready guard',
        },
        mp: {
          startup: 'spinning the bo staff up across her body, both hands on the shaft',
          active: 'horizontal staff strike snapped across at chest height, both hands driving it through',
          recovery: 'the staff rebounding back into a two-handed guard',
        },
        hp: {
          startup: 'raising the bo staff high overhead with both hands',
          active: 'slamming the bo staff down in a powerful overhead arc, hair flying',
          recovery: 'lifting the staff back up from the follow-through',
        },
        lk: {
          startup: 'front knee rising, staff pulled tight vertical against her side',
          active: 'quick snapping front kick at shin height, staff held tight vertical at her side',
          recovery: 'the kicking foot returning, staff swinging back to guard',
        },
        mk: {
          startup: 'planting the bo staff on the ground like a pole, weight shifting onto it',
          active: 'pole-assisted side kick at chest height, body swinging around the planted staff, one hand on the staff',
          recovery: 'landing from the pole kick, pulling the staff back up into both hands',
        },
        hk: {
          startup: 'staff planted firmly, her whole body coiling around it like a vaulter',
          active: 'pole-vault kick — swinging from the planted staff, both feet together driving forward at head height',
          recovery: 'landing from the vault, staff returning to a two-handed guard',
        },
      },
      crouch: {
        lp: {
          active: 'short staff jab snapped out at waist height from the squat, staff held mid-shaft',
          recovery: 'staff pulled back to a compact guard, still squatting',
        },
        mp: {
          active: 'rising diagonal staff thrust angled upward out of the squat (anti-air)',
          recovery: 'the staff arcing back down, weight settling into the squat',
        },
        hp: {
          active: 'powerful vertical staff thrust straight up out of the squat, arms fully extended overhead (anti-air)',
          recovery: 'staff lowering from overhead, settling back into the squat',
        },
        lk: {
          active: 'squatting on her left leg, her RIGHT leg snapping a quick kick at ankle height, staff braced across her body',
          recovery: 'the kicking leg pulled back beneath her, staff braced, both feet planted in the squat',
        },
        mk: {
          active: 'squatting on her bent left leg, her RIGHT leg fully extended forward along the ground in a long low kick, staff braced over her shoulder',
          recovery: 'sliding the extended leg back beneath her into the squat, staff over her shoulder',
        },
        hk: {
          active: 'sweeping the bo staff in a wide low arc along the ground',
          recovery: 'rising while spinning the staff back up to guard',
        },
      },
      air: {
        lp: 'a quick downward bo staff poke, staff in both hands',
        mp: 'a bo staff thrust angled 45 degrees downward, arms extended',
        hp: 'a two-handed overhead bo staff slam swung downward, hair flying',
        lk: 'a sharp knee strike, the staff pulled up overhead in both hands',
        mk: 'a side kick angled downward, the staff held across her body',
        hk: 'a flying downward heel kick — RIGHT leg extended, LEFT tucked, staff swept back behind her in one hand',
      },
      specials: {
        'mise-en-place': {
          startup: 'drawing a fan of three kitchen knives from her chest bandolier with her free hand, bo staff gripped in the other hand',
          active: 'flinging the fan of three gleaming kitchen knives forward, blades leaving her open hand in a spread, bo staff in her other hand',
          recovery: 'the throwing hand empty in follow-through, returning to grip the staff with both hands',
        },
        'order-up': {
          startup: 'kneeling on one knee, pointing forward commandingly like sending a dog on an attack run, bo staff planted upright in her other hand, her small scruffy dog crouched beside her ready to sprint',
          active: 'arm fully extended pointing forward, the dog absent (already launched off-screen), bo staff planted upright in her other hand',
          recovery: 'standing back up mid-whistle, one hand near her mouth, the other holding the staff',
        },
        'staff-vault': {
          startup: 'the bo staff planted firmly in the ground, her body coiling low against it, ready to vault',
          active: 'mid-air pole vault — swinging up and over the planted staff, both hands on it, legs tucked high, apron flying',
          recovery: 'landing lightly on both feet, pulling the staff up out of the ground back into her hands',
        },
        'eighty-sixed': {
          startup: 'lunging forward with one arm reaching out to grab, the bo staff braced under her other arm, fierce focus',
          active: 'a vault-kick — braced one-handed on the planted staff, both feet driving forward together in a dropkick at chest height',
          recovery: 'flipping backward off the kick, landing in a ready guard well away, staff back in both hands',
        },
        throw: {
          startup: 'lunging forward, staff sweeping a low hooking arc at ankle height, free hand reaching out to grab',
          active: 'lunging deep forward, her free arm fully extended toward the right frame edge, hand actively clutching the empty air at collar height, a small white impact flash obscuring her fingers, staff braced upright in her other hand',
          recovery: 'releasing the shove, staff swinging back to a ready guard',
        },
      },
    },
    extra: {
      projectiles: {
        'order-up': {
          prompt:
            'A small scruffy terrier dog sprinting at full speed to the right, ears pinned back, legs stretched mid-gallop, determined face, painted cel-shaded anime style, side view, full body, on solid flat chroma-key green background #00B140, no text, no watermark.',
        },
        'mise-en-place': {
          prompt:
            'A fan of three gleaming steel kitchen chef knives flying point-first to the right in a slight spread, subtle motion streaks, painted cel-shaded anime style, on solid flat chroma-key green background #00B140, no character, no hands, no text, no watermark.',
        },
      },
    },
  },
  flo: {
    canonical: 'assets/raw/canonical/flo.png',
    layout: 'v2',
    // the spliff is his staff — it kept a 50/50 survival rate in early tests
    always:
      'A thin smoking spliff ALWAYS hangs from the corner of his mouth with a faint grey smoke wisp — it must be visible in this frame. Any glowing code glyphs are AMBER-ORANGE, never green.',
    moves6: {
      stand: {
        lp: {
          startup: 'chambering a quick dismissive jab, shoulders hunched, scowling',
          active: 'long lead jab fully extended at head height, lanky arm at full reach',
          recovery: 'retracting the jab, settling back into a grumpy hunched guard',
        },
        mp: {
          startup: 'rotating the hips, winding up a stiff straight right, amber glyphs flickering at the fist',
          active: 'stiff straight cross fully extended at chin height, long reach, amber glyphs trailing the fist',
          recovery: 'pulling the cross back, shaking out the arm, unimpressed',
        },
        hp: {
          startup: 'rearing back with both fists raised overhead, amber glyphs swirling around them',
          active: 'double-fist overhand slam driven down at head height, amber glyph burst on the fists',
          recovery: 'straightening back up from the slam, cracking his neck',
        },
        lk: {
          startup: 'front knee lifting for a quick shin kick, hands kept lazily in guard',
          active: 'quick snapping kick at shin height, long leg extended',
          recovery: 'the foot returning to stance, still scowling',
        },
        mk: {
          startup: 'lead knee chambered high across the body, leaning back',
          active: 'very long rangy front push-kick fully extended at chest height, lanky leg at maximum reach',
          recovery: 'the long leg folding back down into stance',
        },
        hk: {
          startup: 'balancing on his left leg only, RIGHT knee chambered near his chest, arms counterbalanced',
          active: 'tall stepping side kick fully extended at head height, his RIGHT leg (clearly attached at the hip) driven out, amber glyphs streaking off the heel — exactly ONE foot on the ground',
          recovery: 'the kicking leg returning to the ground, slumping back into the hunched guard',
        },
      },
      crouch: {
        lp: {
          active: 'short jab snapped out at waist height from the squat',
          recovery: 'jab arm pulled back in, still compact in the squat',
        },
        mp: {
          active: 'rising elbow driven diagonally upward out of the squat, amber glyphs sparking',
          recovery: 'the elbow lowering, weight sinking back into the squat',
        },
        hp: {
          active: 'both fists thrust powerfully straight upward out of the squat, a burst of amber glyphs above them (anti-air)',
          recovery: 'arms lowering from overhead, settling back into the squat',
        },
        lk: {
          active: 'squatting on his left leg while his RIGHT leg (clearly attached at the hip) snaps a quick kick forward at ankle height',
          recovery: 'the kicking leg pulled back beneath him, both feet planted in the squat',
        },
        mk: {
          active: 'squatting on his bent left leg while his RIGHT leg (clearly attached at the hip) is fully extended forward along the ground in an extremely long low kick, lanky leg at maximum reach',
          recovery: 'sliding the long leg back beneath his body into a compact squat',
        },
        hk: {
          active: 'low spinning leg sweep fully extended along the ground, long leg covering a wide arc',
          recovery: 'rising from the sweep back toward stance, dusting off a knee',
        },
      },
      air: {
        lp: 'throwing a quick short downward-angled jab',
        mp: 'a straight punch driven at a 45-degree downward angle, amber glyphs trailing',
        hp: 'a double-fist overhead hammer blow swung downward, long arms fully extended',
        lk: 'a sharp knee strike raised toward the opponent',
        mk: 'a side kick extended at a downward angle, lanky leg at full reach',
        hk: 'a flying kick — RIGHT leg fully extended with an amber glyph trail, LEFT leg tucked beneath him, both legs clearly attached',
      },
      specials: {
        'fork-bomb': {
          startup: 'pulling a battered black laptop from behind his back with one hand, arm cocking back to lob it, eyeing the arc',
          active: 'arm in full follow-through after lobbing the laptop — the laptop tumbling through the air ahead of him in a high arc',
          recovery: 'arms folding across his chest, watching his throw land, smug scowl',
        },
        smokescreen: {
          startup: 'taking an enormous drag on the spliff, cheeks hollowed, the ember flaring bright orange',
          active: 'head thrown forward exhaling a HUGE billowing wall of thick grey smoke from his mouth, the cloud filling the air in front of him',
          recovery: 'waving one hand through the thinning grey smoke, coughing into his fist',
        },
        'root-access': {
          startup: 'dropping low to slap one palm flat on the ground, amber code glyphs racing from his hand along the floor',
          active: 'kneeling with his arm driven into the ground, a black network cable erupting UP out of the floor ahead of him in a whipping arc, amber sparks at its tip',
          recovery: 'yanking the hand back from the floor and rising, the last amber glyphs fading from the ground',
        },
        'sudo-kill': {
          startup: 'both hands raised typing furiously in the air on a floating translucent amber holographic terminal window in front of him',
          active: 'both palms thrust forward, a short-range cone of amber-orange flame mixed with glowing code fragments erupting from his hands',
          recovery: 'shaking out his wrists, amber embers fading between his fingers, deeply unimpressed scowl',
        },
        throw: {
          startup: 'lunging forward, one hand snatching at collar height in front of him, fingers splayed to grab',
          active: 'lurching forward, both lanky arms thrust out toward the right frame edge, hands clawed actively grabbing the empty air, a small grey impact burst obscuring his hands, scowling',
          recovery: 'shoving both palms forward dismissively, exhaling smoke, straightening his hoodie',
        },
        'blunt-puff': {
          startup: 'rolling a comically oversized blunt between his long fingers, licking the paper to seal it, eyebrows raised in concentration',
          active: 'lips pursed exhaling a single fat donut-ring puff of thick grey smoke that drifts forward away from him, smug half-lidded eyes',
          recovery: 'flicking ash off the giant blunt with one finger, unbothered scowl, grey wisps curling',
        },
      },
    },
    extra: {
      projectiles: {
        'fork-bomb': {
          prompt:
            'A single battered black laptop computer tumbling through the air half-open, subtle motion streaks, painted cel-shaded anime style, small, centered, on solid flat chroma-key green background #00B140, no character, no hands, no text, no watermark.',
        },
        'fork-bomb-burst': {
          prompt:
            'A burst of overlapping glowing amber-orange holographic terminal windows exploding outward from a center point, filled with abstract unreadable glyph fragments, painted cel-shaded anime style, centered, on solid flat chroma-key green background #00B140, no character, no readable words, no watermark.',
        },
        smokescreen: {
          prompt:
            'A single thick billowing cloud of grey-white smoke, dense and opaque in the center with curling wisps at the edges, painted cel-shaded anime style, centered, on solid flat chroma-key green background #00B140, no character, no text, no watermark.',
        },
        'root-access': {
          prompt:
            'A coiled black network ethernet cable whipping upward out of the ground in a sharp rising arc, glowing amber sparks at the connector tip, painted cel-shaded anime style, centered, on solid flat chroma-key green background #00B140, no character, no text, no watermark.',
        },
        'sudo-kill': {
          prompt:
            'A billowing cone-shaped burst of amber-orange fire mixed with fragments of glowing abstract unreadable code glyphs, pointing to the right, painted cel-shaded anime style, on solid flat chroma-key green background #00B140, no character, no readable words, no watermark.',
        },
        'blunt-puff': {
          prompt:
            'A single fat donut-shaped ring of thick grey-white smoke drifting to the right, dense and opaque with soft curling wisps trailing behind it, painted cel-shaded anime style, centered, on solid flat chroma-key green background #00B140, no character, no text, no watermark.',
        },
      },
    },
  },
  kirby: {
    canonical: 'assets/raw/canonical/kirby.png',
    layout: 'v2',
    // "Firebreather": acrobatic fire-breathing contortionist. Flexible yoga
    // forms, standing-splits and handsprings. NO teacup, NOTHING in her mouth.
    always:
      'She is an extremely flexible acrobatic fire-breathing yogi — barefoot in fitted athletic yoga wear, lithe and limber, with a smug confident smile. She holds NO teacup and has NOTHING in her mouth (no cup, no match, no cigarette).',
    moves6: {
      stand: {
        lp: {
          startup: 'chambering a quick open-palm jab near the cheek, poised and limber',
          active: 'quick open-palm jab fully extended at head height, fingers together, wrist snapped',
          recovery: 'drawing the palm back with a smug tilt of the head',
        },
        mp: {
          startup: 'torso coiling with dancer poise, winding an open-palm strike back at the waist',
          active: 'open-palm strike fully extended at chest height, hips rotated through the hit',
          recovery: 'retracting the palm, flowing back into a light springy stance',
        },
        hp: {
          startup: 'both palms drawn back stacked at one hip, weight loaded onto the front leg',
          active: 'double-palm thrust driven forward at chest height, both arms fully extended, a faint orange heat-shimmer off the palms',
          recovery: 'lowering both arms, recentering with a smirk',
        },
        lk: {
          startup: 'front knee lifting for a quick snap kick, arms floating for balance',
          active: 'quick snapping front kick at shin height, one leg extended, exactly ONE foot on the ground',
          recovery: 'the foot returning lightly to a springy stance',
        },
        mk: {
          startup: 'lead knee chambered high across the body, spine arched, arms floating',
          active: 'a flexible high roundhouse kick fully extended at chest height, one leg at full reach, exactly ONE foot on the ground',
          recovery: 'swinging the leg smoothly back down into stance',
        },
        hk: {
          startup: 'balancing on her LEFT leg only, her RIGHT leg (clearly attached at the hip) lifting into a vertical standing-split chamber, knee near her chest, perfectly poised',
          active: 'a vertical standing-split kick at full extension — balancing on her LEFT leg, her RIGHT leg driven straight up with the heel above her own head, exactly ONE foot on the ground',
          recovery: 'lowering the raised leg with dancer-like control, both feet planted',
        },
      },
      crouch: {
        lp: {
          active: 'a short open-palm jab snapped out at waist height from the low squat',
          recovery: 'the palm drawn back in, staying compact in the squat',
        },
        mp: {
          active: 'a rising open-palm strike lifting diagonally upward out of the squat',
          recovery: 'the palm lowering, weight sinking back into the squat',
        },
        hp: {
          active: 'both palms thrust straight upward out of the squat, a faint orange heat-shimmer above them (anti-air)',
          recovery: 'arms lowering from overhead, settling back into the squat',
        },
        lk: {
          active: 'squatting on her LEFT leg while her RIGHT leg (clearly attached at the hip) snaps a quick kick forward at ankle height',
          recovery: 'the kicking leg drawn back beneath her, both feet planted in the squat',
        },
        mk: {
          active: 'squatting low on her bent LEFT leg while her RIGHT leg (clearly attached at the hip) extends forward along the ground in a long low kick',
          recovery: 'sliding the long leg back beneath her body into a compact squat',
        },
        hk: {
          active: 'a low spinning splits-sweep fully extended along the ground, one leg carving a wide arc, palms lightly touching the floor',
          recovery: 'flowing back up out of the splits toward stance',
        },
      },
      air: {
        lp: 'throwing a quick short downward open-palm jab, body tucked',
        mp: 'a straight open-palm strike driven at a 45-degree downward angle',
        hp: 'a double-palm downward press swung with both arms fully extended',
        lk: 'a sharp knee strike raised toward the opponent, body tucked mid-flip',
        mk: 'a side kick extended at a downward angle, one leg at full reach',
        hk: 'a flying acrobatic scissor kick — RIGHT leg fully extended, LEFT leg tucked beneath her, both legs clearly attached',
      },
      specials: {
        'fire-breath': {
          startup: 'drawing a deep breath, cheeks puffed, an orange ember glowing brightly between her lips',
          active: 'head thrown forward breathing a billowing cone of orange fire from her mouth, arms flung back',
          recovery: 'wiping her mouth with the back of a hand, a wisp of smoke curling from her lips, smirking',
        },
        'sonic-scream': {
          startup: 'inhaling sharply, both hands cupped around her mouth, throat swelling, eyes wide',
          active: 'mouth wide open unleashing a piercing scream — visible concentric white-blue shockwave rings blasting forward from her mouth',
          recovery: 'catching her breath, one hand drifting to her throat, poised',
        },
        cartwheel: {
          startup: 'coiling low, both arms reaching down to one side, one leg lifting, ready to spring into a cartwheel',
          active: 'a rising cartwheel-handspring kick — body inverted mid-cartwheel, both legs whipping up and over in a vertical arc, hands leaving the ground',
          recovery: 'landing lightly on both feet out of the cartwheel, springy and balanced',
        },
        throw: {
          startup: 'one hand reaching out to grip at wrist height, pulling inward, weight shifting onto one leg',
          active: 'springing forward, both arms fully extended toward the right frame edge, hands actively snatching at the empty air, a small orange impact flash obscuring her fingers, body coiled to flip',
          recovery: 'landing lightly in a poised contortionist stance, arms out for balance',
        },
        'cat-scratch': {
          startup: 'both hands raised as claws beside her face, fingers curled, a feline grin, hips coiled low',
          active: 'a blur of rapid-fire claw swipes — both arms multiplied into overlapping motion-blur arcs of slashing open-hand claw strikes in front of her, orange scratch streaks crossing',
          recovery: 'shaking out both hands and flexing her fingers like a satisfied cat, smug smirk',
        },
      },
    },
    extra: {
      projectiles: {
        'fire-breath': {
          prompt:
            'A billowing cone-shaped burst of orange and red fire with curling heat wisps, pointing to the right, painted cel-shaded anime style, on solid flat chroma-key green background #00B140, no character, no text, no watermark.',
        },
        'sonic-scream': {
          prompt:
            'A series of concentric translucent white and pale-blue sonic shockwave rings expanding outward to the right, a visible sound wave, painted cel-shaded anime style, centered, on solid flat chroma-key green background #00B140, no character, no text, no watermark.',
        },
      },
    },
  },
  yulia: {
    canonical: 'assets/raw/style-tests/char-yulia-b-painted.png',
    layout: 'v2',
    moves6: {
      stand: {
        lp: {
          startup: 'chambering a fast lead jab, shoulder rolled in',
          active: 'lead jab fully extended at head height, sharp and fast',
          recovery: 'retracting the jab back to guard',
        },
        mp: {
          startup: 'rotating the hips, winding up a straight right cross',
          active: 'straight cross fully extended at chin height, shoulder driven through the punch',
          recovery: 'pulling the cross back into a tight guard',
        },
        hp: {
          startup: 'torso coiled winding up a big spinning backfist, red aura sparking at the fist',
          active: 'spinning backfist connecting at head height, red aura streaking in an arc behind the fist',
          recovery: 'finishing the spin, arm settling back into stance',
        },
        lk: {
          startup: 'lead knee lifted, chambering a quick snap kick',
          active: 'crisp snapping front kick at shin height',
          recovery: 'foot returning to stance',
        },
        mk: {
          startup: 'knee raised across the body, chambering a high roundhouse',
          active: 'high roundhouse kick fully extended at chest height',
          recovery: 'swinging the leg back down into stance',
        },
        hk: {
          startup: 'balancing on her left leg only, her RIGHT leg (clearly attached at the hip) raised straight up in a flexible axe-kick chamber, knee near her chest, heel above head height',
          active: 'balancing on her left leg only, her RIGHT leg fully extended finishing a downward axe kick at chest height, red aura streaking behind the heel — exactly ONE foot on the ground',
          recovery: 'the kicking leg returning to the ground, settling back into stance, both feet planted',
        },
      },
      crouch: {
        lp: {
          active: 'short straight jab snapped out at waist height from the squat',
          recovery: 'jab arm pulled back to her chin, both feet planted flat in the squat',
        },
        mp: {
          active: 'rising uppercut punched diagonally upward out of the squat',
          recovery: 'uppercut arm returning down, weight sinking back into the squat',
        },
        hp: {
          active: 'both palms thrust powerfully straight upward out of the squat, red aura flaring (anti-air)',
          recovery: 'arms lowering from overhead, settling back into the squat',
        },
        lk: {
          active: 'squatting on her left leg while her RIGHT leg (clearly attached at the hip) snaps a quick kick forward at ankle height',
          recovery: 'the kicking leg pulled back beneath her, both feet planted in the squat',
        },
        mk: {
          active: 'squatting on her bent left leg while her RIGHT leg (clearly attached at the hip) is fully extended forward along the ground in a long low side kick',
          recovery: 'sliding the extended right leg back beneath her body, returning to a compact squat, both feet planted',
        },
        hk: {
          active: 'low spinning slide sweep, both legs extended along the ground mid-rotation',
          recovery: 'unwinding from the sweep spin, rising to one knee',
        },
      },
      air: {
        lp: 'throwing a quick short downward-angled jab',
        mp: 'straight punch driven at a 45-degree downward angle',
        hp: 'double-fist overhead hammer blow swung downward, red aura trailing',
        lk: 'sharp knee strike raised toward the opponent',
        mk: 'side kick extended at a downward angle, body tilted',
        hk: 'body tilted delivering a powerful flying roundhouse — RIGHT leg fully extended with a red aura trail, LEFT leg tucked beneath her, both legs clearly attached',
      },
      specials: {
        'cossack-spiral': {
          startup: 'coiled low in a cossack-squat wind-up, fists clenched, red rage aura igniting',
          active: 'mid-spin advancing strike, leg extended in a rising spiral, fierce red rage aura flaring',
          recovery: 'landing from the spiral, exhaling, embers of red aura fading',
        },
        'backbend-guillotine': {
          startup: 'leaning impossibly far backwards in a matrix-style limbo, palms hovering near the ground behind her, one leg beginning to rise',
          active: 'snapping up out of the backbend, her RIGHT leg (clearly attached at the hip) whipping over in a huge overhead arc, heel dropping like a guillotine, red aura crescent — exactly one foot on the ground',
          recovery: 'the heel planted after the guillotine drop, rising back to stance, hair settling',
        },
        'volga-piledriver': {
          startup: 'lunging forward low with both arms spread wide open for a grapple, fingers splayed, red rage aura flaring',
          active: 'mid-leap spinning piledriver — airborne, body corkscrewed, arms locked in a grappling hold, red aura spiraling around her',
          recovery: 'crouched low in a deep squat after the slam, one fist punched straight down onto the ground, the other fist raised in guard, red aura fading — a small tight puff of dust and a few embers around the grounded fist, the dust kept compact and well away from every edge of the frame',
        },
        'braid-lariat': {
          startup: 'arms rising out to her sides, beginning to spin, her braid lifting with the rotation',
          active: 'a full spinning lariat — both arms out horizontal mid-spin, braid whipping in a circle, a red aura ring around her upper body',
          recovery: 'the spin slowing, arms lowering, braid settling back over her shoulder',
        },
        throw: {
          startup: 'both hands reaching out to grip at collar height, hips already turning into a throw',
          active: 'driving forward, both arms fully extended toward the right frame edge, hands actively clutching the empty air in a collar grip, a small red impact flash obscuring her fists, hips loaded to throw',
          recovery: 're-settling her braid, straightening up, weight already back on both feet',
        },
        'spinning-star-kick': {
          startup: 'dropping into a low coiled charge on one bent leg, fists guarding, red aura gathering around her feet',
          active: 'an inverted helicopter spinning kick — body tilted horizontal mid-spin, both legs whipping around in a flat circular arc, red aura star-trails streaking off both heels, braid flying',
          recovery: 'landing from the spin on one knee, braid whipping around her shoulder, red embers fading at her feet',
        },
      },
    },
    extra: {},
  },

  freeman: {
    canonical: 'assets/raw/canonical/freeman.png',
    layout: 'v2',
    // "The Still Point": serene counter/turtle yogi. Palm strikes over fists,
    // flowing yoga forms, soft white-gold chi (never green, never crimson).
    always:
      'He always wears mala prayer beads on one wrist, loose linen clothes, and is barefoot, with a calm serene half-smile even mid-combat. Any energy or aura he channels is soft warm WHITE-GOLD light, never green.',
    moves6: {
      stand: {
        lp: {
          startup: 'chambering a relaxed open-palm jab near the cheek, weight centered, calm',
          active: 'quick open-palm jab fully extended at head height, fingers together, heel of the palm leading',
          recovery: 'drawing the palm back into a soft centered guard',
        },
        mp: {
          startup: 'sinking the hips and winding one open palm back at the waist, a faint white-gold glow gathering in the palm',
          active: 'straight open-palm chi strike fully extended at chest height, a soft white-gold pulse blooming from the palm heel',
          recovery: 'retracting the palm, breathing out, settling back to stance',
        },
        hp: {
          startup: 'both palms drawn back to one hip, stacked, white-gold light gathering between them',
          active: 'double-palm thrust driven forward at chest height, arms fully extended, a bright white-gold burst off both palm heels',
          recovery: 'lowering both arms slowly, the glow fading, recentering',
        },
        lk: {
          startup: 'front knee lifting for a short quick front kick, hands kept in a calm guard',
          active: 'quick snapping front kick at shin height, one leg extended, exactly ONE foot on the ground',
          recovery: 'the foot returning softly to stance',
        },
        mk: {
          startup: 'lead knee chambered high across the body, arms floating for balance',
          active: 'long controlled front push-kick fully extended at waist height, one leg at full reach, exactly ONE foot on the ground',
          recovery: 'the leg folding smoothly back down into stance',
        },
        hk: {
          startup: 'balancing on his LEFT leg only, RIGHT knee chambered high, arms spread for balance',
          active: 'a tall flowing crescent kick, his RIGHT leg (clearly attached at the hip) sweeping up and over at head height in a graceful arc, exactly ONE foot on the ground',
          recovery: 'the leg descending slowly, returning to a centered stance',
        },
      },
      crouch: {
        lp: {
          active: 'a short open-palm jab pushed out at waist height from the low squat',
          recovery: 'the palm drawn back in, staying compact in the squat',
        },
        mp: {
          active: 'a rising open-palm strike lifting diagonally upward out of the squat, faint white-gold trail',
          recovery: 'the palm lowering, weight sinking back into the squat',
        },
        hp: {
          active: 'both palms thrust straight upward out of the squat, a soft white-gold burst above them (anti-air)',
          recovery: 'arms lowering from overhead, settling back into the squat',
        },
        lk: {
          active: 'squatting on his LEFT leg while his RIGHT leg (clearly attached at the hip) snaps a quick low kick forward at ankle height',
          recovery: 'the kicking leg drawn back beneath him, both feet planted in the squat',
        },
        mk: {
          active: 'squatting low on his bent LEFT leg while his RIGHT leg (clearly attached at the hip) extends forward along the ground in a long low kick',
          recovery: 'sliding the long leg back beneath his body into a compact squat',
        },
        hk: {
          active: 'a low flowing leg sweep fully extended along the ground, one leg carving a wide arc',
          recovery: 'rising smoothly from the sweep back toward stance',
        },
      },
      air: {
        lp: 'throwing a quick short downward open-palm jab',
        mp: 'a straight open-palm strike driven at a 45-degree downward angle, faint white-gold trail',
        hp: 'a double-palm downward press swung with both arms fully extended',
        lk: 'a sharp knee strike raised toward the opponent',
        mk: 'a side kick extended at a downward angle, one leg at full reach',
        hk: 'a flowing airborne crescent kick — RIGHT leg fully extended with a soft white-gold trail, LEFT leg tucked beneath him, both legs clearly attached',
      },
      specials: {
        // Presence: meditation counter-stance that teleports behind the attacker
        presence: {
          startup: 'settling into a serene meditative counter-stance, eyes closed, both palms pressed together at the chest, a faint white-gold halo forming around him',
          active: 'blurring into a streak of soft white-gold light and reappearing mid-step driving a single open-palm strike forward, motion trails behind him',
          recovery: 'lowering the striking palm, eyes reopening calm, settling back to a centered stance',
        },
        // Breathwork: charges "inner peace" armor that absorbs a hit
        breathwork: {
          startup: 'drawing a deep slow breath, both hands sweeping inward to gather energy at his center, faint white-gold motes converging',
          active: 'holding the breath, standing perfectly still with a glowing translucent white-gold aura shell wrapped around his whole body',
          recovery: 'exhaling slowly, the aura shell sinking calmly into his skin, arms lowering',
        },
        // Sun Salutation: flowing yoga sequence, a 3-hit combo ending in crow pose
        'sun-salutation': {
          startup: 'sweeping both arms up overhead into an upward salute, spine arched, rising onto the balls of his feet, white-gold light tracing his arms',
          active: 'flowing forward through a sweeping yoga sequence of open-palm strikes, both arms carving bright white-gold arcs across the space in front of him',
          recovery: 'folding down into crow pose — balanced on both hands with knees resting on the elbows and both feet lifted off the ground, serene and steady',
        },
        throw: {
          startup: 'stepping in, one calm open palm reaching to catch at wrist height in front of him',
          active: 'stepping deep forward, both arms fully extended toward the right frame edge, open hands actively grasping the empty air, a soft white-gold impact flash obscuring his palms, breath steady',
          recovery: 'settling back into a serene stance, palms lowering, breath unbroken',
        },
        'yoga-float': {
          startup: 'sweeping both arms upward in a slow arc, rising onto his toes, white-gold light pooling beneath his feet',
          active: 'seen in full SIDE PROFILE facing right (never facing the camera): floating serenely in mid-air in a full lotus position — legs crossed, palms resting open on his knees, spine tall, nose and beard pointing toward the right frame edge, a soft white-gold glow radiating beneath him',
          recovery: 'uncrossing his legs mid-descent, landing softly on both bare feet, breath unbroken, the glow fading',
        },
      },
    },
    extra: {},
  },
  gene: {
    canonical: 'assets/raw/canonical/gene.png',
    layout: 'v2',
    always:
      'Any glitch effects, pixel-sorting artifacts or holographic UI around him are MAGENTA, HOT PINK and AMBER — never green, never teal. His AR glasses have a faint warm amber HUD glow.',
    moves6: {
      stand: {
        lp: {
          startup: 'chambering a quick loose jab, shoulders relaxed, smirking',
          active: 'quick jab extended at head height, a few magenta glitch pixels trailing the fist',
          recovery: 'retracting the jab, hand flicking as if dismissing a popup',
        },
        mp: {
          startup: 'winding up a straight palm, amber HUD elements flickering around the hand',
          active: 'straight palm strike extended at chest height, a burst of hot-pink pixel artifacts on impact point',
          recovery: 'drawing the palm back, glitch pixels dissolving',
        },
        hp: {
          startup: 'both hands raised, fingers spread, magenta glitch energy gathering between them',
          active: 'double-palm blast pushed forward at chest height, a shower of magenta and amber pixel-sorting streaks',
          recovery: 'lowering the hands, the last pixels fizzling out',
        },
        lk: {
          startup: 'front knee lifting for a quick low kick, hands loose',
          active: 'quick snapping kick at shin height, sneaker sole forward',
          recovery: 'the foot returning to a springy stance',
        },
        mk: {
          startup: 'hips turning, one leg chambering across the body',
          active: 'roundhouse kick extended at chest height — exactly ONE foot planted firmly on the ground, NOT jumping',
          recovery: 'the leg swinging back down into stance',
        },
        hk: {
          startup: 'balancing on his left leg only, RIGHT knee chambered high, arms counterbalanced',
          active: 'tall side kick fully extended at head height, his RIGHT leg (clearly attached at the hip) driven out, magenta glitch trail off the heel — exactly ONE foot on the ground',
          recovery: 'the kicking leg lowering, settling back into the smirking stance',
        },
      },
      crouch: {
        lp: {
          active: 'short jab snapped out at waist height from the squat',
          recovery: 'jab arm pulled back in, still compact in the squat',
        },
        mp: {
          active: 'rising palm thrust angled upward out of the squat, amber HUD ring flickering',
          recovery: 'the arm settling down, weight sinking back into the squat',
        },
        hp: {
          active: 'both palms thrust powerfully straight upward out of the squat, a column of magenta glitch pixels above them (anti-air)',
          recovery: 'arms lowering from overhead, settling back into the squat',
        },
        lk: {
          active: 'squatting on his left leg while his RIGHT leg (clearly attached at the hip) snaps a quick kick forward at ankle height',
          recovery: 'the kicking leg pulled back beneath him, both feet planted in the squat',
        },
        mk: {
          active: 'squatting on his bent left leg while his RIGHT leg (clearly attached at the hip) is fully extended forward along the ground in a long low kick',
          recovery: 'sliding the extended leg back beneath him into a compact squat',
        },
        hk: {
          active: 'low spinning leg sweep fully extended along the ground, glitch pixels scattering off the shoe',
          recovery: 'rising from the sweep back toward stance',
        },
      },
      air: {
        lp: 'throwing a quick short downward-angled jab',
        mp: 'a straight punch driven at a 45-degree downward angle, pink pixel trail',
        hp: 'a double-fist overhead hammer blow swung downward, magenta glitch burst',
        lk: 'a sharp knee strike raised toward the opponent',
        mk: 'a side kick extended at a downward angle, body tilted',
        hk: 'a flying kick — RIGHT leg fully extended with a magenta glitch trail, LEFT leg tucked beneath him, both legs clearly attached',
      },
      specials: {
        'diffusion-strike': {
          startup: 'his whole body beginning to DISSOLVE into coarse magenta-and-amber denoising static, edges crumbling into pixels, grinning',
          active: 'body half-rematerializing from a cloud of magenta pixel static, one palm already extended forward, eyes glowing amber',
          recovery: 'the last static pixels snapping into place, body fully solid again, adjusting his AR glasses',
        },
        'diffusion-escape': {
          startup: 'his whole body beginning to DISSOLVE into coarse magenta-and-amber denoising static, leaning backward, edges crumbling into pixels',
          active: 'body mostly gone — just a person-shaped cloud of magenta and amber static pixels streaming backward',
          recovery: 'rematerializing from static in a relaxed backward-leaning stance, dusting pixel fragments off his t-shirt sleeve',
        },
        'rate-limit': {
          startup: 'both hands raised typing rapidly on a floating translucent amber holographic panel, magenta warning glyphs flashing',
          active: 'one arm thrust forward deploying a large translucent amber holographic barrier pane in front of him, hot-pink border, hand splayed',
          recovery: 'lowering the arm, the last amber interface fragments dissolving around his fingers',
        },
        hallucination: {
          startup: 'one hand raised snapping his fingers, a person-shaped cloud of magenta static beginning to form in front of him',
          active: 'arm extended presenting forward as a glitchy static-filled human silhouette strides away from his open hand, magenta and amber pixels trailing',
          recovery: 'crossing his arms with a smug grin, a few last pink pixels drifting off his sleeve',
        },
        throw: {
          startup: "grabbing a fistful of the opponent's collar with one hand, AR glasses flickering",
          active: 'hauling the opponent close and shoving them backward with both hands, like force-quitting a process',
          recovery: 'straightening his blazer, glasses resettling on his nose',
        },
        'mana-burst': {
          startup: 'one hand drawn back at the hip charging a swirling orb of magenta and amber energy, glowing HUD rings spinning around his wrist',
          active: 'palm thrust fully forward having just launched an energy orb, magenta and hot-pink pixel-sorting streaks trailing off his open hand, amber HUD fragments scattering',
          recovery: 'the arm lowering, shaking out his fingers, the last amber interface fragments dissolving',
        },
      },
    },
    extra: {
      projectiles: {
        hallucination: {
          useCanonical: true,
          prompt:
            'A glitchy corrupted half-rendered CLONE of the person in the reference image, same outfit and face, walking forward mid-stride, large parts of the body dissolving into coarse MAGENTA, HOT PINK and AMBER pixel-sorting static and scanline artifacts, semi-transparent in places, painted cel-shaded anime style, full body, facing right, on solid flat chroma-key green background #00B140, exactly one figure, no text, no watermark.',
        },
        'hallucination-burst': {
          prompt:
            'A human-silhouette-shaped explosion of MAGENTA, HOT PINK and AMBER glitch pixels and scanline fragments bursting outward, no recognizable person left, painted cel-shaded anime style, centered, on solid flat chroma-key green background #00B140, no character, no text, no watermark.',
        },
        'rate-limit': {
          prompt:
            'A large translucent AMBER holographic rectangular barrier pane floating upright, hot-pink glowing border, subtle scanlines, the number "429" glowing large in the center in a blocky digital font, painted cel-shaded anime style, centered, on solid flat chroma-key green background #00B140, no character, no other text, no watermark.',
        },
        'mana-burst': {
          refPaths: ['assets/character-inspo/eden-mana-logo.png'],
          prompt:
            'Recreate the EXACT geometric logo mark from the reference image as a flying energy projectile: keep its precise silhouette, facet layout and flat colors (the tall faceted diamond in pale grey-lavender and deep navy with the darker inner diamond core, plus the four separate triangular star-point shards at its sides) — the whole mark wrapped in a blazing MAGENTA and hot-pink energy aura with amber sparks, pixel-sorting streaks trailing behind it to the left, painted cel-shaded anime style, the logo mark itself crisp and unchanged in the center, on solid flat chroma-key green background #00B140, no character, no readable text, no watermark.',
        },
      },
    },
  },
  marzipan: {
    canonical: 'assets/raw/canonical/marzipan.png',
    layout: 'v2',
    always:
      'Thin DARK OLIVE-BROWN woody vines with tiny warm-yellow leaves and small pink blossoms ALWAYS curl around both of his forearms — visible in every frame, never bright green vines. He fights with calm, rooted, flowing druid movements.',
    moves6: {
      stand: {
        lp: {
          startup: 'one open palm drawing back gently, weight sinking into a rooted stance',
          active: 'soft open-palm strike extended at chest height, vine leaves fluttering off the forearm',
          recovery: 'the palm floating back into a calm guard',
        },
        mp: {
          startup: 'both hands circling like parting tall grass, one palm chambering',
          active: 'firm double-palm push extended at chest height, yellow leaves scattering from the impact',
          recovery: 'hands settling back into a slow flowing guard',
        },
        hp: {
          startup: 'both arms rising overhead like growing branches, vines tightening',
          active: 'heavy double-fist branch slam driven down at head height, leaves and petals bursting from the vines',
          recovery: 'arms swaying back down like settling boughs',
        },
        lk: {
          startup: 'front knee lifting softly, arms balanced like a crane',
          active: 'quick snapping front kick at shin height, trouser cuff flaring',
          recovery: 'the foot placed back down deliberately, rooted again',
        },
        mk: {
          startup: 'hips turning, one leg chambering across the body',
          active: 'roundhouse kick extended at chest height, dreadlocks swinging with the turn — exactly ONE foot planted firmly on the ground, NOT jumping',
          recovery: 'the leg folding back down into the rooted stance',
        },
        hk: {
          startup: 'balancing on his left leg only, RIGHT knee chambered high, arms spread like branches',
          active: 'tall side kick fully extended at head height, his RIGHT leg (clearly attached at the hip) driven out, petals trailing off the vines — exactly ONE foot on the ground',
          recovery: 'the kicking leg lowering slowly with total control, both feet planted',
        },
      },
      crouch: {
        lp: {
          active: 'short open-palm jab snapped out at waist height from the squat',
          recovery: 'the palm drawn back in, still compact in the squat',
        },
        mp: {
          active: 'rising double-palm push angled upward out of the squat, leaves swirling',
          recovery: 'hands lowering, weight sinking back into the squat',
        },
        hp: {
          active: 'both arms thrust powerfully straight upward out of the squat like a sapling shooting up, petals bursting (anti-air)',
          recovery: 'arms lowering from overhead, settling back into the squat',
        },
        lk: {
          active: 'squatting on his left leg while his RIGHT leg (clearly attached at the hip) snaps a quick kick forward at ankle height',
          recovery: 'the kicking leg pulled back beneath him, both feet planted in the squat',
        },
        mk: {
          active: 'squatting on his bent left leg while his RIGHT leg (clearly attached at the hip) is fully extended forward along the ground in a long low kick',
          recovery: 'sliding the extended leg back beneath him into a compact squat',
        },
        hk: {
          active: 'a sliding low sweep — leaning forward on both hands, RIGHT leg extended along the ground, body low like creeping kudzu',
          recovery: 'gathering the leg back beneath him, rising halfway from the slide',
        },
      },
      air: {
        lp: 'throwing a quick downward-angled palm strike, dreads floating',
        mp: 'a double-palm push angled 45 degrees downward, leaves trailing',
        hp: 'an overhead double-fist branch slam swung downward, vines streaming above',
        lk: 'a sharp knee strike raised toward the opponent, arms balanced wide',
        mk: 'a side kick extended at a downward angle, patchwork jacket flaring',
        hk: 'a flying kick — RIGHT leg fully extended with a trail of petals, LEFT leg tucked beneath him, both legs clearly attached',
      },
      specials: {
        overgrowth: {
          startup: 'kneeling on one knee, pressing a single glowing seed into the ground with two fingers, focused and gentle',
          active: 'crouched low with one palm (clearly attached to his arm) pressed flat on the ground, pale glowing roots rippling outward across the soil from under his hand',
          recovery: 'rising back to standing, brushing soil from his fingers',
        },
        'spore-bloom': {
          startup: 'pulling a handful of purple mushroom spores from the seed pouch, cupping them in both hands',
          active: 'blowing the spores gently off his open palms — a drifting cloud of purple-pink spore motes floating away in front of him',
          recovery: 'lowering his hands, a few last spore motes sparkling around them',
        },
        symbiosis: {
          startup: 'lunging forward with both arms open wide, the forearm vines uncoiling and reaching out hungrily',
          active: 'both arms wrapped forward in a bear-hug grapple, the vines coiling tight around empty space in front of his chest, small flowers blooming along them',
          recovery: 'stepping back with arms opening, the vines settling back around his forearms, looking faintly apologetic',
        },
        throw: {
          startup: 'a short vine whipping out from his wrist, coiling in the air just in front of him',
          active: 'lunging forward, both vine-wrapped arms fully extended toward the right frame edge, hands actively clutching the empty air, a small burst of yellow leaves and pink petals obscuring his hands',
          recovery: 'the vine unwinding and retracting back into his sleeve',
        },
        'vine-spear': {
          startup: 'one vine-wrapped arm drawn far back, the forearm vine uncoiling and stiffening into a sharpened spear point hovering beside his shoulder, eyes narrowed',
          active: 'the arm thrust fully forward, a long dark olive-brown vine lance shooting out horizontally from his forearm toward the right frame edge, warm-yellow leaves scattering along its length',
          recovery: 'the vine retracting and coiling lazily back around his forearm, a few pink petals drifting down',
        },
      },
    },
    extra: {
      projectiles: {
        overgrowth: {
          prompt:
            'A single small glowing seed pod half-buried in a little mound of dark soil, faint warm light pulsing from the crack in the pod, painted cel-shaded anime style, small, centered, on solid flat chroma-key green background #00B140, no character, no text, no watermark.',
        },
        'overgrowth-burst': {
          prompt:
            'A thick dark olive-brown woody vine column ERUPTING vertically upward from a burst of soil, coiling tendrils with warm-yellow leaves and pink blossoms whipping out to the sides, tall and violent, painted cel-shaded anime style, centered, on solid flat chroma-key green background #00B140, no character, never bright green, no text, no watermark.',
        },
        'spore-bloom': {
          prompt:
            'A soft drifting cloud of purple and pink mushroom spores, dozens of tiny glowing motes inside a hazy lavender puff, dreamy and toxic, painted cel-shaded anime style, centered, on solid flat chroma-key green background #00B140, no character, no text, no watermark.',
        },
        'vine-spear': {
          prompt:
            'A long straight dark olive-brown woody vine lance shooting horizontally to the right, sharpened pale glowing thorn tip like a rose-thorn spearhead, small warm-yellow leaves and a few pink blossoms trailing along its length, painted cel-shaded anime style, horizontal, on solid flat chroma-key green background #00B140, no character, never bright green, no text, no watermark.',
        },
      },
    },
  },
  bodhi: {
    canonical: 'assets/raw/canonical/bodhi.png',
    layout: 'v2',
    // wardrobe must persist; zodiac star-glyphs are GOLD and appear ONLY where
    // a pose asks (Ascendant) — no stray glyphs, never green effects
    always:
      'He ALWAYS wears the open mustard-yellow fur-hooded parka over a tan tank top, yellow shorts, a maroon knit beanie and black high-top sneakers — every piece visible. He is a calm, powerfully-built grappler. Any zodiac constellation star-glyph effects are warm GOLD and appear ONLY if this pose explicitly describes them; otherwise there are no glowing effects at all. Never any green effects.',
    moves6: {
      stand: {
        lp: {
          startup: 'chambering a quick open-palm jab at his hip, weight settling forward',
          active: 'a short straight palm-heel strike fully extended at chest height, front arm firm',
          recovery: 'drawing the palm back into a loose relaxed guard',
        },
        mp: {
          startup: 'winding a rolling forearm across his chest, shoulders loading',
          active: 'driving a forearm smash forward at chest height, full shoulder behind it',
          recovery: 'the forearm returning to a calm ready guard',
        },
        hp: {
          startup: 'raising both hands high overhead, fingers laced together for a hammer blow',
          active: 'a double-fist overhead hammer blow driven straight down at head height',
          recovery: 'straightening up from the hammer, rolling his shoulders loose',
        },
        lk: {
          startup: 'lifting the front knee for a quick low push kick',
          active: 'a short snapping front kick at shin height, planted and balanced',
          recovery: 'the foot returning softly to stance',
        },
        mk: {
          startup: 'chambering the lead knee high across his body',
          active: 'a driving knee strike thrust forward at stomach height — exactly one foot on the ground',
          recovery: 'the knee lowering, foot planting back into stance',
        },
        hk: {
          startup: 'balancing on his left leg, RIGHT knee drawn up high, arms counterbalanced',
          active: 'a heavy stepping roundhouse kick fully extended at chest height, his RIGHT leg driven across — exactly ONE foot on the ground',
          recovery: 'the kicking leg swinging back down into a grounded stance',
        },
      },
      crouch: {
        lp: {
          active: 'a short palm-heel jab snapped out at waist height from the deep squat',
          recovery: 'the palm pulled back to guard, still folded low in the squat',
        },
        mp: {
          active: 'a rising forearm driven diagonally upward out of the squat',
          recovery: 'the forearm lowering, weight sinking back into the squat',
        },
        hp: {
          active: 'both palms thrust powerfully straight upward out of the squat (anti-air)',
          recovery: 'arms lowering from overhead, settling back into the squat',
        },
        lk: {
          active: 'squatting on his left leg while his RIGHT leg snaps a quick kick forward at ankle height',
          recovery: 'the kicking leg pulled back beneath him, folded low in the squat',
        },
        mk: {
          active: 'balanced in a DEEP low squat on his bent left leg, hips near his heels, his RIGHT leg extended straight forward along the ground in a low kick at ankle height; the open parka is bunched up at his waist and pushed behind him, its hem kept well clear of his legs. He has EXACTLY two legs, two arms and one head wearing the maroon beanie — no third leg, no extra or duplicated limbs, and the yellow parka hem is fabric that must NEVER be mistaken for a leg',
          recovery: 'pulling the extended leg back beneath him into a compact deep squat, hips near his heels, hands returning to guard; his head and maroon beanie are clearly visible at the top of the figure, bearded face toward the right. He has EXACTLY two legs, two arms and one clearly-visible head — no headless torso, no third leg, no extra or duplicated limbs, and the yellow parka hem is NOT a leg',
        },
        hk: {
          active: 'crouched very low to the ground, one hand planted flat on the floor for balance, sweeping his other leg in a low spinning arc extended along the ground at ankle height, his whole body kept low; the open parka bunched at his waist and clear of his legs. He has EXACTLY two legs, two arms and one head wearing the maroon beanie — no third leg, no extra or duplicated limbs, and the yellow parka hem is NOT a leg',
          recovery: 'rising up out of the low sweep back toward his standing stance, his one head with the maroon beanie clearly visible',
        },
      },
      air: {
        lp: 'throwing a short downward-angled palm strike',
        mp: 'driving a forearm smash at a downward angle',
        hp: 'a double-fist overhead hammer swung downward, both arms extended',
        lk: 'a sharp knee raised toward the opponent below',
        mk: 'a stomping side kick angled downward',
        hk: 'a heavy downward axe kick, RIGHT leg fully extended, LEFT leg tucked beneath him, both legs clearly attached',
      },
      specials: {
        'deep-tissue': {
          startup: 'dropping into a wide low grappler crouch, both arms spread open and low, fingers splayed ready to seize',
          active: 'lunging forward off both feet, both arms sweeping together in a huge scooping bear-hug motion through the EMPTY GREEN AIR in front of his own chest, hands clasping around nothing, a small grey impact burst where his hands meet. He is COMPLETELY ALONE — a single figure grabbing empty air, absolutely NO second person, no opponent, no other body and no clone of himself anywhere in the frame',
          recovery: 'finishing in a deep braced squat as if setting a body down, both palms pressing forward, calm and satisfied',
        },
        'table-work': {
          startup: 'stepping in low, both hands reaching out to clamp onto an unseen opponent directly in front of him',
          active: 'driving one knee forward and down with both hands pressing firmly ahead at waist height, torso leaning into it as if walking his knee up a spine',
          recovery: 'straightening up smoothly, brushing both palms together, unbothered',
        },
        ascendant: {
          startup: 'coiling low, one open palm chambered at his hip, knees deeply bent ready to spring',
          active: 'rising into the air on a soaring open-palm uppercut, palm driven straight up, a burst of warm GOLD constellation star-glyphs flaring behind the raised hand, both feet off the ground',
          recovery: 'descending from the rise, the gold star-glyphs fading, landing softly on bent knees',
        },
        retrograde: {
          startup: 'dropping low and coiling one leg back beneath him, hands tucked, ready to launch a slide',
          active: 'a fast low sliding tackle skimming along the ground, leading leg extended forward, body kept flat and low',
          recovery: 'coming up out of the slide onto one knee, rising back toward stance',
        },
        throw: {
          startup: 'lunging forward, both hands snatching at chest height in front of him, fingers splayed to grab',
          active: 'both arms thrust out toward the right frame edge, hands clawed actively gripping the empty air, a small grey impact burst at his hands',
          recovery: 'pressing both palms forward to set the opponent down, then settling back into stance',
        },
      },
    },
  },
  cat: {
    canonical: 'assets/raw/canonical/cat.png',
    layout: 'v2',
    // wardrobe + living paint must persist; paint splashes are ORANGE, MAGENTA
    // and BLUE only (never green — green dies in the chroma key); she is
    // barefoot with a dancer's poise throughout
    always:
      'She ALWAYS wears the same white sundress splashed with vivid WET paint in ORANGE, MAGENTA and BLUE (never any green paint), long dark wavy hair in motion, and she is BAREFOOT with a light dancer\'s posture. She is a nimble painter-dancer trickster. Any flung paint, ribbon or thread effects are bright ORANGE, MAGENTA and BLUE — never green. No glowing effects unless this pose explicitly describes them.',
    moves6: {
      stand: {
        lp: {
          startup: 'flicking a quick backhand across her body, wrist loose, weight rising onto the balls of her feet',
          active: 'a short snapping backhand paint-flick fully extended at head height, a few bright droplets trailing off her fingertips',
          recovery: 'drawing the hand back into a light dancer\'s guard',
        },
        mp: {
          startup: 'sweeping one arm back in a wide painterly arc, torso coiling',
          active: 'a broad open-hand paint-slash swung across at chest height, a crescent of orange and magenta droplets flung along its path',
          recovery: 'the arm flowing back down into a poised guard',
        },
        hp: {
          startup: 'winding both arms back over one shoulder, rising onto one leg like a wind-up',
          active: 'a big two-handed downward paint-fling slammed forward at head height, a fan of bright droplets bursting off her hands',
          recovery: 'settling back down onto both feet, shaking paint off her fingers',
        },
        lk: {
          startup: 'lifting the front foot for a quick pointed toe-flick, arms out for balance',
          active: 'a fast pointed toe-flick kick snapped forward at shin height, dancer\'s line, arms extended for poise',
          recovery: 'the foot returning lightly to a balanced stance',
        },
        mk: {
          startup: 'chambering the lead leg high, hips turning for a spin',
          active: 'a spinning pirouette kick, the extended leg sweeping forward at stomach height, dress and hair whirling — exactly ONE foot on the ground',
          recovery: 'completing the spin and settling back onto both feet',
        },
        hk: {
          startup: 'rising tall onto the ball of one foot, the other knee lifted high, arms swept up balletically',
          active: 'a high flamenco-style heel stomp driven forward at chest height, her RIGHT leg extended hard — exactly ONE foot on the ground',
          recovery: 'the leg swinging back down into a grounded dancer\'s stance',
        },
      },
      crouch: {
        lp: {
          active: 'a short backhand paint-flick snapped out at waist height from the deep squat',
          recovery: 'the hand pulled back to guard, still folded low in the squat',
        },
        mp: {
          active: 'a rising open-hand paint-slash swept diagonally upward out of the squat, a few bright droplets trailing',
          recovery: 'the arm lowering, weight sinking back into the squat',
        },
        hp: {
          active: 'both hands flung sharply upward out of the squat, a burst of orange and magenta droplets arcing overhead (anti-air)',
          recovery: 'arms lowering from overhead, settling back into the squat',
        },
        lk: {
          active: 'squatting on her left leg while her RIGHT foot flicks a quick pointed kick forward at ankle height',
          recovery: 'the kicking foot pulled back beneath her, folded low in the squat',
        },
        mk: {
          active: 'squatting on her bent left leg while her RIGHT leg extends forward along the ground in a long low sweeping kick',
          recovery: 'sliding the long leg back beneath her into a compact squat',
        },
        hk: {
          active: 'a low spinning leg sweep fully extended along the ground in a wide graceful arc',
          recovery: 'rising from the sweep back toward her stance',
        },
      },
      air: {
        lp: 'flicking a short downward backhand, a few paint droplets trailing',
        mp: 'a broad open-hand paint-slash swung at a downward angle',
        hp: 'a two-handed downward paint-fling, both arms extended, droplets bursting outward',
        lk: 'a sharp pointed toe-kick angled downward',
        mk: 'a spinning downward pirouette kick, one leg extended',
        hk: 'a high downward flamenco heel stomp, RIGHT leg fully extended, LEFT leg tucked beneath her, both legs clearly attached',
      },
      specials: {
        'd-catarina': {
          startup: 'hunching over as an old Portuguese lady — a dark headscarf appearing over her hair, one hand gripping a wooden cane, shoulders rounded, scowling',
          active: 'the hunched old woman swinging the wooden cane hard forward in a flat horizontal whack at chest height, scowling and shouting a weather complaint',
          recovery: 'straightening back up out of the old-lady stance, the headscarf and cane gone, tossing her hair, a sly grin returning',
        },
        'flour-bomb': {
          startup: 'winding up one arm low behind her, cupping a cloth sack of colored pigment, ready to fling it at the ground ahead',
          active: 'flinging the pigment sack down and forward, a spreading burst of ORANGE, MAGENTA and BLUE powder puffing up off the ground in front of her',
          recovery: 'the arm following through low and settling back into stance, a little powder drifting off her hand',
        },
        'thread-of-life': {
          startup: 'gathering a length of bright woven loom-thread coiled between both hands, one arm cocked back',
          active: 'lashing the taut rainbow loom-thread straight out toward the right frame edge like a horizontal whip, the thread snapping tight and level',
          recovery: 'reeling the thread back in, winding it loosely around one hand, poised',
        },
        pirouette: {
          startup: 'coiling low, arms wrapped across her chest, rising onto one toe ready to spring into a spin',
          active: 'launching into a soaring rising spin kick, one leg whipped straight up overhead, a bright rainbow ribbon trailing in a spiral behind her, both feet off the ground',
          recovery: 'descending out of the spin, the ribbon fading, landing softly on bent knees',
        },
        throw: {
          startup: 'lunging in, both hands snatching at chest height in front of her, fingers splayed to grab',
          active: 'both arms thrust out toward the right frame edge, hands gripping the empty air and spinning an unseen opponent past her, a small bright paint-splatter burst at her hands',
          recovery: 'flourishing both hands open as if presenting, then settling back into a dancer\'s stance',
        },
      },
    },
    extra: {
      projectiles: {
        'flour-bomb': {
          prompt:
            'A low spreading burst of colorful pigment powder on the ground — a puff cloud of ORANGE, MAGENTA and BLUE paint dust hanging low over a splattered floor puddle, wider than it is tall, painted cel-shaded anime style, centered, on solid flat chroma-key green background #00B140, no green in the powder, no character, no text, no watermark.',
        },
        'thread-of-life': {
          prompt:
            'A single taut horizontal woven loom-thread lash stretched left-to-right like a whip, braided strands of bright ORANGE, MAGENTA and BLUE, a small frayed tuft at the leading right end, painted cel-shaded anime style, centered, on solid flat chroma-key green background #00B140, no green thread, no character, no text, no watermark.',
        },
      },
    },
  },
  chebel: {
    canonical: 'assets/raw/canonical/chebel.png',
    layout: 'v2',
    // wardrobe + deck must persist; any card/spirit glow is warm AMBER-GOLD and
    // VIOLET only (never green — green dies in the chroma key). She is a
    // fast kick-first rushdown dancer; strap sandals, hair always in motion.
    always:
      'She ALWAYS wears the same brown crop top, oxblood-red high-waisted shorts and brown strap sandals, with long dark wavy hair caught mid-whip, and a small tarot card deck glowing faintly AMBER-GOLD at her right hip. She is a lithe, fast kick-first rushdown dancer with a fierce focused expression. Any conjured card, tarot-glow or animal-spirit effects are warm AMBER-GOLD and VIOLET — never green. No glowing effects unless this pose explicitly describes them.',
    // idle-a/idle-b are a 2-frame breathing loop that ALTERNATES every few
    // ticks — they must be near-identical or the sprite flickers. Both pin the
    // exact same stance and forbid any conjured spirit (the deck stays holstered
    // outside her specials). fall is pinned to topple backward onto her back.
    cells: {
      'idle-a':
        'a relaxed fighting stance facing right, both hands up in a light EMPTY-HANDED guard near her chin, weight settled on the back foot, hair hanging naturally. Her hands are empty — no card held, no glow. There is NO conjured spirit, NO animal, NO tarot card and NO glowing effect anywhere in the frame',
      'idle-b':
        'a nearly-STATIC idle breathing pose: she stands facing right in a calm relaxed upright fighting stance with BOTH feet flat on the ground about shoulder-width apart, weight settled, both hands up in a light EMPTY-HANDED guard near her chin. This is the SAME calm grounded standing stance as a neutral ready idle — it is NOT an attack: NO raised knee, NO kick, NO lifted leg, NO lunge, NO leaning. The ONLY change from a plain neutral stance is that her chest has risen slightly with an inhaled breath and her hair has drifted a touch. Her hands are empty — no card held, no glow. There is NO conjured spirit, NO animal, NO tarot card and NO glowing effect anywhere in the frame',
      fall:
        'knocked off her feet and toppling over BACKWARDS, her body tipping onto her back, head dropping down and behind her toward the lower left, both feet lifting up off the ground, arms flailing upward — clearly falling backward, NOT forward. No conjured spirit or animal in the frame',
    },
    moves6: {
      stand: {
        lp: {
          startup: 'chambering a quick lead-hand backhand, rear hand loose at her hip, rising onto the balls of her feet',
          active: 'a short snapping lead-hand backfist fully extended at head height, hair whipping forward',
          recovery: 'drawing the hand back into a light dancer\'s guard',
        },
        mp: {
          startup: 'winding one arm back across her body in a coiled painterly arc, torso loading',
          active: 'driving a straight palm strike forward at chest height, a faint AMBER-GOLD card-glint flickering off her hip deck',
          recovery: 'the arm flowing back into a loose ready guard',
        },
        hp: {
          startup: 'both hands sweeping up as she plucks a glowing card from the hip deck, cocking it back over her shoulder',
          active: 'a lunging overhand card-slash swept downward at head height, a bright AMBER-GOLD arc trailing the card',
          recovery: 'the card dissolving into gold motes, arm settling back to guard',
        },
        lk: {
          startup: 'weight shifting back, lead foot lifting for a quick front teep',
          active: 'a quick snapping front teep kick at stomach height, planted on one foot — exactly one foot on the ground',
          recovery: 'the kicking foot returning softly to a light stance',
        },
        mk: {
          startup: 'lead knee chambering high across her body for a round kick',
          active: 'a whipping roundhouse kick fully extended at chest height, hair and hips arcing with it — exactly one foot on the ground',
          recovery: 'the leg swinging back down into a balanced stance',
        },
        hk: {
          startup: 'coiling low and loading her rear leg for a high stepping axe kick, arms counterbalanced',
          active: 'a soaring high axe kick fully extended at head height, one leg driven up and over — exactly one foot on the ground, a faint AMBER-GOLD crescent trailing the heel',
          recovery: 'the kicking leg swinging down, both feet planted back into stance',
        },
      },
      crouch: {
        lp: {
          active: 'a short backhand snapped out at waist height from the low squat',
          recovery: 'the hand pulled back to guard, still coiled low in the squat',
        },
        mp: {
          active: 'a rising palm driven diagonally upward out of the squat',
          recovery: 'the palm lowering, weight sinking back into the squat',
        },
        hp: {
          active: 'a glowing AMBER-GOLD card thrust straight upward out of the squat (anti-air), arm fully extended overhead',
          recovery: 'the card fading, arm lowering back into the squat',
        },
        lk: {
          active: 'crouched low on her left leg while her RIGHT foot snaps a quick low kick forward at ankle height',
          recovery: 'the kicking leg pulled back beneath her, folded low in the squat',
        },
        mk: {
          active: 'balanced in a DEEP low squat on her bent left leg, hips near her heels, her RIGHT leg extended straight forward along the ground in a low sweeping kick at ankle height. She has EXACTLY two legs, two arms and one clearly-visible head with her hair — no third leg, no extra or duplicated limbs',
          recovery: 'pulling the extended leg back beneath her into a compact deep squat, hips near her heels, hands to guard; her head and face are clearly visible at the top of the figure — no headless torso, no third leg',
        },
        hk: {
          active: 'crouched very low, one hand planted flat on the floor for balance, her other leg sweeping a low spinning arc extended along the ground at ankle height, whole body kept low. She has EXACTLY two legs, two arms and one clearly-visible head — no third leg, no extra or duplicated limbs',
          recovery: 'rising up out of the low sweep back toward her standing stance, her one head and face clearly visible',
        },
      },
      air: {
        lp: 'throwing a short downward-angled backhand',
        mp: 'driving a straight palm at a downward angle',
        hp: 'a downward card-slash swung with one arm, a faint AMBER-GOLD arc trailing',
        lk: 'a sharp knee raised toward the opponent below',
        mk: 'a whipping downward-angled roundhouse kick, one leg extended, the other tucked',
        hk: 'a downward axe-kick divekick, RIGHT leg fully extended downward, LEFT leg tucked, both legs clearly attached',
      },
      specials: {
        'spirit-draw': {
          startup: 'plucking a glowing card from the hip deck and cocking it back beside her head, AMBER-GOLD light gathering at her fingertips',
          active: 'flicking the card forward at arm\'s length, releasing a small burst of AMBER-GOLD and VIOLET spirit-light off her fingertips toward the right — she is a single figure, the released spirit is only a small glow at her hand, no separate creature drawn yet',
          recovery: 'the throwing arm following through and settling, gold motes fading from her hand',
        },
        'crescent-moon': {
          startup: 'stepping in and loading her rear leg high, body coiling for a downward axe kick',
          active: 'a soaring stepping axe kick chopped straight down from overhead, heel driven downward at head height, a bright AMBER-GOLD crescent arc trailing the foot — exactly one foot on the ground',
          recovery: 'the kicking leg landing forward, settling into stance, the crescent glow fading',
        },
        ceremony: {
          startup: 'sinking into a poised low stance, one hand cradling a faintly glowing teacup of AMBER-GOLD light, knees bent ready to spring',
          active: 'rising into the air on a soaring upward kick, one leg driven straight up, a swirl of AMBER-GOLD and VIOLET spirit-light flaring around her — both feet off the ground',
          recovery: 'descending from the rise, the gold swirl fading, landing softly on bent knees',
        },
        'unicycle-rush': {
          startup: 'perched atop a single-wheel unicycle, arms out wobbling for balance, leaning forward ready to charge',
          active: 'charging forward fast atop the wobbling unicycle, one leg kicked out ahead at chest height, arms wide, hair streaming back — a single rider on one wheel',
          recovery: 'skidding the unicycle to a stop, hopping off back into a light standing stance',
        },
        throw: {
          startup: 'lunging forward, both hands snatching at chest height in front of her, fingers splayed to grab',
          active: 'both arms thrust out toward the right frame edge, hands clawed actively gripping the EMPTY GREEN AIR, a small white impact flash at her hands — she is COMPLETELY ALONE, a single figure grabbing empty air, absolutely no second person and no clone of herself anywhere in the frame',
          recovery: 'shoving her hands forward to fling the unseen opponent away, then settling back into stance',
        },
      },
    },
    extra: {
      projectiles: {
        'spirit-draw': {
          prompt:
            'A single glowing spirit-animal apparition made of AMBER-GOLD and VIOLET light — a stylized leaping cat-like spirit mid-pounce facing right, semi-transparent, trailing gold motes, painted cel-shaded anime style, small, centered, on solid flat chroma-key green background #00B140, no character, no green in the spirit, no text, no watermark.',
        },
      },
    },
  },
  ygor: {
    canonical: 'assets/raw/canonical/ygor.png',
    layout: 'v2',
    // wardrobe + camera must persist; any projector/projection glow is CYAN and
    // MAGENTA only (never green — green dies in the chroma key). He is a
    // laid-back lens-first punch zoner; hands glow like a projector when specials start.
    always:
      'He ALWAYS wears the same worn cap over shaggy hair, a yellow tee with red leopard-print, dark work pants and a vintage camera on a neck strap. He is a laid-back, unbothered lens-first zoner. Any projector-glow, projected-creature or psychedelic effects are CYAN and MAGENTA — never green. His hands only glow like a projector lens where a pose explicitly describes it; otherwise there are no glowing effects at all.',
    moves6: {
      stand: {
        lp: {
          startup: 'chambering a quick lead-hand jab at his hip, framing the opponent with his other hand like a lens',
          active: 'a short straight jab fully extended at chest height, front arm firm',
          recovery: 'drawing the fist back into a relaxed loose guard',
        },
        mp: {
          startup: 'winding a rolling hook across his chest, shoulder loading',
          active: 'driving a hook punch forward at chest height, full shoulder behind it',
          recovery: 'the fist returning to a calm ready guard',
        },
        hp: {
          startup: 'both hands rising as a faint CYAN projector-glow gathers at his palms, cocking back a big straight',
          active: 'a heavy straight cross fully extended at chest height, a brief CYAN lens-flare bursting off his lead knuckles',
          recovery: 'straightening up, the cyan glow fading, rolling his shoulder loose',
        },
        lk: {
          startup: 'lifting the front knee for a quick low push kick',
          active: 'a short snapping front kick at shin height, planted and balanced — exactly one foot on the ground',
          recovery: 'the foot returning softly to stance',
        },
        mk: {
          startup: 'chambering the lead knee high across his body for a round kick',
          active: 'a driving round kick fully extended at stomach height — exactly one foot on the ground',
          recovery: 'the leg lowering, foot planting back into stance',
        },
        hk: {
          startup: 'balancing on one leg, the other knee drawn up high, arms counterbalanced',
          active: 'a heavy stepping roundhouse kick fully extended at chest height, one leg driven across — exactly ONE foot on the ground',
          recovery: 'the kicking leg swinging back down into a grounded stance',
        },
      },
      crouch: {
        lp: {
          active: 'a short jab snapped out at waist height from the low squat',
          recovery: 'the fist pulled back to guard, still folded low in the squat',
        },
        mp: {
          active: 'a rising hook driven diagonally upward out of the squat',
          recovery: 'the fist lowering, weight sinking back into the squat',
        },
        hp: {
          active: 'both fists thrust powerfully straight upward out of the squat (anti-air), a faint CYAN lens-flare at the knuckles',
          recovery: 'arms lowering from overhead, settling back into the squat',
        },
        lk: {
          active: 'crouched low on his left leg while his RIGHT foot snaps a quick low kick forward at ankle height',
          recovery: 'the kicking leg pulled back beneath him, folded low in the squat',
        },
        mk: {
          active: 'balanced in a DEEP low squat on his bent left leg, hips near his heels, his RIGHT leg extended straight forward along the ground in a low kick at ankle height. He has EXACTLY two legs, two arms and one clearly-visible head wearing the cap — no third leg, no extra or duplicated limbs',
          recovery: 'pulling the extended leg back beneath him into a compact deep squat, hips near his heels, hands to guard; his head and cap are clearly visible at the top of the figure — no headless torso, no third leg',
        },
        hk: {
          active: 'crouched very low, one hand planted flat on the floor for balance, his other leg sweeping a low spinning arc extended along the ground at ankle height, whole body kept low. He has EXACTLY two legs, two arms and one clearly-visible head wearing the cap — no third leg, no extra or duplicated limbs',
          recovery: 'rising up out of the low sweep back toward his standing stance, his one head and cap clearly visible',
        },
      },
      air: {
        lp: 'throwing a short downward-angled jab',
        mp: 'driving a hook at a downward angle',
        hp: 'a heavy downward straight punch, arm extended, a faint CYAN glint at the knuckles',
        lk: 'a sharp knee raised toward the opponent below',
        mk: 'a stomping side kick angled downward',
        hk: 'a heavy downward axe kick, RIGHT leg fully extended, LEFT leg tucked beneath him, both legs clearly attached',
      },
      specials: {
        'suave-creature': {
          startup: 'both hands rising and cupping together as a CYAN and MAGENTA projector-glow blooms between his palms, framing the space ahead like a lens',
          active: 'flinging both hands forward, casting a burst of CYAN and MAGENTA projection-light off his palms toward the right — he is a single figure, the projected creature is only a bloom of light at his hands, no separate creature drawn yet',
          recovery: 'the throwing hands following through and lowering, the projector-glow fading from his palms',
        },
        oracle: {
          startup: 'crouching to plant a small booth-tripod on the ground beside him, both hands setting it down',
          active: 'stepping back from the planted booth as it emits a soft ring of CYAN and MAGENTA psychedelic light — he is standing apart, gesturing toward the small booth on the ground',
          recovery: 'straightening up and stepping away from the booth into a relaxed guard',
        },
        microdose: {
          startup: 'colors blooming around him as a wash of CYAN and MAGENTA psychedelic glow rises up his body, eyes going briefly wide',
          active: 'half-dissolving into a smear of CYAN and MAGENTA light mid-step, his body streaking sideways as he blinks out',
          recovery: 'reforming out of the color-smear into a relaxed standing stance, the glow settling',
        },
        'rainbow-road': {
          startup: 'turning to gesture low toward the ground, one hand conjuring a small CYAN glow at ankle height',
          active: 'gesturing forward and low as a tiny putting golf-cart trailing a bright rainbow projection rolls out along the ground ahead of him at ankle height — he stands upright, the cart is small and low on the ground',
          recovery: 'watching the cart putt away, settling back upright into a relaxed guard',
        },
        throw: {
          startup: 'lunging forward, both hands snatching at chest height in front of him, fingers splayed to grab',
          active: 'both arms thrust out toward the right frame edge, hands clawed actively gripping the EMPTY GREEN AIR, a small white impact flash at his hands — he is COMPLETELY ALONE, a single figure grabbing empty air, absolutely no second person and no clone of himself anywhere in the frame',
          recovery: 'shoving his hands forward to fling the unseen opponent away, then settling back into stance',
        },
      },
    },
    extra: {
      projectiles: {
        'suave-creature': {
          prompt:
            'A single glowing hand-drawn cartoon creature made of CYAN and MAGENTA projection-light — a goofy loping four-legged critter mid-stride facing right, thick outline, semi-transparent glow, painted cel-shaded anime style, small, centered, on solid flat chroma-key green background #00B140, no character, no green in the creature, no text, no watermark.',
        },
        oracle: {
          prompt:
            'A small glowing psychedelic booth on a tripod emitting a soft upright ring of CYAN and MAGENTA light, subtle swirling patterns, painted cel-shaded anime style, centered, on solid flat chroma-key green background #00B140, no character, no green, no text, no watermark.',
        },
        'rainbow-road': {
          prompt:
            'A tiny putting golf-cart seen from the side facing right, trailing a bright rainbow projection-streak behind it low along the ground, wider than it is tall, painted cel-shaded anime style, on solid flat chroma-key green background #00B140, no character, no green in the cart, no text, no watermark.',
        },
      },
    },
  },
};
