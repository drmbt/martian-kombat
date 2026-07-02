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
