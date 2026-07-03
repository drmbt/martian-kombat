// Single place where user volume settings turn into actual gain values:
// master (and mute) scale both channels; music/sfx are per-channel trims.
import { setMusicVolume } from './music';
import { getSettings } from '../settings';

/** Gain multiplier for one-shot SFX/announcer/voice playback. */
export function effectiveSfxVolume(): number {
  const s = getSettings();
  return s.muted ? 0 : s.masterVolume * s.sfxVolume;
}

/** Push the current settings into the streaming music channel. */
export function applyMusicVolume(): void {
  const s = getSettings();
  setMusicVolume(s.muted ? 0 : s.masterVolume * s.musicVolume);
}
