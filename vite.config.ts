/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** collect a POST body then hand it to `done` parsed as JSON (dev-editor only) */
function readJsonBody(req: import('node:http').IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const okId = (id: unknown): id is string => typeof id === 'string' && /^[a-z0-9_-]+$/.test(id);
// same chroma-key + scale/pad filter tools/pack-sheet.mjs uses, so a
// regenerated frame lands in the exact 288x384 cell space the packer produces
const FF_KEY_PAD =
  'chromakey=0x00B140:0.15:0.06,scale=288:384:force_original_aspect_ratio=decrease,' +
  'pad=288:384:(ow-iw)/2:oh-ih:color=0x00000000';

// Dev-only editor backend: a tiny middleware that lets the in-game front-end
// editors write data files back to disk during `npm run dev`. `apply: 'serve'`
// keeps it out of the production build entirely — there is no such endpoint on
// the shipped site. See src/scenes/StagePinEditorScene.ts for the client.
function editorApi(): Plugin {
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
  return {
    name: 'mk-editor-api',
    apply: 'serve',
    configureServer(server) {
      // POST /__editor/stage-pins  { "<stageId>": { "x": 0..1, "y": 0..1 }, ... }
      // -> writes src/data/stage-pins.json (normalized world-map coords).
      server.middlewares.use('/__editor/stage-pins', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const raw = JSON.parse(body || '{}') as Record<string, unknown>;
            const out: Record<string, { x: number; y: number }> = {};
            for (const [id, v] of Object.entries(raw)) {
              const p = v as { x?: unknown; y?: unknown };
              if (typeof p?.x === 'number' && typeof p?.y === 'number') {
                out[id] = { x: clamp01(p.x), y: clamp01(p.y) };
              }
            }
            const file = fileURLToPath(new URL('./src/data/stage-pins.json', import.meta.url));
            writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, count: Object.keys(out).length }));
          } catch (err) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: String(err) }));
          }
        });
      });

      // POST /__editor/character  { "id": "<charId>", "moves": {...} }
      // -> merges into src/data/characters/<id>.json's `moves` key (the
      //    move tuner's WRITE TO DISK button, see src/ui/MoveTunerPanel.ts).
      server.middlewares.use('/__editor/character', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const { id, moves, scale } = JSON.parse(body || '{}') as {
              id?: string;
              moves?: Record<string, unknown>;
              scale?: number;
            };
            if (!id || !/^[a-z0-9_-]+$/.test(id)) throw new Error('invalid character id');
            const file = fileURLToPath(new URL(`./src/data/characters/${id}.json`, import.meta.url));
            const parsed = JSON.parse(readFileSync(file, 'utf-8')) as { moves?: Record<string, unknown>; scale?: number };
            if (moves) parsed.moves = { ...parsed.moves, ...moves };
            if (typeof scale === 'number') parsed.scale = scale;
            writeFileSync(file, JSON.stringify(parsed, null, 2) + '\n');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, moveCount: Object.keys(parsed.moves).length }));
          } catch (err) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: String(err) }));
          }
        });
      });

      const sendJson = (res: import('node:http').ServerResponse, code: number, obj: unknown): void => {
        res.statusCode = code;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(obj));
      };
      const root = fileURLToPath(new URL('.', import.meta.url));

      // POST /__editor/sheet  { id, pngBase64, meta, manifest }
      // -> backs up the current sheet.png + meta.json to a gitignored
      //    timestamped folder, then overwrites them with the edited versions
      //    (the Sprite Editor's WRITE SHEET button). Non-destructive: the old
      //    art is always preserved under assets/raw/sprite-edits/<id>/<ts>/.
      server.middlewares.use('/__editor/sheet', (req, res, next) => {
        if (req.method !== 'POST') return next();
        readJsonBody(req)
          .then((b) => {
            const { id, pngBase64, meta, manifest } = b as {
              id?: unknown; pngBase64?: unknown; meta?: unknown; manifest?: unknown;
            };
            if (!okId(id)) throw new Error('invalid character id');
            if (typeof pngBase64 !== 'string' || typeof meta !== 'object' || meta === null) {
              throw new Error('missing pngBase64 or meta');
            }
            const spriteDir = join(root, 'public/assets/sprites', id);
            const sheetPath = join(spriteDir, 'sheet.png');
            const metaPath = join(spriteDir, 'meta.json');
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupDir = join(root, 'assets/raw/sprite-edits', id, stamp);
            mkdirSync(backupDir, { recursive: true });
            if (existsSync(sheetPath)) copyFileSync(sheetPath, join(backupDir, 'sheet.png'));
            if (existsSync(metaPath)) copyFileSync(metaPath, join(backupDir, 'meta.json'));
            if (manifest !== undefined) {
              writeFileSync(join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
            }
            writeFileSync(sheetPath, Buffer.from(pngBase64, 'base64'));
            writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
            sendJson(res, 200, { ok: true, backup: `assets/raw/sprite-edits/${id}/${stamp}` });
          })
          .catch((err) => sendJson(res, 400, { ok: false, error: String(err) }));
      });

      // POST /__editor/skeleton-regen  { id, cells: [{ name, pngBase64 }] }
      // -> runs DWPose (tools/qa/infer_keypoints.py) on the freshly exported
      //    cells and returns { name: { joint: [x, y, conf] } }.
      server.middlewares.use('/__editor/skeleton-regen', (req, res, next) => {
        if (req.method !== 'POST') return next();
        readJsonBody(req)
          .then(async (b) => {
            const { id, cells } = b as { id?: unknown; cells?: unknown };
            if (!okId(id)) throw new Error('invalid character id');
            if (!Array.isArray(cells) || !cells.length) throw new Error('no cells');
            const scratch = join(tmpdir(), `mk-kp-${id}-${Date.now()}`);
            mkdirSync(scratch, { recursive: true });
            for (const c of cells as { name?: unknown; pngBase64?: unknown }[]) {
              if (typeof c.name !== 'string' || typeof c.pngBase64 !== 'string') continue;
              writeFileSync(join(scratch, `${c.name}.png`), Buffer.from(c.pngBase64, 'base64'));
            }
            const { resolvePython } = await import('./tools/qa/resolve-python.mjs');
            const out = execFileSync(resolvePython(), [join(root, 'tools/qa/infer_keypoints.py'), '--dir', scratch], {
              encoding: 'utf-8',
              maxBuffer: 32 * 1024 * 1024,
            });
            sendJson(res, 200, { ok: true, keypoints: JSON.parse(out) });
          })
          .catch((err) => sendJson(res, 400, { ok: false, error: String(err) }));
      });

      // POST /__editor/gen-frame  { id, cellName, prompt, referenceBase64?[] }
      // -> nano-banana generates a new frame from the prompt (+ optional
      //    reference images), keyed+scaled to the 288x384 cell, returned as
      //    base64 for the editor to drop into the grid. Dev-only; the key
      //    never ships (apply: 'serve').
      server.middlewares.use('/__editor/gen-frame', (req, res, next) => {
        if (req.method !== 'POST') return next();
        readJsonBody(req)
          .then(async (b) => {
            const { id, prompt, referenceBase64 } = b as {
              id?: unknown; prompt?: unknown; referenceBase64?: unknown;
            };
            if (!okId(id)) throw new Error('invalid character id');
            if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('empty prompt');
            const lib = await import('./tools/lib.mjs');
            const env = lib.loadEnv();
            const apiKey = env.GEMINI_API_KEY;
            if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');
            const scratch = join(tmpdir(), `mk-gen-${id}-${Date.now()}`);
            mkdirSync(scratch, { recursive: true });
            const refPaths: string[] = [];
            const refs = Array.isArray(referenceBase64) ? (referenceBase64 as unknown[]) : [];
            refs.forEach((r, i) => {
              if (typeof r === 'string') {
                const p = join(scratch, `ref-${i}.png`);
                writeFileSync(p, Buffer.from(r, 'base64'));
                refPaths.push(p);
              }
            });
            const raw = await lib.geminiImage({
              apiKey,
              model: 'gemini-3-pro-image',
              prompt,
              referencePaths: refPaths,
            });
            const rawPath = join(scratch, 'gen.png');
            writeFileSync(rawPath, raw);
            const cellPath = join(scratch, 'cell.png');
            execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', rawPath, '-vf', FF_KEY_PAD, '-frames:v', '1', cellPath]);
            sendJson(res, 200, { ok: true, pngBase64: readFileSync(cellPath).toString('base64') });
          })
          .catch((err) => sendJson(res, 400, { ok: false, error: String(err) }));
      });

      // POST /__editor/creator/gen  { kind, prompt, referenceBase64?[] }
      // Character Creator wizard's one generate endpoint. Returns a keyed 288x384
      // cell as base64. When GEMINI_API_KEY is missing OR MK_CREATOR_MOCK=1 it
      // returns { mock:true } and the client draws a placeholder silhouette — so
      // the whole wizard is walkable with zero setup. Dev-only (apply:'serve').
      server.middlewares.use('/__editor/creator/gen', (req, res, next) => {
        if (req.method !== 'POST') return next();
        readJsonBody(req)
          .then(async (b) => {
            const { kind, prompt, referenceBase64 } = b as {
              kind?: unknown; prompt?: unknown; referenceBase64?: unknown;
            };
            if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('empty prompt');
            const lib = await import('./tools/lib.mjs');
            const env = lib.loadEnv();
            const apiKey = env.GEMINI_API_KEY;
            const mock = process.env.MK_CREATOR_MOCK === '1' || !apiKey;
            if (mock) {
              sendJson(res, 200, { ok: true, mock: true, kind: String(kind ?? 'sprite') });
              return;
            }
            const scratch = join(tmpdir(), `mk-cc-${Date.now()}`);
            mkdirSync(scratch, { recursive: true });
            const refPaths: string[] = [];
            const refs = Array.isArray(referenceBase64) ? (referenceBase64 as unknown[]) : [];
            refs.forEach((r, i) => {
              if (typeof r === 'string') {
                const p = join(scratch, `ref-${i}.png`);
                writeFileSync(p, Buffer.from(r, 'base64'));
                refPaths.push(p);
              }
            });
            const raw = await lib.geminiImage({ apiKey, model: 'gemini-3-pro-image', prompt, referencePaths: refPaths });
            const rawPath = join(scratch, 'gen.png');
            writeFileSync(rawPath, raw);
            const cellPath = join(scratch, 'cell.png');
            execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', rawPath, '-vf', FF_KEY_PAD, '-frames:v', '1', cellPath]);
            sendJson(res, 200, { ok: true, pngBase64: readFileSync(cellPath).toString('base64') });
          })
          .catch((err) => sendJson(res, 400, { ok: false, error: String(err) }));
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [editorApi()],
  // honor a harness-assigned port (e.g. Claude preview); default stays 5173
  server: { port: Number(process.env.PORT) || 5173 },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
