// The live WebRTC path needs a real broker + two browsers, so it is smoke-
// tested through the LobbyScene (T39), not here. What IS pure and worth
// locking is the room-code format the lobby UI prints and the join field
// parses — an unreadable or ambiguous code is a support headache.
import { describe, expect, it } from 'vitest';
import { makeRoomCode } from './webrtc';

describe('makeRoomCode', () => {
  it('is 5 chars from an unambiguous uppercase alphabet (no I/L/O/0/1)', () => {
    for (let i = 0; i < 200; i++) {
      const code = makeRoomCode();
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/);
    }
  });

  it('does not obviously collide across many draws', () => {
    const seen = new Set(Array.from({ length: 500 }, () => makeRoomCode()));
    expect(seen.size).toBeGreaterThan(490);
  });
});
