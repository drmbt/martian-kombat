// F2 debug overlay (DOM, both renderers): the move FIFO in the upper-left,
// per-player raw-input tickers in the upper-right. Pure display for the
// shared MoveLogModel; DOM only touched when a line actually changes.
import type { MoveLogModel } from '../presentation/moveLog';

const P_COLORS = ['#58e6d9', '#ff8a7a'];

export class MoveLogOverlay {
  private el: HTMLDivElement;
  private movesEl: HTMLPreElement;
  private inputEls: [HTMLDivElement, HTMLDivElement];
  private cache: Record<string, string> = {};

  /** `host` = the UiLayer root (already pinned over the game canvas) */
  constructor(host: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText = 'position:absolute;inset:0;pointer-events:none;display:none;z-index:2;';
    this.movesEl = document.createElement('pre');
    this.movesEl.style.cssText =
      'position:absolute;left:16px;top:96px;margin:0;font:13px monospace;color:#9ef7a0;' +
      'text-shadow:0 1px 3px #000;line-height:1.35;';
    this.el.appendChild(this.movesEl);
    const mk = (slot: 0 | 1): HTMLDivElement => {
      const d = document.createElement('div');
      d.style.cssText =
        `position:absolute;right:16px;top:${96 + slot * 24}px;font:15px monospace;` +
        `color:${P_COLORS[slot]};text-shadow:0 1px 3px #000;`;
      this.el.appendChild(d);
      return d;
    };
    this.inputEls = [mk(0), mk(1)];
    host.appendChild(this.el);
  }

  get visible(): boolean {
    return this.el.style.display !== 'none';
  }

  setVisible(v: boolean): void {
    this.el.style.display = v ? 'block' : 'none';
  }

  /** call per frame while visible — writes only changed lines */
  update(model: MoveLogModel): void {
    const moves = model.moveLines();
    if (this.cache.moves !== moves) {
      this.cache.moves = moves;
      this.movesEl.textContent = moves;
    }
    for (const slot of [0, 1] as const) {
      const line = model.inputLine(slot);
      if (this.cache[`in${slot}`] !== line) {
        this.cache[`in${slot}`] = line;
        this.inputEls[slot].textContent = line;
      }
    }
  }

  dispose(): void {
    this.el.remove();
  }
}
