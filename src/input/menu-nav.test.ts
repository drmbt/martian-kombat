import { describe, expect, it } from 'vitest';
import { MenuNav, PadLike } from './menu-nav';

interface FakePad {
  connected: boolean;
  buttons: { pressed: boolean; value: number }[];
  axes: number[];
}

function makePad(): FakePad {
  return {
    connected: true,
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    axes: [0, 0, 0, 0],
  };
}
const press = (p: FakePad, i: number): void => { p.buttons[i] = { pressed: true, value: 1 }; };
const release = (p: FakePad, i: number): void => { p.buttons[i] = { pressed: false, value: 0 }; };

const nav = (pads: FakePad[]): MenuNav => new MenuNav(() => pads as PadLike[]);

// default standard-mapping indices (see DEFAULT_PAD in settings.ts)
const A = 0, B = 1, X = 2, Y = 3, RB = 5, RT = 7, BACK = 8, START = 9, DDOWN = 13;

describe('MenuNav', () => {
  it('seeds on first poll: a button already held does NOT fire', () => {
    const pad = makePad();
    press(pad, X); // held before the first poll (e.g. through a page load)
    const n = nav([pad]);
    expect(n.poll(0).confirm).toBe(false); // seed frame — no pulse
    expect(n.poll(16).confirm).toBe(false); // still held — no phantom edge
    release(pad, X);
    expect(n.poll(32).confirm).toBe(false);
    press(pad, X);
    expect(n.poll(48).confirm).toBe(true); // a genuine fresh press fires
  });

  it('confirm is a single rising edge, not a repeat while held', () => {
    const pad = makePad();
    const n = nav([pad]);
    n.poll(0); // seed (nothing held)
    press(pad, A);
    expect(n.poll(16).confirm).toBe(true);
    expect(n.poll(32).confirm).toBe(false); // held — buttons never auto-repeat
    expect(n.poll(9999).confirm).toBe(false);
  });

  it('treats every punch AND kick button as confirm', () => {
    for (const btn of [A, B, X, Y, RB, RT]) {
      const pad = makePad();
      const n = nav([pad]);
      n.poll(0);
      press(pad, btn);
      expect(n.poll(16).confirm, `button ${btn}`).toBe(true);
    }
  });

  it('maps Start to start and Back/Select to menu — neither is confirm', () => {
    for (const [btn, signal] of [[START, 'start'], [BACK, 'menu']] as const) {
      const pad = makePad();
      const n = nav([pad]);
      n.poll(0);
      press(pad, btn);
      const p = n.poll(16);
      expect(p[signal], `button ${btn}`).toBe(true);
      expect(p.confirm).toBe(false);
    }
  });

  it('directions auto-repeat while held (unlike buttons)', () => {
    const pad = makePad();
    const n = nav([pad]);
    n.poll(0);
    press(pad, DDOWN);
    expect(n.poll(16).down).toBe(true); // rising edge
    expect(n.poll(20).down).toBe(false); // within the first-repeat delay
    expect(n.poll(500).down).toBe(true); // after ~380ms initial delay -> repeat
  });

  it('reads the left stick as a direction', () => {
    const pad = makePad();
    const n = nav([pad]);
    n.poll(0);
    pad.axes[1] = 1;
    expect(n.poll(16).down).toBe(true);
  });

  it('a press held across a scene transition fires exactly once (shared tracker)', () => {
    // the singleton is polled by whichever scene is active — the press that
    // changed scenes stays "held" and must be released before it fires again
    const pad = makePad();
    const n = nav([pad]);
    n.poll(0);
    press(pad, A);
    expect(n.poll(16).confirm).toBe(true); // scene A consumes the edge
    expect(n.poll(32).confirm).toBe(false); // scene B polls: still held, no edge
    expect(n.poll(48).confirm).toBe(false);
    release(pad, A);
    n.poll(64);
    press(pad, A);
    expect(n.poll(80).confirm).toBe(true); // fresh press in scene B fires
  });

  it('anyHeld reports raw held-state without producing edges', () => {
    const pad = makePad();
    const n = nav([pad]);
    n.poll(0);
    press(pad, A);
    expect(n.poll(16).anyHeld).toBe(true);
    const later = n.poll(32);
    expect(later.anyHeld).toBe(true); // still held
    expect(later.confirm).toBe(false); // but no edge
    release(pad, A);
    expect(n.poll(48).anyHeld).toBe(false);
  });

  it('ignores disconnected pads', () => {
    const pad = makePad();
    pad.connected = false;
    press(pad, A);
    const n = nav([pad]);
    n.poll(0);
    expect(n.poll(16).confirm).toBe(false);
    expect(n.poll(16).anyHeld).toBe(false);
  });
});
