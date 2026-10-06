import { describe, it, expect } from 'vitest';
import { initialState, step, type InputFrame } from '../engine';
import { characters } from '../data/characters';
import { CpuDriver } from './bot';

// The sprite editor / move tuner loops a chosen move in place; that only works
// if the CpuDriver's motion sequences actually satisfy the engine's matcher for
// EVERY motion type — including dp (Rising Glyph), du (charge), and 360, which
// are easy to get wrong (a dp's ↓→ tail can accidentally fire a qcf special;
// a charge motion loses its bank on the release tick). Guards regressions in
// enqueueMotion.
const QUEUEABLE = new Set(['qcf', 'qcb', 'bf', 'hcb', 'hcf', 'dp', 'du', '360']);
const NEUTRAL: [InputFrame, InputFrame] = [{}, {}] as unknown as [InputFrame, InputFrame];

describe('loop driver fires every roster motion special', () => {
  for (const id of Object.keys(characters)) {
    const specials = Object.entries(characters[id].moves).filter(
      ([, m]) => m.input?.motion && QUEUEABLE.has(m.input.motion) && (m.input.button === 'punch' || m.input.button === 'kick'),
    );
    for (const [moveId, m] of specials) {
      it(`${id}: ${moveId} (${m.input!.motion})`, () => {
        let s = initialState(id, id, characters, { roundTicks: 0, winsNeeded: 1 });
        for (let i = 0; i < 200 && s.phase !== 'fight'; i++) s = step(s, NEUTRAL, characters);
        const bot = new CpuDriver(0, 1, false);
        bot.setLoop(moveId, 24, false); // loop in place, attack off
        let fired = false;
        for (let i = 0; i < 300; i++) {
          const p0 = bot.poll(s);
          s = step(s, [p0, {}] as unknown as [InputFrame, InputFrame], characters);
          if (s.fighters[0].action.moveId === moveId) {
            fired = true;
            break;
          }
        }
        expect(fired).toBe(true);
      });
    }
  }
});

// the secret unlockable is pickable in VS CPU on either side: a ported MUGEN
// kit (4 buttons, no heavies) must still be driven sanely by the CPU
describe('CPU plays the secret fighters', () => {
  it('kfm vs yulia, CPU on both sides: no crash, both land hits', () => {
    let s = initialState('kfm', 'yulia', characters, { roundTicks: 0, winsNeeded: 3 });
    const bots = [new CpuDriver(0), new CpuDriver(1)];
    const hp = [s.fighters[0].health, s.fighters[1].health];
    const low = [...hp]; // lowest seen — health refills between rounds
    for (let i = 0; i < 3600 && s.phase !== 'matchEnd'; i++) {
      s = step(s, [bots[0].poll(s), bots[1].poll(s)], characters);
      for (const k of [0, 1]) low[k] = Math.min(low[k], s.fighters[k].health);
    }
    expect(low[0]).toBeLessThan(hp[0]);
    expect(low[1]).toBeLessThan(hp[1]);
  });
});
