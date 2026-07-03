# 🛸 MARTIAN KOMBAT

**▶ PLAY NOW: [drmbt.github.io/martian-kombat](https://drmbt.github.io/martian-kombat/)**

A Street Fighter / Mortal Kombat–style 2D versus fighting game starring the
residents of **Mars College** — a popup art residency and off-grid community in
the desert outside Bombay Beach, CA, on the shores of the Salton Sea.

Every fighter is a real Martian. Every sprite, stage, and sound is AI-generated
from real inspiration photos through scripted pipelines (Gemini nano-banana +
Veo for sprites, GPT Image for stages/UI, ElevenLabs for the announcer and SFX).

## The roster

| Fighter | Style |
|---|---|
| **Catherine** | Bo staff + chef's knives; her dog Jazzper joins her specials |
| **Flo** | Angry German hacker; terminal exploits and spliff smokescreens |
| **Freeman** | Yogi-meditator; stillness, counters, and inner-peace armor |
| **Gene** | AI-startup hacker; generative-AI glitch attacks |
| **Kirby** | Acrobatic fire-breathing contortionist; cartwheels and scalding breath |
| **Marzipan** | Dreadlocked vegan biologist; vines, spores, and symbiosis |
| **Vincent** | Tai chi + digital wizardry in a long black cloak |
| **Yulia** | Tall Russian yogi; flexibility plus a rage meter you don't want full |

More Martians can join the roster — characters are data files, not code. Full
move-set designs: [docs/CHARACTERS.md](docs/CHARACTERS.md).

## Status

**MVP shipped, roster complete** — all 8 Martians fully built and playable,
each with a six-button kit, named motion-input specials, and a fatality.
19 pixel-art stages with their own music, full title/versus/victory music
loop, announcer + SFX, VS screen and win-quote screen, CPU opponent, training
mode, settings (volumes, round clock, match length), keyboard / gamepad /
touch. Current focus: smoothness and playability — game feel, impact VFX,
attract mode, control remapping. Roadmap, task state, and changelog live in
[SPRINTBOARD.md](SPRINTBOARD.md).

## Stack

Phaser 3 · TypeScript · Vite · a custom deterministic fight core (60hz fixed
tick, data-driven character frame data) · Node asset-gen scripts in `tools/`.

## Development

```bash
npm install
cp .env.example .env   # add your API keys (asset generation only; the game
                       # itself runs without keys)
npm run dev
```

Agent contributors: read [CLAUDE.md](CLAUDE.md) first, then
[SPRINTBOARD.md](SPRINTBOARD.md) — the sprintboard protocol (update checkboxes +
changelog before every commit) is not optional.

---

*Made in the desert. No Martians were harmed in the making of this game —
except in the game, where they beat each other senseless.*
