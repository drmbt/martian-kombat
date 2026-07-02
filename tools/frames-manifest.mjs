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

export const CHARACTERS = {
  vincent: {
    canonical: 'assets/raw/style-tests/char-vincent-b-painted.png',
    moves: {
      light: {
        startup: 'coiling a quick straight palm strike, rear palm chambered at the hip',
        active: 'straight palm strike fully extended at chest height, cloak snapping forward',
        recovery: 'retracting the palm, weight settling back into stance',
      },
      heavy: {
        startup: 'winding into a spinning double-palm push, cloak wrapping around the body',
        active: 'double-palm push fully extended, cloak flared wide, burst of teal energy at the palms',
        recovery: 'completing the spin, cloak settling, arms lowering',
      },
      sweep: {
        startup: 'dropping low, one hand planted on the ground, leg chambered',
        active: 'low circular leg sweep fully extended along the ground, cloak fanned out',
        recovery: 'rising from the sweep back toward stance',
      },
      special: {
        startup: 'tracing a glowing teal arcane glyph in the air with one finger, eyes focused',
        active: 'palm thrust forward launching a bright teal glowing rune projectile, cloak blown back',
        recovery: 'follow-through with palm open, glyph light fading from the fingertips',
      },
    },
    extra: {
      projectile:
        'A single glowing teal arcane rune sigil energy ball projectile, spinning, painted cel-shaded anime style, small, centered, on solid flat chroma-key green background #00B140, no character, no text.',
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
    moves: {
      light: {
        startup: 'chambering a fast lead jab, shoulder rolled in',
        active: 'lead jab fully extended at head height, sharp and fast',
        recovery: 'retracting the jab back to guard',
      },
      heavy: {
        startup: 'lifting one long leg impossibly high overhead, flexible axe-kick chamber',
        active: 'axe kick slamming down, heel at the bottom of its arc, red aura streaking behind the leg',
        recovery: 'leg returning to the ground, settling back into stance',
      },
      sweep: {
        startup: 'coiling into a low spin, palms on the ground, legs gathering',
        active: 'low spinning slide sweep, both legs extended along the ground mid-rotation',
        recovery: 'unwinding from the spin, rising to one knee',
      },
      special: {
        startup: 'coiled low in a cossack-squat wind-up, fists clenched, red rage aura igniting',
        active: 'mid-spin advancing strike, leg extended in a rising spiral, fierce red rage aura flaring',
        recovery: 'landing from the spiral, exhaling, embers of red aura fading',
      },
    },
    extra: {},
  },
};
