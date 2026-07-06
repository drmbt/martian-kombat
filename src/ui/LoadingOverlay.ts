// Full-cover LOADING… screen (DOM): the 3D scene holds the sim behind it
// while models/stage/pipelines stream in; reusable by anything that needs to
// mask a wait over the game canvas.
export class LoadingOverlay {
  private el: HTMLDivElement | null = null;

  /** `host` = the UiLayer root (already pinned over the game canvas) */
  constructor(private host: HTMLElement) {}

  show(): void {
    if (this.el) return;
    const el = document.createElement('div');
    el.textContent = 'LOADING…';
    el.style.cssText =
      'position:absolute;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;' +
      'background:#0c0910;color:#ffb347;font:bold 28px monospace;letter-spacing:3px;text-shadow:0 2px 6px #000;';
    this.host.appendChild(el);
    this.el = el;
  }

  hide(): void {
    this.el?.remove();
    this.el = null;
  }

  dispose(): void {
    this.hide();
  }
}
