// F2 debug move log (pure model): a raw-input ticker per player (held
// direction arrows + freshly pressed buttons — what the engine actually
// registered) and a FIFO of triggered moves. Renderers just print the
// string arrays; toggling/visibility is theirs.
import type { Defs, GameState, InputFrame } from '../engine';
import { EMPTY_INPUT } from '../engine';
import { moveLabel } from './notation';

const BUTTONS = ['lp', 'mp', 'hp', 'lk', 'mk', 'hk'] as const;
const MOVE_LINES = 8;
const INPUT_TOKENS = 10;

export class MoveLogModel {
  /** FIFO of triggered moves: "P1  Rising Glyph (H) · ↓↘→+P" */
  readonly moves: string[] = [];
  /** per-player raw-input token history, oldest first */
  readonly inputs: [string[], string[]] = [[], []];
  private prev: [InputFrame, InputFrame] = [{ ...EMPTY_INPUT }, { ...EMPTY_INPUT }];

  /** call once per tick with the frames the engine consumed; returns which
   *  slots gained a token so renderers only redraw changed lines */
  logInputs(frames: [InputFrame, InputFrame]): [boolean, boolean] {
    const changed: [boolean, boolean] = [false, false];
    for (const slot of [0, 1] as const) {
      const i = frames[slot];
      const prev = this.prev[slot];
      const dir =
        i.up && i.left ? '↖' : i.up && i.right ? '↗'
        : i.down && i.left ? '↙' : i.down && i.right ? '↘'
        : i.up ? '↑' : i.down ? '↓' : i.left ? '←' : i.right ? '→' : '';
      const btns = BUTTONS
        .filter((b) => i[b] && !prev[b])
        .map((b) => b.toUpperCase())
        .join('+');
      this.prev[slot] = { ...i };
      const token = btns ? `${dir}${dir ? '+' : ''}${btns}` : dir;
      const hist = this.inputs[slot];
      if (token && token !== hist[hist.length - 1]) {
        hist.push(token);
        if (hist.length > INPUT_TOKENS) hist.shift();
        changed[slot] = true;
      }
    }
    return changed;
  }

  /** record a triggered move (call on the attack-start event) */
  logMove(slot: 0 | 1, s: GameState, defs: Defs): void {
    const f = s.fighters[slot];
    this.moves.push(`P${slot + 1}  ${moveLabel(defs[f.charId], f.action)}`);
    if (this.moves.length > MOVE_LINES) this.moves.shift();
  }

  /** "P1 ▸ ↓ ↘ →+LP" line for one player */
  inputLine(slot: 0 | 1): string {
    return `P${slot + 1} ▸ ${this.inputs[slot].join(' ')}`;
  }

  moveLines(): string {
    return this.moves.join('\n');
  }
}
