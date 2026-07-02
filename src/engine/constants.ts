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
