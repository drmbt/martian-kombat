// In-fight DOM HUD for the 3D scene (SPEC T19/T29): portraits, health +
// ghost bars, round pips, timer, combo counter, debug info line. Reuses the
// 2D portrait pngs (V15). All DOM writes are cached — the DOM is only
// touched when a value actually changes (perf pass).
import type { Defs, GameState, Phase } from '../../engine';

const PHASE_LABEL: Record<Phase, string> = {
  intro: 'ROUND',
  fight: '',
  roundEnd: 'KO',
  finisher: 'FINISH THEM',
  fatality: 'FATALITY',
  matchEnd: 'MATCH OVER — F9 REMATCH',
};

export interface FightHudFrame {
  ghost: [number, number];
  combo: string;
  clips: [string, string];
}

export class FightHud {
  readonly root: HTMLDivElement;
  private bars: [HTMLDivElement, HTMLDivElement];
  private ghosts: [HTMLDivElement, HTMLDivElement];
  private wins: [HTMLSpanElement, HTMLSpanElement];
  private timer: HTMLDivElement;
  private label: HTMLDivElement;
  private combo: HTMLDivElement;
  private info: HTMLDivElement;
  private cache: Record<string, string | number> = {};

  constructor(
    host: HTMLElement,
    private chars: [string, string],
    private defs: Defs,
  ) {
    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:absolute;pointer-events:none;color:#e8e4d8;font:12px monospace;' +
      'text-shadow:0 1px 2px #000;overflow:hidden;';

    const side = (slot: 0 | 1): { bar: HTMLDivElement; ghost: HTMLDivElement; wins: HTMLSpanElement } => {
      const id = chars[slot];
      const wrap = document.createElement('div');
      wrap.style.cssText =
        `position:absolute;top:10px;${slot === 0 ? 'left' : 'right'}:12px;width:42%;` +
        `display:flex;gap:8px;align-items:flex-start;${slot === 1 ? 'flex-direction:row-reverse;' : ''}`;
      const img = document.createElement('img');
      img.src = `${import.meta.env.BASE_URL}assets/portraits/${id}.png`;
      img.style.cssText = 'width:52px;height:52px;object-fit:cover;border:2px solid #d8d2c0;background:#222;';
      img.onerror = () => (img.style.display = 'none');
      const col = document.createElement('div');
      col.style.cssText = 'flex:1;';
      const name = document.createElement('div');
      name.textContent = id.toUpperCase();
      name.style.cssText = `margin-bottom:3px;${slot === 1 ? 'text-align:right;' : ''}`;
      const barOuter = document.createElement('div');
      barOuter.style.cssText =
        'position:relative;height:14px;background:#3a1010;border:2px solid #d8d2c0;overflow:hidden;';
      const ghost = document.createElement('div');
      ghost.style.cssText =
        `position:absolute;top:0;${slot === 0 ? 'right' : 'left'}:0;height:100%;width:100%;background:#c8452c;`;
      const bar = document.createElement('div');
      bar.style.cssText =
        `position:absolute;top:0;${slot === 0 ? 'right' : 'left'}:0;height:100%;width:100%;background:#e8c832;`;
      barOuter.append(ghost, bar);
      const wins = document.createElement('span');
      wins.style.cssText =
        `display:block;color:#ffd75e;font-size:20px;line-height:1.2;letter-spacing:3px;` +
        `text-shadow:0 1px 3px #000;${slot === 1 ? 'text-align:right;' : ''}`;
      col.append(name, barOuter, wins);
      wrap.append(img, col);
      this.root.appendChild(wrap);
      return { bar, ghost, wins };
    };

    const l = side(0);
    const r = side(1);
    this.bars = [l.bar, r.bar];
    this.ghosts = [l.ghost, r.ghost];
    this.wins = [l.wins, r.wins];

    this.timer = document.createElement('div');
    this.timer.style.cssText =
      'position:absolute;top:14px;left:50%;transform:translateX(-50%);font-size:28px;font-weight:bold;';
    this.label = document.createElement('div');
    this.label.style.cssText =
      'position:absolute;top:52px;left:50%;transform:translateX(-50%);font-size:16px;color:#ff5e4a;white-space:nowrap;';
    this.combo = document.createElement('div');
    this.combo.style.cssText =
      'position:absolute;top:34%;left:18%;font-size:22px;font-weight:bold;color:#ffd75e;display:none;';
    this.info = document.createElement('div');
    this.info.style.cssText = 'position:absolute;left:12px;bottom:8px;white-space:pre;opacity:.8;';
    this.root.append(this.timer, this.label, this.combo, this.info);
    host.appendChild(this.root);
  }

  update(s: GameState, frame: FightHudFrame): void {
    const c = this.cache;
    for (const slot of [0, 1] as const) {
      const f = s.fighters[slot];
      const max = this.defs[f.charId].health;
      const barW = Math.max(0, Math.round((f.health / max) * 1000) / 10);
      if (c[`bar${slot}`] !== barW) {
        c[`bar${slot}`] = barW;
        this.bars[slot].style.width = `${barW}%`;
      }
      const ghostW = Math.max(0, Math.round((frame.ghost[slot] / max) * 1000) / 10);
      if (c[`ghost${slot}`] !== ghostW) {
        c[`ghost${slot}`] = ghostW;
        this.ghosts[slot].style.width = `${ghostW}%`;
      }
      if (c[`wins${slot}`] !== s.wins[slot]) {
        c[`wins${slot}`] = s.wins[slot];
        const empty = Math.max(0, s.rules.winsNeeded - s.wins[slot]);
        this.wins[slot].innerHTML =
          '★'.repeat(s.wins[slot]) + (empty ? `<span style="color:#5d5748;">${'☆'.repeat(empty)}</span>` : '');
      }
    }
    const timer = s.rules.roundTicks ? String(Math.max(0, Math.ceil(s.timer / 60))) : '∞';
    if (c.timer !== timer) {
      c.timer = timer;
      this.timer.textContent = timer;
    }
    const label = s.phase === 'intro' ? `ROUND ${s.roundNumber}` : PHASE_LABEL[s.phase];
    if (c.label !== label) {
      c.label = label;
      this.label.textContent = label;
    }
    if (c.combo !== frame.combo) {
      c.combo = frame.combo;
      this.combo.style.display = frame.combo ? 'block' : 'none';
      if (frame.combo) this.combo.textContent = frame.combo;
    }
    const info =
      `[F1] hitboxes  [F2] skeleton  [F3] inspector  [F4] settings  [F9] rematch  [ESC] menu\n` +
      `clips: ${frame.clips[0]} | ${frame.clips[1]}`;
    if (c.info !== info) {
      c.info = info;
      this.info.textContent = info;
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
