/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, cpSync, rmSync } from 'node:fs';
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
// portraits are SQUARE (character-select icon aspect) and centered, not floor-aligned
const FF_KEY_PAD_SQUARE =
  'chromakey=0x00B140:0.15:0.06,scale=512:512:force_original_aspect_ratio=decrease,' +
  'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000';
// stages are full backgrounds — NO chroma key; cover-crop to the 21:9 fight aspect
const FF_STAGE = 'scale=1680:720:force_original_aspect_ratio=increase,crop=1680:720';

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
            const { id, moves, scale, hurtStand, bodyBox, hurtCrouch, spriteOffsetY } = JSON.parse(body || '{}') as {
              id?: string;
              moves?: Record<string, unknown>;
              scale?: number;
              hurtStand?: unknown; bodyBox?: unknown; hurtCrouch?: unknown; spriteOffsetY?: number;
            };
            if (!id || !/^[a-z0-9_-]+$/.test(id)) throw new Error('invalid character id');
            const file = fileURLToPath(new URL(`./src/data/characters/${id}.json`, import.meta.url));
            const parsed = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown> & { moves?: Record<string, unknown> };
            if (moves) parsed.moves = { ...parsed.moves, ...moves };
            // scale/offset bake-down: scale 1 and offset 0 are identity — drop the
            // keys instead of writing them so the JSON stays clean.
            if (typeof scale === 'number') { if (scale === 1) delete parsed.scale; else parsed.scale = scale; }
            if (hurtStand && typeof hurtStand === 'object') parsed.hurtStand = hurtStand;
            if (bodyBox && typeof bodyBox === 'object') parsed.bodyBox = bodyBox;
            if (hurtCrouch && typeof hurtCrouch === 'object') parsed.hurtCrouch = hurtCrouch;
            if (typeof spriteOffsetY === 'number') { if (spriteOffsetY === 0) delete parsed.spriteOffsetY; else parsed.spriteOffsetY = spriteOffsetY; }
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
            const { kind, prompt, referenceBase64, id, key, frame } = b as {
              kind?: unknown; prompt?: unknown; referenceBase64?: unknown; id?: string; key?: string; frame?: string;
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
            const isPortrait = kind === 'portrait' || kind === 'ko';
            const isStage = kind === 'stage';
            const raw = await lib.geminiImage({
              apiKey, model: 'gemini-3-pro-image', prompt, referencePaths: refPaths,
              aspectRatio: isPortrait ? '1:1' : isStage ? '16:9' : undefined,
            });
            const rawPath = join(scratch, 'gen.png');
            writeFileSync(rawPath, raw);
            const filter = isStage ? FF_STAGE : isPortrait ? FF_KEY_PAD_SQUARE : FF_KEY_PAD;
            const cellPath = join(scratch, isStage ? 'cell.jpg' : 'cell.png');
            const args = isStage
              ? ['-y', '-loglevel', 'error', '-i', rawPath, '-vf', filter, '-frames:v', '1', '-q:v', '3', cellPath]
              : ['-y', '-loglevel', 'error', '-i', rawPath, '-vf', filter, '-frames:v', '1', cellPath];
            execFileSync('ffmpeg', args);
            // live-persist the frame to the gitignored raw dir so a run survives reload
            let savedAs: string | undefined;
            if (okId(id) && typeof key === 'string' && key) {
              const dir = join(root, 'assets/raw/creator', id, 'img');
              mkdirSync(dir, { recursive: true });
              // pipeline-style name (NN-cellname / canonical / portrait / stage), hyphens kept
              const base = (typeof frame === 'string' && frame ? frame : key.replace(/^sprite:/, '')).replace(/[^a-z0-9-]+/gi, '-');
              savedAs = base + (isStage ? '.jpg' : '.png');
              copyFileSync(cellPath, join(dir, savedAs));
            }
            sendJson(res, 200, { ok: true, pngBase64: readFileSync(cellPath).toString('base64'), mime: isStage ? 'image/jpeg' : 'image/png', savedAs });
          })
          .catch((err) => sendJson(res, 400, { ok: false, error: String(err) }));
      });

      // POST /__editor/creator/audio  { name, vo: { kiai[], hurt[], victory[] }, voice? }
      // -> ElevenLabs TTS: announcer name + the character's kiai/hurt/victory VO
      //    lines. Returns { clips: { announcer, kiai-1..6, hurt-1..6, victory-1..4 } }
      //    as base64 mp3. Mocks when no ELEVENLABS_API_KEY / MK_CREATOR_MOCK=1.
      const ELEVEN = { announcer: 'V33LkP9pVLdcjeB2y5Na', m: 'SOYHLrjzK2X1ezoPC6cr', f: 'EXAVITQu4vr4xnSDxMaL' };
      const elevenTts = async (apiKey: string, voiceId: string, text: string): Promise<Buffer> => {
        const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.4, style: 0.7, similarity_boost: 0.8 } }),
        });
        if (!r.ok) throw new Error(`elevenlabs tts ${r.status}: ${await r.text()}`);
        return Buffer.from(await r.arrayBuffer());
      };
      server.middlewares.use('/__editor/creator/audio', (req, res, next) => {
        if (req.method !== 'POST') return next();
        readJsonBody(req)
          .then(async (b) => {
            const { name, vo, voice, fishModelId } = b as { name?: string; vo?: { kiai?: string[]; hurt?: string[]; victory?: string[] }; voice?: string; fishModelId?: string };
            const lib = await import('./tools/lib.mjs');
            const env = lib.loadEnv();
            const apiKey = env.ELEVENLABS_API_KEY;
            if (process.env.MK_CREATOR_MOCK === '1' || !apiKey) { sendJson(res, 200, { ok: true, mock: true }); return; }
            const vId = voice === 'f' ? ELEVEN.f : ELEVEN.m;
            // announcer always ElevenLabs; grunts via the Fish clone if one exists, else ElevenLabs
            const useFish = typeof fishModelId === 'string' && !!env.FISH_API_KEY;
            const jobs: { clip: string; text: string; fish: boolean; voiceId: string }[] = [{ clip: 'announcer', text: (name ?? 'fighter').toUpperCase(), fish: false, voiceId: ELEVEN.announcer }];
            (vo?.kiai ?? []).slice(0, 6).forEach((t, i) => jobs.push({ clip: `kiai-${i + 1}`, text: t, fish: useFish, voiceId: vId }));
            (vo?.hurt ?? []).slice(0, 6).forEach((t, i) => jobs.push({ clip: `hurt-${i + 1}`, text: t, fish: useFish, voiceId: vId }));
            (vo?.victory ?? []).slice(0, 4).forEach((t, i) => jobs.push({ clip: `victory-${i + 1}`, text: t, fish: useFish, voiceId: vId }));
            const clips: Record<string, string> = {};
            await lib.pool(jobs, 3, async (j: { clip: string; text: string; fish: boolean; voiceId: string }) => {
              const buf = j.fish
                ? await lib.fishTTS({ apiKey: env.FISH_API_KEY, referenceId: fishModelId, text: j.text })
                : await elevenTts(apiKey, j.voiceId, j.text);
              clips[j.clip] = buf.toString('base64');
            });
            sendJson(res, 200, { ok: true, clips, voice: useFish ? 'clone' : 'stock' });
          })
          .catch((err) => sendJson(res, 400, { ok: false, error: String(err) }));
      });

      // POST /__editor/creator/audio-clip  { clip, text, name, fishModelId? }
      // -> re-synth ONE VO line (announcer name via Maverick; grunts via the
      //    character voice or the Fish clone). Returns { clip, base64 }. Mocks.
      server.middlewares.use('/__editor/creator/audio-clip', (req, res, next) => {
        if (req.method !== 'POST') return next();
        readJsonBody(req)
          .then(async (b) => {
            const { clip, text, name, fishModelId } = b as { clip?: string; text?: string; name?: string; fishModelId?: string };
            if (typeof clip !== 'string' || !clip) throw new Error('missing clip');
            const lib = await import('./tools/lib.mjs');
            const env = lib.loadEnv();
            const apiKey = env.ELEVENLABS_API_KEY;
            if (process.env.MK_CREATOR_MOCK === '1' || !apiKey) { sendJson(res, 200, { ok: true, mock: true, clip }); return; }
            let buf: Buffer;
            if (clip === 'announcer') {
              buf = await elevenTts(apiKey, ELEVEN.announcer, String(text || name || 'fighter').toUpperCase());
            } else if (!String(text ?? '').trim()) {
              throw new Error('empty line');
            } else if (typeof fishModelId === 'string' && env.FISH_API_KEY) {
              buf = await lib.fishTTS({ apiKey: env.FISH_API_KEY, referenceId: fishModelId, text: String(text) });
            } else {
              buf = await elevenTts(apiKey, ELEVEN.m, String(text));
            }
            sendJson(res, 200, { ok: true, clip, base64: buf.toString('base64') });
          })
          .catch((err) => sendJson(res, 400, { ok: false, error: String(err) }));
      });

      // POST /__editor/creator/move-audio  { kind:'voice'|'sfx', text, name?, fishModelId? }
      // -> a per-move call-out: a spoken VO line (ElevenLabs TTS / Fish clone) or a
      //    sound effect (ElevenLabs sound-generation). Returns { base64 }. Mocks.
      server.middlewares.use('/__editor/creator/move-audio', (req, res, next) => {
        if (req.method !== 'POST') return next();
        readJsonBody(req)
          .then(async (b) => {
            const { kind, text, fishModelId } = b as { kind?: string; text?: string; fishModelId?: string };
            if (typeof text !== 'string' || !text.trim()) throw new Error('empty text');
            const lib = await import('./tools/lib.mjs');
            const env = lib.loadEnv();
            const apiKey = env.ELEVENLABS_API_KEY;
            if (process.env.MK_CREATOR_MOCK === '1' || !apiKey) { sendJson(res, 200, { ok: true, mock: true }); return; }
            let buf: Buffer;
            if (kind === 'sfx') {
              const r = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
                method: 'POST', headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, duration_seconds: 2 }),
              });
              if (!r.ok) throw new Error(`elevenlabs sfx ${r.status}: ${await r.text()}`);
              buf = Buffer.from(await r.arrayBuffer());
            } else if (typeof fishModelId === 'string' && env.FISH_API_KEY) {
              buf = await lib.fishTTS({ apiKey: env.FISH_API_KEY, referenceId: fishModelId, text });
            } else {
              buf = await elevenTts(apiKey, ELEVEN.m, text);
            }
            sendJson(res, 200, { ok: true, base64: buf.toString('base64') });
          })
          .catch((err) => sendJson(res, 400, { ok: false, error: String(err) }));
      });

      // POST /__editor/creator/music  { prompt, durationMs? }
      // -> ElevenLabs Music (compose) -> base64 mp3 loop. Mocks w/o key.
      server.middlewares.use('/__editor/creator/music', (req, res, next) => {
        if (req.method !== 'POST') return next();
        readJsonBody(req)
          .then(async (b) => {
            const { prompt, durationMs } = b as { prompt?: string; durationMs?: number };
            if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('empty music prompt');
            const lib = await import('./tools/lib.mjs');
            const apiKey = lib.loadEnv().ELEVENLABS_API_KEY;
            if (process.env.MK_CREATOR_MOCK === '1' || !apiKey) { sendJson(res, 200, { ok: true, mock: true }); return; }
            const r = await fetch('https://api.elevenlabs.io/v1/music', {
              method: 'POST',
              headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt, music_length_ms: Math.min(Math.max(durationMs ?? 60000, 10000), 120000) }),
            });
            if (!r.ok) throw new Error(`elevenlabs music ${r.status}: ${await r.text()}`);
            sendJson(res, 200, { ok: true, mp3Base64: Buffer.from(await r.arrayBuffer()).toString('base64') });
          })
          .catch((err) => sendJson(res, 400, { ok: false, error: String(err) }));
      });

      // POST /__editor/creator/fatality  { name, fatalityName, referenceBase64[] }
      // -> 4 cinematic 16:9 panels (1280x720 jpg) from the canonical + a generic
      //    victim, base64. Mocks w/o GEMINI key.
      server.middlewares.use('/__editor/creator/fatality', (req, res, next) => {
        if (req.method !== 'POST') return next();
        readJsonBody(req)
          .then(async (b) => {
            const { name, fatalityName, referenceBase64, panelPrompts, only } = b as { name?: string; fatalityName?: string; referenceBase64?: unknown; panelPrompts?: unknown; only?: number };
            const lib = await import('./tools/lib.mjs');
            const apiKey = lib.loadEnv().GEMINI_API_KEY;
            if (process.env.MK_CREATOR_MOCK === '1' || !apiKey) { sendJson(res, 200, { ok: true, mock: true }); return; }
            const scratch = join(tmpdir(), `mk-fat-${Date.now()}`); mkdirSync(scratch, { recursive: true });
            const refs = Array.isArray(referenceBase64) ? (referenceBase64 as unknown[]) : [];
            const refPaths: string[] = [];
            refs.forEach((r, i) => { if (typeof r === 'string') { const p = join(scratch, `ref-${i}.png`); writeFileSync(p, Buffer.from(r, 'base64')); refPaths.push(p); } });
            const N = (name ?? 'the fighter').toUpperCase(), F = fatalityName ?? 'the finisher';
            const defaults = [
              `${N} seizes the dazed, beaten opponent and begins the finishing move "${F}" — the opponent recoiling in terror`,
              `mid-execution of "${F}", ${N} unleashing the move at full force, the opponent's body contorting`,
              `the brutal peak of "${F}", dramatic impact, the opponent breaking apart, stylized gore`,
              `the aftermath — ${N} standing victorious over the destroyed opponent, a smouldering husk`,
            ];
            // client-edited beats win; a single `only` index rerolls just that panel
            const src = Array.isArray(panelPrompts) && panelPrompts.length === 4 ? (panelPrompts as unknown[]).map((p, i) => (typeof p === 'string' && p.trim() ? p : defaults[i])) : defaults;
            const idxs = typeof only === 'number' && only >= 0 && only < 4 ? [only] : [0, 1, 2, 3];
            const panels: string[] = [];
            await lib.pool(idxs.map((i) => ({ beat: src[i], i })), 2, async (j: { beat: string; i: number }) => {
              const prompt = `16:9 cinematic fighting-game fatality cutscene panel, hand-painted cel-shaded style: ${j.beat}. Dramatic lighting, dynamic composition, full-bleed.`;
              const raw = await lib.geminiImage({ apiKey, model: 'gemini-3-pro-image', prompt, referencePaths: refPaths, aspectRatio: '16:9' });
              const rp = join(scratch, `p-${j.i}.png`); writeFileSync(rp, raw);
              const fp = join(scratch, `p-${j.i}.jpg`);
              execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', rp, '-vf', 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720', '-frames:v', '1', '-q:v', '3', fp]);
              panels[j.i] = readFileSync(fp).toString('base64');
            });
            sendJson(res, 200, { ok: true, panels });
          })
          .catch((err) => sendJson(res, 400, { ok: false, error: String(err) }));
      });

      // POST /__editor/creator/voice-clone  { id, name, samples: [{ name, base64 }] }
      // -> registers a private Fish Audio voice model from the samples, saves it
      //    to tools/voices.json, returns { modelId }. Mocks w/o FISH key.
      server.middlewares.use('/__editor/creator/voice-clone', (req, res, next) => {
        if (req.method !== 'POST') return next();
        readJsonBody(req)
          .then(async (b) => {
            const { id, name, samples } = b as { id?: string; name?: string; samples?: { name?: string; base64?: string }[] };
            if (!okId(id)) throw new Error('invalid id');
            if (!Array.isArray(samples) || !samples.length) throw new Error('no voice samples');
            const lib = await import('./tools/lib.mjs');
            const key = lib.loadEnv().FISH_API_KEY;
            if (process.env.MK_CREATOR_MOCK === '1' || !key) { sendJson(res, 200, { ok: true, mock: true }); return; }
            const fd = new FormData();
            fd.append('type', 'tts'); fd.append('train_mode', 'fast'); fd.append('visibility', 'private');
            fd.append('title', `Martian Kombat — ${id}`);
            for (const s of samples) {
              if (typeof s.base64 !== 'string') continue;
              const ext = (s.name ?? 'clip.wav').split('.').pop()?.toLowerCase() ?? 'wav';
              const mime = ext === 'mp3' ? 'audio/mpeg' : ext === 'm4a' ? 'audio/mp4' : ext === 'ogg' ? 'audio/ogg' : ext === 'flac' ? 'audio/flac' : 'audio/wav';
              fd.append('voices', new Blob([Buffer.from(s.base64, 'base64')], { type: mime }), s.name ?? `clip.${ext}`);
            }
            const r = await fetch('https://api.fish.audio/model', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd });
            if (!r.ok) throw new Error(`fish model ${r.status}: ${(await r.text()).slice(0, 300)}`);
            const j = (await r.json()) as { _id?: string };
            if (!j._id) throw new Error('fish: no model id returned');
            const voices = lib.loadVoices();
            voices[id] = { provider: 'fish', modelId: j._id, title: `Martian Kombat — ${name ?? id}`, createdAt: new Date().toISOString() };
            lib.saveVoices(voices);
            sendJson(res, 200, { ok: true, modelId: j._id });
          })
          .catch((err) => sendJson(res, 400, { ok: false, error: String(err) }));
      });

      // POST /__editor/creator/save  { id, state }
      // -> persists the in-browser working-model state (no image bytes — those
      //    live as files written by /creator/gen) to the gitignored raw dir so a
      //    run survives a reload / can be resumed. Debounced by the client.
      server.middlewares.use('/__editor/creator/save', (req, res, next) => {
        if (req.method !== 'POST') return next();
        readJsonBody(req)
          .then((b) => {
            const { id, state } = b as { id?: string; state?: unknown };
            if (!okId(id)) throw new Error('invalid id');
            const dir = join(root, 'assets/raw/creator', id);
            mkdirSync(dir, { recursive: true });
            writeFileSync(join(dir, 'state.json'), JSON.stringify(state ?? {}, null, 2));
            sendJson(res, 200, { ok: true });
          })
          .catch((err) => sendJson(res, 400, { ok: false, error: String(err) }));
      });

      // POST /__editor/creator/save-frame  { id, savedAs, pngBase64 }
      // -> writes one frame to the raw dir (after a timeline copy/swap) so the
      //    on-disk frames + resume stay in sync with the in-browser edit.
      server.middlewares.use('/__editor/creator/save-frame', (req, res, next) => {
        if (req.method !== 'POST') return next();
        readJsonBody(req)
          .then((b) => {
            const { id, savedAs, pngBase64 } = b as { id?: string; savedAs?: string; pngBase64?: string };
            if (!okId(id)) throw new Error('invalid id');
            if (typeof savedAs !== 'string' || !/^[a-z0-9._-]+$/i.test(savedAs)) throw new Error('bad filename');
            if (typeof pngBase64 !== 'string') throw new Error('no image');
            const dir = join(root, 'assets/raw/creator', id, 'img');
            mkdirSync(dir, { recursive: true });
            writeFileSync(join(dir, savedAs), Buffer.from(pngBase64, 'base64'));
            sendJson(res, 200, { ok: true });
          })
          .catch((err) => sendJson(res, 400, { ok: false, error: String(err) }));
      });

      // POST /__editor/creator/state  { id } -> { state, images: { <jobKey>: base64 } }
      // Rehydrates a saved run: the state JSON + every persisted frame read back.
      server.middlewares.use('/__editor/creator/state', (req, res, next) => {
        if (req.method !== 'POST') return next();
        readJsonBody(req)
          .then((b) => {
            const { id } = b as { id?: string };
            if (!okId(id)) throw new Error('invalid id');
            const dir = join(root, 'assets/raw/creator', id);
            const statePath = join(dir, 'state.json');
            if (!existsSync(statePath)) { sendJson(res, 404, { ok: false, error: 'no saved draft' }); return; }
            const state = JSON.parse(readFileSync(statePath, 'utf-8')) as { jobs?: { key: string; savedAs?: string }[] };
            const imgDir = join(dir, 'img');
            const files = existsSync(imgDir) ? readdirSync(imgDir) : [];
            const images: Record<string, string> = {};
            for (const j of state.jobs ?? []) {
              // prefer the recorded filename; else recover by cell name (handles the
              // pipeline `NN-cellname` naming + interrupted gens with no savedAs)
              const cell = j.key.replace(/^sprite:/, '');
              const match = (j.savedAs && files.includes(j.savedAs) && j.savedAs)
                || files.find((f) => f === `${cell}.png` || f === `${cell}.jpg` || f.endsWith(`-${cell}.png`) || f.endsWith(`-${cell}.jpg`));
              if (match) images[j.key] = readFileSync(join(imgDir, match)).toString('base64');
            }
            sendJson(res, 200, { ok: true, state, images });
          })
          .catch((err) => sendJson(res, 400, { ok: false, error: String(err) }));
      });

      // GET/POST /__editor/creator/list -> { drafts: [{ id, name, step, updatedAt }] }
      server.middlewares.use('/__editor/creator/list', (req, res, next) => {
        if (req.method !== 'POST' && req.method !== 'GET') return next();
        try {
          const base = join(root, 'assets/raw/creator');
          const drafts: { id: string; name: string; step: number }[] = [];
          if (existsSync(base)) {
            for (const id of readdirSync(base)) {
              const sp = join(base, id, 'state.json');
              if (!existsSync(sp)) continue;
              try {
                const s = JSON.parse(readFileSync(sp, 'utf-8')) as { inputs?: { name?: string }; step?: number };
                drafts.push({ id, name: s.inputs?.name ?? id, step: s.step ?? 0 });
              } catch { /* skip bad state */ }
            }
          }
          sendJson(res, 200, { ok: true, drafts });
        } catch (err) { sendJson(res, 400, { ok: false, error: String(err) }); }
      });

      // POST /__editor/creator/export  (same payload as write)
      // -> stages a game-ready bundle + the raw progress into a temp dir and zips
      //    it, returning base64. Lets a remote user pack out their build/progress
      //    as a .zip and drop it into the game. Dev-only.
      server.middlewares.use('/__editor/creator/export', (req, res, next) => {
        if (req.method !== 'POST') return next();
        readJsonBody(req)
          .then((b) => {
            const p = b as {
              id?: string; name?: string; def?: Record<string, unknown>; sheetBase64?: string; meta?: unknown;
              portraitBase64?: string; koBase64?: string; bustBase64?: string; voClips?: Record<string, string>; musicBase64?: string; moveAudio?: Record<string, string>;
              stageBase64?: string; stageId?: string; fatalityPanels?: string[]; projectiles?: Record<string, string>;
            };
            if (!okId(p.id)) throw new Error('invalid id');
            const id = p.id;
            const stage = join(tmpdir(), `mk-export-${id}-${Date.now()}`);
            const A = join(stage, 'assets');
            mkdirSync(stage, { recursive: true });
            const def = { ...(p.def ?? {}) } as Record<string, unknown>;
            // sprites
            if (p.sheetBase64 && p.meta) {
              const d = join(A, 'sprites', id); mkdirSync(d, { recursive: true });
              writeFileSync(join(d, 'sheet.png'), Buffer.from(p.sheetBase64, 'base64'));
              writeFileSync(join(d, 'meta.json'), JSON.stringify(p.meta, null, 2) + '\n');
              for (const [moveId, b64] of Object.entries(p.projectiles ?? {})) {
                if (typeof b64 === 'string' && /^[a-z0-9_-]+$/.test(moveId)) writeFileSync(join(d, `projectile-${moveId}.png`), Buffer.from(b64, 'base64'));
              }
            }
            // portraits — real bust (canonical crop) + ko when present, else the portrait
            if (p.portraitBase64) {
              const d = join(A, 'portraits'); mkdirSync(d, { recursive: true });
              writeFileSync(join(d, `${id}.png`), Buffer.from(p.portraitBase64, 'base64'));
              writeFileSync(join(d, `${id}-bust.png`), Buffer.from(p.bustBase64 ?? p.portraitBase64, 'base64'));
              writeFileSync(join(d, `${id}-ko.png`), Buffer.from(p.koBase64 ?? p.portraitBase64, 'base64'));
            }
            // audio (only real clips — no silence padding in an export)
            const vo = p.voClips ?? {};
            if (Object.keys(vo).length) {
              mkdirSync(join(A, 'audio/announcer'), { recursive: true });
              mkdirSync(join(A, 'audio/voice'), { recursive: true });
              const dest = (clip: string): string => clip === 'announcer' ? join(A, 'audio/announcer', `${id}.mp3`) : join(A, 'audio/voice', `${id}-${clip}.mp3`);
              for (const [clip, b64] of Object.entries(vo)) writeFileSync(dest(clip), Buffer.from(b64, 'base64'));
            }
            if (p.moveAudio && Object.keys(p.moveAudio).length) {
              mkdirSync(join(A, 'audio/voice'), { recursive: true });
              for (const [moveId, b64] of Object.entries(p.moveAudio)) {
                if (typeof b64 === 'string' && /^[a-z0-9_-]+$/.test(moveId)) writeFileSync(join(A, 'audio/voice', `${id}-move-${moveId}.mp3`), Buffer.from(b64, 'base64'));
              }
            }
            if (p.musicBase64) {
              const d = join(A, 'audio/music/stages/default'); mkdirSync(d, { recursive: true });
              writeFileSync(join(d, `${id}-theme.mp3`), Buffer.from(p.musicBase64, 'base64'));
            }
            // fatality
            const fat = def.fatality as { id?: string } | undefined;
            if (Array.isArray(p.fatalityPanels) && p.fatalityPanels.length && fat?.id) {
              const d = join(A, 'fatalities', id); mkdirSync(d, { recursive: true });
              p.fatalityPanels.forEach((pan, i) => writeFileSync(join(d, `${fat.id}-${i + 1}.jpg`), Buffer.from(pan, 'base64')));
            } else delete def.fatality;
            // stage
            if (p.stageBase64 && okId(p.stageId)) {
              const d = join(A, 'backgrounds/stages'); mkdirSync(d, { recursive: true });
              writeFileSync(join(d, `${p.stageId}.jpg`), Buffer.from(p.stageBase64, 'base64'));
              def.stage = p.stageId;
            }
            writeFileSync(join(stage, `${id}.json`), JSON.stringify(def, null, 2) + '\n');
            // raw progress (state.json + frames) so the recipient can resume/re-pack
            const rawSrc = join(root, 'assets/raw/creator', id);
            if (existsSync(rawSrc)) cpSync(rawSrc, join(stage, 'raw'), { recursive: true });
            writeFileSync(join(stage, 'README.txt'),
              `Martian Kombat character bundle: ${id}\n\n` +
              `Drop the contents of assets/ into public/assets/ and ${id}.json into\n` +
              `src/data/characters/ (then register it in roster.ts + characters/index.ts).\n` +
              `raw/ holds the wizard's in-progress state for resuming/re-packing.\n`);
            // zip it
            const zipPath = join(tmpdir(), `mk-${id}-${Date.now()}.zip`);
            execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: stage });
            const zipBase64 = readFileSync(zipPath).toString('base64');
            try { rmSync(stage, { recursive: true, force: true }); rmSync(zipPath, { force: true }); } catch { /* best-effort */ }
            sendJson(res, 200, { ok: true, zipBase64, filename: `${id}.zip` });
          })
          .catch((err) => sendJson(res, 400, { ok: false, error: String(err) }));
      });

      // POST /__editor/creator/write  { id, name, def, sheetBase64, meta, portraitBase64 }
      // The wizard's SHIP step: writes a playable fighter to disk and registers
      // it — sheet.png + meta.json, portrait (+ bust/ko copies so boot is clean),
      // <id>.json, and idempotent inserts into roster.ts + characters/index.ts.
      // A lean pack path (no old QA/normalize, per docs §11a). Dev-only.
      server.middlewares.use('/__editor/creator/write', (req, res, next) => {
        if (req.method !== 'POST') return next();
        readJsonBody(req)
          .then((b) => {
            const { id, name, def, sheetBase64, meta, portraitBase64, koBase64, bustBase64, voClips, musicBase64, stageBase64, stageId, stageName, fatalityPanels, projectiles } = b as {
              id?: unknown; name?: unknown; def?: unknown; sheetBase64?: unknown; meta?: unknown; portraitBase64?: unknown;
              koBase64?: string; bustBase64?: string;
              voClips?: Record<string, string>; musicBase64?: string; moveAudio?: Record<string, string>;
              stageBase64?: string; stageId?: string; stageName?: string; fatalityPanels?: string[]; projectiles?: Record<string, string>;
            };
            if (!okId(id)) throw new Error('invalid character id');
            if (typeof sheetBase64 !== 'string' || typeof meta !== 'object' || meta === null) throw new Error('missing sheet/meta');
            if (typeof def !== 'object' || def === null) throw new Error('missing def');
            const disp = typeof name === 'string' && name ? name : id.toUpperCase();
            // sprites
            const spriteDir = join(root, 'public/assets/sprites', id);
            mkdirSync(spriteDir, { recursive: true });
            writeFileSync(join(spriteDir, 'sheet.png'), Buffer.from(sheetBase64, 'base64'));
            writeFileSync(join(spriteDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
            // per-move projectile art → sprites/<id>/projectile-<moveId>.png
            let wroteProjectiles = false;
            if (projectiles && typeof projectiles === 'object') {
              for (const [moveId, b64] of Object.entries(projectiles)) {
                if (typeof b64 !== 'string' || !/^[a-z0-9_-]+$/.test(moveId)) continue;
                writeFileSync(join(spriteDir, `projectile-${moveId}.png`), Buffer.from(b64, 'base64'));
                wroteProjectiles = true;
              }
            }
            // portrait: the straight-on select icon (<id>.png), the head-centered
            // BUST (<id>-bust.png, cropped from the canonical), and the beaten KO
            // bust (<id>-ko.png). Each falls back to the portrait so BootScene's
            // unconditional loads never 404.
            if (typeof portraitBase64 === 'string') {
              const portDir = join(root, 'public/assets/portraits');
              mkdirSync(portDir, { recursive: true });
              const portBuf = Buffer.from(portraitBase64, 'base64');
              writeFileSync(join(portDir, `${id}.png`), portBuf);
              writeFileSync(join(portDir, `${id}-bust.png`), Buffer.from(typeof bustBase64 === 'string' ? bustBase64 : portraitBase64, 'base64'));
              writeFileSync(join(portDir, `${id}-ko.png`), Buffer.from(typeof koBase64 === 'string' ? koBase64 : portraitBase64, 'base64'));
            }
            // silent placeholder VO so BootScene's unconditional per-fighter
            // audio loads resolve (a MISSING public asset is served as HTML by
            // the dev server and hangs the Phaser loader — see the roster-verify
            // note). One ffmpeg-generated silence, copied to all 17 clips.
            const audioRoot = join(root, 'public/assets/audio');
            mkdirSync(join(audioRoot, 'announcer'), { recursive: true });
            mkdirSync(join(audioRoot, 'voice'), { recursive: true });
            const silence = join(tmpdir(), `mk-silence-${Date.now()}.mp3`);
            execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '0.25', '-q:a', '9', silence]);
            const vo = (voClips && typeof voClips === 'object') ? voClips : {};
            // clip name (as returned by /creator/audio) -> destination path
            const clipMap: [string, string][] = [['announcer', join('announcer', `${id}.mp3`)]];
            for (let i = 1; i <= 6; i++) clipMap.push([`kiai-${i}`, join('voice', `${id}-kiai-${i}.mp3`)], [`hurt-${i}`, join('voice', `${id}-hurt-${i}.mp3`)]);
            for (let i = 1; i <= 4; i++) clipMap.push([`victory-${i}`, join('voice', `${id}-victory-${i}.mp3`)]);
            for (const [clip, rel] of clipMap) {
              const p = join(audioRoot, rel);
              if (typeof vo[clip] === 'string') writeFileSync(p, Buffer.from(vo[clip], 'base64'));
              else if (!existsSync(p)) copyFileSync(silence, p); // silence fallback so the loader never hangs
            }
            // per-move call-outs → voice/<id>-move-<moveId>.mp3 (loaded for moves with voice:true)
            if (moveAudio && typeof moveAudio === 'object') {
              for (const [moveId, b64] of Object.entries(moveAudio)) {
                if (typeof b64 === 'string' && /^[a-z0-9_-]+$/.test(moveId)) writeFileSync(join(audioRoot, 'voice', `${id}-move-${moveId}.mp3`), Buffer.from(b64, 'base64'));
              }
            }
            // stage music (generated or BYO) → the character's stage folder + a default fallback
            if (typeof musicBase64 === 'string') {
              const stageId = (def as { stage?: string }).stage;
              for (const dir of [stageId ? `stages/${stageId}` : null, 'stages/default'].filter(Boolean) as string[]) {
                const mdir = join(audioRoot, 'music', dir);
                mkdirSync(mdir, { recursive: true });
                writeFileSync(join(mdir, `${id}-theme.mp3`), Buffer.from(musicBase64, 'base64'));
              }
              // rescan music folders → manifest.json so the new theme actually plays
              try { execFileSync('node', [join(root, 'tools/gen-music-manifest.mjs')], { stdio: 'ignore' }); } catch { /* non-fatal */ }
            }
            const cleanDef = { ...(def as Record<string, unknown>) };
            // stage: write the generated bg + register it + claim it on the fighter
            if (typeof stageBase64 === 'string' && okId(stageId)) {
              const bgDir = join(root, 'public/assets/backgrounds/stages');
              mkdirSync(bgDir, { recursive: true });
              writeFileSync(join(bgDir, `${stageId}.jpg`), Buffer.from(stageBase64, 'base64'));
              cleanDef.stage = stageId;
              const stagesPath = join(root, 'src/data/stages.ts');
              let st = readFileSync(stagesPath, 'utf-8');
              if (!new RegExp(`'${stageId}'`).test(st)) {
                const sName = (typeof stageName === 'string' && stageName ? stageName : stageId).toUpperCase();
                st = st.replace(/(\n\];)/, `\n  stage('${stageId}', '${sName}'),$1`);
                writeFileSync(stagesPath, st);
              }
            }
            // fatality: write panels + KEEP the block (else drop it so BootScene won't 404)
            const fat = cleanDef.fatality as { id?: string; panels?: number } | undefined;
            if (Array.isArray(fatalityPanels) && fatalityPanels.length && fat?.id) {
              const fatDir = join(root, 'public/assets/fatalities', id);
              mkdirSync(fatDir, { recursive: true });
              fatalityPanels.forEach((p, i) => writeFileSync(join(fatDir, `${fat.id}-${i + 1}.jpg`), Buffer.from(p, 'base64')));
              cleanDef.fatality = { ...fat, panels: fatalityPanels.length };
            } else {
              delete cleanDef.fatality;
            }
            writeFileSync(join(root, 'src/data/characters', `${id}.json`), JSON.stringify(cleanDef, null, 2) + '\n');
            // register (idempotent) — characters/index.ts + roster.ts
            const varName = id.replace(/-/g, '_');
            const idxPath = join(root, 'src/data/characters/index.ts');
            let idx = readFileSync(idxPath, 'utf-8');
            if (!idx.includes(`'./${id}.json'`)) {
              idx = idx.replace(/(import vanessa from '\.\/vanessa\.json';)/, `$1\nimport ${varName} from './${id}.json';`);
              idx = idx.replace(/(\n\};\s*)$/, `\n  '${id}': load(${varName}),$1`);
              writeFileSync(idxPath, idx);
            }
            const rosPath = join(root, 'src/data/roster.ts');
            let ros = readFileSync(rosPath, 'utf-8');
            if (!new RegExp(`id: '${id}'`).test(ros)) {
              ros = ros.replace(/(\n\];)/, `\n  { id: '${id}', name: '${disp}', playable: true },$1`);
              writeFileSync(rosPath, ros);
            }
            // rescan optional assets (projectiles/vfx) → assetManifest.json so the
            // loader requests the new projectile art
            if (wroteProjectiles) { try { execFileSync('node', [join(root, 'tools/gen-asset-manifest.mjs')], { stdio: 'ignore' }); } catch { /* non-fatal */ } }
            sendJson(res, 200, { ok: true, id, wrote: ['sheet.png', 'meta.json', `${id}.json`, 'portrait', 'roster', 'index'] });
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
