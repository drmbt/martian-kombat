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
    // container-type:size lets the children scale in cq units against the
    // overlay's own box (the letterboxed canvas region), not the viewport
    el.style.cssText =
      'position:absolute;inset:0;container-type:size;background:#05030a;color:#e8e4d8;' +
      'font:14px monospace;pointer-events:none;z-index:4;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:3.2cqh;text-align:center;';
    // stylized SFII-style title: crisp black outline + drop for depth
    const titleShadow =
      '-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,2px 2px 0 #000,0 6px 18px rgba(0,0,0,.85)';
    const fatal = s.fatality
      ? `<div style="font-size:4cqh;font-weight:bold;letter-spacing:1cqh;color:#ff4b2e;text-shadow:${titleShadow};">FATALITY</div>`
      : '';
    // busts are transparent-backed silhouettes (no boxes) that face each other;
    // size to the overlay so the screen scales like the SFII reference
    const bust =
      'height:44cqh;width:auto;image-rendering:pixelated;filter:drop-shadow(0 6px 10px rgba(0,0,0,.6));';
    el.innerHTML =
      `<div style="font-size:9cqh;font-weight:bold;color:${wDef.color};text-shadow:${titleShadow};letter-spacing:0.6cqh;line-height:1;">${wDef.name.toUpperCase()} WINS</div>` +
      fatal +
      `<div style="display:flex;gap:8cqw;align-items:flex-end;justify-content:center;">` +
      `<img src="${base}assets/portraits/${winner.charId}.png" style="${bust}">` +
      `<img src="${base}assets/portraits/${loser.charId}-ko.png" onerror="this.src='${base}assets/portraits/${loser.charId}.png';this.style.filter='grayscale(1) drop-shadow(0 6px 10px rgba(0,0,0,.6))'" style="${bust}transform:scaleX(-1);">` +
      `</div>` +
      `<div style="max-width:74%;font-size:3cqh;font-style:italic;color:#ffd24a;text-shadow:0 2px 5px #000;">“${quote}”</div>` +
      `<div style="font-size:2cqh;letter-spacing:0.2cqh;opacity:.55;">${this.opts.prompt ?? 'R  REMATCH   ·   ENTER  SELECT   ·   ESC  MENU'}</div>`;
    this.host.appendChild(el);
    this.el = el;
    this.opts.onFirstShow?.(winner.charId);
  }

  dispose(): void {
    this.el?.remove();
    this.el = null;
  }
}
