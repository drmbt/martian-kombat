// Character Creator wizard — DOM overlay (dev-only), mounted over a grid-stage
// backdrop by CharacterCreatorScene. Scaffold: D1 (seed → approve canonical +
// portrait) and D2 (profile + stage/voice upload + first sprite batch that
// plays as it returns) are functional; D3–D7 are stubs. Generation goes through
// /__editor/creator/gen, which draws mock placeholders when no GEMINI key is set
// so the flow is walkable out of the box. See docs/CHARACTER_CREATOR.md.
import {
  CreatorModel, CREATOR_STEPS, makeDraft, BASE_CELLS, ATTACK_CELLS,
  ARCHETYPE_INFO, specialsForArchetype, SPECIAL_ARCHETYPES, controlsForArchetype,
  BASE_MOVE_IDS, NORMAL_MOVE_IDS, moveCellNames, slugify, isProjectileArchetypeKey,
  CANONICAL_PROMPT, PORTRAIT_PROMPT, KO_PROMPT, SPRITE_PROMPT, fatalityBeats,
  type CreatorJob, type AttackCell, type DesignDraft, type SpecialDraft,
} from './creatorModel';
import { hitboxFromSkeleton, strikeKind } from './hitboxFromSkeleton';
import { STAGES } from '../data/stages';
import { ART_MARGIN, CELL_H, CELL_W, ORIGIN_CX, ORIGIN_FEET } from '../render/coords';
import { cellBoxToHitbox, footOffset } from '../render/geometry';

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
  private previewToggles!: HTMLDivElement; // skeleton / hitbox overlay checkboxes
  private previewCaption!: HTMLDivElement;
  private previewInspect!: HTMLDivElement;
  private showSkeleton = false; // draw the DWPose skeleton over the fighter
  private showHitboxes = false; // draw + drag/scale the previewed move's hitbox
  private geom?: { W: number; floorY: number; drawH: number; ox: number; oy: number; cell?: string }; // last main-fighter draw (skeleton overlay)
  private hbDrag?: { moveId: string; mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'; sx: number; sy: number; box: { x: number; y: number; w: number; h: number } };
  private builtCache?: { t: number; def: { moves: Record<string, { hitbox?: unknown }>; spriteOffsetY?: number } }; // throttled buildFullCharacter
  private backdrop!: HTMLDivElement;
  private lastBackdrop?: string;
  private leftEl!: HTMLDivElement;
  private leftW = 40; // preview column width %, drag-resizable
  private lastLeftW = 40;
  private regenPromptEl?: HTMLTextAreaElement; // editable copy of the selected cell's prompt
  private regenUseSelf = false; // img2img: feed the current cell image as the reference
  private moveAudioText: Record<string, string> = {}; // per-special call-out text (transient)
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
    // one-time CSS for the async "diffusion" shimmer (host-independent: the
    // standalone creator scene and the studio CREATOR module both need it)
    if (!document.getElementById('mk-cc-style')) {
      const st = document.createElement('style');
      st.id = 'mk-cc-style';
      st.textContent = '@keyframes mkShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}';
      document.head.appendChild(st);
    }
    this.root = el('div',
      'position:absolute;inset:0;pointer-events:auto;display:flex;color:#eaf6fb;overflow:hidden;' + FONT +
      'background:#0a0d14;');
    mount.appendChild(this.root);
    // typing in the wizard's fields must never drive the fight underneath
    // when hosted in the studio (same isolation the Sprite Editor uses)
    this.root.addEventListener('keydown', this.stopFormKeys, true);
    this.root.addEventListener('keyup', this.stopFormKeys, true);

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
    this.previewToggles = el('div', 'display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:3px;');
    this.previewControls = el('div', 'display:flex;flex-wrap:wrap;gap:4px;justify-content:center;');
    this.previewCaption = el('div', 'font-size:11px;color:#c8d6de;text-align:center;text-shadow:0 1px 3px #000;margin-top:2px;', 'live preview');
    this.previewCanvas = el('canvas', 'flex:1;width:100%;min-height:0;image-rendering:auto;'); // transparent, fills — never shrunk by the inspect panel (fighter stays grounded)
    this.previewCanvas.onmousedown = (e) => this.onHbDown(e);
    this.previewCanvas.onmousemove = (e) => this.onHbMove(e);
    this.previewCanvas.onmouseup = () => this.endHbDrag();
    this.previewCanvas.onmouseleave = () => this.endHbDrag();
    left.append(this.previewToggles, this.previewControls, this.previewCaption, this.previewCanvas);
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
    // body region: the wizard dialog + the cell-inspect panel that OVERLAYS it
    // (absolute, so opening inspect never reflows the left preview → fighter stays
    // on the ground). Inspect replaces the dialog until closed.
    const bodyWrap = el('div', 'position:relative;flex:1;min-height:0;');
    this.bodyEl = el('div', 'position:absolute;inset:0;overflow:auto;padding:16px 20px;');
    this.previewInspect = el('div', 'position:absolute;inset:0;z-index:20;overflow:auto;padding:14px 18px;' +
      'background:rgba(9,13,20,.97);display:none;');
    bodyWrap.append(this.bodyEl, this.previewInspect);
    // activity log: every gen start / done / error with timing (debug the "stuck wheel")
    this.logEl = el('div', "flex:0 0 auto;max-height:84px;overflow:auto;border-top:1px solid #22303e;" +
      "padding:5px 12px;font-family:monospace;font-size:10px;line-height:1.5;color:#8fa6b2;background:#080b11;white-space:pre-wrap;");
    this.trayEl = el('div', 'border-top:1px solid #22303e;padding:8px 12px;display:flex;gap:6px;' +
      'overflow-x:auto;min-height:64px;align-items:center;background:#0b1119;');
    right.appendChild(this.stepperEl);
    right.appendChild(bodyWrap);
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
    this.root.removeEventListener('keydown', this.stopFormKeys, true);
    this.root.removeEventListener('keyup', this.stopFormKeys, true);
    this.root.remove();
  }

  private stopFormKeys = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) {
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  };

  /** Character Studio rail: mount/unmount the whole wizard as the CREATOR
   *  module (a draft save is flushed on unmount so nothing is lost). */
  setMounted(v: boolean): void {
    this.root.style.display = v ? 'flex' : 'none';
    if (!v) void this.save();
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
    const imp = el('button', BTN + 'padding:4px 8px;font-size:12px;', '⤒ ZIP');
    imp.title = 'import a creator .zip and register it as a playable fighter';
    imp.onclick = () => this.pickImportZip();
    this.stepperEl.appendChild(imp);
    CREATOR_STEPS.forEach((s, i) => {
      const done = i < this.m.step;
      const on = i === this.m.step;
      const chip = el('div',
        'padding:4px 10px;border-radius:12px;font-size:11px;letter-spacing:.5px;cursor:pointer;' +
        `border:1px solid ${on ? '#7fe3ff' : done ? '#3f6070' : '#22303e'};` +
        `color:${on ? '#bff0ff' : done ? '#8fd6a0' : '#5c6b78'};` +
        `background:${on ? '#12232e' : 'transparent'};`,
        `${done ? '✓ ' : ''}${i + 1}·${s}`);
      chip.title = 'go to ' + s;
      chip.onclick = () => this.goto(i);
      this.stepperEl.appendChild(chip);
    });
  }

  private goto(step: number): void {
    this.m.step = Math.max(0, Math.min(CREATOR_STEPS.length - 1, step));
    // the Rig step is all about skeleton + hitboxes — turn both overlays on by
    // default when arriving there (skeleton stays greyed/hidden until DWPose runs)
    if (CREATOR_STEPS[this.m.step] === 'RIG') { this.showSkeleton = true; this.showHitboxes = true; }
    this.renderStepper();
    this.render();
    this.renderPreviewControls(); // step-dependent move buttons
  }

  // ── live save / resume ────────────────────────────────────────────────────
  /** everything needed to rebuild the run, minus image bytes (those are files). */
  private serializeState(): Record<string, unknown> {
    return {
      version: 1, step: this.m.step, inputs: this.m.inputs, draft: this.m.draft, existingId: this.m.existingId, baseDef: this.m.baseDef,
      generatedVo: this.m.generatedVo, generatedMusic: this.m.generatedMusic, generatedFatality: this.m.generatedFatality, fatalityBeats: this.m.fatalityBeats,
      skeletons: this.m.skeletons, autoHitboxes: this.m.autoHitboxes, voiceModelId: this.m.voiceModelId,
      jobs: [...this.m.jobs.values()].map((j) => ({
        key: j.key, kind: j.kind, label: j.label, status: j.status, prompt: j.prompt,
        mock: j.mock, approved: j.approved, scale: j.scale, offX: j.offX, offY: j.offY, mime: j.dataUrl?.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png', savedAs: j.savedAs,
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
      await this.syncRawFrames();
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
        step?: number; inputs?: CreatorModel['inputs']; draft?: CreatorModel['draft']; existingId?: string; baseDef?: Record<string, unknown>;
        generatedVo?: Record<string, string>; generatedMusic?: string; generatedFatality?: string[]; fatalityBeats?: string[];
        skeletons?: CreatorModel['skeletons']; autoHitboxes?: CreatorModel['autoHitboxes']; voiceModelId?: string;
        jobs?: { key: string; kind: string; label: string; status: CreatorJob['status']; prompt?: string; mock?: boolean; approved?: boolean; scale?: number; offX?: number; offY?: number; mime?: string; savedAs?: string }[];
      };
      this.m.inputs = (s.inputs ?? { name: '', description: '' });
      this.m.draft = (s.draft ?? null);
      this.m.existingId = s.existingId;
      this.m.baseDef = s.baseDef;
      this.m.step = s.step ?? 0;
      this.m.generatedVo = (s.generatedVo ?? {});
      this.m.generatedMusic = s.generatedMusic;
      this.m.generatedFatality = (s.generatedFatality ?? []);
      this.m.fatalityBeats = (s.fatalityBeats ?? []);
      this.m.skeletons = (s.skeletons ?? {});
      this.m.autoHitboxes = (s.autoHitboxes ?? {});
      this.m.voiceModelId = s.voiceModelId;
      this.m.jobs = new Map();
      for (const jb of s.jobs ?? []) {
        const img = j.images?.[jb.key];
        // an image on disk = done; a stale 'running' with no image can't resume its
        // fetch, so surface it as an error (regenable) instead of an eternal spinner
        const status: CreatorJob['status'] = img ? 'done' : jb.status === 'running' ? 'error' : jb.status;
        this.m.jobs.set(jb.key, { key: jb.key, kind: jb.kind, label: jb.label, status, prompt: jb.prompt, mock: jb.mock, approved: jb.approved, scale: jb.scale, offX: jb.offX, offY: jb.offY, savedAs: jb.savedAs, error: status === 'error' ? 'interrupted — regenerate' : undefined, dataUrl: img ? `data:${jb.mime ?? 'image/png'};base64,${img}` : undefined });
      }
      void this.syncRawFrames();
      this.renderStepper(); this.render(); this.renderPreviewControls(); this.renderTray(); this.redrawPreview();
    } catch (e) { console.error(e); alert('Could not load draft: ' + String(e)); }
  }

  private async loadCanon(id: string): Promise<void> {
    try {
      this.logMsg(`opening canon fighter ${id}…`);
      const r = await fetch('/__editor/creator/canon', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      });
      const j = (await r.json()) as {
        ok?: boolean; error?: string; def?: Record<string, unknown>; meta?: { cellW?: number; cellH?: number; cols?: number; frames?: string[] };
        sheetBase64?: string; portraitBase64?: string; koBase64?: string; stageBase64?: string;
        projectiles?: Record<string, string>; fatalityPanels?: string[];
      };
      if (!j.ok || !j.def || !j.meta || !j.sheetBase64) throw new Error(j.error ?? 'load failed');
      const def = j.def as Record<string, unknown> & {
        id?: string; name?: string; color?: string; lore?: { personality?: string; backstory?: string; tagline?: string };
        winQuotes?: string[]; moves?: Record<string, Record<string, unknown>>;
        fatality?: { id?: string; name?: string; input?: Record<string, unknown> };
      };
      const m = new CreatorModel();
      m.existingId = typeof def.id === 'string' ? def.id : id;
      m.baseDef = def;
      const lore = typeof def.lore === 'object' && def.lore ? def.lore : {};
      m.inputs = {
        name: typeof def.name === 'string' ? def.name : id.toUpperCase(),
        description: lore.personality ?? lore.tagline ?? String(def.name ?? id),
        lore: lore.backstory ?? '',
        stageMode: typeof def.stage === 'string' ? 'existing' : 'none',
        stageId: typeof def.stage === 'string' ? def.stage : undefined,
        stageName: typeof def.stage === 'string' ? STAGES.find((s) => s.id === def.stage)?.name : undefined,
      };
      const draft = makeDraft(m.inputs.name, m.inputs.description);
      if (typeof def.color === 'string') draft.color = def.color;
      if (typeof def.lore === 'object' && def.lore) draft.lore = { ...draft.lore, ...def.lore };
      if (Array.isArray(def.winQuotes)) draft.winQuotes = def.winQuotes;
      draft.specials = this.specialDraftsFromDef(def.moves ?? {});
      draft.specialPool = [];
      if (def.fatality?.id) {
        draft.fatality = {
          id: def.fatality.id,
          name: def.fatality.name ?? draft.fatality.name,
          input: this.controlsFromInput(def.fatality.input),
        };
      }
      m.draft = draft;
      m.generatedFatality = j.fatalityPanels ?? [];
      m.fatalityBeats = fatalityBeats(m.inputs.name, draft.fatality.name);
      m.step = 2;
      const frames = await this.sliceSheet(j.sheetBase64, j.meta);
      for (const [name, dataUrl] of Object.entries(frames)) {
        m.jobs.set('sprite:' + name, {
          key: 'sprite:' + name, kind: 'sprite', label: name, status: 'done',
          dataUrl, approved: true, savedAs: m.frameNameFor('sprite:' + name) + '.png',
        });
      }
      const metaSkeletons = (j.meta as { skeletons?: unknown }).skeletons;
      if (metaSkeletons && typeof metaSkeletons === 'object') m.skeletons = metaSkeletons as CreatorModel['skeletons'];
      if (j.portraitBase64) m.jobs.set('portrait', { key: 'portrait', kind: 'portrait', label: 'Portrait', status: 'done', approved: true, dataUrl: 'data:image/png;base64,' + j.portraitBase64, savedAs: 'portrait.png' });
      if (j.koBase64) m.jobs.set('ko', { key: 'ko', kind: 'ko', label: 'KO portrait', status: 'done', approved: true, dataUrl: 'data:image/png;base64,' + j.koBase64, savedAs: 'ko.png' });
      if (j.stageBase64) m.jobs.set('stage', { key: 'stage', kind: 'stage', label: 'Stage', status: 'done', approved: true, dataUrl: 'data:image/jpeg;base64,' + j.stageBase64, savedAs: 'stage.jpg' });
      for (const [moveId, b64] of Object.entries(j.projectiles ?? {})) {
        m.jobs.set('proj:' + moveId, { key: 'proj:' + moveId, kind: 'projectile', label: `${moveId} projectile`, status: 'done', approved: true, dataUrl: 'data:image/png;base64,' + b64, savedAs: `projectile-${moveId}.png` });
      }
      this.m = m;
      void this.syncRawFrames();
      this.logMsg(`✓ opened ${id} from canon assets`);
      this.renderStepper(); this.render(); this.renderPreviewControls(); this.renderTray(); this.redrawPreview();
    } catch (e) { console.error(e); alert('Could not open canon fighter: ' + String(e)); }
  }

  private async sliceSheet(sheetBase64: string, meta: { cellW?: number; cellH?: number; cols?: number; frames?: string[] }): Promise<Record<string, string>> {
    const img = await this.loadImg('data:image/png;base64,' + sheetBase64);
    const cw = meta.cellW ?? 288, ch = meta.cellH ?? 384, cols = meta.cols ?? 6;
    const out: Record<string, string> = {};
    (meta.frames ?? []).forEach((name, i) => {
      const c = document.createElement('canvas'); c.width = cw; c.height = ch;
      c.getContext('2d')!.drawImage(img, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch, 0, 0, cw, ch);
      out[name] = c.toDataURL('image/png');
    });
    return out;
  }

  private specialDraftsFromDef(moves: Record<string, Record<string, unknown>>): SpecialDraft[] {
    return Object.entries(moves)
      .filter(([, m]) => m.input && typeof m.input === 'object')
      .map(([id, move]) => {
        const p = (move.projectile && typeof move.projectile === 'object') ? move.projectile as Record<string, unknown> : {};
        return {
          id,
          name: typeof move.name === 'string' ? move.name : id.replace(/-/g, ' '),
          controls: this.controlsFromInput(move.input as Record<string, unknown>),
          archetype: this.archetypeFromMove(move),
          description: typeof move.name === 'string' ? move.name : id.replace(/-/g, ' '),
          approved: true,
          projScale: typeof p.renderSize === 'number' ? p.renderSize / 72 : undefined,
          projSpawnX: typeof p.spawnX === 'number' ? p.spawnX : undefined,
          projSpawnY: typeof p.spawnY === 'number' ? p.spawnY : undefined,
          projBox: (p.box && typeof p.box === 'object') ? p.box as SpecialDraft['projBox'] : undefined,
        };
      });
  }

  private controlsFromInput(input?: Record<string, unknown>): string {
    if (!input) return 'qcf+P';
    const btn = input.button === 'kick' ? 'K' : input.button === 'PPP' ? 'PPP' : input.button === 'KKK' ? 'KKK' : input.button === 'LPLK' ? 'LPLK' : 'P';
    if (input.mash) return `mash+${btn === 'K' ? 'K' : 'P'}`;
    return typeof input.motion === 'string' ? `${input.motion}+${btn}` : btn;
  }

  private archetypeFromMove(move: Record<string, unknown>): string {
    const input = (move.input && typeof move.input === 'object') ? move.input as Record<string, unknown> : {};
    if (move.projectile && typeof move.projectile === 'object') {
      const p = move.projectile as Record<string, unknown>;
      if (input.motion === 'cbf') return 'sonic-boom';
      if (p.detonate) return 'fuse-detonate';
      if (p.pull) return 'pull-projectile';
      if (p.field || p.slowFactor) return 'slow-field';
      if (typeof p.count === 'number' && p.count > 1) return 'multi-projectile';
      if (typeof p.vy === 'number' || typeof p.gravity === 'number') return 'lob-projectile';
      if (typeof p.rehit === 'number' && p.rehit > 0) return p.vx === 0 ? 'stationary-trap' : 'lingering-cloud';
      if (p.vx === 0) return 'stationary-trap';
      if (typeof p.ttl === 'number' && p.ttl > 0 && p.ttl <= 30) return 'short-range-flame';
      return 'projectile';
    }
    if (move.teleport && typeof move.teleport === 'object') return (move.teleport as Record<string, unknown>).mirror ? 'mirror-teleport' : 'teleport';
    if (move.grab) {
      if (input.button === 'LPLK' || move.techable) return 'techable-throw';
      if (move.heal) return 'heal-grab';
      if (move.grabRecoil) return 'grab-recoil';
      return 'command-grab';
    }
    if (input.mash || move.rehit) return 'mash';
    if (input.motion === 'du') return 'flash-kick';
    if (move.reflect) return 'reflector';
    if (move.projImmune) return 'projectile-immune';
    if (move.vault) return 'vault';
    if (move.float) return 'yoga-float';
    if (move.leap) return 'anti-air-dp';
    if (move.forwardVel) return input.motion === 'bf' ? 'horizontal-rush' : 'advancing-rush';
    if (move.invuln) return 'reversal';
    return 'advancing-rush';
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
      case 'MOVES': return this.renderMoves();
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

    const loreW = this.field('Lore / backstory (optional)');
    const loreI = el('textarea', INPUT + 'height:70px;resize:vertical;') as HTMLTextAreaElement;
    loreI.value = this.m.inputs.lore ?? '';
    loreI.placeholder = 'arcade backstory — who they are on Mars, running jokes, rivalries. Written into the character; leave blank for an auto-draft.';
    loreI.oninput = () => (this.m.inputs.lore = loreI.value);
    loreW.appendChild(loreI);
    this.bodyEl.appendChild(loreW);

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
      if (this.m.job('ko')) gate.appendChild(this.approvalRow('ko', 'KO portrait'));
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

    const canonTitle = el('div', 'font-size:11px;color:#9fb4be;margin:12px 0 6px;', 'EDIT A CANON FIGHTER (loads current JSON + packed sheet)');
    const canonRow = el('div', 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;');
    const canonStatus = el('span', 'font-size:11px;color:#7d94a0;', 'loading…');
    canonRow.appendChild(canonStatus);
    bar.append(canonTitle, canonRow);
    void fetch('/__editor/creator/canon', { method: 'POST' }).then(async (r) => {
      const j = (await r.json()) as { fighters?: { id: string; name: string }[] };
      canonRow.replaceChildren();
      const fighters = j.fighters ?? [];
      if (!fighters.length) { canonRow.appendChild(el('span', 'font-size:11px;color:#5c6b78;', 'no playable fighters found')); return; }
      for (const f of fighters) {
        const b = el('button', BTN + 'padding:3px 9px;font-size:11px;', `✎ ${f.name}`);
        b.title = `open ${f.id} in the Character Creator`;
        b.onclick = () => void this.loadCanon(f.id);
        canonRow.appendChild(b);
      }
    }).catch(() => { canonStatus.textContent = 'could not list canon fighters'; });
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
    void this.runDesignDraft();
    const desc = this.m.inputs.description || this.m.inputs.name;
    const refs = (this.m.inputs.referencePhotos ?? []).map((p) => dataUrlToB64(p.dataUrl)).filter(Boolean) as string[];
    // portrait wants the FACE ref first (2nd photo per the D1 hint); fall back to whatever's provided
    const portraitRefs = refs.length > 1 ? [refs[1], ...refs.filter((_, i) => i !== 1)] : refs;
    this.fireGen('canonical', 'canonical', 'Canonical', CANONICAL_PROMPT(desc), refs);
    this.fireGen('portrait', 'portrait', 'Portrait', PORTRAIT_PROMPT(this.m.inputs.name, desc), portraitRefs);
    // defeated bust for the win-quote screen (chroma-keyed square, same as portrait);
    // the neutral bust <id>-bust.png is CROPPED from the canonical at ship (bustFromCanonical)
    this.fireGen('ko', 'ko', 'KO portrait', KO_PROMPT(this.m.inputs.name, desc), portraitRefs);
    this.render();
  }

  private ensureDraft(): void {
    if (!this.m.draft) this.m.draft = makeDraft(this.m.inputs.name, this.m.inputs.description);
  }

  private async runDesignDraft(): Promise<void> {
    const name = this.m.inputs.name.trim();
    if (!name) return;
    this.logMsg('▸ designing fighter kit + voice lines…');
    try {
      const r = await fetch('/__editor/creator/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: this.m.inputs.description, lore: this.m.inputs.lore }),
      });
      const j = (await r.json()) as { ok?: boolean; mock?: boolean; draft?: Partial<DesignDraft>; prompt?: string; error?: string };
      if (!j.ok) throw new Error(j.error ?? 'design failed');
      if (j.mock || !j.draft) { this.logMsg('design draft mock — using local template'); return; }
      this.m.draft = this.mergeDesignDraft(j.draft);
      this.m.fatalityBeats = fatalityBeats(name, this.m.draft.fatality.name);
      this.logMsg('✓ design draft ready — Profile/Moves prefilled from lore');
      this.render(); this.renderPreviewControls();
    } catch (e) {
      this.logMsg('✕ design draft — ' + String(e));
    }
  }

  private mergeDesignDraft(src: Partial<DesignDraft>): DesignDraft {
    const base = this.m.draft ?? makeDraft(this.m.inputs.name, this.m.inputs.description);
    const cleanSpecials = (list: unknown, fallback: SpecialDraft[]): SpecialDraft[] => {
      if (!Array.isArray(list)) return fallback;
      const out: SpecialDraft[] = [];
      for (const raw of list) {
        if (!raw || typeof raw !== 'object') continue;
        const s = raw as Partial<SpecialDraft>;
        const name = String(s.name ?? '').trim();
        const archetype = String(s.archetype ?? '').trim();
        const description = String(s.description ?? '').trim();
        const archetypeInfo = SPECIAL_ARCHETYPES.find((a) => a.key === archetype);
        if (!name || !archetypeInfo || !description) continue;
        const controls = String(s.controls ?? '').trim();
        out.push({
          id: slugify(String(s.id ?? name)),
          name,
          controls: archetypeInfo.controls.includes(controls) ? controls : controlsForArchetype(archetype),
          archetype,
          description,
          approved: false,
        });
      }
      return out.length ? out : fallback;
    };
    const lines = (v: unknown, fallback: string[], n: number): string[] =>
      Array.isArray(v) ? [...v.map(String).filter((x) => x.trim()).slice(0, n), ...fallback].slice(0, n) : fallback;
    return {
      ...base,
      color: typeof src.color === 'string' ? src.color : base.color,
      archetype: typeof src.archetype === 'string' ? src.archetype : base.archetype,
      lore: {
        tagline: typeof src.lore?.tagline === 'string' ? src.lore.tagline : base.lore.tagline,
        personality: typeof src.lore?.personality === 'string' ? src.lore.personality : base.lore.personality,
        backstory: typeof src.lore?.backstory === 'string' ? src.lore.backstory : base.lore.backstory,
      },
      winQuotes: lines(src.winQuotes, base.winQuotes, 3),
      vo: {
        kiai: lines(src.vo?.kiai, base.vo.kiai, 6),
        hurt: lines(src.vo?.hurt, base.vo.hurt, 6),
        victory: lines(src.vo?.victory, base.vo.victory, 4),
      },
      specials: cleanSpecials(src.specials, base.specials).slice(0, 4),
      specialPool: cleanSpecials(src.specialPool, base.specialPool).slice(0, 8),
      physics: { ...base.physics, ...(src.physics && typeof src.physics === 'object' ? src.physics : {}) },
      fatality: {
        id: slugify(String(src.fatality?.id ?? base.fatality.id)),
        name: String(src.fatality?.name ?? base.fatality.name),
        input: String(src.fatality?.input ?? base.fatality.input),
      },
      stagePrompt: typeof src.stagePrompt === 'string' ? src.stagePrompt : base.stagePrompt,
      musicPrompt: typeof src.musicPrompt === 'string' ? src.musicPrompt : base.musicPrompt,
    };
  }

  private ensureStageDefaults(): void {
    this.m.inputs.stageMode ??= this.m.inputs.stageId ? 'existing' : 'generated';
    if (this.m.inputs.stageMode === 'generated') {
      this.m.inputs.stageId ||= `${this.m.id}-home`;
      this.m.inputs.stageName ||= `${this.m.inputs.name.toUpperCase()} HOME`;
    }
  }

  private stageLabel(): string {
    this.ensureStageDefaults();
    if (this.m.inputs.stageMode === 'none') return 'none (uses RANDOM/default)';
    if (this.m.inputs.stageMode === 'existing') {
      const st = STAGES.find((s) => s.id === this.m.inputs.stageId);
      return st ? `existing → ${st.name}` : `existing → ${this.m.inputs.stageId ?? '(choose one)'}`;
    }
    return `generated → ${this.m.inputs.stageName || this.m.inputs.stageId}`;
  }

  private async loadExistingStagePreview(stageId: string): Promise<void> {
    const st = STAGES.find((s) => s.id === stageId);
    if (!st) return;
    try {
      const r = await fetch(st.file);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const dataUrl = await new Promise<string>((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.readAsDataURL(blob);
      });
      this.m.jobs.set('stage', { key: 'stage', kind: 'stage', label: st.name, status: 'done', approved: true, dataUrl, savedAs: 'stage.jpg' });
      this.updateBackdrop();
      this.renderTray();
      this.redrawPreview();
    } catch (e) {
      this.logMsg(`stage preview failed for ${stageId}: ${String(e)}`);
    }
  }

  // ── D2 · PROFILE ─────────────────────────────────────────────────────────
  private renderProfile(): void {
    this.ensureDraft();
    this.ensureStageDefaults();
    const d = this.m.draft!;
    this.h('Profile & stage', 'Edit the auto-draft while the base sprites bake below. Upload a stage + voice sample.');

    const two = el('div', 'display:flex;gap:20px;flex-wrap:wrap;');
    const colA = el('div', 'flex:1;min-width:240px;');
    const colB = el('div', 'flex:1;min-width:240px;');
    two.append(colA, colB);
    this.bodyEl.appendChild(two);

    // col A — identity. Archetype is a dropdown (recommended pre-selected); picking
    // a different one re-rolls the default special kit to match.
    const arch = this.field('Archetype · color');
    const row = el('div', 'display:flex;align-items:center;gap:8px;');
    const sel = el('select', INPUT + 'flex:1;cursor:pointer;') as HTMLSelectElement;
    for (const a of ARCHETYPE_INFO) {
      const opt = el('option', '', `${a.label} — ${a.desc}`) as HTMLOptionElement;
      opt.value = a.key; if (a.key === d.archetype) opt.selected = true;
      sel.appendChild(opt);
    }
    if (!ARCHETYPE_INFO.some((a) => a.key === d.archetype)) { const o = el('option', '', d.archetype) as HTMLOptionElement; o.value = d.archetype; o.selected = true; sel.appendChild(o); }
    const sw = el('span', `flex:0 0 auto;width:16px;height:16px;border-radius:3px;background:${d.color};`);
    row.append(sel, sw); arch.appendChild(row);
    const desc = el('div', 'font-size:11px;color:#8fa6b2;margin-top:4px;', ARCHETYPE_INFO.find((a) => a.key === d.archetype)?.desc ?? '');
    arch.appendChild(desc);
    sel.onchange = () => {
      d.archetype = sel.value;
      d.specials = specialsForArchetype(sel.value); // re-roll the default kit to match
      desc.textContent = ARCHETYPE_INFO.find((a) => a.key === sel.value)?.desc ?? '';
      this.logMsg('archetype → ' + sel.value + ' (special kit re-rolled)');
    };
    colA.appendChild(arch);

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
      () => { void this.genStage(); this.renderTray(); }));
    // just the generate button here; the editable prompt + regenerate live on the
    // frame inspector (click the stage cell in the tray), like every other frame.
    const sjob = this.m.job('stage');
    const stageW = this.field('Home stage');
    const mode = el('select', INPUT + 'cursor:pointer;margin-bottom:6px;') as HTMLSelectElement;
    for (const [value, label] of [
      ['generated', 'Generate a new home stage'],
      ['existing', 'Assign an existing stage'],
      ['none', 'No home stage'],
    ] as const) {
      const o = el('option', '', label) as HTMLOptionElement;
      o.value = value; if (this.m.inputs.stageMode === value) o.selected = true;
      mode.appendChild(o);
    }
    mode.onchange = () => {
      this.m.inputs.stageMode = mode.value as CreatorModel['inputs']['stageMode'];
      if (this.m.inputs.stageMode === 'generated') {
        this.m.inputs.stageId ||= `${this.m.id}-home`;
        this.m.inputs.stageName ||= `${this.m.inputs.name.toUpperCase()} HOME`;
      } else if (this.m.inputs.stageMode === 'existing') {
        this.m.inputs.stageId = this.m.inputs.stageId && STAGES.some((s) => s.id === this.m.inputs.stageId)
          ? this.m.inputs.stageId
          : STAGES[0]?.id;
        this.m.inputs.stageName = STAGES.find((s) => s.id === this.m.inputs.stageId)?.name;
        if (this.m.inputs.stageId) void this.loadExistingStagePreview(this.m.inputs.stageId);
      }
      this.render();
    };
    stageW.appendChild(mode);
    if (this.m.inputs.stageMode === 'existing') {
      const existing = el('select', INPUT + 'cursor:pointer;margin-bottom:6px;') as HTMLSelectElement;
      for (const st of STAGES) {
        const o = el('option', '', `${st.name} (${st.id})`) as HTMLOptionElement;
        o.value = st.id; if (st.id === this.m.inputs.stageId) o.selected = true;
        existing.appendChild(o);
      }
      existing.onchange = () => {
        this.m.inputs.stageId = existing.value;
        this.m.inputs.stageName = STAGES.find((s) => s.id === existing.value)?.name;
        void this.loadExistingStagePreview(existing.value);
        this.render();
      };
      stageW.appendChild(existing);
    } else if (this.m.inputs.stageMode === 'generated') {
      const idRow = el('div', 'display:flex;gap:6px;margin-bottom:6px;');
      const idI = el('input', INPUT + 'flex:1;') as HTMLInputElement;
      idI.value = this.m.inputs.stageId ?? `${this.m.id}-home`;
      idI.placeholder = 'stage id, e.g. mirage-home';
      idI.oninput = () => (this.m.inputs.stageId = slugify(idI.value));
      const nameI = el('input', INPUT + 'flex:1;') as HTMLInputElement;
      nameI.value = this.m.inputs.stageName ?? `${this.m.inputs.name.toUpperCase()} HOME`;
      nameI.placeholder = 'display name, e.g. MIRAGE HOME';
      nameI.oninput = () => (this.m.inputs.stageName = nameI.value.toUpperCase());
      idRow.append(idI, nameI);
      stageW.appendChild(idRow);
    }
    const sbtn = el('button', BTN_HOT + 'font-size:12px;',
      sjob?.status === 'running' ? '◐ generating stage…' : sjob?.status === 'done' ? '↻ Regenerate stage' : '▸ Generate stage');
    sbtn.onclick = () => void this.genStage();
    if (this.m.inputs.stageMode === 'generated') stageW.appendChild(sbtn);
    if (sjob?.status === 'done') stageW.appendChild(el('div', 'font-size:11px;color:#8fa6b2;margin-top:6px;', `${this.stageLabel()} · click the stage cell in the tray to inspect/regenerate`));
    else stageW.appendChild(el('div', 'font-size:11px;color:#8fa6b2;margin-top:6px;', this.stageLabel()));
    colB.appendChild(stageW);
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
    const musRow = el('div', 'display:flex;align-items:center;gap:6px;margin-top:6px;');
    musRow.append(el('span', 'font-size:11px;color:#9fb4be;', 'stage theme:'), this.audioChip(() => this.m.finalMusic(), (b) => (this.m.generatedMusic = b), `${this.m.id}-theme.mp3`));
    audio.appendChild(musRow);
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

  private playBtn(clip: string): HTMLDivElement {
    return this.audioChip(() => this.m.finalVoClips()[clip], (b) => (this.m.generatedVo[clip] = b), `${this.m.id}-${clip}.mp3`);
  }

  /** play + download + drop-to-replace(BYO) for one audio sample (base64 mp3). */
  private audioChip(get: () => string | undefined, set: (b64: string) => void, filename: string): HTMLDivElement {
    const wrap = el('div', 'display:inline-flex;align-items:center;gap:3px;border-radius:4px;');
    const has = !!get();
    const play = el('button', BTN + `padding:4px 7px;font-size:11px;${has ? '' : 'opacity:.4;'}`, '▶');
    play.title = has ? 'play' : 'not generated';
    play.onclick = () => { const b = get(); if (b) new Audio('data:audio/mp3;base64,' + b).play().catch(() => {}); };
    const dl = el('button', BTN + `padding:4px 7px;font-size:11px;${has ? '' : 'opacity:.4;'}`, '⤓');
    dl.title = 'download ' + filename;
    dl.onclick = () => { const b = get(); if (!b) return; const a = document.createElement('a'); a.href = 'data:audio/mp3;base64,' + b; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); };
    const inp = el('input', 'display:none;') as HTMLInputElement; inp.type = 'file'; inp.accept = 'audio/*';
    const take = async (f?: File): Promise<void> => { if (!f) return; const d = await readFile(f); set(d.includes(',') ? d.split(',')[1] : d); this.logMsg(`BYO audio → ${filename}`); this.render(); };
    inp.onchange = () => void take(inp.files?.[0]);
    const up = el('button', BTN + 'padding:4px 7px;font-size:11px;', '⤒');
    up.title = 'BYO — upload an audio file (or drop one onto these controls)';
    up.onclick = () => inp.click();
    wrap.ondragover = (e) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); wrap.style.outline = '2px solid #7fe3ff'; } };
    wrap.ondragleave = () => { wrap.style.outline = ''; };
    wrap.ondrop = (e) => { e.preventDefault(); wrap.style.outline = ''; void take(e.dataTransfer?.files?.[0]); };
    wrap.append(play, dl, up, inp);
    return wrap;
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

  // ── D3 · MOVES (attack sprites + specials editor, combined) ───────────────
  private renderMoves(): void {
    this.ensureDraft();
    this.h('Moves & specials', 'Distinct startup/active/recovery frames per normal + special (jump moves ref the jump image, crouch the crouch image, standing/specials the canonical). Play any move top-left; click a tray cell to inspect/scale/regen.');
    const cells = this.m.allAttackCells();
    const total = cells.length;
    const done = cells.filter((c) => this.m.job('sprite:' + c.name)?.status === 'done').length;
    const run = el('button', BTN_HOT + 'font-size:13px;', done ? `↻ Continue attack frames (${done}/${total})` : `▸ Generate all attack frames (${total} cells, 5 at a time)`);
    run.onclick = () => this.genAttacks();
    this.bodyEl.appendChild(run);
    this.bodyEl.appendChild(el('div', 'font-size:11px;color:#8fa6b2;margin:8px 0 14px;',
      `${done}/${total} frames generated. Un-generated moves reuse the idle pose in-game; grab a single one from its ghost slot in the tray.`));
    this.bodyEl.appendChild(el('div', 'font-size:12px;font-weight:bold;color:#bff0ff;margin-bottom:8px;', 'Specials'));
    const d = this.m.draft!;
    d.specials.forEach((s, i) => {
      const box = el('div', 'border:1px solid #22303e;border-radius:6px;padding:10px 12px;margin-bottom:10px;background:#0b1119;');
      const top = el('div', 'display:flex;gap:8px;align-items:center;margin-bottom:6px;');
      const name = el('input', INPUT + 'flex:2;font-size:13px;') as HTMLInputElement;
      name.value = s.name; name.oninput = () => (s.name = name.value);
      name.onchange = () => this.renameSpecial(s, name.value.trim() || s.name); // commit id rename on blur
      name.title = 'rename — the move id, cells, frames and player button follow the new name';
      // archetype dropdown (full catalog)
      const arch = el('select', INPUT + 'flex:2;cursor:pointer;font-size:12px;') as HTMLSelectElement;
      for (const a of SPECIAL_ARCHETYPES) { const o = el('option', '', a.label) as HTMLOptionElement; o.value = a.key; if (a.key === s.archetype) o.selected = true; arch.appendChild(o); }
      // controls dropdown (archetype-sensible inputs)
      const ctrl = el('select', INPUT + 'flex:1;cursor:pointer;font-size:12px;') as HTMLSelectElement;
      const fillCtrl = (): void => {
        ctrl.replaceChildren();
        const opts = [...(SPECIAL_ARCHETYPES.find((a) => a.key === s.archetype)?.controls ?? ['qcf+P'])];
        if (s.controls && !opts.includes(s.controls)) opts.unshift(s.controls);
        for (const c of opts) { const o = el('option', '', c) as HTMLOptionElement; o.value = c; if (c === s.controls) o.selected = true; ctrl.appendChild(o); }
      };
      fillCtrl();
      const info = el('div', 'font-size:11px;color:#8fa6b2;margin-top:2px;', SPECIAL_ARCHETYPES.find((a) => a.key === s.archetype)?.desc ?? '');
      arch.onchange = () => {
        s.archetype = arch.value; s.controls = controlsForArchetype(arch.value);
        fillCtrl(); info.textContent = SPECIAL_ARCHETYPES.find((a) => a.key === s.archetype)?.desc ?? '';
      };
      ctrl.onchange = () => (s.controls = ctrl.value);
      top.append(el('span', 'font-size:11px;color:#5c6b78;width:14px;', String(i + 1)), name, arch, ctrl);
      box.append(top, info);
      // editable flavor description — drives the projectile art + active-frame prompt
      const descIn = el('input', INPUT + 'font-size:11px;margin-top:5px;') as HTMLInputElement;
      descIn.value = s.description; descIn.placeholder = 'description — what it looks like (used for the projectile + special art)';
      descIn.oninput = () => (s.description = descIn.value);
      box.appendChild(descIn);
      // swap for one of the extra drafted moves (pool) + approve gate
      const ctrlRow = el('div', 'display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;');
      const pool = this.m.draft!.specialPool;
      if (pool.length) {
        const swap = el('select', INPUT + 'flex:1;min-width:150px;cursor:pointer;font-size:11px;') as HTMLSelectElement;
        const ph0 = el('option', '', '↔ swap for a drafted move…') as HTMLOptionElement; ph0.value = ''; swap.appendChild(ph0);
        for (const p of pool) { const o = el('option', '', `${p.name} — ${p.description}`) as HTMLOptionElement; o.value = p.id; swap.appendChild(o); }
        swap.onchange = () => {
          const idx = pool.findIndex((p) => p.id === swap.value); if (idx < 0) return;
          const incoming = pool[idx], outgoing = this.m.draft!.specials[i];
          this.m.draft!.specials[i] = { ...incoming, approved: false }; // fresh move — re-approve
          pool[idx] = { ...outgoing, approved: false }; // old goes back to the pool
          this.logMsg(`special ${i + 1}: swapped → ${incoming.name}`);
          this.render();
        };
        ctrlRow.appendChild(swap);
      }
      const appr = el('button', (s.approved ? BTN_HOT : BTN) + 'font-size:11px;', s.approved ? '✓ approved' : 'Approve');
      appr.onclick = () => { s.approved = !s.approved; this.render(); };
      ctrlRow.appendChild(appr);
      box.appendChild(ctrlRow);
      // per-special sprite status + generate — gated on approval
      const phases = ['startup', 'active', 'recovery'].map((ph) => this.m.job(`sprite:${s.id}-${ph}`)?.status === 'done');
      const doneN = phases.filter(Boolean).length;
      const gen = el('button', (s.approved ? BTN : BTN + 'opacity:.4;pointer-events:none;') + 'font-size:11px;margin-top:8px;',
        !s.approved ? '▸ approve first to generate' : doneN === 3 ? '↻ regen sprites' : `▸ generate sprites (${doneN}/3)`);
      gen.onclick = () => this.genSpecialCells(s.id);
      box.appendChild(gen);
      // projectile art slot — only for approved projectile-archetype specials.
      // Just the thumbnail + a generate/inspect button here; the prompt, size,
      // spawn and auto-hitbox all live on the frame inspector (click the thumb).
      if (isProjectileArchetypeKey(s.archetype) && s.approved) {
        const pj = this.m.job('proj:' + s.id);
        const prow = el('div', 'display:flex;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px dashed #22303e;');
        prow.appendChild(el('span', 'font-size:11px;color:#9fb4be;', 'projectile:'));
        if (pj?.dataUrl) {
          const im = el('img', 'width:44px;height:44px;object-fit:contain;border:1px solid #22303e;border-radius:4px;cursor:pointer;') as HTMLImageElement;
          im.src = pj.dataUrl; im.title = 'click to inspect — prompt · size · spawn · auto-hitbox';
          im.onclick = () => this.selectCell('proj:' + s.id);
          prow.appendChild(im);
        } else { const ph = el('div', 'width:44px;height:44px;border:1px dashed #3f5266;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#5c6b78;font-size:18px;', '+'); prow.appendChild(ph); }
        const pbtn = el('button', BTN + 'font-size:11px;', pj?.status === 'running' ? '◐ …' : pj?.status === 'done' ? '⤢ inspect / tune' : '▸ generate projectile');
        pbtn.onclick = () => pj?.status === 'done' ? this.selectCell('proj:' + s.id) : void this.genProjectile(s);
        prow.appendChild(pbtn);
        box.appendChild(prow);
      }
      // per-move audio call-out — a spoken VO line or an SFX, generated or BYO,
      // played when the special fires (sets move.voice=true in the JSON)
      const arow = el('div', 'display:flex;gap:6px;align-items:center;margin-top:8px;padding-top:8px;border-top:1px dashed #22303e;flex-wrap:wrap;');
      arow.appendChild(el('span', 'font-size:11px;color:#9fb4be;', 'call-out:'));
      const atext = el('input', INPUT + 'flex:1;min-width:120px;font-size:11px;') as HTMLInputElement;
      atext.placeholder = 'VO line (e.g. "Sand storm!") or an SFX description';
      atext.value = this.moveAudioText[s.id] ?? s.name;
      atext.oninput = () => (this.moveAudioText[s.id] = atext.value);
      const vbtn = el('button', BTN + 'font-size:11px;', '▸ voice');
      vbtn.onclick = () => this.genMoveAudio(s.id, atext.value, 'voice');
      const sbtn = el('button', BTN + 'font-size:11px;', '▸ sfx');
      sbtn.onclick = () => this.genMoveAudio(s.id, atext.value, 'sfx');
      arow.append(atext, vbtn, sbtn, this.audioChip(() => this.m.moveAudio[s.id], (b) => (this.m.moveAudio[s.id] = b), `${this.m.id}-move-${s.id}.mp3`));
      box.appendChild(arow);
      this.bodyEl.appendChild(box);
    });
    const nav = el('div', 'margin-top:8px;display:flex;gap:10px;');
    const bk = el('button', BTN, '‹ Back'); bk.onclick = () => this.goto(this.m.step - 1);
    const nx = el('button', BTN_HOT, 'Next ▸'); nx.onclick = () => this.goto(this.m.step + 1);
    nav.append(bk, nx); this.bodyEl.appendChild(nav);
  }

  /** the projectile-art prompt, written from the special's + character's description. */
  private projectilePrompt(name: string, desc: string): string {
    const color = this.m.draft?.color ?? 'bright';
    const who = this.m.inputs.description ? ` fired by a ${this.m.inputs.description}` : '';
    return `A fighting-game projectile${who} — the special move "${name}": ${desc}. Depict it as a ${color} ` +
      `keyable energy/FX effect, side view travelling to the RIGHT, dynamic, NO character, NO hands, NO background scenery. ` +
      `Solid flat chroma-key green (#00B140) background, completely uniform, no shadow, no text, no border.`;
  }

  /** rename a special: sync its id so cells, on-disk frames, the player button
   *  and the JSON move key all follow the new name (migrates any generated cells). */
  private renameSpecial(s: SpecialDraft, newName: string): void {
    s.name = newName;
    const oldId = s.id;
    let newId = slugify(newName);
    if (!newId || newId === oldId) { this.render(); this.renderPreviewControls(); return; }
    const taken = new Set([...BASE_MOVE_IDS, ...this.m.draft!.specials.filter((x) => x !== s).map((x) => x.id)]);
    if (taken.has(newId)) { let n = 2; while (taken.has(`${newId}-${n}`)) n++; newId = `${newId}-${n}`; }
    const rekey = (oldKey: string, newKey: string, cellLabel?: string): void => {
      const j = this.m.jobs.get(oldKey); if (!j) return;
      this.m.jobs.delete(oldKey);
      j.key = newKey; if (cellLabel) j.label = cellLabel; j.savedAs = undefined;
      this.m.jobs.set(newKey, j);
    };
    s.id = newId; // set before persistFrame so frameNameFor uses the new id
    for (const ph of ['startup', 'active', 'recovery']) rekey(`sprite:${oldId}-${ph}`, `sprite:${newId}-${ph}`, `${newId}-${ph}`);
    rekey(`proj:${oldId}`, `proj:${newId}`, `${newName} projectile`);
    for (const ph of ['startup', 'active', 'recovery']) void this.persistFrame(`sprite:${newId}-${ph}`);
    void this.persistFrame(`proj:${newId}`);
    // migrate the per-move call-out audio + text
    if (this.m.moveAudio[oldId]) { this.m.moveAudio[newId] = this.m.moveAudio[oldId]; delete this.m.moveAudio[oldId]; }
    if (this.moveAudioText[oldId]) { this.moveAudioText[newId] = this.moveAudioText[oldId]; delete this.moveAudioText[oldId]; }
    // if this move was being previewed, follow it
    if (this.preview.kind === 'group' && this.preview.key === oldId) this.preview.key = newId;
    this.logMsg(`renamed special ${oldId} → ${newId} (cells + frames migrated)`);
    this.render(); this.renderPreviewControls(); this.renderTray(); this.redrawPreview();
  }

  /** generate a per-move call-out: a spoken VO line or an SFX (ElevenLabs). */
  private async genMoveAudio(id: string, text: string, kind: 'voice' | 'sfx'): Promise<void> {
    if (!text.trim()) return;
    this.logMsg(`▸ ${kind} call-out for ${id}…`);
    try {
      const r = await fetch('/__editor/creator/move-audio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, text, name: this.m.inputs.name, fishModelId: kind === 'voice' ? this.m.voiceModelId : undefined }),
      });
      const j = (await r.json()) as { ok?: boolean; mock?: boolean; base64?: string; error?: string };
      if (!j.ok) throw new Error(j.error ?? 'failed');
      if (j.base64) { this.m.moveAudio[id] = j.base64; this.logMsg(`✓ ${kind} call-out for ${id}`); }
      else if (j.mock) this.logMsg(`${kind} ${id} mock (no ELEVENLABS_API_KEY)`);
    } catch (e) { this.logMsg(`✕ ${kind} ${id} — ${String(e)}`); }
    this.render();
  }

  /** a labelled range slider row (reused by projectile tuning). */
  private sliderRow(label: string, get: () => number, set: (v: number) => void, min: number, max: number, step: number, fmt: (v: number) => string, onChange: () => void): HTMLDivElement {
    const row = el('div', 'display:flex;align-items:center;gap:8px;margin-bottom:5px;');
    const lbl = el('span', 'font-size:11px;color:#9fb4be;white-space:nowrap;width:74px;', `${label} ${fmt(get())}`);
    const r = el('input', 'flex:1;') as HTMLInputElement;
    r.type = 'range'; r.min = String(min); r.max = String(max); r.step = String(step); r.value = String(get());
    r.oninput = () => { set(parseFloat(r.value)); lbl.textContent = `${label} ${fmt(get())}`; onChange(); };
    row.append(lbl, r); return row;
  }

  /** fit a square collision box around the projectile's visible (non-transparent) pixels. */
  private async autoProjBox(s: SpecialDraft): Promise<void> {
    const job = this.m.job('proj:' + s.id); if (!job?.dataUrl) return;
    const img = await this.loadImg(job.dataUrl);
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let minX = c.width, minY = c.height, maxX = 0, maxY = 0, any = false;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 25) { any = true; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    if (!any) { this.logMsg('proj auto-hitbox: image is empty'); return; }
    // convert image-px → engine-px on the SAME basis drawProjectile uses: the art
    // is drawn so its max dimension = 72·projScale world px, so k scales alpha
    // extents into that world. Square the box to the larger side, CENTER it on the
    // alpha centroid (art is rarely centered), so it wraps the visible pixels.
    const world = 72 * (s.projScale ?? 1);
    const k = world / Math.max(c.width, c.height);
    const bw = (maxX - minX + 1) * k, bh = (maxY - minY + 1) * k;
    const side = Math.max(12, Math.round(Math.max(bw, bh)));
    const offX = ((minX + maxX) / 2 - c.width / 2) * k; // alpha centroid, engine px from center
    const offY = ((minY + maxY) / 2 - c.height / 2) * k;
    s.projBox = { x: Math.round(offX - side / 2), y: Math.round(offY - side / 2), w: side, h: side };
    this.logMsg(`proj auto-hitbox for ${s.id}: ${side}² around the alpha`);
    this.render();
  }

  /** the projectile prompt actually sent: the special's edited override if set,
   *  else the auto one written from its description. */
  private effectiveProjPrompt(s: SpecialDraft): string {
    return s.projPrompt?.trim() || this.projectilePrompt(s.name, s.description);
  }

  /** generate (or regenerate) the home-stage backdrop from the editable stage
   *  prompt + the dropped landscape photo (if any). Text-only works with no photo. */
  private async genStage(): Promise<void> {
    this.ensureStageDefaults();
    if (this.m.inputs.stageMode !== 'generated') {
      this.logMsg('stage: switch Home stage to "Generate a new home stage" first');
      return;
    }
    if (this.m.job('stage')?.status === 'running') return;
    const prompt = this.m.draft?.stagePrompt?.trim();
    if (!prompt) { this.logMsg('stage: add a prompt first'); return; }
    const u = this.m.inputs.stagePhotos?.[0]?.dataUrl;
    const refs = u ? [dataUrlToB64(u)!].filter(Boolean) : [];
    await this.fireGen('stage', 'stage', 'Stage', prompt, refs);
    if (CREATOR_STEPS[this.m.step] === 'PROFILE') this.render();
  }

  /** generate the projectile art for a projectile special (inspo-free, keyable FX). */
  private async genProjectile(s: SpecialDraft): Promise<void> {
    await this.fireGen('proj:' + s.id, 'sprite', s.name + ' projectile', this.effectiveProjPrompt(s), []);
    if (CREATOR_STEPS[this.m.step] === 'MOVES') this.render(); // reveal the tuning sliders + prompt
  }

  /** generate one special's frames — projectile-first, then the ACTIVE frame that
   *  references the projectile, then startup/recovery referencing the active frame
   *  (the pipeline's sequential special chain). Non-projectile specials just chain
   *  active → startup/recovery off the canonical. */
  private async genSpecial(s: SpecialDraft): Promise<void> {
    const nm = this.m.inputs.name, id = s.id, isProj = isProjectileArchetypeKey(s.archetype);
    let projRef: string | undefined;
    if (isProj) {
      if (this.m.job('proj:' + id)?.status !== 'done') await this.fireGen('proj:' + id, 'sprite', s.name + ' projectile', this.effectiveProjPrompt(s), []);
      projRef = dataUrlToB64(this.m.job('proj:' + id)?.dataUrl);
    }
    // active — references the projectile so the fighter is shown releasing it
    const canon = await this.refFor('canonical');
    const activePose = isProj
      ? `SHOOTING the projectile of the special "${s.name}" (${s.description}): a full throwing/casting motion — the front arm fully extended forward, body coiled behind the release, hand open, and the projectile shown in the reference image LAUNCHING from the hand and travelling to the RIGHT (draw the projectile only just leaving the hand, still inside the frame)`
      : `performing the special "${s.name}" (${s.description}) at the moment of release/impact — a dynamic, committed action pose`;
    await this.fireGen(`sprite:${id}-active`, 'sprite', `${id}-active`, SPRITE_PROMPT(nm, activePose), isProj && projRef ? [...canon, projRef] : canon);
    // startup + recovery reference the finished active frame for consistency
    const activeImg = dataUrlToB64(this.m.job(`sprite:${id}-active`)?.dataUrl);
    const chain = activeImg ? [activeImg] : canon;
    await this.fireGen(`sprite:${id}-startup`, 'sprite', `${id}-startup`, SPRITE_PROMPT(nm, `the frame just BEFORE the active pose of "${s.name}" — winding up, gathering power`), chain);
    await this.fireGen(`sprite:${id}-recovery`, 'sprite', `${id}-recovery`, SPRITE_PROMPT(nm, `the frame just AFTER the active pose of "${s.name}" — recovering, settling back toward neutral`), chain);
  }

  /** per-special button: run the full chain (projectile-first) for one special. */
  private async genSpecialCells(id: string): Promise<void> {
    const s = this.m.draft?.specials.find((x) => x.id === id);
    if (s) await this.genSpecial(s);
    if (CREATOR_STEPS[this.m.step] === 'MOVES') this.render(); // refresh the N/3 count
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
    const desc = this.m.inputs.description || this.m.inputs.name;
    const photoRefs = (this.m.inputs.referencePhotos ?? []).map((p) => dataUrlToB64(p.dataUrl)).filter(Boolean) as string[];
    const portraitRefs = photoRefs.length > 1 ? [photoRefs[1], ...photoRefs.filter((_, i) => i !== 1)] : photoRefs;
    const portW = this.field('Portraits');
    const row = el('div', 'display:flex;gap:10px;flex-wrap:wrap;align-items:center;');
    const addAsset = (key: 'portrait' | 'ko', label: string, prompt: string): void => {
      const j = this.m.job(key);
      const b = el('button', (j?.status === 'done' ? BTN : BTN_HOT) + 'font-size:11px;',
        j?.status === 'running' ? '◐ ' + label : j?.status === 'done' ? '↻ Regenerate ' + label : '▸ Generate ' + label);
      b.onclick = () => this.fireGen(key, key, label, prompt, portraitRefs);
      row.appendChild(b);
      if (j?.dataUrl) {
        const im = el('img', 'width:48px;height:48px;object-fit:contain;border:1px solid #22303e;border-radius:4px;cursor:pointer;background:#0b1119;') as HTMLImageElement;
        im.src = j.dataUrl; im.title = 'inspect ' + label; im.onclick = () => this.selectCell(key);
        row.appendChild(im);
      }
    };
    addAsset('portrait', 'Portrait', PORTRAIT_PROMPT(this.m.inputs.name, desc));
    addAsset('ko', 'KO portrait', KO_PROMPT(this.m.inputs.name, desc));
    const bustBtn = el('button', BTN + 'font-size:11px;', '✓ Bust crops from canonical on ZIP/WRITE');
    bustBtn.title = 'The neutral bust is generated locally from the canonical during export/write; regenerate or realign the canonical if the crop is wrong.';
    row.appendChild(bustBtn);
    portW.appendChild(row);
    this.bodyEl.appendChild(portW);

    const fatW = this.field('Fatality — ' + this.m.draft!.fatality.name + ' (' + this.m.draft!.fatality.input + ')');
    const fatBtn = el('button', BTN_HOT + 'font-size:12px;',
      this.m.fatalityStatus === 'running' ? '◐ generating panels…' : this.m.fatalityStatus === 'done' ? '✓ 4 panels ready — regenerate' : '▸ Generate fatality (4 panels)');
    fatBtn.onclick = () => this.genFatality();
    fatW.appendChild(fatBtn);
    // per-panel editable beat + thumbnail + single-panel reroll (like sprite cells)
    this.ensureFatalityBeats();
    const panels = el('div', 'margin-top:10px;display:flex;flex-direction:column;gap:8px;');
    for (let i = 0; i < 4; i++) {
      const row = el('div', 'display:flex;gap:8px;align-items:flex-start;border:1px solid #22303e;border-radius:6px;padding:8px;background:#0b1119;');
      const img = this.m.generatedFatality[i];
      if (img) { const im = el('img', 'width:120px;height:68px;object-fit:cover;border:1px solid #22303e;border-radius:4px;flex:0 0 auto;') as HTMLImageElement; im.src = 'data:image/jpeg;base64,' + img; row.appendChild(im); }
      else row.appendChild(el('div', 'width:120px;height:68px;border:1px dashed #3f5266;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#5c6b78;font-size:11px;flex:0 0 auto;', 'panel ' + (i + 1)));
      const col = el('div', 'flex:1;min-width:0;');
      const ta = el('textarea', INPUT + 'height:52px;font-size:10px;line-height:1.35;') as HTMLTextAreaElement;
      ta.value = this.m.fatalityBeats[i] ?? '';
      ta.placeholder = `panel ${i + 1} beat — what happens in this cutscene frame`;
      ta.oninput = () => (this.m.fatalityBeats[i] = ta.value);
      const rr = el('button', BTN + 'font-size:10px;margin-top:5px;', this.m.fatalityStatus === 'running' ? '◐ …' : '↻ reroll panel ' + (i + 1));
      rr.onclick = () => this.genFatality(i);
      col.append(ta, rr);
      row.appendChild(col);
      panels.appendChild(row);
    }
    fatW.appendChild(panels);
    this.bodyEl.appendChild(fatW);
    this.bodyEl.appendChild(el('div', 'font-size:11px;color:#8fa6b2;margin-bottom:12px;',
      'VO and stage music were generated earlier (Seed/Profile). Un-generated fatality = no FINISH THEM (degrades gracefully).'));
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
    this.ensureStageDefaults();
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
      `fatality: ${fatReady ? fatReady + ' panels' : 'none (omitted)'} · stage: ${stageReady || this.m.inputs.stageMode !== 'generated' ? this.stageLabel() : 'generated art pending'} · voice: ${this.m.voiceModelId ? 'cloned' : 'stock'}`));
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

  /** the roster BUST (<id>-bust.png): the canonical cropped to the centered head
   *  + shoulders (the pipeline's portrait_crop.py, done in-browser off the alpha
   *  silhouette instead of DWPose head keypoints). Square PNG base64, or undefined
   *  if there's no canonical to crop. */
  private async bustFromCanonical(): Promise<string | undefined> {
    const canon = this.m.job('canonical'); if (!canon?.dataUrl) return undefined;
    const img = await this.loadImg(canon.dataUrl);
    const W = img.naturalWidth, H = img.naturalHeight;
    const src = document.createElement('canvas'); src.width = W; src.height = H;
    const sctx = src.getContext('2d')!; sctx.drawImage(img, 0, 0);
    const data = sctx.getImageData(0, 0, W, H).data;
    // figure vertical extent + the horizontal center of the top head-band
    let headTop = -1, soleY = -1;
    for (let y = 0; y < H && headTop < 0; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 25) { headTop = y; break; }
    for (let y = H - 1; y >= 0 && soleY < 0; y--) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 25) { soleY = y; break; }
    if (headTop < 0 || soleY <= headTop) return dataUrlToB64(canon.dataUrl); // empty/degenerate — fall back to raw
    const figH = soleY - headTop;
    // head+shoulders ≈ top third of the figure; center on the head-band's alpha centroid
    const band = Math.max(2, Math.round(figH * 0.14));
    let sum = 0, n = 0;
    for (let y = headTop; y < headTop + band; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 25) { sum += x; n++; }
    const cx = n ? sum / n : W / 2;
    const side = Math.min(Math.max(W, H), Math.round(figH * 0.42));
    const top = Math.max(0, headTop - Math.round(side * 0.12));
    let left = Math.round(cx - side / 2);
    left = Math.max(0, Math.min(left, W - side));
    const OUT = 512;
    const out = document.createElement('canvas'); out.width = OUT; out.height = OUT;
    out.getContext('2d')!.drawImage(src, left, top, side, Math.min(side, H - top), 0, 0, OUT, OUT * Math.min(side, H - top) / side);
    return out.toDataURL('image/png').split(',')[1];
  }

  private async composeSheet(): Promise<{ sheetBase64: string; meta: object } | null> {
    const plan = this.m.sheetPlan(); // { name, jobKey } for base + attack-phase + special cells
    if (!plan.length) return null;
    const cw = CELL_W, ch = CELL_H, cols = 6, rows = Math.ceil(plan.length / cols);
    const c = document.createElement('canvas'); c.width = cols * cw; c.height = rows * ch;
    const ctx = c.getContext('2d')!;
    for (let i = 0; i < plan.length; i++) {
      const job = this.m.job(plan[i].jobKey); const url = job?.dataUrl; if (!url) continue;
      const img = await this.loadImg(url);
      const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
      const s = job?.scale ?? 1, ox = job?.offX ?? 0, oy = job?.offY ?? 0;
      const dw = cw * s, dh = ch * s;
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, cw, ch); ctx.clip();
      ctx.drawImage(img, x + (cw - dw) / 2 + ox, y + (ch - dh) + oy, dw, dh); // scale about feet + realign
      ctx.restore();
    }
    // bake the local DWPose skeletons for the packed cells (F3 overlay in-game),
    // applying the SAME per-cell scale/offset the art got so joints track the moved
    // art (jx' = 144(1−s)+ox+jx·s ; jy' = 384(1−s)+oy+jy·s — the inverse of the
    // drawImage transform above)
    const skeletons: Record<string, Record<string, [number, number, number]>> = {};
    for (const p of plan) {
      const j = this.m.skeletons[p.name]; if (!j) continue;
      const job = this.m.job(p.jobKey);
      const s = job?.scale ?? 1, ox = job?.offX ?? 0, oy = job?.offY ?? 0;
      if (s === 1 && !ox && !oy) { skeletons[p.name] = j; continue; }
      const t: Record<string, [number, number, number]> = {};
      for (const k in j) t[k] = [144 * (1 - s) + ox + j[k][0] * s, 384 * (1 - s) + oy + j[k][1] * s, j[k][2]];
      skeletons[p.name] = t;
    }
    const meta: Record<string, unknown> = { cellW: cw, cellH: ch, cols, rows, frames: plan.map((p) => p.name) };
    if (Object.keys(skeletons).length) meta.skeletons = skeletons;
    return { sheetBase64: c.toDataURL('image/png').split(',')[1], meta };
  }

  // ── generation ─────────────────────────────────────────────────────────
  private async runBaseBatch(): Promise<void> {
    // resize baked in once: every base cell is conditioned on the same (scaled) canonical
    const refs = await this.refFor('canonical');
    for (const c of BASE_CELLS) {
      if (this.m.job('sprite:' + c.id)?.status === 'done') continue; // re-run failed/missing only
      this.fireGen('sprite:' + c.id, 'sprite', c.id, SPRITE_PROMPT(this.m.inputs.name, c.pose), refs);
    }
    this.render();
  }

  private reroll(key: string): void {
    const j = this.m.job(key); if (!j) return;
    this.fireGen(key, j.kind, j.label, (j.prompt ?? '') + ' (variation)', []);
  }

  /** a job's cell pixels with its per-cell scale/offX/offY BAKED IN (the same
   *  transform composeSheet applies) — shipped raw frames must carry the final
   *  cell pixels so the server-side packer reproduces the tuned sheet. */
  private async bakedCellB64(job: CreatorJob): Promise<string | null> {
    if (!job.dataUrl) return null;
    const s = job.scale ?? 1, ox = job.offX ?? 0, oy = job.offY ?? 0;
    if (s === 1 && !ox && !oy) return dataUrlToB64(job.dataUrl) ?? null;
    const img = await this.loadImg(job.dataUrl);
    const c = document.createElement('canvas'); c.width = CELL_W; c.height = CELL_H;
    const ctx = c.getContext('2d')!;
    const dw = CELL_W * s, dh = CELL_H * s;
    ctx.drawImage(img, (CELL_W - dw) / 2 + ox, (CELL_H - dh) + oy, dw, dh); // scale about feet + realign
    return c.toDataURL('image/png').split(',')[1];
  }

  /** the full build payload (shared by SHIP write + ZIP export). */
  private async buildPayload(): Promise<Record<string, unknown>> {
    this.ensureStageDefaults();
    await this.syncRawFrames();
    const sheet = await this.composeSheet();
    const projectiles: Record<string, string> = {};
    const rawFrames: Record<string, string> = {};
    for (const [key, job] of this.m.jobs) {
      if (!key.startsWith('proj:') || !job.dataUrl) continue;
      const b = dataUrlToB64(job.dataUrl); if (b) projectiles[key.slice('proj:'.length)] = b;
    }
    for (const [key, job] of this.m.jobs) {
      if ((!key.startsWith('sprite:') && !key.startsWith('proj:')) || !job.dataUrl) continue;
      const b = key.startsWith('sprite:') ? await this.bakedCellB64(job) : dataUrlToB64(job.dataUrl);
      if (b) rawFrames[this.savedAsFor(key, job)] = b;
    }
    const generatedStage = this.m.inputs.stageMode === 'generated';
    return {
      projectiles,
      rawFrames,
      id: this.m.id, name: this.m.inputs.name.toUpperCase(), def: this.m.buildFullCharacter(),
      sheetBase64: sheet?.sheetBase64, meta: sheet?.meta,
      portraitBase64: dataUrlToB64(this.m.job('portrait')?.dataUrl),
      koBase64: dataUrlToB64(this.m.job('ko')?.dataUrl),
      bustBase64: await this.bustFromCanonical(),
      voClips: this.m.finalVoClips(), musicBase64: this.m.finalMusic(), moveAudio: this.m.moveAudio,
      stageBase64: generatedStage ? dataUrlToB64(this.m.job('stage')?.dataUrl) : undefined,
      stageId: this.m.inputs.stageMode === 'none' ? undefined : this.m.inputs.stageId,
      stageName: this.m.inputs.stageName,
      fatalityPanels: this.m.generatedFatality.length ? this.m.generatedFatality : undefined,
    };
  }

  /** download a .zip of the current build + raw progress (playable out of the box). */
  private async exportZip(): Promise<void> {
    if (!this.m.inputs.name.trim()) { alert('Name your fighter first.'); return; }
    await this.syncRawFrames();
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

  private pickImportZip(): void {
    const inp = el('input', 'display:none;') as HTMLInputElement;
    inp.type = 'file'; inp.accept = '.zip,application/zip';
    inp.onchange = () => void this.importZip(inp.files?.[0]);
    document.body.appendChild(inp);
    inp.click();
    setTimeout(() => inp.remove(), 1000);
  }

  private async importZip(file?: File): Promise<void> {
    if (!file) return;
    this.logMsg('importing creator zip…');
    try {
      const d = await readFile(file);
      const zipBase64 = d.includes(',') ? d.split(',')[1] : d;
      const r = await fetch('/__editor/creator/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zipBase64 }),
      });
      const j = (await r.json()) as { ok?: boolean; id?: string; error?: string };
      if (!j.ok) throw new Error(j.error ?? 'import failed');
      this.logMsg('✓ imported ' + (j.id ?? 'fighter') + ' — reloading');
      window.location.reload();
    } catch (e) { this.logMsg('✕ import — ' + String(e)); alert('Import failed: ' + String(e)); }
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
    const s = job.scale ?? 1, ox = job.offX ?? 0, oy = job.offY ?? 0;
    if (s === 1 && !ox && !oy) return dataUrlToB64(job.dataUrl);
    const img = await this.loadImg(job.dataUrl);
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;
    const dw = W * s, dh = H * s;
    const square = Math.abs(W - H) < 4; // portrait: center; full-body cell: feet at bottom
    ctx.drawImage(img, (W - dw) / 2 + ox, (square ? (H - dh) / 2 : (H - dh)) + oy, dw, dh);
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
    // normals: pooled per-cell (each conditions on its base image)
    const normals: AttackCell[] = ATTACK_CELLS;
    const tasks = normals
      .filter((c) => this.m.job('sprite:' + c.name)?.status !== 'done') // re-run failed/missing only
      .map((c) => async () => {
        const refs = await this.refFor(c.ref);
        await this.fireGen('sprite:' + c.name, 'sprite', c.name, SPRITE_PROMPT(this.m.inputs.name, c.pose), refs);
      });
    this.render();
    await this.poolFire(tasks, 5);
    // specials: only APPROVED ones; sequential chain — projectile-first, then
    // active(ref proj) → startup/recovery(ref active)
    const unapproved = this.m.draft!.specials.filter((s) => !s.approved).length;
    if (unapproved) this.logMsg(`${unapproved} special(s) not approved — skipped (approve them on the specials list)`);
    for (const s of this.m.draft!.specials) {
      if (!s.approved) continue;
      const cells = ['startup', 'active', 'recovery'].map((ph) => this.m.job(`sprite:${s.id}-${ph}`)?.status === 'done');
      const projMissing = isProjectileArchetypeKey(s.archetype) && this.m.job('proj:' + s.id)?.status !== 'done';
      if (cells.every(Boolean) && !projMissing) continue; // fully done — skip
      await this.genSpecial(s);
    }
    this.render();
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
    const def = this.m.buildFullCharacter() as { hurtStand: { h: number }; spriteOffsetY?: number; moves: Record<string, { input?: unknown }> };
    for (const c of this.m.allAttackCells()) {
      if (!c.active) continue;
      const joints = this.m.skeletons[c.name]; if (!joints) continue;
      const kind = strikeKind(c.move, def.moves[c.move] as never);
      const box = hitboxFromSkeleton(joints, kind);
      if (!box) continue;
      // the SAME transform the Sprite Editor uses (src/render/geometry) — these
      // two hand-rolled copies drifted once before they were unified
      this.m.autoHitboxes[c.move] = cellBoxToHitbox(def, box);
    }
    if (render) this.render();
  }

  /** seed the editable per-panel beats from the default if they aren't set yet. */
  private ensureFatalityBeats(): void {
    if (this.m.fatalityBeats.length !== 4) this.m.fatalityBeats = fatalityBeats(this.m.inputs.name, this.m.draft!.fatality.name);
  }

  /** generate the fatality panels from the (editable) per-panel beats. `only` set
   *  → reroll just that one panel; else all four. */
  private async genFatality(only?: number): Promise<void> {
    this.ensureDraft();
    this.ensureFatalityBeats();
    this.m.fatalityStatus = 'running'; this.render();
    try {
      const canon = dataUrlToB64(this.m.job('canonical')?.dataUrl) ?? dataUrlToB64(this.m.inputs.referencePhotos?.[0]?.dataUrl);
      const r = await fetch('/__editor/creator/fatality', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.m.inputs.name, fatalityName: this.m.draft!.fatality.name, referenceBase64: canon ? [canon] : [], panelPrompts: this.m.fatalityBeats, only }),
      });
      const j = (await r.json()) as { ok?: boolean; mock?: boolean; panels?: string[]; error?: string };
      if (!j.ok) throw new Error(j.error ?? 'fatality failed');
      if (j.panels) {
        if (typeof only === 'number') { const arr = [...this.m.generatedFatality]; if (j.panels[only]) arr[only] = j.panels[only]; this.m.generatedFatality = arr; }
        else this.m.generatedFatality = j.panels;
      }
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

  /** keyable art (everything except a stage) must land on a flat green screen so
   *  ffmpeg can key it — reinforce it in case an edited prompt dropped the clause. */
  private withChromaKey(kind: string, prompt: string): string {
    if (kind === 'stage') return prompt; // stages are full scenes, never keyed
    if (/chroma|#00b140|green\s*(screen|background|chroma)/i.test(prompt)) return prompt;
    return prompt.trim() + ' Background: a solid flat chroma-key green (#00B140) screen — completely uniform, no shadow, no scenery.';
  }

  private async fireGen(key: string, kind: string, label: string, prompt: string, refs: string[]): Promise<void> {
    prompt = this.withChromaKey(kind, prompt);
    const t0 = Date.now();
    // stash the frame we're about to replace so a worse regen can be undone
    const existing = this.m.job(key);
    const prevDataUrl = existing?.status === 'done' ? existing.dataUrl : undefined;
    const prevMock = existing?.status === 'done' ? existing.mock : undefined;
    const job: CreatorJob = { key, kind, label, status: 'running', prompt, approved: false, startedAt: t0, prevDataUrl, prevMock };
    this.m.upsertJob(job);
    this.logMsg(`▸ gen ${label}…`);
    this.renderTray(); this.renderPreviewControls(); this.redrawPreview();
    try {
      const r = await fetch('/__editor/creator/gen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, prompt, referenceBase64: refs, id: this.m.id, key, frame: this.m.frameNameFor(key) }),
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
    // per-move player buttons (grey until generated, lit when done) on the moves/rig steps
    const step = CREATOR_STEPS[this.m.step];
    if (step === 'MOVES' || step === 'RIG' || step === 'SHIP') {
      const moves = [...BASE_MOVE_IDS, ...(this.m.draft?.specials ?? []).map((s) => s.id)];
      for (const mv of moves) {
        const special = !!this.m.draft?.specials.some((s) => s.id === mv);
        const cells = moveCellNames(mv, special);
        const active = cells.find((c) => c.endsWith('-active')) ?? cells[0];
        const done = this.m.job('sprite:' + active)?.status === 'done';
        const on = this.preview.kind === 'group' && this.preview.key === mv;
        const b = el('button', (on ? BTN_HOT : BTN) + `padding:2px 5px;font-size:9px;${done ? '' : 'opacity:.38;'}`, mv.toUpperCase());
        b.title = done ? 'play ' + mv : mv + ' — not generated yet';
        b.onclick = () => { this.preview = { kind: 'group', key: mv }; this.renderPreviewControls(); this.renderTray(); this.redrawPreview(); };
        this.previewControls.appendChild(b);
      }
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
    this.renderPreviewToggles();
    this.renderPreviewInspect();
  }

  /** skeleton (greyed until DWPose has run) + hitbox overlay checkboxes, above
   *  the animation. On the Rig step both default on. Hitboxes are drag/scalable. */
  private renderPreviewToggles(): void {
    if (!this.previewToggles) return;
    this.previewToggles.replaceChildren();
    const skelReady = Object.keys(this.m.skeletons).length > 0;
    const box = (label: string, checked: boolean, enabled: boolean, title: string, onChange: (on: boolean) => void): HTMLLabelElement => {
      const l = el('label', `display:flex;align-items:center;gap:5px;font-size:11px;cursor:${enabled ? 'pointer' : 'default'};` +
        `color:${enabled ? '#c8d6de' : '#5c6b78'};text-shadow:0 1px 3px #000;user-select:none;`) as HTMLLabelElement;
      l.title = title;
      const cb = el('input', 'cursor:inherit;') as HTMLInputElement;
      cb.type = 'checkbox'; cb.checked = checked; cb.disabled = !enabled;
      cb.onchange = () => onChange(cb.checked);
      l.append(cb, el('span', '', label));
      return l;
    };
    this.previewToggles.append(
      box('skeleton', this.showSkeleton && skelReady, skelReady,
        skelReady ? 'overlay the DWPose skeleton on the fighter' : 'run the skeleton on the Rig step to enable',
        (on) => { this.showSkeleton = on; this.redrawPreview(); }),
      box('hitboxes', this.showHitboxes, true,
        'overlay the move hitbox (red) + hurtbox (blue) — drag to move, drag a corner to scale',
        (on) => { this.showHitboxes = on; this.redrawPreview(); }),
    );
  }

  private closeInspect(): void {
    this.preview = { kind: 'group', key: 'idle' };
    this.renderPreviewControls(); this.renderTray(); this.redrawPreview();
  }

  /** cell-inspect panel — scale/offset + regen. OVERLAYS the wizard dialog (never
   *  reflows the left preview, so the fighter stays on the ground). Hidden until
   *  a tray cell is selected; ✕ closes it back to the animation. */
  private renderPreviewInspect(): void {
    if (!this.previewInspect) return;
    this.previewInspect.replaceChildren();
    if (this.preview.kind !== 'cell') { this.previewInspect.style.display = 'none'; return; }
    const j = this.m.job(this.preview.key); if (!j) { this.previewInspect.style.display = 'none'; return; }
    this.previewInspect.style.display = 'block';
    const head = el('div', 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;');
    head.append(el('div', 'font-size:15px;font-weight:bold;color:#bff0ff;', 'Inspect · ' + (j.label ?? '')));
    const close = el('button', BTN_HOT + 'padding:4px 12px;', '✕ close');
    close.onclick = () => this.closeInspect();
    head.append(close);
    this.previewInspect.appendChild(head);
    const key = this.preview.key;
    const isProj = key.startsWith('proj:');
    const isStage = key === 'stage';
    const projS = isProj ? this.m.draft?.specials.find((s) => 'proj:' + s.id === key) : undefined;
    const canRegen = key.startsWith('sprite:') || key === 'canonical' || key === 'portrait' || key === 'ko' || isProj || isStage;
    const wrap = el('div', '');
    // scale + x/y realign (baked into preview, the packed sheet, and downstream refs)
    const slider = (label: string, get: () => number, set: (v: number) => void, min: number, max: number, step: number, fmt: (v: number) => string): HTMLDivElement => {
      const row = el('div', 'display:flex;align-items:center;gap:8px;margin-bottom:6px;');
      const lbl = el('span', 'font-size:11px;color:#9fb4be;white-space:nowrap;width:66px;', `${label} ${fmt(get())}`);
      const r = el('input', 'flex:1;') as HTMLInputElement;
      r.type = 'range'; r.min = String(min); r.max = String(max); r.step = String(step); r.value = String(get());
      r.oninput = () => { set(parseFloat(r.value)); lbl.textContent = `${label} ${fmt(get())}`; this.redrawPreview(); this.renderTray(); };
      row.append(lbl, r); return row;
    };
    if (!isProj && !isStage) {
      // ART cells (sprite / canonical / portrait / ko): per-cell scale + realign
      wrap.appendChild(slider('scale', () => j.scale ?? 1, (v) => (j.scale = v), 0.5, 1.6, 0.02, (v) => v.toFixed(2)));
      wrap.appendChild(slider('off x', () => j.offX ?? 0, (v) => (j.offX = v), -120, 120, 1, (v) => (v > 0 ? '+' : '') + Math.round(v)));
      wrap.appendChild(slider('off y', () => j.offY ?? 0, (v) => (j.offY = v), -120, 120, 1, (v) => (v > 0 ? '+' : '') + Math.round(v)));
      const reset = el('button', BTN + 'padding:2px 8px;font-size:10px;margin-bottom:6px;', 'reset scale/offset');
      reset.onclick = () => { j.scale = 1; j.offX = 0; j.offY = 0; this.renderPreviewInspect(); this.redrawPreview(); this.renderTray(); };
      wrap.appendChild(reset);
    }
    if (isProj && projS) {
      // PROJECTILE tuning — live in the preview (drawn statically at spawn while
      // this cell is inspected); size exports as projectile.renderSize (px).
      const s = projS, redraw = (): void => this.redrawPreview();
      wrap.appendChild(el('div', 'font-size:11px;color:#9fb4be;margin-bottom:4px;', 'PROJECTILE · size · spawn · hitbox'));
      wrap.appendChild(this.sliderRow('size', () => s.projScale ?? 1, (v) => (s.projScale = v), 0.4, 2.5, 0.05, (v) => Math.round(72 * v) + 'px', redraw));
      wrap.appendChild(this.sliderRow('spawn x', () => s.projSpawnX ?? 96, (v) => (s.projSpawnX = v), 0, 220, 2, (v) => String(Math.round(v)), redraw));
      wrap.appendChild(this.sliderRow('spawn y', () => s.projSpawnY ?? -176, (v) => (s.projSpawnY = v), -300, -20, 2, (v) => String(Math.round(v)), redraw));
      const autoBtn = el('button', BTN + 'padding:2px 8px;font-size:10px;margin-bottom:8px;', s.projBox ? `↻ auto-hitbox (${s.projBox.w}²)` : '▸ auto-hitbox (square around alpha)');
      autoBtn.title = 'fit a square collision box around the projectile’s visible pixels';
      autoBtn.onclick = () => void this.autoProjBox(s);
      wrap.appendChild(autoBtn);
    }
    if (canRegen) {
      wrap.appendChild(el('div', 'font-size:11px;color:#9fb4be;margin-bottom:3px;', 'PROMPT (sent to nano-banana — edit & regenerate)'));
      const prompt = el('textarea', INPUT + 'height:112px;font-size:11px;line-height:1.35;') as HTMLTextAreaElement;
      prompt.value = isProj && projS ? this.effectiveProjPrompt(projS) : isStage ? (this.m.draft?.stagePrompt ?? j.prompt ?? '') : (j.prompt ?? '');
      prompt.placeholder = 'the prompt this cell was generated from';
      this.regenPromptEl = prompt;
      wrap.appendChild(prompt);
      // img2img makes no sense for the inspo-free projectile FX — omit it there
      if (!isProj) {
        const tog = el('label', 'display:flex;align-items:center;gap:6px;font-size:11px;color:#9fb4be;margin-top:6px;cursor:pointer;');
        const cb = el('input', '') as HTMLInputElement; cb.type = 'checkbox'; cb.checked = this.regenUseSelf;
        cb.onchange = () => (this.regenUseSelf = cb.checked);
        tog.append(cb, el('span', '', 'edit THIS image (img2img — use it as the reference instead of the base)'));
        wrap.appendChild(tog);
      }
      const rr = el('button', BTN_HOT + 'margin-top:5px;width:100%;font-size:12px;',
        j.status === 'running' ? '◐ regenerating…' : '↻ Regenerate ' + (j.label ?? ''));
      rr.onclick = () => this.regenSelected();
      wrap.appendChild(rr);
      // undo/redo the last regen — flip back to the frame it replaced if it came
      // out worse (a within-session safety net; persists the shown frame to disk)
      if (j.prevDataUrl !== undefined) {
        const undo = el('button', BTN + 'margin-top:6px;width:100%;font-size:11px;',
          j.undone ? '↷ Redo — back to the regenerated frame' : '↶ Undo — revert to the previous frame');
        undo.title = 'flip between the regenerated frame and the one it replaced';
        undo.onclick = () => void this.undoRegen(key);
        wrap.appendChild(undo);
      }
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
    } else if (key === 'ko') {
      refs = photoRefs.length > 1 ? [photoRefs[1], ...photoRefs.filter((_, i) => i !== 1)] : photoRefs;
      kind = 'ko'; label = 'KO portrait';
      if (!prompt) prompt = KO_PROMPT(this.m.inputs.name, desc);
    } else if (key.startsWith('proj:')) {
      const s = this.m.draft?.specials.find((x) => 'proj:' + x.id === key); if (!s) return;
      if (!prompt) prompt = this.effectiveProjPrompt(s);
      s.projPrompt = prompt; // persist the edit so the special-chain uses it too
      kind = 'sprite'; label = s.name + ' projectile'; refs = []; // inspo-free keyable FX
    } else if (key === 'stage') {
      if (!prompt) prompt = this.m.draft?.stagePrompt ?? '';
      if (this.m.draft) this.m.draft.stagePrompt = prompt;
      kind = 'stage'; label = 'Stage';
      const u = this.m.inputs.stagePhotos?.[0]?.dataUrl;
      refs = u ? ([dataUrlToB64(u)!].filter(Boolean) as string[]) : [];
    } else return;
    // img2img: replace the base reference with THIS cell's current image (art +
    // stage only — the projectile is deliberately character/scene-free)
    if (this.regenUseSelf && !key.startsWith('proj:')) {
      const own = dataUrlToB64(job?.dataUrl);
      if (own) refs = [own];
      this.logMsg(`img2img: editing ${label} from its own image`);
    }
    this.fireGen(key, kind, label, prompt, refs);
  }

  /** flip a cell between its current (regenerated) image and the one it replaced,
   *  writing whichever is shown back to disk — lets a worse regen be rejected. */
  private async undoRegen(key: string): Promise<void> {
    const j = this.m.job(key); if (!j || j.prevDataUrl === undefined) return;
    const curUrl = j.dataUrl, curMock = j.mock;
    j.dataUrl = j.prevDataUrl; j.mock = j.prevMock ?? false;
    j.prevDataUrl = curUrl; j.prevMock = curMock;
    j.undone = !j.undone;
    await this.persistFrame(key); // the reverted frame becomes the on-disk one
    this.logMsg(`${j.undone ? '↶ reverted' : '↷ redid'} ${j.label}`);
    this.renderPreviewInspect(); this.renderTray(); this.renderPreviewControls(); this.redrawPreview();
  }

  // ── hitbox drag/scale on the preview canvas ───────────────────────────────
  /** the previewed move's hitbox rect (preview px) + its engine box, or null. */
  private currentHbRect(): { moveId: string; box: { x: number; y: number; w: number; h: number }; rx: number; ry: number; rw: number; rh: number } | null {
    if (!this.showHitboxes) return null;
    const moveId = this.previewMoveId(); if (!moveId) return null;
    const box = this.effectiveHitbox(moveId); if (!box) return null;
    const { cx, feetY, e } = this.hbAnchor(), foot = this.footOffset();
    // box.y is engine (relative to f.y); subtract the render foot offset to draw it
    // where FightScene renders it over the sprite feet
    return { moveId, box, rx: cx + box.x * e, ry: feetY + (box.y - foot) * e, rw: box.w * e, rh: box.h * e };
  }

  private onHbDown(ev: MouseEvent): void {
    const r = this.currentHbRect(); if (!r) return;
    const mx = ev.offsetX, my = ev.offsetY, H = 7;
    const near = (px: number, py: number): boolean => Math.abs(mx - px) <= H && Math.abs(my - py) <= H;
    let mode: 'move' | 'nw' | 'ne' | 'sw' | 'se' | null = null;
    if (near(r.rx, r.ry)) mode = 'nw'; else if (near(r.rx + r.rw, r.ry)) mode = 'ne';
    else if (near(r.rx, r.ry + r.rh)) mode = 'sw'; else if (near(r.rx + r.rw, r.ry + r.rh)) mode = 'se';
    else if (mx >= r.rx && mx <= r.rx + r.rw && my >= r.ry && my <= r.ry + r.rh) mode = 'move';
    if (!mode) return;
    ev.preventDefault();
    this.m.autoHitboxes[r.moveId] = { ...r.box }; // pin the (possibly default) box so edits persist + export
    this.hbDrag = { moveId: r.moveId, mode, sx: mx, sy: my, box: { ...r.box } };
  }

  /** end a hitbox drag and flush the edit through the same debounced autosave the
   *  rest of the creator uses, so manual box tweaks survive a refresh. */
  private endHbDrag(): void {
    if (!this.hbDrag) return;
    this.hbDrag = undefined;
    this.scheduleSave();
  }

  private onHbMove(ev: MouseEvent): void {
    if (!this.hbDrag) {
      // hover cursor feedback (only when the overlay could be grabbed)
      const r = this.currentHbRect();
      let cur = 'default';
      if (r) {
        const mx = ev.offsetX, my = ev.offsetY, H = 7, near = (px: number, py: number): boolean => Math.abs(mx - px) <= H && Math.abs(my - py) <= H;
        if (near(r.rx, r.ry) || near(r.rx + r.rw, r.ry + r.rh)) cur = 'nwse-resize';
        else if (near(r.rx + r.rw, r.ry) || near(r.rx, r.ry + r.rh)) cur = 'nesw-resize';
        else if (mx >= r.rx && mx <= r.rx + r.rw && my >= r.ry && my <= r.ry + r.rh) cur = 'move';
      }
      this.previewCanvas.style.cursor = cur;
      return;
    }
    const e = this.hbAnchor().e;
    const dx = (ev.offsetX - this.hbDrag.sx) / e, dy = (ev.offsetY - this.hbDrag.sy) / e;
    const b = { ...this.hbDrag.box };
    switch (this.hbDrag.mode) {
      case 'move': b.x += dx; b.y += dy; break;
      case 'nw': b.x += dx; b.y += dy; b.w -= dx; b.h -= dy; break;
      case 'ne': b.y += dy; b.w += dx; b.h -= dy; break;
      case 'sw': b.x += dx; b.w -= dx; b.h += dy; break;
      case 'se': b.w += dx; b.h += dy; break;
    }
    if (b.w < 8) b.w = 8; if (b.h < 8) b.h = 8; // keep it grabbable
    this.m.autoHitboxes[this.hbDrag.moveId] = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) };
    this.redrawPreview();
  }

  /** the job the big preview should draw right now (animated group or one cell). */
  /** the done sprite job for a cell name, or undefined. */
  private cellJob(name: string): CreatorJob | undefined {
    const j = this.m.job('sprite:' + name);
    return j?.status === 'done' ? j : undefined;
  }

  /** which cell name a timed [cell, ms] sequence is on right now (looped). */
  private seqPick(seq: [string, number][], t: number): string {
    const total = seq.reduce((s, [, ms]) => s + ms, 0);
    let x = t % total;
    for (const [name, ms] of seq) { if (x < ms) return name; x -= ms; }
    return seq[seq.length - 1][0];
  }

  /** the frame to draw + a vertical offset (jump arc), sequencing real motion
   *  for jump/crouch/block/fall instead of a single static cell. */
  private previewFrame(): { job?: CreatorJob; offY: number } {
    const p = this.preview;
    if (p.kind === 'cell') return { job: this.m.job(p.key), offY: 0 };
    const t = Date.now();
    const g = p.key;
    if (g === 'idle') return { job: this.cellJob((t >> 9) % 2 ? 'idle-b' : 'idle-a') ?? this.cellJob('idle-a'), offY: 0 };
    if (g === 'walk') return { job: this.cellJob((t >> 8) % 2 ? 'walk-b' : 'walk-a') ?? this.cellJob('walk-a'), offY: 0 };
    if (g === 'jump') {
      const ph = (t % 1200) / 1200; // idle prep → airborne arc → idle land
      if (ph < 0.14 || ph > 0.86) return { job: this.cellJob('idle-a') ?? this.cellJob('jump'), offY: 0 };
      const a = (ph - 0.14) / 0.72;
      return { job: this.cellJob('jump') ?? this.cellJob('idle-a'), offY: -Math.sin(a * Math.PI) * 150 };
    }
    if (g === 'crouch') return { job: this.cellJob(this.seqPick([['idle-a', 240], ['crouch', 640], ['idle-a', 240]], t)) ?? this.cellJob('crouch'), offY: 0 };
    if (g === 'block') return { job: this.cellJob(this.seqPick([['idle-a', 300], ['block', 560]], t)) ?? this.cellJob('block'), offY: 0 };
    if (g === 'fall') return { job: this.cellJob(this.seqPick([['idle-a', 220], ['hit', 260], ['fall', 320], ['down', 820]], t)) ?? this.cellJob('fall') ?? this.cellJob('down'), offY: 0 };
    // per-move animation: sequence its startup/active/recovery cells
    const sp = this.m.draft?.specials.find((s) => s.id === g);
    // air normals: idle → jump → execute the move, riding a full jump arc
    if (!sp && BASE_MOVE_IDS.includes(g) && g.startsWith('j')) {
      const seq: [string, number][] = [['idle-a', 160], ['jump', 220], [g, 440]];
      const total = 820, ph = t % total;
      const offY = ph > 160 ? -Math.sin(((ph - 160) / (total - 160)) * Math.PI) * 150 : 0;
      return { job: this.cellJob(this.seqPick(seq, t)) ?? this.cellJob(g) ?? this.cellJob('jump') ?? this.cellJob('idle-a'), offY };
    }
    if (sp || BASE_MOVE_IDS.includes(g)) {
      const cells = moveCellNames(g, !!sp);
      const seq: [string, number][] = cells.length === 1 ? [[cells[0], 500]]
        : cells.length === 2 ? [[cells[0], 300], [cells[1], 340]]
        : [[cells[0], 200], [cells[1], 220], [cells[2], 340]];
      // rising anti-airs (dragon-punch / flash-kick) hop off the ground during the move
      let offY = 0;
      if (sp && (sp.archetype === 'anti-air-dp' || sp.archetype === 'flash-kick')) {
        const total = seq.reduce((a, [, ms]) => a + ms, 0), ph = t % total, startupMs = seq[0][1];
        if (ph > startupMs) offY = -Math.sin(((ph - startupMs) / (total - startupMs)) * Math.PI) * 140;
      }
      return { job: this.cellJob(this.seqPick(seq, t)) ?? this.cellJob(cells.find((c) => c.endsWith('-active')) ?? cells[0]) ?? this.cellJob('idle-a'), offY };
    }
    return { job: this.cellJob(g), offY: 0 };
  }

  // ── tray + preview ─────────────────────────────────────────────────────
  /** the sheet cells the current step expects to exist (base always; attacks +
   *  specials once you're on/past the Sprites step or any attack was generated). */
  private expectedCells(): string[] {
    const base = BASE_CELLS.map((c) => c.id);
    const attacks = this.m.allAttackCells().map((c) => c.name);
    const step = CREATOR_STEPS[this.m.step];
    const showAttacks = step === 'MOVES' || step === 'RIG' || step === 'SHIP' || attacks.some((n) => this.m.job('sprite:' + n));
    return showAttacks ? [...base, ...attacks] : base;
  }

  private renderTray(): void {
    this.trayEl.replaceChildren();
    const jobs = [...this.m.jobs.values()];
    // non-cell assets first (canonical / portrait / stage), then the sheet cells
    // in canonical order — each a real job or a clickable "missing" ghost slot.
    for (const j of jobs) if (!j.key.startsWith('sprite:')) this.trayEl.appendChild(this.trayCell(j));
    const order = this.expectedCells();
    const inOrder = new Set(order);
    for (const name of order) {
      const j = this.m.job('sprite:' + name);
      this.trayEl.appendChild(j ? this.trayCell(j) : this.ghostCell(name));
    }
    for (const j of jobs) if (j.key.startsWith('sprite:') && !inOrder.has(j.key.slice('sprite:'.length))) this.trayEl.appendChild(this.trayCell(j));
    if (!this.trayEl.children.length) this.trayEl.appendChild(el('div', 'font-size:11px;color:#5c6b78;', 'bake tray — generated assets appear here'));
  }

  private trayCell(j: CreatorJob): HTMLDivElement {
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
    else cell.title = 'click to inspect · drag onto another cell to SWAP (hold Shift = copy over)';
    cell.onclick = () => this.selectCell(j.key);
    // drag-to-copy/swap on the timeline — sprite cells only
    if (j.key.startsWith('sprite:') && j.status === 'done') {
      cell.draggable = true;
      cell.ondragstart = (e) => { e.dataTransfer?.setData('text/mk-cell', j.key); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copyMove'; };
    }
    if (j.key.startsWith('sprite:')) this.wireDropTarget(cell, () => j.key.slice('sprite:'.length), false);
    // tiny download button, upper-left, revealed on hover
    if (j.dataUrl) {
      const dl = el('button', 'position:absolute;top:1px;left:1px;z-index:4;padding:0 3px;font-size:10px;line-height:1.4;border:none;border-radius:3px;background:rgba(9,13,20,.9);color:#bff0ff;cursor:pointer;display:none;', '⤓');
      dl.title = 'download this frame';
      dl.onclick = (e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = j.dataUrl!; a.download = this.savedAsFor(j.key, j); document.body.appendChild(a); a.click(); a.remove(); };
      cell.appendChild(dl);
      cell.onmouseenter = () => { dl.style.display = 'block'; };
      cell.onmouseleave = () => { dl.style.display = 'none'; };
    }
    return cell;
  }

  /** allow a dragged sprite CELL (copy/swap) OR an uploaded image FILE (BYO frame)
   *  to drop here. `ghost` targets always copy. */
  private wireDropTarget(cell: HTMLDivElement, targetName: () => string, ghost: boolean): void {
    cell.ondragover = (e) => { const dt = e.dataTransfer; if (dt && (dt.types.includes('text/mk-cell') || dt.types.includes('Files'))) { e.preventDefault(); cell.style.outline = '2px solid #7fe3ff'; } };
    cell.ondragleave = () => { cell.style.outline = ''; };
    cell.ondrop = (e) => {
      e.preventDefault(); cell.style.outline = '';
      const dt = e.dataTransfer; if (!dt) return;
      const src = dt.getData('text/mk-cell');
      if (src) { void this.copyOrSwapCell(src, targetName(), ghost || e.shiftKey ? 'copy' : 'swap'); return; }
      const f = dt.files?.[0];
      if (f && f.type.startsWith('image/')) void this.setCellImage(targetName(), f);
    };
  }

  /** replace one sheet cell with an uploaded image (normalized to the 288×384 cell). */
  private async setCellImage(name: string, file: File): Promise<void> {
    const dataUrl = await readFile(file);
    const img = await this.loadImg(dataUrl);
    const c = document.createElement('canvas'); c.width = CELL_W; c.height = CELL_H;
    const ctx = c.getContext('2d')!;
    const s = Math.min(CELL_W / img.naturalWidth, CELL_H / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (288 - w) / 2, 384 - h, w, h); // contain, feet at bottom
    const key = 'sprite:' + name;
    const job = this.m.job(key) ?? ({ key, kind: 'sprite', label: name } as CreatorJob);
    job.dataUrl = c.toDataURL('image/png'); job.status = 'done'; job.mock = false; job.error = undefined; job.scale = job.scale ?? 1;
    this.m.upsertJob(job);
    await this.persistFrame(key);
    this.logMsg(`BYO frame → ${name}`);
    this.renderTray(); this.renderPreviewControls(); this.redrawPreview();
  }

  /** an expected-but-not-yet-generated cell: click to gen, or drop a cell to copy in. */
  private ghostCell(name: string): HTMLDivElement {
    const cell = el('div', 'flex:0 0 auto;width:52px;text-align:center;position:relative;cursor:pointer;');
    const c = el('canvas', 'width:52px;height:66px;border-radius:4px;border:1px dashed #3f5266;background:#0b1119;');
    c.width = 52; c.height = 66;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#5c6b78'; ctx.font = '22px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('+', 26, 30);
    cell.appendChild(c);
    cell.appendChild(el('div', 'font-size:9px;color:#5c6b78;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;', name));
    cell.title = `${name} — not generated. Click to generate, or drag another cell here to reuse it.`;
    cell.onclick = () => void this.genOneCell(name);
    this.wireDropTarget(cell, () => name, true);
    return cell;
  }

  /** generate a single sheet cell (base/attack/special) from its own spec. */
  private async genOneCell(name: string): Promise<void> {
    const spec = this.cellSpec(name); if (!spec) return;
    const refs = await this.refFor(spec.ref);
    this.fireGen('sprite:' + name, 'sprite', name, SPRITE_PROMPT(this.m.inputs.name, spec.pose), refs);
  }

  /** timeline copy/swap: move one cell's image onto another slot. `swap` exchanges
   *  the two images; `copy` overwrites the target with the source (source kept). */
  private async copyOrSwapCell(srcKey: string, targetName: string, mode: 'swap' | 'copy'): Promise<void> {
    const src = this.m.job(srcKey); if (!src?.dataUrl) return;
    const targetKey = 'sprite:' + targetName;
    if (srcKey === targetKey) return;
    const grab = (j: CreatorJob): Partial<CreatorJob> => ({ dataUrl: j.dataUrl, scale: j.scale, offX: j.offX, offY: j.offY, mock: j.mock, prompt: j.prompt });
    const put = (j: CreatorJob, v: Partial<CreatorJob>): void => { j.dataUrl = v.dataUrl; j.scale = v.scale; j.offX = v.offX; j.offY = v.offY; j.mock = v.mock; j.prompt = v.prompt; j.status = 'done'; j.error = undefined; };
    const tgt = this.m.job(targetKey);
    if (mode === 'swap' && tgt?.dataUrl) {
      const a = grab(src), b = grab(tgt);
      put(src, b); put(tgt, a);
      this.logMsg(`swapped ${srcKey.slice(7)} ↔ ${targetName}`);
      await this.persistFrame(srcKey); await this.persistFrame(targetKey);
    } else {
      const job = tgt ?? { key: targetKey, kind: 'sprite', label: targetName } as CreatorJob;
      put(job, grab(src));
      this.m.upsertJob(job);
      this.logMsg(`copied ${srcKey.slice(7)} → ${targetName}`);
      await this.persistFrame(targetKey);
    }
    this.renderTray(); this.renderPreviewControls(); this.redrawPreview();
  }

  /** rewrite a cell's frame on disk (its own filename) after a copy/swap. */
  private async persistFrame(key: string): Promise<void> {
    const job = this.m.job(key); const b = dataUrlToB64(job?.dataUrl); if (!job || !b) return;
    job.savedAs = this.savedAsFor(key, job);
    try {
      await fetch('/__editor/creator/save-frame', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: this.m.id, savedAs: job.savedAs, pngBase64: b }),
      });
    } catch { /* non-fatal */ }
  }

  private savedAsFor(key: string, job?: CreatorJob): string {
    if (key === 'stage') return 'stage.jpg';
    if (key === 'canonical' || key === 'portrait' || key === 'ko') return `${key}.png`;
    if (key.startsWith('proj:')) return this.m.frameNameFor(key) + '.png';
    if (key.startsWith('sprite:')) return this.m.frameNameFor(key) + '.png';
    const ext = job?.dataUrl?.startsWith('data:image/jpeg') ? '.jpg' : '.png';
    return (job?.label ?? key).replace(/[^a-z0-9-]+/gi, '-') + ext;
  }

  /** Keep raw progress filenames deterministic after model/order changes
   *  (e.g. adding block-crouch) and after special renames. */
  private async syncRawFrames(): Promise<void> {
    if (!this.m.inputs.name.trim()) return;
    const writes: Promise<void>[] = [];
    for (const [key, job] of this.m.jobs) {
      if (!job.dataUrl || job.status !== 'done') continue;
      const desired = this.savedAsFor(key, job);
      if (job.savedAs !== desired) {
        job.savedAs = desired;
        writes.push(this.persistFrame(key));
      }
    }
    if (writes.length) await Promise.all(writes);
  }

  private shimmer(): HTMLDivElement {
    const s = el('div', 'position:absolute;inset:0;border-radius:4px;pointer-events:none;' +
      'background:linear-gradient(110deg,transparent 30%,rgba(127,227,255,.35) 50%,transparent 70%);' +
      'background-size:200% 100%;animation:mkShimmer 1.1s linear infinite;');
    return s;
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
    // while inspecting the projectile cell, stand the fighter idle and show the
    // projectile statically at its spawn (so size/spawn/hitbox tuning is visible)
    const inspectingProj = this.preview.kind === 'cell' && this.preview.key.startsWith('proj:');
    const pf = inspectingProj
      ? { job: this.cellJob('idle-a') ?? this.m.job('canonical'), offY: 0 }
      : this.previewFrame(); // sequenced motion (jump arc, crouch/block/fall cycles)
    const main = pf.job;
    const canon = this.m.job('canonical');
    const scale = main?.scale ?? 1;
    const drawH = H * 0.82 * scale;
    const ox = main?.offX ?? 0, oy = (main?.offY ?? 0) + pf.offY; // cell realign + sequence arc
    if (main?.dataUrl) {
      const rise = Math.max(0, -pf.offY) * (drawH / CELL_H); // shrink shadow as it rises
      this.drawShadow(ctx, W / 2 + ox * (drawH / CELL_H), floorY, 96 * scale * Math.max(0.25, 1 - rise / (H * 0.3)));
      // anchor the ORIGIN_FEET line (not the cell bottom) on the floor — cells
      // now carry the pack-time HEADROOM below the feet, like packed sheets
      this.drawCharacter(ctx, main.dataUrl, W / 2, floorY + (CELL_H - ORIGIN_FEET) * (drawH / CELL_H), drawH, ox, oy);
    } else {
      this.drawShadow(ctx, W / 2, floorY, 80);
      this.drawSilhouette(ctx, W / 2, floorY, 150, this.m.draft?.color ?? '#31424f', canon?.status === 'running');
    }
    // remember the fighter draw geometry so the skeleton overlay + hitbox drag map
    // cell/engine coords onto exactly where the art landed
    this.geom = { W, floorY, drawH, ox, oy, cell: main?.key?.startsWith('sprite:') ? main.key.slice('sprite:'.length) : undefined };
    // projectile: static at spawn while its cell is inspected (tuning is live),
    // else fired out during a group-play special's active→recovery window.
    if (inspectingProj) {
      const sp = this.m.draft?.specials.find((s) => 'proj:' + s.id === this.preview.key);
      if (sp) this.drawProjectile(ctx, sp, W, floorY, drawH, 0);
    } else if (this.preview.kind === 'group') {
      const sp = this.m.draft?.specials.find((s) => s.id === this.preview.key && isProjectileArchetypeKey(s.archetype));
      if (sp) {
        const total = 200 + 220 + 340; // matches the 3-phase special sequence in previewFrame
        const ph = Date.now() % total;
        if (ph > 200) this.drawProjectile(ctx, sp, W, floorY, drawH, (ph - 200) / (total - 200)); // launched at the active frame
      }
    }
    // skeleton + hitbox overlays (toggled by the checkboxes above the preview)
    if (this.showSkeleton) this.drawSkeletonOverlay(ctx);
    if (this.showHitboxes) this.drawHitboxOverlay(ctx);
    // portrait chip top-left
    const port = this.m.job('portrait');
    if (port?.dataUrl) { ctx.save(); ctx.beginPath(); ctx.rect(12, 12, 70, 70); ctx.clip(); this.drawContain(ctx, port.dataUrl, 12, 12, 70, 70); ctx.restore(); ctx.strokeStyle = '#3f6070'; ctx.lineWidth = 1; ctx.strokeRect(12, 12, 70, 70); }
  }

  // The SAME limb graph + colors FightScene.drawSkeleton uses (torso/head orange,
  // arms blue, legs green; per-finger hands; ankle→toe/heel feet) so the creator
  // overlay reads identically to the in-game/Sprite-Editor F3 skeleton.
  private static readonly SKEL_GROUPS: { color: string; bones: [string, string][] }[] = [
    { color: '#ff8c1a', bones: [['Lsho', 'Rsho'], ['Lhip', 'Rhip'], ['Lsho', 'Lhip'], ['Rsho', 'Rhip']] },
    { color: '#33a0ff', bones: [['Lsho', 'Lelb'], ['Lelb', 'Lwri'], ['Rsho', 'Relb'], ['Relb', 'Rwri']] },
    { color: '#3ad64a', bones: [['Lhip', 'Lkne'], ['Lkne', 'Lank'], ['Rhip', 'Rkne'], ['Rkne', 'Rank']] },
  ];
  private static readonly SKEL_JOINT_COLOR: Record<string, string> = {
    nose: '#ff8c1a', Lsho: '#ff8c1a', Rsho: '#ff8c1a', Lhip: '#ff8c1a', Rhip: '#ff8c1a',
    Leye: '#ff8c1a', Reye: '#ff8c1a', Lear: '#ff8c1a', Rear: '#ff8c1a',
    Lelb: '#33a0ff', Relb: '#33a0ff', Lwri: '#33a0ff', Rwri: '#33a0ff',
    Lkne: '#3ad64a', Rkne: '#3ad64a', Lank: '#3ad64a', Rank: '#3ad64a',
  };
  private static readonly SKEL_HAND_BONES: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
  ];
  private static readonly SKEL_FOOT_BONES: [string, string][] = [
    ['Lank', 'Lheel'], ['Lank', 'Lbigtoe'], ['Lank', 'Lsmalltoe'],
    ['Rank', 'Rheel'], ['Rank', 'Rbigtoe'], ['Rank', 'Rsmalltoe'],
  ];
  private static readonly SKEL_HAND_COLOR = '#33e0ff';
  private static readonly SKEL_FOOT_COLOR = '#3ad64a';

  /** map a cell-space point (CELL_W×CELL_H) onto the drawn art in the preview.
   *  The ORIGIN_FEET line anchors on the floor (matches drawCharacter). */
  private cellToPreview(jx: number, jy: number): [number, number] {
    const g = this.geom!; const s = g.drawH / CELL_H;
    return [g.W / 2 + (jx - ORIGIN_CX + g.ox) * s, g.floorY + (jy - ORIGIN_FEET + g.oy) * s];
  }

  /** DWPose skeleton over the current frame's art — a 1:1 port of
   *  FightScene.drawSkeleton (body groups + neck + finger + foot bones + joint
   *  dots, face_* skipped) so both pipelines render the identical stick figure.
   *  No-op if the current cell has no baked joints. */
  private drawSkeletonOverlay(ctx: CanvasRenderingContext2D): void {
    const g = this.geom; if (!g?.cell) return;
    const j = this.m.skeletons[g.cell]; if (!j) return;
    const P = CharacterCreatorPanel;
    ctx.save();
    const bone = (a: string, b: string, color: string, w = 2): void => {
      const ja = j[a], jb = j[b]; if (!ja || !jb) return;
      const [ax, ay] = this.cellToPreview(ja[0], ja[1]);
      const [bx, by] = this.cellToPreview(jb[0], jb[1]);
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.globalAlpha = 0.95;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    };
    // body
    for (const grp of P.SKEL_GROUPS) for (const [a, b] of grp.bones) bone(a, b, grp.color);
    // neck: nose → shoulder midpoint
    if (j.nose && j.Lsho && j.Rsho) {
      const [nx, ny] = this.cellToPreview(j.nose[0], j.nose[1]);
      const [lx, ly] = this.cellToPreview(j.Lsho[0], j.Lsho[1]);
      const [rx, ry] = this.cellToPreview(j.Rsho[0], j.Rsho[1]);
      ctx.strokeStyle = '#ff8c1a'; ctx.lineWidth = 2; ctx.globalAlpha = 0.95;
      ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo((lx + rx) / 2, (ly + ry) / 2); ctx.stroke();
    }
    // feet + hands (finger bones)
    for (const [a, b] of P.SKEL_FOOT_BONES) bone(a, b, P.SKEL_FOOT_COLOR, 1);
    for (const pre of ['lhand_', 'rhand_']) for (const [a, b] of P.SKEL_HAND_BONES) bone(`${pre}${a}`, `${pre}${b}`, P.SKEL_HAND_COLOR, 1);
    // joint dots: body big+colored, hands/feet a small point, face_* skipped
    ctx.globalAlpha = 1;
    for (const n in j) {
      if (n.startsWith('face_')) continue;
      const [x, y] = this.cellToPreview(j[n][0], j[n][1]);
      const bodyCol = P.SKEL_JOINT_COLOR[n];
      if (bodyCol !== undefined) { ctx.fillStyle = bodyCol; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.fillStyle = n.startsWith('lhand_') || n.startsWith('rhand_') ? P.SKEL_HAND_COLOR : P.SKEL_FOOT_COLOR; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    }
    ctx.restore();
  }

  /** where a move hitbox maps in the preview. box.x/box.y are engine px relative
   *  to the collision origin f.y; `cx`/`feetY` locate that origin ON the drawn
   *  sprite (FLOOR_FRAC feet line, hitboxFromSkeleton's reference — NOT the ground
   *  line), and CHILD it to the current frame's art offset (`geom.ox/oy`) so the
   *  box rides the jump arc / anti-air rise with the fighter, exactly as the
   *  in-game hitbox follows f.y. `e` is engine→preview px (stable per cell). */
  private hbAnchor(): { cx: number; feetY: number; e: number } {
    const g = this.geom;
    const W = this.previewCanvas.width, H = this.previewCanvas.height;
    const drawH = g?.drawH ?? H * 0.82;
    const s = drawH / CELL_H;                  // cell → preview px
    const e = drawH / (256 * ART_MARGIN);      // engine → preview px (256 = default hurtStand.h)
    const floorY = g?.floorY ?? Math.round(H * 0.94);
    const ox = (g?.ox ?? 0) * s, oy = (g?.oy ?? 0) * s; // current-frame art shift (jump/anti-air)
    return { cx: W / 2 + ox, feetY: floorY + oy, e }; // ORIGIN_FEET line == the floor anchor
  }

  /** the move currently being previewed as a group (normal or special), or null. */
  private previewMoveId(): string | null {
    if (this.preview.kind !== 'group') return null;
    const k = this.preview.key;
    return (BASE_MOVE_IDS.includes(k) || this.m.draft?.specials.some((s) => s.id === k)) ? k : null;
  }

  /** throttled build of the full character (default hitboxes + spriteOffsetY). */
  private builtDef(): { moves: Record<string, { hitbox?: unknown }>; spriteOffsetY?: number } {
    const now = Date.now();
    if (!this.builtCache || now - this.builtCache.t > 250) this.builtCache = { t: now, def: this.m.buildFullCharacter() as { moves: Record<string, { hitbox?: unknown }>; spriteOffsetY?: number } };
    return this.builtCache.def;
  }

  /** the render y-offset between the collision origin (f.y) and the drawn sprite
   *  feet — SPRITE_FOOT_OFFSET_Y + spriteOffsetY, exactly as FightScene applies it
   *  (and as the Sprite Editor's cellBoxToHitbox bakes into an auto hitbox). */
  private footOffset(): number { return footOffset(this.builtDef()); }

  /** the move's effective engine hitbox: the RIG-tuned one, else the built default
   *  (throttled buildFullCharacter). Returns null for boxless moves (throws/projectiles). */
  private effectiveHitbox(moveId: string): { x: number; y: number; w: number; h: number } | null {
    const tuned = this.m.autoHitboxes[moveId]; if (tuned) return tuned;
    const hb = this.builtDef().moves[moveId]?.hitbox;
    return hb && typeof hb === 'object' ? { ...(hb as { x: number; y: number; w: number; h: number }) } : null;
  }

  /** hurtbox (blue, static) + the previewed move's hitbox (red, drag/scalable). */
  private drawHitboxOverlay(ctx: CanvasRenderingContext2D): void {
    const { cx, feetY, e } = this.hbAnchor(), foot = this.footOffset();
    // anchor + foot offset so boxes register with the sprite exactly as FightScene
    // renders them (and ride the jump/anti-air rise via hbAnchor); matches the hit-test
    const rect = (b: { x: number; y: number; w: number; h: number }): [number, number, number, number] =>
      [cx + b.x * e, feetY + (b.y - foot) * e, b.w * e, b.h * e];
    ctx.save();
    // hurtbox (fixed body box)
    const hurt = { x: -52, y: -256, w: 104, h: 256 };
    const [hx, hy, hw, hh] = rect(hurt);
    ctx.strokeStyle = 'rgba(90,170,255,.85)'; ctx.fillStyle = 'rgba(90,170,255,.12)'; ctx.lineWidth = 1.5;
    ctx.fillRect(hx, hy, hw, hh); ctx.strokeRect(hx, hy, hw, hh);
    // the previewed move's hitbox
    const moveId = this.previewMoveId();
    const box = moveId ? this.effectiveHitbox(moveId) : null;
    if (moveId && box) {
      const [rx, ry, rw, rh] = rect(box);
      ctx.strokeStyle = 'rgba(255,90,90,.95)'; ctx.fillStyle = 'rgba(255,90,90,.18)'; ctx.lineWidth = 2;
      ctx.fillRect(rx, ry, rw, rh); ctx.strokeRect(rx, ry, rw, rh);
      // corner resize handles
      ctx.fillStyle = 'rgba(255,220,120,.95)';
      for (const [cx, cy] of [[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]]) ctx.fillRect(cx - 4, cy - 4, 8, 8);
      ctx.fillStyle = 'rgba(255,90,90,.95)'; ctx.font = '10px monospace';
      ctx.fillText(`${moveId} hitbox — drag to move · corner to scale`, rx, ry - 5);
    }
    ctx.restore();
  }

  /** draw a special's projectile over the fighter. `flyFrac` 0 = static at the
   *  spawn point (for tuning), →1 travels right. World size is 72·projScale px
   *  (the in-game default is 72, exported as projectile.renderSize), so the
   *  preview matches the game; the collision box is drawn to the same basis. */
  private drawProjectile(ctx: CanvasRenderingContext2D, sp: SpecialDraft, W: number, floorY: number, drawH: number, flyFrac: number): void {
    const proj = this.m.job('proj:' + sp.id);
    const im = proj?.dataUrl ? this.img(proj.dataUrl) : null;
    if (!im) return;
    const rs = drawH / 384; // engine-px → preview-px
    const world = 72 * (sp.projScale ?? 1); // engine px (square, matches in-game)
    const sc = (world * rs) / Math.max(im.naturalWidth, im.naturalHeight);
    const pw = im.naturalWidth * sc, phh = im.naturalHeight * sc;
    const cx = W / 2 + (sp.projSpawnX ?? 96) * rs + flyFrac * W * 0.5;
    const cy = floorY + (sp.projSpawnY ?? -176) * rs;
    ctx.drawImage(im, cx - pw / 2, cy - phh / 2, pw, phh);
    if (sp.projBox) { const b = sp.projBox; ctx.strokeStyle = 'rgba(127,227,255,.85)'; ctx.lineWidth = 1.5; ctx.strokeRect(cx + b.x * rs, cy + b.y * rs, b.w * rs, b.h * rs); }
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

  /** draw the fighter with feet (image bottom) planted at (feetX, feetY), with an
   *  optional cell-space x/y realign offset. */
  private drawCharacter(ctx: CanvasRenderingContext2D, url: string, feetX: number, feetY: number, targetH: number, offX = 0, offY = 0): void {
    const im = this.img(url); if (!im) return;
    const s = targetH / im.naturalHeight; // cell-px → preview-px
    const dw = im.naturalWidth * s;
    ctx.drawImage(im, feetX - dw / 2 + offX * s, feetY - targetH + offY * s, dw, targetH);
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
    const c = document.createElement('canvas'); c.width = CELL_W; c.height = CELL_H;
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
