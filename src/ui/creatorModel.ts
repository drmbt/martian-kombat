// Character Creator — in-browser working model.
// Holds everything the wizard assembles: the raw inputs, the (client-side,
// templated for now) design draft, the async job/asset table, and the growing
// CharacterDef. On WRITE this becomes <id>.json + meta.json + sheet.png. See
// docs/CHARACTER_CREATOR.md. All gen goes through /__editor/creator/gen, which
// mocks (client-drawn placeholders) when GEMINI_API_KEY is absent so the whole
// flow is walkable with zero setup.

export type JobStatus = 'pending' | 'running' | 'done' | 'error';

/** one generated (or generating) asset — a canonical, a portrait, a sprite cell… */
export interface CreatorJob {
  key: string; // stable id, e.g. 'canonical', 'portrait', 'sprite:idle-a'
  kind: string; // 'canonical' | 'portrait' | 'ko' | 'stage' | 'sprite'
  label: string;
  status: JobStatus;
  prompt?: string;
  dataUrl?: string; // the returned image (real or mock placeholder)
  mock?: boolean;
  approved?: boolean;
  error?: string;
  scale?: number; // per-cell render scale (editor size-match tweak; default 1)
  offX?: number; // per-cell x/y realign offset in CELL pixels (288x384 space)
  offY?: number;
  savedAs?: string; // filename under assets/raw/creator/<id>/img/ (live-save/resume)
  startedAt?: number; // ms epoch when this gen kicked off (elapsed display)
}

export interface UploadedFile {
  dataUrl: string;
  name: string;
}

export interface CreatorInputs {
  name: string;
  description: string;
  /** all drop-zone inputs are arrays so items are individually removable and
   *  survive a panel re-render (the zone renders from the model, not closure state) */
  referencePhotos?: UploadedFile[]; // [0] = full body, extras = face/other refs
  stagePhotos?: UploadedFile[];
  /** BYO assets — used at SHIP time in place of generated/placeholder audio */
  voiceSamples?: UploadedFile[]; // for voice cloning
  kiaiClips?: UploadedFile[]; // BYO kiai/hurt/victory VO
  musicTracks?: UploadedFile[]; // BYO stage music
}

export interface SpecialDraft {
  id: string;
  name: string;
  controls: string; // e.g. 'qcf+P'
  archetype: string; // catalog id
  description: string;
  approved?: boolean; // lock the kit before spending gen calls on its sprites
}

export interface DesignDraft {
  color: string;
  archetype: string;
  lore: { tagline: string; personality: string; backstory: string };
  winQuotes: string[];
  vo: { kiai: string[]; hurt: string[]; victory: string[] };
  specials: SpecialDraft[];
  specialPool: SpecialDraft[];
  physics: { health: number; walkSpeed: number; backSpeed: number; jumpVel: number; gravity: number; prejumpFrames: number };
  fatality: { id: string; name: string; input: string };
  stagePrompt: string;
  musicPrompt: string;
}

// ── prompt templates (docs/CHARACTER_CREATOR.md §14) ────────────────────────
const STYLE_ART = 'Art style: hand-painted cel-shaded 2D anime fighter, bold clean line art, painterly cel shading.';
const STYLE_BG = 'Background: solid flat chroma-key green (#00B140), completely uniform, no shadow, no floor, no text, no border.';
// full-body frame rules (canonical + sprite cells ONLY — never portraits)
const STYLE =
  `${STYLE_ART} Full body head to toe at the SAME scale and camera distance as the reference image — ` +
  `the top of the head near the top edge and the soles of the feet on an invisible ground line just ` +
  `above the bottom edge, the figure filling the frame vertically the same amount as the reference, ` +
  `centered horizontally, facing right. ${STYLE_BG}`;

export const CANONICAL_PROMPT = (d: string): string =>
  `Full-body fighting-game character sheet of ${d}. Neutral confident standing pose, arms relaxed, ` +
  `facing right. ${STYLE}`;

// selection icon: a TIGHT bust — must NOT inherit the full-body frame rules.
export const PORTRAIT_PROMPT = (name: string, desc: string): string =>
  `Tight head-and-shoulders BUST portrait of ${name} (${desc}) for a fighting-game character-select ` +
  `icon. ONLY the head and shoulders fill the frame — face straight-on toward the viewer, direct gaze, ` +
  `neutral confident expression, top of the head near the top edge, shoulders cropped at the bottom edge. ` +
  `This is a close-up: do NOT show a full body, do NOT show the torso below the chest, hands, legs or ` +
  `feet, do NOT zoom out. ${STYLE_ART} ${STYLE_BG}`;

export const KO_PROMPT = (name: string, desc: string): string =>
  `Tight head-and-shoulders BUST portrait of ${name} (${desc}), beaten and exhausted, head bowed, ` +
  `bruised, downcast. Close-up on the head and shoulders only — no full body, torso, hands or legs. ` +
  `${STYLE_ART} ${STYLE_BG}`;

/** the shared base cells the first batch covers (pipeline order: the same order
 *  the raw frames are numbered — idle/walk/crouch/jump/block/hit/fall/down). */
export const BASE_CELLS: { id: string; ref: 'canonical'; pose: string }[] = [
  { id: 'idle-a', ref: 'canonical', pose: 'relaxed fighting idle, weight settled, BOTH feet flat, guard loosely up. NOT an attack — no raised knee, kick or lunge.' },
  { id: 'idle-b', ref: 'canonical', pose: 'relaxed fighting idle, chest risen on the breath, BOTH feet flat. NOT an attack.' },
  { id: 'walk-a', ref: 'canonical', pose: 'walking forward, mid-stride: the LEFT leg lifted and striding FORWARD with a bent knee, the RIGHT leg trailing BEHIND and extended, weight shifting onto the front foot, arms swinging in opposition. A clear exaggerated walk-cycle step — NOT a neutral standing pose.' },
  { id: 'walk-b', ref: 'canonical', pose: 'walking forward, the OPPOSITE step of the other walk frame: the RIGHT leg lifted and striding FORWARD with a bent knee, the LEFT leg trailing BEHIND and extended, opposite arm swing. Legs clearly in a DIFFERENT position from the first walk frame.' },
  { id: 'crouch', ref: 'canonical', pose: 'squatting EXTREMELY low, knees folded, hips at heel height — the whole figure occupies ONLY the BOTTOM HALF of the frame.' },
  { id: 'jump', ref: 'canonical', pose: 'airborne, knees tucked, the whole figure lifted off the ground.' },
  { id: 'block', ref: 'canonical', pose: 'guard up, forearms shielding the face and body, braced.' },
  { id: 'hit', ref: 'canonical', pose: 'a HIT reaction — recoiling from a blow, head snapped back, torso twisted away, off balance, one arm flailing up. NOT an attack, NOT a block.' },
  { id: 'fall', ref: 'canonical', pose: 'knocked backward off balance, mid-air, arms flailing.' },
  { id: 'down', ref: 'canonical', pose: 'lying flat on the back on the ground — a HORIZONTAL shape along the BOTTOM QUARTER of the frame.' },
];

/** one sheet cell of an attack, with the base image to condition on and a
 *  DISTINCT per-phase pose (startup wind-up → active impact → recovery return),
 *  so attacks read as real 3-frame animations, not a held pose. `move` is the
 *  owning move id (for auto-hitbox lookup by the active cell). */
export interface AttackCell { name: string; move: string; ref: 'canonical' | 'crouch' | 'jump'; pose: string; active: boolean }
// FightScene cell contract: standing = startup/active/recovery, crouch = active
// (covers startup) + recovery, air = a single cell. Only generate what it reads.
const phases = (id: string, ref: 'canonical' | 'crouch' | 'jump', desc: string, low = false): AttackCell[] => {
  const stance = low ? 'staying in a LOW crouch (copy the reference body height, do NOT stand up), ' : ref === 'jump' ? 'airborne off the ground (copy the airborne framing of the reference), ' : '';
  const out: AttackCell[] = [];
  if (ref === 'canonical') out.push({ name: `${id}-startup`, move: id, ref, active: false, pose: `${stance}winding up to throw ${desc} — the frame just BEFORE the strike, weight loaded back, limb cocked` });
  out.push({ name: ref === 'jump' ? id : `${id}-active`, move: id, ref, active: true, pose: `${stance}${desc} at FULL extension — the point of impact, committed forward` });
  if (ref !== 'jump') out.push({ name: `${id}-recovery`, move: id, ref, active: false, pose: `${stance}recovering from ${desc} — the striking limb retracting back toward guard` });
  return out;
};
export const ATTACK_CELLS: AttackCell[] = [
  ...phases('lp', 'canonical', 'a fast straight jab with the lead hand at head height'),
  ...phases('mp', 'canonical', 'a strong straight punch, arm fully extended forward'),
  ...phases('hp', 'canonical', 'a heavy committed hook punch, whole body behind it'),
  ...phases('lk', 'canonical', 'a quick front snap kick, lead leg forward at mid height'),
  ...phases('mk', 'canonical', 'a strong roundhouse kick at mid height'),
  ...phases('hk', 'canonical', 'a heavy high roundhouse kick, leg swung up high'),
  ...phases('clp', 'crouch', 'a short quick punch forward', true),
  ...phases('cmp', 'crouch', 'a strong rising punch forward', true),
  ...phases('chp', 'crouch', 'a rising uppercut punch', true),
  ...phases('clk', 'crouch', 'a short low kick along the ground', true),
  ...phases('cmk', 'crouch', 'a sweeping mid kick, leg out low', true),
  ...phases('chk', 'crouch', 'a low sweep kick, back leg fully extended', true),
  ...phases('jlp', 'jump', 'a downward air punch'),
  ...phases('jmp', 'jump', 'a strong downward air punch'),
  ...phases('jhp', 'jump', 'a heavy diving punch'),
  ...phases('jlk', 'jump', 'a quick downward air kick'),
  ...phases('jmk', 'jump', 'a strong jumping kick, leg out'),
  ...phases('jhk', 'jump', 'a heavy diving kick, leg extended downward'),
];
/** special phase cells for the 4 draft specials (built at runtime from the draft). */
export const specialCells = (id: string, name: string, desc: string): AttackCell[] => [
  { name: `${id}-startup`, move: id, ref: 'canonical', active: false, pose: `winding up for the special move "${name}" (${desc}) — gathering power, the frame just before release` },
  { name: `${id}-active`, move: id, ref: 'canonical', active: true, pose: `performing "${name}" (${desc}) at the moment of release/impact — a dynamic committed action pose` },
  { name: `${id}-recovery`, move: id, ref: 'canonical', active: false, pose: `recovering from "${name}" — settling back toward a neutral stance` },
];

export const SPRITE_PROMPT = (name: string, pose: string): string =>
  `Same character as the reference — identical face, hair, outfit, colors and proportions, drawn at ` +
  `EXACTLY the same size, height and framing as the reference image (do NOT zoom in or out, do NOT ` +
  `resize the character between frames — the head and feet reach the same edges every frame). ${name}, ${pose} ${STYLE}`;

// ── deterministic client-side draft (real Gemini text is a follow-up) ───────
const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = (h ^ s.charCodeAt(i)) * 16777619;
  return h >>> 0;
};

const ARCHETYPES: { key: string; label: string; desc: string; words: string[]; specials: Omit<SpecialDraft, 'id'>[] }[] = [
  { key: 'zoner', label: 'Zoner', desc: 'keep-away — projectiles + a teleport + anti-air; controls space from range',
    words: ['sand', 'illusion', 'mirage', 'dust', 'ghost', 'shadow', 'glitch', 'digital', 'wizard'],
    specials: [
      { name: 'Bolt', controls: 'qcf+P', archetype: 'projectile', description: 'ranged energy projectile' },
      { name: 'Step', controls: 'qcb+K', archetype: 'teleport', description: 'blink to reposition' },
      { name: 'Pillar', controls: 'dp+P', archetype: 'anti-air-dp', description: 'rising anti-air' },
      { name: 'Double', controls: 'qcf+K', archetype: 'advancing-rush', description: 'dash-in mixup' } ] },
  { key: 'grappler', label: 'Grappler', desc: 'close-range bruiser — command grabs + armored advance; wants to get in',
    words: ['strong', 'wrestle', 'grab', 'bear', 'heavy', 'chef', 'cook', 'staff'],
    specials: [
      { name: 'Grab', controls: 'hcb+P', archetype: 'command-grab', description: 'unblockable command throw' },
      { name: 'Charge', controls: 'qcf+K', archetype: 'advancing-rush', description: 'armored advance' },
      { name: 'Slam', controls: 'dp+P', archetype: 'anti-air-dp', description: 'anti-air smash' },
      { name: 'Quake', controls: 'qcb+K', archetype: 'reversal', description: 'ground pound reversal' } ] },
  { key: 'rushdown', label: 'Rushdown', desc: 'fast pressure — advancing rushes + a mash barrage; relentless offense',
    words: ['fast', 'fire', 'acrobat', 'kick', 'flip', 'burn', 'hack', 'punk'],
    specials: [
      { name: 'Rush', controls: 'qcf+K', archetype: 'advancing-rush', description: 'fast advancing strike' },
      { name: 'Flurry', controls: 'mash+P', archetype: 'mash', description: 'rapid-hit barrage' },
      { name: 'Rise', controls: 'dp+K', archetype: 'anti-air-dp', description: 'flip-kick anti-air' },
      { name: 'Spark', controls: 'qcf+P', archetype: 'projectile', description: 'short-range projectile' } ] },
  { key: 'all-rounder', label: 'All-rounder', desc: 'balanced — one of each: projectile, anti-air, advancing rush, grab',
    words: ['balanced', 'monk', 'martial', 'yogi', 'tai'],
    specials: [
      { name: 'Bolt', controls: 'qcf+P', archetype: 'projectile', description: 'ranged projectile' },
      { name: 'Rise', controls: 'dp+P', archetype: 'anti-air-dp', description: 'rising anti-air' },
      { name: 'Dash', controls: 'qcf+K', archetype: 'advancing-rush', description: 'advancing strike' },
      { name: 'Clinch', controls: 'hcb+P', archetype: 'command-grab', description: 'command grab' } ] },
  { key: 'trickster', label: 'Trickster', desc: 'evasive mixups — teleports, a reversal, and an odd projectile',
    words: ['trick', 'clown', 'chaos', 'gambler', 'jester', 'con'],
    specials: [
      { name: 'Blink', controls: 'qcb+K', archetype: 'teleport', description: 'teleport behind' },
      { name: 'Hex', controls: 'qcf+P', archetype: 'projectile', description: 'curved projectile' },
      { name: 'Reversal', controls: 'qcb+P', archetype: 'reversal', description: 'invincible reversal' },
      { name: 'Snap', controls: 'hcf+P', archetype: 'advancing-rush', description: 'lunge mixup' } ] },
];

/** the archetype picker's options (label + description) — drives the dropdown. */
export const ARCHETYPE_INFO: { key: string; label: string; desc: string }[] = ARCHETYPES.map((a) => ({ key: a.key, label: a.label, desc: a.desc }));

const mkSpecials = (list: Omit<SpecialDraft, 'id'>[]): SpecialDraft[] =>
  list.map((s) => ({ ...s, id: s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') }));

/** the default 4 specials for an archetype key (used on archetype change). */
export function specialsForArchetype(key: string): SpecialDraft[] {
  const a = ARCHETYPES.find((x) => x.key === key) ?? ARCHETYPES[0];
  return mkSpecials(a.specials);
}

/** the buildable SPECIAL-MOVE archetypes (the move-authoring catalog). The
 *  descriptions are user guidance ONLY — never sent to the image/text model.
 *  `controls` lists the sensible motion+button inputs for that archetype. */
export const SPECIAL_ARCHETYPES: { key: string; label: string; desc: string; controls: string[] }[] = [
  { key: 'projectile', label: 'Projectile', desc: 'a ranged projectile thrown across the screen (fireball)', controls: ['qcf+P', 'qcf+K', 'hcf+P'] },
  { key: 'anti-air-dp', label: 'Anti-air (DP)', desc: 'a rising, invincible reversal that swats jumpers (dragon punch)', controls: ['dp+P', 'dp+K'] },
  { key: 'command-grab', label: 'Command grab', desc: 'an unblockable throw at close range', controls: ['hcb+P', '360+P'] },
  { key: 'advancing-rush', label: 'Advancing rush', desc: 'a forward-moving strike that closes distance', controls: ['qcf+K', 'hcf+K'] },
  { key: 'reversal', label: 'Reversal', desc: 'an invincible wake-up attack that beats pressure', controls: ['qcb+P', 'qcb+K'] },
  { key: 'teleport', label: 'Teleport', desc: 'blink behind or away to reposition (deals no damage)', controls: ['qcb+K', 'qcf+K'] },
  { key: 'mash', label: 'Mash barrage', desc: 'a rapid multi-hit flurry (mash the button, e.g. lightning legs)', controls: ['mash+P', 'mash+K'] },
];

export function controlsForArchetype(key: string): string {
  return (SPECIAL_ARCHETYPES.find((a) => a.key === key)?.controls[0]) ?? 'qcf+P';
}

/** the 18 button-normal move ids (for the per-move animation player). */
export const NORMAL_MOVE_IDS = ['lp', 'mp', 'hp', 'lk', 'mk', 'hk', 'clp', 'cmp', 'chp', 'clk', 'cmk', 'chk', 'jlp', 'jmp', 'jhp', 'jlk', 'jmk', 'jhk'];

/** the phase sheet-cells for a move, in play order (matches ATTACK_CELLS naming). */
export function moveCellNames(moveId: string, special: boolean): string[] {
  if (special) return [`${moveId}-startup`, `${moveId}-active`, `${moveId}-recovery`];
  if (moveId.startsWith('j')) return [moveId]; // air = single cell
  if (moveId.startsWith('c')) return [`${moveId}-active`, `${moveId}-recovery`]; // crouch = active + recovery
  return [`${moveId}-startup`, `${moveId}-active`, `${moveId}-recovery`]; // standing
}

const pickArchetype = (desc: string): typeof ARCHETYPES[number] => {
  const d = desc.toLowerCase();
  for (const a of ARCHETYPES) if (a.words.some((w) => d.includes(w))) return a;
  return ARCHETYPES[0];
};

export function makeDraft(name: string, description: string): DesignDraft {
  const N = name.toUpperCase();
  const arch = pickArchetype(description);
  const hue = hash(name) % 360;
  const color = `hsl(${hue} 55% 62%)`;
  const mk = (list: Omit<SpecialDraft, 'id'>[]): SpecialDraft[] =>
    list.map((s) => ({ ...s, id: s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') }));
  const specials = mk(arch.specials);
  // extra candidates across every archetype — the "safety" moves to swap in
  const poolBase: Omit<SpecialDraft, 'id'>[] = [
    { name: 'Overdrive', controls: 'qcb+P', archetype: 'reversal', description: 'an invincible reversal' },
    { name: 'Vortex', controls: 'hcf+P', archetype: 'projectile', description: 'a spiralling projectile' },
    { name: 'Lunge', controls: 'qcf+K', archetype: 'advancing-rush', description: 'a long-range lunge' },
    { name: 'Snare', controls: 'hcb+P', archetype: 'command-grab', description: 'a close-range grab' },
    { name: 'Uppercut', controls: 'dp+P', archetype: 'anti-air-dp', description: 'a rising anti-air' },
    { name: 'Fade', controls: 'qcb+K', archetype: 'teleport', description: 'a teleport to reposition' },
    { name: 'Barrage', controls: 'mash+P', archetype: 'mash', description: 'a rapid multi-hit flurry' },
    { name: 'Comet', controls: 'qcf+P', archetype: 'projectile', description: 'a fast straight projectile' },
  ];
  return {
    color,
    archetype: arch.key,
    lore: {
      tagline: `They call ${N}.`,
      personality: description,
      backstory: `A Martian of Bombay Beach — ${description}. (edit me: arcade backstory)`,
    },
    winQuotes: [
      `${N} wins. Obviously.`,
      'You fought well. You still lost.',
      'The desert always collects.',
    ],
    vo: {
      kiai: ['Hah!', 'Rrragh!', 'Take this!', 'Come on!', 'Hyah!', 'Now!'],
      hurt: ['Ugh!', 'Gah!', 'Nngh!', 'No!', 'Aagh!', 'Tch!'],
      victory: ['Too easy.', 'Next.', 'Predictable.', 'Done.'],
    },
    specials,
    specialPool: mk(poolBase),
    physics: { health: 1000, walkSpeed: 3.3, backSpeed: 3.4, jumpVel: 18, gravity: 0.9, prejumpFrames: 4 },
    fatality: { id: 'finish', name: `${N} Finish`, input: 'hcb+P' },
    stagePrompt:
      'A Bombay Beach / Mars College desert locale, redraw as gritty 16-bit retro pixel-art anchored ' +
      'on the salton style reference. 21:9. The bottom quarter is a continuous textured walkable ground ' +
      'plane, edge to edge, touching the bottom of the frame; no props or people in the fighter strip.',
    musicPrompt:
      `A loopable ~75s instrumental battle theme for ${N}'s desert stage. Gritty desert dub-techno, ` +
      'mid-tempo ~92 BPM, strong rhythmic loop, no vocals, clean loop point, mixed to sit under SFX.',
  };
}

// ── the model ───────────────────────────────────────────────────────────────
export const CREATOR_STEPS = ['SEED', 'PROFILE', 'MOVES', 'RIG', 'POLISH', 'SHIP'] as const;
export type CreatorStep = typeof CREATOR_STEPS[number];

export function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'fighter';
}

export class CreatorModel {
  inputs: CreatorInputs = { name: '', description: '' };
  draft: DesignDraft | null = null;
  step = 0;
  jobs = new Map<string, CreatorJob>();
  /** clip name (announcer, kiai-1..6, hurt-1..6, victory-1..4) -> base64 mp3 */
  generatedVo: Record<string, string> = {};
  generatedMusic?: string; // base64 mp3
  generatedFatality: string[] = []; // 4 base64 jpg panels
  voiceModelId?: string; // Fish clone reference id (if the user cloned a voice)
  skeletons: Record<string, Record<string, [number, number, number]>> = {}; // cellName -> DWPose joints
  autoHitboxes: Record<string, { x: number; y: number; w: number; h: number }> = {}; // moveId -> engine hitbox
  voStatus: 'idle' | 'running' | 'done' | 'error' = 'idle';
  musicStatus: 'idle' | 'running' | 'done' | 'error' = 'idle';
  fatalityStatus: 'idle' | 'running' | 'done' | 'error' = 'idle';
  cloneStatus: 'idle' | 'running' | 'done' | 'error' = 'idle';
  rigStatus: 'idle' | 'running' | 'done' | 'error' = 'idle';

  /** all special phase cells for the draft (startup/active/recovery × each special). */
  specialCellList(): AttackCell[] {
    return (this.draft?.specials ?? []).flatMap((s) => specialCells(s.id, s.name, s.description));
  }

  /** every sheet cell → the job whose image fills it (base + attack phases + specials).
   *  Each phase cell is its own generated frame now (real 3-frame animations). */
  sheetPlan(): { name: string; jobKey: string }[] {
    const plan: { name: string; jobKey: string }[] = [];
    const add = (name: string): void => { if (this.job('sprite:' + name)?.status === 'done') plan.push({ name, jobKey: 'sprite:' + name }); };
    for (const c of BASE_CELLS) add(c.id);
    for (const c of ATTACK_CELLS) add(c.name);
    for (const c of this.specialCellList()) add(c.name);
    return plan;
  }

  /** every attack/special cell that should be generated (for progress counts). */
  allAttackCells(): AttackCell[] {
    return [...ATTACK_CELLS, ...this.specialCellList()];
  }

  /** the full ordered sheet-cell name list (base → attacks → specials). */
  cellOrder(): string[] {
    return [...BASE_CELLS.map((c) => c.id), ...ATTACK_CELLS.map((c) => c.name), ...this.specialCellList().map((c) => c.name)];
  }

  /** raw-frame filename base for a job, matching the pipeline (`NN-cellname`);
   *  canonical/portrait/stage keep their key. Extension added by the server. */
  frameNameFor(key: string): string {
    if (key.startsWith('proj:')) return 'projectile-' + key.slice('proj:'.length);
    if (!key.startsWith('sprite:')) return key;
    const name = key.slice('sprite:'.length);
    const i = this.cellOrder().indexOf(name);
    return (i >= 0 ? String(i).padStart(2, '0') + '-' : '') + name;
  }

  /** final VO map for the SHIP write: BYO clips override generated ones, slot by slot. */
  finalVoClips(): Record<string, string> {
    const out = { ...this.generatedVo };
    const byo = this.inputs.kiaiClips ?? [];
    const slots = ['kiai-1', 'kiai-2', 'kiai-3', 'kiai-4', 'kiai-5', 'kiai-6', 'hurt-1', 'hurt-2', 'hurt-3', 'hurt-4', 'hurt-5', 'hurt-6', 'victory-1', 'victory-2', 'victory-3', 'victory-4'];
    byo.forEach((f, i) => { if (slots[i]) out[slots[i]] = f.dataUrl.includes(',') ? f.dataUrl.split(',')[1] : f.dataUrl; });
    return out;
  }

  finalMusic(): string | undefined {
    const byo = this.inputs.musicTracks?.[0];
    if (byo) return byo.dataUrl.includes(',') ? byo.dataUrl.split(',')[1] : byo.dataUrl;
    return this.generatedMusic;
  }

  get id(): string {
    return slugify(this.inputs.name);
  }

  job(key: string): CreatorJob | undefined {
    return this.jobs.get(key);
  }

  upsertJob(j: CreatorJob): void {
    this.jobs.set(j.key, j);
  }

  /** compact preview of the assembled JSON (stub steps show this). */
  buildJson(): Record<string, unknown> {
    return this.buildFullCharacter();
  }

  /** the complete, engine-valid CharacterDef the SHIP step writes to disk. */
  buildFullCharacter(): Record<string, unknown> {
    this.draft ??= makeDraft(this.inputs.name, this.inputs.description);
    const d = this.draft;
    const moves: Record<string, unknown> = {};
    for (const [key, m] of Object.entries(NORMAL_MOVES)) moves[key] = { ...m };
    moves.throw = { startup: 3, active: 2, recovery: 20, damage: 0, hitstun: 0, blockstun: 0, knockback: 6, hitbox: null, height: 'mid', grab: { range: 64 }, techable: true };
    for (const s of d.specials) moves[s.id] = buildSpecial(s);
    // overlay skeleton-derived hitboxes (RIG step) over the heuristic defaults
    for (const [moveId, box] of Object.entries(this.autoHitboxes)) {
      const mv = moves[moveId] as { hitbox?: unknown } | undefined;
      if (mv && mv.hitbox !== null) mv.hitbox = box; // keep null for pure-projectile specials
    }
    return {
      id: this.id,
      name: this.inputs.name.toUpperCase(),
      color: hslToHex(d.color),
      lore: d.lore,
      winQuotes: d.winQuotes,
      health: d.physics.health,
      walkSpeed: d.physics.walkSpeed,
      backSpeed: d.physics.backSpeed,
      jumpVel: d.physics.jumpVel,
      gravity: d.physics.gravity,
      prejumpFrames: d.physics.prejumpFrames,
      scale: 1.0,
      spriteOffsetY: -12,
      bodyBox: { x: -42, y: -240, w: 84, h: 240 },
      hurtStand: { x: -52, y: -256, w: 104, h: 256 },
      hurtCrouch: { x: -52, y: -150, w: 104, h: 150 },
      moves,
      fatality: { id: d.fatality.id, name: d.fatality.name, input: parseControls(d.fatality.input), panels: 4 },
    };
  }

  /** meta.json frame list for the sheet the SHIP step composites (base cells only). */
  baseCellNames(): string[] {
    return BASE_CELLS.map((c) => c.id).filter((id) => this.job('sprite:' + id)?.status === 'done');
  }
}

// ── engine-valid default kit ────────────────────────────────────────────────
type MoveTpl = { startup: number; active: number; recovery: number; damage: number; hitstun: number; blockstun: number; knockback: number; hitbox: { x: number; y: number; w: number; h: number } | null; height: 'mid' | 'low' | 'high' };
const strike = (st: number, ac: number, rc: number, dmg: number, box: MoveTpl['hitbox'], height: MoveTpl['height'] = 'mid'): MoveTpl =>
  ({ startup: st, active: ac, recovery: rc, damage: dmg, hitstun: dmg >= 65 ? 20 : dmg >= 45 ? 16 : 12, blockstun: dmg >= 65 ? 14 : 9, knockback: dmg >= 65 ? 8 : dmg >= 45 ? 5 : 3, hitbox: box, height });

/** the 18 button normals — reasonable SF2-ish frame data + heuristic hitboxes. */
const NORMAL_MOVES: Record<string, MoveTpl> = {
  lp: strike(4, 3, 8, 30, { x: 44, y: -204, w: 60, h: 36 }), mp: strike(7, 4, 13, 50, { x: 52, y: -198, w: 74, h: 46 }), hp: strike(10, 4, 18, 75, { x: 58, y: -192, w: 86, h: 54 }),
  lk: strike(5, 3, 9, 32, { x: 48, y: -128, w: 66, h: 42 }), mk: strike(8, 4, 14, 52, { x: 56, y: -118, w: 80, h: 50 }), hk: strike(11, 4, 19, 78, { x: 62, y: -206, w: 90, h: 58 }),
  clp: strike(4, 3, 8, 28, { x: 42, y: -132, w: 58, h: 34 }), cmp: strike(7, 4, 13, 48, { x: 50, y: -120, w: 72, h: 44 }), chp: strike(9, 4, 17, 70, { x: 44, y: -230, w: 66, h: 110 }),
  clk: strike(5, 3, 9, 30, { x: 44, y: -34, w: 70, h: 34 }, 'low'), cmk: strike(8, 4, 14, 50, { x: 54, y: -30, w: 84, h: 32 }, 'low'), chk: strike(11, 5, 20, 74, { x: 50, y: -26, w: 96, h: 30 }, 'low'),
  jlp: strike(4, 6, 6, 30, { x: 30, y: -160, w: 58, h: 46 }, 'high'), jmp: strike(6, 6, 8, 50, { x: 34, y: -150, w: 72, h: 54 }, 'high'), jhp: strike(8, 6, 10, 72, { x: 38, y: -144, w: 84, h: 60 }, 'high'),
  jlk: strike(4, 6, 6, 32, { x: 36, y: -140, w: 60, h: 52 }, 'high'), jmk: strike(6, 6, 8, 52, { x: 42, y: -128, w: 76, h: 58 }, 'high'), jhk: strike(9, 6, 10, 76, { x: 46, y: -120, w: 88, h: 64 }, 'high'),
};

const BUTTON: Record<string, 'punch' | 'kick'> = { p: 'punch', k: 'kick' };
export function parseControls(controls: string): { motion?: string; button: string; mash?: number } {
  const [rawMotion, rawBtn] = controls.toLowerCase().split('+');
  const button = BUTTON[(rawBtn ?? 'p').trim()[0]] ?? 'punch';
  const motions = new Set(['qcf', 'qcb', 'bf', 'dp', 'hcb', 'hcf', '360', 'du']);
  const m = rawMotion.trim();
  if (m === 'mash') return { button, mash: 5 };
  return { motion: motions.has(m) ? m : 'qcf', button };
}

function buildSpecial(s: SpecialDraft): Record<string, unknown> {
  const input = parseControls(s.controls);
  const base = { name: s.name, input, height: 'mid' as const };
  switch (s.archetype) {
    case 'projectile':
      return { ...base, startup: 13, active: 2, recovery: 24, damage: 0, hitstun: 0, blockstun: 0, knockback: 0, hitbox: null,
        projectile: { vx: 9, spawnX: 96, spawnY: -176, box: { x: -28, y: -28, w: 56, h: 56 }, damage: 60, hitstun: 18, blockstun: 12, knockback: 9 } };
    case 'teleport':
      return { ...base, startup: 10, active: 1, recovery: 18, damage: 0, hitstun: 0, blockstun: 0, knockback: 0, hitbox: null, teleport: { mode: 'behind' }, invulnFrom: 6, invuln: 12 };
    case 'anti-air-dp':
      return { ...base, startup: 5, active: 8, recovery: 22, damage: 80, hitstun: 20, blockstun: 12, knockback: 8, knockdown: true, hitbox: { x: 20, y: -244, w: 72, h: 120 }, leap: { vx: 4, vy: 16 }, invuln: 8 };
    case 'advancing-rush':
      return { ...base, startup: 9, active: 4, recovery: 20, damage: 70, hitstun: 18, blockstun: 12, knockback: 8, hitbox: { x: 50, y: -184, w: 92, h: 72 }, forwardVel: 10 };
    case 'command-grab':
      return { ...base, startup: 6, active: 2, recovery: 26, damage: 100, hitstun: 0, blockstun: 0, knockback: 8, hitbox: null, grab: { range: 72 }, knockdown: true };
    case 'reversal':
      return { ...base, startup: 3, active: 6, recovery: 26, damage: 70, hitstun: 18, blockstun: 12, knockback: 10, knockdown: true, hitbox: { x: 30, y: -224, w: 72, h: 120 }, invuln: 10 };
    case 'mash':
      return { ...base, startup: 6, active: 12, recovery: 16, damage: 12, hitstun: 8, blockstun: 6, knockback: 2, hitbox: { x: 46, y: -154, w: 74, h: 42 }, rehit: 4 };
    default:
      return { ...base, startup: 12, active: 3, recovery: 20, damage: 60, hitstun: 16, blockstun: 10, knockback: 6, hitbox: { x: 50, y: -184, w: 80, h: 60 } };
  }
}

/** hsl(H S% L%) → #rrggbb (character color is stored as hex in the JSON). */
export function hslToHex(hsl: string): string {
  const m = /hsl\(([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\)/.exec(hsl);
  if (!m) return hsl.startsWith('#') ? hsl : '#8b5cf6';
  const h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100;
  const f = (n: number): number => {
    const k = (n + h * 12) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c);
  };
  const hex = (n: number): string => n.toString(16).padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}
