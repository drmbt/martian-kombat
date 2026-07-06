/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
