// Player-facing game settings, persisted to localStorage. Rendering-side
// only — match rules derived from these are passed into the deterministic
// engine via initialState's MatchRules, never read from inside src/engine/.

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
}

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 1,
  muted: false,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  roundSeconds: 60,
  winsNeeded: 2,
};

export const ROUND_SECONDS_CHOICES = [0, 30, 60, 99] as const; // 0 = OFF
export const WINS_NEEDED_CHOICES = [1, 2, 3] as const; // best of 1 / 3 / 5

const STORAGE_KEY = 'mk-settings';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

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
