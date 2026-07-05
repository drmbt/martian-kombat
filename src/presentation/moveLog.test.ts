// F2 move-log model: raw-input tokens and triggered-move labels, shared by
// both presenters (2D today, 3D via the DOM overlay).
import { describe, expect, it } from 'vitest';
import { characters } from '../data/characters';
import { EMPTY_INPUT, initialState } from '../engine';
import type { GameState, InputFrame } from '../engine';
import { MoveLogModel } from './moveLog';
import { moveLabel, moveListText, notateInput } from './notation';

const inp = (over: Partial<InputFrame>): InputFrame => ({ ...EMPTY_INPUT, ...over });
const pair = (a: Partial<InputFrame>, b: Partial<InputFrame> = {}): [InputFrame, InputFrame] => [inp(a), inp(b)];

const state = (): GameState => initialState('vincent', 'yulia', characters);

describe('MoveLogModel inputs', () => {
  it('tokenizes held directions and fresh button presses', () => {
    const m = new MoveLogModel();
    expect(m.logInputs(pair({ down: true }))).toEqual([true, false]);
    m.logInputs(pair({ down: true, right: true }));
    m.logInputs(pair({ right: true, lp: true }));
    expect(m.inputs[0]).toEqual(['↓', '↘', '→+LP']);
    expect(m.inputLine(0)).toBe('P1 ▸ ↓ ↘ →+LP');
  });

  it('dedupes repeats, ignores held buttons, and caps the ring at 10', () => {
    const m = new MoveLogModel();
    m.logInputs(pair({ down: true }));
    expect(m.logInputs(pair({ down: true }))).toEqual([false, false]); // held: no new token
    m.logInputs(pair({ down: true, lp: true })); // fresh press tokens even while held
    expect(m.inputs[0]).toEqual(['↓', '↓+LP']);
    for (let i = 0; i < 12; i++) {
      m.logInputs(pair({ left: i % 2 === 0 }));
      m.logInputs(pair({ right: i % 2 === 1 }));
    }
    expect(m.inputs[0].length).toBeLessThanOrEqual(10);
  });

  it('tracks both players independently', () => {
    const m = new MoveLogModel();
    m.logInputs(pair({ down: true }, { up: true }));
    expect(m.inputs[0]).toEqual(['↓']);
    expect(m.inputs[1]).toEqual(['↑']);
  });
});

describe('MoveLogModel moves', () => {
  it('labels specials with name, strength, and motion notation', () => {
    const m = new MoveLogModel();
    const s = state();
    s.fighters[0].action = { kind: 'attack', frame: 1, moveId: 'sigil-bolt', strength: 'h' };
    m.logMove(0, s, characters);
    expect(m.moves[0]).toBe('P1  Sigil Bolt (H) · ↓↘→+P');
  });

  it('labels normals with fighting-game shorthand and caps at 8', () => {
    const m = new MoveLogModel();
    const s = state();
    for (const id of ['cmk', 'jhp', 'lp']) {
      s.fighters[1].action = { kind: 'attack', frame: 1, moveId: id };
      m.logMove(1, s, characters);
    }
    expect(m.moves).toEqual(['P2  cr.MK', 'P2  j.HP', 'P2  LP']);
    for (let i = 0; i < 10; i++) m.logMove(1, s, characters);
    expect(m.moves.length).toBe(8);
  });
});

describe('notation helpers', () => {
  it('notates inputs', () => {
    expect(notateInput({ motion: 'qcf', button: 'punch' })).toBe('↓↘→+P');
    expect(notateInput({ motion: 'qcb', button: 'kick' })).toBe('↓↙←+K');
    expect(notateInput({ button: 'LPLK' })).toBe('LP+LK');
  });

  it('labels raw actions', () => {
    expect(moveLabel(characters.vincent, { kind: 'attack', frame: 0, moveId: 'cmk' })).toBe('cr.MK');
    expect(moveLabel(characters.vincent, { kind: 'attack', frame: 0, moveId: 'sigil-bolt' })).toContain('Sigil Bolt');
  });

  it('builds the pause-menu move list with specials and the fatality line', () => {
    const txt = moveListText(characters.vincent);
    expect(txt).toContain('★ Sigil Bolt: ↓↘→+P');
    expect(txt).toContain('☠ Blue Screen: ↓↙←+P');
    expect(txt).toContain('PUNCH');
  });
});
