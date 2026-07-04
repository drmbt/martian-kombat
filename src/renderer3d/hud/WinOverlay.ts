// Post-match win screen (SPEC T27/T29): winner portrait, beaten loser bust
// (-ko.png with greyscale fallback), random winQuotes taunt. Built once on
// matchEnd, torn down on dispose (scene restart).
import type { Defs, GameState } from '../../engine';

export class WinOverlay {
  private el: HTMLDivElement | null = null;

  constructor(
    private host: HTMLElement,
    private defs: Defs,
    private anchor: HTMLElement,
  ) {}

  sync(s: GameState): void {
    if (s.phase !== 'matchEnd' || s.roundWinner === null) {
      if (this.el) this.el.style.display = 'none';
      return;
    }
    if (this.el) {
      this.el.style.display = 'flex';
      return;
    }
    const winner = s.fighters[s.roundWinner];
    const loser = s.fighters[s.roundWinner === 0 ? 1 : 0];
    const wDef = this.defs[winner.charId];
    const quotes = wDef.winQuotes ?? ['...'];
    const quote = quotes[s.tick % quotes.length];
    const base = import.meta.env.BASE_URL;
    const el = document.createElement('div');
    const a = this.anchor.style;
    el.style.cssText =
      `position:absolute;left:${a.left};top:${a.top};width:${a.width};height:${a.height};` +
      'background:rgba(5,6,12,.82);color:#e8e4d8;font:14px monospace;pointer-events:none;z-index:4;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;';
    el.innerHTML =
      `<div style="display:flex;gap:40px;align-items:flex-end;">` +
      `<img src="${base}assets/portraits/${winner.charId}.png" style="width:130px;border:3px solid #e8c832;background:#222;">` +
      `<img src="${base}assets/portraits/${loser.charId}-ko.png" onerror="this.src='${base}assets/portraits/${loser.charId}.png';this.style.filter='grayscale(1)'" style="width:110px;border:3px solid #555;background:#222;">` +
      `</div>` +
      `<div style="font-size:20px;color:#ffd75e;">${wDef.name.toUpperCase()} WINS</div>` +
      `<div style="max-width:70%;">“${quote}”</div>` +
      `<div style="opacity:.6;">[F9] rematch · [ESC] menu</div>`;
    this.host.appendChild(el);
    this.el = el;
  }

  dispose(): void {
    this.el?.remove();
    this.el = null;
  }
}
