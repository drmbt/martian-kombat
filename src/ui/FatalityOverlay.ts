// Fatality cutscene overlay (SPEC T27/T29): full-bleed panel slideshow
// reusing the exact 2D jpgs, crossfaded by phaseFrame. Builds lazily on the
// first fatality tick, hides outside the phase.
import { FATALITY_TICKS } from '../engine';
import type { Defs, GameState } from '../engine';

export class FatalityOverlay {
  private el: HTMLDivElement | null = null;
  private imgs: HTMLImageElement[] = [];

  /** `host` = the UiLayer root (already pinned over the game canvas) */
  constructor(
    private host: HTMLElement,
    private defs: Defs,
  ) {}

  sync(s: GameState): void {
    if (s.phase !== 'fatality' || !s.fatality) {
      if (this.el) this.el.style.display = 'none';
      return;
    }
    const owner = s.fighters[s.fatality.owner];
    const def = this.defs[owner.charId];
    const panels = def.fatality?.panels ?? 0;
    if (!panels) return;
    if (!this.el) {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;inset:0;background:#000;pointer-events:none;z-index:3;';
      for (let n = 1; n <= panels; n++) {
        const img = document.createElement('img');
        img.src = `${import.meta.env.BASE_URL}assets/fatalities/${owner.charId}/${s.fatality.id}-${n}.jpg`;
        img.style.cssText =
          'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .25s;';
        el.appendChild(img);
        this.imgs.push(img);
      }
      this.host.appendChild(el);
      this.el = el;
    }
    this.el.style.display = 'block';
    const idx = Math.min(Math.floor(s.phaseFrame / (FATALITY_TICKS / panels)), panels - 1);
    this.imgs.forEach((img, i) => (img.style.opacity = i === idx ? '1' : '0'));
  }

  dispose(): void {
    this.el?.remove();
    this.el = null;
    this.imgs = [];
  }
}
