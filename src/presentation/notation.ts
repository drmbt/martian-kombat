// Fighting-game notation helpers shared by the move log, the pause-menu move
// lists, and any future command-list UI. Pure string building from character
// data — no Phaser, no DOM.
import type { Action, CharacterDef } from '../engine';

export const MOTION_GLYPHS: Record<string, string> = {
  qcf: '↓↘→', qcb: '↓↙←', bf: '←→', dp: '→↓↘', hcb: '→↓←', hcf: '←↓→', '360': '360°',
};

/** "↓↘→+P" from a move's `input` block */
export function notateInput(input: { motion?: string; button: string }): string {
  const btn =
    input.button === 'punch' ? 'P'
    : input.button === 'kick' ? 'K'
    : input.button === 'LPLK' ? 'LP+LK'
    : input.button;
  return `${input.motion ? (MOTION_GLYPHS[input.motion] ?? input.motion) + '+' : ''}${btn}`;
}

/** Move-log label for a triggered move: "Rising Glyph (H) · ↓↘→+P" / "cr.MK" */
export function moveLabel(def: CharacterDef, action: Action): string {
  const id = action.moveId!;
  const mv = def.moves[id];
  if (mv?.input) {
    const str = action.strength ? ` (${action.strength.toUpperCase()})` : '';
    const inp = mv.input.motion ? MOTION_GLYPHS[mv.input.motion] : '';
    const btn =
      mv.input.button === 'punch' ? 'P'
      : mv.input.button === 'kick' ? 'K'
      : mv.input.button === 'LPLK' ? 'LP+LK'
      : mv.input.button;
    return `${mv.name ?? id}${str} · ${inp}${inp ? '+' : ''}${btn}`;
  }
  if (id.startsWith('c')) return `cr.${id.slice(1).toUpperCase()}`;
  if (id.startsWith('j')) return `j.${id.slice(1).toUpperCase()}`;
  return id.toUpperCase();
}

/** Full pause-menu move-list column for one character (specials, fatality,
 *  the 6-button damage/startup grid, and the blocking cheat-sheet). */
export function moveListText(def: CharacterDef): string {
  const m = def.moves;
  const cell = (id: string) => {
    const mv = m[id];
    if (!mv) return '—'.padEnd(14);
    const kd = mv.knockdown ? ' KD' : '';
    return `${mv.damage}dmg ${mv.startup}f${kd}`.padEnd(14);
  };
  const specials = Object.values(m)
    .filter((mv) => mv.input)
    .map((mv) => `★ ${mv.name}: ${notateInput(mv.input!)}`);
  const fatality = def.fatality
    ? [`☠ ${def.fatality.name}: ${notateInput(def.fatality.input)}  (when they hear FINISH THEM!)`]
    : [];
  return [
    def.name,
    ...specials,
    ...fatality,
    '',
    '        PUNCH         KICK',
    ` L      ${cell('lp')}${cell('lk')}`,
    ` M      ${cell('mp')}${cell('mk')}`,
    ` H      ${cell('hp')}${cell('hk')}`,
    '',
    '↓+button   crouching versions',
    '           (↓+kicks hit LOW: crouch-block them)',
    'jump+button air versions',
    '           (overheads: block them STANDING)',
  ].join('\n');
}
