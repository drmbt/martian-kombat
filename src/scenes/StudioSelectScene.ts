// Dev-only Character Studio roster screen — the studio's front door. A
// variation on the character selector for MANAGING the roster instead of
// picking a fight: every fighter (online AND offline) as a card with
// lifecycle actions (edit in the studio, online/offline, export .zip,
// guided delete), a NEW CHARACTER door into the creator wizard, IMPORT ZIP,
// and the WIP drafts shelf (unshipped creator runs) to resume.
// DEV EDITOR → CHARACTER STUDIO lands here.
import Phaser from 'phaser';
import { STAGE_H, STAGE_W } from '../engine';
import { ROSTER } from '../data/roster';
import { characters } from '../data/characters';
import { UiLayer } from '../ui/layer';
import { play } from './BootScene';

const BASE = import.meta.env.BASE_URL;

export class StudioSelectScene extends Phaser.Scene {
  private layer?: UiLayer;
  private root?: HTMLDivElement;
  private statusEl?: HTMLDivElement;
  private selected: string | null = null;
  private needsReload = false;

  constructor() {
    super('StudioSelect');
  }

  create(): void {
    this.add.rectangle(STAGE_W / 2, STAGE_H / 2, STAGE_W, STAGE_H, 0x0a0d14, 1);
    const g = this.add.graphics();
    g.lineStyle(1, 0x162230, 0.6);
    for (let x = 0; x <= STAGE_W; x += 48) g.lineBetween(x, 0, x, STAGE_H);
    for (let y = 0; y <= STAGE_H; y += 48) g.lineBetween(0, y, STAGE_W, y);

    this.layer = new UiLayer(this);
    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:absolute;inset:0;pointer-events:auto;overflow-y:auto;font:13px monospace;color:#eaf6fb;' +
      'padding:18px 24px;box-sizing:border-box;background:rgba(10,13,20,.55);';
    this.layer.root.appendChild(this.root);
    this.render();
    void this.loadDrafts();

    this.input.keyboard?.on('keydown-ESC', () => this.back());
    this.events.once('shutdown', () => this.root?.remove());
  }

  private back(): void {
    play(this, 's-blip');
    this.scene.start('EditorMenu');
  }

  private status(msg: string, color = '#8fa6b2'): void {
    if (this.statusEl) {
      this.statusEl.textContent = msg;
      this.statusEl.style.color = color;
    }
  }

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, css: string, text = ''): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    e.style.cssText = css;
    if (text) e.textContent = text;
    return e;
  }

  private btn(label: string, onClick: () => void, accent = false): HTMLButtonElement {
    const b = this.el('button',
      `background:${accent ? '#24384a' : '#141d26'};color:${accent ? '#bff0ff' : '#c8d6dd'};` +
      `border:1px solid ${accent ? '#7fe3ff' : '#3f6070'};border-radius:4px;padding:5px 12px;` +
      'font:12px monospace;cursor:pointer;', label);
    b.onclick = onClick;
    return b;
  }

  private openStudio(module: string, p1?: string): void {
    play(this, 's-blip');
    const id = p1 ?? 'vincent';
    const partner = id === 'yulia' ? 'vincent' : 'yulia';
    // NEW characters build on the wireframe dev stage template; editing an
    // existing fighter opens on their home stage
    const stage = module === 'creator' && !p1
      ? 'wireframe'
      : (characters[id] as { stage?: string } | undefined)?.stage ?? 'chiba';
    this.scene.start('Fight', { p1: id, p2: partner, cpu: false, training: true, studio: true, module, stage, render3d: false });
  }

  private render(): void {
    if (!this.root) return;
    this.root.innerHTML = '';
    const head = this.el('div', 'display:flex;align-items:baseline;gap:16px;margin-bottom:10px;');
    head.appendChild(this.el('div', 'font-size:26px;font-weight:bold;color:#7fe3ff;', 'CHARACTER STUDIO'));
    head.appendChild(this.el('div', 'color:#8fa6b2;font-size:12px;', 'roster · lifecycle · import/export — ESC returns to the editor menu'));
    this.root.appendChild(head);

    // ── top actions ──
    const actions = this.el('div', 'display:flex;gap:8px;margin-bottom:14px;');
    actions.appendChild(this.btn('＋ NEW CHARACTER', () => this.openStudio('creator'), true));
    const importBtn = this.btn('⤒ IMPORT ZIP', () => this.importZip());
    actions.appendChild(importBtn);
    if (this.needsReload) {
      actions.appendChild(this.btn('↻ RELOAD (apply roster changes)', () => window.location.reload(), true));
    }
    this.root.appendChild(actions);

    // ── roster grid ──
    const grid = this.el('div', 'display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:8px;');
    for (const r of ROSTER) {
      const card = this.el('div',
        `border:1px solid ${this.selected === r.id ? '#7fe3ff' : r.playable ? '#3f6070' : '#5a3a3a'};` +
        `border-radius:6px;padding:6px;text-align:center;cursor:pointer;background:#10161d;` +
        `${r.playable ? '' : 'opacity:.55;'}`);
      const img = this.el('img', 'width:84px;height:84px;object-fit:cover;border-radius:4px;background:#0c1218;');
      img.src = `${BASE}assets/portraits/${r.id}.png`;
      img.onerror = () => { img.style.display = 'none'; };
      card.appendChild(img);
      card.appendChild(this.el('div', 'margin-top:4px;color:#bff0ff;font-size:12px;', r.id));
      card.appendChild(this.el('div', `font-size:10px;color:${r.playable ? '#6fe36f' : '#ffb46a'};`, r.playable ? 'ONLINE' : 'OFFLINE'));
      card.onclick = () => { this.selected = this.selected === r.id ? null : r.id; this.render(); };
      grid.appendChild(card);
    }
    this.root.appendChild(grid);

    // ── selected fighter actions ──
    if (this.selected) {
      const r = ROSTER.find((x) => x.id === this.selected)!;
      const bar = this.el('div', 'display:flex;gap:8px;align-items:center;margin:12px 0;padding:10px;border:1px solid #3f6070;border-radius:6px;background:#10161d;flex-wrap:wrap;');
      bar.appendChild(this.el('div', 'font-weight:bold;color:#7fe3ff;', r.id.toUpperCase()));
      if (r.playable) {
        bar.appendChild(this.btn('EDIT IN STUDIO →', () => this.openStudio('moves', r.id), true));
      } else {
        bar.appendChild(this.el('div', 'color:#8fa6b2;font-size:11px;', 'bring online (+ reload) to edit or fight'));
      }
      bar.appendChild(this.btn(r.playable ? 'TAKE OFFLINE' : 'BRING ONLINE', () => void this.setPlayable(r.id, !r.playable)));
      bar.appendChild(this.btn('EXPORT .ZIP', () => void this.exportZip(r.id)));
      bar.appendChild(this.btn('DELETE…', () => void this.deleteChar(r.id)));
      this.root.appendChild(bar);
    }

    // ── WIP drafts shelf (filled async) ──
    this.root.appendChild(this.el('div', 'margin-top:14px;font-weight:bold;color:#8fa6b2;font-size:12px;', 'WIP DRAFTS — unshipped creator runs (auto-saved)'));
    const shelf = this.el('div', 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;');
    shelf.id = 'mk-studio-drafts';
    shelf.appendChild(this.el('span', 'color:#5c6b78;font-size:11px;', 'loading…'));
    this.root.appendChild(shelf);

    this.statusEl = this.el('div', 'margin-top:12px;color:#8fa6b2;font-size:12px;');
    this.root.appendChild(this.statusEl);
  }

  private async loadDrafts(): Promise<void> {
    try {
      const r = await fetch('/__editor/creator/list');
      const j = (await r.json()) as { drafts?: { id: string; name: string; step: number }[] };
      const shelf = document.getElementById('mk-studio-drafts');
      if (!shelf) return;
      shelf.innerHTML = '';
      const canonIds = new Set(ROSTER.map((x) => x.id));
      const wip = (j.drafts ?? []).filter((d) => !canonIds.has(d.id));
      if (!wip.length) {
        shelf.appendChild(this.el('span', 'color:#5c6b78;font-size:11px;', 'none — start one with ＋ NEW CHARACTER'));
        return;
      }
      const STEPS = ['SEED', 'PROFILE', 'MOVES', 'RIG', 'POLISH', 'SHIP'];
      for (const d of wip) {
        shelf.appendChild(this.btn(`▸ ${d.name} · ${STEPS[d.step] ?? d.step}`, () => this.openStudio('creator')));
      }
    } catch {
      /* drafts shelf is best-effort (dev server only) */
    }
  }

  private async setPlayable(id: string, playable: boolean): Promise<void> {
    this.status('saving…', '#7fe3ff');
    try {
      const res = await fetch('/__editor/roster-flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, playable }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      const entry = ROSTER.find((x) => x.id === id);
      if (entry) entry.playable = playable;
      this.needsReload = true; // the boot loader decides what to load from this flag
      this.render();
      this.status(`${id} is now ${playable ? 'ONLINE' : 'OFFLINE'} — reload to apply to the loader`, '#6fe36f');
    } catch (err) {
      this.status(`failed (${String(err)}) — dev server only`, '#ff7a6a');
    }
  }

  private async exportZip(id: string): Promise<void> {
    this.status(`bundling ${id}…`, '#7fe3ff');
    try {
      const res = await fetch('/__editor/export-canon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const json = (await res.json()) as { ok?: boolean; zipBase64?: string; filename?: string; error?: string };
      if (!res.ok || !json.ok || !json.zipBase64) throw new Error(json.error ?? `HTTP ${res.status}`);
      const bytes = Uint8Array.from(atob(json.zipBase64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = json.filename ?? `${id}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      this.status(`${json.filename} downloaded`, '#6fe36f');
    } catch (err) {
      this.status(`export failed (${String(err)})`, '#ff7a6a');
    }
  }

  private async importZip(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      this.status(`importing ${file.name}…`, '#7fe3ff');
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        const res = await fetch('/__editor/creator/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zipBase64: btoa(bin) }),
        });
        const json = (await res.json()) as { ok?: boolean; id?: string; error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        this.needsReload = true;
        this.render();
        this.status(`${json.id} imported + registered — reload to load its assets`, '#6fe36f');
      } catch (err) {
        this.status(`import failed (${String(err)})`, '#ff7a6a');
      }
    };
    input.click();
  }

  private async deleteChar(id: string): Promise<void> {
    const typed = window.prompt(
      `DELETE ${id}?\n\nRemoves the character json, roster/index registration, sprites, portraits, fatality panels, VO and stage themes.\nRaw source frames + creator drafts are KEPT (recoverable).\n\nType the character id to confirm:`,
    );
    if (typed !== id) {
      this.status(typed === null ? 'delete cancelled' : 'confirm text did not match — nothing deleted', '#ffb46a');
      return;
    }
    this.status(`deleting ${id}…`, '#7fe3ff');
    try {
      const res = await fetch('/__editor/delete-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, confirm: typed }),
      });
      const json = (await res.json()) as { ok?: boolean; removed?: string[]; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      const i = ROSTER.findIndex((x) => x.id === id);
      if (i >= 0) ROSTER.splice(i, 1);
      this.selected = null;
      this.needsReload = true;
      this.render();
      this.status(`${id} deleted (${(json.removed ?? []).join(', ')}) — raw sources kept`, '#6fe36f');
    } catch (err) {
      this.status(`delete failed (${String(err)})`, '#ff7a6a');
    }
  }
}
