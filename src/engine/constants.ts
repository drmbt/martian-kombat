export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;

export const STAGE_W = 960;
export const STAGE_H = 540;
export const FLOOR_Y = 460;
export const STAGE_MIN_X = 50;
export const STAGE_MAX_X = STAGE_W - 50;

export const SPAWN_OFFSET = 180; // fighters start at center ± this

export const ROUND_SECONDS = 99;
export const ROUND_TICKS = ROUND_SECONDS * TICK_RATE;
export const INTRO_TICKS = 90; // "ROUND N" + "FIGHT!"
export const ROUND_END_TICKS = 150;
export const WINS_NEEDED = 2;

export const KNOCKDOWN_TICKS = 45;
export const GETUP_TICKS = 20;

// fatality flow
export const FINISHER_TICKS = 360; // 6s window to input the fatality
export const FATALITY_TICKS = 460; // cutscene length before matchEnd
export const FATALITY_RANGE = 280; // default max distance to the dazed loser

export const GROUND_FRICTION = 0.85; // knockback slide decay per tick
export const INPUT_BUFFER_LEN = 15;
export const CHARGE_TICKS = 35; // hold ↓ this long to bank a charge motion

// universal throw (LP+LK): the victim is held for the tech window; their own
// LP+LK inside it escapes the throw and bounces both fighters apart
export const THROW_TECH_TICKS = 12;
export const THROW_TECH_PUSH = 6;
export const THROW_TECH_RECOIL = 10; // both unactionable for a beat after a tech

// dizzy/stun: connecting hits (never blocks) feed a per-fighter accumulator
// that decays every tick; crossing the threshold forces a helpless 'dazed'
// spell once the current reel/getup finishes
export const STUN_THRESHOLD = 250;
export const STUN_DECAY = 0.5; // per tick (binary-exact, so decay stays deterministic)
export const DIZZY_TICKS = 180; // ~3s helpless

// hitstop: per-fighter freeze frames on contact, scaled by button strength.
// Melee freezes both fighters; projectiles freeze the VICTIM only (SF
// fireballs never stop the shooter); trades keep the longest freeze.
// (Raised from 3/5/7/8 in the Sprint 18 feel pass — hits read heavier.)
export const HITSTOP_LIGHT = 4;
export const HITSTOP_MEDIUM = 6;
export const HITSTOP_HEAVY = 9;
export const HITSTOP_SPECIAL = 10; // specials (and their projectiles) hit hardest

// counterhit: a defender clipped during their own attack's startup or
// recovery reels longer and the victim-side freeze runs a few extra ticks
export const COUNTER_HITSTUN_MULT = 1.5;
export const COUNTER_HITSTOP_BONUS = 3;

// action input buffer: a button tapped while unactionable (reeling,
// recovering, getting up, frozen in hitstop) fires on the first actionable
// frame instead of being dropped — covers wakeup reversals + landing buffer
export const ACTION_BUFFER_TICKS = 8;

// cancels & chains: once a move has CONTACTED (hit or block — never a whiff),
// a buffered press may cancel it into a chain target (data-driven `chains` on
// the move) or a motion special (`cancel: true` normals). The window runs
// from contact through the active frames plus this many recovery ticks.
export const CANCEL_WINDOW_TICKS = 8;

// combo damage scaling: hits 1-2 land full, every later hit in the same combo
// loses STEP percent (cumulative), floored at FLOOR percent — long chains
// stay rewarding without deleting a health bar
export const COMBO_SCALE_STEP = 10;
export const COMBO_SCALE_FLOOR = 30;

// landing recovery: jumps have consequences — a short unactionable window on
// touchdown, longer after an air normal that whiffed
export const LANDING_TICKS = 3;
export const LANDING_WHIFF_TICKS = 6;

// ground-impact bounce: knockdowns pop back up off the floor with this
// vertical speed before settling (the renderer puffs dust on each impact)
export const BOUNCE_VY = 3.2;

// dash (double-tap ←/→): a friction-bled impulse, limited by a stock pool so
// it can't be spammed — each dash spends a stock, stocks regen one at a time
export const DASH_STOCKS = 2;
export const DASH_REGEN_TICKS = 150; // 2.5s per stock
