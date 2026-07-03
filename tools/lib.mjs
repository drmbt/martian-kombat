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

/** fal.ai route for nano-banana-pro (Gemini 3 Pro Image) — the fallback when
 *  the Google project hits its spend cap. Same inputs as geminiImage. */
export async function falImage({ apiKey, prompt, referencePaths = [], aspectRatio }) {
  const withRefs = referencePaths.length > 0;
  const endpoint = `https://fal.run/fal-ai/nano-banana-pro${withRefs ? '/edit' : ''}`;
  const input = {
    prompt,
    num_images: 1,
    output_format: 'png',
    ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
    ...(withRefs
      ? {
          image_urls: referencePaths.map(
            (p) =>
              `data:${MIME[extname(p).toLowerCase()] ?? 'image/jpeg'};base64,${readFileSync(p).toString('base64')}`,
          ),
        }
      : {}),
  };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`fal nano-banana-pro: ${res.status} ${JSON.stringify(json).slice(0, 400)}`);
  const url = json.images?.[0]?.url;
  if (!url) throw new Error(`fal nano-banana-pro: no image in response: ${JSON.stringify(json).slice(0, 400)}`);
  if (url.startsWith('data:')) return Buffer.from(url.split(',')[1], 'base64');
  const img = await fetch(url);
  if (!img.ok) throw new Error(`fal image download: ${img.status}`);
  return Buffer.from(await img.arrayBuffer());
}

/** Gemini image generation (nano-banana). referencePaths are optional input
 *  images. Falls back to the fal.ai route automatically when the Google
 *  project is over its spend cap (429 RESOURCE_EXHAUSTED) and FAL_KEY is set. */
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
  if (!res.ok) {
    const falKey = loadEnv().FAL_KEY;
    if (res.status === 429 && falKey) {
      console.log('  (gemini spend cap hit — falling back to fal.ai nano-banana-pro)');
      return falImage({ apiKey: falKey, prompt, referencePaths, aspectRatio });
    }
    throw new Error(`gemini ${model}: ${res.status} ${JSON.stringify(json).slice(0, 400)}`);
  }
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) throw new Error(`gemini ${model}: no image in response: ${JSON.stringify(json).slice(0, 400)}`);
  return Buffer.from(part.inlineData.data, 'base64');
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
