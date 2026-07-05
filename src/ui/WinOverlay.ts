// Post-match SFII-style win screen, shared by BOTH renderers: winner
// portrait squares off against the beaten loser bust (-ko.png with greyscale
// fallback), "<NAME> WINS" in the winner's color, a random winQuotes taunt,
// and a navigation prompt line. Built lazily on matchEnd (after the K.O.
// beat), torn down on dispose (scene restart).
import type { Defs, GameState } from '../engine';

export interface WinOverlayOpts {
  /** bottom prompt, e.g. 'R  REMATCH   ·   ENTER  SELECT' */
  prompt?: string;
  /** fired once when the screen first appears (2D plays the victory voice) */
  onFirstShow?: (winnerCharId: string) => void;
  /** delay reveal until this many matchEnd phaseFrames (2D uses 72 so the
   *  K.O./victory beat lands first); 0 = immediate */
  revealFrame?: number;
}

export class WinOverlay {
  private el: HTMLDivElement | null = null;

  /** `host` = the UiLayer root (already pinned over the game canvas) */
  constructor(
    private host: HTMLElement,
    private defs: Defs,
    private opts: WinOverlayOpts = {},
  ) {}

  sync(s: GameState): void {
    const due = s.phase === 'matchEnd' && s.roundWinner !== null && s.phaseFrame >= (this.opts.revealFrame ?? 0);
    if (!due) {
      if (this.el) this.el.style.display = 'none';
      return;
    }
    if (this.el) {
      this.el.style.display = 'flex';
      return;
    }
    const winner = s.fighters[s.roundWinner!];
    const loser = s.fighters[s.roundWinner === 0 ? 1 : 0];
    const wDef = this.defs[winner.charId];
    const quotes = wDef.winQuotes ?? [];
    const quote = quotes.length ? quotes[s.tick % quotes.length] : '...';
    const base = import.meta.env.BASE_URL;
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;inset:0;background:#05030a;color:#e8e4d8;font:14px monospace;' +
      'pointer-events:none;z-index:4;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;gap:16px;text-align:center;';
    const fatal = s.fatality ? `<div style="color:#ff4b2e;font-weight:bold;letter-spacing:4px;">FATALITY</div>` : '';
    el.innerHTML =
      `<div style="font-size:34px;font-weight:bold;color:${wDef.color};text-shadow:0 3px 0 #000,0 5px 14px rgba(0,0,0,.7);letter-spacing:2px;">${wDef.name.toUpperCase()} WINS</div>` +
      fatal +
      `<div style="display:flex;gap:56px;align-items:flex-end;">` +
      `<img src="${base}assets/portraits/${winner.charId}.png" style="width:180px;border:3px solid #e8c832;background:#222;">` +
      `<img src="${base}assets/portraits/${loser.charId}-ko.png" onerror="this.src='${base}assets/portraits/${loser.charId}.png';this.style.filter='grayscale(1)'" style="width:150px;border:3px solid #555;background:#222;transform:scaleX(-1);">` +
      `</div>` +
      `<div style="max-width:72%;font-size:17px;color:#ffd24a;text-shadow:0 2px 4px #000;">“${quote}”</div>` +
      `<div style="opacity:.65;">${this.opts.prompt ?? 'R  REMATCH   ·   ENTER  SELECT   ·   ESC  MENU'}</div>`;
    this.host.appendChild(el);
    this.el = el;
    this.opts.onFirstShow?.(winner.charId);
  }

  dispose(): void {
    this.el?.remove();
    this.el = null;
  }
}
