# 🛸 MARTIAN KOMBAT

**▶ PLAY NOW: [martiankombat.com](https://martiankombat.com)**

A Street Fighter / Mortal Kombat–style 2D versus fighting game starring the
residents of **Mars College** — a popup art residency and off-grid community in
the desert outside Bombay Beach, CA, on the shores of the Salton Sea.

Every fighter is a real Martian. Every sprite, stage, and sound is AI-generated
from real inspiration photos through scripted pipelines: Gemini (nano-banana)
for character art, pixel-art stages and fatality panels, ElevenLabs for the
announcer and SFX, and Fish Audio voice clones where a real voice sample
exists. Music is made in Suno.

## The roster

Eighteen playable Martians, plus one secret guest.

<!-- generated from src/data/roster.ts + each character JSON (lore.tagline, stage, fatality.name) -->
| Fighter | Tagline | Home stage | Fatality |
|---|---|---|---|
| **Vincent** | Chaotic evil with a heart of gold — and root on the MarsNAS. | Van | Blue Screen |
| **Yulia** | Hungry experimentalist. Spirit animal: snacks. | Chiba Roof | Heart Breaker |
| **Catherine** | Type-A chef. The kitchen runs on time — or else. | AI Kitchen | Dinner Service |
| **Flo** | Works on my machine. Root access denied — to you. | Ski Inn | Burn One |
| **Freeman** | Stillness prevails. The mind bends steel. | Chiba | Ego Death |
| **Gene** | Quack. Ship it. Straight to prod. | Hyperion | 404 |
| **Kirby** | Organizer of chaos. I bend; you break. | Neptune | Hot Yoga |
| **Marzipan** | Everything composts eventually. Now it’s your turn. | Salton Shoreline | Compost |
| **Bodhi** | You carry so much tension. Let me release it. | Dojo | Full Realignment |
| **Cat** | Hold still — this is your good side. | Shipwreck | Still Life |
| **Chebel** | The deck told me of your weakness. | Mimos | The Reversed |
| **Ygor** | This was not a microdosis. | Painted Canyon | Final Render |
| **Rapha** | The TabBastard. Built to last. You’re not. | The Escapes | Scrap Compactor |
| **Vanessa** | The High Priestess of Mars. The Little Martians dreamed you here. | Saturn | Fired & Glazed |
| **Earl** | They call EARL. | Star Beach | The Final Mix |
| **Ben** | They call BEN. | Dome | Dinner's Ready |
| **Tao** | The desert's philosopher-king awaits your challenge. | Institute | Final Critique |
| **RJ** | A well-defined living skeleton, standing head and clavicle above a miasma of screaming ghosts. | Last Resort | For The Birds |
| **Kung Fu Man** *(secret unlock)* | MUGEN's reference fighter (real Elecbyte art, CC BY-NC) | — | — |

Every fighter has a six-button kit (light/medium/heavy punches and kicks) with
chains and cancels, named motion-input specials, a techable throw, a fatality,
win quotes and voice lines. Characters are data files, not code. Move-set
designs: [docs/CHARACTERS.md](docs/CHARACTERS.md); engine-measured frame data:
[docs/FRAME_DATA.md](docs/FRAME_DATA.md).

## Modes

- **VS CPU** and **Two Players** (local, keyboard or gamepad)
- **Online** — peer-to-peer WebRTC with rollback netcode
- **Training** and **Demo match**, plus an attract-mode demo on the title screen
- **Settings** — volumes, round clock, match length, control remapping

27 pixel-art stages, each with ultra-wide art under an SF2-style scrolling
camera, a home stage per fighter, music for most stages, a VS screen and a win-quote
screen. Arcade mode (a ladder through Mars College into Bombay Beach, ending
with Tao Ruspoli for the title of Champion of the Bombay Beach Biennale) is
next on the roadmap.

## Stack

Phaser 3 · TypeScript · Vite · a custom deterministic fight core (60 Hz fixed
tick, data-driven frame data, benchmarked against MUGEN / IKEMEN GO) · WebRTC
(PeerJS) rollback netplay · Node + Python asset-generation scripts in `tools/`
· hosted on **Cloudflare Workers Static Assets**, built from `main` by
Cloudflare Workers Builds ([docs/DEPLOY.md](docs/DEPLOY.md)).

## Development

```bash
npm install
cp .env.example .env   # API keys are only for asset generation; the game runs without them
npm run dev
```

`npm run test` runs the vitest suite (engine, asset audit, frame-data ratchet);
`npm run bench` prints the frame-data audit.

Agent contributors: read [CLAUDE.md](CLAUDE.md), then
[SPRINTBOARD.md](SPRINTBOARD.md) (status) and
[docs/handoff/02-PLAN.md](docs/handoff/02-PLAN.md) (the backlog).

---

*Made in the desert. No Martians were harmed in the making of this game —
except in the game, where they beat each other senseless.*
