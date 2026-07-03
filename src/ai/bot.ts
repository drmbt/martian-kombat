// CPU opponent. Lives OUTSIDE src/engine/ on purpose: the engine only ever
// sees the InputFrames this driver produces, so determinism of the core is
// untouched. Decisions hash the game tick instead of Math.random so a given
// match plays out reproducibly.
import { EMPTY_INPUT, GameState, InputFrame, Motion } from '../engine';
import { characters } from '../data/characters';

type Dir = 'left' | 'right';

export class CpuDriver {
  private queue: Partial<InputFrame>[] = [];

  constructor(
    private slot: 0 | 1,
    /** 1 = normal; lower is more passive (useful for demos/testing) */
    private aggression = 1,
  ) {}

  poll(s: GameState): InputFrame {
    if (this.queue.length) return { ...EMPTY_INPUT, ...this.queue.shift()! };
    return { ...EMPTY_INPUT, ...this.decide(s) };
  }

  /** queue a motion+button as a per-tick input sequence, facing-aware */
  private enqueueMotion(motion: Motion, button: 'punch' | 'kick', facing: 1 | -1): void {
    const fwd: Dir = facing === 1 ? 'right' : 'left';
    const back: Dir = facing === 1 ? 'left' : 'right';
    const btn = button === 'punch' ? 'mp' : 'mk';
    if (motion === 'qcf') {
      this.queue.push({ down: true }, { down: true }, { [fwd]: true }, { [fwd]: true, [btn]: true });
    } else if (motion === 'qcb') {
      this.queue.push({ down: true }, { down: true }, { [back]: true }, { [back]: true, [btn]: true });
    } else {
      this.queue.push({ [back]: true }, { [back]: true }, {}, { [fwd]: true }, { [fwd]: true, [btn]: true });
    }
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
      // winner: walk into range and deliver the fatality; loser: accept fate
      if (s.roundWinner === this.slot && def.fatality) {
        const range = (def.fatality.range ?? 280) - 60;
        if (dist > range) return { [toward]: true };
        const fb = def.fatality.input.button;
        if (s.phaseFrame > 30 && def.fatality.input.motion && (fb === 'punch' || fb === 'kick')) {
          this.enqueueMotion(def.fatality.input.motion, fb, f.facing);
        }
      }
      return {};
    }
    if (s.phase !== 'fight') return {};

    // only motions the queue knows how to perform (dp/hcb/360/PPP later)
    const specials = Object.entries(def.moves).filter(
      ([, m]) =>
        m.input &&
        (m.input.motion === 'qcf' || m.input.motion === 'qcb' || m.input.motion === 'bf') &&
        (m.input.button === 'punch' || m.input.button === 'kick'),
    );
    const pickSpecial = () => {
      const [, m] = specials[(s.tick >> 4) % specials.length];
      this.enqueueMotion(m.input!.motion as 'qcf' | 'qcb' | 'bf', m.input!.button as 'punch' | 'kick', f.facing);
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
}
