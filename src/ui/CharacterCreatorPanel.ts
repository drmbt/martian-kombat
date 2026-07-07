// Character Creator wizard — DOM overlay (dev-only), mounted over a grid-stage
// backdrop by CharacterCreatorScene. Scaffold: D1 (seed → approve canonical +
// portrait) and D2 (profile + stage/voice upload + first sprite batch that
// plays as it returns) are functional; D3–D7 are stubs. Generation goes through
// /__editor/creator/gen, which draws mock placeholders when no GEMINI key is set
// so the flow is walkable out of the box. See docs/CHARACTER_CREATOR.md.
import {
  CreatorModel, CREATOR_STEPS, makeDraft, BASE_CELLS,
  CANONICAL_PROMPT, PORTRAIT_PROMPT, SPRITE_PROMPT,
  type CreatorJob,
} from './creatorModel';

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
  private anim = 0;
  private onBack: () => void;

  constructor(mount: HTMLElement, onBack: () => void) {
    this.onBack = onBack;
    this.root = el('div',
      'position:absolute;inset:0;pointer-events:auto;display:flex;color:#eaf6fb;' + FONT +
      'background:radial-gradient(circle at 30% 20%,#141a24 0,#0a0d14 70%);');
    mount.appendChild(this.root);

    // left: preview stage
    const left = el('div', 'width:38%;min-width:300px;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:10px;border-right:1px solid #22303e;padding:16px;');
    this.previewCanvas = el('canvas', 'width:100%;max-width:340px;image-rendering:auto;' +
      'border:1px solid #22303e;border-radius:6px;background:' + this.gridBg());
    this.previewCanvas.width = 340; this.previewCanvas.height = 440;
    left.appendChild(this.previewCanvas);
    const cap = el('div', 'font-size:11px;color:#7d94a0;text-align:center;', 'live preview');
    left.appendChild(cap);
    this.root.appendChild(left);

    // right: stepper + body + tray
    const right = el('div', 'flex:1;display:flex;flex-direction:column;min-width:0;');
    this.stepperEl = el('div', 'display:flex;gap:4px;padding:12px 16px;border-bottom:1px solid #22303e;' +
      'flex-wrap:wrap;align-items:center;');
    this.bodyEl = el('div', 'flex:1;overflow:auto;padding:16px 20px;');
    this.trayEl = el('div', 'border-top:1px solid #22303e;padding:8px 12px;display:flex;gap:6px;' +
      'overflow-x:auto;min-height:64px;align-items:center;background:#0b1119;');
    right.appendChild(this.stepperEl);
    right.appendChild(this.bodyEl);
    right.appendChild(this.trayEl);
    this.root.appendChild(right);

    this.renderStepper();
    this.render();
    this.loop();
  }

  dispose(): void {
    cancelAnimationFrame(this.anim);
    this.root.remove();
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

  // ── body router ──────────────────────────────────────────────────────────
  private render(): void {
    this.bodyEl.replaceChildren();
    switch (CREATOR_STEPS[this.m.step]) {
      case 'SEED': return this.renderSeed();
      case 'PROFILE': return this.renderProfile();
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

  private fileRow(label: string, onPick: (dataUrl: string, name: string) => void): HTMLDivElement {
    const w = this.field(label);
    const inp = el('input', 'display:none;');
    inp.type = 'file'; inp.accept = 'image/*,audio/*';
    const btn = el('button', BTN, 'Choose file…');
    const name = el('span', 'font-size:12px;color:#8fd6a0;margin-left:8px;');
    btn.onclick = () => inp.click();
    inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      name.textContent = f.name;
      onPick(await readFile(f), f.name);
    };
    w.append(btn, name, inp);
    return w;
  }

  // ── D1 · SEED ──────────────────────────────────────────────────────────
  private renderSeed(): void {
    this.h('Seed your fighter', 'Name + one-line description + a full-body photo. We generate the canonical + portrait; approve, then move on.');

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

    this.bodyEl.appendChild(this.fileRow('Full-body photo (required)', (d) => { this.m.inputs.fullBodyDataUrl = d; this.redrawPreview(); }));
    this.bodyEl.appendChild(this.fileRow('Face close-up (optional)', (d) => (this.m.inputs.faceDataUrl = d)));

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
    const refs = [dataUrlToB64(this.m.inputs.fullBodyDataUrl), dataUrlToB64(this.m.inputs.faceDataUrl)].filter(Boolean) as string[];
    this.fireGen('canonical', 'canonical', 'Canonical', CANONICAL_PROMPT(this.m.inputs.description || this.m.inputs.name), refs);
    this.fireGen('portrait', 'portrait', 'Portrait', PORTRAIT_PROMPT(this.m.inputs.name), refs);
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

    colA.appendChild(this.lockGrid('Victory quotes', d.winQuotes));
    colA.appendChild(this.lockGrid('Kiai', d.vo.kiai));
    colA.appendChild(this.lockGrid('Hurt', d.vo.hurt));

    // col B — stage + voice + sprite batch
    colB.appendChild(this.fileRow('Stage landscape (optional)', (u) => { this.m.inputs.stageImageDataUrl = u; this.fireGen('stage', 'stage', 'Stage', d.stagePrompt, [dataUrlToB64(u)!].filter(Boolean)); this.render(); }));
    colB.appendChild(this.fileRow('Voice sample (optional)', (_u, n) => { this.m.inputs.voiceName = n; this.render(); }));
    if (this.m.inputs.voiceName) colB.appendChild(el('div', 'font-size:11px;color:#8fd6a0;margin:-6px 0 12px;', '✓ ' + this.m.inputs.voiceName + ' — will clone on ship'));

    const batchW = this.field('Base sprite batch (idle · walk · jump · crouch · block · fall · down)');
    const runBatch = el('button', BTN_HOT + 'font-size:12px;', '▸ Generate base sprites');
    runBatch.onclick = () => this.runBaseBatch();
    batchW.appendChild(runBatch);
    const anyBase = BASE_CELLS.some((c) => this.m.job('sprite:' + c.id));
    if (anyBase) batchW.appendChild(el('div', 'font-size:11px;color:#8fa6b2;margin-top:6px;', 'watch them animate in below — idle+walk auto-play when ready'));
    colB.appendChild(batchW);

    const audio = this.field('Audio');
    const runVo = el('button', BTN + 'font-size:12px;', '▸ Synth VO from locked lines (stub)');
    runVo.onclick = () => alert('VO synth runs the locked kiai/hurt/victory lines through ElevenLabs (or the voice clone). Stubbed in this scaffold.');
    audio.appendChild(runVo); colB.appendChild(audio);

    const nav = el('div', 'margin-top:18px;display:flex;gap:10px;');
    const bk = el('button', BTN, '‹ Back');
    bk.onclick = () => this.goto(0);
    const nx = el('button', BTN_HOT, 'Continue to Sprites ▸');
    nx.onclick = () => this.goto(2);
    nav.append(bk, nx); this.bodyEl.appendChild(nav);

    // auto-fire the base batch on entering profile if canonical is ready (tight pipelining)
    if (!anyBase && this.m.job('canonical')?.status === 'done') this.runBaseBatch();
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

  // ── generation ─────────────────────────────────────────────────────────
  private runBaseBatch(): void {
    for (const c of BASE_CELLS) {
      if (this.m.job('sprite:' + c.id)) continue;
      const ref = dataUrlToB64(this.m.job('canonical')?.dataUrl) ?? dataUrlToB64(this.m.inputs.fullBodyDataUrl);
      this.fireGen('sprite:' + c.id, 'sprite', c.id, SPRITE_PROMPT(this.m.inputs.name, c.pose), ref ? [ref] : []);
    }
    this.render();
  }

  private reroll(key: string): void {
    const j = this.m.job(key); if (!j) return;
    this.fireGen(key, j.kind, j.label, (j.prompt ?? '') + ' (variation)', []);
  }

  private async fireGen(key: string, kind: string, label: string, prompt: string, refs: string[]): Promise<void> {
    const job: CreatorJob = { key, kind, label, status: 'running', prompt, approved: false };
    this.m.upsertJob(job);
    this.renderTray(); this.redrawPreview();
    try {
      const r = await fetch('/__editor/creator/gen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, prompt, referenceBase64: refs }),
      });
      const j = (await r.json()) as { ok?: boolean; mock?: boolean; pngBase64?: string; error?: string };
      if (!j.ok) throw new Error(j.error ?? 'gen failed');
      job.mock = !!j.mock;
      job.dataUrl = j.mock ? this.placeholder(kind, key, this.m.draft?.color ?? '#7fe3ff')
        : 'data:image/png;base64,' + j.pngBase64;
      job.status = 'done';
    } catch (e) {
      job.status = 'error'; job.error = String(e);
    }
    this.m.upsertJob(job);
    this.renderTray(); this.redrawPreview();
    if (CREATOR_STEPS[this.m.step] === 'SEED' && (key === 'canonical' || key === 'portrait')) this.render();
  }

  // ── tray + preview ─────────────────────────────────────────────────────
  private renderTray(): void {
    this.trayEl.replaceChildren();
    const jobs = [...this.m.jobs.values()];
    if (!jobs.length) { this.trayEl.appendChild(el('div', 'font-size:11px;color:#5c6b78;', 'bake tray — generated assets appear here')); return; }
    for (const j of jobs) {
      const cell = el('div', 'flex:0 0 auto;width:52px;text-align:center;position:relative;');
      const c = el('canvas', 'width:52px;height:66px;border-radius:4px;border:1px solid ' +
        (j.approved ? '#8fd6a0' : '#22303e') + ';background:' + this.gridBg());
      c.width = 52; c.height = 66;
      this.paintJob(c, j);
      cell.appendChild(c);
      cell.appendChild(el('div', 'font-size:9px;color:#8fa6b2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;', j.label));
      if (j.status === 'running') cell.appendChild(this.shimmer());
      this.trayEl.appendChild(cell);
    }
  }

  private shimmer(): HTMLDivElement {
    const s = el('div', 'position:absolute;inset:0;border-radius:4px;pointer-events:none;' +
      'background:linear-gradient(110deg,transparent 30%,rgba(127,227,255,.35) 50%,transparent 70%);' +
      'background-size:200% 100%;animation:mkShimmer 1.1s linear infinite;');
    return s;
  }

  private redrawPreview(): void {
    const ctx = this.previewCanvas.getContext('2d')!;
    const W = this.previewCanvas.width, H = this.previewCanvas.height;
    ctx.clearRect(0, 0, W, H);
    // main character: prefer an animated idle/walk pair, else canonical
    const idle = this.animFrame();
    const canon = this.m.job('canonical');
    const main = idle ?? canon;
    if (main?.dataUrl) this.drawContain(ctx, main.dataUrl, 20, 40, W - 40, H - 60);
    else this.drawSilhouette(ctx, W / 2, H - 30, 150, this.m.draft?.color ?? '#31424f', canon?.status === 'running');
    // portrait chip top-left
    const port = this.m.job('portrait');
    if (port?.dataUrl) { ctx.save(); ctx.beginPath(); ctx.rect(12, 12, 70, 70); ctx.clip(); this.drawContain(ctx, port.dataUrl, 12, 12, 70, 70); ctx.restore(); ctx.strokeStyle = '#3f6070'; ctx.strokeRect(12, 12, 70, 70); }
  }

  /** cache the loaded HTMLImageElements so contain-draw doesn't flicker */
  private imgCache = new Map<string, HTMLImageElement>();
  private drawContain(ctx: CanvasRenderingContext2D, url: string, x: number, y: number, w: number, h: number): void {
    let img = this.imgCache.get(url);
    if (!img) {
      img = new Image(); img.src = url; this.imgCache.set(url, img);
      // repaint BOTH the main preview and the tray thumbs once decoded, else a
      // thumb painted before its image loaded stays blank until the next render
      img.onload = () => { this.redrawPreview(); this.renderTray(); };
    }
    if (!img.complete || !img.naturalWidth) return;
    const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh), dw, dh);
  }

  private paintJob(c: HTMLCanvasElement, j: CreatorJob): void {
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (j.dataUrl) this.drawContain(ctx, j.dataUrl, 2, 2, c.width - 4, c.height - 4);
  }

  private animFrame(): CreatorJob | undefined {
    const ia = this.m.job('sprite:idle-a'), ib = this.m.job('sprite:idle-b');
    const wa = this.m.job('sprite:walk-a'), wb = this.m.job('sprite:walk-b');
    const phase = Math.floor(Date.now() / 260) % 2;
    if (wa?.status === 'done' && wb?.status === 'done') return phase ? wb : wa;
    if (ia?.status === 'done' && ib?.status === 'done') return phase ? ib : ia;
    if (ia?.status === 'done') return ia;
    return undefined;
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
    const tick = (): void => {
      if (CREATOR_STEPS[this.m.step] === 'PROFILE' || this.m.job('canonical')) this.redrawPreview();
      this.anim = requestAnimationFrame(tick);
    };
    this.anim = requestAnimationFrame(tick);
  }
}
