// Character Creator wizard — DOM overlay (dev-only), mounted over a grid-stage
// backdrop by CharacterCreatorScene. Scaffold: D1 (seed → approve canonical +
// portrait) and D2 (profile + stage/voice upload + first sprite batch that
// plays as it returns) are functional; D3–D7 are stubs. Generation goes through
// /__editor/creator/gen, which draws mock placeholders when no GEMINI key is set
// so the flow is walkable out of the box. See docs/CHARACTER_CREATOR.md.
import {
  CreatorModel, CREATOR_STEPS, makeDraft, BASE_CELLS, ATTACK_CELLS,
  CANONICAL_PROMPT, PORTRAIT_PROMPT, SPRITE_PROMPT,
  type CreatorJob, type AttackCell,
} from './creatorModel';
import { hitboxFromSkeleton, strikeKind } from './hitboxFromSkeleton';

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K, css = '', text = '',
): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (css) e.style.cssText = css;
  if (text) e.textContent = text;
  return e;
};

const dataUrlToB64 = (u?: string): string | undefined =>
  u && u.includes(',') ? u.split(',')[1] : undefined;

const readFile = (f: File): Promise<string> =>
  new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.readAsDataURL(f);
  });

const FONT = "font-family:'DejaVu Sans Mono',monospace;";
const BTN = FONT + 'cursor:pointer;border:1px solid #3f6070;background:#172230;color:#eaf6fb;' +
  'padding:6px 12px;font-size:13px;border-radius:4px;';
const BTN_HOT = FONT + 'cursor:pointer;border:1px solid #7fe3ff;background:#1d3444;color:#bff0ff;' +
  'padding:8px 16px;font-size:14px;font-weight:bold;border-radius:4px;';
const INPUT = FONT + 'background:#0c1520;color:#eaf6fb;border:1px solid #2b4457;border-radius:4px;' +
  'padding:6px 8px;font-size:13px;width:100%;box-sizing:border-box;';

export class CharacterCreatorPanel {
  private m = new CreatorModel();
  private root: HTMLDivElement;
  private previewCanvas: HTMLCanvasElement;
  private bodyEl: HTMLDivElement;
  private stepperEl: HTMLDivElement;
  private trayEl: HTMLDivElement;
  private previewControls!: HTMLDivElement;
  private previewCaption!: HTMLDivElement;
  private previewInspect!: HTMLDivElement;
  private backdrop!: HTMLDivElement;
  private lastBackdrop?: string;
  private leftEl!: HTMLDivElement;
  private leftW = 40; // preview column width %, drag-resizable
  private lastLeftW = 40;
  private regenPromptEl?: HTMLTextAreaElement; // editable copy of the selected cell's prompt
  /** what the big preview shows: an animated group (idle/walk/…) or one cell/asset */
  private preview: { kind: 'group' | 'cell'; key: string } = { kind: 'group', key: 'idle' };
  private anim = 0;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private lastSaveAt = 0;
  private logEl!: HTMLDivElement;
  private logLines: string[] = [];
  private onBack: () => void;

  constructor(mount: HTMLElement, onBack: () => void) {
    this.onBack = onBack;
    this.root = el('div',
      'position:absolute;inset:0;pointer-events:auto;display:flex;color:#eaf6fb;overflow:hidden;' + FONT +
      'background:#0a0d14;');
    mount.appendChild(this.root);

    // full-bleed scene backdrop (the generated stage) + a dim layer for legibility
    this.backdrop = el('div', 'position:absolute;inset:0;z-index:0;background-position:center bottom;background-size:cover;');
    this.backdrop.style.background = this.gridBg();
    const dim = el('div', 'position:absolute;inset:0;z-index:0;pointer-events:none;' +
      'background:linear-gradient(180deg,rgba(8,11,17,.5),rgba(8,11,17,.28) 55%,rgba(8,11,17,.78));');
    this.root.append(this.backdrop, dim);

    // left: the fighter standing IN the scene — transparent canvas over the backdrop,
    // feet on the ground line; controls float top, inspect floats bottom.
    const left = el('div', 'position:relative;z-index:1;display:flex;flex-direction:column;padding:8px;min-width:0;');
    left.style.width = this.leftW + '%';
    this.leftEl = left;
    this.previewControls = el('div', 'display:flex;flex-wrap:wrap;gap:4px;justify-content:center;');
    this.previewCaption = el('div', 'font-size:11px;color:#c8d6de;text-align:center;text-shadow:0 1px 3px #000;margin-top:2px;', 'live preview');
    this.previewCanvas = el('canvas', 'flex:1;width:100%;min-height:0;image-rendering:auto;'); // transparent, fills
    this.previewInspect = el('div', 'width:100%;'); // per-cell scale + regen (translucent)
    left.append(this.previewControls, this.previewCaption, this.previewCanvas, this.previewInspect);
    this.root.appendChild(left);

    // draggable divider between preview and dialog
    const divider = el('div', 'position:relative;z-index:1;flex:0 0 auto;width:8px;cursor:col-resize;background:rgba(18,26,36,.7);' +
      'display:flex;align-items:center;justify-content:center;');
    divider.appendChild(el('div', 'width:3px;height:46px;border-radius:2px;background:#33465a;'));
    divider.onmousedown = (e) => this.startResize(e);
    divider.ondblclick = () => this.toggleCollapse();
    divider.title = 'drag to resize · double-click to collapse';
    this.root.appendChild(divider);

    // right: stepper + body + tray (translucent so the scene shows behind it)
    const right = el('div', 'position:relative;z-index:1;flex:1;display:flex;flex-direction:column;min-width:0;background:rgba(9,13,20,.82);backdrop-filter:blur(2px);');
    this.stepperEl = el('div', 'display:flex;gap:4px;padding:12px 16px;border-bottom:1px solid #22303e;' +
      'flex-wrap:wrap;align-items:center;');
    this.bodyEl = el('div', 'flex:1;overflow:auto;padding:16px 20px;');
    // activity log: every gen start / done / error with timing (debug the "stuck wheel")
    this.logEl = el('div', "flex:0 0 auto;max-height:84px;overflow:auto;border-top:1px solid #22303e;" +
      "padding:5px 12px;font-family:monospace;font-size:10px;line-height:1.5;color:#8fa6b2;background:#080b11;white-space:pre-wrap;");
    this.trayEl = el('div', 'border-top:1px solid #22303e;padding:8px 12px;display:flex;gap:6px;' +
      'overflow-x:auto;min-height:64px;align-items:center;background:#0b1119;');
    right.appendChild(this.stepperEl);
    right.appendChild(this.bodyEl);
    right.appendChild(this.logEl);
    right.appendChild(this.trayEl);
    this.root.appendChild(right);
    this.logMsg('creator ready');

    this.renderStepper();
    this.render();
    this.renderPreviewControls();
    this.loop();
  }

  dispose(): void {
    cancelAnimationFrame(this.anim);
    clearTimeout(this.saveTimer);
    void this.save(); // flush a final save on unmount (HMR reload, scene exit)
    this.root.remove();
  }

  private logMsg(msg: string): void {
    const d = new Date();
    const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    this.logLines.push(`${t}  ${msg}`);
    if (this.logLines.length > 300) this.logLines.shift();
    if (this.logEl) { this.logEl.textContent = this.logLines.slice(-80).join('\n'); this.logEl.scrollTop = this.logEl.scrollHeight; }
  }

  private gridBg(): string {
    return "#0e141d url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M24 0H0V24' fill='none' stroke='%23182634' stroke-width='1'/%3E%3C/svg%3E\")";
  }

  // ── stepper ────────────────────────────────────────────────────────────
  private renderStepper(): void {
    this.stepperEl.replaceChildren();
    const back = el('button', BTN + 'padding:4px 10px;font-size:12px;', '‹ EXIT');
    back.onclick = () => this.onBack();
    this.stepperEl.appendChild(back);
    const col = el('button', BTN + 'padding:4px 8px;font-size:12px;', '◧');
    col.title = 'collapse / expand the preview stage';
    col.onclick = () => this.toggleCollapse();
    this.stepperEl.appendChild(col);
    const zip = el('button', BTN + 'padding:4px 8px;font-size:12px;', '⤓ ZIP');
    zip.title = 'download a .zip of the current build + progress (playable out of the box)';
    zip.onclick = () => void this.exportZip();
    this.stepperEl.appendChild(zip);
    CREATOR_STEPS.forEach((s, i) => {
      const done = i < this.m.step;
      const on = i === this.m.step;
      const chip = el('div',
        'padding:4px 10px;border-radius:12px;font-size:11px;letter-spacing:.5px;' +
        `border:1px solid ${on ? '#7fe3ff' : done ? '#3f6070' : '#22303e'};` +
        `color:${on ? '#bff0ff' : done ? '#8fd6a0' : '#5c6b78'};` +
        `background:${on ? '#12232e' : 'transparent'};`,
        `${done ? '✓ ' : ''}${i + 1}·${s}`);
      this.stepperEl.appendChild(chip);
    });
  }

  private goto(step: number): void {
    this.m.step = Math.max(0, Math.min(CREATOR_STEPS.length - 1, step));
    this.renderStepper();
    this.render();
  }

  // ── live save / resume ────────────────────────────────────────────────────
  /** everything needed to rebuild the run, minus image bytes (those are files). */
  private serializeState(): Record<string, unknown> {
    return {
      version: 1, step: this.m.step, inputs: this.m.inputs, draft: this.m.draft,
      generatedVo: this.m.generatedVo, generatedMusic: this.m.generatedMusic, generatedFatality: this.m.generatedFatality,
      skeletons: this.m.skeletons, autoHitboxes: this.m.autoHitboxes, voiceModelId: this.m.voiceModelId,
      jobs: [...this.m.jobs.values()].map((j) => ({
        key: j.key, kind: j.kind, label: j.label, status: j.status, prompt: j.prompt,
        mock: j.mock, approved: j.approved, scale: j.scale, mime: j.dataUrl?.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png', savedAs: j.savedAs,
      })),
    };
  }

  private scheduleSave(): void {
    if (!this.m.inputs.name.trim()) return; // no id yet
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.save(), 1200);
  }

  private async save(): Promise<void> {
    if (!this.m.inputs.name.trim()) return;
    try {
      await fetch('/__editor/creator/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: this.m.id, state: this.serializeState() }),
      });
    } catch { /* non-fatal */ }
  }

  private async loadDraft(id: string): Promise<void> {
    try {
      const r = await fetch('/__editor/creator/state', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      });
      const j = (await r.json()) as { ok?: boolean; state?: Record<string, unknown>; images?: Record<string, string>; error?: string };
      if (!j.ok || !j.state) throw new Error(j.error ?? 'load failed');
      const s = j.state as {
        step?: number; inputs?: CreatorModel['inputs']; draft?: CreatorModel['draft'];
        generatedVo?: Record<string, string>; generatedMusic?: string; generatedFatality?: string[];
        skeletons?: CreatorModel['skeletons']; autoHitboxes?: CreatorModel['autoHitboxes']; voiceModelId?: string;
        jobs?: { key: string; kind: string; label: string; status: CreatorJob['status']; prompt?: string; mock?: boolean; approved?: boolean; scale?: number; mime?: string; savedAs?: string }[];
      };
      this.m.inputs = (s.inputs ?? { name: '', description: '' });
      this.m.draft = (s.draft ?? null);
      this.m.step = s.step ?? 0;
      this.m.generatedVo = (s.generatedVo ?? {});
      this.m.generatedMusic = s.generatedMusic;
      this.m.generatedFatality = (s.generatedFatality ?? []);
      this.m.skeletons = (s.skeletons ?? {});
      this.m.autoHitboxes = (s.autoHitboxes ?? {});
      this.m.voiceModelId = s.voiceModelId;
      this.m.jobs = new Map();
      for (const jb of s.jobs ?? []) {
        const img = j.images?.[jb.key];
        this.m.jobs.set(jb.key, { key: jb.key, kind: jb.kind, label: jb.label, status: jb.status, prompt: jb.prompt, mock: jb.mock, approved: jb.approved, scale: jb.scale, savedAs: jb.savedAs, dataUrl: img ? `data:${jb.mime ?? 'image/png'};base64,${img}` : undefined });
      }
      this.renderStepper(); this.render(); this.renderPreviewControls(); this.renderTray(); this.redrawPreview();
    } catch (e) { console.error(e); alert('Could not load draft: ' + String(e)); }
  }

  private startResize(e: MouseEvent): void {
    e.preventDefault();
    const rect = this.root.getBoundingClientRect();
    const move = (ev: MouseEvent): void => {
      this.leftW = Math.max(0, Math.min(72, ((ev.clientX - rect.left) / rect.width) * 100));
      this.leftEl.style.width = this.leftW + '%';
    };
    const up = (): void => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }

  private toggleCollapse(): void {
    if (this.leftW > 3) { this.lastLeftW = this.leftW; this.leftW = 0; }
    else { this.leftW = this.lastLeftW || 40; }
    this.leftEl.style.width = this.leftW + '%';
  }

  // ── body router ──────────────────────────────────────────────────────────
  private render(): void {
    this.scheduleSave(); // debounced live-save on every state-changing render
    this.bodyEl.replaceChildren();
    switch (CREATOR_STEPS[this.m.step]) {
      case 'SEED': return this.renderSeed();
      case 'PROFILE': return this.renderProfile();
      case 'SPRITES': return this.renderSprites();
      case 'RIG': return this.renderRig();
      case 'POLISH': return this.renderPolish();
      case 'SHIP': return this.renderShip();
      default: return this.renderStub();
    }
  }

  private h(txt: string, sub = ''): void {
    this.bodyEl.appendChild(el('div', 'font-size:20px;font-weight:bold;color:#bff0ff;margin-bottom:2px;', txt));
    if (sub) this.bodyEl.appendChild(el('div', 'font-size:12px;color:#8fa6b2;margin-bottom:14px;', sub));
  }

  private field(label: string): HTMLDivElement {
    const w = el('div', 'margin-bottom:12px;');
    w.appendChild(el('div', 'font-size:11px;color:#9fb4be;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px;', label));
    return w;
  }

  /** drag-and-drop upload zone — click OR drop; `multiple` accepts a batch.
   *  Backed by a model array (`items`, mutated in place) so each file is
   *  individually removable and the list survives a panel re-render. `onChange`
   *  fires after any add/remove. */
  private dropZone(
    label: string,
    opts: { accept: string; multiple?: boolean; hint?: string },
    items: { dataUrl: string; name: string }[],
    onChange?: () => void,
  ): HTMLDivElement {
    const w = this.field(label);
    const zone = el('div', 'border:1.5px dashed #2b4457;border-radius:6px;padding:14px 12px;text-align:center;' +
      'cursor:pointer;transition:border-color .12s,background .12s;background:#0c1520;');
    const hint = el('div', 'font-size:12px;color:#7d94a0;',
      opts.hint ?? (opts.multiple ? '⤓ drag files here or click — multiple OK' : '⤓ drag a file here or click'));
    const list = el('div', 'margin-top:6px;');
    const inp = el('input', 'display:none;') as HTMLInputElement;
    inp.type = 'file'; inp.accept = opts.accept; if (opts.multiple) inp.multiple = true;
    const idle = (): void => { zone.style.borderColor = '#2b4457'; zone.style.background = '#0c1520'; };
    const hot = (): void => { zone.style.borderColor = '#7fe3ff'; zone.style.background = '#12232e'; };
    const renderList = (): void => {
      list.replaceChildren();
      items.forEach((it, i) => {
        const row = el('div', 'display:flex;align-items:center;justify-content:center;gap:6px;font-size:11px;color:#8fd6a0;margin-top:4px;');
        const x = el('button', BTN + 'padding:0 7px;font-size:12px;line-height:1.5;', '✕');
        x.title = 'remove'; x.onclick = (e) => { e.stopPropagation(); items.splice(i, 1); renderList(); onChange?.(); };
        row.append(el('span', 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;', '✓ ' + it.name), x);
        list.appendChild(row);
      });
    };
    const handle = async (files: FileList | File[]): Promise<void> => {
      const arr = Array.from(files); if (!arr.length) return;
      const picks = await Promise.all(arr.map(async (f) => ({ dataUrl: await readFile(f), name: f.name })));
      if (opts.multiple) items.push(...picks); else { items.length = 0; items.push(picks[0]); }
      renderList(); onChange?.();
    };
    zone.onclick = () => inp.click();
    inp.onchange = () => { if (inp.files) void handle(inp.files); inp.value = ''; };
    zone.ondragover = (e) => { e.preventDefault(); hot(); };
    zone.ondragenter = (e) => { e.preventDefault(); hot(); };
    zone.ondragleave = idle;
    zone.ondrop = (e) => { e.preventDefault(); idle(); if (e.dataTransfer?.files) void handle(e.dataTransfer.files); };
    zone.append(hint, list, inp);
    renderList(); // show any items already in the model (survives re-render)
    w.appendChild(zone);
    return w;
  }

  // ── D1 · SEED ──────────────────────────────────────────────────────────
  private renderSeed(): void {
    this.h('Seed your fighter', 'Name + one-line description + a full-body photo. We generate the canonical + portrait; approve, then move on.');
    this.renderResumeBar();

    const nameW = this.field('Name');
    const nameI = el('input', INPUT) as HTMLInputElement;
    nameI.value = this.m.inputs.name; nameI.placeholder = 'e.g. Mirage';
    nameI.oninput = () => { this.m.inputs.name = nameI.value; slug.textContent = 'id: ' + this.m.id; };
    const slug = el('div', 'font-size:11px;color:#7d94a0;margin-top:3px;', 'id: ' + this.m.id);
    nameW.append(nameI, slug);
    this.bodyEl.appendChild(nameW);

    const descW = this.field('One-line description');
    const descI = el('textarea', INPUT + 'height:52px;resize:vertical;') as HTMLTextAreaElement;
    descI.value = this.m.inputs.description;
    descI.placeholder = 'a heat-shimmer desert illusionist who fights with sand and mirror-doubles';
    descI.oninput = () => (this.m.inputs.description = descI.value);
    descW.appendChild(descI);
    this.bodyEl.appendChild(descW);

    this.m.inputs.referencePhotos ??= [];
    this.bodyEl.appendChild(this.dropZone('Reference photo(s) — full-body first, face/others optional',
      { accept: 'image/*', multiple: true, hint: '⤓ drag photo(s) or click — first is the full body, add a face close-up too' },
      this.m.inputs.referencePhotos, () => this.redrawPreview()));

    const begin = el('button', BTN_HOT + 'margin-top:8px;', 'Begin ▸  generate canonical + portrait');
    begin.onclick = () => this.beginSeed();
    this.bodyEl.appendChild(begin);

    // gate: once canonical is approved, allow continue
    const canon = this.m.job('canonical');
    if (canon) {
      const gate = el('div', 'margin-top:18px;padding:14px;border:1px solid #22303e;border-radius:6px;background:#0b1119;');
      gate.appendChild(el('div', 'font-size:12px;color:#9fb4be;margin-bottom:8px;', 'APPROVE TO CONTINUE'));
      gate.appendChild(this.approvalRow('canonical', 'Canonical'));
      gate.appendChild(this.approvalRow('portrait', 'Portrait'));
      const cont = el('button', canon.approved ? BTN_HOT : BTN + 'opacity:.5;pointer-events:none;', 'Continue to Profile ▸');
      cont.style.marginTop = '10px';
      cont.onclick = () => { if (this.m.job('canonical')?.approved) { this.ensureDraft(); this.goto(1); } };
      gate.appendChild(cont);
      this.bodyEl.appendChild(gate);
    }
  }

  /** SEED-only: list saved drafts (auto-saved runs) and let the user resume one. */
  private renderResumeBar(): void {
    const bar = el('div', 'margin-bottom:14px;padding:10px 12px;border:1px solid #22303e;border-radius:6px;background:#0b1119;');
    bar.appendChild(el('div', 'font-size:11px;color:#9fb4be;margin-bottom:6px;', 'RESUME A SAVED DRAFT (auto-saved as you go)'));
    const row = el('div', 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;');
    const status = el('span', 'font-size:11px;color:#7d94a0;', 'loading…');
    row.appendChild(status);
    bar.appendChild(row);
    this.bodyEl.appendChild(bar);
    void fetch('/__editor/creator/list', { method: 'POST' }).then(async (r) => {
      const j = (await r.json()) as { drafts?: { id: string; name: string; step: number }[] };
      row.replaceChildren();
      const drafts = j.drafts ?? [];
      if (!drafts.length) { row.appendChild(el('span', 'font-size:11px;color:#5c6b78;', 'no saved drafts yet — start below')); return; }
      for (const d of drafts) {
        const b = el('button', BTN + 'padding:3px 9px;font-size:11px;', `▸ ${d.name} · ${CREATOR_STEPS[d.step] ?? 'SEED'}`);
        b.onclick = () => void this.loadDraft(d.id);
        row.appendChild(b);
      }
    }).catch(() => { status.textContent = 'could not list drafts'; });
  }

  private approvalRow(key: string, label: string): HTMLDivElement {
    const j = this.m.job(key);
    const row = el('div', 'display:flex;align-items:center;gap:10px;margin:6px 0;');
    row.appendChild(el('div', 'width:90px;font-size:12px;color:#eaf6fb;', label));
    const status = el('div', 'flex:1;font-size:12px;color:#8fa6b2;',
      !j ? '—' : j.status === 'running' ? '◐ generating…' : j.status === 'error' ? '✕ ' + (j.error ?? 'error') :
      j.approved ? '✓ approved' : j.mock ? '● placeholder (no API key) — approve or reroll' : '● ready — approve or reroll');
    row.appendChild(status);
    if (j && j.status === 'done') {
      const ap = el('button', BTN + 'padding:3px 8px;font-size:11px;', j.approved ? '✓' : 'Approve');
      ap.onclick = () => { j.approved = true; this.render(); };
      const rr = el('button', BTN + 'padding:3px 8px;font-size:11px;', '↻ Reroll');
      rr.onclick = () => this.reroll(key);
      row.append(ap, rr);
    }
    return row;
  }

  private beginSeed(): void {
    if (!this.m.inputs.name.trim()) { alert('Give your fighter a name first.'); return; }
    this.ensureDraft();
    const desc = this.m.inputs.description || this.m.inputs.name;
    const refs = (this.m.inputs.referencePhotos ?? []).map((p) => dataUrlToB64(p.dataUrl)).filter(Boolean) as string[];
    // portrait wants the FACE ref first (2nd photo per the D1 hint); fall back to whatever's provided
    const portraitRefs = refs.length > 1 ? [refs[1], ...refs.filter((_, i) => i !== 1)] : refs;
    this.fireGen('canonical', 'canonical', 'Canonical', CANONICAL_PROMPT(desc), refs);
    this.fireGen('portrait', 'portrait', 'Portrait', PORTRAIT_PROMPT(this.m.inputs.name, desc), portraitRefs);
    this.render();
  }

  private ensureDraft(): void {
    if (!this.m.draft) this.m.draft = makeDraft(this.m.inputs.name, this.m.inputs.description);
  }

  // ── D2 · PROFILE ─────────────────────────────────────────────────────────
  private renderProfile(): void {
    this.ensureDraft();
    const d = this.m.draft!;
    this.h('Profile & stage', 'Edit the auto-draft while the base sprites bake below. Upload a stage + voice sample.');

    const two = el('div', 'display:flex;gap:20px;flex-wrap:wrap;');
    const colA = el('div', 'flex:1;min-width:240px;');
    const colB = el('div', 'flex:1;min-width:240px;');
    two.append(colA, colB);
    this.bodyEl.appendChild(two);

    // col A — identity
    const arch = this.field('Archetype · color');
    const ai = el('input', INPUT) as HTMLInputElement; ai.value = d.archetype;
    ai.oninput = () => (d.archetype = ai.value);
    const sw = el('span', `display:inline-block;width:16px;height:16px;border-radius:3px;margin-left:8px;vertical-align:middle;background:${d.color};`);
    arch.append(ai, sw); colA.appendChild(arch);

    const pers = this.field('Personality');
    const pi = el('textarea', INPUT + 'height:44px;') as HTMLTextAreaElement; pi.value = d.lore.personality;
    pi.oninput = () => (d.lore.personality = pi.value); pers.appendChild(pi); colA.appendChild(pers);

    const back = this.field('Backstory (arcade)');
    const bi = el('textarea', INPUT + 'height:60px;') as HTMLTextAreaElement; bi.value = d.lore.backstory;
    bi.oninput = () => (d.lore.backstory = bi.value); back.appendChild(bi); colA.appendChild(back);

    colA.appendChild(this.lockGrid('Victory quotes (win-screen text)', d.winQuotes));
    // announcer name call-out (Maverick — same announcer voice as the roster)
    const ann = this.field('Announcer VO (says the name — Maverick)');
    const annRow = el('div', 'display:flex;gap:5px;align-items:center;');
    annRow.append(el('div', INPUT + 'font-size:12px;flex:1;color:#8fa6b2;', this.m.inputs.name.toUpperCase() || '(name)'),
      this.playBtn('announcer'), this.regenClipBtn('announcer', () => this.m.inputs.name));
    ann.appendChild(annRow); colA.appendChild(ann);
    colA.appendChild(this.voEditor('Kiai', d.vo.kiai, 'kiai'));
    colA.appendChild(this.voEditor('Hurt', d.vo.hurt, 'hurt'));
    colA.appendChild(this.voEditor('Victory', d.vo.victory, 'victory'));

    // col B — stage + BYO audio + sprite batch (all model-backed + removable)
    this.m.inputs.stagePhotos ??= []; this.m.inputs.voiceSamples ??= [];
    this.m.inputs.kiaiClips ??= []; this.m.inputs.musicTracks ??= [];
    colB.appendChild(this.dropZone('Stage landscape (optional)', { accept: 'image/*' }, this.m.inputs.stagePhotos,
      () => {
        const u = this.m.inputs.stagePhotos?.[0]?.dataUrl;
        if (u && this.m.job('stage')?.status !== 'running') this.fireGen('stage', 'stage', 'Stage', d.stagePrompt, [dataUrlToB64(u)!].filter(Boolean));
        this.renderTray();
      }));
    colB.appendChild(this.dropZone('Voice samples for cloning (optional, multiple)', { accept: 'audio/*', multiple: true }, this.m.inputs.voiceSamples));
    if ((this.m.inputs.voiceSamples ?? []).length) {
      const cloneBtn = el('button', BTN + 'font-size:11px;margin:-6px 0 12px;',
        this.m.cloneStatus === 'running' ? '◐ cloning…' : this.m.voiceModelId ? '✓ voice cloned — VO will use it' : '▸ Clone voice from samples');
      cloneBtn.onclick = () => this.cloneVoice();
      colB.appendChild(cloneBtn);
    }
    colB.appendChild(this.dropZone('BYO kiai / hurt / victory clips (optional, multiple)', { accept: 'audio/*', multiple: true }, this.m.inputs.kiaiClips));
    colB.appendChild(this.dropZone('BYO stage music track(s) (optional, multiple)', { accept: 'audio/*', multiple: true }, this.m.inputs.musicTracks));

    const batchW = this.field('Base sprite batch (idle · walk · jump · crouch · block · fall · down)');
    const runBatch = el('button', BTN_HOT + 'font-size:12px;', '▸ Generate base sprites');
    runBatch.onclick = () => this.runBaseBatch();
    batchW.appendChild(runBatch);
    const anyBase = BASE_CELLS.some((c) => this.m.job('sprite:' + c.id));
    if (anyBase) batchW.appendChild(el('div', 'font-size:11px;color:#8fa6b2;margin-top:6px;', 'watch them animate in below — idle+walk auto-play when ready'));
    colB.appendChild(batchW);

    // Audio + music generation (real — ElevenLabs)
    const audio = this.field('Audio & music');
    const voBtn = el('button', BTN_HOT + 'font-size:12px;margin-right:6px;',
      this.m.voStatus === 'running' ? '◐ synthesizing VO…' : this.m.voStatus === 'done' ? '✓ VO ready — regenerate' : '▸ Generate VO (announcer + kiai/hurt/victory)');
    voBtn.onclick = () => this.genVo();
    const musicBtn = el('button', BTN_HOT + 'font-size:12px;',
      this.m.musicStatus === 'running' ? '◐ composing music…' : this.m.musicStatus === 'done' ? '✓ music ready — regenerate' : '▸ Generate stage music');
    musicBtn.onclick = () => this.genMusic();
    audio.append(voBtn, musicBtn);
    const voReady = Object.keys(this.m.finalVoClips()).length;
    if (voReady) audio.appendChild(el('div', 'font-size:11px;color:#8fa6b2;margin-top:6px;', `${voReady}/17 VO clips ready — play/regen each line on the left`));
    const mus = this.m.finalMusic();
    if (mus) {
      const mp = el('button', BTN + 'padding:2px 7px;font-size:10px;margin-top:6px;', '▶ stage theme');
      mp.onclick = () => { new Audio('data:audio/mp3;base64,' + mus).play().catch(() => {}); };
      audio.appendChild(mp);
    }
    if (this.m.voStatus === 'error' || this.m.musicStatus === 'error')
      audio.appendChild(el('div', 'font-size:11px;color:#e08a8a;margin-top:6px;', 'audio/music gen error — see console'));
    colB.appendChild(audio);

    const nav = el('div', 'margin-top:18px;display:flex;gap:10px;');
    const bk = el('button', BTN, '‹ Back');
    bk.onclick = () => this.goto(0);
    const nx = el('button', BTN_HOT, 'Continue to Sprites ▸');
    nx.onclick = () => this.goto(2);
    nav.append(bk, nx); this.bodyEl.appendChild(nav);

    // auto-fire the base batch on entering profile if canonical is ready (tight pipelining)
    if (!anyBase && this.m.job('canonical')?.status === 'done') this.runBaseBatch();
  }

  /** VO line editor: per line = text + ▶ play (its clip) + ↻ regen (re-synth). */
  private voEditor(label: string, lines: string[], prefix: 'kiai' | 'hurt' | 'victory'): HTMLDivElement {
    const w = this.field(label + ' VO');
    lines.forEach((val, i) => {
      const clip = `${prefix}-${i + 1}`;
      const row = el('div', 'display:flex;gap:5px;margin-bottom:4px;align-items:center;');
      const inp = el('input', INPUT + 'font-size:12px;') as HTMLInputElement;
      inp.value = val; inp.oninput = () => (lines[i] = inp.value);
      row.append(inp, this.playBtn(clip), this.regenClipBtn(clip, () => lines[i]));
      w.appendChild(row);
    });
    return w;
  }

  private playBtn(clip: string): HTMLButtonElement {
    const has = !!this.m.finalVoClips()[clip];
    const b = el('button', BTN + `padding:4px 8px;font-size:11px;${has ? '' : 'opacity:.4;'}`, '▶');
    b.title = has ? 'play ' + clip : 'generate this line first';
    b.onclick = () => { const a = this.m.finalVoClips()[clip]; if (a) new Audio('data:audio/mp3;base64,' + a).play().catch(() => {}); };
    return b;
  }

  private regenClipBtn(clip: string, text: () => string): HTMLButtonElement {
    const b = el('button', BTN + 'padding:4px 8px;font-size:11px;', '↻');
    b.title = 're-synth ' + clip + ' (ElevenLabs / clone)';
    b.onclick = () => void this.regenClip(clip, text());
    return b;
  }

  private async regenClip(clip: string, text: string): Promise<void> {
    this.logMsg(`▸ VO ${clip}…`);
    try {
      const r = await fetch('/__editor/creator/audio-clip', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip, text, name: this.m.inputs.name, fishModelId: this.m.voiceModelId }),
      });
      const j = (await r.json()) as { ok?: boolean; mock?: boolean; base64?: string; error?: string };
      if (!j.ok) throw new Error(j.error ?? 'failed');
      if (j.base64) { this.m.generatedVo[clip] = j.base64; this.logMsg(`✓ VO ${clip}`); }
      else if (j.mock) this.logMsg(`VO ${clip} mock (no ELEVENLABS_API_KEY)`);
    } catch (e) { this.logMsg(`✕ VO ${clip} — ${String(e)}`); }
    this.render();
  }

  private lockGrid(label: string, items: string[]): HTMLDivElement {
    const w = this.field(label);
    items.forEach((val, i) => {
      const row = el('div', 'display:flex;gap:6px;margin-bottom:4px;');
      const inp = el('input', INPUT + 'font-size:12px;') as HTMLInputElement;
      inp.value = val; inp.oninput = () => (items[i] = inp.value);
      const rr = el('button', BTN + 'padding:4px 8px;font-size:11px;', '↻');
      rr.title = 'reroll (pool draw — no LLM call)';
      rr.onclick = () => { items[i] = this.poolLine(label); inp.value = items[i]; };
      row.append(inp, rr); w.appendChild(row);
    });
    return w;
  }

  private poolLine(label: string): string {
    const pools: Record<string, string[]> = {
      'Victory quotes': ['You never had a chance.', 'The sand remembers.', 'Try again, tourist.', 'I warned you.'],
      Kiai: ['Yah!', 'Hup!', 'Raaah!', 'Go!'],
      Hurt: ['Oof!', 'Argh!', 'Hnng!', 'Damn!'],
    };
    const p = pools[label] ?? ['…'];
    return p[Math.floor(Date.now() / 137) % p.length];
  }

  // ── D3 · SPRITES (attack art) ─────────────────────────────────────────────
  private renderSprites(): void {
    this.ensureDraft();
    this.h('Attack sprites', 'Distinct startup/active/recovery frames per normal + special (jump moves ref the jump image, crouch the crouch image, standing/specials the canonical). Click any tray cell to inspect/scale/regen.');
    const cells = this.m.allAttackCells();
    const total = cells.length;
    const done = cells.filter((c) => this.m.job('sprite:' + c.name)?.status === 'done').length;
    const run = el('button', BTN_HOT + 'font-size:13px;', done ? `↻ Continue attack frames (${done}/${total})` : `▸ Generate attack frames (${total} cells, 5 at a time)`);
    run.onclick = () => this.genAttacks();
    this.bodyEl.appendChild(run);
    this.bodyEl.appendChild(el('div', 'font-size:11px;color:#8fa6b2;margin-top:8px;',
      done ? `${done}/${total} frames generated. Cells not generated fall back to the idle pose in-game.` : 'not generated yet — attacks reuse the idle pose until you generate them.'));
    const nav = el('div', 'margin-top:16px;display:flex;gap:10px;');
    const bk = el('button', BTN, '‹ Back'); bk.onclick = () => this.goto(this.m.step - 1);
    const nx = el('button', BTN_HOT, 'Next ▸'); nx.onclick = () => this.goto(this.m.step + 1);
    nav.append(bk, nx); this.bodyEl.appendChild(nav);
  }

  // ── D6 · RIG (local skeleton + auto-hitboxes) ─────────────────────────────
  private renderRig(): void {
    this.ensureDraft();
    this.h('Rig — skeleton & hitboxes', 'Run LOCAL DWPose over every generated cell (fal is ship-only), then auto-fit each attack hitbox from the skeleton. Baked into meta.skeletons + move data on SHIP.');
    const cellsReady = this.m.sheetPlan().length;
    const skel = Object.keys(this.m.skeletons).length;
    const hb = Object.keys(this.m.autoHitboxes).length;
    const runBtn = el('button', BTN_HOT + 'font-size:13px;margin-right:6px;',
      this.m.rigStatus === 'running' ? '◐ running DWPose…' : skel ? `↻ Re-run skeleton (${skel} cells)` : '▸ Run skeleton (local DWPose)');
    runBtn.onclick = () => this.runSkeleton();
    this.bodyEl.appendChild(runBtn);
    const hbBtn = el('button', (skel ? BTN_HOT : BTN + 'opacity:.5;pointer-events:none;') + 'font-size:13px;', hb ? `↻ Re-fit hitboxes (${hb})` : '▸ Auto-hitboxes from skeleton');
    hbBtn.onclick = () => this.autoHitboxesFromSkeleton();
    this.bodyEl.appendChild(hbBtn);
    this.bodyEl.appendChild(el('div', 'font-size:11px;color:#8fa6b2;margin-top:8px;',
      `${cellsReady} cells · ${skel} skeletons · ${hb} auto-hitboxes. Un-fit moves keep the heuristic default box; fine-tune later in the Sprite Editor.`));
    if (this.m.rigStatus === 'error') this.bodyEl.appendChild(el('div', 'font-size:11px;color:#e08a8a;margin-top:6px;', 'skeleton error — is the QA Python env available (rtmlib)? See console. (fal replaces this only at ship time.)'));
    const nav = el('div', 'margin-top:16px;display:flex;gap:10px;');
    const bk = el('button', BTN, '‹ Back'); bk.onclick = () => this.goto(this.m.step - 1);
    const nx = el('button', BTN_HOT, 'Next ▸'); nx.onclick = () => this.goto(this.m.step + 1);
    nav.append(bk, nx); this.bodyEl.appendChild(nav);
  }

  // ── D7 · POLISH (fatality + review) ───────────────────────────────────────
  private renderPolish(): void {
    this.ensureDraft();
    this.h('Polish', 'Generate the fatality cutscene and review the finishing assets.');
    const fatW = this.field('Fatality — ' + this.m.draft!.fatality.name + ' (' + this.m.draft!.fatality.input + ')');
    const fatBtn = el('button', BTN_HOT + 'font-size:12px;',
      this.m.fatalityStatus === 'running' ? '◐ generating panels…' : this.m.fatalityStatus === 'done' ? '✓ 4 panels ready — regenerate' : '▸ Generate fatality (4 panels)');
    fatBtn.onclick = () => this.genFatality();
    fatW.appendChild(fatBtn);
    if (this.m.generatedFatality.length) {
      const strip = el('div', 'display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;');
      this.m.generatedFatality.forEach((p, i) => {
        const im = el('img', 'width:120px;height:68px;object-fit:cover;border:1px solid #22303e;border-radius:4px;') as HTMLImageElement;
        im.src = 'data:image/jpeg;base64,' + p; im.title = 'panel ' + (i + 1);
        strip.appendChild(im);
      });
      fatW.appendChild(strip);
    }
    this.bodyEl.appendChild(fatW);
    this.bodyEl.appendChild(el('div', 'font-size:11px;color:#8fa6b2;margin-bottom:12px;',
      'Portraits, VO and stage music were generated earlier (Seed/Profile) — review them there. Un-generated fatality = no FINISH THEM (degrades gracefully).'));
    const nav = el('div', 'display:flex;gap:10px;');
    const bk = el('button', BTN, '‹ Back'); bk.onclick = () => this.goto(this.m.step - 1);
    const nx = el('button', BTN_HOT, 'Next ▸'); nx.onclick = () => this.goto(this.m.step + 1);
    nav.append(bk, nx); this.bodyEl.appendChild(nav);
  }

  // ── stubs ────────────────────────────────────────────────────────────────
  private renderStub(): void {
    const s = CREATOR_STEPS[this.m.step];
    const notes: Record<string, string> = {
      SPRITES: 'Jump normals (ref = jump image), crouch normals (ref = crouch), standing normals (ref = canonical). Live preview + per-move timing + single-cell reroll.',
      SPECIALS: '4-slot table: name · controls dropdown · description · Reroll (pool) · Generate. Cook in parallel; projectile-first chains; click a row to watch the move.',
      RIG: 'fal DWPose skeleton + auto-hitboxes across every cell; review/edit boxes and timing.',
      POLISH: 'Review background-baked portraits / KO / fatality panels / audio; approve or reroll.',
      SHIP: 'Final floor-normalize → write <id>.json + meta.json + sheet.png → register → audit → PLAY NOW / PUBLISH.',
    };
    this.h(s + ' — scaffolded', notes[s] ?? '');
    this.bodyEl.appendChild(el('pre', FONT + 'font-size:11px;color:#8fa6b2;background:#0b1119;border:1px solid #22303e;' +
      'border-radius:6px;padding:12px;white-space:pre-wrap;', JSON.stringify(this.m.buildJson(), null, 2)));
    const nav = el('div', 'margin-top:16px;display:flex;gap:10px;');
    const bk = el('button', BTN, '‹ Back'); bk.onclick = () => this.goto(this.m.step - 1);
    nav.appendChild(bk);
    if (this.m.step < CREATOR_STEPS.length - 1) {
      const nx = el('button', BTN_HOT, 'Next ▸'); nx.onclick = () => this.goto(this.m.step + 1); nav.appendChild(nx);
    }
    this.bodyEl.appendChild(nav);
  }

  // ── D8 · SHIP ─────────────────────────────────────────────────────────
  private renderShip(): void {
    this.h('Ship it', 'Composite the base cells into a sheet, write the character + register it, then reload and pick it on the select screen.');
    const cells = this.m.baseCellNames();
    const atk = this.m.allAttackCells();
    const attackDone = atk.filter((c) => this.m.job('sprite:' + c.name)?.status === 'done').length;
    const skel = Object.keys(this.m.skeletons).length, hb = Object.keys(this.m.autoHitboxes).length;
    this.bodyEl.appendChild(el('div', 'font-size:12px;color:#8fa6b2;margin-bottom:8px;',
      `sprites: ${cells.length} base + ${attackDone}/${atk.length} attack frames (${this.m.sheetPlan().length} sheet cells) · rig: ${skel} skeletons, ${hb} auto-hitboxes${cells.length ? '' : ' — generate the base batch on Profile first'}`));
    const fatReady = this.m.generatedFatality.length;
    const stageReady = this.m.job('stage')?.status === 'done';
    this.bodyEl.appendChild(el('div', 'font-size:12px;color:#8fa6b2;margin-bottom:8px;',
      `fatality: ${fatReady ? fatReady + ' panels' : 'none (omitted)'} · stage: ${stageReady ? 'generated → registered as ' + this.m.id + '-home' : 'none (uses default)'} · voice: ${this.m.voiceModelId ? 'cloned' : 'stock'}`));
    const voCount = Object.keys(this.m.finalVoClips()).length;
    const musicReady = !!this.m.finalMusic();
    this.bodyEl.appendChild(el('div', 'font-size:12px;color:#8fa6b2;margin-bottom:8px;',
      `audio: ${voCount}/17 VO clips ${voCount ? 'ready' : '— generate VO on Profile (else silent placeholders)'} · music: ${musicReady ? 'ready' : 'none (falls back to default)'}`));
    this.bodyEl.appendChild(el('pre', FONT + 'font-size:10px;color:#8fa6b2;background:#0b1119;border:1px solid #22303e;' +
      'border-radius:6px;padding:10px;white-space:pre-wrap;max-height:220px;overflow:auto;', JSON.stringify(this.m.buildFullCharacter(), null, 2)));
    const status = el('div', 'font-size:12px;color:#bff0ff;margin:10px 0;');
    const write = el('button', cells.length ? BTN_HOT : BTN + 'opacity:.5;pointer-events:none;', '⤓ WRITE + REGISTER fighter');
    write.onclick = async () => {
      status.textContent = 'compositing sheet…';
      const payload = await this.buildPayload();
      if (!payload.sheetBase64) { status.textContent = '✕ no base cells to pack'; return; }
      status.textContent = 'writing to disk…';
      try {
        const r = await fetch('/__editor/creator/write', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        const j = (await r.json()) as { ok?: boolean; error?: string };
        status.textContent = j.ok
          ? `✓ wrote ${this.m.id} — registered as playable. The page will reload; pick ${this.m.inputs.name.toUpperCase()} on the SELECT screen.`
          : '✕ ' + (j.error ?? 'write failed');
        this.logMsg(j.ok ? `✓ wrote + registered ${this.m.id}` : `✕ write — ${j.error}`);
      } catch (e) { status.textContent = '✕ ' + String(e); }
    };
    const exportBtn = el('button', BTN_HOT, '⤓ Download .zip');
    exportBtn.title = 'playable bundle + raw progress';
    exportBtn.onclick = () => void this.exportZip();
    const nav = el('div', 'margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;');
    const bk = el('button', BTN, '‹ Back'); bk.onclick = () => this.goto(this.m.step - 1);
    nav.append(bk, write, exportBtn);
    this.bodyEl.append(status, nav);
  }

  private loadImg(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve) => { const i = new Image(); i.onload = () => resolve(i); i.src = url; });
  }

  private async composeSheet(): Promise<{ sheetBase64: string; meta: object } | null> {
    const plan = this.m.sheetPlan(); // { name, jobKey } for base + attack-phase + special cells
    if (!plan.length) return null;
    const cw = 288, ch = 384, cols = 6, rows = Math.ceil(plan.length / cols);
    const c = document.createElement('canvas'); c.width = cols * cw; c.height = rows * ch;
    const ctx = c.getContext('2d')!;
    for (let i = 0; i < plan.length; i++) {
      const job = this.m.job(plan[i].jobKey); const url = job?.dataUrl; if (!url) continue;
      const img = await this.loadImg(url);
      const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
      const s = job?.scale ?? 1;
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, cw, ch); ctx.clip();
      if (s === 1) ctx.drawImage(img, x, y, cw, ch);
      else ctx.drawImage(img, x + (cw - cw * s) / 2, y + (ch - ch * s), cw * s, ch * s); // scale about feet
      ctx.restore();
    }
    // bake the local DWPose skeletons for the packed cells (F3 overlay in-game)
    const skeletons: Record<string, Record<string, [number, number, number]>> = {};
    for (const p of plan) if (this.m.skeletons[p.name]) skeletons[p.name] = this.m.skeletons[p.name];
    const meta: Record<string, unknown> = { cellW: cw, cellH: ch, cols, rows, frames: plan.map((p) => p.name) };
    if (Object.keys(skeletons).length) meta.skeletons = skeletons;
    return { sheetBase64: c.toDataURL('image/png').split(',')[1], meta };
  }

  // ── generation ─────────────────────────────────────────────────────────
  private async runBaseBatch(): Promise<void> {
    // resize baked in once: every base cell is conditioned on the same (scaled) canonical
    const refs = await this.refFor('canonical');
    for (const c of BASE_CELLS) {
      if (this.m.job('sprite:' + c.id)) continue;
      this.fireGen('sprite:' + c.id, 'sprite', c.id, SPRITE_PROMPT(this.m.inputs.name, c.pose), refs);
    }
    this.render();
  }

  private reroll(key: string): void {
    const j = this.m.job(key); if (!j) return;
    this.fireGen(key, j.kind, j.label, (j.prompt ?? '') + ' (variation)', []);
  }

  /** the full build payload (shared by SHIP write + ZIP export). */
  private async buildPayload(): Promise<Record<string, unknown>> {
    const sheet = await this.composeSheet();
    return {
      id: this.m.id, name: this.m.inputs.name.toUpperCase(), def: this.m.buildFullCharacter(),
      sheetBase64: sheet?.sheetBase64, meta: sheet?.meta,
      portraitBase64: dataUrlToB64(this.m.job('portrait')?.dataUrl),
      voClips: this.m.finalVoClips(), musicBase64: this.m.finalMusic(),
      stageBase64: dataUrlToB64(this.m.job('stage')?.dataUrl), stageId: this.m.id + '-home',
      stageName: this.m.inputs.name.toUpperCase() + ' HOME',
      fatalityPanels: this.m.generatedFatality.length ? this.m.generatedFatality : undefined,
    };
  }

  /** download a .zip of the current build + raw progress (playable out of the box). */
  private async exportZip(): Promise<void> {
    if (!this.m.inputs.name.trim()) { alert('Name your fighter first.'); return; }
    await this.save(); // flush state so the raw/ progress in the zip is current
    this.logMsg('building export .zip…');
    try {
      const r = await fetch('/__editor/creator/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(await this.buildPayload()),
      });
      const j = (await r.json()) as { ok?: boolean; zipBase64?: string; filename?: string; error?: string };
      if (!j.ok || !j.zipBase64) throw new Error(j.error ?? 'export failed');
      const a = document.createElement('a');
      a.href = 'data:application/zip;base64,' + j.zipBase64;
      a.download = j.filename ?? this.m.id + '.zip';
      document.body.appendChild(a); a.click(); a.remove();
      this.logMsg('✓ export ready — downloaded ' + (j.filename ?? this.m.id + '.zip'));
    } catch (e) { this.logMsg('✕ export — ' + String(e)); alert('Export failed: ' + String(e)); }
  }

  private async genVo(): Promise<void> {
    this.ensureDraft();
    this.m.voStatus = 'running'; this.render();
    try {
      const r = await fetch('/__editor/creator/audio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.m.inputs.name, vo: this.m.draft!.vo, fishModelId: this.m.voiceModelId }),
      });
      const j = (await r.json()) as { ok?: boolean; mock?: boolean; clips?: Record<string, string>; error?: string };
      if (!j.ok) throw new Error(j.error ?? 'vo failed');
      if (j.clips) this.m.generatedVo = { ...this.m.generatedVo, ...j.clips };
      this.m.voStatus = 'done';
      if (j.mock) console.info('[creator] VO mock — no ELEVENLABS_API_KEY; SHIP will write silence for un-BYO clips');
    } catch (e) { this.m.voStatus = 'error'; console.error(e); }
    this.render();
  }

  /** a job's image as base64, WITH its scale slider baked in — so resizing the
   *  canonical (or jump/crouch base) actually propagates to everything generated
   *  from it. Original `dataUrl` is left intact (re-scalable / re-rollable). */
  private async scaledRefB64(jobKey: string): Promise<string | undefined> {
    const job = this.m.job(jobKey);
    if (!job?.dataUrl) return undefined;
    const s = job.scale ?? 1;
    if (s === 1) return dataUrlToB64(job.dataUrl);
    const img = await this.loadImg(job.dataUrl);
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;
    const dw = W * s, dh = H * s;
    const square = Math.abs(W - H) < 4; // portrait: center; full-body cell: feet at bottom
    ctx.drawImage(img, (W - dw) / 2, square ? (H - dh) / 2 : (H - dh), dw, dh);
    return c.toDataURL('image/png').split(',')[1];
  }

  private async refFor(kind: 'canonical' | 'crouch' | 'jump'): Promise<string[]> {
    const ref = (await this.scaledRefB64(kind === 'canonical' ? 'canonical' : 'sprite:' + kind))
      ?? dataUrlToB64(this.m.inputs.referencePhotos?.[0]?.dataUrl);
    return ref ? [ref] : [];
  }

  /** pose + ref-base for any sprite cell key (base, attack, or special). */
  private cellSpec(name: string): { pose: string; ref: 'canonical' | 'crouch' | 'jump' } | null {
    const base = BASE_CELLS.find((b) => b.id === name);
    if (base) return { pose: base.pose, ref: 'canonical' };
    const atk = [...ATTACK_CELLS, ...this.m.specialCellList()].find((a) => a.name === name);
    return atk ? { pose: atk.pose, ref: atk.ref } : null;
  }

  /** run up to `limit` gen thunks at once (browser + API friendly). */
  private async poolFire(tasks: (() => Promise<void>)[], limit: number): Promise<void> {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (i < tasks.length) await tasks[i++]();
    }));
  }

  /** D3: generate distinct startup/active/recovery frames for every normal + special. */
  private async genAttacks(): Promise<void> {
    this.ensureDraft();
    const cells: AttackCell[] = this.m.allAttackCells();
    const tasks = cells
      .filter((c) => !this.m.job('sprite:' + c.name))
      .map((c) => async () => {
        const refs = await this.refFor(c.ref);
        await this.fireGen('sprite:' + c.name, 'sprite', c.name, SPRITE_PROMPT(this.m.inputs.name, c.pose), refs);
      });
    this.render();
    await this.poolFire(tasks, 5);
  }

  /** RIG: run the LOCAL Python DWPose over every generated cell (fal is ship-only). */
  private async runSkeleton(): Promise<void> {
    this.m.rigStatus = 'running'; this.render();
    try {
      const seen = new Set<string>();
      const cells: { name: string; pngBase64: string }[] = [];
      for (const p of this.m.sheetPlan()) {
        if (seen.has(p.name)) continue; seen.add(p.name);
        const b = dataUrlToB64(this.m.job(p.jobKey)?.dataUrl);
        if (b) cells.push({ name: p.name, pngBase64: b });
      }
      if (!cells.length) throw new Error('no cells generated yet');
      const r = await fetch('/__editor/skeleton-regen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: this.m.id, cells }),
      });
      const j = (await r.json()) as { ok?: boolean; keypoints?: Record<string, Record<string, [number, number, number]>>; error?: string };
      if (!j.ok) throw new Error(j.error ?? 'skeleton failed');
      this.m.skeletons = { ...this.m.skeletons, ...(j.keypoints ?? {}) };
      this.m.rigStatus = 'done';
      this.autoHitboxesFromSkeleton(false);
    } catch (e) { this.m.rigStatus = 'error'; console.error(e); }
    this.render();
  }

  /** auto-fit each attack move's hitbox from its ACTIVE cell's skeleton. */
  private autoHitboxesFromSkeleton(render = true): void {
    const def = this.m.buildFullCharacter() as { hurtStand: { h: number }; moves: Record<string, { input?: unknown }> };
    const rs = (def.hurtStand.h * 1.32) / 384; // cell-px → engine units (RENDER scale, per CLAUDE.md)
    for (const c of this.m.allAttackCells()) {
      if (!c.active) continue;
      const joints = this.m.skeletons[c.name]; if (!joints) continue;
      const kind = strikeKind(c.move, def.moves[c.move] as never);
      const box = hitboxFromSkeleton(joints, kind);
      if (!box) continue;
      this.m.autoHitboxes[c.move] = { x: Math.round(box.x * rs), y: Math.round(box.y * rs), w: Math.round(box.w * rs), h: Math.round(box.h * rs) };
    }
    if (render) this.render();
  }

  private async genFatality(): Promise<void> {
    this.ensureDraft();
    this.m.fatalityStatus = 'running'; this.render();
    try {
      const canon = dataUrlToB64(this.m.job('canonical')?.dataUrl) ?? dataUrlToB64(this.m.inputs.referencePhotos?.[0]?.dataUrl);
      const r = await fetch('/__editor/creator/fatality', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.m.inputs.name, fatalityName: this.m.draft!.fatality.name, referenceBase64: canon ? [canon] : [] }),
      });
      const j = (await r.json()) as { ok?: boolean; mock?: boolean; panels?: string[]; error?: string };
      if (!j.ok) throw new Error(j.error ?? 'fatality failed');
      if (j.panels) this.m.generatedFatality = j.panels;
      this.m.fatalityStatus = 'done';
      if (j.mock) console.info('[creator] fatality mock — no GEMINI key; no panels written, fatality omitted');
    } catch (e) { this.m.fatalityStatus = 'error'; console.error(e); }
    this.render();
  }

  private async cloneVoice(): Promise<void> {
    const samples = this.m.inputs.voiceSamples ?? [];
    if (!samples.length) { alert('Drop one or more voice samples first (Profile → Voice samples).'); return; }
    this.m.cloneStatus = 'running'; this.render();
    try {
      const r = await fetch('/__editor/creator/voice-clone', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: this.m.id, name: this.m.inputs.name, samples: samples.map((s) => ({ name: s.name, base64: dataUrlToB64(s.dataUrl) })) }),
      });
      const j = (await r.json()) as { ok?: boolean; mock?: boolean; modelId?: string; error?: string };
      if (!j.ok) throw new Error(j.error ?? 'clone failed');
      if (j.modelId) this.m.voiceModelId = j.modelId;
      this.m.cloneStatus = 'done';
      if (j.mock) console.info('[creator] voice-clone mock — no FISH key; VO will use the stock voice');
    } catch (e) { this.m.cloneStatus = 'error'; console.error(e); }
    this.render();
  }

  private async genMusic(): Promise<void> {
    this.ensureDraft();
    this.m.musicStatus = 'running'; this.render();
    try {
      const r = await fetch('/__editor/creator/music', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: this.m.draft!.musicPrompt, durationMs: 60000 }),
      });
      const j = (await r.json()) as { ok?: boolean; mock?: boolean; mp3Base64?: string; error?: string };
      if (!j.ok) throw new Error(j.error ?? 'music failed');
      if (j.mp3Base64) this.m.generatedMusic = j.mp3Base64;
      this.m.musicStatus = 'done';
      if (j.mock) console.info('[creator] music mock — no ELEVENLABS_API_KEY');
    } catch (e) { this.m.musicStatus = 'error'; console.error(e); }
    this.render();
  }

  private async fireGen(key: string, kind: string, label: string, prompt: string, refs: string[]): Promise<void> {
    const t0 = Date.now();
    const job: CreatorJob = { key, kind, label, status: 'running', prompt, approved: false, startedAt: t0 };
    this.m.upsertJob(job);
    this.logMsg(`▸ gen ${label}…`);
    this.renderTray(); this.renderPreviewControls(); this.redrawPreview();
    try {
      const r = await fetch('/__editor/creator/gen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, prompt, referenceBase64: refs, id: this.m.id, key }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as { ok?: boolean; mock?: boolean; pngBase64?: string; mime?: string; savedAs?: string; error?: string };
      if (!j.ok) throw new Error(j.error ?? 'gen failed');
      job.mock = !!j.mock;
      job.dataUrl = j.mock ? this.placeholder(kind, key, this.m.draft?.color ?? '#7fe3ff')
        : `data:${j.mime ?? 'image/png'};base64,` + j.pngBase64;
      job.savedAs = j.savedAs;
      job.status = 'done';
      this.logMsg(`✓ ${label} ${j.mock ? '(mock) ' : ''}${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (e) {
      job.status = 'error'; job.error = String(e);
      this.logMsg(`✕ ${label} — ${String(e).slice(0, 120)}`);
    }
    this.m.upsertJob(job);
    this.renderTray(); this.renderPreviewControls(); this.redrawPreview();
    if (CREATOR_STEPS[this.m.step] === 'SEED' && (key === 'canonical' || key === 'portrait')) this.render();
  }

  // ── preview switcher ──────────────────────────────────────────────────────
  /** base cells grouped by pose (idle/walk have a+b frames; the rest single). */
  private previewGroups(): { key: string; label: string; cells: string[] }[] {
    const groups: { key: string; label: string; cells: string[] }[] = [];
    for (const c of BASE_CELLS) {
      const key = c.id.replace(/-[ab]$/, '');
      let g = groups.find((x) => x.key === key);
      if (!g) { g = { key, label: key.toUpperCase(), cells: [] }; groups.push(g); }
      g.cells.push(c.id);
    }
    return groups;
  }

  /** buttons: one per generated group (click → play it) + regen for a picked cell. */
  private renderPreviewControls(): void {
    if (!this.previewControls) return;
    this.previewControls.replaceChildren();
    const groups = this.previewGroups().filter((g) => g.cells.some((c) => this.m.job('sprite:' + c)?.status === 'done'));
    for (const g of groups) {
      const on = this.preview.kind === 'group' && this.preview.key === g.key;
      const b = el('button', (on ? BTN_HOT : BTN) + 'padding:3px 9px;font-size:11px;', (g.cells.length > 1 ? '▶ ' : '') + g.label);
      b.onclick = () => { this.preview = { kind: 'group', key: g.key }; this.renderPreviewControls(); this.renderTray(); this.redrawPreview(); };
      this.previewControls.appendChild(b);
    }
    if (this.preview.kind === 'cell') {
      const back = el('button', BTN + 'padding:3px 9px;font-size:11px;', '↩ back to animation');
      back.onclick = () => { this.preview = { kind: 'group', key: 'idle' }; this.renderPreviewControls(); this.renderTray(); this.redrawPreview(); };
      this.previewControls.appendChild(back);
    }
    const label = this.preview.kind === 'cell' ? (this.m.job(this.preview.key)?.label ?? '') : this.preview.key;
    this.previewCaption.textContent = this.preview.kind === 'cell'
      ? 'viewing ' + label + ' — click a group to play, or a tray cell to inspect'
      : (groups.length ? 'playing ' + label : 'live preview');
    this.renderPreviewInspect();
  }

  /** per-cell scale slider + a regen box (guidance text appended to the prompt). */
  private renderPreviewInspect(): void {
    if (!this.previewInspect) return;
    this.previewInspect.replaceChildren();
    if (this.preview.kind !== 'cell') return;
    const j = this.m.job(this.preview.key); if (!j) return;
    const canRegen = this.preview.key.startsWith('sprite:') || this.preview.key === 'canonical' || this.preview.key === 'portrait';
    const wrap = el('div', 'margin-top:6px;padding:8px;border-radius:6px;border:1px solid #22303e;background:rgba(9,13,20,.85);');
    // scale (helps size-match a cell into the animation before packing)
    const s = j.scale ?? 1;
    const srow = el('div', 'display:flex;align-items:center;gap:8px;margin-bottom:8px;');
    const slabel = el('span', 'font-size:11px;color:#9fb4be;white-space:nowrap;', 'scale ' + s.toFixed(2));
    const range = el('input', 'flex:1;') as HTMLInputElement;
    range.type = 'range'; range.min = '0.5'; range.max = '1.6'; range.step = '0.02'; range.value = String(s);
    range.oninput = () => { j.scale = parseFloat(range.value); slabel.textContent = 'scale ' + j.scale.toFixed(2); this.redrawPreview(); this.renderTray(); };
    srow.append(slabel, range);
    wrap.appendChild(srow);
    if (canRegen) {
      wrap.appendChild(el('div', 'font-size:11px;color:#9fb4be;margin-bottom:3px;', 'PROMPT (sent to nano-banana — edit & regenerate)'));
      const prompt = el('textarea', INPUT + 'height:112px;font-size:11px;line-height:1.35;') as HTMLTextAreaElement;
      prompt.value = j.prompt ?? '';
      prompt.placeholder = 'the prompt this cell was generated from';
      this.regenPromptEl = prompt;
      const rr = el('button', BTN_HOT + 'margin-top:5px;width:100%;font-size:12px;',
        j.status === 'running' ? '◐ regenerating…' : '↻ Regenerate ' + (j.label ?? ''));
      rr.onclick = () => this.regenSelected();
      wrap.append(prompt, rr);
    }
    this.previewInspect.appendChild(wrap);
  }

  private selectCell(key: string): void {
    this.preview = { kind: 'cell', key };
    this.renderPreviewControls(); this.renderTray(); this.redrawPreview();
  }

  private async regenSelected(): Promise<void> {
    const key = this.preview.key;
    const job = this.m.job(key);
    const desc = this.m.inputs.description || this.m.inputs.name;
    const photoRefs = (this.m.inputs.referencePhotos ?? []).map((p) => dataUrlToB64(p.dataUrl)).filter(Boolean) as string[];
    // the edited prompt from the inspect box wins; fall back to the original, then a rebuilt default
    let prompt = this.regenPromptEl?.value.trim() || job?.prompt || '';
    let refs: string[] = [];
    let kind = job?.kind ?? 'sprite';
    let label = job?.label ?? key;
    if (key.startsWith('sprite:')) {
      const spec = this.cellSpec(key.slice('sprite:'.length)); if (!spec) return;
      refs = await this.refFor(spec.ref); // scaled base — resize carries through
      kind = 'sprite'; label = key.slice('sprite:'.length);
      if (!prompt) prompt = SPRITE_PROMPT(this.m.inputs.name, spec.pose);
    } else if (key === 'canonical') {
      refs = photoRefs; kind = 'canonical'; label = 'Canonical';
      if (!prompt) prompt = CANONICAL_PROMPT(desc);
    } else if (key === 'portrait') {
      refs = photoRefs.length > 1 ? [photoRefs[1], ...photoRefs.filter((_, i) => i !== 1)] : photoRefs;
      kind = 'portrait'; label = 'Portrait';
      if (!prompt) prompt = PORTRAIT_PROMPT(this.m.inputs.name, desc);
    } else return;
    this.fireGen(key, kind, label, prompt, refs);
  }

  /** the job the big preview should draw right now (animated group or one cell). */
  private currentPreviewJob(): CreatorJob | undefined {
    const p = this.preview;
    if (p.kind === 'cell') return this.m.job(p.key);
    const grp = this.previewGroups().find((g) => g.key === p.key);
    const done = grp?.cells.filter((c) => this.m.job('sprite:' + c)?.status === 'done') ?? [];
    if (done.length) return this.m.job('sprite:' + done[Math.floor(Date.now() / 300) % done.length]);
    for (const g of this.previewGroups()) {
      const d = g.cells.filter((c) => this.m.job('sprite:' + c)?.status === 'done');
      if (d.length) return this.m.job('sprite:' + d[0]);
    }
    return this.m.job('canonical');
  }

  // ── tray + preview ─────────────────────────────────────────────────────
  private renderTray(): void {
    this.trayEl.replaceChildren();
    const jobs = [...this.m.jobs.values()];
    if (!jobs.length) { this.trayEl.appendChild(el('div', 'font-size:11px;color:#5c6b78;', 'bake tray — generated assets appear here')); return; }
    for (const j of jobs) {
      const cell = el('div', 'flex:0 0 auto;width:52px;text-align:center;position:relative;cursor:pointer;');
      const selected = this.preview.kind === 'cell' && this.preview.key === j.key;
      const err = j.status === 'error';
      const border = err ? '#e0736a' : selected ? '#7fe3ff' : j.approved ? '#8fd6a0' : '#22303e';
      const c = el('canvas', `width:52px;height:66px;border-radius:4px;border:1px solid ${border};background:` + this.gridBg());
      c.width = 52; c.height = 66;
      this.paintJob(c, j);
      cell.appendChild(c);
      cell.appendChild(el('div', 'font-size:9px;color:' + (err ? '#e0736a' : selected ? '#bff0ff' : '#8fa6b2') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;', j.label));
      if (j.status === 'running') {
        cell.appendChild(this.shimmer());
        const secs = j.startedAt ? Math.round((Date.now() - j.startedAt) / 1000) : 0;
        cell.appendChild(el('div', 'position:absolute;top:1px;right:2px;font-size:9px;color:#bff0ff;text-shadow:0 1px 2px #000;', secs + 's'));
      }
      if (err) { cell.appendChild(el('div', 'position:absolute;top:0;left:0;right:0;bottom:18px;display:flex;align-items:center;justify-content:center;font-size:18px;color:#e0736a;', '✕')); cell.title = 'error: ' + (j.error ?? '') + ' — click to see prompt & retry'; }
      else cell.title = 'click to inspect ' + j.label + ' larger';
      cell.onclick = () => this.selectCell(j.key);
      this.trayEl.appendChild(cell);
    }
  }

  private shimmer(): HTMLDivElement {
    const s = el('div', 'position:absolute;inset:0;border-radius:4px;pointer-events:none;' +
      'background:linear-gradient(110deg,transparent 30%,rgba(127,227,255,.35) 50%,transparent 70%);' +
      'background-size:200% 100%;animation:mkShimmer 1.1s linear infinite;');
    return s;
  }

  /** the pose currently shown (group key, or the selected cell's base name). */
  private currentPose(): string {
    const p = this.preview;
    const raw = p.kind === 'cell' ? (this.m.job(p.key)?.label ?? '') : p.key;
    return raw.replace(/-[ab]$/, '');
  }

  /** the generated stage becomes the whole generator's backdrop (full-bleed). */
  private updateBackdrop(): void {
    const url = this.m.job('stage')?.dataUrl;
    if (url === this.lastBackdrop) return;
    this.lastBackdrop = url;
    if (url) { this.backdrop.style.background = ''; this.backdrop.style.backgroundImage = `url("${url}")`; this.backdrop.style.backgroundSize = 'cover'; this.backdrop.style.backgroundPosition = 'center bottom'; }
    else { this.backdrop.style.backgroundImage = ''; this.backdrop.style.background = this.gridBg(); }
  }

  private redrawPreview(): void {
    this.updateBackdrop();
    const ctx = this.previewCanvas.getContext('2d')!;
    // responsive: match the canvas buffer to its displayed size so the fighter
    // stands full-height in the left column (feet on the scene's ground line)
    const cw = Math.max(1, Math.round(this.previewCanvas.clientWidth));
    const ch = Math.max(1, Math.round(this.previewCanvas.clientHeight));
    if (this.previewCanvas.width !== cw) this.previewCanvas.width = cw;
    if (this.previewCanvas.height !== ch) this.previewCanvas.height = ch;
    const W = this.previewCanvas.width, H = this.previewCanvas.height;
    ctx.clearRect(0, 0, W, H); // transparent — the stage backdrop shows through
    // ground line matches the stage floor contract (bottom band); leave a hair of margin
    const floorY = Math.round(H * 0.94);
    const main = this.currentPreviewJob();
    const canon = this.m.job('canonical');
    const scale = main?.scale ?? 1;
    const pose = this.currentPose();
    // jump actually hops off the ground; grounded poses sit on the floor line
    const hop = pose === 'jump' ? Math.abs(Math.sin(Date.now() / 320)) * H * 0.26 : 0;
    if (main?.dataUrl) {
      this.drawShadow(ctx, W / 2, floorY, 96 * scale * Math.max(0.25, 1 - hop / (H * 0.3)));
      this.drawCharacter(ctx, main.dataUrl, W / 2, floorY - hop, H * 0.82 * scale);
    } else {
      this.drawShadow(ctx, W / 2, floorY, 80);
      this.drawSilhouette(ctx, W / 2, floorY, 150, this.m.draft?.color ?? '#31424f', canon?.status === 'running');
    }
    // portrait chip top-left
    const port = this.m.job('portrait');
    if (port?.dataUrl) { ctx.save(); ctx.beginPath(); ctx.rect(12, 12, 70, 70); ctx.clip(); this.drawContain(ctx, port.dataUrl, 12, 12, 70, 70); ctx.restore(); ctx.strokeStyle = '#3f6070'; ctx.lineWidth = 1; ctx.strokeRect(12, 12, 70, 70); }
  }

  /** cache the loaded HTMLImageElements so draws don't flicker; repaint on decode. */
  private imgCache = new Map<string, HTMLImageElement>();
  private img(url: string): HTMLImageElement | null {
    let im = this.imgCache.get(url);
    if (!im) { im = new Image(); im.src = url; this.imgCache.set(url, im); im.onload = () => { this.redrawPreview(); this.renderTray(); }; }
    return im.complete && im.naturalWidth ? im : null;
  }

  private drawContain(ctx: CanvasRenderingContext2D, url: string, x: number, y: number, w: number, h: number): void {
    const im = this.img(url); if (!im) return;
    const s = Math.min(w / im.naturalWidth, h / im.naturalHeight);
    const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
    ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh), dw, dh);
  }

  /** draw the fighter with feet (image bottom) planted at (feetX, feetY). */
  private drawCharacter(ctx: CanvasRenderingContext2D, url: string, feetX: number, feetY: number, targetH: number): void {
    const im = this.img(url); if (!im) return;
    const s = targetH / im.naturalHeight;
    const dw = im.naturalWidth * s;
    ctx.drawImage(im, feetX - dw / 2, feetY - targetH, dw, targetH);
  }

  private drawCover(ctx: CanvasRenderingContext2D, url: string, x: number, y: number, w: number, h: number): void {
    const im = this.img(url); if (!im) { this.drawGrid(ctx, w, h); return; }
    const s = Math.max(w / im.naturalWidth, h / im.naturalHeight);
    const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
    ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  private drawGrid(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#141d29'); g.addColorStop(0.9, '#0b1019'); g.addColorStop(1, '#080b11');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(40,60,80,.35)'; ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(127,227,255,.25)'; ctx.beginPath(); ctx.moveTo(0, H * 0.9); ctx.lineTo(W, H * 0.9); ctx.stroke();
  }

  private drawShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number): void {
    if (rx <= 2) return;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(0.6, 'rgba(0,0,0,.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.24); ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  }

  private paintJob(c: HTMLCanvasElement, j: CreatorJob): void {
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (j.dataUrl) this.drawContain(ctx, j.dataUrl, 2, 2, c.width - 4, c.height - 4);
  }

  // ── placeholder drawing (mock mode) ──────────────────────────────────────
  private placeholder(kind: string, seed: string, color: string): string {
    const c = document.createElement('canvas'); c.width = 288; c.height = 384;
    const ctx = c.getContext('2d')!;
    const s = seed.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
    if (kind === 'portrait') this.drawHead(ctx, 144, 210, 120, color);
    else if (kind === 'stage') this.drawStage(ctx, color);
    else this.drawFigure(ctx, color, s, kind === 'sprite' ? seed.replace('sprite:', '') : 'idle-a');
    return c.toDataURL('image/png');
  }

  private drawSilhouette(ctx: CanvasRenderingContext2D, cx: number, feetY: number, h: number, color: string, pulsing: boolean): void {
    ctx.save();
    ctx.globalAlpha = pulsing ? 0.35 + 0.25 * Math.sin(Date.now() / 300) : 0.55;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(cx, feetY - h * 0.86, h * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - h * 0.13, feetY - h * 0.72, h * 0.26, h * 0.5);
    ctx.fillRect(cx - h * 0.11, feetY - h * 0.24, h * 0.09, h * 0.24);
    ctx.fillRect(cx + 0.02 * h, feetY - h * 0.24, h * 0.09, h * 0.24);
    ctx.restore();
  }

  private drawFigure(ctx: CanvasRenderingContext2D, color: string, seed: number, pose: string): void {
    const cx = 144, feetY = 356, h = 300;
    const low = pose.includes('crouch') || pose.includes('down');
    const lift = pose === 'jump' ? 40 : 0;
    ctx.save(); ctx.translate(0, low ? 90 : -lift);
    const g = ctx.createLinearGradient(0, feetY - h, 0, feetY);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 3;
    // head
    ctx.beginPath(); ctx.arc(cx, feetY - h * 0.84, h * 0.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // torso
    ctx.beginPath(); ctx.roundRect(cx - h * 0.13, feetY - h * 0.7, h * 0.26, h * 0.44, 10); ctx.fill(); ctx.stroke();
    // arms (vary by seed for pose variety)
    const armY = feetY - h * 0.62; const reach = 30 + (seed % 40);
    ctx.lineWidth = 12; ctx.strokeStyle = color;
    ctx.beginPath(); ctx.moveTo(cx + h * 0.1, armY); ctx.lineTo(cx + h * 0.1 + reach, armY + (seed % 2 ? -20 : 20)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - h * 0.1, armY); ctx.lineTo(cx - h * 0.1 - 20, armY + 24); ctx.stroke();
    // legs
    ctx.beginPath(); ctx.moveTo(cx - 12, feetY - h * 0.26); ctx.lineTo(cx - 24, feetY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 12, feetY - h * 0.26); ctx.lineTo(cx + 24 + (pose.includes('walk') ? 16 : 0), feetY); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.font = '16px monospace'; ctx.fillText(pose, 8, 22);
  }

  private drawHead(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
    const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,.4)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(cx - r * 1.1, cy + r * 0.7, r * 2.2, r, 20); ctx.fill();
  }

  private drawStage(ctx: CanvasRenderingContext2D, color: string): void {
    const g = ctx.createLinearGradient(0, 0, 0, 384);
    g.addColorStop(0, color); g.addColorStop(0.7, '#1a2330'); g.addColorStop(1, '#0a0d14');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 288, 384);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(0, 300, 288, 84);
  }

  private loop(): void {
    let lastTray = 0;
    const tick = (): void => {
      const now = Date.now();
      if (CREATOR_STEPS[this.m.step] === 'PROFILE' || this.m.job('canonical')) this.redrawPreview();
      // refresh the tray ~1/s while anything is generating (running-timer display)
      if (now - lastTray > 900 && [...this.m.jobs.values()].some((j) => j.status === 'running')) { lastTray = now; this.renderTray(); }
      // periodic autosave (captures in-place text edits that don't trigger a render)
      if (now - this.lastSaveAt > 4000 && this.m.inputs.name.trim()) { this.lastSaveAt = now; void this.save(); }
      this.anim = requestAnimationFrame(tick);
    };
    this.anim = requestAnimationFrame(tick);
  }
}
