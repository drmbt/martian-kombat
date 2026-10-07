// VO line texts have ONE source: the character JSON (`vo` + move `voiceText`).
// gen-audio used to keep its own per-fighter tables, which drifted from the
// shipped clips (02-PLAN P8.6a). These tests keep the single source honest.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fighterVo, isRecorded, playableIds, readCharacter, RECORDED, SFX_MARK } from '../../tools/core/vo-lines.mjs';
import { LINE_TAGS, withEmotion } from '../../tools/core/vo-emotion.mjs';
import { ROSTER } from './roster';

const ids = playableIds();

describe('VO lines come from the character JSON', () => {
  it('playableIds() matches the playable ROSTER', () => {
    expect(ids).toEqual(ROSTER.filter((r) => r.playable).map((r) => r.id));
  });

  it('gen-audio.mjs holds no per-fighter line texts', () => {
    const src = readFileSync('tools/gen-audio.mjs', 'utf8');
    const settings = src.slice(src.indexOf('const voiceSettings = {'), src.indexOf('\n};', src.indexOf('const voiceSettings = {')));
    expect(settings).not.toMatch(/^\s*(kiai|hurt|victory|moves):/m);
  });

  it.each(ids)('%s: texts are clean (no emotion tags in the JSON)', (id) => {
    const vo = fighterVo(id);
    const lines = [...vo.kiai, ...vo.hurt, ...vo.victory, ...Object.values(vo.moves)];
    expect(lines.length).toBeGreaterThan(0);
    // ElevenLabs would speak a "(tag)" aloud — tags belong in vo-emotion.mjs
    expect(lines.filter((t) => /^\s*\(/.test(t))).toEqual([]);
  });

  it('the SFX mark is never sent to TTS', () => {
    for (const id of ids) expect(Object.values(fighterVo(id).moves)).not.toContain(SFX_MARK);
    // vincent has two SFX-marked moves; prove they're dropped, not missing
    const raw = readCharacter('vincent').moves as Record<string, { voiceText?: string }>;
    const sfx = Object.keys(raw).filter((k) => raw[k].voiceText === SFX_MARK);
    expect(sfx.length).toBeGreaterThan(0);
    for (const k of sfx) expect(fighterVo('vincent').moves[k]).toBeUndefined();
  });
});

describe('per-line emotion tags (LINE_TAGS)', () => {
  it('every override still matches a line in that fighter JSON', () => {
    const stale: string[] = [];
    for (const [id, cats] of Object.entries(LINE_TAGS)) {
      const vo = fighterVo(id);
      const pool: Record<string, string[]> = {
        kiai: vo.kiai, hurt: vo.hurt, victory: vo.victory, move: Object.values(vo.moves),
      };
      for (const [cat, lines] of Object.entries(cats ?? {})) {
        for (const text of Object.keys(lines ?? {})) if (!pool[cat]?.includes(text)) stale.push(`${id}.${cat}: ${text}`);
      }
    }
    expect(stale).toEqual([]);
  });

  it('applies overrides, the (raw) escape, then the temperament default', () => {
    expect(withEmotion('rj', 'kiai', 'Go on, git!!!')).toBe('(shouting) Go on, git!!!');
    expect(withEmotion('rj', 'kiai', 'Hyah!')).toBe('Hyah!');
    expect(withEmotion('rj', 'kiai', 'Hup!')).toBe('(confident) Hup!');
  });
});

describe('real recordings are protected from --force', () => {
  it('RECORDED entries point at clips the JSON actually has', () => {
    for (const [id, cats] of Object.entries(RECORDED)) {
      expect(ids).toContain(id);
      const moves = (cats.move ?? []) as string[] | true;
      if (Array.isArray(moves)) for (const m of moves) expect(Object.keys(fighterVo(id).moves)).toContain(m);
    }
    expect(isRecorded('yulia', 'kiai')).toBe(true);
    expect(isRecorded('yulia', 'move', 'backbend-guillotine')).toBe(false); // clone-generated
    expect(isRecorded('vincent', 'kiai')).toBe(false);
  });
});
