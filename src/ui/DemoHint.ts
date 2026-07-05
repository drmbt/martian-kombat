// Attract-mode banner (DOM, both renderers): blinking "DEMO — PRESS ANY
// KEY". Purely visual — the scene wires the actual exit inputs.
const STYLE_ID = 'mk-demo-hint-style';

export class DemoHint {
  private el: HTMLDivElement;

  /** `host` = the UiLayer root (already pinned over the game canvas) */
  constructor(host: HTMLElement) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent =
        '@keyframes mkDemoBlink { 0%,100% { opacity:1; } 50% { opacity:.15; } }';
      document.head.appendChild(style);
    }
    this.el = document.createElement('div');
    this.el.textContent = 'DEMO — PRESS ANY KEY';
    this.el.style.cssText =
      'position:absolute;left:50%;bottom:26px;transform:translateX(-50%);z-index:7;' +
      'font:bold 20px monospace;color:#ffd24a;text-shadow:0 2px 5px #000;' +
      'pointer-events:none;animation:mkDemoBlink 1.1s ease-in-out infinite;';
    host.appendChild(this.el);
  }

  dispose(): void {
    this.el.remove();
  }
}
