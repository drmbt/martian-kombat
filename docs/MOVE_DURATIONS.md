# Move Durations

Generated from `src/data/characters/*.json`. The engine runs at 60 fps, so
milliseconds are `frames * 1000 / 60`. `Action` is the move's active/action
window: contact window for strikes/grabs, and spawn/action window for projectile
or field specials. Strength rows include the same L/M/H variant merge used by
`resolveMove()` in `src/engine/step.ts`.

## Vincent

| Move | Startup | Action | Recovery | Total | Total ms |
|---|---:|---:|---:|---:|---:|
| st.LP | 4 | 3 | 9 | 16 | 266.7 |
| st.MP | 7 | 3 | 13 | 23 | 383.3 |
| st.HP | 9 | 4 | 17 | 30 | 500.0 |
| st.LK | 5 | 3 | 10 | 18 | 300.0 |
| st.MK | 9 | 4 | 16 | 29 | 483.3 |
| st.HK | 12 | 4 | 20 | 36 | 600.0 |
| cr.LP | 4 | 3 | 9 | 16 | 266.7 |
| cr.MP | 7 | 4 | 14 | 25 | 416.7 |
| cr.HP | 10 | 5 | 18 | 33 | 550.0 |
| cr.LK | 5 | 3 | 11 | 19 | 316.7 |
| cr.MK | 8 | 4 | 16 | 28 | 466.7 |
| cr.HK | 8 | 4 | 19 | 31 | 516.7 |
| j.LP | 4 | 6 | 8 | 18 | 300.0 |
| j.MP | 6 | 6 | 10 | 22 | 366.7 |
| j.HP | 8 | 7 | 12 | 27 | 450.0 |
| j.LK | 4 | 6 | 8 | 18 | 300.0 |
| j.MK | 6 | 7 | 10 | 23 | 383.3 |
| j.HK | 9 | 7 | 12 | 28 | 466.7 |
| Sigil Bolt L | 13 | 2 | 24 | 39 | 650.0 |
| Sigil Bolt M | 13 | 2 | 24 | 39 | 650.0 |
| Sigil Bolt H | 13 | 2 | 24 | 39 | 650.0 |
| Cloud Hands L | 9 | 6 | 14 | 29 | 483.3 |
| Cloud Hands M | 9 | 10 | 18 | 37 | 616.7 |
| Cloud Hands H | 9 | 10 | 22 | 41 | 683.3 |
| Rising Glyph L | 5 | 8 | 18 | 31 | 516.7 |
| Rising Glyph M | 5 | 8 | 24 | 37 | 616.7 |
| Rising Glyph H | 5 | 8 | 30 | 43 | 716.7 |
| Redirect L | 4 | 10 | 10 | 24 | 400.0 |
| Redirect M | 4 | 14 | 12 | 30 | 500.0 |
| Redirect H | 4 | 22 | 16 | 42 | 700.0 |

## Yulia

| Move | Startup | Action | Recovery | Total | Total ms |
|---|---:|---:|---:|---:|---:|
| st.LP | 5 | 3 | 10 | 18 | 300.0 |
| st.MP | 8 | 3 | 14 | 25 | 416.7 |
| st.HP | 11 | 4 | 19 | 34 | 566.7 |
| st.LK | 4 | 3 | 9 | 16 | 266.7 |
| st.MK | 9 | 4 | 16 | 29 | 483.3 |
| st.HK | 12 | 4 | 20 | 36 | 600.0 |
| cr.LP | 5 | 3 | 9 | 17 | 283.3 |
| cr.MP | 7 | 4 | 14 | 25 | 416.7 |
| cr.HP | 10 | 5 | 19 | 34 | 566.7 |
| cr.LK | 5 | 3 | 10 | 18 | 300.0 |
| cr.MK | 8 | 4 | 16 | 28 | 466.7 |
| cr.HK | 9 | 4 | 20 | 33 | 550.0 |
| j.LP | 4 | 6 | 8 | 18 | 300.0 |
| j.MP | 6 | 6 | 10 | 22 | 366.7 |
| j.HP | 8 | 7 | 12 | 27 | 450.0 |
| j.LK | 4 | 6 | 8 | 18 | 300.0 |
| j.MK | 6 | 7 | 10 | 23 | 383.3 |
| j.HK | 9 | 7 | 12 | 28 | 466.7 |
| Cossack Spiral L | 8 | 8 | 16 | 32 | 533.3 |
| Cossack Spiral M | 10 | 8 | 20 | 38 | 633.3 |
| Cossack Spiral H | 12 | 8 | 24 | 44 | 733.3 |
| Backbend Guillotine L | 11 | 5 | 22 | 38 | 633.3 |
| Backbend Guillotine M | 14 | 5 | 22 | 41 | 683.3 |
| Backbend Guillotine H | 17 | 5 | 22 | 44 | 733.3 |
| Volga Piledriver L | 5 | 4 | 28 | 37 | 616.7 |
| Volga Piledriver M | 6 | 4 | 28 | 38 | 633.3 |
| Volga Piledriver H | 8 | 4 | 32 | 44 | 733.3 |
| Braid Lariat | 4 | 24 | 14 | 42 | 700.0 |

## Catherine

| Move | Startup | Action | Recovery | Total | Total ms |
|---|---:|---:|---:|---:|---:|
| st.LP | 6 | 3 | 11 | 20 | 333.3 |
| st.MP | 9 | 3 | 15 | 27 | 450.0 |
| st.HP | 12 | 4 | 21 | 37 | 616.7 |
| st.LK | 5 | 3 | 10 | 18 | 300.0 |
| st.MK | 9 | 4 | 17 | 30 | 500.0 |
| st.HK | 13 | 4 | 21 | 38 | 633.3 |
| cr.LP | 6 | 3 | 11 | 20 | 333.3 |
| cr.MP | 8 | 4 | 15 | 27 | 450.0 |
| cr.HP | 11 | 5 | 19 | 35 | 583.3 |
| cr.LK | 6 | 3 | 12 | 21 | 350.0 |
| cr.MK | 9 | 4 | 17 | 30 | 500.0 |
| cr.HK | 10 | 4 | 22 | 36 | 600.0 |
| j.LP | 5 | 6 | 8 | 19 | 316.7 |
| j.MP | 7 | 6 | 10 | 23 | 383.3 |
| j.HP | 9 | 7 | 12 | 28 | 466.7 |
| j.LK | 5 | 6 | 8 | 19 | 316.7 |
| j.MK | 7 | 7 | 10 | 24 | 400.0 |
| j.HK | 10 | 7 | 12 | 29 | 483.3 |
| Mise en Place L | 9 | 2 | 20 | 31 | 516.7 |
| Mise en Place M | 11 | 2 | 20 | 33 | 550.0 |
| Mise en Place H | 13 | 2 | 20 | 35 | 583.3 |
| Order Up! L | 12 | 2 | 24 | 38 | 633.3 |
| Order Up! M | 12 | 2 | 24 | 38 | 633.3 |
| Order Up! H | 12 | 2 | 24 | 38 | 633.3 |
| Staff Vault L | 6 | 2 | 8 | 16 | 266.7 |
| Staff Vault M | 6 | 2 | 8 | 16 | 266.7 |
| Staff Vault H | 6 | 2 | 8 | 16 | 266.7 |
| 86'd L | 7 | 4 | 26 | 37 | 616.7 |
| 86'd M | 8 | 4 | 26 | 38 | 633.3 |
| 86'd H | 10 | 4 | 26 | 40 | 666.7 |

## Kirby

| Move | Startup | Action | Recovery | Total | Total ms |
|---|---:|---:|---:|---:|---:|
| st.LP | 3 | 3 | 8 | 14 | 233.3 |
| st.MP | 6 | 3 | 12 | 21 | 350.0 |
| st.HP | 9 | 4 | 16 | 29 | 483.3 |
| st.LK | 4 | 3 | 9 | 16 | 266.7 |
| st.MK | 7 | 4 | 14 | 25 | 416.7 |
| st.HK | 9 | 5 | 17 | 31 | 516.7 |
| cr.LP | 4 | 3 | 8 | 15 | 250.0 |
| cr.MP | 6 | 4 | 13 | 23 | 383.3 |
| cr.HP | 9 | 5 | 17 | 31 | 516.7 |
| cr.LK | 4 | 3 | 10 | 17 | 283.3 |
| cr.MK | 7 | 4 | 15 | 26 | 433.3 |
| cr.HK | 8 | 4 | 19 | 31 | 516.7 |
| j.LP | 3 | 6 | 7 | 16 | 266.7 |
| j.MP | 5 | 6 | 9 | 20 | 333.3 |
| j.HP | 7 | 7 | 11 | 25 | 416.7 |
| j.LK | 3 | 6 | 7 | 16 | 266.7 |
| j.MK | 5 | 7 | 9 | 21 | 350.0 |
| j.HK | 8 | 7 | 11 | 26 | 433.3 |
| Scalding Sip | 11 | 2 | 20 | 33 | 550.0 |

## Flo

| Move | Startup | Action | Recovery | Total | Total ms |
|---|---:|---:|---:|---:|---:|
| st.LP | 5 | 3 | 11 | 19 | 316.7 |
| st.MP | 9 | 3 | 15 | 27 | 450.0 |
| st.HP | 12 | 4 | 20 | 36 | 600.0 |
| st.LK | 5 | 3 | 10 | 18 | 300.0 |
| st.MK | 10 | 4 | 17 | 31 | 516.7 |
| st.HK | 13 | 4 | 21 | 38 | 633.3 |
| cr.LP | 5 | 3 | 10 | 18 | 300.0 |
| cr.MP | 8 | 4 | 15 | 27 | 450.0 |
| cr.HP | 10 | 5 | 20 | 35 | 583.3 |
| cr.LK | 5 | 3 | 11 | 19 | 316.7 |
| cr.MK | 9 | 4 | 17 | 30 | 500.0 |
| cr.HK | 10 | 4 | 21 | 35 | 583.3 |
| j.LP | 4 | 6 | 8 | 18 | 300.0 |
| j.MP | 6 | 6 | 10 | 22 | 366.7 |
| j.HP | 8 | 7 | 12 | 27 | 450.0 |
| j.LK | 4 | 6 | 8 | 18 | 300.0 |
| j.MK | 6 | 7 | 10 | 23 | 383.3 |
| j.HK | 9 | 7 | 12 | 28 | 466.7 |
| sudo kill L | 12 | 2 | 24 | 38 | 633.3 |
| sudo kill M | 12 | 2 | 24 | 38 | 633.3 |
| sudo kill H | 12 | 2 | 28 | 42 | 700.0 |
| Fork Bomb L | 13 | 2 | 22 | 37 | 616.7 |
| Fork Bomb M | 13 | 2 | 22 | 37 | 616.7 |
| Fork Bomb H | 13 | 2 | 22 | 37 | 616.7 |
| Smokescreen L | 15 | 2 | 20 | 37 | 616.7 |
| Smokescreen M | 15 | 2 | 20 | 37 | 616.7 |
| Smokescreen H | 15 | 2 | 20 | 37 | 616.7 |
| Root Access L | 12 | 2 | 24 | 38 | 633.3 |
| Root Access M | 12 | 2 | 24 | 38 | 633.3 |
| Root Access H | 12 | 2 | 24 | 38 | 633.3 |

## Marzipan

| Move | Startup | Action | Recovery | Total | Total ms |
|---|---:|---:|---:|---:|---:|
| st.LP | 6 | 3 | 11 | 20 | 333.3 |
| st.MP | 9 | 3 | 15 | 27 | 450.0 |
| st.HP | 12 | 4 | 20 | 36 | 600.0 |
| st.LK | 5 | 3 | 10 | 18 | 300.0 |
| st.MK | 10 | 4 | 16 | 30 | 500.0 |
| st.HK | 13 | 4 | 21 | 38 | 633.3 |
| cr.LP | 5 | 3 | 10 | 18 | 300.0 |
| cr.MP | 8 | 4 | 15 | 27 | 450.0 |
| cr.HP | 10 | 5 | 20 | 35 | 583.3 |
| cr.LK | 5 | 3 | 10 | 18 | 300.0 |
| cr.MK | 9 | 4 | 16 | 29 | 483.3 |
| cr.HK | 10 | 6 | 22 | 38 | 633.3 |
| j.LP | 4 | 6 | 8 | 18 | 300.0 |
| j.MP | 6 | 6 | 10 | 22 | 366.7 |
| j.HP | 8 | 7 | 12 | 27 | 450.0 |
| j.LK | 4 | 6 | 8 | 18 | 300.0 |
| j.MK | 6 | 7 | 10 | 23 | 383.3 |
| j.HK | 9 | 7 | 12 | 28 | 466.7 |
| Symbiosis L | 7 | 4 | 30 | 41 | 683.3 |
| Symbiosis M | 8 | 4 | 30 | 42 | 700.0 |
| Symbiosis H | 10 | 4 | 34 | 48 | 800.0 |
| Overgrowth L | 14 | 2 | 22 | 38 | 633.3 |
| Overgrowth M | 14 | 2 | 22 | 38 | 633.3 |
| Overgrowth H | 14 | 2 | 22 | 38 | 633.3 |
| Spore Bloom L | 16 | 2 | 22 | 40 | 666.7 |
| Spore Bloom M | 16 | 2 | 22 | 40 | 666.7 |
| Spore Bloom H | 16 | 2 | 22 | 40 | 666.7 |
