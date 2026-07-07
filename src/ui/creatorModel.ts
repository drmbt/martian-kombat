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

  /** everything the SHIP step would serialize (partial — scaffold view). */
  buildJson(): Record<string, unknown> {
    const d = this.draft;
    return {
      id: this.id,
      name: this.inputs.name.toUpperCase(),
      color: d?.color,
      lore: d?.lore,
      winQuotes: d?.winQuotes,
      ...(d?.physics ?? {}),
      scale: 1.0,
      specials: d?.specials.map((s) => ({ id: s.id, name: s.name, input: s.controls, archetype: s.archetype })),
      fatality: d?.fatality,
    };
  }
}
