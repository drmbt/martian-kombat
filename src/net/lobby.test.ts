// SPEC V21 — the handshake must let compatible peers start on ONE agreed
// config and refuse incompatible ones with a shown reason (never silently
// start a match that will desync). Driven over the loopback pair.
import { describe, expect, it } from 'vitest';
import { characters } from '../data/characters';
import { createLoopbackPair } from './transport';
import { charDataHash, LobbyController, type StartConfig } from './lobby';
import { PROTO, type NetMsg, type Transport } from './transport';

interface Captured {
  ctrl: LobbyController;
  phases: [string, string?][];
  start: StartConfig | null;
  remote: { name: string; charId: string } | null;
}

function mount(transport: Transport, isHost: boolean, name: string, extra: Record<string, unknown> = {}): Captured {
  const cap: Captured = { ctrl: null as never, phases: [], start: null, remote: null };
  cap.ctrl = new LobbyController(
    {
      onPhase: (p, d) => cap.phases.push([p, d]),
      onStart: (c) => (cap.start = c),
      onRemoteLock: (r) => (cap.remote = r),
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
  it('compatible peers agree on one start config (host authoritative)', () => {
    const wire = createLoopbackPair({ latency: 1 });
    const host = mount(wire.a, true, 'Flo', { stage: 'chiba-roof', delay: 3 });
    const guest = mount(wire.b, false, 'Yulia');
    wire.run(2); // transports open
    host.ctrl.lockChar('vincent');
    guest.ctrl.lockChar('yulia');
    wire.run(4); // hellos + start cross

    expect(host.start).toEqual(guest.start);
    expect(host.start).toEqual({
      rules: expect.any(Object),
      stage: 'chiba-roof',
      chars: ['vincent', 'yulia'], // [host slot 0, guest slot 1]
      delay: 3,
    });
    expect(host.remote).toEqual({ name: 'Yulia', charId: 'yulia' });
    expect(guest.remote).toEqual({ name: 'Flo', charId: 'vincent' });
  });

  it('order independence: a char locked before the channel opens still starts', () => {
    const wire = createLoopbackPair({ latency: 2 });
    const host = mount(wire.a, true, 'Host');
    const guest = mount(wire.b, false, 'Guest');
    host.ctrl.lockChar('kirby'); // locked while still connecting
    guest.ctrl.lockChar('gene');
    wire.run(6);
    expect(host.start?.chars).toEqual(['kirby', 'gene']);
    expect(guest.start?.chars).toEqual(['kirby', 'gene']);
  });

  it('refuses a protocol mismatch with a reason, never starts', () => {
    const wire = createLoopbackPair({ latency: 1 });
    const guest = mount(wire.b, false, 'Guest');
    // a peer on an incompatible proto version
    wire.a.onStatus(() => undefined);
    const badHello: NetMsg = { t: 'hello', proto: PROTO + 99, charHash: charDataHash(characters), charId: 'flo', name: 'Old' };
    guest.ctrl.lockChar('yulia');
    wire.run(1);
    wire.a.send(badHello);
    wire.run(2);
    expect(guest.start).toBeNull();
    expect(guest.phases.some(([p, d]) => p === 'error' && /version mismatch/.test(d ?? ''))).toBe(true);
  });

  it('refuses a character-data mismatch with a reason', () => {
    const wire = createLoopbackPair({ latency: 1 });
    const guest = mount(wire.b, false, 'Guest');
    wire.a.onStatus(() => undefined);
    const badHello: NetMsg = { t: 'hello', proto: PROTO, charHash: 0xdeadbeef, charId: 'flo', name: 'Modded' };
    guest.ctrl.lockChar('yulia');
    wire.run(1);
    wire.a.send(badHello);
    wire.run(2);
    expect(guest.start).toBeNull();
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
