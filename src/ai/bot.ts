// CPU opponent. Lives OUTSIDE src/engine/ on purpose: the engine only ever
// sees the InputFrames this driver produces, so determinism of the core is
// untouched. Decisions hash the game tick instead of Math.random so a given
// match plays out reproducibly.
import { EMPTY_INPUT, FLOOR_Y, GameState, InputFrame, Motion } from '../engine';
import { characters } from '../data/characters';

type Dir = 'left' | 'right';

/** motions enqueueMotion can perform — covers every normal special + fatality */
type QueueableMotion = 'qcf' | 'qcb' | 'bf' | 'hcb' | 'hcf';
const QUEUEABLE: Set<string> = new Set(['qcf', 'qcb', 'bf', 'hcb', 'hcf']);

interface ReelEntry {
  /** a special: run this motion+button when roughly in range */
  motion?: QueueableMotion;
  button?: 'punch' | 'kick';
  /** a jump-in */
  jump?: boolean;
  /** a normal: the button(s) to press once in close range */
  press?: Partial<InputFrame>;
}

export class CpuDriver {
  private queue: Partial<InputFrame>[] = [];
  private reel: ReelEntry[] | null = null;
  /** move-tuner "loop a single move" mode: null = disabled */
  private loop: { moveId: string; pauseTicks: number; attack: boolean } | null = null;
  private loopPaused = false;
  private loopState: 'approach' | 'jump' | 'act' | 'retreat' | 'wait' = 'approach';
  private loopTimer = 0;

  constructor(
    private slot: 0 | 1,
    /** 1 = normal; lower is more passive (useful for demos/testing) */
    private aggression = 1,
    /** showcase demo: cycle the WHOLE moveset so every move gets shown, and
     *  the winner reliably lands the fatality (see decide/finisher) */
    private showcase = false,
  ) {}

  /** move-tuner: repeatedly approach, perform `moveId`, retreat, wait
   *  `pauseTicks`, repeat. Pass `moveId: null` to disable. `attack: false`
   *  skips the approach/retreat legs entirely — the move just fires in place
   *  on a timer, for dialing in its length without needing to reach/hit the
   *  other fighter. */
  setLoop(moveId: string | null, pauseTicks = 30, attack = true): void {
    this.loop = moveId ? { moveId, pauseTicks, attack } : null;
    this.loopState = 'approach';
    this.loopTimer = 0;
    this.queue = [];
  }

  setLoopPaused(paused: boolean): void {
    this.loopPaused = paused;
  }

  poll(s: GameState): InputFrame {
    if (this.queue.length) return { ...EMPTY_INPUT, ...this.queue.shift()! };
    return { ...EMPTY_INPUT, ...this.decide(s) };
  }

  /** a normal's press for a moveId — standing (lp..hk), crouching (c-prefixed),
   *  or airborne (j-prefixed — caller is responsible for having jumped first) */
  private pressForMove(moveId: string): Partial<InputFrame> {
    const crouch = moveId.startsWith('c') && moveId.length === 3;
    const air = moveId.startsWith('j') && moveId.length === 3;
    const base = crouch || air ? moveId.slice(1) : moveId;
    if (!['lp', 'mp', 'hp', 'lk', 'mk', 'hk'].includes(base)) return {};
    return crouch ? { down: true, [base]: true } : { [base]: true };
  }

  /** move-tuner loop state machine: (jump, for air moves ->) approach into
   *  range, do the move, back off, wait out the configured pause, repeat. */
  private loopDecide(f: GameState['fighters'][number], def: typeof characters[string], toward: Dir, away: Dir, dist: number): Partial<InputFrame> {
    if (this.loopPaused) return {};
    const { moveId, pauseTicks, attack } = this.loop!;
    const move = def.moves[moveId];
    if (!move) return {};
    const isSpecial = !!move.input;
    const isAir = moveId.startsWith('j') && moveId.length === 3;
    const range = isAir ? 150 : isSpecial ? 380 : 100;
    switch (this.loopState) {
      case 'approach':
        if (attack && dist > range) return { [toward]: true };
        this.loopState = isAir ? 'jump' : 'act';
        return {};
      case 'jump':
        // air moves need airborne state before the button does anything —
        // hop toward the opponent, then wait until actually off the ground
        if (f.y >= FLOOR_Y) return { up: true, [toward]: true };
        this.loopState = 'act';
        return {};
      case 'act':
        if (isSpecial && move.input && QUEUEABLE.has(move.input.motion ?? '')) {
          this.enqueueMotion(move.input.motion as QueueableMotion, move.input.button as 'punch' | 'kick', f.facing);
        } else {
          this.queue.push(this.pressForMove(moveId));
        }
        this.loopState = 'retreat';
        this.loopTimer = 0;
        return {};
      case 'retreat':
        if (!attack) {
          this.loopState = 'wait';
          this.loopTimer = 0;
          return {};
        }
        this.loopTimer++;
        if (this.loopTimer < 20) return { [away]: true };
        this.loopState = 'wait';
        this.loopTimer = 0;
        return {};
      case 'wait':
        this.loopTimer++;
        if (this.loopTimer < pauseTicks) return {};
        this.loopState = 'approach';
        return {};
    }
  }

  /** queue a motion+button as a per-tick input sequence, facing-aware. Handles
   *  every motion a special or fatality uses — including hcb/hcf, which the
   *  old driver silently mangled (so half the fatalities never fired in demos). */
  private enqueueMotion(motion: QueueableMotion, button: 'punch' | 'kick', facing: 1 | -1): void {
    const fwd: Dir = facing === 1 ? 'right' : 'left';
    const back: Dir = facing === 1 ? 'left' : 'right';
    const btn = button === 'punch' ? 'mp' : 'mk';
    if (motion === 'qcf') {
      this.queue.push({ down: true }, { down: true }, { [fwd]: true }, { [fwd]: true, [btn]: true });
    } else if (motion === 'qcb') {
      this.queue.push({ down: true }, { down: true }, { [back]: true }, { [back]: true, [btn]: true });
    } else if (motion === 'hcb') {
      // half-circle back: fwd -> down -> back (engine wants those three in order)
      this.queue.push(
        { [fwd]: true }, { [fwd]: true, down: true }, { down: true },
        { down: true, [back]: true }, { [back]: true }, { [back]: true, [btn]: true },
      );
    } else if (motion === 'hcf') {
      this.queue.push(
        { [back]: true }, { [back]: true, down: true }, { down: true },
        { down: true, [fwd]: true }, { [fwd]: true }, { [fwd]: true, [btn]: true },
      );
    } else {
      // bf (back-forward)
      this.queue.push({ [back]: true }, { [back]: true }, {}, { [fwd]: true }, { [fwd]: true, [btn]: true });
    }
  }

  /** specials this driver can actually input (motion + punch/kick button) */
  private specialsOf(def: typeof characters[string]): [string, QueueableMotion, 'punch' | 'kick'][] {
    return Object.entries(def.moves)
      .filter(([, m]) => m.input && QUEUEABLE.has(m.input.motion ?? '') && (m.input.button === 'punch' || m.input.button === 'kick'))
      .map(([id, m]) => [id, m.input!.motion as QueueableMotion, m.input!.button as 'punch' | 'kick']);
  }

  /** showcase reel: every basic + special move, in order, so a demo match
   *  naturally walks through the character's whole kit (built once, cached). */
  private buildReel(def: typeof characters[string]): ReelEntry[] {
    const normals: ReelEntry[] = [];
    for (const b of ['lp', 'mp', 'hp', 'lk', 'mk', 'hk'] as const) {
      if (def.moves[b]) normals.push({ press: { [b]: true } });
    }
    // a couple crouching normals + a jump-in for aerial coverage
    if (def.moves.cmk) normals.push({ press: { down: true, mk: true } });
    if (def.moves.chk) normals.push({ press: { down: true, hk: true } });
    const aerials: ReelEntry[] = [{ jump: true }];
    const specials: ReelEntry[] = this.specialsOf(def).map(([, motion, button]) => ({ motion, button }));
    return [...normals, ...aerials, ...specials];
  }

  private decide(s: GameState): Partial<InputFrame> {
    const f = s.fighters[this.slot];
    const o = s.fighters[this.slot === 0 ? 1 : 0];
    const def = characters[f.charId];
    const toward: Dir = o.x > f.x ? 'right' : 'left';
    const away: Dir = o.x > f.x ? 'left' : 'right';
    const dist = Math.abs(o.x - f.x);
    const r = ((s.tick * 104729 + this.slot * 7919 + (f.x | 0)) % 1000) / 1000;
    const a = this.aggression;

    if (s.phase === 'finisher') {
      // winner: walk into range and RELIABLY deliver the fatality — the loser is
      // helpless for the whole window, so re-attempt the motion until it lands
      // (the queue drains, decide() runs again, we re-enqueue). Every roster
      // fatality is a qcb/hcb + punch/kick, all of which enqueueMotion handles.
      if (s.roundWinner === this.slot && def.fatality) {
        const fb = def.fatality.input.button;
        const motion = def.fatality.input.motion;
        const range = (def.fatality.range ?? 280) - 70;
        if (dist > range) return { [toward]: true };
        if (s.phaseFrame > 24 && motion && QUEUEABLE.has(motion) && (fb === 'punch' || fb === 'kick')) {
          this.enqueueMotion(motion as QueueableMotion, fb, f.facing);
        }
      }
      return {};
    }
    if (s.phase !== 'fight') return {};

    if (this.loop) return this.loopDecide(f, def, toward, away, dist);

    if (this.showcase) return this.showcaseDecide(s, f, o, def, toward, dist);

    const specials = this.specialsOf(def);
    const pickSpecial = () => {
      const [, motion, button] = specials[(s.tick >> 4) % specials.length];
      this.enqueueMotion(motion, button, f.facing);
    };

    if ((o.action.kind === 'attack' || o.action.kind === 'airAttack') && r < 0.45) {
      return r < 0.18 ? { [away]: true, down: true } : { [away]: true };
    }
    if (dist > 420) {
      if (r < 0.06 * a && specials.length) {
        pickSpecial();
        return {};
      }
      return { [toward]: true };
    }
    if (dist > 190) {
      if (r < 0.03 * a) return { up: true, [toward]: true };
      if (r < 0.08 * a && specials.length) {
        pickSpecial();
        return {};
      }
      return { [toward]: true };
    }
    // in range: mix up the six buttons, sweeps, and spacing
    if (r < 0.2 * a) return { lp: true };
    if (r < 0.3 * a) return { mp: true };
    if (r < 0.38 * a) return { hk: true };
    if (r < 0.46 * a) return { down: true, hk: true };
    if (r < 0.52 * a) return { down: true, mk: true };
    if (r < 0.6) return { [away]: true };
    return { [toward]: true };
  }

  /** Showcase demo: rotate through the whole move reel so every basic + special
   *  is demonstrated over the match; position for each, then execute it. */
  private showcaseDecide(
    s: GameState,
    f: GameState['fighters'][number],
    o: GameState['fighters'][number],
    def: typeof characters[string],
    toward: Dir,
    dist: number,
  ): Partial<InputFrame> {
    if (!this.reel) this.reel = this.buildReel(def);
    const reel = this.reel;
    if (!reel.length) return { [toward]: true };
    // each move gets a ~48-tick window; the two fighters phase-offset so they
    // aren't always mirroring the exact same move at the exact same time
    const WINDOW = 48;
    const idx = Math.floor((s.tick + this.slot * 23) / WINDOW) % reel.length;
    const entry = reel[idx];

    if (entry.motion) {
      // a special: close to mid-range, then throw it
      if (dist > 380) return { [toward]: true };
      this.enqueueMotion(entry.motion, entry.button!, f.facing);
      return {};
    }
    if (entry.jump) {
      // only launch from the ground, hopping toward the opponent
      if (f.y >= FLOOR_Y) return { up: true, [toward]: true };
      return {};
    }
    // a normal: walk into striking range, then press it
    if (dist > 100) return { [toward]: true };
    return { ...entry.press };
  }
}
