// Shared helpers for asset-generation scripts. Node 18+, no deps.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnv() {
  const env = {};
  const raw = readFileSync(join(ROOT, '.env'), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

export function imagePart(path) {
  return {
    inline_data: {
      mime_type: MIME[extname(path).toLowerCase()] ?? 'image/jpeg',
      data: readFileSync(path).toString('base64'),
    },
  };
}

/** Save a generated asset plus a .prompt.txt sidecar for reproducibility. */
export function saveAsset(outPath, buffer, prompt) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, buffer);
  writeFileSync(outPath.replace(/\.[a-z0-9]+$/, '.prompt.txt'), prompt);
  console.log(`  wrote ${outPath} (${(buffer.length / 1024).toFixed(0)}kb)`);
}

export function skip(outPath, force) {
  if (!force && existsSync(outPath)) {
    console.log(`  skip ${outPath} (exists; --force to regen)`);
    return true;
  }
  return false;
}

/**
 * Run `worker(item, i)` over `items` with at most `size` in flight at once.
 * Preserves result order; a rejecting worker rejects the whole pool, so
 * workers that should be resilient must catch their own errors.
 */
export async function pool(items, size, worker) {
  const results = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  };
  const lanes = Math.max(1, Math.min(size, items.length));
  await Promise.all(Array.from({ length: lanes }, run));
  return results;
}

/** Parse `--concurrency N` from argv, falling back to `dflt`. */
export function concurrencyArg(dflt) {
  const i = process.argv.indexOf('--concurrency');
  if (i < 0) return dflt;
  const n = parseInt(process.argv[i + 1], 10);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}

/** Gemini image generation (nano-banana). referencePaths are optional input images. */
export async function geminiImage({ apiKey, model, prompt, referencePaths = [], aspectRatio }) {
  const parts = [{ text: prompt }, ...referencePaths.map(imagePart)];
  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      ...(aspectRatio ? { imageConfig: { aspectRatio } } : {}),
    },
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`gemini ${model}: ${res.status} ${JSON.stringify(json).slice(0, 400)}`);
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) throw new Error(`gemini ${model}: no image in response: ${JSON.stringify(json).slice(0, 400)}`);
  return Buffer.from(part.inlineData.data, 'base64');
}

// --- Fish Audio voice cloning (https://docs.fish.audio) -------------------
// Cloned-voice registry: char id -> { provider, modelId, ... }, written by
// tools/gen-voice.mjs and read by gen-audio.mjs to route a character's VO
// through their cloned voice instead of a stock ElevenLabs voice.
export const VOICES_PATH = join(ROOT, 'tools', 'voices.json');

export function loadVoices() {
  return existsSync(VOICES_PATH) ? JSON.parse(readFileSync(VOICES_PATH, 'utf8')) : {};
}

export function saveVoices(voices) {
  writeFileSync(VOICES_PATH, JSON.stringify(voices, null, 2) + '\n');
}

/** ElevenLabs voice ids used across the project — one table for the CLI
 *  (gen-audio) and the dev middleware (creator audio endpoints). */
export const ELEVEN_VOICES = {
  announcer: 'V33LkP9pVLdcjeB2y5Na', // Maverick — epic heroic legend (rounds, KO, fighter names)
  stage: 'QMJTqaMXmGnG8TCm8WQG', // Clyde — vintage male radio announcer (stage call-outs)
  m: 'SOYHLrjzK2X1ezoPC6cr', // Harry — fierce warrior
  f: 'EXAVITQu4vr4xnSDxMaL', // Sarah — mature confident
};

/** ElevenLabs TTS. Returns an audio Buffer. One implementation for CLI + vite. */
export async function elevenTts({ apiKey, voiceId, text, style = 0.7, stability = 0.4, similarityBoost = 0.75 }) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability, similarity_boost: similarityBoost, style },
    }),
  });
  if (!res.ok) throw new Error(`elevenlabs tts ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

/** ElevenLabs sound-effect generation. Returns an audio Buffer. */
export async function elevenSfx({ apiKey, text, seconds, promptInfluence = 0.6 }) {
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, duration_seconds: seconds, prompt_influence: promptInfluence }),
  });
  if (!res.ok) throw new Error(`sfx ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Fish Audio TTS with a cloned voice model. Returns an audio Buffer. */
export async function fishTTS({ apiKey, referenceId, text, temperature = 0.7, topP = 0.7, model = 's1', format = 'mp3' }) {
  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', model },
    body: JSON.stringify({
      text,
      reference_id: referenceId,
      format,
      mp3_bitrate: 128,
      temperature,
      top_p: topP,
    }),
  });
  if (!res.ok) throw new Error(`fish tts ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

/** OpenAI image generation (gpt-image-2). */
export async function openaiImage({ apiKey, prompt, size = '1536x1024', model = 'gpt-image-2' }) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, prompt, size, quality: 'high' }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`openai images: ${res.status} ${JSON.stringify(json).slice(0, 400)}`);
  return Buffer.from(json.data[0].b64_json, 'base64');
}
