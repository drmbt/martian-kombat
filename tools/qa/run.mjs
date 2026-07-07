// Run a tools/qa Python script through the resolved interpreter (see
// resolve-python.mjs). Used by `npm run gen:qa` so it stops depending on
// whatever bare `python3` happens to be first on PATH.
//   node tools/qa/run.mjs pose_qa.py --char vincent --frames-dir ...
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolvePython } from './resolve-python.mjs';

const [script, ...rest] = process.argv.slice(2);
if (!script) {
  console.error('usage: node tools/qa/run.mjs <script.py> [args...]');
  process.exit(2);
}
const py = resolvePython();
const scriptPath = fileURLToPath(new URL(script, import.meta.url));
const r = spawnSync(py, [scriptPath, ...rest], { stdio: 'inherit' });
process.exit(r.status ?? 1);
