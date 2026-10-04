# Frame Data (measured)

> **Generated** by `npm run bench -- --md` — do not hand-edit. Every number is
> measured by running the deterministic engine (`src/bench/`), not read from
> the JSON. SF convention: startup = first active frame (press = frame 1),
> total = frames occupied, on hit / on block = attacker advantage at point
> blank vs a mirror (KD = knockdown). Push in CH (character heights).
> Standards + bands: `docs/FIGHTING_STANDARDS.md`. ⚠ = never connects.

## Roster summary

| Fighter | HP | Walk (CH/s) | Jump air (f) | Jump dist (CH) | Fastest normal (f) | Best combo | Longest chain loop | Errors | Warnings |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| vincent | 1000 | 1.06 | 43 | 1.08 | 2 | 23.2% | 16 ∞ | 2 | 13 |
| yulia | 1080 | 0.99 | 43 | 1.02 | 3 | 24.0% | 8 | 0 | 20 |
| catherine | 1000 | 1.03 | 43 | 1.05 | 6 | 28.4% | 9 | 0 | 13 |
| flo | 1020 | 0.87 | 43 | 0.89 | 6 | 19.4% | 5 | 1 | 18 |
| freeman | 1050 | 0.75 | 43 | 0.77 | 5 | 19.4% | 6 | 0 | 13 |
| gene | 960 | 1.00 | 42 | 1.00 | 5 | 19.8% | 5 | 0 | 10 |
| kirby | 950 | 1.16 | 45 | 1.24 | 4 | 23.5% | 7 | 1 | 4 |
| marzipan | 1050 | 0.80 | 56 | 1.06 | 6 | 15.8% | 5 | 1 | 22 |
| bodhi | 1120 | 1.16 | 41 | 1.14 | 5 | 16.8% | 6 | 2 | 11 |
| cat | 980 | 1.30 | 41 | 1.27 | 4 | 26.4% | 6 | 0 | 5 |
| chebel | 1050 | 1.22 | 41 | 1.19 | 5 | 17.9% | 5 | 0 | 6 |
| ygor | 1080 | 1.05 | 41 | 1.03 | 5 | 16.1% | 5 | 1 | 7 |
| rapha | 1020 | 0.90 | 43 | 0.93 | 6 | 16.7% | 5 | 1 | 24 |
| vanessa | 950 | 1.00 | 41 | 0.97 | 5 | 18.7% | 5 | 1 | 18 |
| earl | 1000 | 0.77 | 43 | 0.79 | 5 | 14.4% | 13 | 1 | 10 |
| ben | 1000 | 0.65 | 43 | 0.66 | 5 | 14.9% | 16 ∞ | 2 | 16 |
| tao | 1050 | 0.78 | 43 | 0.80 | 5 | 17.1% | 10 | 1 | 14 |
| rj | 1020 | 0.75 | 41 | 0.73 | 6 | 18.2% | 11 | 0 | 19 |
| *kfm (reference)* | 1000 | 1.55 | 37 | 1.03 | 4 | 18.5% | 1 | 0 | 9 |

## Roster vs reference (class medians)

| Class | Startup ours / kfm | On hit | On block | Hitstop | Damage %HP |
|---|--:|--:|--:|--:|--:|
| light | 6 / 5 | 1 / 2 | -4 / -4 | 4 / 12 | 4.2 / 2.5 |
| medium | 9 / 9 | -1 / -1 | -8 / -6 | 6 / 12 | 6.9 / 6.0 |
| heavy | 11 / — | -2 / — | -10 / — | 9 / — | 9.0 / — |
| air | 7 / 6 | — / — | — / — | — / — | 6.6 / 4.8 |
| special | 12 / 10 | -6 / -5 | -15 / -12 | 10 / 12 | 8.8 / 9.5 |
| reversal | 6 / — | — / — | -25 / — | 10 / — | 9.1 / — |
| projectile | 14 / — | 4 / — | -2 / — | 10 / — | 7.4 / — |
| throw | 7 / 1 | — / — | — / — | 10 / 4 | 10.5 / 7.8 |

## VINCENT

| Move | Class | Startup | Active | Recovery | Total | On hit | On block | Dmg | Hitstop | Push hit/blk (CH) |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| lp | light | 5 | 3 | 10 | 17 | +2 | -3 | 45 | 4 | 0.16 / 0.13 |
| mp | medium | 8 | 3 | 14 | 24 | +2 | -5 | 70 | 6 | 0.21 / 0.17 |
| hp | heavy | 10 | 4 | 18 | 31 | +1 | -7 | 90 | 9 | 0.26 / 0.21 |
| lk | light | 2 | 12 | 6 | 19 | -4 | -8 | 40 | 4 | 0.14 / 0.11 |
| mk | medium | 10 | 4 | 17 | 30 | -1 | -8 | 75 | 6 | 0.23 / 0.19 |
| hk | heavy | 7 | 16 | 10 | 32 | KD | -10 | 100 | 9 | — / 0.22 |
| clp | light | 2 | 9 | 8 | 18 | -3 | -7 | 40 | 4 | 0.14 / 0.11 |
| cmp | medium | 8 | 4 | 15 | 26 | -1 | -7 | 65 | 6 | 0.19 / 0.15 |
| chp | heavy | 11 | 5 | 19 | 34 | KD | -9 | 90 | 9 | — / 0.19 |
| clk ⚠ | light | 3 | 10 | 9 | 21 | — | — | 40 | — | — / — |
| cmk | medium | 2 | 12 | 10 | 23 | -3 | -10 | 65 | 6 | 0.19 / 0.15 |
| chk | heavy | 9 | 4 | 20 | 32 | KD | -11 | 60 | 9 | — / 0.15 |
| jlp | air | 5 | 6 | 8 | 18 | — | — | 45 | — | — / — |
| jmp | air | 7 | 6 | 10 | 22 | — | — | 65 | — | — / — |
| jhp | air | 9 | 7 | 12 | 27 | — | — | 85 | — | — / — |
| jlk | air | 5 | 6 | 8 | 18 | — | — | 40 | — | — / — |
| jmk | air | 7 | 7 | 10 | 23 | — | — | 65 | — | — / — |
| jhk | air | 10 | 7 | 12 | 28 | — | — | 90 | — | — / — |
| Sigil Bolt (sigil-bolt) L | projectile | 14 | 2 | 25 | 40 | +2 | -4 | 70 | 10 | 0.21 / 0.17 |
| Sigil Bolt (sigil-bolt) M | projectile | 14 | 2 | 25 | 40 | +2 | -4 | 70 | 10 | 0.21 / 0.17 |
| Sigil Bolt (sigil-bolt) H | projectile | 14 | 2 | 25 | 40 | +2 | -4 | 70 | 10 | 0.21 / 0.17 |
| Cloud Hands (cloud-hands) L | special | 10 | 6 | 15 | 30 | +2 | -6 | 60 | 10 | 0.21 / 0.18 |
| Cloud Hands (cloud-hands) M | special | 10 | 10 | 19 | 38 | -6 | -14 | 80 | 10 | 0.34 / 0.31 |
| Cloud Hands (cloud-hands) H | special | 10 | 10 | 23 | 42 | -10 | -18 | 95 | 10 | 0.41 / 0.38 |
| Rising Glyph (rising-glyph) L | reversal | 6 | 10 | 19 | 34 | KD | -14 | 70 | 10 | — / 0.17 |
| Rising Glyph (rising-glyph) M | reversal | 6 | 10 | 33 | 48 | KD | -28 | 90 | 10 | — / 0.03 |
| Rising Glyph (rising-glyph) H | reversal | 6 | 10 | 31 | 46 | KD | -26 | 105 | 10 | — / 0.30 |
| Redirect (redirect) L | utility | 5 | 10 | 11 | 25 | -19 | -19 | 0 | 10 | 0.00 / 0.00 |
| Redirect (redirect) M | utility | 5 | 14 | 13 | 31 | -25 | -25 | 0 | 10 | 0.00 / 0.00 |
| Redirect (redirect) H | utility | 5 | 22 | 17 | 43 | -37 | -37 | 0 | 10 | 0.00 / 0.00 |
| Matrix Teleport (matrix-teleport) L | utility | 29 | 4 | 21 | 53 | — | — | 0 | — | — / — |
| Throw (throw) | throw | 5 | 8 | 21 | 33 | KD | — | 85 | 4 | — / — |

Best meterless combo: **23.2%** (4 hits) — `lk > lp > mp > rising-glyph(h)`

- ✗ **clk** never-connects: light never connects vs a standing mirror (hitbox reach 22px, bodies touch at 102px)
- ✗ **clp>lk** infinite: [clp > lk] still combos at 16 moves (midscreen 15, corner 16) — e.g. lk > clp > lk

## YULIA

| Move | Class | Startup | Active | Recovery | Total | On hit | On block | Dmg | Hitstop | Push hit/blk (CH) |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| lp | light | 6 | 3 | 11 | 19 | +2 | -3 | 50 | 4 | 0.17 / 0.13 |
| mp | medium | 9 | 3 | 15 | 26 | +2 | -5 | 75 | 6 | 0.21 / 0.17 |
| hp | heavy | 12 | 4 | 20 | 35 | +1 | -8 | 105 | 9 | 0.31 / 0.25 |
| lk | light | 3 | 19 | 3 | 24 | -7 | -12 | 45 | 4 | 0.14 / 0.11 |
| mk | medium | 10 | 11 | 11 | 31 | -1 | -8 | 80 | 6 | 0.24 / 0.19 |
| hk | heavy | 13 | 10 | 21 | 43 | KD | -15 | 110 | 9 | — / 0.25 |
| clp | light | 10 | 6 | 8 | 23 | +1 | -4 | 45 | 4 | 0.14 / 0.11 |
| cmp | medium | 8 | 4 | 15 | 26 | 0 | -7 | 70 | 6 | 0.19 / 0.15 |
| chp | heavy | 11 | 5 | 20 | 35 | KD | -10 | 95 | 9 | — / 0.19 |
| clk | light | 6 | 12 | 11 | 28 | -8 | -13 | 45 | 4 | 0.14 / 0.11 |
| cmk | medium | 15 | 10 | 13 | 37 | -3 | -10 | 75 | 6 | 0.21 / 0.17 |
| chk | heavy | 10 | 4 | 21 | 34 | KD | -12 | 65 | 9 | — / 0.15 |
| jlp | air | 5 | 6 | 8 | 18 | — | — | 48 | — | — / — |
| jmp | air | 7 | 6 | 10 | 22 | — | — | 70 | — | — / — |
| jhp | air | 9 | 7 | 12 | 27 | — | — | 95 | — | — / — |
| jlk | air | 5 | 6 | 8 | 18 | — | — | 45 | — | — / — |
| jmk | air | 7 | 7 | 10 | 23 | — | — | 75 | — | — / — |
| jhk | air | 10 | 7 | 12 | 28 | — | — | 100 | — | — / — |
| Cossack Spiral (cossack-spiral) L | special | 9 | 8 | 17 | 33 | KD | -10 | 65 | 10 | — / 0.44 |
| Cossack Spiral (cossack-spiral) M | special | 11 | 8 | 21 | 39 | KD | -14 | 85 | 10 | — / 0.35 |
| Cossack Spiral (cossack-spiral) H | special | 13 | 8 | 25 | 45 | KD | -18 | 115 | 10 | — / 0.25 |
| Backbend Guillotine (backbend-guillotine) L | special | 12 | 18 | 18 | 47 | KD | -20 | 80 | 10 | — / 0.17 |
| Backbend Guillotine (backbend-guillotine) M | special | 6 | 18 | 18 | 41 | KD | -20 | 95 | 10 | — / 0.17 |
| Backbend Guillotine (backbend-guillotine) H | special | 18 | 18 | 18 | 53 | KD | -20 | 110 | 10 | — / 0.21 |
| Volga Piledriver (volga-piledriver) L | throw | 6 | 15 | 10 | 30 | KD | — | 140 | 10 | — / — |
| Volga Piledriver (volga-piledriver) M | throw | 10 | 15 | 10 | 34 | KD | — | 160 | 10 | — / — |
| Volga Piledriver (volga-piledriver) H | throw | 9 | 15 | 33 | 56 | KD | — | 180 | 10 | — / — |
| Braid Lariat (braid-lariat) | special | 5 | 24 | 15 | 43 | -18 | -26 | 70 | 10 | 0.21 / 0.17 |
| Sickle Kick (sickle-kick) L | special | 11 | 16 | 19 | 45 | -10 | -16 | 80 | 10 | 0.23 / 0.21 |
| Sickle Kick (sickle-kick) M | special | 11 | 24 | 19 | 53 | -10 | -16 | 116 | 10 | 0.46 / 0.43 |
| Sickle Kick (sickle-kick) H | special | 11 | 30 | 23 | 63 | -12 | -18 | 148 | 10 | 0.70 / 0.66 |
| Throw (throw) | throw | 5 | 2 | 21 | 27 | KD | — | 100 | 4 | — / — |

Best meterless combo: **24.0%** (4 hits) — `lp > lk > mk > cossack-spiral(h)`

## CATHERINE

| Move | Class | Startup | Active | Recovery | Total | On hit | On block | Dmg | Hitstop | Push hit/blk (CH) |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| lp | light | 7 | 3 | 12 | 21 | +1 | -4 | 45 | 4 | 0.19 / 0.15 |
| mp | medium | 10 | 3 | 16 | 28 | 0 | -6 | 70 | 6 | 0.24 / 0.19 |
| hp | heavy | 13 | 4 | 22 | 38 | -1 | -10 | 95 | 9 | 0.29 / 0.23 |
| lk | light | 6 | 3 | 11 | 19 | +1 | -4 | 40 | 4 | 0.17 / 0.14 |
| mk | medium | 10 | 4 | 18 | 31 | -2 | -9 | 72 | 6 | 0.24 / 0.19 |
| hk | heavy | 14 | 4 | 22 | 39 | KD | -10 | 95 | 9 | — / 0.23 |
| clp | light | 7 | 3 | 12 | 21 | 0 | -5 | 40 | 4 | 0.17 / 0.14 |
| cmp | medium | 9 | 4 | 16 | 28 | -2 | -8 | 65 | 6 | 0.22 / 0.17 |
| chp | heavy | 12 | 5 | 20 | 36 | KD | -10 | 88 | 9 | — / 0.19 |
| clk | light | 7 | 3 | 13 | 22 | -1 | -6 | 40 | 4 | 0.17 / 0.14 |
| cmk | medium | 10 | 4 | 18 | 31 | -3 | -10 | 68 | 6 | 0.22 / 0.17 |
| chk | heavy | 11 | 4 | 23 | 37 | KD | -14 | 60 | 9 | — / 0.16 |
| jlp | air | 6 | 6 | 8 | 19 | — | — | 42 | — | — / — |
| jmp | air | 8 | 6 | 10 | 23 | — | — | 65 | — | — / — |
| jhp | air | 10 | 7 | 12 | 28 | — | — | 88 | — | — / — |
| jlk | air | 6 | 6 | 8 | 19 | — | — | 40 | — | — / — |
| jmk | air | 8 | 7 | 10 | 24 | — | — | 66 | — | — / — |
| jhk | air | 11 | 7 | 12 | 29 | — | — | 90 | — | — / — |
| Mise en Place (mise-en-place) L | projectile | 10 | 2 | 21 | 32 | +4 | -1 | 65 | 10 | 0.17 / 0.14 |
| Mise en Place (mise-en-place) M | projectile | 12 | 2 | 21 | 34 | +4 | -1 | 130 | 10 | 0.17 / 0.14 |
| Mise en Place (mise-en-place) H | projectile | 14 | 2 | 21 | 36 | +4 | -1 | 188 | 10 | 0.17 / 0.14 |
| Order Up! — Jazzper hits LOW (order-up) L | projectile | 13 | 2 | 25 | 39 | +4 | — | 75 | 10 | 0.17 / — |
| Order Up! — Jazzper hits LOW (order-up) M | projectile | 13 | 2 | 25 | 39 | +4 | — | 75 | 10 | 0.17 / — |
| Order Up! — Jazzper hits LOW (order-up) H | projectile | 13 | 2 | 25 | 39 | +4 | — | 75 | 10 | 0.17 / — |
| Staff Vault (staff-vault) L | utility | 7 | 2 | 33 | 41 | — | — | 0 | — | — / — |
| Staff Vault (staff-vault) M | utility | 7 | 2 | 35 | 43 | — | — | 0 | — | — / — |
| Staff Vault (staff-vault) H | utility | 7 | 2 | 37 | 45 | — | — | 0 | — | — / — |
| 86'd (eighty-sixed) L | throw | 8 | 4 | 27 | 38 | KD | — | 105 | 10 | — / — |
| 86'd (eighty-sixed) M | throw | 9 | 4 | 27 | 39 | KD | — | 120 | 10 | — / — |
| 86'd (eighty-sixed) H | throw | 11 | 4 | 27 | 41 | KD | — | 135 | 10 | — / — |
| Throw (throw) | throw | 5 | 2 | 21 | 27 | KD | — | 85 | 4 | — / — |

Best meterless combo: **28.4%** (6 hits) — `lk > lp > mp > mise-en-place(h)`

## FLO

| Move | Class | Startup | Active | Recovery | Total | On hit | On block | Dmg | Hitstop | Push hit/blk (CH) |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| lp | light | 6 | 3 | 12 | 20 | +1 | -4 | 48 | 4 | 0.18 / 0.14 |
| mp | medium | 10 | 3 | 16 | 28 | +1 | -6 | 74 | 6 | 0.23 / 0.18 |
| hp | heavy | 13 | 4 | 21 | 37 | KD | -9 | 102 | 9 | — / 0.24 |
| lk ⚠ | light | 6 | 3 | 11 | 19 | — | — | 44 | — | — / — |
| mk | medium | 11 | 4 | 18 | 32 | -1 | -8 | 82 | 6 | 0.28 / 0.22 |
| hk | heavy | 14 | 4 | 22 | 39 | KD | -10 | 108 | 9 | — / 0.26 |
| clp | light | 6 | 3 | 11 | 19 | +1 | -4 | 44 | 4 | 0.15 / 0.12 |
| cmp | medium | 9 | 4 | 16 | 28 | -1 | -8 | 70 | 6 | 0.20 / 0.16 |
| chp | heavy | 11 | 5 | 21 | 36 | KD | -11 | 94 | 9 | — / 0.20 |
| clk | light | 6 | 3 | 12 | 20 | 0 | -5 | 44 | 4 | 0.15 / 0.12 |
| cmk | medium | 10 | 4 | 18 | 31 | -2 | -9 | 76 | 6 | 0.23 / 0.18 |
| chk | heavy | 11 | 4 | 22 | 36 | KD | -13 | 64 | 9 | — / 0.16 |
| jlp | air | 5 | 6 | 8 | 18 | — | — | 46 | — | — / — |
| jmp | air | 7 | 6 | 10 | 22 | — | — | 70 | — | — / — |
| jhp | air | 9 | 7 | 12 | 27 | — | — | 94 | — | — / — |
| jlk | air | 5 | 6 | 8 | 18 | — | — | 44 | — | — / — |
| jmk | air | 7 | 7 | 10 | 23 | — | — | 76 | — | — / — |
| jhk | air | 10 | 7 | 12 | 28 | — | — | 98 | — | — / — |
| sudo kill (sudo-kill) L | projectile | 13 | 2 | 25 | 39 | +10 | +2 | 80 | 10 | 0.28 / 0.22 |
| sudo kill (sudo-kill) M | projectile | 13 | 2 | 25 | 39 | +10 | +2 | 95 | 10 | 0.28 / 0.22 |
| sudo kill (sudo-kill) H | projectile | 13 | 2 | 29 | 43 | +6 | -2 | 112 | 10 | 0.28 / 0.22 |
| Fork Bomb (fork-bomb) L | projectile | 106 | 2 | -69 | 38 | KD | +26 | 90 | 10 | — / -0.18 |
| Fork Bomb (fork-bomb) M | projectile | 106 | 2 | -69 | 38 | KD | +26 | 90 | 10 | — / -0.18 |
| Fork Bomb (fork-bomb) H | projectile | 106 | 2 | -69 | 38 | KD | +26 | 90 | 10 | — / -0.18 |
| Flame War (smokescreen) L | projectile | 11 | 4 | 19 | 33 | KD | +2 | 82 | 10 | — / 0.14 |
| Flame War (smokescreen) M | projectile | 14 | 4 | 19 | 36 | KD | +2 | 100 | 10 | — / 0.14 |
| Flame War (smokescreen) H | projectile | 17 | 4 | 19 | 39 | KD | +2 | 116 | 10 | — / 0.14 |
| Root Access (root-access) L | projectile | 13 | 2 | 25 | 39 | KD | -2 | 70 | 10 | — / -0.07 |
| Root Access (root-access) M | projectile | 13 | 2 | 25 | 39 | KD | -2 | 70 | 10 | — / -0.10 |
| Root Access (root-access) H | projectile | 13 | 2 | 25 | 39 | KD | -2 | 70 | 10 | — / -0.10 |
| Blunt Puff (blunt-puff) L | projectile | 13 | 2 | 21 | 35 | +36 | -10 | 92 | 4 | 0.26 / 0.25 |
| Blunt Puff (blunt-puff) M | projectile | 13 | 2 | 21 | 35 | +36 | -10 | 92 | 4 | 0.26 / 0.25 |
| Blunt Puff (blunt-puff) H | projectile | 13 | 2 | 21 | 35 | +8 | -10 | 50 | 4 | 0.14 / 0.12 |
| Throw (throw) | throw | 5 | 2 | 21 | 27 | KD | — | 85 | 4 | — / — |

Best meterless combo: **19.4%** (2 hits) — `mk > smokescreen(h)`

- ✗ **lk** never-connects: light never connects vs a standing mirror (hitbox reach 34px, bodies touch at 88px)

## FREEMAN

| Move | Class | Startup | Active | Recovery | Total | On hit | On block | Dmg | Hitstop | Push hit/blk (CH) |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| lp | light | 5 | 3 | 11 | 18 | +2 | -3 | 46 | 4 | 0.18 / 0.14 |
| mp | medium | 9 | 3 | 16 | 27 | +1 | -6 | 72 | 6 | 0.23 / 0.19 |
| hp | heavy | 12 | 4 | 21 | 36 | KD | -9 | 100 | 9 | — / 0.25 |
| lk | light | 6 | 3 | 11 | 19 | +1 | -4 | 44 | 4 | 0.15 / 0.12 |
| mk | medium | 11 | 4 | 18 | 32 | -1 | -8 | 80 | 6 | 0.28 / 0.23 |
| hk | heavy | 14 | 4 | 22 | 39 | KD | -10 | 106 | 9 | — / 0.27 |
| clp | light | 5 | 3 | 11 | 18 | +1 | -4 | 42 | 4 | 0.15 / 0.12 |
| cmp | medium | 9 | 4 | 16 | 28 | -1 | -8 | 68 | 6 | 0.21 / 0.16 |
| chp | heavy | 11 | 5 | 21 | 36 | KD | -11 | 92 | 9 | — / 0.21 |
| clk | light | 6 | 3 | 12 | 20 | 0 | -5 | 42 | 4 | 0.15 / 0.12 |
| cmk | medium | 10 | 4 | 18 | 31 | -2 | -9 | 74 | 6 | 0.23 / 0.19 |
| chk | heavy | 11 | 4 | 22 | 36 | KD | -13 | 62 | 9 | — / 0.16 |
| jlp | air | 5 | 6 | 8 | 18 | — | — | 46 | — | — / — |
| jmp | air | 7 | 6 | 10 | 22 | — | — | 70 | — | — / — |
| jhp | air | 9 | 7 | 12 | 27 | — | — | 94 | — | — / — |
| jlk | air | 5 | 6 | 8 | 18 | — | — | 44 | — | — / — |
| jmk | air | 7 | 7 | 10 | 23 | — | — | 76 | — | — / — |
| jhk | air | 10 | 7 | 12 | 28 | — | — | 98 | — | — / — |
| Breathwork (breathwork) L | reversal | 6 | 8 | 27 | 40 | KD | -19 | 82 | 10 | — / 0.27 |
| Breathwork (breathwork) M | reversal | 6 | 8 | 32 | 45 | KD | -24 | 96 | 10 | — / 0.03 |
| Breathwork (breathwork) H | reversal | 6 | 8 | 37 | 50 | KD | -29 | 108 | 10 | — / 0.15 |
| Sun Salutation (sun-salutation) L | special | 13 | 6 | 23 | 41 | KD | -12 | 92 | 10 | — / 0.21 |
| Sun Salutation (sun-salutation) M | special | 13 | 6 | 25 | 43 | KD | -14 | 110 | 10 | — / 0.21 |
| Sun Salutation (sun-salutation) H | special | 13 | 6 | 29 | 47 | KD | -18 | 124 | 10 | — / 0.22 |
| Presence (presence) L | reversal | 7 | 6 | 23 | 35 | KD | -14 | 78 | 10 | — / 0.29 |
| Presence (presence) M | reversal | 9 | 6 | 23 | 37 | KD | -14 | 90 | 10 | — / 0.26 |
| Presence (presence) H | reversal | 11 | 6 | 25 | 41 | KD | -16 | 104 | 10 | — / 0.29 |
| Yoga Float (yoga-float) L | utility | 9 | 2 | 70 | 80 | — | — | 0 | — | — / — |
| Throw (throw) | throw | 5 | 2 | 21 | 27 | KD | — | 85 | 4 | — / — |

Best meterless combo: **19.4%** (2 hits) — `mk > sun-salutation(h)`

## GENE

| Move | Class | Startup | Active | Recovery | Total | On hit | On block | Dmg | Hitstop | Push hit/blk (CH) |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| lp | light | 6 | 3 | 11 | 19 | +2 | -3 | 46 | 4 | 0.18 / 0.15 |
| mp | medium | 9 | 3 | 15 | 26 | +2 | -5 | 72 | 6 | 0.24 / 0.19 |
| hp | heavy | 12 | 4 | 20 | 35 | KD | -8 | 100 | 9 | — / 0.25 |
| lk | light | 5 | 3 | 10 | 17 | +2 | -3 | 44 | 4 | 0.16 / 0.13 |
| mk | medium | 10 | 4 | 17 | 30 | 0 | -7 | 78 | 6 | 0.26 / 0.21 |
| hk | heavy | 13 | 4 | 21 | 37 | KD | -9 | 106 | 9 | — / 0.27 |
| clp | light | 6 | 3 | 10 | 18 | +2 | -3 | 42 | 4 | 0.16 / 0.13 |
| cmp | medium | 8 | 4 | 15 | 26 | 0 | -7 | 68 | 6 | 0.21 / 0.17 |
| chp | heavy | 11 | 5 | 20 | 35 | KD | -10 | 92 | 9 | — / 0.21 |
| clk | light | 6 | 3 | 11 | 19 | +1 | -4 | 42 | 4 | 0.16 / 0.13 |
| cmk | medium | 9 | 4 | 17 | 29 | -1 | -8 | 72 | 6 | 0.24 / 0.19 |
| chk | heavy | 10 | 4 | 21 | 34 | KD | -12 | 62 | 9 | — / 0.17 |
| jlp | air | 5 | 6 | 8 | 18 | — | — | 44 | — | — / — |
| jmp | air | 7 | 6 | 10 | 22 | — | — | 68 | — | — / — |
| jhp | air | 9 | 7 | 12 | 27 | — | — | 92 | — | — / — |
| jlk | air | 5 | 6 | 8 | 18 | — | — | 42 | — | — / — |
| jmk | air | 7 | 7 | 10 | 23 | — | — | 72 | — | — / — |
| jhk | air | 10 | 7 | 12 | 28 | — | — | 96 | — | — / — |
| Diffusion (in) (diffusion-strike) | utility | 15 | 2 | 13 | 29 | — | — | 0 | — | — / — |
| Diffusion (out) (diffusion-escape) | utility | 13 | 2 | 11 | 25 | — | — | 0 | — | — / — |
| Line Goes Up (rate-limit) L | projectile | 12 | 4 | 19 | 34 | KD | +2 | 80 | 10 | — / 0.15 |
| Line Goes Up (rate-limit) M | projectile | 15 | 4 | 19 | 37 | KD | +2 | 96 | 10 | — / 0.15 |
| Line Goes Up (rate-limit) H | projectile | 18 | 4 | 19 | 40 | KD | +2 | 112 | 10 | — / 0.15 |
| Hallucination (hallucination) L | projectile | 68 | 2 | -33 | 36 | KD | +22 | 60 | 10 | — / -0.10 |
| Hallucination (hallucination) M | projectile | 68 | 2 | -33 | 36 | KD | +22 | 60 | 10 | — / -0.10 |
| Hallucination (hallucination) H | projectile | 68 | 2 | -33 | 36 | KD | +22 | 60 | 10 | — / -0.17 |
| Mana Burst (mana-burst) L | projectile | 13 | 2 | 25 | 39 | +4 | -3 | 80 | 10 | 0.26 / 0.21 |
| Mana Burst (mana-burst) M | projectile | 13 | 2 | 25 | 39 | +4 | -3 | 80 | 10 | 0.26 / 0.21 |
| Mana Burst (mana-burst) H | projectile | 13 | 2 | 25 | 39 | +4 | -3 | 80 | 10 | 0.26 / 0.21 |
| Throw (throw) | throw | 5 | 2 | 21 | 27 | KD | — | 85 | 4 | — / — |

Best meterless combo: **19.8%** (2 hits) — `mk > rate-limit(h)`

## KIRBY

| Move | Class | Startup | Active | Recovery | Total | On hit | On block | Dmg | Hitstop | Push hit/blk (CH) |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| lp | light | 4 | 3 | 9 | 15 | +3 | -2 | 42 | 4 | 0.15 / 0.12 |
| mp | medium | 7 | 3 | 13 | 22 | +2 | -4 | 62 | 6 | 0.20 / 0.16 |
| hp | heavy | 10 | 4 | 17 | 30 | +1 | -7 | 82 | 9 | 0.25 / 0.20 |
| lk | light | 5 | 3 | 10 | 17 | +1 | -3 | 40 | 4 | 0.15 / 0.12 |
| mk | medium | 8 | 4 | 15 | 26 | 0 | -7 | 68 | 6 | 0.22 / 0.18 |
| hk | heavy | 10 | 5 | 18 | 32 | KD | -8 | 85 | 9 | — / 0.20 |
| clp | light | 5 | 3 | 9 | 16 | +2 | -2 | 38 | 4 | 0.15 / 0.12 |
| cmp ⚠ | medium | 7 | 4 | 14 | 24 | — | — | 58 | — | — / — |
| chp | heavy | 10 | 5 | 18 | 32 | KD | -9 | 80 | 9 | — / 0.18 |
| clk | light | 5 | 3 | 11 | 18 | 0 | -4 | 38 | 4 | 0.15 / 0.12 |
| cmk | medium | 8 | 4 | 16 | 27 | -2 | -8 | 60 | 6 | 0.20 / 0.16 |
| chk | heavy | 9 | 4 | 20 | 32 | KD | -11 | 58 | 9 | — / 0.14 |
| jlp | air | 4 | 6 | 7 | 16 | — | — | 40 | — | — / — |
| jmp | air | 6 | 6 | 9 | 20 | — | — | 60 | — | — / — |
| jhp | air | 8 | 7 | 11 | 25 | — | — | 80 | — | — / — |
| jlk | air | 4 | 6 | 7 | 16 | — | — | 38 | — | — / — |
| jmk | air | 6 | 7 | 9 | 21 | — | — | 62 | — | — / — |
| jhk | air | 9 | 7 | 11 | 26 | — | — | 84 | — | — / — |
| Fire Breath (fire-breath) L | projectile | 10 | 2 | 21 | 32 | +8 | +4 | 70 | 10 | 0.15 / 0.12 |
| Fire Breath (fire-breath) M | projectile | 12 | 2 | 21 | 34 | +8 | +4 | 80 | 10 | 0.15 / 0.12 |
| Fire Breath (fire-breath) H | projectile | 14 | 2 | 23 | 38 | +6 | +2 | 92 | 10 | 0.15 / 0.12 |
| Sonic Scream (sonic-scream) L | projectile | 14 | 2 | 25 | 40 | +6 | 0 | 60 | 10 | 0.30 / 0.24 |
| Sonic Scream (sonic-scream) M | projectile | 14 | 2 | 25 | 40 | KD | 0 | 70 | 10 | — / 0.24 |
| Sonic Scream (sonic-scream) H | projectile | 16 | 2 | 27 | 44 | KD | -2 | 84 | 10 | — / 0.24 |
| Cartwheel (cartwheel) L | reversal | 6 | 6 | 30 | 41 | KD | -21 | 74 | 10 | — / 0.26 |
| Cartwheel (cartwheel) M | reversal | 6 | 6 | 34 | 45 | KD | -25 | 88 | 10 | — / 0.35 |
| Cartwheel (cartwheel) H | reversal | 6 | 6 | 39 | 50 | KD | -30 | 100 | 10 | — / 0.12 |
| Cat Scratch (cat-scratch) L | special | 6 | 26 | 13 | 44 | -3 | -8 | 111 | 10 | 0.22 / 0.18 |
| Cat Scratch (cat-scratch) H | special | 6 | 33 | 13 | 51 | -3 | — | 134 | 10 | 0.28 / — |
| Throw (throw) | throw | 5 | 2 | 21 | 27 | KD | — | 85 | 4 | — / — |

Best meterless combo: **23.5%** (4 hits) — `lp > lk > mk > cartwheel(h)`

- ✗ **cmp** never-connects: medium never connects vs a standing mirror (hitbox reach 17px, bodies touch at 94px)

## MARZIPAN

| Move | Class | Startup | Active | Recovery | Total | On hit | On block | Dmg | Hitstop | Push hit/blk (CH) |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| lp | light | 7 | 3 | 12 | 21 | +1 | -4 | 46 | 4 | 0.18 / 0.15 |
| mp | medium | 10 | 3 | 16 | 28 | +1 | -6 | 72 | 6 | 0.26 / 0.21 |
| hp | heavy | 13 | 4 | 21 | 37 | KD | -9 | 100 | 9 | — / 0.25 |
| lk | light | 6 | 3 | 11 | 19 | +1 | -4 | 44 | 4 | 0.16 / 0.12 |
| mk | medium | 11 | 4 | 17 | 31 | 0 | -7 | 78 | 6 | 0.26 / 0.21 |
| hk | heavy | 14 | 4 | 22 | 39 | KD | -10 | 104 | 9 | — / 0.27 |
| clp | light | 6 | 3 | 11 | 19 | +1 | -4 | 42 | 4 | 0.16 / 0.12 |
| cmp | medium | 9 | 4 | 16 | 28 | -1 | -8 | 68 | 6 | 0.21 / 0.17 |
| chp | heavy | 11 | 5 | 21 | 36 | KD | -11 | 92 | 9 | — / 0.21 |
| clk | light | 6 | 3 | 11 | 19 | +1 | -4 | 42 | 4 | 0.16 / 0.12 |
| cmk | medium | 10 | 4 | 17 | 30 | -1 | -8 | 74 | 6 | 0.23 / 0.19 |
| chk | heavy | 11 | 6 | 23 | 39 | KD | -16 | 66 | 9 | — / 0.19 |
| jlp | air | 5 | 6 | 8 | 18 | — | — | 44 | — | — / — |
| jmp | air | 7 | 6 | 10 | 22 | — | — | 68 | — | — / — |
| jhp | air | 9 | 7 | 12 | 27 | — | — | 92 | — | — / — |
| jlk | air | 5 | 6 | 8 | 18 | — | — | 42 | — | — / — |
| jmk | air | 7 | 7 | 10 | 23 | — | — | 72 | — | — / — |
| jhk | air | 10 | 7 | 12 | 28 | — | — | 96 | — | — / — |
| Symbiosis (symbiosis) L | throw | 8 | 4 | 31 | 42 | KD | — | 100 | 10 | — / — |
| Symbiosis (symbiosis) M | throw | 9 | 4 | 31 | 43 | KD | — | 120 | 10 | — / — |
| Symbiosis (symbiosis) H | throw | 11 | 4 | 35 | 49 | KD | — | 140 | 10 | — / — |
| Overgrowth (overgrowth) L | projectile | 44 | 2 | -6 | 39 | KD | +25 | 85 | 10 | — / -0.09 |
| Overgrowth (overgrowth) M | projectile | 44 | 2 | -6 | 39 | KD | +25 | 85 | 10 | — / -0.15 |
| Overgrowth (overgrowth) H | projectile | 44 | 2 | -6 | 39 | KD | +25 | 85 | 10 | — / -0.15 |
| Spore Bloom (spore-bloom) L | projectile | 17 | 2 | 23 | 41 | -12 | -14 | 18 | 4 | 0.05 / 0.04 |
| Spore Bloom (spore-bloom) M | projectile | 17 | 2 | 23 | 41 | -12 | -14 | 18 | 4 | 0.05 / 0.04 |
| Spore Bloom (spore-bloom) H | projectile | 17 | 2 | 23 | 41 | -12 | -14 | 18 | 4 | 0.05 / 0.04 |
| Vine Spear (vine-spear) L | projectile | 15 | 2 | 29 | 45 | KD | -8 | 65 | 10 | — / 0.08 |
| Vine Spear (vine-spear) M | projectile | 15 | 2 | 29 | 45 | KD | -8 | 65 | 10 | — / 0.08 |
| Vine Spear (vine-spear) H | projectile | 15 | 2 | 29 | 45 | KD | -8 | 65 | 10 | — / 0.08 |
| Throw (throw) | throw | 5 | 2 | 21 | 27 | KD | — | 85 | 4 | — / — |

Best meterless combo: **15.8%** (4 hits) — `lp > lk > lp > lk`

- ✗ **symbiosis[l]** throw-out-of-range: grab range 95px can't reach vincent (95px)

## BODHI

| Move | Class | Startup | Active | Recovery | Total | On hit | On block | Dmg | Hitstop | Push hit/blk (CH) |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| lp | light | 5 | 3 | 11 | 18 | +2 | -3 | 48 | 4 | 0.19 / 0.15 |
| mp | medium | 8 | 3 | 15 | 25 | +2 | -5 | 74 | 6 | 0.25 / 0.20 |
| hp | heavy | 12 | 8 | 17 | 36 | KD | -9 | 104 | 9 | — / 0.26 |
| lk | light | 6 | 3 | 11 | 19 | +1 | -4 | 46 | 4 | 0.16 / 0.13 |
| mk | medium | 10 | 4 | 17 | 30 | 0 | -7 | 78 | 6 | 0.30 / 0.24 |
| hk | heavy | 14 | 8 | 17 | 38 | KD | -9 | 106 | 9 | — / 0.28 |
| clp | light | 5 | 3 | 11 | 18 | +1 | -4 | 44 | 4 | 0.16 / 0.13 |
| cmp | medium | 9 | 4 | 16 | 28 | -1 | -8 | 68 | 6 | 0.22 / 0.17 |
| chp | heavy | 11 | 5 | 21 | 36 | KD | -11 | 92 | 9 | — / 0.22 |
| clk | light | 6 | 3 | 12 | 20 | 0 | -5 | 42 | 4 | 0.16 / 0.13 |
| cmk | medium | 10 | 4 | 18 | 31 | -2 | -9 | 74 | 6 | 0.25 / 0.20 |
| chk | heavy | 11 | 4 | 22 | 36 | KD | -13 | 62 | 9 | — / 0.17 |
| jlp | air | 5 | 6 | 8 | 18 | — | — | 46 | — | — / — |
| jmp | air | 7 | 6 | 10 | 22 | — | — | 70 | — | — / — |
| jhp | air | 9 | 7 | 12 | 27 | — | — | 94 | — | — / — |
| jlk | air | 5 | 6 | 8 | 18 | — | — | 44 | — | — / — |
| jmk | air | 7 | 7 | 10 | 23 | — | — | 76 | — | — / — |
| jhk | air | 10 | 7 | 12 | 28 | — | — | 98 | — | — / — |
| Deep Tissue (deep-tissue) L | throw | 6 | 4 | 29 | 38 | KD | — | 150 | 10 | — / — |
| Deep Tissue (deep-tissue) M | throw | 7 | 4 | 29 | 39 | KD | — | 172 | 10 | — / — |
| Deep Tissue (deep-tissue) H | throw | 9 | 4 | 33 | 45 | KD | — | 192 | 10 | — / — |
| Table Work (table-work) L ⚠ | throw | 7 | 3 | 25 | 34 | KD | — | 104 | — | — / — |
| Table Work (table-work) M | throw | 8 | 3 | 25 | 35 | KD | — | 118 | 10 | — / — |
| Table Work (table-work) H | throw | 10 | 3 | 27 | 39 | KD | — | 132 | 10 | — / — |
| Ascendant (ascendant) L | reversal | 6 | 8 | 27 | 40 | KD | -19 | 84 | 10 | — / 0.28 |
| Ascendant (ascendant) M | reversal | 6 | 8 | 27 | 40 | KD | -19 | 98 | 10 | — / 0.03 |
| Ascendant (ascendant) H | reversal | 6 | 8 | 35 | 48 | KD | -27 | 110 | 10 | — / 0.15 |
| Retrograde (retrograde) L | special | 8 | 8 | 17 | 32 | KD | -11 | 66 | 10 | — / 0.45 |
| Retrograde (retrograde) M | special | 10 | 8 | 21 | 38 | KD | -15 | 82 | 10 | — / 0.37 |
| Retrograde (retrograde) H | special | 12 | 8 | 25 | 44 | KD | -19 | 108 | 10 | — / 0.30 |
| Throw (throw) | throw | 5 | 2 | 21 | 27 | KD | — | 95 | 4 | — / — |

Best meterless combo: **16.8%** (2 hits) — `mk > ascendant(h)`

- ✗ **table-work[l]** throw-out-of-range: grab range 77px ≤ push-box separation 84px (mirror)
- ✗ **table-work[m]** throw-out-of-range: grab range 89px can't reach vincent (93px), yulia (91px), catherine (90px), kirby (89px), ben (92px)

## CAT

| Move | Class | Startup | Active | Recovery | Total | On hit | On block | Dmg | Hitstop | Push hit/blk (CH) |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| lp | light | 4 | 3 | 10 | 16 | +2 | -3 | 42 | 4 | 0.16 / 0.13 |
| mp | medium | 7 | 3 | 14 | 23 | +2 | -5 | 68 | 6 | 0.21 / 0.17 |
| hp | heavy | 11 | 4 | 20 | 34 | KD | -9 | 98 | 9 | — / 0.25 |
| lk | light | 5 | 3 | 10 | 17 | +2 | -3 | 44 | 4 | 0.16 / 0.13 |
| mk | medium | 9 | 4 | 16 | 28 | 0 | -7 | 74 | 6 | 0.27 / 0.21 |
| hk | heavy | 13 | 4 | 21 | 37 | KD | -9 | 100 | 9 | — / 0.28 |
| clp | light | 4 | 3 | 10 | 16 | +1 | -4 | 40 | 4 | 0.16 / 0.13 |
| cmp | medium | 8 | 4 | 15 | 26 | 0 | -7 | 64 | 6 | 0.21 / 0.17 |
| chp | heavy | 10 | 5 | 20 | 34 | KD | -10 | 88 | 9 | — / 0.21 |
| clk | light | 5 | 3 | 11 | 18 | 0 | -5 | 40 | 4 | 0.16 / 0.13 |
| cmk | medium | 9 | 4 | 17 | 29 | -1 | -8 | 70 | 6 | 0.24 / 0.19 |
| chk | heavy | 11 | 4 | 21 | 35 | KD | -12 | 60 | 9 | — / 0.17 |
| jlp | air | 5 | 6 | 8 | 18 | — | — | 42 | — | — / — |
| jmp | air | 7 | 6 | 10 | 22 | — | — | 66 | — | — / — |
| jhp | air | 9 | 7 | 12 | 27 | — | — | 90 | — | — / — |
| jlk | air | 5 | 6 | 8 | 18 | — | — | 42 | — | — / — |
| jmk | air | 7 | 7 | 10 | 23 | — | — | 72 | — | — / — |
| jhk | air | 10 | 7 | 12 | 28 | — | — | 94 | — | — / — |
| D. Catarina (d-catarina) L | special | 13 | 4 | 25 | 41 | KD | -14 | 82 | 10 | — / 0.23 |
| D. Catarina (d-catarina) M | special | 15 | 4 | 27 | 45 | KD | -16 | 96 | 10 | — / 0.23 |
| D. Catarina (d-catarina) H | special | 17 | 4 | 29 | 49 | KD | -18 | 110 | 10 | — / 0.28 |
| Flour Bomb (flour-bomb) L | utility | 13 | 2 | 25 | 39 | — | — | 0 | — | — / — |
| Flour Bomb (flour-bomb) M | utility | 13 | 2 | 25 | 39 | — | — | 0 | — | — / — |
| Flour Bomb (flour-bomb) H | utility | 13 | 2 | 25 | 39 | — | — | 0 | — | — / — |
| Thread of Life (thread-of-life) L | projectile | 14 | 2 | 27 | 42 | KD | -6 | 62 | 10 | — / 0.11 |
| Thread of Life (thread-of-life) M | projectile | 14 | 2 | 27 | 42 | KD | -6 | 62 | 10 | — / 0.11 |
| Thread of Life (thread-of-life) H | projectile | 14 | 2 | 27 | 42 | KD | -6 | 74 | 10 | — / 0.11 |
| Pirouette (pirouette) L | reversal | 6 | 8 | 27 | 40 | KD | -20 | 78 | 10 | — / 0.26 |
| Pirouette (pirouette) M | reversal | 6 | 8 | 27 | 40 | KD | -20 | 92 | 10 | — / 0.03 |
| Pirouette (pirouette) H | reversal | 6 | 8 | 33 | 46 | KD | -26 | 104 | 10 | — / 0.14 |
| Throw (throw) | throw | 5 | 2 | 21 | 27 | KD | — | 90 | 4 | — / — |

Best meterless combo: **26.4%** (4 hits) — `lp > mp > mk > pirouette(h)`

## CHEBEL

| Move | Class | Startup | Active | Recovery | Total | On hit | On block | Dmg | Hitstop | Push hit/blk (CH) |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| lp | light | 5 | 3 | 10 | 17 | +2 | -3 | 44 | 4 | 0.16 / 0.12 |
| mp | medium | 8 | 3 | 15 | 25 | +1 | -5 | 70 | 6 | 0.23 / 0.19 |
| hp | heavy | 12 | 4 | 21 | 36 | KD | -10 | 100 | 9 | — / 0.25 |
| lk | light | 6 | 3 | 10 | 18 | +2 | -3 | 46 | 4 | 0.16 / 0.12 |
| mk | medium | 10 | 4 | 17 | 30 | 0 | -7 | 76 | 6 | 0.29 / 0.23 |
| hk | heavy | 13 | 4 | 22 | 38 | KD | -10 | 104 | 9 | — / 0.27 |
| clp | light | 5 | 3 | 10 | 17 | +2 | -3 | 42 | 4 | 0.16 / 0.12 |
| cmp | medium | 9 | 4 | 16 | 28 | -1 | -8 | 66 | 6 | 0.21 / 0.17 |
| chp | heavy | 11 | 5 | 21 | 36 | KD | -11 | 90 | 9 | — / 0.21 |
| clk | light | 6 | 3 | 11 | 19 | +1 | -4 | 42 | 4 | 0.16 / 0.12 |
| cmk | medium | 10 | 4 | 18 | 31 | -2 | -9 | 74 | 6 | 0.23 / 0.19 |
| chk | heavy | 11 | 4 | 22 | 36 | KD | -13 | 62 | 9 | — / 0.17 |
| jlp | air | 5 | 6 | 8 | 18 | — | — | 44 | — | — / — |
| jmp | air | 7 | 6 | 10 | 22 | — | — | 68 | — | — / — |
| jhp | air | 9 | 7 | 12 | 27 | — | — | 92 | — | — / — |
| jlk | air | 5 | 6 | 8 | 18 | — | — | 46 | — | — / — |
| jmk | air | 7 | 7 | 10 | 23 | — | — | 76 | — | — / — |
| jhk | air | 10 | 7 | 12 | 28 | — | — | 98 | — | — / — |
| Spirit Draw (spirit-draw) L | projectile | 14 | 4 | 25 | 42 | +2 | -5 | 60 | 10 | 0.21 / 0.17 |
| Spirit Draw (spirit-draw) M | projectile | 14 | 4 | 25 | 42 | +2 | -5 | 78 | 10 | 0.26 / 0.21 |
| Spirit Draw (spirit-draw) H | projectile | 14 | 4 | 25 | 42 | +6 | -5 | 96 | 10 | 0.31 / 0.25 |
| Crescent Moon Kick (crescent-moon) L | special | 15 | 4 | 23 | 41 | KD | -11 | 84 | 10 | — / 0.25 |
| Crescent Moon Kick (crescent-moon) M | special | 17 | 4 | 23 | 43 | KD | -11 | 100 | 10 | — / 0.25 |
| Crescent Moon Kick (crescent-moon) H | special | 19 | 4 | 25 | 47 | KD | -13 | 116 | 10 | — / 0.28 |
| Ceremony (ceremony) L | reversal | 6 | 8 | 27 | 40 | KD | -19 | 82 | 10 | — / 0.26 |
| Ceremony (ceremony) M | reversal | 6 | 8 | 27 | 40 | KD | -19 | 96 | 10 | — / 0.02 |
| Ceremony (ceremony) H | reversal | 6 | 8 | 35 | 48 | KD | -27 | 110 | 10 | — / 0.14 |
| Unicycle Rush (unicycle-rush) L | special | 9 | 8 | 17 | 33 | KD | -11 | 72 | 10 | — / 0.43 |
| Unicycle Rush (unicycle-rush) M | special | 11 | 8 | 21 | 39 | KD | -15 | 88 | 10 | — / 0.35 |
| Unicycle Rush (unicycle-rush) H | special | 13 | 8 | 25 | 45 | KD | -19 | 112 | 10 | — / 0.30 |
| Throw (throw) | throw | 5 | 2 | 21 | 27 | KD | — | 92 | 4 | — / — |

Best meterless combo: **17.9%** (2 hits) — `mk > unicycle-rush(h)`

## YGOR

| Move | Class | Startup | Active | Recovery | Total | On hit | On block | Dmg | Hitstop | Push hit/blk (CH) |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| lp | light | 5 | 3 | 11 | 18 | +2 | -3 | 46 | 4 | 0.18 / 0.14 |
| mp | medium | 8 | 3 | 15 | 25 | +2 | -5 | 72 | 6 | 0.23 / 0.19 |
| hp | heavy | 12 | 4 | 21 | 36 | KD | -9 | 102 | 9 | — / 0.25 |
| lk | light | 6 | 3 | 12 | 20 | 0 | -5 | 46 | 4 | 0.16 / 0.12 |
| mk | medium | 10 | 4 | 17 | 30 | 0 | -7 | 76 | 6 | 0.29 / 0.23 |
| hk | heavy | 14 | 4 | 22 | 39 | KD | -10 | 104 | 9 | — / 0.27 |
| clp | light | 5 | 3 | 11 | 18 | +1 | -4 | 44 | 4 | 0.16 / 0.12 |
| cmp | medium | 9 | 4 | 16 | 28 | -1 | -8 | 66 | 6 | 0.21 / 0.17 |
| chp | heavy | 11 | 5 | 21 | 36 | KD | -11 | 90 | 9 | — / 0.21 |
| clk | light | 6 | 3 | 12 | 20 | 0 | -5 | 42 | 4 | 0.16 / 0.12 |
| cmk | medium | 10 | 4 | 18 | 31 | -2 | -9 | 74 | 6 | 0.23 / 0.19 |
| chk | heavy | 11 | 4 | 22 | 36 | KD | -13 | 62 | 9 | — / 0.17 |
| jlp | air | 5 | 6 | 8 | 18 | — | — | 46 | — | — / — |
| jmp | air | 7 | 6 | 10 | 22 | — | — | 70 | — | — / — |
| jhp | air | 9 | 7 | 12 | 27 | — | — | 94 | — | — / — |
| jlk | air | 5 | 6 | 8 | 18 | — | — | 44 | — | — / — |
| jmk | air | 7 | 7 | 10 | 23 | — | — | 76 | — | — / — |
| jhk | air | 10 | 7 | 12 | 28 | — | — | 98 | — | — / — |
| Suave Creature (suave-creature) L | projectile | 13 | 4 | 25 | 41 | +2 | -5 | 62 | 10 | 0.21 / 0.17 |
| Suave Creature (suave-creature) M | projectile | 13 | 4 | 25 | 41 | +2 | -5 | 80 | 10 | 0.26 / 0.21 |
| Suave Creature (suave-creature) H | projectile | 13 | 4 | 25 | 41 | +6 | -5 | 98 | 10 | 0.31 / 0.25 |
| oRACLE (oracle) L | utility | 16 | 2 | 23 | 40 | — | — | 0 | — | — / — |
| oRACLE (oracle) M | utility | 16 | 2 | 23 | 40 | — | — | 0 | — | — / — |
| oRACLE (oracle) H | utility | 16 | 2 | 23 | 40 | — | — | 0 | — | — / — |
| Microdose (microdose) L | utility | 15 | 2 | 11 | 27 | — | — | 0 | — | — / — |
| Rainbow Road (rainbow-road) L | projectile | 13 | 2 | 25 | 39 | +4 | — | 72 | 10 | 0.18 / — |
| Rainbow Road (rainbow-road) M | projectile | 13 | 2 | 25 | 39 | +4 | — | 72 | 10 | 0.18 / — |
| Rainbow Road (rainbow-road) H | projectile | 13 | 2 | 25 | 39 | +4 | — | 72 | 10 | 0.18 / — |
| Throw (throw) ⚠ | throw | 5 | 2 | 21 | 27 | KD | — | 94 | — | — / — |

Best meterless combo: **16.1%** (2 hits) — `mk > suave-creature(h)`

- ✗ **throw** throw-out-of-range: grab range 79px ≤ push-box separation 88px (mirror)

## RAPHA

| Move | Class | Startup | Active | Recovery | Total | On hit | On block | Dmg | Hitstop | Push hit/blk (CH) |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| lp | light | 6 | 3 | 12 | 20 | +1 | -4 | 48 | 4 | 0.18 / 0.15 |
| mp | medium | 10 | 3 | 16 | 28 | +1 | -6 | 74 | 6 | 0.24 / 0.19 |
| hp | heavy | 13 | 4 | 21 | 37 | KD | -9 | 102 | 9 | — / 0.25 |
| lk | light | 6 | 3 | 11 | 19 | +1 | -4 | 44 | 4 | 0.16 / 0.13 |
| mk | medium | 11 | 4 | 18 | 32 | -1 | -8 | 82 | 6 | 0.29 / 0.23 |
| hk | heavy | 14 | 4 | 22 | 39 | KD | -10 | 108 | 9 | — / 0.27 |
| clp | light | 6 | 3 | 11 | 19 | +1 | -4 | 44 | 4 | 0.16 / 0.13 |
| cmp | medium | 9 | 4 | 16 | 28 | -1 | -8 | 70 | 6 | 0.21 / 0.17 |
| chp | heavy | 11 | 5 | 21 | 36 | KD | -11 | 94 | 9 | — / 0.21 |
| clk | light | 6 | 3 | 12 | 20 | 0 | -5 | 44 | 4 | 0.16 / 0.13 |
| cmk | medium | 10 | 4 | 18 | 31 | -2 | -9 | 76 | 6 | 0.24 / 0.19 |
| chk | heavy | 11 | 4 | 22 | 36 | KD | -13 | 64 | 9 | — / 0.17 |
| jlp | air | 5 | 6 | 8 | 18 | — | — | 46 | — | — / — |
| jmp | air | 7 | 6 | 10 | 22 | — | — | 70 | — | — / — |
| jhp | air | 9 | 7 | 12 | 27 | — | — | 94 | — | — / — |
| jlk | air | 5 | 6 | 8 | 18 | — | — | 44 | — | — / — |
| jmk | air | 7 | 7 | 10 | 23 | — | — | 76 | — | — / — |
| jhk | air | 10 | 7 | 12 | 28 | — | — | 98 | — | — / — |
| Claw Machine (claw-machine) L | throw | 7 | 4 | 31 | 41 | KD | — | 148 | 10 | — / — |
| Claw Machine (claw-machine) M | throw | 8 | 4 | 31 | 42 | KD | — | 168 | 10 | — / — |
| Claw Machine (claw-machine) H | throw | 10 | 4 | 35 | 48 | KD | — | 188 | 10 | — / — |
| Tubs, Fetch! (tubs-fetch) L | projectile | 14 | 2 | 23 | 38 | +4 | -2 | 58 | 10 | 0.16 / 0.13 |
| Tubs, Fetch! (tubs-fetch) M | projectile | 14 | 2 | 23 | 38 | +4 | -2 | 58 | 10 | 0.16 / 0.13 |
| Tubs, Fetch! (tubs-fetch) H | projectile | 14 | 2 | 27 | 42 | 0 | -6 | 58 | 10 | 0.16 / 0.13 |
| Pop-Tab Chain (pop-tab-chain) L | projectile | 13 | 2 | 21 | 35 | +14 | +10 | 63 | 4 | 0.18 / 0.14 |
| Pop-Tab Chain (pop-tab-chain) M | projectile | 13 | 2 | 21 | 35 | +24 | +20 | 80 | 4 | 0.23 / 0.18 |
| Pop-Tab Chain (pop-tab-chain) H | projectile | 13 | 2 | 21 | 35 | +14 | +10 | 63 | 4 | 0.18 / 0.14 |
| Wind-Up (wind-up) L | projectile | 54 | 2 | -16 | 39 | KD | +26 | 88 | 10 | — / -0.12 |
| Wind-Up (wind-up) M | projectile | 69 | 2 | -31 | 39 | KD | +26 | 88 | 10 | — / -0.12 |
| Wind-Up (wind-up) H | projectile | 84 | 2 | -46 | 39 | KD | +26 | 88 | 10 | — / -0.19 |
| Throw (throw) | throw | 5 | 2 | 21 | 27 | KD | — | 85 | 4 | — / — |

Best meterless combo: **16.7%** (4 hits) — `lp > lk > lp > lk`

- ✗ **throw** throw-out-of-range: grab range 90px can't reach vincent (93px), yulia (91px), catherine (90px), ben (92px)

## VANESSA

| Move | Class | Startup | Active | Recovery | Total | On hit | On block | Dmg | Hitstop | Push hit/blk (CH) |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| lp | light | 7 | 3 | 11 | 20 | +2 | -3 | 44 | 4 | 0.20 / 0.16 |
| mp | medium | 5 | 7 | 16 | 27 | -3 | -10 | 70 | 6 | 0.26 / 0.21 |
| hp | heavy | 13 | 4 | 21 | 37 | KD | -9 | 100 | 9 | — / 0.28 |
| lk | light | 6 | 8 | 11 | 24 | -4 | -9 | 44 | 4 | 0.17 / 0.14 |
| mk | medium | 10 | 7 | 17 | 33 | -3 | -10 | 76 | 6 | 0.29 / 0.23 |
| hk | heavy | 14 | 4 | 22 | 39 | KD | -10 | 104 | 9 | — / 0.30 |
| clp | light | 7 | 3 | 10 | 19 | +2 | -3 | 40 | 4 | 0.17 / 0.14 |
| cmp | medium | 9 | 4 | 16 | 28 | -1 | -8 | 66 | 6 | 0.23 / 0.18 |
| chp | heavy | 12 | 5 | 21 | 37 | KD | -11 | 90 | 9 | — / 0.23 |
| clk | light | 6 | 3 | 11 | 19 | +1 | -4 | 40 | 4 | 0.17 / 0.14 |
| cmk | medium | 9 | 4 | 17 | 29 | -1 | -8 | 70 | 6 | 0.26 / 0.21 |
| chk | heavy | 10 | 4 | 21 | 34 | KD | -12 | 60 | 9 | — / 0.18 |
| jlp | air | 5 | 6 | 8 | 18 | — | — | 42 | — | — / — |
| jmp | air | 7 | 6 | 10 | 22 | — | — | 66 | — | — / — |
| jhp | air | 9 | 7 | 12 | 27 | — | — | 90 | — | — / — |
| jlk | air | 5 | 6 | 8 | 18 | — | — | 40 | — | — / — |
| jmk | air | 7 | 7 | 10 | 23 | — | — | 70 | — | — / — |
| jhk | air | 10 | 7 | 12 | 28 | — | — | 94 | — | — / — |
| Little Martian (little-martian) L | projectile | 15 | 3 | 25 | 42 | +3 | -5 | 70 | 10 | 0.23 / 0.18 |
| Little Martian (little-martian) M | projectile | 15 | 3 | 25 | 42 | +3 | -5 | 70 | 10 | 0.23 / 0.18 |
| Little Martian (little-martian) H | projectile | 15 | 3 | 25 | 42 | +3 | -5 | 70 | 10 | 0.23 / 0.18 |
| Chocolate Head (chocolate-head) L | projectile | 17 | 2 | 25 | 43 | -14 | -16 | 16 | 4 | 0.06 / 0.05 |
| Chocolate Head (chocolate-head) M | projectile | 17 | 2 | 25 | 43 | -14 | -16 | 16 | 4 | 0.06 / 0.05 |
| Chocolate Head (chocolate-head) H | projectile | 17 | 2 | 25 | 43 | -14 | -16 | 16 | 4 | 0.06 / 0.05 |
| Teleportal (teleportal) L | utility | 13 | 2 | 15 | 29 | — | — | 0 | — | — / — |
| EUC Crash (euc-crash) L | special | 12 | 8 | 19 | 38 | KD | -12 | 72 | 10 | — / 0.35 |
| EUC Crash (euc-crash) M | special | 12 | 8 | 23 | 42 | KD | -16 | 88 | 10 | — / 0.44 |
| EUC Crash (euc-crash) H | special | 12 | 8 | 29 | 48 | KD | -22 | 100 | 10 | — / 0.51 |
| Spoken Word (spoken-word) L | reversal | 7 | 8 | 21 | 35 | KD | -14 | 68 | 10 | — / 0.23 |
| Spoken Word (spoken-word) M | reversal | 7 | 8 | 27 | 41 | KD | -20 | 90 | 10 | — / 0.23 |
| Spoken Word (spoken-word) H | reversal | 7 | 8 | 33 | 47 | KD | -26 | 102 | 10 | — / 0.23 |
| Throw (throw) | throw | 5 | 2 | 21 | 27 | KD | — | 82 | 4 | — / — |

Best meterless combo: **18.7%** (2 hits) — `mk > spoken-word(h)`

- ✗ **throw** throw-out-of-range: grab range 91px can't reach vincent (91px)

## EARL

| Move | Class | Startup | Active | Recovery | Total | On hit | On block | Dmg | Hitstop | Push hit/blk (CH) |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| lp | light | 5 | 3 | 9 | 16 | +1 | -2 | 30 | 4 | 0.08 / 0.06 |
| mp | medium | 8 | 4 | 14 | 25 | -1 | -8 | 50 | 6 | 0.13 / 0.10 |
| hp | heavy | 11 | 4 | 19 | 33 | -2 | -8 | 75 | 9 | 0.21 / 0.17 |
| lk | light | 6 | 3 | 10 | 18 | 0 | -3 | 32 | 4 | 0.08 / 0.06 |
| mk | medium | 9 | 4 | 15 | 27 | -2 | -9 | 52 | 6 | 0.13 / 0.10 |
| hk | heavy | 12 | 4 | 20 | 35 | -3 | -9 | 78 | 9 | 0.21 / 0.17 |
| clp | light | 5 | 3 | 9 | 16 | +1 | -2 | 28 | 4 | 0.08 / 0.06 |
| cmp | medium | 8 | 4 | 14 | 25 | -1 | -8 | 48 | 6 | 0.13 / 0.10 |
| chp | heavy | 10 | 4 | 18 | 31 | -1 | -7 | 70 | 9 | 0.21 / 0.17 |
| clk | light | 6 | 3 | 10 | 18 | 0 | -3 | 30 | 4 | 0.08 / 0.06 |
| cmk | medium | 9 | 4 | 15 | 27 | -2 | -9 | 50 | 6 | 0.13 / 0.10 |
| chk | heavy | 12 | 5 | 21 | 37 | -5 | -11 | 74 | 9 | 0.21 / 0.17 |
| jlp | air | 5 | 6 | 6 | 16 | — | — | 30 | — | — / — |
| jmp | air | 7 | 6 | 8 | 20 | — | — | 50 | — | — / — |
| jhp | air | 9 | 6 | 10 | 24 | — | — | 72 | — | — / — |
| jlk | air | 5 | 6 | 6 | 16 | — | — | 32 | — | — / — |
| jmk | air | 7 | 6 | 8 | 20 | — | — | 52 | — | — / — |
| jhk | air | 10 | 6 | 10 | 25 | — | — | 76 | — | — / — |
| throw ⚠ | throw | — | 2 | — | — | — | — | 0 | — | — / — |
| Trumpet Blast (bolt) L | projectile | 18 | 2 | 19 | 38 | +8 | +4 | 52 | 10 | 0.23 / 0.19 |
| Trumpet Blast (bolt) M | projectile | 19 | 2 | 20 | 40 | +7 | +1 | 60 | 10 | 0.23 / 0.19 |
| Trumpet Blast (bolt) H | projectile | 20 | 2 | 21 | 42 | +6 | 0 | 70 | 10 | 0.23 / 0.19 |
| Step (step) L | utility | 11 | 1 | 19 | 30 | — | — | 0 | — | — / — |
| Pillar (pillar) L | reversal | 5 | 8 | 30 | 42 | KD | -25 | 66 | 10 | — / 0.01 |
| Pillar (pillar) M | reversal | 6 | 8 | 30 | 43 | KD | -25 | 80 | 10 | — / 0.01 |
| Pillar (pillar) H | reversal | 8 | 8 | 30 | 45 | KD | -25 | 92 | 10 | — / 0.01 |
| Double (double) L | special | 10 | 4 | 21 | 34 | -6 | -12 | 58 | 10 | 0.22 / 0.18 |
| Double (double) M | special | 10 | 4 | 21 | 34 | -6 | -12 | 70 | 10 | 0.24 / 0.20 |
| Double (double) H | special | 12 | 4 | 21 | 36 | -6 | -12 | 84 | 10 | 0.25 / 0.22 |

Best meterless combo: **14.4%** (2 hits) — `mk > pillar(h)`

- ✗ **throw** unreachable: no `input` and 'throw' is not a normal slot — it can never be performed

## BEN

| Move | Class | Startup | Active | Recovery | Total | On hit | On block | Dmg | Hitstop | Push hit/blk (CH) |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| lp | light | 5 | 3 | 9 | 16 | +1 | -2 | 30 | 4 | 0.06 / 0.05 |
| mp | medium | 8 | 4 | 14 | 25 | -1 | -8 | 50 | 6 | 0.11 / 0.09 |
| hp | heavy | 11 | 4 | 19 | 33 | -2 | -8 | 75 | 9 | 0.17 / 0.14 |
| lk | light | 9 | 10 | 2 | 20 | +1 | -2 | 32 | 4 | 0.06 / 0.05 |
| mk | medium | 9 | 8 | 15 | 31 | -6 | -13 | 52 | 6 | 0.11 / 0.09 |
| hk | heavy | 12 | 4 | 20 | 35 | -3 | -9 | 78 | 9 | 0.17 / 0.14 |
| clp | light | 5 | 3 | 9 | 16 | +1 | -2 | 28 | 4 | 0.06 / 0.05 |
| cmp | medium | 8 | 4 | 14 | 25 | -1 | -8 | 48 | 6 | 0.11 / 0.09 |
| chp | heavy | 10 | 4 | 18 | 31 | -1 | -7 | 70 | 9 | 0.17 / 0.14 |
| clk | light | 6 | 3 | 10 | 18 | 0 | -3 | 30 | 4 | 0.06 / 0.05 |
| cmk | medium | 9 | 4 | 15 | 27 | -2 | -9 | 50 | 6 | 0.11 / 0.09 |
| chk | heavy | 12 | 5 | 21 | 37 | -5 | -11 | 74 | 9 | 0.17 / 0.14 |
| jlp | air | 5 | 6 | 6 | 16 | — | — | 30 | — | — / — |
| jmp | air | 7 | 6 | 8 | 20 | — | — | 50 | — | — / — |
| jhp | air | 9 | 6 | 10 | 24 | — | — | 72 | — | — / — |
| jlk | air | 5 | 6 | 6 | 16 | — | — | 32 | — | — / — |
| jmk | air | 7 | 6 | 8 | 20 | — | — | 52 | — | — / — |
| jhk | air | 10 | 6 | 10 | 25 | — | — | 76 | — | — / — |
| throw ⚠ | throw | — | 2 | — | — | — | — | 0 | — | — / — |
| Quesadilla (quesadilla) L | projectile | 12 | 2 | 25 | 38 | +2 | -4 | 52 | 10 | 0.20 / 0.16 |
| Quesadilla (quesadilla) M | projectile | 14 | 2 | 25 | 40 | +2 | -4 | 60 | 10 | 0.20 / 0.16 |
| Quesadilla (quesadilla) H | projectile | 16 | 2 | 25 | 42 | +2 | -4 | 70 | 10 | 0.20 / 0.16 |
| Hot Coffee (hot-coffee) L | projectile | 9 | 4 | 19 | 31 | +2 | 0 | 51 | 4 | 0.04 / 0.03 |
| Hot Coffee (hot-coffee) M | projectile | 10 | 4 | 19 | 32 | +6 | +4 | 78 | 4 | 0.04 / 0.03 |
| Hot Coffee (hot-coffee) H | projectile | 12 | 4 | 19 | 34 | +10 | +8 | 108 | 4 | 0.04 / 0.03 |
| Kitchen Grandma (kitchen-grandma) L | reversal | 5 | 8 | 30 | 42 | KD | -25 | 66 | 10 | — / 0.29 |
| Kitchen Grandma (kitchen-grandma) M | reversal | 6 | 8 | 30 | 43 | KD | -25 | 80 | 10 | — / 0.29 |
| Kitchen Grandma (kitchen-grandma) H | reversal | 8 | 8 | 30 | 45 | KD | -25 | 92 | 10 | — / 0.29 |
| Midnight Munchies (midnight-munchies) L | special | 11 | 5 | 23 | 38 | KD | -15 | 62 | 10 | — / 0.21 |
| Midnight Munchies (midnight-munchies) M | special | 11 | 5 | 23 | 38 | KD | -15 | 78 | 10 | — / 0.24 |
| Midnight Munchies (midnight-munchies) H | special | 13 | 5 | 23 | 40 | KD | -15 | 90 | 10 | — / 0.26 |

Best meterless combo: **14.9%** (7 hits) — `mk > hot-coffee(h)`

- ✗ **throw** unreachable: no `input` and 'throw' is not a normal slot — it can never be performed
- ✗ **clk>clp** infinite: [clk > clp] still combos at 16 moves (midscreen 11, corner 16) — e.g. clp > clk > clp

## TAO

| Move | Class | Startup | Active | Recovery | Total | On hit | On block | Dmg | Hitstop | Push hit/blk (CH) |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| lp | light | 6 | 3 | 10 | 18 | 0 | -3 | 44 | 4 | 0.08 / 0.06 |
| mp | medium | 9 | 3 | 15 | 26 | +3 | -3 | 70 | 6 | 0.21 / 0.17 |
| hp | heavy | 12 | 4 | 20 | 35 | KD | -9 | 98 | 9 | — / 0.17 |
| lk | light | 6 | 3 | 11 | 19 | -1 | -4 | 42 | 4 | 0.08 / 0.06 |
| mk | medium | 10 | 4 | 16 | 29 | +1 | -5 | 74 | 6 | 0.21 / 0.17 |
| hk | heavy | 13 | 4 | 21 | 37 | KD | -10 | 102 | 9 | — / 0.17 |
| clp | light | 5 | 3 | 9 | 16 | +1 | -2 | 38 | 4 | 0.08 / 0.06 |
| cmp | medium | 8 | 4 | 14 | 25 | -1 | -8 | 60 | 6 | 0.13 / 0.10 |
| chp ⚠ | heavy | 10 | 4 | 19 | 32 | — | — | 88 | — | — / — |
| clk | light | 6 | 3 | 10 | 18 | 0 | -3 | 38 | 4 | 0.08 / 0.06 |
| cmk | medium | 9 | 4 | 15 | 27 | -2 | -9 | 62 | 6 | 0.13 / 0.10 |
| chk | heavy | 12 | 5 | 22 | 38 | KD | -12 | 90 | 9 | — / 0.17 |
| jlp | air | 5 | 6 | 6 | 16 | — | — | 40 | — | — / — |
| jmp | air | 7 | 6 | 8 | 20 | — | — | 64 | — | — / — |
| jhp | air | 9 | 6 | 10 | 24 | — | — | 92 | — | — / — |
| jlk | air | 5 | 6 | 6 | 16 | — | — | 42 | — | — / — |
| jmk | air | 7 | 6 | 8 | 20 | — | — | 66 | — | — / — |
| jhk | air | 10 | 6 | 10 | 25 | — | — | 96 | — | — / — |
| The Dismissal (throw) | throw | 5 | 2 | 21 | 27 | KD | — | 90 | 4 | — / — |
| Paparazzi Flash (paparazzi-flash) L | projectile | 20 | 2 | 16 | 37 | +12 | +8 | 61 | 10 | 0.23 / 0.19 |
| Paparazzi Flash (paparazzi-flash) M | projectile | 20 | 2 | 18 | 39 | +10 | +5 | 72 | 10 | 0.23 / 0.19 |
| Paparazzi Flash (paparazzi-flash) H | projectile | 22 | 2 | 19 | 42 | +9 | +4 | 83 | 10 | 0.23 / 0.19 |
| Director's Cut (directors-cut) L | projectile | 17 | 2 | 28 | 46 | -13 | -16 | 132 | 4 | -0.22 / -0.22 |
| Director's Cut (directors-cut) M | projectile | 19 | 2 | 28 | 48 | -13 | -16 | 182 | 4 | -0.25 / -0.29 |
| Director's Cut (directors-cut) H | projectile | 22 | 2 | 28 | 51 | -13 | -16 | 210 | 4 | -0.25 / -0.29 |
| Duende Kick (duende-kick) L | reversal | 4 | 8 | 30 | 41 | KD | -25 | 78 | 10 | — / -0.00 |
| Duende Kick (duende-kick) M | reversal | 6 | 8 | 30 | 43 | KD | -25 | 92 | 10 | — / -0.00 |
| Duende Kick (duende-kick) H | reversal | 9 | 8 | 30 | 46 | KD | -25 | 106 | 10 | — / -0.00 |
| Maestro's Advance (maestros-advance) L | special | 8 | 5 | 22 | 34 | KD | -14 | 70 | 10 | — / 0.21 |
| Maestro's Advance (maestros-advance) M | special | 10 | 5 | 22 | 36 | KD | -14 | 82 | 10 | — / 0.23 |
| Maestro's Advance (maestros-advance) H | special | 13 | 5 | 22 | 39 | KD | -14 | 94 | 10 | — / 0.25 |

Best meterless combo: **17.1%** (2 hits) — `mk > duende-kick(h)`

- ✗ **chp** never-connects: heavy never connects vs a standing mirror (hitbox reach -3px, bodies touch at 88px)

## RJ

| Move | Class | Startup | Active | Recovery | Total | On hit | On block | Dmg | Hitstop | Push hit/blk (CH) |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| lp | light | 6 | 3 | 11 | 19 | +3 | -4 | 45 | 4 | 0.13 / 0.10 |
| mp | medium | 10 | 3 | 16 | 28 | +2 | -4 | 72 | 6 | 0.21 / 0.17 |
| hp | heavy | 13 | 4 | 22 | 38 | KD | -11 | 102 | 9 | — / 0.17 |
| lk | light | 7 | 3 | 12 | 21 | -2 | -5 | 44 | 4 | 0.08 / 0.06 |
| mk | medium | 11 | 4 | 17 | 31 | 0 | -6 | 76 | 6 | 0.21 / 0.17 |
| hk | heavy | 14 | 4 | 22 | 39 | KD | -11 | 106 | 9 | — / 0.17 |
| clp | light | 6 | 3 | 10 | 18 | 0 | -3 | 40 | 4 | 0.08 / 0.06 |
| cmp | medium | 9 | 4 | 15 | 27 | -2 | -9 | 62 | 6 | 0.13 / 0.10 |
| chp | heavy | 11 | 4 | 20 | 34 | -3 | -9 | 90 | 9 | 0.21 / 0.17 |
| clk | light | 7 | 3 | 11 | 20 | -1 | -4 | 40 | 4 | 0.08 / 0.06 |
| cmk | medium | 10 | 4 | 16 | 29 | -3 | -10 | 64 | 6 | 0.13 / 0.10 |
| chk | heavy | 13 | 5 | 23 | 40 | KD | -13 | 92 | 9 | — / 0.17 |
| jlp | air | 5 | 6 | 6 | 16 | — | — | 42 | — | — / — |
| jmp | air | 7 | 6 | 8 | 20 | — | — | 66 | — | — / — |
| jhp | air | 9 | 6 | 10 | 24 | — | — | 94 | — | — / — |
| jlk | air | 6 | 6 | 6 | 17 | — | — | 44 | — | — / — |
| jmk | air | 8 | 6 | 8 | 21 | — | — | 68 | — | — / — |
| jhk | air | 10 | 6 | 10 | 25 | — | — | 98 | — | — / — |
| Evicted (throw) | throw | 5 | 2 | 22 | 28 | KD | — | 92 | 4 | — / — |
| BB Gun (bb-gun) L | projectile | 11 | 2 | 25 | 37 | +1 | -5 | 53 | 10 | 0.21 / 0.17 |
| BB Gun (bb-gun) M | projectile | 13 | 2 | 25 | 39 | +1 | -5 | 62 | 10 | 0.21 / 0.17 |
| BB Gun (bb-gun) H | projectile | 16 | 2 | 25 | 42 | +1 | -5 | 71 | 10 | 0.21 / 0.17 |
| World's Tallest Ghost (tallest-ghost) L | reversal | 4 | 8 | 32 | 43 | KD | -25 | 82 | 10 | — / 0.30 |
| World's Tallest Ghost (tallest-ghost) M | reversal | 6 | 8 | 32 | 45 | KD | -25 | 96 | 10 | — / 0.30 |
| World's Tallest Ghost (tallest-ghost) H | reversal | 9 | 8 | 33 | 49 | KD | -26 | 110 | 10 | — / 0.30 |
| Excavator Charge (excavator-charge) L | special | 13 | 8 | 21 | 41 | KD | -14 | 76 | 10 | — / 0.33 |
| Excavator Charge (excavator-charge) M | special | 13 | 8 | 25 | 45 | KD | -18 | 92 | 10 | — / 0.39 |
| Excavator Charge (excavator-charge) H | special | 13 | 8 | 31 | 51 | KD | -24 | 106 | 10 | — / 0.45 |
| Rattlebones (rattlebones) L | throw | 7 | 3 | 27 | 36 | KD | — | 112 | 10 | — / — |
| Rattlebones (rattlebones) M | throw | 9 | 3 | 31 | 42 | KD | — | 130 | 10 | — / — |
| Rattlebones (rattlebones) H | throw | 12 | 3 | 37 | 51 | KD | — | 148 | 10 | — / — |

Best meterless combo: **18.2%** (2 hits) — `mk > tallest-ghost(h)`

## KUNG FU MAN (benchmark reference)

| Move | Class | Startup | Active | Recovery | Total | On hit | On block | Dmg | Hitstop | Push hit/blk (CH) |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Kung Fu Palm (kung-fu-palm) L | special | 9 | 3 | 22 | 33 | KD | -13 | 90 | 15 | — / 0.16 |
| Kung Fu Palm (kung-fu-palm) M | special | 10 | 3 | 26 | 38 | KD | -17 | 90 | 15 | — / 0.16 |
| Kung Fu Upper (kung-fu-upper) L | special | 4 | 2 | 26 | 31 | -4 | -9 | 52 | 8 | 0.08 / 0.29 |
| Kung Fu Upper (kung-fu-upper) M | special | 5 | 3 | 31 | 38 | -10 | -15 | 57 | 8 | 0.08 / 0.29 |
| Kung Fu Blow (kung-fu-blow) L | special | 14 | 2 | 16 | 31 | +2 | -2 | 100 | 12 | 0.57 / 0.36 |
| Kung Fu Blow (kung-fu-blow) M | special | 18 | 2 | 17 | 36 | +3 | -1 | 125 | 12 | 0.57 / 0.44 |
| Kung Fu Zankou (kung-fu-zankou) L | special | 9 | 4 | 18 | 30 | -5 | -10 | 100 | 12 | 0.52 / 0.52 |
| Kung Fu Zankou (kung-fu-zankou) M | special | 10 | 4 | 21 | 34 | -8 | -13 | 100 | 12 | 0.52 / 0.52 |
| Kung Fu Throw (throw) | throw | 1 | 1 | 21 | 22 | KD | — | 78 | 4 | — / — |
| lp | light | 4 | 4 | 5 | 12 | +2 | -4 | 23 | 8 | 0.16 / 0.16 |
| mp | medium | 9 | 2 | 13 | 23 | +1 | -3 | 57 | 12 | 0.27 / 0.27 |
| lk | light | 5 | 3 | 8 | 15 | +3 | -1 | 26 | 12 | 0.22 / 0.22 |
| mk | medium | 8 | 8 | 10 | 25 | -1 | -6 | 63 | 12 | 0.29 / 0.29 |
| clp | light | 4 | 6 | 3 | 12 | +1 | -4 | 23 | 11 | 0.14 / 0.14 |
| cmp | medium | 5 | 10 | 8 | 22 | -1 | -6 | 37 | 12 | 0.16 / 0.16 |
| clk | light | 5 | 3 | 10 | 17 | -3 | -7 | 28 | 12 | 0.22 / 0.22 |
| cmk | medium | 10 | 4 | 17 | 30 | KD | -11 | 72 | 12 | — / 0.22 |
| jlp | air | 4 | 11 | 3 | 17 | — | — | 20 | — | — / — |
| jmp | air | 7 | 5 | 11 | 22 | — | — | 72 | — | — / — |
| jlk | air | 4 | 15 | 0 | 18 | — | — | 26 | — | — / — |
| jmk | air | 7 | 5 | 7 | 18 | — | — | 70 | — | — / — |

Best meterless combo: **18.5%** (4 hits) — `lp > lk > mk > kung-fu-blow(l)`

