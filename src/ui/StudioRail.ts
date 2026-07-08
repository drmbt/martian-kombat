// Character Studio module rail (dev-only). A slim collapsible DOM rail on the
// left edge of the FightScene `studio` mode: one button per module; clicking
// activates that module's panel over the LIVE fight scene (the WYSIWYG
// guarantee — the character is always standing in a real fight). One module
// active at a time; TEST deactivates everything so the scene is pure play.
// Modules are lazy: activate() mounts on first use, deactivate() hides.
export interface StudioModule {
  key: string;
  label: string;
  hint: string;
  activate: () => void;
  deactivate: () => void;
}

export class StudioRail {
  private el: HTMLDivElement;
  private buttons = new Map<string, HTMLButtonElement>();
  private active: string | null = null;
  private collapsed = false;
  private body!: HTMLDivElement;

  constructor(
    parent: HTMLElement,
    private modules: StudioModule[],
    initial?: string,
  ) {
    this.el = document.createElement('div');
    // a horizontal strip at the very top of the screen, ABOVE the health
    // bars, clear of the F1/F2 debug overlays. The UiLayer root is
    // pointer-events:none (gameplay clicks pass through), so the rail must
    // opt back in or its buttons are dead to the mouse.
    this.el.style.cssText =
      'position:absolute;left:8px;top:2px;z-index:30;display:flex;flex-direction:row;gap:4px;' +
      'font-family:monospace;user-select:none;pointer-events:auto;';
    parent.appendChild(this.el);

    const head = document.createElement('button');
    head.textContent = '▾ STUDIO';
    head.title = 'collapse/expand the module bar';
    head.style.cssText = this.btnCss(false) + 'font-weight:bold;color:#7fe3ff;';
    head.onclick = () => {
      this.collapsed = !this.collapsed;
      this.body.style.display = this.collapsed ? 'none' : 'flex';
      head.textContent = this.collapsed ? '▸ STUDIO' : '▾ STUDIO';
    };
    this.el.appendChild(head);

    this.body = document.createElement('div');
    this.body.style.cssText = 'display:flex;flex-direction:row;gap:4px;';
    this.el.appendChild(this.body);

    for (const m of modules) {
      const b = document.createElement('button');
      b.textContent = m.label;
      b.title = m.hint;
      b.style.cssText = this.btnCss(false);
      b.onclick = () => this.setActive(this.active === m.key ? null : m.key);
      this.buttons.set(m.key, b);
      this.body.appendChild(b);
    }
    if (initial && modules.some((m) => m.key === initial)) this.setActive(initial);
  }

  private btnCss(on: boolean): string {
    return (
      `background:${on ? '#24384a' : '#141d26'};color:${on ? '#bff0ff' : '#c8d6dd'};` +
      'border:1px solid ' + (on ? '#7fe3ff' : '#3f6070') + ';border-radius:4px;' +
      'padding:4px 12px;font-family:monospace;font-size:12px;cursor:pointer;'
    );
  }

  /** activate a module (null = TEST/play: everything deactivated) */
  setActive(key: string | null): void {
    if (this.active === key) return;
    const prev = this.modules.find((m) => m.key === this.active);
    prev?.deactivate();
    this.active = key;
    const next = this.modules.find((m) => m.key === key);
    next?.activate();
    for (const [k, b] of this.buttons) b.style.cssText = this.btnCss(k === key);
  }

  dispose(): void {
    this.el.remove();
  }
}
