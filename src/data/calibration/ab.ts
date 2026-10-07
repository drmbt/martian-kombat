// P13.5 — in-game A/B of the calibration proposals (DEV ONLY: loaded by a
// dynamic import inside main.ts's import.meta.env.DEV branch, so the shipped
// bundle never contains it or the variant JSON).
//
// A = the shipped roster (original data, current feel).
// B = the calibrated variants in src/data/calibration/d8/ (D8 feel baked in).
// F6 in a fight flips A ⇄ B and restarts the match. The choice persists per
// browser. Online matches ignore it (mismatched data would fail the compat
// hash between peers).
import type { CharacterDef } from '../../engine';
import { characters } from '../characters';
import { applyScale } from '../characterScale';

export type ABMode = 'A' | 'B';

const files = import.meta.glob<CharacterDef>('./d8/*.json', { eager: true, import: 'default' });
const variants = new Map<string, CharacterDef>();
for (const [path, def] of Object.entries(files)) {
  const id = path.split('/').pop()!.replace(/\.json$/, '');
  if (id !== 'report' && characters[id]) variants.set(id, def);
}
const originals = new Map<string, CharacterDef>();
const KEY = 'mk.ab';

let mode: ABMode = 'A';

function apply(next: ABMode): void {
  for (const [id, raw] of variants) {
    if (!originals.has(id)) originals.set(id, characters[id]);
    characters[id] = next === 'B' ? applyScale(JSON.parse(JSON.stringify(raw)) as CharacterDef) : originals.get(id)!;
  }
  mode = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage blocked: the toggle still works for this session */
  }
}

export interface ABApi {
  mode: () => ABMode;
  toggle: () => ABMode;
  label: () => string;
  count: number;
}

export function installAB(): ABApi {
  let saved: ABMode = 'A';
  try {
    saved = localStorage.getItem(KEY) === 'B' ? 'B' : 'A';
  } catch {
    /* default A */
  }
  if (saved === 'B') apply('B');
  const api: ABApi = {
    mode: () => mode,
    toggle: () => {
      apply(mode === 'A' ? 'B' : 'A');
      return mode;
    },
    label: () => (mode === 'A' ? 'A · ORIGINAL' : 'B · CALIBRATED (D8 feel)'),
    count: variants.size,
  };
  (window as unknown as { __mkAB?: ABApi }).__mkAB = api;
  return api;
}
