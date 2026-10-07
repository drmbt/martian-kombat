// P2.7 — the dev-only /__editor/* middleware must refuse requests from other
// web pages (cross-origin, DNS rebinding, text/plain "simple" POSTs) and keep
// zip imports inside the importing fighter's own files.
import { describe, expect, it } from 'vitest';
import { checkEditorRequest, importPathAllowed, isLoopbackHost, SAFE_ID, tsString } from '../../tools/core/editor-guard.mjs';

const json = { 'content-type': 'application/json' };

describe('checkEditorRequest', () => {
  it('lets the editors through (same-origin JSON POST, GET, curl without Origin)', () => {
    expect(checkEditorRequest('POST', { host: 'localhost:5173', origin: 'http://localhost:5173', ...json }).ok).toBe(true);
    expect(checkEditorRequest('POST', { host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5173', 'content-type': 'application/json; charset=utf-8' }).ok).toBe(true);
    expect(checkEditorRequest('GET', { host: 'localhost:5173' }).ok).toBe(true);
    expect(checkEditorRequest('POST', { host: 'localhost:5173', ...json }).ok).toBe(true);
    expect(checkEditorRequest('POST', { host: '[::1]:5173', origin: 'http://[::1]:5173', ...json }).ok).toBe(true);
  });

  it('403s a foreign Origin, an opaque origin and cross-site fetches', () => {
    expect(checkEditorRequest('POST', { host: 'localhost:5173', origin: 'https://evil.example', ...json })).toMatchObject({ ok: false, status: 403 });
    expect(checkEditorRequest('POST', { host: 'localhost:5173', origin: 'null', ...json })).toMatchObject({ ok: false, status: 403 });
    expect(checkEditorRequest('GET', { host: 'localhost:5173', 'sec-fetch-site': 'cross-site' })).toMatchObject({ ok: false, status: 403 });
    // a page on localhost:OTHER-port is still a loopback origin — allowed
    expect(checkEditorRequest('POST', { host: 'localhost:5173', origin: 'http://localhost:3000', ...json }).ok).toBe(true);
  });

  it('403s DNS rebinding (non-loopback Host)', () => {
    expect(checkEditorRequest('GET', { host: 'rebind.evil.example:5173' })).toMatchObject({ ok: false, status: 403 });
    expect(checkEditorRequest('GET', {})).toMatchObject({ ok: false, status: 403 });
    expect(isLoopbackHost('localhost.evil.example')).toBe(false);
  });

  it('415s writes that are not JSON (the text/plain simple-request hole)', () => {
    expect(checkEditorRequest('POST', { host: 'localhost:5173', 'content-type': 'text/plain' })).toMatchObject({ ok: false, status: 415 });
    expect(checkEditorRequest('POST', { host: 'localhost:5173' })).toMatchObject({ ok: false, status: 415 });
  });
});

describe('ids and generated TS', () => {
  it('SAFE_ID rejects traversal and separators', () => {
    for (const bad of ['../x', 'a/b', '', '-x', '.x', 'A', 'x y']) expect(SAFE_ID.test(bad)).toBe(false);
    for (const ok of ['vincent', 'rj', 'chiba-roof', 'kfm720']) expect(SAFE_ID.test(ok)).toBe(true);
  });

  it('tsString escapes quotes so a name cannot break roster.ts', () => {
    expect(tsString("O'BRIEN")).toBe("'O\\'BRIEN'");
    expect(tsString('a\\b')).toBe("'a\\\\b'");
    expect(tsString('two\nlines')).toBe("'two lines'");
  });
});

describe('importPathAllowed (zip import confinement)', () => {
  it('allows only the importing fighter’s own files', () => {
    for (const ok of [
      'sprites/zed/sheet.png', 'sprites/zed/meta.json', 'sprites/zed/projectile-bolt.png',
      'portraits/zed.png', 'portraits/zed-bust.png', 'portraits/zed-ko.png',
      'audio/announcer/zed.mp3', 'audio/voice/zed-kiai-1.mp3', 'audio/voice/zed-move-bolt.mp3',
      'audio/music/stages/default/zed-theme.mp3', 'fatalities/zed/doom-1.jpg',
    ]) expect(importPathAllowed(ok, 'zed', undefined), ok).toBe(true);
  });

  it('refuses other fighters, shared files, traversal and clobbering a shipped stage', () => {
    for (const bad of [
      'sprites/vincent/sheet.png', 'portraits/vincent.png', 'audio/voice/vincent-kiai-1.mp3',
      'audio/announcer/fight.mp3', 'audio/sfx/hit.mp3', 'fatalities/vincent/x-1.jpg',
      'sprites/zed/../vincent/sheet.png', 'audio/music/manifest.json', 'vfx/spark-hit.png',
    ]) expect(importPathAllowed(bad, 'zed', undefined), bad).toBe(false);
    expect(importPathAllowed('backgrounds/stages/zed-home.jpg', 'zed', 'zed-home', false)).toBe(true);
    expect(importPathAllowed('backgrounds/stages/zed-home.jpg', 'zed', 'zed-home', true)).toBe(false);
    expect(importPathAllowed('backgrounds/stages/van.jpg', 'zed', 'zed-home', false)).toBe(false);
  });
});
