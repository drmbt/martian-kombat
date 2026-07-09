# voice-inspo — real voice samples for cloning

Drop voice samples of the real person here, one folder per fighter, matching
their character id (same convention as `assets/character-inspo/`):

```
assets/voice-inspo/<char>/clip1.mp3
assets/voice-inspo/<char>/clip1.txt   # optional transcript sidecar (else Fish runs ASR)
```

- 1–5 clean clips, ~10–90 seconds of speech total. Talking > shouting — the
  clone generalizes better from natural speech.
- Formats: mp3 / wav / m4a / flac / ogg.
- Source material: the Martian Lore sheet's per-person media folders often
  have voice samples — check there first.
- *(The former privacy opt-out rule was retired 2026-07-08 — no check
  needed anymore.)*

Then: `npm run gen:voice -- --char <name>` clones the voice via Fish Audio
(`FISH_API_KEY` in `.env`) and registers the private model id in
`tools/voices.json`; from then on `npm run gen:audio -- --char <name> --force`
regenerates that fighter's kiai/hurt/victory VO through the clone. Announcer
lines stay on ElevenLabs. `npm run gen:voice -- --char <name> --say "test"`
writes a quick test synth to `assets/raw/voice-tests/`.
