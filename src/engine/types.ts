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

export interface InputFrame {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  light: boolean;
  heavy: boolean;
  special: boolean;
}

export const EMPTY_INPUT: InputFrame = {
  left: false,
  right: false,
  up: false,
  down: false,
  light: false,
  heavy: false,
  special: false,
};

export type MoveHeight = 'mid' | 'low';

export interface ProjectileDef {
  vx: number;
  spawnX: number;
  spawnY: number;
  box: Box;
  damage: number;
  hitstun: number;
  blockstun: number;
  knockback: number;
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
}

export interface CharacterDef {
  id: string;
  name: string;
  /** render hint only — engine never reads it */
  color: string;
  health: number;
  walkSpeed: number;
  backSpeed: number;
  jumpVel: number;
  gravity: number;
  prejumpFrames: number;
  bodyBox: Box;
  hurtStand: Box;
  hurtCrouch: Box;
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
  | 'hitstun'
  | 'blockstun'
  | 'airHit'
  | 'knockdown'
  | 'getup'
  | 'ko';

export interface Action {
  kind: ActionKind;
  /** counts UP for attack/prejump/knockdown/getup; counts DOWN (remaining
   *  ticks) for hitstun/blockstun */
  frame: number;
  moveId?: string;
  hasHit?: boolean;
  guard?: 'stand' | 'crouch';
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
  x: number;
  y: number;
  vx: number;
  box: Box;
  damage: number;
  hitstun: number;
  blockstun: number;
  knockback: number;
}

export type Phase = 'intro' | 'fight' | 'roundEnd' | 'matchEnd';

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
}
