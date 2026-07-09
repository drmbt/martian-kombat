// Generate every sprite-sheet keyframe for a character from its canonical
// sheet, using the locked style (tools/style.md). Idempotent; --force regens.
//
//   node tools/gen-frames.mjs --char vincent [--force]
//   node tools/gen-frames.mjs --all

import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { ROOT, loadEnv, geminiImage, saveAsset, skip, pool, concurrencyArg } from './lib.mjs';
import { CHARACTERS, buildJobs } from './frames-manifest.mjs';

const env = loadEnv();
const force = process.argv.includes('--force');
// Cells are independent API calls, so we fan them out. v2 sheets have no
// inter-cell dependency; legacy sheets need the low-pose anchor generated
// first (handled below), so the pool only ever covers already-safe cells.
const CONCURRENCY = concurrencyArg(6);
// Targeted QA re-rolls: `--cells lk-startup,27-hk-active,...` regenerates ONLY
// those cells (accepts the bare cell id or the `NN-id` filename stem, with or
// without `.png`) and force-overwrites them, leaving every other cell untouched.
const CELLS = (() => {
  const i = process.argv.indexOf('--cells');
  if (i < 0) return null;
  return new Set(
    process.argv[i + 1].split(',').map((s) => s.trim().replace(/\.png$/, '').replace(/^\d\d-/, '')),
  );
})();
// pro, not flash: flash drifts the background color toward the character's
// palette (Vincent's all-black kit came back on navy) and fumbles non-standing
// poses; pro respected both in the style tests
const MODEL = 'gemini-3-pro-image';

// prompt craft now lives in tools/core/prompts.mjs (shared with the Character
// Creator, so a lesson learned in either front door improves both)
import { STYLE_ART as STYLE_BASE, FRAME_RULES } from './core/prompts.mjs';

async function genChar(charId) {
  const spec = CHARACTERS[charId];
  if (!spec) throw new Error(`unknown character ${charId}`);
  const canonical = join(ROOT, spec.canonical);
  if (!existsSync(canonical)) throw new Error(`missing canonical sheet ${canonical}`);
  const outDir = join(ROOT, 'assets/raw/frames', charId);

  // manifest order (legacy 23-cell or v2 six-button layout)
  const jobs = buildJobs(spec);

  // Low-pose height anchor: the model copies the standing canonical's height
  // for crouch cells no matter what the text says. Passing an existing LOW
  // frame of the same character as a second reference fixes it. (Fresh
  // characters: run the script twice — the sweep/chk cell generates on pass
  // one and anchors the crouch family on pass two.)
  const lowAnchorName = jobs
    .map((j, i) => ({ ...j, i }))
    .find((j) => /(^|-)(chk|sweep)-active$/.test(j.id));
  const lowRefPath = lowAnchorName
    ? join(outDir, `${String(lowAnchorName.i).padStart(2, '0')}-${lowAnchorName.id}.png`)
    : null;
  const LOW_ANCHOR = ` CRITICAL: copy the BODY HEIGHT of the SECOND reference image (the low pose) — the top of the head at that same low height, empty green above.`;
  // 'down' (the KO lying pose) needs the height anchor MOST — unanchored, the
  // model stands the character back up (seen on rj 2026-07-08)
  const isLowCell = (id) => id === 'crouch' || id === 'block-crouch' || id === 'down' || /^c[lmh][pk]-/.test(id);

  // extraRefs: additional reference images (prior special phases, projectile
  // art, per-move inspo) appended after the canonical — the model keeps them
  // consistent with the pose it's drawing.
  const genCell = async (i, extraRefs = []) => {
    const { id, pose } = jobs[i];
    if (CELLS && !CELLS.has(id)) return; // targeted re-roll: only the named cells
    const out = join(outDir, `${String(i).padStart(2, '0')}-${id}.png`);
    if (skip(out, force || CELLS !== null)) return; // named cells always regen
    const useAnchor = isLowCell(id) && lowRefPath && existsSync(lowRefPath);
    // per-character invariant (e.g. Catherine's bo staff in EVERY frame)
    const always = spec.always ? ` ${spec.always}` : '';
    const prompt = `${STYLE_BASE}\n${FRAME_RULES}${always}\nPose: ${pose}.${useAnchor ? LOW_ANCHOR : ''}`;
    const refs = [canonical, ...extraRefs.filter((p) => p && existsSync(p))];
    if (useAnchor) refs.push(lowRefPath);
    const tag = `${extraRefs.length ? ` (+${extraRefs.length} ref)` : ''}${useAnchor ? ' (low-anchored)' : ''}`;
    console.log(`[${charId}] ${i + 1}/${jobs.length} ${id}${tag} ...`);
    try {
      const buf = await geminiImage({
        apiKey: env.GEMINI_API_KEY,
        model: MODEL,
        prompt,
        referencePaths: refs,
        aspectRatio: '3:4',
      });
      saveAsset(out, buf, prompt);
    } catch (e) {
      console.error(`  FAILED ${id}: ${e.message}`);
    }
  };

  // The low anchor (legacy sheets) must exist before the crouch family runs.
  const anchorIdx = lowAnchorName?.i ?? -1;
  if (anchorIdx >= 0) await genCell(anchorIdx);

  // Named specials (v2) get sequential, cross-referenced generation; every
  // other cell stays concurrent. phaseRe matches "<special-id>-startup|active|
  // recovery" so those are pulled OUT of the concurrent batch.
  const specialIds = spec.moves6?.specials ? Object.keys(spec.moves6.specials) : [];
  const esc = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const phaseRe = specialIds.length
    ? new RegExp(`^(${specialIds.map(esc).join('|')})-(startup|active|recovery)$`)
    : null;
  const isPhase = (id) => (phaseRe ? phaseRe.test(id) : false);

  // shared cells + normals: concurrent, no cross-refs.
  const normalIdxs = jobs
    .map((_, i) => i)
    .filter((i) => i !== anchorIdx && !isPhase(jobs[i].id));
  await pool(normalIdxs, CONCURRENCY, (i) => genCell(i));

  // Specials: for a PROJECTILE move the projectile art is generated FIRST, so
  // the startup/active frames can reference where the shot is going and draw a
  // matching object leaving the hand. Then the three phases run IN ORDER, each
  // one referencing the projectile + every earlier phase of the same special
  // (+ any per-move inspo image). This is what keeps a special's frames — and
  // its projectile — visually coherent (see gene's hallucination drift).
  const projectiles = spec.extra?.projectiles ?? {};
  const specialRefs = spec.extra?.specialRefs ?? {};
  for (const sid of specialIds) {
    const phaseRefs = [];
    if (projectiles[sid] && !CELLS) {
      const projOut = join(outDir, `projectile-${sid}.png`);
      if (!skip(projOut, force)) {
        const proj = projectiles[sid];
        console.log(`[${charId}] projectile ${sid} (first) ...`);
        try {
          // NO canonical reference: an isolated-object projectile (a ball, a
          // head) must not drag the whole character in — the prompt already
          // carries the style. Consistency comes from explicit inspo refPaths.
          const buf = await geminiImage({
            apiKey: env.GEMINI_API_KEY,
            model: MODEL,
            prompt: proj.prompt,
            referencePaths: (proj.refPaths ?? []).map((p) => join(ROOT, p)),
            aspectRatio: '1:1',
          });
          saveAsset(projOut, buf, proj.prompt);
        } catch (e) {
          console.error(`  FAILED projectile ${sid}: ${e.message}`);
        }
      }
      if (existsSync(projOut)) phaseRefs.push(projOut);
    }
    const inspo = (specialRefs[sid] ?? []).map((p) => join(ROOT, p)).filter((p) => existsSync(p));
    for (const phase of ['startup', 'active', 'recovery']) {
      const idx = jobs.findIndex((j) => j.id === `${sid}-${phase}`);
      if (idx < 0) continue;
      await genCell(idx, [...inspo, ...phaseRefs]);
      const outP = join(outDir, `${String(idx).padStart(2, '0')}-${sid}-${phase}.png`);
      if (existsSync(outP)) phaseRefs.push(outP); // next phase sees this one
    }
  }

  // Projectiles NOT tied to a named special (legacy / edge case): concurrent.
  const leftover = CELLS ? [] : Object.entries(projectiles).filter(([pid]) => !specialIds.includes(pid));
  await pool(leftover, CONCURRENCY, async ([pid, proj]) => {
    const out = join(outDir, `projectile-${pid}.png`);
    if (skip(out, force)) return;
    console.log(`[${charId}] projectile ${pid} ...`);
    try {
      const buf = await geminiImage({
        apiKey: env.GEMINI_API_KEY,
        model: MODEL,
        prompt: proj.prompt,
        referencePaths: (proj.refPaths ?? []).map((p) => join(ROOT, p)),
        aspectRatio: '1:1',
      });
      saveAsset(out, buf, proj.prompt);
    } catch (e) {
      console.error(`  FAILED projectile ${pid}: ${e.message}`);
    }
  });
}

const chars = process.argv.includes('--all')
  ? Object.keys(CHARACTERS)
  : [process.argv[process.argv.indexOf('--char') + 1]];
for (const c of chars) await genChar(c);
console.log('done.');
