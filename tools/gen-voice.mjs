// Clone a fighter's real voice with Fish Audio (FISH_API_KEY) from samples in
// assets/voice-inspo/<char>/ and register the model in tools/voices.json —
// once registered, gen-audio.mjs automatically routes that character's kiai/
// hurt/victory VO through the clone instead of a stock ElevenLabs voice.
// Announcer + stage call-outs always stay on ElevenLabs.
//
//   node tools/gen-voice.mjs --char gene            clone (skips if registered)
//   node tools/gen-voice.mjs --char gene --force    re-clone, replace registry entry
//   node tools/gen-voice.mjs --char gene --say "Ship it!"   test synth ->
//                                                   assets/raw/voice-tests/
//   node tools/gen-voice.mjs --list                 show registry + sample status
//
// Samples: drop 1–5 clean clips (mp3/wav/m4a/flac/ogg, ~10–90s total) of the
// real person in assets/voice-inspo/<char>/. An optional same-stem .txt
// sidecar is used as the transcript (otherwise Fish runs ASR). Models are
// created `private` on the Fish account — the id in voices.json is useless
// without the API key, so committing the registry is safe.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { ROOT, loadEnv, loadVoices, saveVoices, fishTTS, saveAsset } from './lib.mjs';

const env = loadEnv();
const KEY = env.FISH_API_KEY;
const INSPO = join(ROOT, 'assets', 'voice-inspo');
const AUDIO_EXT = new Set(['.mp3', '.wav', '.m4a', '.flac', '.ogg']);
const MIME = {
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.flac': 'audio/flac', '.ogg': 'audio/ogg',
};

const force = process.argv.includes('--force');
const argOf = (flag) =>
  process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : null;
const charId = argOf('--char');
const say = argOf('--say');

function samplesFor(id) {
  const dir = join(INSPO, id);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => AUDIO_EXT.has(extname(f).toLowerCase()))
    .sort()
    .map((f) => join(dir, f));
}

if (process.argv.includes('--list')) {
  const voices = loadVoices();
  const ids = new Set([
    ...Object.keys(voices),
    ...(existsSync(INSPO) ? readdirSync(INSPO).filter((d) => !d.startsWith('.') && d !== 'README.md') : []),
  ]);
  if (!ids.size) console.log(`nothing yet — drop samples in ${INSPO}/<char>/`);
  for (const id of [...ids].sort()) {
    const v = voices[id];
    console.log(`${id}: ${v ? `${v.provider} ${v.modelId}` : 'not cloned'} (${samplesFor(id).length} samples)`);
  }
  process.exit(0);
}

if (!charId) {
  console.error('usage: npm run gen:voice -- --char <name> [--force] [--say "text"] | --list');
  process.exit(1);
}
if (!KEY) {
  console.error('FISH_API_KEY missing from .env — get one at https://fish.audio/app/developers/');
  process.exit(1);
}

const voices = loadVoices();

async function clone() {
  if (voices[charId] && !force) {
    console.log(`${charId} already cloned (${voices[charId].modelId}) — --force to re-clone`);
    return;
  }
  const samples = samplesFor(charId);
  if (!samples.length) {
    console.error(`no voice samples at ${join(INSPO, charId)}/ — drop mp3/wav clips of the real person there first`);
    process.exit(1);
  }
  const fd = new FormData();
  fd.append('type', 'tts');
  fd.append('train_mode', 'fast');
  fd.append('visibility', 'private');
  fd.append('title', `Martian Kombat — ${charId}`);
  for (const s of samples) {
    fd.append('voices', new Blob([readFileSync(s)], { type: MIME[extname(s).toLowerCase()] }), basename(s));
    const sidecar = s.replace(/\.[a-z0-9]+$/i, '.txt');
    if (existsSync(sidecar)) fd.append('texts', readFileSync(sidecar, 'utf8').trim());
  }
  console.log(`cloning ${charId} from ${samples.length} sample(s): ${samples.map((s) => basename(s)).join(', ')} ...`);
  const res = await fetch('https://api.fish.audio/model', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}` },
    body: fd,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json._id) {
    console.error(`fish model create failed ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
    process.exit(1);
  }
  voices[charId] = {
    provider: 'fish',
    modelId: json._id,
    title: json.title ?? `Martian Kombat — ${charId}`,
    samples: samples.map((s) => basename(s)),
    createdAt: new Date().toISOString(),
  };
  saveVoices(voices);
  console.log(`registered ${charId} -> ${json._id} in tools/voices.json`);
  console.log(`next: npm run gen:audio -- --char ${charId} --force  (regens VO through the clone)`);
}

await clone();

if (say) {
  const v = voices[charId];
  if (!v) {
    console.error(`${charId} has no registered clone to test — clone first`);
    process.exit(1);
  }
  const out = join(ROOT, 'assets', 'raw', 'voice-tests', `${charId}-${Date.now()}.mp3`);
  try {
    saveAsset(out, await fishTTS({ apiKey: KEY, referenceId: v.modelId, text: say }), say);
  } catch (e) {
    // 402 = API credit (billed separately from fish.audio platform credit)
    console.error(`test synth failed: ${e.message}`);
    process.exit(1);
  }
}
