// Shared pause dialog (DOM, both renderers): a row of action buttons
// (keyboard/gamepad cursor + mouse hover/click all move the same selection)
// over both fighters' scrollable move-list columns, with a hotkey hint line.
// The scene owns WHEN it's open (ESC/Start) and feeds pad-nav via move()/
// confirm(); this component owns layout and selection state.
import type { CharacterDef } from '../engine';
import { moveListText } from '../presentation/notation';

export interface PauseAction {
  label: string;
  act: () => void;
}

export class PauseMenu {
  private el: HTMLDivElement;
  private buttons: HTMLButtonElement[] = [];
  private acts: (() => void)[] = [];
  private sel = 0;

  /** `host` = the UiLayer root; the menu enables pointer events on itself */
  constructor(
    host: HTMLElement,
    fighters: [CharacterDef, CharacterDef],
    actions: PauseAction[],
    private opts: { hint?: string; onNavSound?: () => void } = {},
  ) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      // z-index 30 keeps the pause dialog above the dev editor panels
      // (MoveTuner/SpriteEditor sit at z-index 8) so it stays interactable
      'position:absolute;inset:3.5%;display:none;flex-direction:column;gap:10px;z-index:30;' +
      'background:rgba(12,9,16,.95);border:2px solid #594566;padding:14px 20px;' +
      'color:#f5ead9;font:13px monospace;pointer-events:auto;';

    const title = document.createElement('div');
    title.textContent = 'PAUSED';
    title.style.cssText = 'text-align:center;font-size:24px;font-weight:bold;letter-spacing:3px;';
    this.el.appendChild(title);

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:14px;';
    actions.forEach((a, i) => {
      const b = document.createElement('button');
      b.textContent = a.label;
      b.style.cssText =
        'flex:1;padding:10px 0;font:bold 13px monospace;color:#f5ead9;background:#241b2e;' +
        'border:2px solid #7a6a86;cursor:pointer;letter-spacing:1px;';
      b.onmouseenter = () => this.select(i);
      b.onclick = () => {
        this.opts.onNavSound?.();
        a.act();
      };
      row.appendChild(b);
      this.buttons.push(b);
      this.acts.push(a.act);
    });
    this.el.appendChild(row);

    const cols = document.createElement('div');
    cols.style.cssText = 'flex:1;display:flex;gap:20px;min-height:0;';
    for (const def of fighters) {
      const col = document.createElement('pre');
      col.textContent = moveListText(def);
      col.style.cssText =
        'flex:1;margin:0;overflow-y:auto;white-space:pre-wrap;font:13px monospace;' +
        'line-height:1.45;scrollbar-width:thin;';
      cols.appendChild(col);
    }
    this.el.appendChild(cols);

    const hint = document.createElement('div');
    hint.textContent =
      this.opts.hint ?? 'ESC/START resume · ◄► choose, attack confirms · F1 hitboxes · F2 move log · ` perf';
    hint.style.cssText = 'text-align:center;color:#9a8fa8;font-size:11px;';
    this.el.appendChild(hint);

    host.appendChild(this.el);
    this.highlight();
  }

  get visible(): boolean {
    return this.el.style.display !== 'none';
  }

  setVisible(v: boolean): void {
    this.el.style.display = v ? 'flex' : 'none';
    if (v) this.select(0);
  }

  /** move the button cursor (pad/keyboard nav); d = ±1 */
  move(d: number): void {
    const n = this.buttons.length;
    if (!n) return;
    this.opts.onNavSound?.();
    this.select((this.sel + d + n) % n);
  }

  /** trigger the selected button (pad/keyboard confirm) */
  confirm(): void {
    this.acts[this.sel]?.();
  }

  private select(i: number): void {
    this.sel = i;
    this.highlight();
  }

  private highlight(): void {
    this.buttons.forEach((b, i) => {
      const on = i === this.sel;
      b.style.background = on ? '#3a2b40' : '#241b2e';
      b.style.borderColor = on ? '#ffb347' : '#7a6a86';
      b.style.color = on ? '#ffd24a' : '#f5ead9';
    });
  }

  dispose(): void {
    this.el.remove();
  }
}
