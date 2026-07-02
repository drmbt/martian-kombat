// Core types for the deterministic fight engine.
// RULE: nothing in src/engine/ may import Phaser or touch wall-clock time,
// Math.random, or the DOM. step() must be a pure function of (state, inputs).

/** Axis-aligned box relative to a fighter's origin (feet, floor level).
 *  x is the offset along the facing direction (mirrored automatically when
 *  facing left); y is negative-up from the feet. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Six-button layout: light/medium/heavy punch + light/medium/heavy kick. */
export const BUTTONS = ['lp', 'mp', 'hp', 'lk', 'mk', 'hk'] as const;
export type Button = (typeof BUTTONS)[number];

export interface InputFrame {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  lp: boolean;
  mp: boolean;
  hp: boolean;
  lk: boolean;
  mk: boolean;
  hk: boolean;
}

export const EMPTY_INPUT: InputFrame = {
  left: false,
  right: false,
  up: false,
  down: false,
  lp: false,
  mp: false,
  hp: false,
  lk: false,
  mk: false,
  hk: false,
};

/** 'high' = overhead (air attacks): must be blocked STANDING.
 *  'low' = must be blocked CROUCHING. 'mid' = blocked either way. */
export type MoveHeight = 'mid' | 'low' | 'high';

export interface ProjectileDef {
  vx: number;
  spawnX: number;
  spawnY: number;
  box: Box;
  damage: number;
  hitstun: number;
  blockstun: number;
  knockback: number;
  /** lows must be crouch-blocked (Jazzper runs ankle-height); default mid */
  height?: MoveHeight;
  /** lifetime in ticks for short-range projectiles (fire breath); default unlimited */
  ttl?: number;
  /** spawn several at once (knife fans); default 1 */
  count?: number;
  /** per-extra-projectile velocity/height offsets for fans */
  spreadVX?: number;
  spreadY?: number;
}

/** Fighting-game convention motions: quarter-circles, back-forward,
 *  dragon punch (→↓↘), half-circles, and a (simplified) 360. */
export type Motion = 'qcf' | 'qcb' | 'bf' | 'dp' | 'hcb' | 'hcf' | '360';

export interface SpecialInput {
  /** omitted for pure button-combo moves (3P lariats etc.) */
  motion?: Motion;
  /** button class that finishes the motion; PPP/KKK = 2+ of the class
   *  pressed together (practical keyboard-friendly "all buttons") */
  button: 'punch' | 'kick' | 'PPP' | 'KKK';
}

/** L/M/H strength of the button that triggered a special. */
export type Strength = 'l' | 'm' | 'h';

/** Per-strength overrides applied on top of a special's base numbers. */
export interface VariantPatch {
  startup?: number;
  active?: number;
  recovery?: number;
  damage?: number;
  hitstun?: number;
  blockstun?: number;
  knockback?: number;
  forwardVel?: number;
  hitbox?: Box | null;
  invuln?: number;
  grab?: { range: number };
  vault?: { vx: number; vy: number };
  projectile?: Partial<ProjectileDef>;
}

export interface MoveDef {
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  hitstun: number;
  blockstun: number;
  knockback: number;
  /** null for pure projectile moves (the projectile carries its own box) */
  hitbox: Box | null;
  height: MoveHeight;
  knockdown?: boolean;
  /** forward drift per tick during startup+active (advancing specials) */
  forwardVel?: number;
  projectile?: ProjectileDef;
  /** display name (specials, shown on the pause screen) */
  name?: string;
  /** presence marks the move as a SPECIAL, fired by motion+button instead of
   *  a raw button press; a character may define any number of these */
  input?: SpecialInput;
  /** invulnerable for the first N ticks (reversal anti-airs) */
  invuln?: number;
  /** command grab: unblockable, connects within range against grounded foes */
  grab?: { range: number };
  /** backward hop applied to the ATTACKER when a grab connects (86'd) */
  grabRecoil?: number;
  /** reflects enemy projectiles during startup+active (Redirect) */
  reflect?: boolean;
  /** immune to projectiles during startup+active (lariats) */
  projImmune?: boolean;
  /** at first active frame, launch into the air with this velocity (vaults) */
  vault?: { vx: number; vy: number };
  /** SFII Turbo L/M/H button variants, merged over the base numbers */
  variants?: { l?: VariantPatch; m?: VariantPatch; h?: VariantPatch };
}

export interface FatalityDef {
  id: string;
  name: string;
  input: SpecialInput;
  /** max distance to the dazed loser; default engine FATALITY_RANGE */
  range?: number;
  /** number of cutscene panels the renderer should play */
  panels: number;
}

export interface CharacterDef {
  id: string;
  name: string;
  /** render hint only — engine never reads it */
  color: string;
  fatality?: FatalityDef;
  health: number;
  walkSpeed: number;
  backSpeed: number;
  jumpVel: number;
  gravity: number;
  prejumpFrames: number;
  bodyBox: Box;
  hurtStand: Box;
  hurtCrouch: Box;
  /** flat move dict: 'lp'..'hk' standing, 'clp'..'chk' crouching,
   *  'jlp'..'jhk' air, plus 'special' (fired with quarter-circle-fwd+punch) */
  moves: Record<string, MoveDef>;
}

export type ActionKind =
  | 'idle'
  | 'walkF'
  | 'walkB'
  | 'crouch'
  | 'prejump'
  | 'air'
  | 'attack'
  | 'airAttack'
  | 'hitstun'
  | 'blockstun'
  | 'airHit'
  | 'knockdown'
  | 'getup'
  | 'ko'
  /** standing defeated during the finisher window, waiting for the fatality */
  | 'dazed';

export interface Action {
  kind: ActionKind;
  /** counts UP for attack/prejump/knockdown/getup; counts DOWN (remaining
   *  ticks) for hitstun/blockstun */
  frame: number;
  moveId?: string;
  hasHit?: boolean;
  guard?: 'stand' | 'crouch';
  /** which button strength triggered a special (selects the variant) */
  strength?: Strength;
  /** cached i-frame count for the current attack */
  invuln?: number;
}

export interface FighterState {
  charId: string;
  x: number;
  /** feet Y in world pixels; FLOOR_Y when grounded */
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  health: number;
  action: Action;
  /** rolling window of packed InputFrames, newest last (motion inputs later) */
  inputBuffer: number[];
}

export interface Projectile {
  owner: 0 | 1;
  /** the special that spawned it (render hint: picks the art) */
  moveId: string;
  x: number;
  y: number;
  vx: number;
  box: Box;
  damage: number;
  hitstun: number;
  blockstun: number;
  knockback: number;
  height: MoveHeight;
  /** ticks remaining; negative = unlimited */
  ttl: number;
}

export type Phase = 'intro' | 'fight' | 'roundEnd' | 'finisher' | 'fatality' | 'matchEnd';

export interface GameState {
  tick: number;
  phase: Phase;
  phaseFrame: number;
  roundNumber: number;
  /** remaining ticks on the round clock */
  timer: number;
  fighters: [FighterState, FighterState];
  projectiles: Projectile[];
  wins: [number, number];
  /** winner of the round that just ended / the match; null = draw */
  roundWinner: 0 | 1 | null;
  /** set while a fatality cutscene is playing */
  fatality: { owner: 0 | 1; id: string } | null;
}
