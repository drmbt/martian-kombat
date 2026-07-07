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
}

export interface CreatorInputs {
  name: string;
  description: string;
  fullBodyDataUrl?: string;
  faceDataUrl?: string;
  voiceName?: string;
  stageImageDataUrl?: string;
}

export interface SpecialDraft {
  id: string;
  name: string;
  controls: string; // e.g. 'qcf+P'
  archetype: string; // catalog id
  description: string;
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
const STYLE =
  'Art style: hand-painted cel-shaded 2D anime fighter, bold clean line art, painterly cel shading. ' +
  'Full body head to toe, feet on an invisible ground line just above the bottom edge, centered, ' +
  'facing right. Background: solid flat chroma-key green (#00B140), completely uniform, no shadow, ' +
  'no floor, no text, no border.';

export const CANONICAL_PROMPT = (d: string): string =>
  `Full-body fighting-game character sheet of ${d}. Neutral confident standing pose, arms relaxed, ` +
  `facing right. ${STYLE}`;

export const PORTRAIT_PROMPT = (name: string): string =>
  `Head-and-shoulders portrait of ${name}, straight-on, neutral confident expression. ${STYLE}`;

export const KO_PROMPT = (name: string): string =>
  `${name} beaten and exhausted, head bowed, bruised, downcast. ${STYLE}`;

/** the 11 shared base cells the first sprite batch covers, with their pose text */
export const BASE_CELLS: { id: string; ref: 'canonical'; pose: string }[] = [
  { id: 'idle-a', ref: 'canonical', pose: 'relaxed fighting idle, weight settled, BOTH feet flat, guard loosely up. NOT an attack — no raised knee, kick or lunge.' },
  { id: 'idle-b', ref: 'canonical', pose: 'relaxed fighting idle, chest risen on the breath, BOTH feet flat. NOT an attack.' },
  { id: 'walk-a', ref: 'canonical', pose: 'mid-stride walk, left foot forward, torso upright, clearly distinct from idle.' },
  { id: 'walk-b', ref: 'canonical', pose: 'mid-stride walk, right foot forward, torso upright.' },
  { id: 'jump', ref: 'canonical', pose: 'airborne, knees tucked, the whole figure lifted off the ground.' },
  { id: 'crouch', ref: 'canonical', pose: 'squatting EXTREMELY low, knees folded, hips at heel height — the whole figure occupies ONLY the BOTTOM HALF of the frame.' },
  { id: 'block', ref: 'canonical', pose: 'guard up, forearms shielding the face and body, braced.' },
  { id: 'fall', ref: 'canonical', pose: 'knocked backward off balance, mid-air, arms flailing.' },
  { id: 'down', ref: 'canonical', pose: 'lying flat on the back on the ground — a HORIZONTAL shape along the BOTTOM QUARTER of the frame.' },
];

export const SPRITE_PROMPT = (name: string, pose: string): string =>
  `Same character as the reference — identical face, hair, outfit, colors and proportions. ${name}, ${pose} ${STYLE}`;

// ── deterministic client-side draft (real Gemini text is a follow-up) ───────
const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = (h ^ s.charCodeAt(i)) * 16777619;
  return h >>> 0;
};

const ARCHETYPES: { key: string; words: string[]; specials: Omit<SpecialDraft, 'id'>[] }[] = [
  { key: 'zoner', words: ['sand', 'illusion', 'mirage', 'dust', 'ghost', 'shadow', 'glitch', 'digital', 'wizard'],
    specials: [
      { name: 'Bolt', controls: 'qcf+P', archetype: 'projectile', description: 'ranged energy projectile' },
      { name: 'Step', controls: 'qcb+K', archetype: 'teleport', description: 'blink to reposition' },
      { name: 'Pillar', controls: 'dp+P', archetype: 'anti-air-dp', description: 'rising anti-air' },
      { name: 'Double', controls: 'qcf+K', archetype: 'advancing-rush', description: 'dash-in mixup' } ] },
  { key: 'grappler', words: ['strong', 'wrestle', 'grab', 'bear', 'heavy', 'chef', 'cook', 'staff'],
    specials: [
      { name: 'Grab', controls: 'hcb+P', archetype: 'command-grab', description: 'unblockable command throw' },
      { name: 'Charge', controls: 'qcf+K', archetype: 'advancing-rush', description: 'armored advance' },
      { name: 'Slam', controls: 'dp+P', archetype: 'anti-air-dp', description: 'anti-air smash' },
      { name: 'Quake', controls: 'qcb+K', archetype: 'reversal', description: 'ground pound reversal' } ] },
  { key: 'rushdown', words: ['fast', 'fire', 'acrobat', 'kick', 'flip', 'burn', 'hack', 'punk'],
    specials: [
      { name: 'Rush', controls: 'qcf+K', archetype: 'advancing-rush', description: 'fast advancing strike' },
      { name: 'Flurry', controls: 'mash+P', archetype: 'mash', description: 'rapid-hit barrage' },
      { name: 'Rise', controls: 'dp+K', archetype: 'anti-air-dp', description: 'flip-kick anti-air' },
      { name: 'Spark', controls: 'qcf+P', archetype: 'projectile', description: 'short-range projectile' } ] },
];

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
  const poolBase: Omit<SpecialDraft, 'id'>[] = [
    { name: 'Overdrive', controls: 'qcb+P', archetype: 'reversal', description: 'invincible reversal' },
    { name: 'Vortex', controls: 'hcf+P', archetype: 'projectile', description: 'spiralling projectile' },
    { name: 'Lunge', controls: 'qcf+K', archetype: 'advancing-rush', description: 'long-range lunge' },
    { name: 'Snare', controls: 'hcb+K', archetype: 'command-grab', description: 'ranged pull grab' },
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
      'Come back when you mean it.',
      'That was the warm-up.',
      'Dust to dust.',
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
export const CREATOR_STEPS = ['SEED', 'PROFILE', 'SPRITES', 'SPECIALS', 'RIG', 'POLISH', 'SHIP'] as const;
export type CreatorStep = typeof CREATOR_STEPS[number];

export function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'fighter';
}

export class CreatorModel {
  inputs: CreatorInputs = { name: '', description: '' };
  draft: DesignDraft | null = null;
  step = 0;
  jobs = new Map<string, CreatorJob>();

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
