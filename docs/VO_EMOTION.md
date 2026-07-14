# VO emotion control — making cloned voices act

Cloned-voice grunts (kiai / hurt / victory / per-move call-outs) route through
**Fish Audio S1**, which reads a leading `(tag)` as an *expression control it
performs but never speaks aloud*:

```
(excited) Ship it!      ->  hyped shout; the word "excited" is silent
(disdainful) Enough.    ->  cold, dismissive
(gasping) Ai!           ->  sharp pained intake
```

Docs: <https://docs.fish.audio/developer-guide/best-practices/emotion-control>

## The rule (encoded in `tools/core/vo-emotion.mjs`)

A grunt's emotion is a function of **when it plays × who says it**, not the
line text alone. `withEmotion(charId, category, text)` resolves both and
prepends the tag. `gen-audio.mjs` calls it automatically on the Fish path.

**Context → base emotion** (`DEFAULT_BY_CATEGORY`):

| category  | when it fires        | default tag   |
| --------- | -------------------- | ------------- |
| `kiai`    | thrown on an attack  | `(shouting)`  |
| `hurt`    | taking damage        | `(groaning)`  |
| `victory` | win-screen taunt     | `(confident)` |
| `move`    | named special call   | `(shouting)`  |

**Fighter temperament overrides** (`TEMPERAMENT`) bend those defaults — a
serene guru doesn't shout, a hype dev-bro does:

| fighter   | kiai          | hurt           | victory         |
| --------- | ------------- | -------------- | --------------- |
| freeman   | `(calm)`      | `(groaning)`   | `(relaxed)`     |
| gene      | `(excited)`   | `(frustrated)` | `(proud)`       |
| chebel    | `(confident)` | `(gasping)`    | `(confident)`   |
| tao       | `(confident)` | `(disdainful)` | `(disdainful)`  |
| vincent   | `(excited)`   | `(frustrated)` | `(sarcastic)`   |
| yulia     | `(determined)`| `(frustrated)` | `(indifferent)` |

Everything not listed falls back to the category default. **This table is the
tuning surface** — when a fighter reads wrong on the soundboard, add or change
their row here, never hand-edit the tag into the line text.

## Hard constraints

- **Fish-only.** ElevenLabs stock voices would *speak* the word `(excited)`.
  Never prepend a tag on the ElevenLabs path — only inside the Fish branch of
  `speak()`. Stock voices lean on ElevenLabs `style`/`stability` instead.
- **Use real S1 tags only.** Valid set: the 49 emotions + tone markers
  (`(shouting)` `(screaming)` `(whispering)` `(soft tone)` `(in a hurry tone)`)
  + effects (`(groaning)` `(gasping)` `(panting)` `(sighing)` …). Invented tags
  like `(mysterious)` are ignored or mangled. Full list in the Fish emotion
  docs; the canonical short list lives in `vo-emotion.mjs`'s header.
- **One tag, at the sentence start.** S1 applies a leading tag to the line.
  `withEmotion` is idempotent — a line that already starts with `(tag)` is left
  alone, so a hand-authored per-line override wins over the table.

## Workflow

1. Clone the voice: `npm run gen:voice -- --char <id>` (samples in
   `assets/voice-inspo/<id>/`).
2. Audition before committing: synth candidate lines through the clone with the
   emotion rule and review them on a soundboard (raw takes land in
   `assets/raw/voice-tests/`). Tune `TEMPERAMENT` until they read right.
3. Bake: `npm run gen:audio -- --char <id> --force` regenerates that fighter's
   VO through the clone with tags applied. Approved takes already on disk are
   skipped unless `--force`.
