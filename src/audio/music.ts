// Streaming music playback, driven by named subfolders of
// public/assets/audio/music/. Each folder is a "context" (menu, versus,
// victory, stages/<stage-id>); drop mp3s in and re-run
// `npm run gen:music` to refresh manifest.json — static hosting can't list
// directories, so the manifest is the source of truth for what exists.
//
// Flow: the menu theme loops from title through character select, fades into
// the versus theme on the VS screen (a play-once clip whose end starts the
// fight), stage music runs the fight (rotating tracks between rounds via
// nextTrack when the folder has several), and victory plays once over the
// win-quote screen — its end sends the game back to character select.
// Fatalities will be video cutscenes with their own baked-in audio, so they
// have no music context.
//
// Deliberately Phaser-free: HTMLAudioElement streams large files without
// preloading them through the Boot loader, and scenes just call playMusic()
// with a context (or fallback chain). A folder with several tracks gets a
// random pick, then shuffles to a different track when one ends. Missing or
// empty folders degrade to silence (or keep the current track, for phase
// overlays like victory/fatality).

export type MusicManifest = Record<string, string[]>;

const MUSIC_BASE = 'assets/audio/music/';
const FADE_MS = 500;

export interface PlayOpts {
  /** when no context in the chain has tracks, keep the current music playing */
  keepOnMiss?: boolean;
  /** play a single pass instead of looping/rotating, then call onEnd */
  once?: boolean;
  /** fires when a `once` track finishes (not when replaced or stopped) */
  onEnd?: () => void;
}

let manifest: MusicManifest | null = null;
let current: { ctx: string; file: string; el: HTMLAudioElement } | null = null;
let pending: { ctxs: string[]; opts: PlayOpts } | null = null;
let musicVolume = 0.6; // pre-boot fallback; BootScene applies the saved setting
let unlockArmed = false;

/** Pure track selection: first context in the chain with tracks wins.
 *  `avoid` skips one file so multi-track folders rotate instead of repeating.
 *  Exported for tests. */
export function pickTrack(
  m: MusicManifest,
  ctxs: string[],
  rand: () => number,
  avoid?: string,
): { ctx: string; file: string } | null {
  for (const ctx of ctxs) {
    const files = m[ctx];
    if (!files || files.length === 0) continue;
    const pool = files.length > 1 && avoid ? files.filter((f) => f !== avoid) : files;
    const file = pool[Math.floor(rand() * pool.length)] ?? pool[0];
    return { ctx, file };
  }
  return null;
}

/** Fetch the manifest once at boot. Missing manifest = no music, no errors. */
export function initMusic(): void {
  if (manifest) return;
  fetch(`${MUSIC_BASE}manifest.json`)
    .then((r) => (r.ok ? (r.json() as Promise<MusicManifest>) : {}))
    .catch(() => ({}) as MusicManifest)
    .then((m) => {
      manifest = m;
      if (pending) {
        const { ctxs, opts } = pending;
        pending = null;
        playMusic(ctxs, opts);
      }
    });
}

/** Whether a context has at least one track (false until the manifest loads). */
export function hasTracks(ctx: string): boolean {
  return !!manifest?.[ctx]?.length;
}

/**
 * Play music for a context, with optional fallbacks: playMusic(['stages/mars',
 * 'stages/default']). No-op if the winning context is already playing (so a
 * rematch on the same stage doesn't restart the track). When no context in the
 * chain has tracks: fades to silence by default, or keeps whatever is playing
 * if `keepOnMiss` (phase overlays shouldn't kill stage music just because no
 * victory theme exists yet).
 */
export function playMusic(ctx: string | string[], opts: PlayOpts = {}): void {
  const ctxs = Array.isArray(ctx) ? ctx : [ctx];
  if (!manifest) {
    pending = { ctxs, opts };
    return;
  }
  const picked = pickTrack(manifest, ctxs, Math.random);
  if (!picked) {
    if (!opts.keepOnMiss) stopMusic();
    return;
  }
  if (!opts.once && current && current.ctx === picked.ctx && !current.el.paused) return;
  start(picked.ctx, picked.file, opts);
}

/**
 * Crossfade to a different random track from the current context — used
 * between rounds. No-op when the folder has a single track (it keeps
 * looping) or nothing is playing.
 */
export function nextTrack(): void {
  if (!current || !manifest) return;
  const { ctx, file } = current;
  if ((manifest[ctx]?.length ?? 0) < 2) return;
  const next = pickTrack(manifest, [ctx], Math.random, file);
  if (next) start(next.ctx, next.file, {});
}

/** Fade out and stop whatever is playing. */
export function stopMusic(fadeMs = FADE_MS): void {
  if (!current) return;
  fadeOut(current.el, fadeMs);
  current = null;
}

export function setMusicVolume(v: number): void {
  musicVolume = Math.max(0, Math.min(1, v));
  // don't fight an active duck — it restores to musicVolume when it ends
  if (current && duckUntil === 0) current.el.volume = musicVolume;
}

/** how long the current duck holds (0 = not ducking) — lets overlapping VOs
 *  extend the duck instead of restoring early */
let duckUntil = 0;
let duckRaf = 0;

/** Duck the music under a voice-over for `ms`, then ease it back. Centralised
 *  so every announcer/name call (see BootScene.announce) sounds the same. */
export function duckMusic(ms: number, level = 0.28): void {
  if (!current) return;
  const now = performance.now();
  duckUntil = Math.max(duckUntil, now + ms);
  current.el.volume = musicVolume * level;
  if (duckRaf) return; // a restore loop is already running
  const tick = (): void => {
    if (!current) { duckUntil = 0; duckRaf = 0; return; }
    const t = performance.now();
    if (t >= duckUntil) {
      current.el.volume = musicVolume; // fully restored
      duckUntil = 0;
      duckRaf = 0;
      return;
    }
    // ease back over the last 400ms of the duck window
    const remain = duckUntil - t;
    const k = remain < 400 ? 1 - remain / 400 : 0;
    current.el.volume = musicVolume * (level + (1 - level) * k);
    duckRaf = requestAnimationFrame(tick);
  };
  duckRaf = requestAnimationFrame(tick);
}

// --- internals ---------------------------------------------------------

/** Dev-console handle: window.__music() -> { ctx, file, playing } | null. */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__music = () =>
    current && { ctx: current.ctx, file: current.file, playing: !current.el.paused };
}

function start(ctx: string, file: string, opts: PlayOpts): void {
  stopMusic();
  const el = new Audio(`${MUSIC_BASE}${ctx}/${file}`);
  el.preload = 'auto';
  el.volume = 0;
  const tracks = manifest?.[ctx] ?? [];
  if (opts.once) {
    // single pass; the caller drives what happens when it ends
    const onEnd = opts.onEnd;
    el.onended = () => {
      if (current?.el !== el) return; // replaced or stopped — stale
      current = null;
      onEnd?.();
    };
  } else if (tracks.length > 1) {
    // shuffle to a different track from the same folder when this one ends
    el.onended = () => {
      if (current?.el !== el || !manifest) return;
      const next = pickTrack(manifest, [ctx], Math.random, file);
      if (next) start(next.ctx, next.file, {});
    };
  } else {
    el.loop = true;
  }
  current = { ctx, file, el };
  el.play().then(
    () => fadeIn(el),
    () => armUnlock(), // autoplay blocked: retry on first user gesture
  );
}

/** Browsers block audio before the first gesture; retry the pending track once
 *  the user clicks, presses a key, OR presses a gamepad button. Gamepad input
 *  fires no DOM event, so we poll for it while armed — otherwise a player who
 *  only ever touches the controller would never hear music. */
function armUnlock(): void {
  if (unlockArmed) return;
  unlockArmed = true;
  let raf = 0;
  const anyPadDown = (): boolean => {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (p && p.buttons.some((b) => b.pressed || b.value > 0.4)) return true;
    }
    return false;
  };
  const unlock = (): void => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    if (raf) cancelAnimationFrame(raf);
    unlockArmed = false;
    if (current && current.el.paused) {
      // a pad press may not count as an activation gesture — re-arm and wait
      // for the next gesture instead of giving up on music for the session
      current.el.play().then(() => current && fadeIn(current.el), () => armUnlock());
    }
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  let padWasDown = anyPadDown(); // only a FRESH press unlocks (not a held one)
  const pollPad = (): void => {
    if (!unlockArmed) return;
    const down = anyPadDown();
    if (down && !padWasDown) { unlock(); return; }
    padWasDown = down;
    raf = requestAnimationFrame(pollPad);
  };
  raf = requestAnimationFrame(pollPad);
}

function fadeIn(el: HTMLAudioElement, ms = FADE_MS): void {
  fadeTo(el, musicVolume, ms, () => undefined);
}

function fadeOut(el: HTMLAudioElement, ms: number): void {
  fadeTo(el, 0, ms, () => {
    el.pause();
    el.src = '';
  });
}

function fadeTo(el: HTMLAudioElement, target: number, ms: number, done: () => void): void {
  const from = el.volume;
  const t0 = performance.now();
  const step = (t: number): void => {
    const k = Math.min(1, (t - t0) / ms);
    el.volume = from + (target - from) * k;
    if (k < 1) requestAnimationFrame(step);
    else done();
  };
  requestAnimationFrame(step);
}
