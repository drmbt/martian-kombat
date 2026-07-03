// Impact-VFX overlay art: composited hit sprites the renderer plays on top of
// the fighters (never baked into the sheets). Two asset classes:
//   (a) GENERICS — greyscale sparks on magenta, chroma-keyed, tinted per
//       character at runtime -> public/assets/vfx/<id>.png
//   (b) PER-MOVE — art that lives with the move like projectiles do
//       -> public/assets/sprites/<char>/vfx-<moveId>.png (the move's `vfx`
//       render-hint block in the character JSON wires it up)
// Raw gen -> assets/raw/vfx/ (gitignored). Idempotent; --force regens.
//   node tools/gen-vfx.mjs [--force] [--concurrency N]

import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ROOT, loadEnv, geminiImage, saveAsset, skip, pool, concurrencyArg } from './lib.mjs';

const env = loadEnv();
const force = process.argv.includes('--force');
const CONCURRENCY = concurrencyArg(4);

// Magenta screen (never green): sparks/smoke read as cool greys and whites,
// which die in a green chroma key — the Vincent teal-rune lesson.
const VFX_STYLE = `Single video-game impact VFX sprite, centered, on a SOLID FLAT MAGENTA (#FF00FF) background filling the entire frame edge to edge. Painted cel-shaded fighting-game style with crisp silhouette edges. Exactly ONE effect, no characters, no ground, no scenery, no text, no watermark, nothing touching the frame edges.`;

const GREYSCALE = `STRICTLY GREYSCALE artwork: pure white core, light grey mid-tones, dark grey edges — absolutely no color anywhere in the effect (it gets tinted per character in-game).`;

/** class (a): reusable greyscale sparks, tinted per character at runtime */
const GENERICS = {
  'spark-hit': `${GREYSCALE} A small sharp impact spark burst: a bright 4-point star flash with a few short radiating shard lines, like a light punch connecting in a 90s arcade fighter.`,
  'spark-heavy': `${GREYSCALE} A BIG violent impact explosion burst: jagged radiating star shards, concentric shock ring, debris flecks flying outward — a heavy blow landing in a 90s arcade fighter, roughly twice the visual energy of a jab spark.`,
  'spark-block': `${GREYSCALE} A flat defensive block ripple: a shallow curved shield-arc of light with small rectangular deflection sparks glancing off it sideways, like an attack being parried in a 90s arcade fighter.`,
};

/** class (b): per-move art living with the move, like projectile-<move>.png */
const PER_MOVE = {
  yulia: {
    'volga-piledriver': `A thick ground-impact smoke cloud: a wide, low, mushrooming burst of dense dust and smoke punched outward along the ground by a wrestling piledriver slam, with small rocks and debris flung out of it, warm grey-brown dust with deep red-orange ember glints inside. Bottom-heavy silhouette, wider than tall.`,
  },
  vincent: {
    'rising-glyph': `A vertical burst of arcane energy: a rising column of blue-violet mystical light with small teal rune glyphs and geometric sigil fragments scattering upward and outward, crackling wizardly energy. Taller than wide.`,
  },
};

function keyAndScale(raw, out, size) {
  // same recipe as pack-sheet projectiles: chromakey (no despill), tight scale
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', raw,
    '-vf', `chromakey=0xFF00FF:0.18:0.08,scale=${size}:${size}`,
    '-frames:v', '1', out,
  ]);
  console.log(`  -> ${out}`);
}

async function genOne({ label, prompt, raw, out, size }) {
  try {
    if (!skip(raw, force)) {
      console.log(`[vfx] ${label} ...`);
      const buf = await geminiImage({
        apiKey: env.GEMINI_API_KEY,
        model: 'gemini-3-pro-image',
        prompt,
        aspectRatio: '1:1',
      });
      saveAsset(raw, buf, prompt);
    }
    keyAndScale(raw, out, size);
  } catch (e) {
    console.error(`  FAILED ${label}: ${e.message}`);
  }
}

const jobs = [];
mkdirSync(join(ROOT, 'public/assets/vfx'), { recursive: true });
for (const [id, flavor] of Object.entries(GENERICS)) {
  jobs.push({
    label: id,
    prompt: `${VFX_STYLE}\n${flavor}`,
    raw: join(ROOT, 'assets/raw/vfx', `${id}.png`),
    out: join(ROOT, 'public/assets/vfx', `${id}.png`),
    size: 256,
  });
}
for (const [charId, moves] of Object.entries(PER_MOVE)) {
  for (const [moveId, flavor] of Object.entries(moves)) {
    jobs.push({
      label: `${charId}/${moveId}`,
      prompt: `${VFX_STYLE}\n${flavor}`,
      raw: join(ROOT, 'assets/raw/vfx', charId, `${moveId}.png`),
      out: join(ROOT, 'public/assets/sprites', charId, `vfx-${moveId}.png`),
      size: 256,
    });
  }
}
await pool(jobs, CONCURRENCY, genOne);
console.log('done.');
