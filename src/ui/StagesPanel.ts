// Character Studio STAGES module (dev-only): the stage registry as a panel —
// every registered stage with its world-map pin status and home-stage owners,
// a fighter ⇄ home-stage assignment row (writes def.stage through
// /__editor/character), and a jump into the world-map pin editor that returns
// to the studio. Stage CREATION stays in the creator wizard's PROFILE step
// for now; the gen-in-flow version rides the Phase 4 job runner.
import type { CharacterDef } from '../engine';
import { STAGES, stageOwner } from '../data/stages';
import { ROSTER } from '../data/roster';
import pins from '../data/stage-pins.json';

export interface StagesHost {
  /** jump to the world-map pin editor (the scene returns to the studio) */
  openPinEditor(): void;
}

export class StagesPanel {
  private el: HTMLDivElement;
  private statusEl!: HTMLDivElement;

  constructor(
    host: HTMLElement,
    private defs: Record<string, CharacterDef>,
    private scene: StagesHost,
  ) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:absolute;right:0;top:48px;bottom:10%;width:360px;overflow-y:auto;box-sizing:border-box;' +
      'background:rgba(10,14,18,.72);border-left:2px solid #3f6070;padding:10px;pointer-events:auto;' +
      'font:12px monospace;color:#eaf6fb;z-index:8;';
    host.appendChild(this.el);
    this.render();
  }

  setMounted(v: boolean): void {
    this.el.style.display = v ? 'block' : 'none';
  }

  dispose(): void {
    this.el.remove();
  }

  private h(text: string, size: number, color: string): HTMLDivElement {
    const d = document.createElement('div');
    d.textContent = text;
    d.style.cssText = `font-size:${size}px;font-weight:bold;color:${color};margin:8px 0 4px;`;
    return d;
  }

  private status(msg: string, color = '#8fa6b2'): void {
    this.statusEl.textContent = msg;
    this.statusEl.style.color = color;
  }

  private render(): void {
    this.el.innerHTML = '';
    this.el.appendChild(this.h('STAGES', 13, '#7fe3ff'));

    // ── home-stage assignment ──
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:4px;align-items:center;margin:6px 0;';
    const selCss = 'flex:1;background:#0c1218;color:#eaf6fb;border:1px solid #3f6070;border-radius:3px;font:11px monospace;padding:3px;min-width:0;';
    const fighterSel = document.createElement('select');
    fighterSel.style.cssText = selCss;
    for (const r of ROSTER.filter((x) => x.playable)) {
      const o = document.createElement('option');
      o.value = r.id;
      o.textContent = r.id;
      fighterSel.appendChild(o);
    }
    const stageSel = document.createElement('select');
    stageSel.style.cssText = selCss;
    const none = document.createElement('option');
    none.value = '';
    none.textContent = '(no home stage)';
    stageSel.appendChild(none);
    for (const s of STAGES) {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.id;
      stageSel.appendChild(o);
    }
    const syncStage = (): void => {
      stageSel.value = this.defs[fighterSel.value]?.stage ?? '';
    };
    fighterSel.onchange = syncStage;
    const setBtn = document.createElement('button');
    setBtn.textContent = 'SET';
    setBtn.style.cssText = 'background:#24384a;color:#bff0ff;border:1px solid #7fe3ff;border-radius:3px;font:11px monospace;padding:3px 10px;cursor:pointer;';
    setBtn.onclick = () => void this.assign(fighterSel.value, stageSel.value);
    row.append(fighterSel, stageSel, setBtn);
    this.el.appendChild(this.h('home stage — fighter ⇄ stage', 11, '#8fa6b2'));
    this.el.appendChild(row);
    syncStage();

    // ── pin editor jump ──
    const pinBtn = document.createElement('button');
    const unpinned = STAGES.filter((s) => !(pins as Record<string, unknown>)[s.id]).length;
    pinBtn.textContent = unpinned ? `PLACE PINS ON THE WORLD MAP (${unpinned} unplaced) →` : 'WORLD-MAP PIN EDITOR →';
    pinBtn.style.cssText = 'width:100%;margin:8px 0;background:#141d26;color:#c8d6dd;border:1px solid #3f6070;border-radius:4px;font:12px monospace;padding:6px;cursor:pointer;';
    pinBtn.onclick = () => this.scene.openPinEditor();
    this.el.appendChild(pinBtn);

    // ── registry list ──
    this.el.appendChild(this.h(`registry — ${STAGES.length} stages`, 11, '#8fa6b2'));
    const charIds = ROSTER.filter((r) => r.playable).map((r) => r.id);
    for (const s of STAGES) {
      const line = document.createElement('div');
      const pinned = !!(pins as Record<string, unknown>)[s.id];
      const owner = stageOwner(s.id, charIds, this.defs);
      line.style.cssText = 'display:flex;gap:6px;padding:3px 4px;border-bottom:1px solid #1d2833;align-items:baseline;';
      const name = document.createElement('span');
      name.textContent = s.id;
      name.style.cssText = 'color:#bff0ff;flex:1;';
      const meta = document.createElement('span');
      meta.textContent = `${pinned ? '📍' : '⚠ no pin'}${owner ? ` · ${owner}` : ''}`;
      meta.style.cssText = `color:${pinned ? '#8fa6b2' : '#ffb46a'};font-size:11px;`;
      line.append(name, meta);
      this.el.appendChild(line);
    }

    const note = document.createElement('div');
    note.textContent = 'create a NEW stage in CREATOR → PROFILE (photo or prompt); it registers + claims on ship';
    note.style.cssText = 'margin:8px 0;color:#7d94a0;font-size:11px;';
    this.el.appendChild(note);

    this.statusEl = document.createElement('div');
    this.statusEl.style.cssText = 'margin-top:6px;color:#8fa6b2;';
    this.el.appendChild(this.statusEl);
  }

  /** write def.stage to disk + mirror into the live registry */
  private async assign(charId: string, stageId: string): Promise<void> {
    this.status('saving…', '#7fe3ff');
    try {
      const res = await fetch('/__editor/character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: charId, stage: stageId || null }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      const def = this.defs[charId] as CharacterDef & { stage?: string };
      if (stageId) def.stage = stageId;
      else delete def.stage;
      this.render();
      this.status(`${charId} home stage ${stageId ? `→ ${stageId}` : 'cleared'} · saved`, '#6fe36f');
    } catch (err) {
      this.status(`save failed (${String(err)}) — dev server only`, '#ff7a6a');
    }
  }
}
