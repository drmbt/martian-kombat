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
| **Kirby** | Flexible yogi; sips tea, spits fire, spreads gossip |
| **Marzipan** | Dreadlocked vegan biologist; vines, spores, and symbiosis |
| **Vincent** | Tai chi + digital wizardry in a long black cloak |
| **Yulia** | Tall Russian yogi; flexibility plus a rage meter you don't want full |

More Martians join the roster after MVP. Full move-set designs:
[docs/CHARACTERS.md](docs/CHARACTERS.md).

## Status

**MVP shipped** — 4 of 8 Martians playable (Vincent, Yulia, Catherine +
Jazzper, Kirby), best-of-3 fights on the Salton Sea shoreline, announcer +
SFX, keyboard or gamepads. Roadmap, task state, and changelog live in
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
