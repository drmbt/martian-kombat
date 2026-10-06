// AIR (animation) parser. An action is an ordered element list; each element
// is one sprite shown for `time` ticks, optionally carrying Clsn1 (ATTACK)
// and Clsn2 (HURT) boxes. This per-element box authoring is MUGEN's core
// hitbox standard — see docs/FIGHTING_STANDARDS.md §4 for how it maps onto
// our per-move hitbox + stand/crouch hurtboxes.
//
// Box rules (MUGEN 1.0/1.1 + IKEMEN): `ClsnNDefault: k` applies to every
// following element of the action that does not declare its own `ClsnN: k`;
// a plain `ClsnN: k` applies to the NEXT element only. Coordinates are
// x1,y1,x2,y2 relative to the sprite axis (feet), +x forward, -y up.
import { parseIni } from './ini';

export interface Clsn {
  l: number;
  t: number;
  r: number;
  b: number;
}

export interface AirElement {
  group: number;
  image: number;
  x: number;
  y: number;
  /** ticks shown; -1 = hold forever */
  time: number;
  flipH: boolean;
  flipV: boolean;
  clsn1: Clsn[];
  clsn2: Clsn[];
}

export interface AirAction {
  id: number;
  elements: AirElement[];
  /** element index the loop returns to (0 when no LoopStart) */
  loopStart: number;
}

const CLSN_HEAD = /^clsn([12])(default)?\s*:\s*(\d+)/i;
const CLSN_BOX = /^clsn([12])\s*\[\s*\d+\s*\]\s*=\s*(.+)$/i;

function box(v: string): Clsn | null {
  const p = v.split(',').map((s) => Number(s.trim()));
  if (p.length < 4 || p.some((n) => Number.isNaN(n))) return null;
  const [x1, y1, x2, y2] = p;
  return { l: Math.min(x1, x2), t: Math.min(y1, y2), r: Math.max(x1, x2), b: Math.max(y1, y2) };
}

export function parseAir(text: string): Map<number, AirAction> {
  const actions = new Map<number, AirAction>();
  for (const sec of parseIni(text)) {
    const m = /^begin\s+action\s+(-?\d+)/i.exec(sec.name);
    if (!m) continue;
    const act: AirAction = { id: Number(m[1]), elements: [], loopStart: 0 };
    const defaults: [Clsn[] | null, Clsn[] | null] = [null, null];
    const pending: [Clsn[] | null, Clsn[] | null] = [null, null];
    // which list the following ClsnN[i] lines append to
    let target: { which: 0 | 1; isDefault: boolean } | null = null;
    for (const line of sec.lines) {
      const head = CLSN_HEAD.exec(line);
      if (head) {
        const which = (Number(head[1]) - 1) as 0 | 1;
        const isDefault = !!head[2];
        if (isDefault) defaults[which] = [];
        else pending[which] = [];
        target = { which, isDefault };
        continue;
      }
      const bx = CLSN_BOX.exec(line);
      if (bx) {
        const which = (Number(bx[1]) - 1) as 0 | 1;
        const b = box(bx[2]);
        if (!b) continue;
        const list = target && target.which === which
          ? (target.isDefault ? defaults[which] : pending[which])
          : pending[which] ?? (pending[which] = []);
        list?.push(b);
        continue;
      }
      if (/^loopstart/i.test(line)) {
        act.loopStart = act.elements.length;
        continue;
      }
      // element line: group, image, x, y, time[, flip[, trans...]]
      const parts = line.split(',').map((s) => s.trim());
      if (parts.length < 5) continue;
      const [g, i, x, y, t] = parts.slice(0, 5).map(Number);
      if ([g, i, x, y, t].some((n) => Number.isNaN(n))) continue;
      const flip = (parts[5] ?? '').toUpperCase();
      act.elements.push({
        group: g,
        image: i,
        x,
        y,
        time: t,
        flipH: flip.includes('H'),
        flipV: flip.includes('V'),
        clsn1: pending[0] ?? defaults[0] ?? [],
        clsn2: pending[1] ?? defaults[1] ?? [],
      });
      pending[0] = null;
      pending[1] = null;
      target = null;
    }
    actions.set(act.id, act);
  }
  return actions;
}

/** Tick at which element `index` (0-based) starts. */
export function elemStart(act: AirAction, index: number): number {
  let t = 0;
  for (let i = 0; i < index && i < act.elements.length; i++) t += Math.max(0, act.elements[i].time);
  return t;
}

/** Total ticks of one pass through the action (-1 elements count as 0). */
export function actionLength(act: AirAction): number {
  return act.elements.reduce((s, e) => s + Math.max(0, e.time), 0);
}

/** Bounding box of a box list (null when empty). */
export function unionClsn(boxes: Clsn[]): Clsn | null {
  if (!boxes.length) return null;
  return boxes.reduce((u, b) => ({
    l: Math.min(u.l, b.l),
    t: Math.min(u.t, b.t),
    r: Math.max(u.r, b.r),
    b: Math.max(u.b, b.b),
  }));
}
