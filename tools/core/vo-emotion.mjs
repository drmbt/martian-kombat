// tools/core/vo-emotion.mjs — the rule for making cloned-voice VO emotional.
//
// Fish Audio's S1 model reads a leading (tag) at the START of a line as an
// expression control it acts on but does NOT speak aloud, e.g.
//   "(excited) Ship it!"   -> shouted with hype, the word "excited" is silent.
// Docs: https://docs.fish.audio/developer-guide/best-practices/emotion-control
//
// A grunt's right emotion depends on WHEN it plays, not just who says it:
//   kiai    — thrown on an attack   -> exertion / aggression
//   hurt    — played taking damage  -> pain
//   victory — the win-screen taunt  -> triumph, in the fighter's own register
//   move    — a named special call  -> exertion, same energy as kiai
// ...crossed with the fighter's temperament (a serene guru does not SHOUT his
// kiai; a hype dev-bro does). This module encodes both as one lookup.
//
// IMPORTANT: these (tags) are Fish-only. ElevenLabs stock voices would SPEAK
// the word "(excited)" — callers must apply this ONLY on the Fish clone path.

// Fish S1 valid tags used below (all verified against the emotion-control list):
//   emotions: calm confident excited frustrated proud relaxed determined
//             disdainful sarcastic indifferent satisfied
//   tone:     (shouting)
//   effects:  (groaning) (gasping)
// Do NOT invent tags (e.g. "(mysterious)" is not supported) — the model
// ignores or mangles unknown ones.

/** category -> tag when a fighter has no explicit temperament entry */
const DEFAULT_BY_CATEGORY = {
  kiai: '(shouting)',
  hurt: '(groaning)',
  victory: '(confident)',
  move: '(shouting)',
};

/** per-fighter overrides, keyed by roster id then category. Add a fighter here
 *  the moment their default read is wrong on the soundboard — this table IS the
 *  tuning surface. Anything absent falls back to DEFAULT_BY_CATEGORY. */
const TEMPERAMENT = {
  // serene off-grid guru — his kiai are literally "Be still" / "Breathe"
  freeman: { kiai: '(calm)', hurt: '(groaning)', victory: '(relaxed)', move: '(calm)' },
  // hype ships-first dev-bro
  gene: { kiai: '(excited)', hurt: '(frustrated)', victory: '(proud)', move: '(excited)' },
  // ceremonial tarot reader — quietly certain, never shouty
  chebel: { kiai: '(confident)', hurt: '(gasping)', victory: '(confident)', move: '(confident)' },
  // imperious philosopher-king boss
  tao: { kiai: '(confident)', hurt: '(disdainful)', victory: '(disdainful)', move: '(confident)' },
  // chaotic-evil signal/noise trickster
  vincent: { kiai: '(excited)', hurt: '(frustrated)', victory: '(sarcastic)', move: '(excited)' },
  // cold, detached experimentalist
  yulia: { kiai: '(determined)', hurt: '(frustrated)', victory: '(indifferent)', move: '(determined)' },
  // deadpan erudite desert raconteur — dry, unhurried, faintly amused
  rj: { kiai: '(confident)', hurt: '(groaning)', victory: '(sarcastic)', move: '(confident)' },
};

/** Per-LINE overrides, keyed by roster id → category → exact line text (as it
 *  appears in the character JSON). These were inline "(tag) text" prefixes in
 *  gen-audio's old tables; the JSON holds clean text (ElevenLabs would speak a
 *  tag aloud), so the hand-tuned reads live here. `(raw)` = no tag at all.
 *  `(screaming)` / `(angry)` were used on the shipped clips as-is. A test
 *  (src/data/voLines.test.ts) fails if a key stops matching a JSON line. */
const LINE_TAGS = {
  freeman: {
    hurt: { 'Unmoved.': '(calm)' },
    victory: { 'Namaste... now leave.': '(calm)' },
  },
  gene: {
    victory: { "I'm bullish on this one!": '(excited)' },
  },
  chebel: {
    kiai: { 'HA!': '(shouting)' },
    hurt: { 'Ui!': '(raw)' },
  },
  rj: {
    kiai: {
      'Go on, git!!!': '(shouting)',
      'YAW!!!': '(shouting)',
      'Hyah!': '(raw)',
      'Hyee-YAH!': '(raw)',
      'Whooooa.': '(raw)',
    },
    hurt: { 'Ngh!': '(raw)', 'FUUUCK!!!': '(screaming)' },
    victory: { 'Get. Off. My. Lot.': '(angry)' },
  },
};

const VALID_CATEGORIES = new Set(['kiai', 'hurt', 'victory', 'move']);

/** Resolve the leading Fish tag (with parens) for a fighter+context, or ''. */
export function emotionTag(charId, category) {
  if (!VALID_CATEGORIES.has(category)) return '';
  const per = TEMPERAMENT[charId];
  return (per && per[category]) || DEFAULT_BY_CATEGORY[category] || '';
}

/** Prepend the resolved tag to the spoken text (Fish clone path ONLY).
 *  Idempotent: a line that already starts with a (tag) is returned untouched;
 *  LINE_TAGS supplies the hand-tuned per-line tags for clean JSON text. A leading `(raw)` is an explicit
 *  "no emotion" escape — it's stripped and the bare text returned untagged
 *  (for short grunts a clone reads cleaner with no tag at all). */
export function withEmotion(charId, category, text) {
  let t = String(text ?? '');
  const line = LINE_TAGS[charId]?.[category]?.[t];
  if (line) t = `${line} ${t}`; // a per-line override beats the temperament
  const raw = t.match(/^\s*\(raw\)\s*/i);
  if (raw) return t.slice(raw[0].length); // explicit no-tag
  if (/^\s*\([a-z][a-z\s-]*\)/i.test(t)) return t; // already tagged
  const tag = emotionTag(charId, category);
  return tag ? `${tag} ${t}` : t;
}

export { DEFAULT_BY_CATEGORY, TEMPERAMENT, LINE_TAGS };
