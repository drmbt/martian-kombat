// THE sheet packer — key raw frames, scale into cell space, optionally
// floor-normalize, apply editor overlays, tile into sheet.png and write
// meta.json (v2). Extracted from tools/pack-sheet.mjs so the CLI
// (`npm run gen:pack`), the vite dev middleware (/__editor/pack), and the
// Character Creator SHIP path all run the SAME pack — no second convention.
//
// Editor overlay contract (how Sprite-Editor edits survive a re-pack):
//   assets/raw/edits/<char>/cells/<cellName>.png  — an edited, ALREADY keyed
//     cell in final cell space; replaces the keyed raw frame at pack time.
//   assets/raw/edits/<char>/skeletons.json        — { cell: { joint: [x,y,c] } }
//     merged over the QA-report keypoints at pack time (editor joint drags).
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync, readFileSync, existsSync, rmSync, copyFileSync } from 'node:fs';
import { CELL_W, CELL_H, FLOOR_FRAC, HEADROOM } from './coords.mjs';
import { chromaKey, SCALE_PAD } from './keying.mjs';

const KEY = chromaKey();

function ff(args) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
}

/**
 * Pack one character's raw frames into public/assets/sprites/<id>/.
 *
 * @param {string} charId
 * @param {object} opts
 * @param {string} opts.root       repo root (absolute)
 * @param {object} opts.spec       frames-manifest CHARACTERS[charId] entry
 * @param {{cols:number, rows:number}} opts.grid
 * @param {number} opts.expected   expected frame count (buildJobs length)
 * @param {'ffmpeg'|'corridor'} [opts.keyer]
 * @param {boolean} [opts.normalize]  floor-normalize (feet → FLOOR_FRAC line)
 * @param {boolean} [opts.inferSkeletons]  fresh RTMPose inference on the exact
 *   packed cells (post-normalize) instead of the QA-report bake — always
 *   registered with the shipped art; needs a rtmlib-capable `python`
 * @param {string}  [opts.python]     interpreter for normalize/inference (resolve-python)
 * @param {(msg:string)=>void} [opts.log]
 * @returns {{frames:number, sheet:string, meta:object}}
 */
export function packCharacter(charId, opts) {
  const { root, spec, grid, expected, keyer = 'ffmpeg', normalize = false, python, log = console.log } = opts;
  const inDir = join(root, 'assets/raw/frames', charId);
  const outDir = join(root, 'public/assets/sprites', charId);
  const editsDir = join(root, 'assets/raw/edits', charId);
  const tmp = join(inDir, 'keyed');
  mkdirSync(tmp, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  const { cols: COLS, rows: ROWS } = grid;
  const frames = readdirSync(inDir)
    .filter((f) => /^\d\d-.*\.png$/.test(f))
    .sort();
  if (expected != null && frames.length !== expected) {
    log(`[${charId}] expected ${expected} frames, found ${frames.length}`);
  }

  // corridor mode: frames are already straight-alpha, so only scale/pad. A
  // missing keyed frame is an incomplete gen:key run — fail rather than
  // silently mixing halo'd chromakey cells into a release bake.
  const keyedDir = join(root, 'assets/raw/keyed', charId);
  if (keyer === 'corridor') {
    const missing = frames.filter((f) => !existsSync(join(keyedDir, f)));
    if (missing.length) {
      throw new Error(
        `[${charId}] ${missing.length} frames not keyed (${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''}) — run: npm run gen:key -- --char ${charId}`,
      );
    }
  }

  // Creator-written frame dirs carry a `.cellspace` marker: their frames are
  // ALREADY keyed + in final cell space (the creator bakes per-cell transforms
  // client-side), so keying/scale-padding them again would shrink and shift
  // them — copy straight through instead.
  const prekeyed = existsSync(join(inDir, '.cellspace'));

  const cellName = (f) => f.replace(/^\d\d-/, '').replace(/\.png$/, '');
  frames.forEach((f, i) => {
    const out = join(tmp, `cell-${String(i).padStart(2, '0')}.png`);
    if (prekeyed) {
      copyFileSync(join(inDir, f), out);
      return;
    }
    ff([
      '-i', join(keyer === 'corridor' ? keyedDir : inDir, f),
      '-vf', keyer === 'corridor' ? SCALE_PAD : `${KEY},${SCALE_PAD}`,
      '-frames:v', '1',
      out,
    ]);
  });

  // opt-in floor normalization on the keyed cells, before tiling
  if (normalize) {
    const names = frames.map(cellName);
    execFileSync(python ?? 'python3', [
      join(root, 'tools/qa/normalize_floor.py'),
      '--dir', tmp,
      '--frames', names.join(','),
    ], { stdio: 'inherit' });
  }

  // Sprite-Editor pixel-edit overlays win over the (keyed, normalized) raw
  // frame — applied AFTER normalize because overlays are captured in FINAL
  // cell space (what the editor showed); shifting them again would
  // misregister them. This is what makes editor edits survive a re-pack.
  frames.forEach((f, i) => {
    const overlay = join(editsDir, 'cells', `${cellName(f)}.png`);
    if (existsSync(overlay)) copyFileSync(overlay, join(tmp, `cell-${String(i).padStart(2, '0')}.png`));
  });

  // pad the grid with blank cells so tile always gets COLS*ROWS inputs
  for (let i = frames.length; i < COLS * ROWS; i++) {
    ff(['-f', 'lavfi', '-i', `color=black@0.0:s=${CELL_W}x${CELL_H},format=rgba`, '-frames:v', '1', join(tmp, `cell-${String(i).padStart(2, '0')}.png`)]);
  }

  ff([
    '-framerate', '1',
    '-i', join(tmp, 'cell-%02d.png'),
    '-filter_complex', `tile=${COLS}x${ROWS}`,
    '-frames:v', '1',
    join(outDir, 'sheet.png'),
  ]);

  // meta v2: records the convention the sheet was packed under, so tools can
  // detect v1 (pre-Sprint-27) sheets that still need the floor migration.
  const meta = {
    version: 2,
    cellW: CELL_W,
    cellH: CELL_H,
    cols: COLS,
    rows: ROWS,
    floorFrac: FLOOR_FRAC,
    headroom: HEADROOM,
    normalized: !!normalize,
    frames: frames.map(cellName),
  };

  const skeletons = {};
  if (opts.inferSkeletons) {
    // Fresh RTMPose inference on the EXACT packed cells (post-key, post-
    // normalize, post-overlay) — registered with the shipped art by
    // construction. This is the Sprint 27 migration path; slower than the
    // report bake below but always correct.
    const out = execFileSync(python ?? 'python3', [
      join(root, 'tools/qa/infer_keypoints.py'), '--dir', tmp,
    ], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
    const byFile = JSON.parse(out); // keyed by cell-NN
    for (const [file, kp] of Object.entries(byFile)) {
      const m = /^cell-(\d+)$/.exec(file);
      if (!m) continue;
      const name = meta.frames[Number(m[1])];
      if (name && kp && Object.keys(kp).length) skeletons[name] = kp;
    }
  } else {
    // Bake the RTMPose keypoints tools/qa/pose_qa.py already measured
    // (assets/raw/qa/<char>/report.json, cells.<name>.kp) into meta.json as a
    // 2D skeleton overlay source — see src/scenes/FightScene.ts drawSkeleton().
    const qaReportPath = join(root, 'assets/raw/qa', charId, 'report.json');
    if (existsSync(qaReportPath)) {
      const report = JSON.parse(readFileSync(qaReportPath, 'utf-8'));
      if (report.cells) {
        const dyPath = join(tmp, 'dy.json');
        const dy = existsSync(dyPath) ? JSON.parse(readFileSync(dyPath, 'utf-8')).dy : 0;
        for (const name of meta.frames) {
          const kp = report.cells[name]?.kp;
          if (!kp) continue;
          skeletons[name] = Object.fromEntries(
            Object.entries(kp).map(([joint, [x, y, conf]]) => [joint, [x, y + dy, conf]]),
          );
        }
      }
    }
  }
  // Editor joint drags (assets/raw/edits/<char>/skeletons.json) merge on top.
  const editedSkelPath = join(editsDir, 'skeletons.json');
  if (existsSync(editedSkelPath)) {
    const edited = JSON.parse(readFileSync(editedSkelPath, 'utf-8'));
    for (const [name, joints] of Object.entries(edited)) {
      if (meta.frames.includes(name)) skeletons[name] = joints;
    }
  }
  if (Object.keys(skeletons).length) meta.skeletons = skeletons;

  writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));

  // per-move projectile art. Prekeyed (creator/editor-managed) dirs skip this:
  // their projectile raws are cell-space with big transparent padding, and a
  // forced scale=96:96 would aspect-distort them — the shipped 96×96
  // content-cropped art is managed by the creator/projectile editor instead.
  for (const [pid, projSpec] of Object.entries(prekeyed ? {} : (spec?.extra?.projectiles ?? {}))) {
    const proj = join(inDir, `projectile-${pid}.png`);
    if (!existsSync(proj)) continue;
    const projKey = projSpec.key ?? '0x00B140';
    // CorridorKey only keys chroma green — custom-key projectiles (magenta
    // etc.) stay on ffmpeg even in corridor mode
    const keyedProj = join(keyedDir, `projectile-${pid}.png`);
    if (keyer === 'corridor' && projKey === '0x00B140' && existsSync(keyedProj)) {
      ff(['-i', keyedProj, '-vf', 'scale=96:96', '-frames:v', '1', join(outDir, `projectile-${pid}.png`)]);
    } else {
      ff(['-i', proj, '-vf', `chromakey=${projKey}:0.15:0.06,scale=96:96`, '-frames:v', '1', join(outDir, `projectile-${pid}.png`)]);
    }
  }

  rmSync(tmp, { recursive: true });
  log(`[${charId}] packed ${frames.length} frames -> ${join(outDir, 'sheet.png')}`);
  return { frames: frames.length, sheet: join(outDir, 'sheet.png'), meta };
}
