// Generate the announcer pack, per-character grunts (ElevenLabs TTS) and
// combat SFX (ElevenLabs sound-generation) into public/assets/audio/.
// Idempotent; --force regens.  node tools/gen-audio.mjs [--force]

import { join } from 'node:path';
import { ROOT, loadEnv, saveAsset, skip } from './lib.mjs';

const env = loadEnv();
const force = process.argv.includes('--force');
const KEY = env.ELEVENLABS_API_KEY;

const ANNOUNCER = 'V33LkP9pVLdcjeB2y5Na'; // Maverick — epic heroic legend
const VOICE_M = 'SOYHLrjzK2X1ezoPC6cr'; // Harry — fierce warrior (Vincent)
const VOICE_F = 'EXAVITQu4vr4xnSDxMaL'; // Sarah — mature confident (Yulia)
const VOICE_CATH = 'cgSgspJ2msm6clMCkdW9'; // Jessica — playful bright (Catherine)
const VOICE_KIRBY = 'FGY2WhTYpPnrIDTdsKH5'; // Laura — sassy (Kirby)

async function tts(voiceId, text, style = 0.7) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.4, similarity_boost: 0.75, style },
    }),
  });
  if (!res.ok) throw new Error(`tts ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function sfx(text, seconds) {
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, duration_seconds: seconds, prompt_influence: 0.6 }),
  });
  if (!res.ok) throw new Error(`sfx ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

const AUDIO = join(ROOT, 'public/assets/audio');

const announcerLines = {
  'round-1': 'ROUND ONE!',
  'round-2': 'ROUND TWO!',
  'final-round': 'FINAL ROUND!',
  fight: 'FIGHT!',
  ko: 'K! O!',
  'time-up': 'TIME UP!',
  'double-ko': 'DOUBLE K O!',
  perfect: 'PERFECT!',
  victory: 'MARTIAN VICTORY!',
  vincent: 'VINCENT!',
  yulia: 'YULIA!',
  catherine: 'CATHERINE!',
  flo: 'FLO!',
  freeman: 'FREEMAN!',
  gene: 'GENE!',
  kirby: 'KIRBY!',
  marzipan: 'MARZIPAN!',
  'finish-them': 'FINISH THEM!',
  fatality: 'FATALITY!',
};

const grunts = [
  ['vincent-kiai', VOICE_M, 'Hyah!'],
  ['vincent-hurt', VOICE_M, 'Ugh!'],
  ['yulia-kiai', VOICE_F, 'Hyaaa!'],
  ['yulia-hurt', VOICE_F, 'Agh!'],
  ['catherine-kiai', VOICE_CATH, 'Order up!'],
  ['catherine-hurt', VOICE_CATH, 'Agh!'],
  ['kirby-kiai', VOICE_KIRBY, 'Hyah!'],
  ['kirby-hurt', VOICE_KIRBY, 'Oof!'],
];

const sounds = [
  ['hit', 'a single punchy fighting game punch impact, meaty thwack, very short', 1],
  ['block', 'a single short muffled thud of a blocked martial arts strike', 1],
  ['whoosh', 'a single fast sharp martial arts whoosh, arm swinging through air, very short', 1],
  ['jump', 'a single quick soft whoosh of a person leaping, very short', 1],
  ['projectile', 'a single magical energy bolt launch, arcane zap with a slight shimmer, short', 1.5],
  ['blip', 'a single retro arcade menu selection blip, clean and short', 0.7],
];

for (const [id, text] of Object.entries(announcerLines)) {
  const out = join(AUDIO, 'announcer', `${id}.mp3`);
  if (skip(out, force)) continue;
  console.log(`announcer ${id} ...`);
  saveAsset(out, await tts(ANNOUNCER, text, 0.9), text);
}
for (const [id, voice, text] of grunts) {
  const out = join(AUDIO, 'voice', `${id}.mp3`);
  if (skip(out, force)) continue;
  console.log(`grunt ${id} ...`);
  saveAsset(out, await tts(voice, text, 0.9), text);
}
for (const [id, text, secs] of sounds) {
  const out = join(AUDIO, 'sfx', `${id}.mp3`);
  if (skip(out, force)) continue;
  console.log(`sfx ${id} ...`);
  saveAsset(out, await sfx(text, secs), text);
}
console.log('done.');
