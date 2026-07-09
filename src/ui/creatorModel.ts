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
  prevDataUrl?: string; // the image this frame REPLACED on the last regen (undo)
  prevMock?: boolean; // whether prevDataUrl was a mock placeholder
  undone?: boolean; // true while showing the reverted (previous) frame (relabel redo)
}

export interface UploadedFile {
  dataUrl: string;
  name: string;
}

export interface CreatorInputs {
  name: string;
  description: string;
  /** optional free-text lore/backstory entered at Seed; overrides the drafted
   *  backstory in the exported character when set */
  lore?: string;
  /** all drop-zone inputs are arrays so items are individually removable and
   *  survive a panel re-render (the zone renders from the model, not closure state) */
  referencePhotos?: UploadedFile[]; // [0] = full body, extras = face/other refs
  stagePhotos?: UploadedFile[];
  stageMode?: 'generated' | 'existing' | 'none';
  stageId?: string;
  stageName?: string;
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
  // projectile render/collision tuning (stick on export → the projectile JSON)
  projScale?: number; // render size multiplier
  projSpawnX?: number; // engine spawn offset from feet (x forward)
  projSpawnY?: number; // engine spawn offset from feet (y up = negative)
  projBox?: { x: number; y: number; w: number; h: number }; // collision box (auto from alpha)
  projPrompt?: string; // edited projectile-art prompt (overrides the auto one on regen)
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
  /** arcade-mode story (STUB feature — the mode itself isn't built yet):
   *  the SF2-style intro motivation + the post-credits ending shown when the
   *  fighter beats Tao and becomes Champion of the Bombay Beach Biennale */
  arcade: { motivation: string; ending: string };
  stagePrompt: string;
  musicPrompt: string;
}

// ── prompt templates ─────────────────────────────────────────────────────────
// The prompt craft lives in tools/core/prompts.mjs + cells.mjs — ONE library
// shared with the CLI pipeline (gen-frames/gen-canonical), so canon fighters
// and creator fighters are prompted identically (docs/CHARACTER_STUDIO.md C2).
import { CELLS } from '../../tools/core/cells.mjs';
import { applyKitGrammar } from '../../tools/core/kit.mjs';
import {
  spritePrompt, canonicalFromDescription, portraitPrompt, defeatPrompt,
  fatalityBeats as coreFatalityBeats,
} from '../../tools/core/prompts.mjs';

export const CANONICAL_PROMPT = (d: string): string => canonicalFromDescription(d);

// selection icon: a TIGHT bust — must NOT inherit the full-body frame rules.
export const PORTRAIT_PROMPT = (name: string, desc: string): string => portraitPrompt(name, desc);

/** the 4 default fatality panel BEATS (one copy in core/prompts.mjs — the
 *  /creator/fatality endpoint wraps each in the shared cinematic frame). */
export const fatalityBeats = (name: string, fatalityName: string): string[] =>
  coreFatalityBeats(name, fatalityName);

/** beaten defeated bust — reference-based (the canonical rides along as an
 *  image ref), same prompt the CLI KO pass uses */
export const KO_PROMPT = (_name: string, _desc: string): string => defeatPrompt();

/** the shared base cells the first batch covers — THE pipeline cell library
 *  (tools/core/cells.mjs), so creator fighters get the same battle-hardened
 *  pose strings (idle-flicker pins, walk strides, LOW/LYING geometry) the
 *  canon roster generates from. */
export const BASE_CELLS: { id: string; ref: 'canonical'; pose: string }[] =
  CELLS.map((c) => ({ id: c.id, ref: 'canonical' as const, pose: c.pose }));

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
  ...phases('throw', 'canonical', 'a close-range fighting-game throw: reaching forward to grab and hurl an unseen opponent through empty air. COMPLETELY ALONE, no second person, no clone'),
];
/** special phase cells for the 4 draft specials (built at runtime from the draft). */
export const specialCells = (id: string, name: string, desc: string): AttackCell[] => [
  { name: `${id}-startup`, move: id, ref: 'canonical', active: false, pose: `winding up for the special move "${name}" (${desc}) — gathering power, the frame just before release` },
  { name: `${id}-active`, move: id, ref: 'canonical', active: true, pose: `performing "${name}" (${desc}) at the moment of release/impact — a dynamic committed action pose` },
  { name: `${id}-recovery`, move: id, ref: 'canonical', active: false, pose: `recovering from "${name}" — settling back toward a neutral stance` },
];

export const SPRITE_PROMPT = (name: string, pose: string): string =>
  spritePrompt(`${name}, ${pose}`);

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
  { key: 'sonic-boom', label: 'Sonic boom (charge)', desc: 'hold BACK ~0.6s then press forward — a charge projectile (Guile)', controls: ['cbf+P', 'cbf+K'] },
  { key: 'short-range-flame', label: 'Short-range flame', desc: 'a brief cone/flame projectile with a short lifetime', controls: ['qcb+P', 'qcf+P'] },
  { key: 'lob-projectile', label: 'Lob projectile', desc: 'an arcing projectile that rises, falls, and lands', controls: ['qcb+P', 'qcb+K'] },
  { key: 'lingering-cloud', label: 'Lingering cloud', desc: 'a slow projectile/cloud that can tick repeatedly', controls: ['qcf+K', 'qcb+K'] },
  { key: 'fuse-detonate', label: 'Fuse + detonate', desc: 'a lobbed bomb/trap that arms, then bursts after a fuse', controls: ['qcb+P', 'hcf+P'] },
  { key: 'stationary-trap', label: 'Stationary trap', desc: 'a placed projectile trap that sits in space and re-hits', controls: ['qcb+K', 'qcf+K'] },
  { key: 'slow-field', label: 'Slow field', desc: 'a non-damaging field that slows enemy projectiles and ground impulses', controls: ['qcf+P', 'qcb+P'] },
  { key: 'pull-projectile', label: 'Pull projectile', desc: 'a "get over here" projectile that drags the victim on hit', controls: ['hcf+P', 'qcf+P'] },
  { key: 'multi-projectile', label: 'Multi-projectile fan', desc: 'several projectiles spawned at once in a fan/stack', controls: ['hcf+P', 'qcf+P'] },
  { key: 'anti-air-dp', label: 'Anti-air (DP)', desc: 'a rising, invincible reversal that swats jumpers (dragon punch)', controls: ['dp+P', 'dp+K'] },
  { key: 'flash-kick', label: 'Flash kick (charge)', desc: 'hold DOWN ~0.6s then press up — a rising, invincible charge anti-air (Guile)', controls: ['du+K', 'du+P'] },
  { key: 'advancing-rush', label: 'Advancing rush', desc: 'a forward-moving strike that closes distance', controls: ['qcf+K', 'hcf+K'] },
  { key: 'horizontal-rush', label: 'Horizontal rush', desc: 'a fast back-forward torpedo / shoulder-charge special', controls: ['bf+P', 'bf+K'] },
  { key: 'mash', label: 'Mash barrage', desc: 'a rapid multi-hit flurry (mash the button, e.g. lightning legs)', controls: ['mash+P', 'mash+K'] },
  { key: 'melee-rehit', label: 'Melee re-hit', desc: 'a sustained melee activation that can hit repeatedly', controls: ['qcf+P', 'PPP', 'KKK'] },
  { key: 'command-grab', label: 'Command grab', desc: 'an unblockable throw at close range', controls: ['hcb+P', '360+P'] },
  { key: 'heal-grab', label: 'Heal grab', desc: 'a command grab that restores health on hit', controls: ['hcb+P', '360+P'] },
  { key: 'grab-recoil', label: 'Grab recoil', desc: 'a command grab that kicks the attacker backward after connecting', controls: ['hcb+K', '360+K'] },
  { key: 'techable-throw', label: 'Techable throw', desc: 'a universal LP+LK throw that the victim can tech', controls: ['LPLK'] },
  { key: 'teleport', label: 'Teleport', desc: 'blink behind or away to reposition (deals no damage)', controls: ['qcb+K', 'qcf+K'] },
  { key: 'mirror-teleport', label: 'Mirror teleport', desc: 'a symmetric halfway-blink teleport that replays its cells mirrored', controls: ['qcb+K', 'qcf+K'] },
  { key: 'reversal', label: 'Reversal', desc: 'an invincible wake-up attack that beats pressure', controls: ['qcb+P', 'qcb+K'] },
  { key: 'reflector', label: 'Reflector', desc: 'a special that reflects enemy projectiles during startup/active', controls: ['qcb+P', 'hcb+P'] },
  { key: 'projectile-immune', label: 'Projectile-immune rush', desc: 'an advancing/lariat strike that ignores projectiles while active', controls: ['PPP', 'qcf+P', 'qcf+K'] },
  { key: 'vault', label: 'Vault / launch', desc: 'a grounded special that launches the attacker into a vault arc', controls: ['qcf+K', 'hcf+K'] },
  { key: 'leaping-strike', label: 'Leaping strike', desc: 'a shoryuken-style leap without the full reversal profile', controls: ['dp+K', 'qcf+K'] },
  { key: 'yoga-float', label: 'Yoga float', desc: 'a floaty launch with reduced gravity on the way down', controls: ['qcb+P', 'qcb+K'] },
];

export const PROJECTILE_ARCHETYPE_KEYS = [
  'projectile', 'sonic-boom', 'short-range-flame', 'lob-projectile', 'lingering-cloud',
  'fuse-detonate', 'stationary-trap', 'slow-field', 'pull-projectile', 'multi-projectile',
] as const;

export function isProjectileArchetypeKey(key: string): boolean {
  return (PROJECTILE_ARCHETYPE_KEYS as readonly string[]).includes(key);
}

export function controlsForArchetype(key: string): string {
  return (SPECIAL_ARCHETYPES.find((a) => a.key === key)?.controls[0]) ?? 'qcf+P';
}

/** the 18 button-normal move ids (for the per-move animation player). */
export const NORMAL_MOVE_IDS = ['lp', 'mp', 'hp', 'lk', 'mk', 'hk', 'clp', 'cmp', 'chp', 'clk', 'cmk', 'chk', 'jlp', 'jmp', 'jhp', 'jlk', 'jmk', 'jhk'];
export const BASE_MOVE_IDS = [...NORMAL_MOVE_IDS, 'throw'];

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
    arcade: {
      motivation: `${N} hears the Bombay Beach Biennale has a champion's title — and a patron prince who has never been beaten. (edit me: why does ${N} set out?)`,
      ending: `${N} stands over Tao as the biennale fireworks start. (edit me: the post-credits scene.)`,
    },
    stagePrompt:
      'A Bombay Beach / Mars College desert locale, redraw as gritty 16-bit retro pixel-art anchored ' +
      'on the salton style reference. 21:9. The bottom quarter is a continuous textured walkable ground ' +
      'plane, edge to edge, touching the bottom of the frame; no props or people in the fighter strip.',
    musicPrompt:
      `A loopable ~75s instrumental battle theme for ${N}'s desert stage. Gritty desert dub-techno, ` +
      'mid-tempo ~92 BPM, strong rhythmic loop, no vocals, clean loop point, mixed to sit under SFX.',
  };
}

/** the on-disk VO clip contract (audit VOICE_COUNTS + the SHIP clipMap write
 *  6/6/4 slots with silence fallback) — the editor lets lines be removed and
 *  re-added but never beyond what the game will actually load. */
export const VO_CAPS = { kiai: 6, hurt: 6, victory: 4 } as const;

// ── the model ───────────────────────────────────────────────────────────────
export const CREATOR_STEPS = ['SEED', 'PROFILE', 'MOVES', 'RIG', 'POLISH', 'SHIP'] as const;
export type CreatorStep = typeof CREATOR_STEPS[number];

export function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'fighter';
}

export class CreatorModel {
  inputs: CreatorInputs = { name: '', description: '' };
  draft: DesignDraft | null = null;
  /** set when editing an already-canonized fighter; preserves the current id */
  existingId?: string;
  /** raw character JSON to preserve when a canon fighter is opened for editing */
  baseDef?: Record<string, unknown>;
  step = 0;
  jobs = new Map<string, CreatorJob>();
  /** clip name (announcer, kiai-1..6, hurt-1..6, victory-1..4) -> base64 mp3 */
  generatedVo: Record<string, string> = {};
  generatedMusic?: string; // base64 mp3
  generatedFatality: string[] = []; // 4 base64 jpg panels
  fatalityBeats: string[] = []; // 4 editable per-panel prompt beats (seeded from fatalityBeats())
  moveAudio: Record<string, string> = {}; // specialId -> base64 mp3 (per-move VO / SFX call-out)
  /** specialId -> the call-out's TEXT — persisted (draft state + character
   *  JSON `voiceText`) so the writing survives past initial creation */
  moveAudioText: Record<string, string> = {};
  voiceModelId?: string; // Fish clone reference id (if the user cloned a voice)
  /** canon-reopen: the home stage already has music on disk (gap-bar honesty) */
  inheritedMusic = false;
  /** canon-reopen: the packed meta.json as loaded (version/normalized/frames)
   *  + which committed portrait assets exist — the Adopt checklist's evidence */
  canonMeta?: { version?: number; normalized?: boolean; frames?: string[] };
  canonAssets?: { portrait: boolean; bust: boolean; ko: boolean };
  skeletons: Record<string, Record<string, [number, number, number]>> = {}; // cellName -> DWPose joints
  autoHitboxes: Record<string, { x: number; y: number; w: number; h: number }> = {}; // moveId -> engine hitbox
  voStatus: 'idle' | 'running' | 'done' | 'error' = 'idle';
  musicStatus: 'idle' | 'running' | 'done' | 'error' = 'idle';
  fatalityStatus: 'idle' | 'running' | 'done' | 'error' = 'idle';
  cloneStatus: 'idle' | 'running' | 'done' | 'error' = 'idle';
  rigStatus: 'idle' | 'running' | 'done' | 'error' = 'idle';

  /** all special phase cells for the draft (startup/active/recovery × each
   *  special). The locked techable throw is skipped: its throw-* cells are
   *  already in ATTACK_CELLS (canon-reopen used to double-count them). */
  specialCellList(): AttackCell[] {
    return (this.draft?.specials ?? [])
      .filter((s) => s.id !== 'throw' && s.archetype !== 'techable-throw')
      .flatMap((s) => specialCells(s.id, s.name, s.description));
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

  /** the VO clip slots the current draft actually fills (line counts are
   *  add/removable, capped by the on-disk contract VO_CAPS). */
  voSlots(): string[] {
    const n = (arr: string[] | undefined, cap: number, dflt: number): number => Math.min(arr?.length ?? dflt, cap);
    const d = this.draft;
    return [
      ...Array.from({ length: n(d?.vo.kiai, VO_CAPS.kiai, VO_CAPS.kiai) }, (_, i) => `kiai-${i + 1}`),
      ...Array.from({ length: n(d?.vo.hurt, VO_CAPS.hurt, VO_CAPS.hurt) }, (_, i) => `hurt-${i + 1}`),
      ...Array.from({ length: n(d?.vo.victory, VO_CAPS.victory, VO_CAPS.victory) }, (_, i) => `victory-${i + 1}`),
    ];
  }

  /** announcer + every drafted line — the gap bar's denominator. */
  voTotal(): number {
    return 1 + this.voSlots().length;
  }

  /** final VO map for the SHIP write: BYO clips override generated ones, slot
   *  by slot; clips for since-removed lines are dropped (SHIP writes silence). */
  finalVoClips(): Record<string, string> {
    const slots = this.voSlots();
    const keep = new Set(['announcer', ...slots]);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.generatedVo)) if (keep.has(k)) out[k] = v;
    const byo = this.inputs.kiaiClips ?? [];
    byo.forEach((f, i) => { if (slots[i]) out[slots[i]] = f.dataUrl.includes(',') ? f.dataUrl.split(',')[1] : f.dataUrl; });
    return out;
  }

  finalMusic(): string | undefined {
    const byo = this.inputs.musicTracks?.[0];
    if (byo) return byo.dataUrl.includes(',') ? byo.dataUrl.split(',')[1] : byo.dataUrl;
    return this.generatedMusic;
  }

  get id(): string {
    return this.existingId ?? slugify(this.inputs.name);
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
    d.arcade ??= { motivation: '', ending: '' }; // drafts saved before the arcade stub
    if (this.baseDef) return this.buildFromBase(d);
    const moves: Record<string, unknown> = {};
    for (const [key, m] of Object.entries(NORMAL_MOVES)) moves[key] = { ...m };
    moves.throw = { startup: 3, active: 2, recovery: 20, damage: 0, hitstun: 0, blockstun: 0, knockback: 6, hitbox: null, height: 'mid', grab: { range: 64 }, techable: true };
    // the locked 5th special gets call-outs like any other special
    if (this.moveAudio.throw) (moves.throw as Record<string, unknown>).voice = true;
    if (this.moveAudioText.throw) (moves.throw as Record<string, unknown>).voiceText = this.moveAudioText.throw;
    for (const s of d.specials) {
      moves[s.id] = buildSpecial(s);
      if (this.moveAudio[s.id]) (moves[s.id] as Record<string, unknown>).voice = true; // has a per-move VO/SFX call-out
      if (this.moveAudioText[s.id]) (moves[s.id] as Record<string, unknown>).voiceText = this.moveAudioText[s.id];
    }
    // overlay skeleton-derived hitboxes (RIG step) over the heuristic defaults
    for (const [moveId, box] of Object.entries(this.autoHitboxes)) {
      const mv = moves[moveId] as { hitbox?: unknown } | undefined;
      if (mv && mv.hitbox !== null) mv.hitbox = box; // keep null for pure-projectile specials
    }
    // the roster-standard grammar: light chains, medium cancels, L/H variants
    // (tools/core/kit.mjs — the ben/earl thin-kit regression can't recur)
    applyKitGrammar(moves as Record<string, Record<string, unknown>>, d.specials);
    return {
      id: this.id,
      name: this.inputs.name.toUpperCase(),
      color: hslToHex(d.color),
      lore: this.inputs.lore?.trim() ? { ...d.lore, backstory: this.inputs.lore.trim() } : d.lore,
      winQuotes: d.winQuotes,
      vo: d.vo, // the line TEXTS persist alongside the clips (schema `vo`)
      health: d.physics.health,
      walkSpeed: d.physics.walkSpeed,
      backSpeed: d.physics.backSpeed,
      jumpVel: d.physics.jumpVel,
      gravity: d.physics.gravity,
      prejumpFrames: d.physics.prejumpFrames,
      scale: 1.0,
      // no spriteOffsetY: shipped sheets are floor-normalized by the packer
      // (feet on the ORIGIN_FEET line), so no render nudge is needed
      bodyBox: { x: -42, y: -240, w: 84, h: 240 },
      hurtStand: { x: -52, y: -256, w: 104, h: 256 },
      hurtCrouch: { x: -52, y: -150, w: 104, h: 150 },
      moves,
      ...(this.inputs.stageMode !== 'none' && this.inputs.stageId ? { stage: this.inputs.stageId } : {}),
      // arcade-mode story STUB: persisted now so the mode has data to build on
      ...(d.arcade.motivation || d.arcade.ending ? { arcade: d.arcade } : {}),
      fatality: { id: d.fatality.id, name: d.fatality.name, input: parseControls(d.fatality.input), panels: 4 },
    };
  }

  private buildFromBase(d: DesignDraft): Record<string, unknown> {
    const out = cloneJson(this.baseDef ?? {});
    out.id = this.id;
    out.name = (this.inputs.name || this.id).toUpperCase();
    if (!out.color) out.color = hslToHex(d.color);
    if (this.inputs.lore?.trim()) {
      out.lore = { ...(typeof out.lore === 'object' && out.lore ? out.lore : d.lore), backstory: this.inputs.lore.trim() };
    }
    if (d.winQuotes.length) out.winQuotes = d.winQuotes;
    if (d.vo && (d.vo.kiai?.length || d.vo.hurt?.length || d.vo.victory?.length)) out.vo = d.vo;
    const moves: Record<string, Record<string, unknown>> = cloneJson(
      (out.moves && typeof out.moves === 'object') ? out.moves as Record<string, Record<string, unknown>> : {},
    );
    for (const s of d.specials) {
      const existing = (moves[s.id] && typeof moves[s.id] === 'object') ? moves[s.id] as Record<string, unknown> : buildSpecial(s);
      existing.name = s.name;
      existing.input = parseControls(s.controls);
      if (isProjectileArchetypeKey(s.archetype)) {
        const projectile = (existing.projectile && typeof existing.projectile === 'object') ? existing.projectile as Record<string, unknown> : {};
        if (s.projScale) projectile.renderSize = Math.round(72 * s.projScale);
        if (typeof s.projSpawnX === 'number') projectile.spawnX = s.projSpawnX;
        if (typeof s.projSpawnY === 'number') projectile.spawnY = s.projSpawnY;
        if (s.projBox) projectile.box = s.projBox;
        if (Object.keys(projectile).length) existing.projectile = projectile;
      }
      if (this.moveAudio[s.id]) existing.voice = true;
      if (this.moveAudioText[s.id]) existing.voiceText = this.moveAudioText[s.id];
      moves[s.id] = existing;
    }
    for (const [moveId, box] of Object.entries(this.autoHitboxes)) {
      const mv = moves[moveId] as { hitbox?: unknown } | undefined;
      if (mv && mv.hitbox !== null) mv.hitbox = box;
    }
    // non-destructive grammar fill (existing hand-tuned chains/cancel/variants
    // on a canon-reopened kit are never touched)
    applyKitGrammar(moves, d.specials);
    out.moves = moves;
    if (d.arcade && (d.arcade.motivation || d.arcade.ending)) out.arcade = d.arcade;
    if (this.inputs.stageMode === 'none') delete out.stage;
    else if (this.inputs.stageId) out.stage = this.inputs.stageId;
    if (this.generatedFatality.length) out.fatality = { id: d.fatality.id, name: d.fatality.name, input: parseControls(d.fatality.input), panels: this.generatedFatality.length };
    return out;
  }

  /** meta.json frame list for the sheet the SHIP step composites (base cells only). */
  baseCellNames(): string[] {
    return BASE_CELLS.map((c) => c.id).filter((id) => this.job('sprite:' + id)?.status === 'done');
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
  const raw = controls.trim();
  const [rawMotion0, rawBtn0] = raw.toLowerCase().split('+');
  const rawMotion = rawBtn0 ? rawMotion0 : '';
  const rawBtn = rawBtn0 ?? rawMotion0;
  const btn = rawBtn.trim().toUpperCase();
  const button = btn === 'PPP' || btn === 'KKK' || btn === 'LPLK'
    ? btn
    : BUTTON[rawBtn.trim()[0]] ?? 'punch';
  const motions = new Set(['qcf', 'qcb', 'bf', 'cbf', 'dp', 'hcb', 'hcf', '360', 'du']);
  const m = rawMotion.trim();
  if (m === 'mash') return { button, mash: 5 };
  if (!m) return { button };
  return { motion: motions.has(m) ? m : 'qcf', button };
}

function buildSpecial(s: SpecialDraft): Record<string, unknown> {
  const input = parseControls(s.controls);
  const base = { name: s.name, input, height: 'mid' as const };
  const pbox = s.projBox ?? { x: -28, y: -28, w: 56, h: 56 };
  const renderSize = Math.round(72 * (s.projScale ?? 1));
  const projectile = (patch: Record<string, unknown> = {}): Record<string, unknown> => ({
    vx: 9, spawnX: s.projSpawnX ?? 96, spawnY: s.projSpawnY ?? -176,
    box: pbox, renderSize, damage: 60, hitstun: 18, blockstun: 12, knockback: 9,
    ...patch,
  });
  switch (s.archetype) {
    case 'projectile':
    case 'sonic-boom': // charge (cbf) projectile — same shape, the input carries the charge
      return { ...base, startup: 13, active: 2, recovery: 24, damage: 0, hitstun: 0, blockstun: 0, knockback: 0, hitbox: null,
        projectile: projectile(s.archetype === 'sonic-boom' ? { vx: 10 } : {}) };
    case 'short-range-flame':
      return { ...base, startup: 9, active: 4, recovery: 18, damage: 0, hitstun: 0, blockstun: 0, knockback: 0, hitbox: null,
        projectile: projectile({ vx: 6, spawnX: s.projSpawnX ?? 72, spawnY: s.projSpawnY ?? -148, box: s.projBox ?? { x: -36, y: -34, w: 72, h: 68 }, renderSize: Math.round(96 * (s.projScale ?? 1)), damage: 18, hitstun: 8, blockstun: 6, knockback: 2, ttl: 18, rehit: 4 }) };
    case 'lob-projectile':
      return { ...base, startup: 16, active: 2, recovery: 27, damage: 0, hitstun: 0, blockstun: 0, knockback: 0, hitbox: null,
        projectile: projectile({ vx: 5, vy: -9, gravity: 0.55, spawnX: s.projSpawnX ?? 78, spawnY: s.projSpawnY ?? -190, damage: 55, hitstun: 18, blockstun: 12, knockback: 8, ttl: 180, knockdown: true }) };
    case 'lingering-cloud':
      return { ...base, startup: 17, active: 2, recovery: 28, damage: 0, hitstun: 0, blockstun: 0, knockback: 0, hitbox: null,
        projectile: projectile({ vx: 3.5, spawnX: s.projSpawnX ?? 82, spawnY: s.projSpawnY ?? -150, box: s.projBox ?? { x: -42, y: -42, w: 84, h: 84 }, renderSize: Math.round(104 * (s.projScale ?? 1)), damage: 16, hitstun: 8, blockstun: 6, knockback: 2, ttl: 90, rehit: 14 }) };
    case 'fuse-detonate':
      return { ...base, startup: 18, active: 2, recovery: 30, damage: 0, hitstun: 0, blockstun: 0, knockback: 0, hitbox: null,
        projectile: projectile({ vx: 4, vy: -8, gravity: 0.6, spawnX: s.projSpawnX ?? 74, spawnY: s.projSpawnY ?? -188, damage: 0, hitstun: 0, blockstun: 0, knockback: 0, ttl: 180, fuse: 42, detonate: { box: { x: -62, y: -92, w: 124, h: 112 }, damage: 85, hitstun: 22, blockstun: 14, knockback: 10, ttl: 12 } }) };
    case 'stationary-trap':
      return { ...base, startup: 18, active: 2, recovery: 27, damage: 0, hitstun: 0, blockstun: 0, knockback: 0, hitbox: null,
        projectile: projectile({ vx: 0, spawnX: s.projSpawnX ?? 86, spawnY: s.projSpawnY ?? -64, box: s.projBox ?? { x: -36, y: -46, w: 72, h: 64 }, renderSize: Math.round(88 * (s.projScale ?? 1)), damage: 28, hitstun: 10, blockstun: 8, knockback: 3, ttl: 120, rehit: 20 }) };
    case 'slow-field':
      return { ...base, startup: 18, active: 2, recovery: 24, damage: 0, hitstun: 0, blockstun: 0, knockback: 0, hitbox: null,
        projectile: projectile({ vx: 0, spawnX: s.projSpawnX ?? 98, spawnY: s.projSpawnY ?? -132, box: s.projBox ?? { x: -74, y: -70, w: 148, h: 140 }, renderSize: Math.round(150 * (s.projScale ?? 1)), damage: 0, hitstun: 0, blockstun: 0, knockback: 0, ttl: 150, field: true, slowFactor: 0.42 }) };
    case 'pull-projectile':
      return { ...base, startup: 14, active: 2, recovery: 29, damage: 0, hitstun: 0, blockstun: 0, knockback: 0, hitbox: null,
        projectile: projectile({ vx: 8, damage: 35, hitstun: 14, blockstun: 10, knockback: 4, ttl: 160, pull: true, knockdown: true }) };
    case 'multi-projectile':
      return { ...base, startup: 15, active: 2, recovery: 28, damage: 0, hitstun: 0, blockstun: 0, knockback: 0, hitbox: null,
        projectile: projectile({ vx: 7.5, damage: 36, hitstun: 12, blockstun: 8, knockback: 5, count: 3, spreadVX: 1.2, spreadY: 28, ttl: 150 }) };
    case 'teleport':
      return { ...base, startup: 10, active: 1, recovery: 18, damage: 0, hitstun: 0, blockstun: 0, knockback: 0, hitbox: null, teleport: { mode: 'behind' }, invulnFrom: 6, invuln: 12 };
    case 'mirror-teleport':
      return { ...base, startup: 12, active: 4, recovery: 12, damage: 0, hitstun: 0, blockstun: 0, knockback: 0, hitbox: null, teleport: { mode: 'behind', mirror: true }, invulnFrom: 6, invuln: 10 };
    case 'anti-air-dp':
    case 'flash-kick': // charge (du) rising anti-air — same leap+invuln shape
      return { ...base, startup: 5, active: 8, recovery: 22, damage: 80, hitstun: 20, blockstun: 12, knockback: 8, knockdown: true, hitbox: { x: 20, y: -244, w: 72, h: 120 }, leap: { vx: 4, vy: 16 }, invuln: 8 };
    case 'advancing-rush':
      return { ...base, startup: 9, active: 4, recovery: 20, damage: 70, hitstun: 18, blockstun: 12, knockback: 8, hitbox: { x: 50, y: -184, w: 92, h: 72 }, forwardVel: 10 };
    case 'horizontal-rush':
      return { ...base, startup: 10, active: 5, recovery: 22, damage: 78, hitstun: 19, blockstun: 12, knockback: 10, knockdown: true, hitbox: { x: 48, y: -176, w: 110, h: 70 }, forwardVel: 14 };
    case 'command-grab':
      return { ...base, startup: 6, active: 2, recovery: 26, damage: 100, hitstun: 0, blockstun: 0, knockback: 8, hitbox: null, grab: { range: 72 }, knockdown: true };
    case 'heal-grab':
      return { ...base, startup: 7, active: 2, recovery: 28, damage: 85, hitstun: 0, blockstun: 0, knockback: 8, hitbox: null, grab: { range: 70 }, heal: 60, knockdown: true };
    case 'grab-recoil':
      return { ...base, startup: 7, active: 2, recovery: 28, damage: 90, hitstun: 0, blockstun: 0, knockback: 9, hitbox: null, grab: { range: 70 }, grabRecoil: 12, knockdown: true };
    case 'techable-throw':
      return { ...base, startup: 3, active: 2, recovery: 20, damage: 0, hitstun: 0, blockstun: 0, knockback: 6, hitbox: null, grab: { range: 64 }, techable: true };
    case 'reversal':
      return { ...base, startup: 3, active: 6, recovery: 26, damage: 70, hitstun: 18, blockstun: 12, knockback: 10, knockdown: true, hitbox: { x: 30, y: -224, w: 72, h: 120 }, invuln: 10 };
    case 'mash':
      return { ...base, startup: 6, active: 12, recovery: 16, damage: 12, hitstun: 8, blockstun: 6, knockback: 2, hitbox: { x: 46, y: -154, w: 74, h: 42 }, rehit: 4 };
    case 'melee-rehit':
      return { ...base, startup: 7, active: 14, recovery: 18, damage: 14, hitstun: 8, blockstun: 6, knockback: 2, hitbox: { x: 42, y: -170, w: 88, h: 58 }, rehit: 5 };
    case 'reflector':
      return { ...base, startup: 5, active: 16, recovery: 20, damage: 42, hitstun: 12, blockstun: 9, knockback: 4, hitbox: { x: 30, y: -212, w: 74, h: 116 }, reflect: true };
    case 'projectile-immune':
      return { ...base, startup: 8, active: 8, recovery: 22, damage: 74, hitstun: 18, blockstun: 12, knockback: 9, knockdown: true, hitbox: { x: 42, y: -188, w: 96, h: 76 }, forwardVel: 9, projImmune: true };
    case 'vault':
      return { ...base, startup: 8, active: 8, recovery: 20, damage: 70, hitstun: 18, blockstun: 11, knockback: 8, knockdown: true, hitbox: { x: 38, y: -186, w: 88, h: 76 }, vault: { vx: 7, vy: 15 } };
    case 'leaping-strike':
      return { ...base, startup: 7, active: 8, recovery: 20, damage: 68, hitstun: 17, blockstun: 11, knockback: 7, knockdown: true, hitbox: { x: 32, y: -214, w: 78, h: 96 }, leap: { vx: 6, vy: 13 } };
    case 'yoga-float':
      return { ...base, startup: 8, active: 2, recovery: 14, damage: 0, hitstun: 0, blockstun: 0, knockback: 0, hitbox: null, float: { vy: 13, gravity: 0.28, vx: 2 } };
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
