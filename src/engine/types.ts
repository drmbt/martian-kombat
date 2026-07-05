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
  /** flavor taunt — a real engine input so it's deterministic + net-synced */
  taunt: boolean;
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
  taunt: false,
};

/** 'high' = overhead (air attacks): must be blocked STANDING.
 *  'low' = must be blocked CROUCHING. 'mid' = blocked either way. */
export type MoveHeight = 'mid' | 'low' | 'high';

/** What an armed projectile turns into when its fuse runs out (Fork Bomb). */
export interface DetonationDef {
  box: Box;
  damage: number;
  hitstun: number;
  blockstun: number;
  knockback: number;
  /** blast lifetime in ticks */
  ttl: number;
  height?: MoveHeight;
}

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
  /** initial vertical velocity (negative = up) for lobbed arcs */
  vy?: number;
  /** per-tick gravity for lobbed arcs; the projectile stops on landing */
  gravity?: number;
  /** ticks after landing before it detonates; dormant (no collision) until then */
  fuse?: number;
  /** the blast the fused projectile morphs into (moveId gains '-burst') */
  detonate?: DetonationDef;
  /** launches the victim (pops up / knocks down) instead of plain hitstun */
  knockdown?: boolean;
  /** visual field (smoke): never collides, never clashes, and does not count
   *  against the one-projectile-per-owner rule */
  field?: boolean;
  /** ticks between hits for lingering tick-damage clouds; the projectile
   *  survives its hits instead of dying on contact (Spore Bloom) */
  rehit?: number;
  /** field only: enemy projectiles inside the box move at vx*slowFactor and
   *  enemy ground impulses decay faster (Rate Limit) */
  slowFactor?: number;
  /** "get over here": an UNBLOCKED hit drags the victim to the owner and
   *  knocks them down (pair with knockdown: true); a blocked one is plain
   *  blockstun + pushback (Vine Spear) */
  pull?: boolean;
}

/** Fighting-game convention motions: quarter-circles, back-forward,
 *  dragon punch (→↓↘), half-circles, a (simplified) 360, and charge
 *  down-up ('du': hold ↓ for CHARGE_TICKS, then ↑ + button). */
export type Motion = 'qcf' | 'qcb' | 'bf' | 'dp' | 'hcb' | 'hcf' | '360' | 'du';

export interface SpecialInput {
  /** omitted for pure button-combo moves (3P lariats etc.) */
  motion?: Motion;
  /** button class that finishes the motion; PPP/KKK = 2+ of the class
   *  pressed together (practical keyboard-friendly "all buttons");
   *  LPLK = the universal-throw chord, LP+LK pressed together */
  button: 'punch' | 'kick' | 'PPP' | 'KKK' | 'LPLK';
  /** mash trigger (lightning-legs style): fires when this many FRESH presses
   *  of the button class land inside the input-buffer window (the final
   *  press must be this tick); no directional motion required */
  mash?: number;
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
  leap?: { vx: number; vy: number };
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
  /** invulnerable for N ticks starting at `invulnFrom` (default tick 0) —
   *  reversal anti-airs want the default; a delayed window (e.g. a mirrored
   *  teleport that's vulnerable during its startup pose) sets invulnFrom */
  invuln?: number;
  /** tick the invuln window opens; omit for the traditional "invulnerable
   *  from frame 0" reversal behavior */
  invulnFrom?: number;
  /** command grab: unblockable, connects within range against grounded foes */
  grab?: { range: number };
  /** backward hop applied to the ATTACKER when a grab connects (86'd) */
  grabRecoil?: number;
  /** universal throw: the grab holds the victim for a short window in which
   *  their own LP+LK escapes it (both bounce back, no damage); also whiffs
   *  against victims already reeling (hitstun/blockstun/airHit) */
  techable?: boolean;
  /** per-move override of the SF2 toss arc (techable throw landing): omit to
   *  use the default TOSS_VY/TOSS_KNOCKBACK_MULT — a grappler can go higher
   *  and harder, a quick throw flatter and shorter */
  tossArc?: { vy: number; knockbackMult?: number };
  /** health restored to the ATTACKER when a grab connects, capped at max
   *  (Symbiosis kudzu drain) */
  heal?: number;
  /** reflects enemy projectiles during startup+active (Redirect) */
  reflect?: boolean;
  /** immune to projectiles during startup+active (lariats) */
  projImmune?: boolean;
  /** at first active frame, launch into the air with this velocity (vaults) */
  vault?: { vx: number; vy: number };
  /** at first active frame, blink: 'behind' crosses to the far side of the
   *  opponent, 'retreat' snaps back to own corner (Diffusion). `mirror: true`
   *  opts into a symmetric halfway-blink instead (Matrix Teleport): the move's
   *  own startup/active/recovery cells play once on the origin half, the
   *  fighter blinks at the exact midpoint, then the SAME three cells replay
   *  reversed (recovery, active, startup) on the destination half — pair with
   *  a delayed `invulnFrom`/`invuln` window so the fighter reads as vulnerable
   *  while dissolving and while fully rematerialized, invulnerable in between */
  teleport?: { mode: 'behind' | 'retreat'; mirror?: boolean };
  /** shoryuken physics: rise with this velocity AT the first active frame while
   *  the attack stays out (hitbox travels with the fighter) */
  leap?: { vx: number; vy: number };
  /** melee multi-hit (lightning legs): after connecting, the SAME activation
   *  may hit again every `rehit` ticks while active frames remain — each hit
   *  refreshes the victim's reel (and chips through block) */
  rehit?: number;
  /** yoga float: at the first active frame, launch airborne with vy (up) and
   *  fall under this reduced gravity instead of the character's own until
   *  touchdown or until hit — air normals stay available on the way down */
  float?: { vy: number; gravity: number; vx?: number };
  /** SFII Turbo L/M/H button variants, merged over the base numbers */
  variants?: { l?: VariantPatch; m?: VariantPatch; h?: VariantPatch };
  /** chain targets: once this move has CONTACTED (hit or block, never on
   *  whiff), a fresh press of one of these moves cancels the remainder of
   *  this move into it (lights chain into lights; light→medium where a kit
   *  wants it) — pure data, the engine has no per-character cases */
  chains?: string[];
  /** special-cancelable: on contact (hit or block), this normal may cancel
   *  into any motion special inside the cancel window */
  cancel?: boolean;
  /** presentation only: this move has a per-move voice call-out
   *  (v-<char>-move-<moveId>, e.g. Gene's "Line goes up!") played on start */
  voice?: boolean;
  /** render hint only — per-move impact overlay art
   *  (assets/sprites/<char>/vfx-<moveId>.png, tools/gen-vfx.mjs) played by the
   *  scene when this move connects; engine never reads it */
  vfx?: { size?: number; anchor?: 'impact' | 'ground' };
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
  /** home-stage id (src/data/stages.ts) — UI hint only, engine never reads it */
  stage?: string;
  /** SFII-style victory taunts; the win screen picks one at random. Presentation
   *  only, engine never reads it. */
  winQuotes?: string[];
  fatality?: FatalityDef;
  /** whole-character size multiplier (default 1). Baked into the collision
   *  geometry (bodyBox, hurtboxes, move hitboxes) once at data load
   *  (src/data/characters/index.ts); the engine only ever sees pre-scaled
   *  boxes, and the renderer derives sprite size from hurtStand.h so the art
   *  follows for free. Never read at runtime. */
  spriteScale?: number;
  /** render hint only — extra vertical pixels added to the sprite's draw
   *  position (positive pushes the art down toward the floor); engine never
   *  reads it */
  spriteOffsetY?: number;
  health: number;
  walkSpeed: number;
  backSpeed: number;
  jumpVel: number;
  /** horizontal speed of a forward/back jump (px/tick). Optional — defaults
   *  to walkSpeed × JUMP_SPEED_MULT; acrobats override for more air range. */
  jumpSpeedX?: number;
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
  /** brief unactionable touchdown recovery: short after a plain jump, longer
   *  after a whiffed air normal (buffered presses fire the moment it ends) */
  | 'landing'
  | 'ko'
  /** flavor taunt pose — committed for TAUNT_TICKS, vulnerable, ends to idle */
  | 'taunt'
  /** helpless: dizzy from stun buildup (fight phase, times out after
   *  DIZZY_TICKS), or standing defeated in the finisher window waiting for
   *  the fatality (never times out — updateFighter skips the loser there) */
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
  /** cached tick the invuln window opens (default 0 — see MoveDef.invulnFrom) */
  invulnFrom?: number;
  /** hitstun/airHit: this reel came from a counterhit (defender was clipped
   *  during their own attack's startup or recovery) — bonus hitstun and
   *  victim-side hitstop already applied; the renderer flashes it */
  counter?: boolean;
  /** airHit: already rebounded off the floor once — the next floor contact
   *  settles into knockdown (invulnerable while bounced, like knockdown) */
  bounced?: boolean;
  /** airHit: this launch came from a throw toss — the floor slam rebounds
   *  higher (TOSS_BOUNCE_VY) for the SF2 tossed-across-the-screen arc */
  tossed?: boolean;
  /** attack frame of the most recent connect — gates melee `rehit` spacing */
  lastHitFrame?: number;
}

/** A button press captured while unactionable, waiting for the first
 *  actionable frame. The attack pick (motion, strength, chord) is resolved at
 *  press time so wakeup reversals keep their motion window. */
export interface BufferedAction {
  id: string;
  strength?: Strength;
  /** remaining ticks before the unconsumed press expires */
  ticksLeft: number;
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
  /** consecutive-ish ticks holding down (decays fast on release) — fuels
   *  charge motions ('du') without stretching the input buffer */
  charge: number;
  /** dizzy accumulator: connecting hits add their damage, decays every tick,
   *  crossing STUN_THRESHOLD forces 'dazed' when the current reel ends */
  stun: number;
  /** per-fighter freeze ticks from a connected hit: melee freezes both sides,
   *  projectiles freeze the victim only, trades keep the longest (inputs
   *  still buffer while frozen) */
  hitstop: number;
  /** action input buffer — null once consumed or expired */
  buffered: BufferedAction | null;
  /** dash stocks remaining (double-tap dashes spend one; see DASH_STOCKS) */
  dashStocks: number;
  /** ticks accumulated toward the next stock regen (counts only when short) */
  dashRegen: number;
  /** hits taken in the CURRENT combo (this fighter is the victim): increments
   *  while a hit lands on an already-reeling fighter, resets to 0 the moment
   *  they leave hitstun/airHit — fuels combo damage scaling */
  comboHits: number;
  /** yoga float: reduced gravity in effect while airborne (0 = normal fall);
   *  cleared on touchdown and when hit out of the air */
  floatGravity: number;
}

/** A techable throw mid-hold: the victim is frozen while this counts down.
 *  Their own LP+LK inside the window techs it; expiry lands the throw. */
export interface PendingThrow {
  attacker: 0 | 1;
  moveId: string;
  strength?: Strength;
  ticksLeft: number;
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
  vy: number;
  /** >0 while airborne on a lobbed arc; zeroed on landing */
  gravity: number;
  /** >0 = armed & dormant (counts down once grounded); -1 = live */
  fuse: number;
  knockdown: boolean;
  field: boolean;
  detonate?: DetonationDef;
  /** ticks between hits (0 = dies on first hit like a normal projectile) */
  rehit: number;
  /** ticks until this lingering projectile may hit again */
  hitCooldown: number;
  /** field slow strength; 0 = no slow */
  slowFactor: number;
  /** unblocked hits drag the victim to the owner (Vine Spear) */
  pull: boolean;
}

export type Phase = 'intro' | 'fight' | 'roundEnd' | 'finisher' | 'fatality' | 'matchEnd';

/** Match rules, fixed at initialState — part of state so replays stay deterministic. */
export interface MatchRules {
  /** ticks per round; 0 = no round clock */
  roundTicks: number;
  /** rounds needed to take the match */
  winsNeeded: number;
  /** walkable x range — wider arenas (3D stage) widen it symmetrically
   *  around STAGE_W/2 so renderer centering stays put */
  stage: { minX: number; maxX: number };
  /** ROUND 1 intro length in ticks (later rounds keep INTRO_TICKS) — longer
   *  first intros give entry gestures + a READY? 3-2-1 countdown room */
  introTicks: number;
}

export interface GameState {
  tick: number;
  phase: Phase;
  phaseFrame: number;
  roundNumber: number;
  rules: MatchRules;
  /** remaining ticks on the round clock (stays 0 when the clock is off) */
  timer: number;
  fighters: [FighterState, FighterState];
  projectiles: Projectile[];
  wins: [number, number];
  /** winner of the round that just ended / the match; null = draw */
  roundWinner: 0 | 1 | null;
  /** set while a fatality cutscene is playing */
  fatality: { owner: 0 | 1; id: string } | null;
  /** a universal throw holding its victim through the tech window */
  pendingThrow: PendingThrow | null;
}
