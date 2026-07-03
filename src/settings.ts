// Player-facing game settings, persisted to localStorage. Rendering-side
// only — match rules derived from these are passed into the deterministic
// engine via initialState's MatchRules, never read from inside src/engine/.

/** Every remappable in-game action (movement + the six attack buttons). */
export const BIND_ACTIONS = ['up', 'down', 'left', 'right', 'lp', 'mp', 'hp', 'lk', 'mk', 'hk'] as const;
export type BindAction = (typeof BIND_ACTIONS)[number];

export interface PlayerBindings {
  /** DOM KeyboardEvent.keyCode per action */
  keys: Record<BindAction, number>;
  /** standard-mapping gamepad button index per action (the left stick also
   *  always drives movement, unremappable) */
  pad: Record<BindAction, number>;
}

/** X/Y/RB punches, A/B/RT kicks, dpad moves — the pre-remap hardwired layout */
const DEFAULT_PAD: Record<BindAction, number> = {
  up: 12, down: 13, left: 14, right: 15,
  lp: 2, mp: 3, hp: 5,
  lk: 0, mk: 1, hk: 7,
};

export const DEFAULT_BINDINGS: [PlayerBindings, PlayerBindings] = [
  {
    // WASD + R/T/Y punches, F/G/H kicks
    keys: { up: 87, down: 83, left: 65, right: 68, lp: 82, mp: 84, hp: 89, lk: 70, mk: 71, hk: 72 },
    pad: { ...DEFAULT_PAD },
  },
  {
    // arrows + U/I/O punches, J/K/L kicks
    keys: { up: 38, down: 40, left: 37, right: 39, lp: 85, mp: 73, hp: 79, lk: 74, mk: 75, hk: 76 },
    pad: { ...DEFAULT_PAD },
  },
];

export interface Settings {
  /** 0..1, scales music AND sfx — the quick-access overlay fader */
  masterVolume: number;
  /** master mute — the quick-access overlay speaker toggle */
  muted: boolean;
  /** 0..1 */
  musicVolume: number;
  /** 0..1, multiplies every play() call (sfx, announcer, voice) */
  sfxVolume: number;
  /** round clock in seconds; 0 = no timer */
  roundSeconds: number;
  /** rounds needed to take the match (2 = classic best-of-3) */
  winsNeeded: number;
  /** per-player keyboard + gamepad bindings (Settings → Controls) */
  bindings: [PlayerBindings, PlayerBindings];
}

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 1,
  muted: false,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  roundSeconds: 60,
  winsNeeded: 2,
  bindings: DEFAULT_BINDINGS,
};

export const ROUND_SECONDS_CHOICES = [0, 30, 60, 99] as const; // 0 = OFF
export const WINS_NEEDED_CHOICES = [1, 2, 3] as const; // best of 1 / 3 / 5

const STORAGE_KEY = 'mk-settings';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

function sanitizeBindings(raw: unknown): [PlayerBindings, PlayerBindings] {
  const arr = Array.isArray(raw) ? raw : [];
  return [0, 1].map((slot) => {
    const p = (arr[slot] ?? {}) as Partial<Record<'keys' | 'pad', Record<string, unknown>>>;
    const device = (dev: 'keys' | 'pad'): Record<BindAction, number> => {
      const out = { ...DEFAULT_BINDINGS[slot][dev] };
      for (const a of BIND_ACTIONS) {
        const v = p[dev]?.[a];
        if (typeof v === 'number' && Number.isInteger(v) && v >= 0) out[a] = v;
      }
      return out;
    };
    return { keys: device('keys'), pad: device('pad') };
  }) as [PlayerBindings, PlayerBindings];
}

function sanitize(raw: Partial<Settings>): Settings {
  const pickFrom = (choices: readonly number[], v: unknown, fallback: number): number =>
    typeof v === 'number' && choices.includes(v) ? v : fallback;
  return {
    masterVolume: typeof raw.masterVolume === 'number' ? clamp01(raw.masterVolume) : DEFAULT_SETTINGS.masterVolume,
    muted: typeof raw.muted === 'boolean' ? raw.muted : DEFAULT_SETTINGS.muted,
    musicVolume: typeof raw.musicVolume === 'number' ? clamp01(raw.musicVolume) : DEFAULT_SETTINGS.musicVolume,
    sfxVolume: typeof raw.sfxVolume === 'number' ? clamp01(raw.sfxVolume) : DEFAULT_SETTINGS.sfxVolume,
    roundSeconds: pickFrom(ROUND_SECONDS_CHOICES, raw.roundSeconds, DEFAULT_SETTINGS.roundSeconds),
    winsNeeded: pickFrom(WINS_NEEDED_CHOICES, raw.winsNeeded, DEFAULT_SETTINGS.winsNeeded),
    bindings: sanitizeBindings(raw.bindings),
  };
}

let settings: Settings | null = null;

export function getSettings(): Settings {
  if (!settings) {
    let raw: Partial<Settings> = {};
    try {
      raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Settings>;
    } catch {
      // corrupt storage -> defaults
    }
    settings = sanitize(raw);
  }
  return settings;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  settings = sanitize({ ...getSettings(), ...patch });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable (private mode etc.) -> settings live for the session
  }
  return settings;
}

export function resetSettings(): Settings {
  return updateSettings(DEFAULT_SETTINGS);
}
