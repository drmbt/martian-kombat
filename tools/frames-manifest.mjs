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
          active: 'short double-palm push thrust forward at chest height, faint teal shimmer at the palms',
          recovery: 'palms drawing back into a tai chi guard',
        },
        hp: {
          startup: 'winding into a spinning double-palm push, cloak wrapping around the body',
          active: 'double-palm push fully extended, cloak flared wide, burst of teal energy at the palms',
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
          active: 'spinning high crescent kick fully extended at head height, cloak flared in a full circle, teal energy trail — exactly one foot on the ground',
          recovery: 'the spin completing, cloak settling around him, both feet planted',
        },
      },
      crouch: {
        lp: {
          active: 'short palm strike snapped out at waist height from the squat',
          recovery: 'palm pulled back to guard, still coiled in the squat',
        },
        mp: {
          active: 'rising palm thrust angled upward out of the squat, teal shimmer trailing',
          recovery: 'the arm settling down, weight sinking back into the squat',
        },
        hp: {
          active: 'both palms thrust powerfully straight upward out of the squat, cloak rising, teal energy burst (anti-air)',
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
        mp: 'a double-palm thrust angled 45 degrees downward, teal shimmer',
        hp: 'an overhead double-fist hammer blow swung downward, cloak billowing above him',
        lk: 'a sharp knee strike raised toward the opponent',
        mk: 'a side kick extended at a downward angle, cloak trailing',
        hk: 'a flying spinning crescent kick — RIGHT leg fully extended with a teal energy trail, LEFT leg tucked beneath him, both legs clearly attached',
      },
      specials: {
        'sigil-bolt': {
          startup: 'tracing a glowing teal arcane glyph in the air with one finger, eyes focused',
          active: 'palm thrust forward launching a bright teal glowing rune projectile, cloak blown back',
          recovery: 'follow-through with palm open, glyph light fading from the fingertips',
        },
        'cloud-hands': {
          startup: 'both palms beginning a flowing circular cloud-hands motion, teal light gathering between them',
          active: 'advancing forward as his palms flow in circles, a blurred triple palm strike, teal light trailing each palm',
          recovery: 'the flowing motion settling, palms returning to center, teal light fading',
        },
      },
    },
    extra: {
      // NOTE: teal-on-green was unkeyable (chroma ate the whole rune) — this
      // one lives on a magenta screen with its own key color.
      projectile:
        'A single glowing blue-violet arcane rune sigil energy ball projectile with bright white core, spinning, painted cel-shaded anime style, small, centered, on solid flat magenta background #FF00FF, no character, no text, no watermark.',
      projectileKey: '0xFF00FF',
    },
  },
  catherine: {
    canonical: 'assets/raw/canonical/catherine.png',
    moves: {
      light: {
        startup: 'drawing the bo staff back beside the hip, coiled for a thrust',
        active: 'bo staff thrust fully extended forward at chest height, sharp and direct',
        recovery: 'retracting the bo staff back to a ready guard',
      },
      heavy: {
        startup: 'raising the bo staff high overhead with both hands',
        active: 'slamming the bo staff down in a powerful overhead arc, hair flying',
        recovery: 'lifting the staff back up from the follow-through',
      },
      sweep: {
        startup: 'dropping low with the staff cocked horizontally at her side',
        active: 'sweeping the bo staff in a wide low arc along the ground',
        recovery: 'rising while spinning the staff back up to guard',
      },
      special: {
        startup: 'kneeling on one knee, pointing forward commandingly like sending a dog on an attack run, her dog crouched beside her ready to sprint',
        active: 'arm fully extended pointing forward, dog no longer beside her (already launched off-screen), coat tails swinging',
        recovery: 'standing back up mid-whistle, hand near her mouth',
      },
    },
    extra: {
      projectile:
        'A small scruffy terrier dog sprinting at full speed to the right, ears pinned back, legs stretched mid-gallop, determined face, painted cel-shaded anime style, side view, full body, on solid flat chroma-key green background #00B140, no text, no watermark.',
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
      projectile:
        'A billowing cone-shaped burst of orange and red fire with curling steam wisps, pointing to the right, painted cel-shaded anime style, on solid flat chroma-key green background #00B140, no character, no text, no watermark.',
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
      },
    },
    extra: {},
  },
};
