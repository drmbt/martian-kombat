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
    moves: {
      light: {
        startup: 'coiling a quick open-palm strike, teacup still balanced in the other hand',
        active: 'open-palm strike snapped out at head height, tea unspilled',
        recovery: 'drawing the palm back with a smug tilt of the head',
      },
      heavy: {
        startup: 'lifting one leg impossibly high in a standing-split chamber, perfectly balanced',
        active: 'vertical standing-split kick at full extension, heel above their own head',
        recovery: 'lowering the leg with dancer-like control',
      },
      sweep: {
        startup: 'melting down into a low splits position, one palm on the ground',
        active: 'low spinning sweep from the splits, leg extended along the ground',
        recovery: 'flowing back up from the splits like it was nothing',
      },
      special: {
        startup: 'taking a long sip from the teacup, cheeks puffed, ember light glowing between the lips',
        active: 'head thrown forward spitting a cone of fire from the mouth, teacup held safely out to the side',
        recovery: 'wiping their mouth with the back of a hand, smirking, wisp of smoke from the lips',
      },
    },
    extra: {
      projectiles: {
        'scalding-sip': {
          prompt:
            'A billowing cone-shaped burst of orange and red fire with curling steam wisps, pointing to the right, painted cel-shaded anime style, on solid flat chroma-key green background #00B140, no character, no text, no watermark.',
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
          recovery: 'landing in a deep crouch from the slam, one fist on the ground, dust and embers rising',
        },
        'braid-lariat': {
          startup: 'arms rising out to her sides, beginning to spin, her braid lifting with the rotation',
          active: 'a full spinning lariat — both arms out horizontal mid-spin, braid whipping in a circle, a red aura ring around her upper body',
          recovery: 'the spin slowing, arms lowering, braid settling back over her shoulder',
        },
      },
    },
    extra: {},
  },
};
