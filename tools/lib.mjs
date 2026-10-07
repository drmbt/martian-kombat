// Shared helpers for asset-generation scripts. Node 18+, no deps.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// --- $0 mock mode (MK_GEN_MOCK=1) ------------------------------------------
// Every provider helper below returns locally-drawn/silent placeholders so
// the WHOLE pipeline (CLI scripts, job runner, studio auto-pilot) is
// E2E-walkable without an API key or a cent spent (CHARACTER_STUDIO §2.8
// "mock-first everywhere"). ffmpeg draws the images — the same hard
// dependency packing already has.
// MK_CREATOR_MOCK (the dev server's creator flag) means the same thing — one
// mock switch for every provider call, CLI or middleware (02-PLAN P2.9).
export const genMock = () => process.env.MK_GEN_MOCK === '1' || process.env.MK_CREATOR_MOCK === '1';

const MOCK_SIZES = { '16:9': [1280, 720], '21:9': [1680, 720], '1:1': [1024, 1024] };
const mockCache = new Map();

/** a keyable figure on chroma green (torso + head boxes, feet grounded) */
export function mockImage(aspectRatio) {
  const key = aspectRatio ?? 'cell';
  if (mockCache.has(key)) return mockCache.get(key);
  const [w, h] = MOCK_SIZES[aspectRatio] ?? [896, 1200];
  const bodyW = Math.round(w * 0.22), bodyH = Math.round(h * 0.55);
  const bx = Math.round((w - bodyW) / 2), by = Math.round(h * 0.98 - bodyH);
  const headW = Math.round(bodyW * 0.55), hx = Math.round((w - headW) / 2), hy = by - headW;
  const out = join(tmpdir(), `mk-mock-${key.replace(/[^a-z0-9]/gi, '_')}-${w}x${h}.png`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi',
    '-i', `color=0x00B140:s=${w}x${h}`,
    '-vf', `drawbox=x=${bx}:y=${by}:w=${bodyW}:h=${bodyH}:color=0x8a5a3a:t=fill,` +
           `drawbox=x=${hx}:y=${hy}:w=${headW}:h=${headW}:color=0xc9a07a:t=fill`,
    '-frames:v', '1', out]);
  const buf = readFileSync(out);
  mockCache.set(key, buf);
  return buf;
}

/** 0.25s of silence — the mock stand-in for every TTS/SFX call */
export function mockAudio() {
  if (mockCache.has('audio')) return mockCache.get('audio');
  const out = join(tmpdir(), 'mk-mock-silence.mp3');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi',
    '-i', 'anullsrc=r=44100:cl=mono', '-t', '0.25', '-q:a', '9', out]);
  const buf = readFileSync(out);
  mockCache.set('audio', buf);
  return buf;
}

/** Read `.env` (or `MK_ENV_FILE`) into a plain object, then let real
 *  environment variables win. A missing file is fine — the game, mock mode
 *  and every local-only tool must run with no `.env` at all (02-PLAN P2.9).
 *  Values may be quoted ("x" / 'x'); a trailing ` # comment` is dropped from
 *  unquoted values. */
export function loadEnv(path = process.env.MK_ENV_FILE || join(ROOT, '.env')) {
  const env = {};
  if (existsSync(path)) {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      const q = v.match(/^(['"])(.*)\1$/);
      if (q) v = q[2];
      else v = v.replace(/\s+#.*$/, '');
      env[m[1]] = v;
    }
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (/^[A-Z_][A-Z0-9_]*$/.test(k) && typeof v === 'string' && v !== '') env[k] = v;
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

/** What a generator should do for one asset, judged by the SHIPPED file
 *  (02-PLAN P8.5). Generators keep a gitignored raw intermediate
 *  (assets/raw/...) and derive the committed file in public/ from it; judging
 *  by the raw alone made a fresh clone (or an unpulled raw) re-spend on art
 *  that already ships AND overwrite it.
 *   - 'generate': --force, or neither file exists → call the API
 *   - 'skip':     the shipped file exists → touch nothing
 *   - 'derive':   only the raw exists → rebuild the shipped file locally */
export function shippedState(finalPath, rawPath, force) {
  if (force) return 'generate';
  if (existsSync(finalPath)) {
    console.log(`  skip ${finalPath.replace(ROOT + '/', '')} (ships already; --force to regen)`);
    return 'skip';
  }
  return rawPath && existsSync(rawPath) ? 'derive' : 'generate';
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

/** Retry an async fn on rate-limit/transient upstream errors (429/5xx) with
 *  exponential backoff + jitter. The provider's rate limit — not the pool
 *  width — is the real concurrency ceiling; this is what makes wide pools
 *  safe (CHARACTER_STUDIO §2.8: "429 backoff in the shared pool, finally").
 *  Errors carry `.status` when the API helpers below throw them. */
export async function withBackoff(fn, { tries, baseMs, label = 'api' } = {}) {
  // env overrides for overloaded days (e.g. MK_BACKOFF_TRIES=8 MK_BACKOFF_BASE_MS=15000)
  tries ??= Number(process.env.MK_BACKOFF_TRIES) || 5;
  baseMs ??= Number(process.env.MK_BACKOFF_BASE_MS) || 2000;
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const status = e?.status ?? 0;
      // network-level failures (undici "fetch failed", resets, DNS blips) are
      // as transient as a 503 — retry them too
      const network = !status && /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|network/i.test(`${e?.message} ${e?.cause?.code ?? ''}`);
      const transient = network || status === 429 || (status >= 500 && status <= 504);
      if (!transient || attempt === tries - 1) throw e;
      const delay = Math.min(180_000, Math.round(baseMs * 2 ** attempt * (0.7 + Math.random() * 0.6)));
      console.warn(`  ${label}: ${status || 'network'} — backing off ${(delay / 1000).toFixed(1)}s (attempt ${attempt + 1}/${tries})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/** an Error carrying the upstream HTTP status (withBackoff's retry signal) */
function apiError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

/** Gemini image generation (nano-banana). referencePaths are optional input
 *  images; imageSize ('1K' | '2K' | '4K') is optional (model default ~1K). */
export async function geminiImage({ apiKey, model, prompt, referencePaths = [], aspectRatio, imageSize }) {
  if (genMock()) return mockImage(aspectRatio);
  const parts = [{ text: prompt }, ...referencePaths.map(imagePart)];
  const imageConfig = { ...(aspectRatio ? { aspectRatio } : {}), ...(imageSize ? { imageSize } : {}) };
  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      ...(Object.keys(imageConfig).length ? { imageConfig } : {}),
    },
  };
  return withBackoff(async () => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
    const json = await res.json();
    if (!res.ok) throw apiError(`gemini ${model}: ${res.status} ${JSON.stringify(json).slice(0, 400)}`, res.status);
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part) throw new Error(`gemini ${model}: no image in response: ${JSON.stringify(json).slice(0, 400)}`);
    return Buffer.from(part.inlineData.data, 'base64');
  }, { label: `gemini ${model}` });
}

/** Gemini text generation (design drafts, lore propagation). Returns the
 *  response text; pass responseMimeType 'application/json' for JSON-mode. */
export async function geminiText({ apiKey, model, prompt, temperature = 0.85, topP = 0.9, responseMimeType }) {
  if (genMock()) return responseMimeType === 'application/json' ? '{}' : '(mock text)';
  return withBackoff(async () => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature, topP, ...(responseMimeType ? { responseMimeType } : {}) },
        }),
      },
    );
    const json = await res.json();
    if (!res.ok) throw apiError(`gemini ${model}: ${res.status} ${JSON.stringify(json).slice(0, 400)}`, res.status);
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('\n') ?? '';
    if (!text.trim()) throw new Error(`gemini ${model}: empty text response`);
    return text;
  }, { label: `gemini ${model}` });
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
  if (genMock()) return mockAudio();
  return withBackoff(async () => {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability, similarity_boost: similarityBoost, style },
      }),
    });
    if (!res.ok) throw apiError(`elevenlabs tts ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status);
    return Buffer.from(await res.arrayBuffer());
  }, { label: 'elevenlabs tts' });
}

/** ElevenLabs sound-effect generation. Returns an audio Buffer. */
export async function elevenSfx({ apiKey, text, seconds, promptInfluence = 0.6 }) {
  if (genMock()) return mockAudio();
  return withBackoff(async () => {
    const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, duration_seconds: seconds, prompt_influence: promptInfluence }),
    });
    if (!res.ok) throw apiError(`sfx ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status);
    return Buffer.from(await res.arrayBuffer());
  }, { label: 'elevenlabs sfx' });
}

/** Fish Audio TTS with a cloned voice model. Returns an audio Buffer. */
export async function fishTTS({ apiKey, referenceId, text, temperature = 0.7, topP = 0.7, model = 's1', format = 'mp3' }) {
  if (genMock()) return mockAudio();
  return withBackoff(async () => {
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
    if (!res.ok) throw apiError(`fish tts ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status);
    return Buffer.from(await res.arrayBuffer());
  }, { label: 'fish tts' });
}

/** OpenAI image generation (gpt-image-2). */
export async function openaiImage({ apiKey, prompt, size = '1536x1024', model = 'gpt-image-2' }) {
  if (genMock()) return mockImage('16:9');
  return withBackoff(async () => {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, prompt, size, quality: 'high' }),
    });
    const json = await res.json();
    if (!res.ok) throw apiError(`openai images: ${res.status} ${JSON.stringify(json).slice(0, 400)}`, res.status);
    return Buffer.from(json.data[0].b64_json, 'base64');
  }, { label: 'openai images' });
}
