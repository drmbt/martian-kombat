// Online post-match rematch prompt (DOM, both renderers): renders the
// RematchState handshake — offer, waiting, agreed, and the leave line.
import type { RematchState } from '../net/rematch';

export class RematchPrompt {
  private el: HTMLDivElement | null = null;

  /** `host` = the UiLayer root (already pinned over the game canvas) */
  constructor(private host: HTMLElement) {}

  set(st: RematchState): void {
    const msg = st.localReady
      ? st.remoteReady
        ? 'REMATCH! back to select…'
        : `waiting for ${st.remoteName}…`
      : st.remoteReady
        ? `${st.remoteName} wants a REMATCH!  ·  [R] accept   [ESC] quit`
        : 'REMATCH?  [R] play again   ·   [ESC] quit';
    this.show(msg, st.localReady && st.remoteReady ? '#8fe388' : '#ffd24a');
  }

  /** terminal line (opponent left / you left) */
  leave(reason: string): void {
    this.show(reason, '#ff5a4a');
  }

  private show(msg: string, color: string): void {
    if (!this.el) {
      const el = document.createElement('div');
      el.style.cssText =
        'position:absolute;left:50%;bottom:26px;transform:translateX(-50%);z-index:7;' +
        'font:bold 17px monospace;color:#ffd24a;background:#1a1020;padding:6px 12px;' +
        'border-radius:4px;text-shadow:0 2px 4px #000;pointer-events:none;white-space:nowrap;';
      this.host.appendChild(el);
      this.el = el;
    }
    this.el.textContent = msg;
    this.el.style.color = color;
  }

  dispose(): void {
    this.el?.remove();
    this.el = null;
  }
}
