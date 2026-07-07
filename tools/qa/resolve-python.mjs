// Pick a Python interpreter that actually has the QA deps installed. The bare
// `python3` on PATH is often a too-new build (e.g. Homebrew 3.14) that has no
// rtmlib/onnxruntime wheels, so DWPose fails; meanwhile a working interpreter
// (3.11–3.13) may sit alongside it. This resolves the right one so gen:qa,
// pack --normalize, and the Sprite Editor's skeleton-regen endpoint all use it.
//
// Override with MK_PYTHON=/path/to/python. Otherwise the first candidate that
// can import `requireModule` wins.
import { execFileSync } from 'node:child_process';

const CANDIDATES = ['python3.13', 'python3.12', 'python3.11', 'python3.10', 'python3'];

/** Return an interpreter that can import `requireModule` (default 'rtmlib').
 *  Uses find_spec (fast — no heavy import) so probing is cheap. Throws with
 *  install guidance if none qualifies. */
export function resolvePython(requireModule = 'rtmlib') {
  const cands = process.env.MK_PYTHON ? [process.env.MK_PYTHON, ...CANDIDATES] : CANDIDATES;
  const tried = [];
  for (const py of cands) {
    try {
      execFileSync(py, ['-c', `import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('${requireModule}') else 1)`], {
        stdio: 'ignore',
      });
      return py;
    } catch {
      tried.push(py);
    }
  }
  throw new Error(
    `no python with '${requireModule}' found (tried: ${tried.join(', ')}). ` +
      `Set MK_PYTHON=/path/to/python, or install: <python> -m pip install -r tools/qa/requirements.txt`,
  );
}
