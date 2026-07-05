// SPEC V21 — the handshake must let compatible peers reach the shared select
// (onReady), exchange picks, and start on ONE host-authoritative config — and
// refuse incompatible peers with a shown reason (never silently start a match
// that will desync). Char + stage picking lives in the reused SelectScene now,
// so the controller drives: verify → ready → picks → host-confirmed start.
import { describe, expect, it } from 'vitest';
import { characters } from '../data/characters';
import { createLoopbackPair } from './transport';
import { charDataHash, LobbyController, type StartConfig } from './lobby';
import { PROTO, type NetMsg, type Transport } from './transport';

interface Captured {
  ctrl: LobbyController;
  phases: [string, string?][];
  ready: { remoteName: string; render3d: boolean } | null;
  remoteLock: { name: string; charId: string } | null;
  bothLocked: boolean;
  start: StartConfig | null;
  adoptedRender3d: boolean | null;
}

function mount(transport: Transport, isHost: boolean, name: string, extra: Record<string, unknown> = {}): Captured {
  const cap: Captured = {
    ctrl: null as never,
    phases: [],
    ready: null,
    remoteLock: null,
    bothLocked: false,
    start: null,
    adoptedRender3d: null,
  };
  cap.ctrl = new LobbyController(
    {
      onPhase: (p, d) => cap.phases.push([p, d]),
      onReady: (i) => (cap.ready = i),
      onRemoteLock: (r) => (cap.remoteLock = r),
      onBothLocked: () => (cap.bothLocked = true),
      onStart: (c) => (cap.start = c),
      onRenderMode: (r) => (cap.adoptedRender3d = r),
    },
    { transport, isHost, defs: characters, localName: name, ...extra },
  );
  return cap;
}

describe('charDataHash', () => {
  it('is stable and sees any data drift', () => {
    expect(charDataHash(characters)).toBe(charDataHash(characters));
    const patched = structuredClone(characters);
    patched.vincent.health += 1;
    expect(charDataHash(patched)).not.toBe(charDataHash(characters));
  });
});

describe('LobbyController handshake', () => {
  it('verifies then reaches the shared select on both sides', () => {
    const wire = createLoopbackPair({ latency: 1 });
    const host = mount(wire.a, true, 'Flo', { render3d: true });
    const guest = mount(wire.b, false, 'Yulia');
    wire.run(3); // mode + hellos cross

    expect(host.ready).toEqual({ remoteName: 'Yulia', render3d: true });
    expect(guest.ready).toEqual({ remoteName: 'Flo', render3d: true });
    expect(guest.adoptedRender3d).toBe(true); // guest auto-adopted host's 3D
  });

  it('exchanges picks, both vote the same stage, and starts on it', () => {
    const wire = createLoopbackPair({ latency: 1 });
    const host = mount(wire.a, true, 'Flo', { delay: 3, render3d: true });
    const guest = mount(wire.b, false, 'Yulia');
    wire.run(3);

    host.ctrl.lockChar('vincent');
    guest.ctrl.lockChar('yulia');
    wire.run(3); // picks cross
    expect(host.bothLocked).toBe(true);
    expect(guest.bothLocked).toBe(true);
    expect(host.remoteLock).toEqual({ name: 'Yulia', charId: 'yulia' });
    expect(guest.remoteLock).toEqual({ name: 'Flo', charId: 'vincent' });
    expect(host.start).toBeNull(); // nothing starts until both vote the stage

    host.ctrl.pickStage('van');
    wire.run(2);
    expect(host.start).toBeNull(); // still waiting on the guest's vote
    guest.ctrl.pickStage('van');
    wire.run(3);
    expect(host.start).toEqual(guest.start);
    expect(host.start).toEqual({
      rules: expect.any(Object),
      stage: 'van',
      chars: ['vincent', 'yulia'], // [host slot 0, guest slot 1]
      delay: 3,
      render3d: true,
    });
  });

  it('on a stage disagreement the winner is one of the two votes', () => {
    for (let trial = 0; trial < 12; trial++) {
      const wire = createLoopbackPair({ latency: 1 });
      const host = mount(wire.a, true, 'Host');
      const guest = mount(wire.b, false, 'Guest');
      wire.run(3);
      host.ctrl.lockChar('vincent');
      guest.ctrl.lockChar('yulia');
      wire.run(3);
      host.ctrl.pickStage('van'); // host votes van
      guest.ctrl.pickStage('chiba-roof'); // guest votes chiba-roof
      wire.run(3);
      // both peers launch on the SAME resolved stage, and it's one of the votes
      expect(host.start?.stage).toBe(guest.start?.stage);
      expect(['van', 'chiba-roof']).toContain(host.start?.stage);
    }
  });

  it('only the host reconciles — a lone guest vote never starts', () => {
    const wire = createLoopbackPair({ latency: 1 });
    const host = mount(wire.a, true, 'Host');
    const guest = mount(wire.b, false, 'Guest');
    wire.run(3);
    host.ctrl.lockChar('kirby');
    guest.ctrl.lockChar('gene');
    wire.run(3);
    guest.ctrl.pickStage('van'); // only the guest voted
    wire.run(3);
    expect(host.start).toBeNull();
    expect(guest.start).toBeNull();
  });

  it('refuses a protocol mismatch with a reason, never readies', () => {
    const wire = createLoopbackPair({ latency: 1 });
    const guest = mount(wire.b, false, 'Guest');
    wire.a.onStatus(() => undefined);
    const badHello: NetMsg = { t: 'hello', proto: PROTO + 99, charHash: charDataHash(characters), name: 'Old' };
    wire.run(1);
    wire.a.send(badHello);
    wire.run(2);
    expect(guest.ready).toBeNull();
    expect(guest.phases.some(([p, d]) => p === 'error' && /version mismatch/.test(d ?? ''))).toBe(true);
  });

  it('refuses a character-data mismatch with a reason', () => {
    const wire = createLoopbackPair({ latency: 1 });
    const guest = mount(wire.b, false, 'Guest');
    wire.a.onStatus(() => undefined);
    const badHello: NetMsg = { t: 'hello', proto: PROTO, charHash: 0xdeadbeef, name: 'Modded' };
    wire.run(1);
    wire.a.send(badHello);
    wire.run(2);
    expect(guest.ready).toBeNull();
    expect(guest.phases.some(([p, d]) => p === 'error' && /character data/.test(d ?? ''))).toBe(true);
  });

  it('a peer bye during the lobby surfaces as an error', () => {
    const wire = createLoopbackPair({ latency: 1 });
    const guest = mount(wire.b, false, 'Guest');
    wire.a.onStatus(() => undefined);
    wire.run(1);
    wire.a.send({ t: 'bye', reason: 'host bailed' });
    wire.run(2);
    expect(guest.phases.some(([p, d]) => p === 'error' && d === 'host bailed')).toBe(true);
  });
});
