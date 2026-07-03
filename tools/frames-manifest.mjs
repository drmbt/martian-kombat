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
  const jobs = CELLS.map((c) => ({ id: c.id, pose: c.pose }));
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
      },
    },
  },
};
