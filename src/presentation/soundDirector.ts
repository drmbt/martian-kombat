// Pure FightEvent -> audio-cue mapping shared by BOTH presenters (2D
// FightScene + 3D FightScene3D). The scenes just execute the returned cues
// via play()/playVoice()/playMusic() (see runCues in BootScene) — camera
// shake and impact VFX stay renderer-side. Keeping the table here means a
// new engine behavior gets its sound wired exactly once.
import type { FightEvent } from './tickEvents';

export type AudioCue =
  /** one-shot sample; volume omitted = play()'s 0.8 default */
  | { kind: 'sfx'; key: string; volume?: number; delayMs?: number }
  /** random per-character voice variant (v-<char>-<line>-<n>) */
  | { kind: 'voice'; charId: string; line: 'hurt' | 'kiai'; volume: number }
  /** music transitions: next stage track / the one-shot victory theme */
  | { kind: 'music'; action: 'next' | 'victory' };

/** `charIds` = the matchup by slot — all the state this mapping needs. */
export function soundCues(events: FightEvent[], charIds: [string, string]): AudioCue[] {
  const cues: AudioCue[] = [];
  for (const e of events) {
    switch (e.type) {
      case 'round-intro':
        cues.push({ kind: 'sfx', key: e.round === 2 ? 'ann-round-2' : 'ann-final-round' });
        cues.push({ kind: 'music', action: 'next' }); // fresh stage track per round
        break;
      case 'count':
        cues.push({ kind: 'sfx', key: 's-block', volume: 0.35 }); // countdown blip
        break;
      case 'fight-start':
        cues.push({ kind: 'sfx', key: 'ann-fight', volume: 1 });
        break;
      case 'round-end':
        if (e.timeUp) cues.push({ kind: 'sfx', key: 'ann-time-up' });
        else if (e.winner === null) cues.push({ kind: 'sfx', key: 'ann-double-ko' });
        else {
          cues.push({ kind: 'sfx', key: 'ann-ko', volume: 1 });
          if (e.perfect) cues.push({ kind: 'sfx', key: 'ann-perfect', delayMs: 800 });
        }
        break;
      case 'match-end':
        cues.push({ kind: 'sfx', key: `ann-${charIds[e.winner]}`, volume: 1 });
        cues.push({ kind: 'sfx', key: 'ann-victory', volume: 1, delayMs: 900 });
        cues.push({ kind: 'music', action: 'victory' });
        break;
      case 'finisher':
        cues.push({ kind: 'sfx', key: 'ann-finish-them', volume: 1 });
        break;
      case 'fatality-start':
        cues.push({ kind: 'sfx', key: 'ann-fatality', volume: 1 });
        break;
      case 'hit':
        // counterhit: max-volume crack layered with a sharper whoosh
        cues.push(e.counter ? { kind: 'sfx', key: 's-hit', volume: 1 } : { kind: 'sfx', key: 's-hit' });
        if (e.counter) cues.push({ kind: 'sfx', key: 's-whoosh', volume: 0.9 });
        cues.push({ kind: 'voice', charId: charIds[e.slot], line: 'hurt', volume: 0.7 });
        break;
      case 'block':
        cues.push({ kind: 'sfx', key: 's-block', volume: 0.6 });
        break;
      case 'attack-start':
        cues.push({ kind: 'sfx', key: 's-whoosh', volume: 0.4 });
        if (e.special) cues.push({ kind: 'voice', charId: charIds[e.slot], line: 'kiai', volume: 0.8 });
        break;
      case 'jump':
        cues.push({ kind: 'sfx', key: 's-jump', volume: 0.35 });
        break;
      case 'taunt':
        cues.push({ kind: 'voice', charId: charIds[e.slot], line: 'kiai', volume: 0.7 });
        break;
      case 'dust':
        cues.push({ kind: 'sfx', key: 's-hit', volume: 0.3 }); // soft ground thud
        break;
      case 'projectile-spawn':
        cues.push({ kind: 'sfx', key: 's-projectile', volume: 0.6 });
        break;
      case 'throw-connect':
        cues.push({ kind: 'sfx', key: 's-hit', volume: 0.8 }); // the grab thunk
        break;
    }
  }
  return cues;
}
