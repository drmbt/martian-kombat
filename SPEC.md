# SPEC — spikes: 3D renderer + netplay

Source doc: `docs/THREE_D_RENDERER_SPIKE.md` (full prose detail: anim map, lighting, model contract).
Branch: `spike/3d-renderer`.

## §G

Prove Three.js WebGPU presentation path beside 2D game. `src/engine/` keeps owning all fight logic; 3D = presentation only.

Netplay spike: 2-player online versus over WebRTC. Netcode written once (session layer) — ∀ renderers (2D FightScene, 3D FightScene3D, future) inherit w/o duplication.

## §C

- 2D `FightScene` stays default production path.
- 3D dev-only behind `?dev=3d`. Menu/select ⊥ route to 3D.
- Combat logic ∉ Three objects. Meshes presentation only. ⊥ mesh collision.
- Fight stays on 2D combat plane. 3D depth = visual stage depth only.
- `three@0.185.1`: `three/webgpu` + `three/addons/*`. Verify imports vs installed pkg — ⊥ copy old WebGL example paths from memory.
- 60fps on mid laptop or effect doesn't ship on-by-default.
- Vincent source assets ∃ @ `public/assets/meshes/vincent/`: Tripo 20k mesh + `vincent-20k-tripo-mixamo-base-rig.fbx` + ~28 Mixamo clip FBXs in `animations/`. FBX ≠ GLB contract → offline convert+merge step needed (T14). Runtime loads GLB only.
- Clip coverage complete after loose FBXs + Action Adventure Pack + Pro Magic Pack (~130 clips): blocks (Standing Block Start/Idle/End, directional), Crouch Idle + crouch-walk F/B, Walk Backwards, deaths (Knocked Out, Falling/Flying Back Death, Standing React Death ×4), hit reacts (Small/Large ×4-dir, Head Hits), attacks (Lead Jab, Hook, Elbow, Headbutt), magic (1H/2H Cast, Magic Attack 01–05, Area) for specials, transitions (Idle↔Crouch, Land→Idle). V12 fallback chain still guards future chars/clips.
- `?` raw FBX under `public/` vs repo convention (raw → outside `public/`, only game-ready committed to `public/assets`). User placed — flag, not moved.
- Determinism sacred: ⊥ Math.random / wall-clock / render state in `src/engine/`.

Netplay:

- Netcode ∈ `src/net/` + `src/session/` — zero Phaser imports, vitest-able. Scenes ⊥ contain netcode.
- Model: GGPO-style rollback (proper arcade netcode). Predict remote input = repeat last received. Late real input ≠ prediction → restore snapshot @ divergence tick, re-sim to head, same frame. Small local input delay (D=1–2, configurable) shrinks rollback frequency. Stall only when rollback window W (~10 ticks) exceeded.
- Snapshots ∈ session layer (`structuredClone` ring buffer, W deep) — engine stays pure, ⊥ snapshot code in `src/engine/`.
- Rollback perf ! budgeted: worst case = W re-steps + 1 snapshot per frame. `step` is cheap; ! measure, < 2ms mid laptop else shrink W.
- Transport: WebRTC DataChannel. Signaling: peerjs cloud broker (room codes, zero infra) — DECIDED 2026-07-04. Self-hosted peer-server = later option, ⊥ spike scope.
- Engine gains pure helpers only (`unpackInput`, `hashState`) — `step` signature untouched, still sync pure fn.
- Cross-browser float determinism: engine ⊥ impl-varying Math ops (trig/pow) — audit in T35, `?` currently clean.
- Local 2D versus stays default path. Netplay behind menu "ONLINE" entry + `?dev=net` dev route.
- Reuse existing seams, ⊥ reinvent: tick events = `src/presentation/tickEvents.ts` diffTick; HUD = existing patterns (2D FightScene HUD, 3D `src/renderer3d/hud/` component classes build/update/dispose); lobby nav = `src/input/menu-nav.ts` gamepad poller + select-screen assets/portraits; scene routing = `main.ts` scene registry + `devLaunch.ts`.
- Net state ! always user-visible: lobby shows connect lifecycle (idle → signaling → connecting → connected \| failed w/ reason); in-fight persistent compact indicator (ping + quality color green/yellow/red) + prominent overlays for stall ("CONNECTION…" past W), desync halt, opponent disconnect → forfeit prompt.

## §I

- url: `?dev=3d` → scene `Fight3D` {p1:'vincent', p2:'yulia', stage:'chiba-roof', cpu:true} via `random3dFight()` in `src/devLaunch.ts`
- files: `src/scenes/FightScene3D.ts`; `src/renderer3d/` → `ThreeFightRenderer.ts`, `ThreeStageView.ts`, `ThreeFighterView.ts`, `ThreeHitboxDebug.ts`, `threeCoordinates.ts`, `threeRenderSettings.ts`, `threeAssets.ts`
- dep: `npm install three@0.185.1`
- asset: `public/assets/3d/characters/<id>/<id>.glb`; `public/assets/3d/stages/<stage-id>/stage.glb` (named groups: StageRoot/Sky/Far/Near/Floor/Props/Lights/SpawnMarkers)
- asset-src: `public/assets/meshes/vincent/` → rig FBX + `animations/*.fbx` + `animations/Action Adventure Pack.zip` (22 more clips, unzip before T14) — input to T14 conversion, ⊥ runtime-loaded
- data: char JSON optional `render3d?: {file, height?, clips?}` — add only after first GLB proves contract
- coords: `WORLD_SCALE = 0.01` m/px; `Three X = (engineX - STAGE_W/2) * WORLD_SCALE`; `Three Y = (FLOOR_Y - engineY) * WORLD_SCALE`; combat lane Z=0; engine constants STAGE_W=960 STAGE_H=540 FLOOR_Y=460 STAGE_MIN_X=50 STAGE_MAX_X=910

Netplay:

- files: `src/session/FightSession.ts` (shared loop driver, local impl), `src/session/NetSession.ts` (lockstep impl), `src/net/transport.ts` (iface + `LoopbackTransport`), `src/net/webrtc.ts`, `src/scenes/LobbyScene.ts`
- url: `?dev=net` → LobbyScene direct
- menu: "ONLINE" → LobbyScene. Host: show room code + copy btn. Join: code input. Each side picks own char (reuse select-screen assets). Host = slot 0 (P1).
- dep: `peerjs` (cloud broker signaling)
- wire msgs (JSON over DataChannel, packed-number inputs): `{t:'hello', proto, charHash, charId, name}` \| `{t:'start', rules, stage, chars, delay}` \| `{t:'input', tick, frames:[…last-8 packed]}` \| `{t:'hash', tick, h}` \| `{t:'resync', tick, state}` (full GameState, host→guest on rejoin) \| `{t:'bye', reason}`

## §V

V1: `src/engine/` sole owner movement/timing/boxes/rounds — 3D renderer read-only vs state.
V2: `worldBox(f, box)` source of truth ∀ debug cuboids — ⊥ re-derived geometry. Colors: hurt blue, push white, hit red/orange, projectile yellow, throw purple. Lane depth ±0.18m.
V3: engine ⊥ read `render3d` field.
V4: clip time = `action.frame / 60` — clips tick-sampled, ⊥ free-run.
V5: attack clip time clamped to startup+active+recovery via `resolveMove(...)`; impact aligns to engine active frames.
V6: GLB root-in-place X/Z — engine state controls translation. Vertical root motion off unless explicitly matched to engine jumps/knockdowns/bounces.
V7: 2D routes (menu/select/versus/2D fight, `main.ts` defaults) untouched.
V8: 60fps holds with enabled effects — else effect defaults off.
V9: model root origin between feet @ ground contact; standing height = `hurtStand.h * WORLD_SCALE`; feet @ local Y=0 in grounded poses.
V10: ~~ortho first~~ AMENDED 2026-07-04: GLB proportions proven → low-FOV perspective default (real 3D parallax + camera follow/dolly on fighter midpoint+separation). Ortho stays as `camera: ortho` preset for hitbox-honest debugging.
V11: ∀ post/light controls toggleable from debug UI (`threeRenderSettings.ts` isolates controls from renderer logic).
V12: contract clip set + fallback chain defined once (data map, ⊥ scattered ifs). Lookup: exact clip → chain fallback → idle. Missing clip ⊥ crash, ⊥ T-pose, ⊥ silent — debug HUD shows active clip name + `PLACEHOLDER` flag. Fill-in later = drop clip w/ contract name into T14 input, rerun, no code change.
V14: visual ground = engine ground, enforced not hoped. Stage GLB `Floor` group top surface auto-shifted to world Y=0 (`FLOOR_Y`) on load. Grounded fighters: lowest skeleton bone snapped to fighter ground per frame (clip hip-height drift ⊥ float, ⊥ poke-through). Airborne kinds (air/airAttack/airHit): no snap — engine owns arc.
V15: presentation parity w/o asset duplication. 3D reuses: `play`/`playVoice` (BootScene), `playMusic` (audio/music.ts), portrait pngs (`assets/portraits/`), spark pngs (`assets/vfx/`), per-move overlay pngs (`vfx-<char>-<move>`), projectile pngs (`assets/sprites/<id>/projectile*.png`). Event detection = pure `diffTick` in `src/presentation/` (vitest) — 2D FightScene migrates onto it post-Sprint-19, ⊥ touch now (V7).
V16: gore greenlit (legal ✓). Blood spray per hit: direction = knockback dir (attacker facing), volume ∝ damage; KO/heavy → gush. Renderer-side only; tick-hashed seeds, ⊥ engine RNG.
V17: exactly one fight-loop driver (`FightSession`): accumulator, input gather (KeyboardSource/CpuDriver/remote), `step` call, koSlow pacing ∈ session — scenes (2D & 3D) ⊥ own step loops.
V18: session API renderer-agnostic: scene feeds deltaMs + local `InputFrame`, reads state + tick count. Net vs local = session impl swap; scene code identical.
V19: ~~lockstep stall~~ AMENDED 2026-07-04 → rollback: sim head runs on predicted remote inputs (predict = last received). Real input arrives ≠ prediction → rewind to divergence, re-sim to head within same render frame. Stall ONLY when head − confirmedTick > W. ⊥ freeze on ordinary jitter.
V20: desync ⊥ silent: `hashState` exchanged every 60 CONFIRMED ticks (both real inputs known — ⊥ hash predicted ticks); mismatch → halt match, loud overlay, log both hashes + tick.
V21: handshake ! verify {proto version, char-data hash} before start; mismatch → refuse w/ shown reason.
V22: net input = packed number (`packInput` format) + tick id; ⊥ InputFrame objects on wire. ∀ input packets carry last-8 redundancy (loss tolerance w/o resend round-trip).
V23: online: pause ⊥ stops sim (overlay only); disconnect handling per V27 (grace window + rejoin, ⊥ instant forfeit).
V24: rollback invisible to renderers: scene sees latest head state + tick-keyed event stream. Events (sfx/vfx/announcer) fire ONCE per tick — re-sim after rollback ⊥ re-fires already-presented ticks (mispredicted events accepted, standard rollback artifact). Health bars/HUD read live state → self-correct free.
V25: confirmed sim ≡ offline sim: given same input log, NetSession confirmed states hash-equal to plain step() replay (rollback machinery ⊥ leaks into outcomes).
V26: timesync: sides measure ahead/behind via tick delta in input packets; ahead side eases pacing (skip-frame style) — one-sided rollback pileup ⊥ grows unbounded.
V27: connection loss ≠ instant forfeit: sim freezes, grace window (~20s) w/ visible countdown overlay; dropped peer rejoins same room id → handshake re-verifies (V21) → host sends authoritative `resync` (full state @ tick, guest's local timeline discarded) → both resume. Grace expiry → forfeit prompt. Host authoritative on rejoin, ⊥ merge.
V13: anim transitions crossfade, ⊥ pose-snap. Clip classes in `clipContract.ts`: loop (phase = frame/60 % dur, walk timeScale ∝ walkSpeed), window (attacks: timeScale fits startup+active+recovery, optional `impactNorm` warp keeps impact on active frames), oneshot (natural speed, clamp). Pair-class fade table (ticks) data-driven. ∀ weights/times = fn(tick state) — mixer ⊥ free-run (`mixer.update(0)`), renderer-side transition record OK, engine untouched.

## §T

id|status|task|cites
T1|x|install `three@0.185.1`; inspect real webgpu/GLTFLoader/post/inspector export paths, note in code|I.dep
T2|x|`threeCoordinates.ts` engine→Three mapping + vitest|I.coords
T3|x|`FightScene3D` skeleton, register `Fight3D` in `src/main.ts`, `?dev=3d` + `random3dFight()` in `devLaunch.ts`|I.url,V7
T4|x|drive scene from same `initialState`/`step`/`KeyboardSource`/`CpuDriver` flow as `FightScene`|V1
T5|x|WebGPU renderer + ortho camera + placeholder capsule fighters + simple floor|V10
T6|x|`ThreeHitboxDebug`: cuboids from `worldBox`, color-coded, ±0.18m depth, toggle|V2
T7|x|`threeAssets.ts`: stage GLB load (`chiba-roof`), graceful skip when file ∄|I.asset
T8|x|char GLB load (vincent): scale to `hurtStand.h`, foot origin|V9,V6
T9|x|`AnimationMixer` + action→clip map (per doc table), tick-sampled; V13 crossfade + clip classes; missing clip → V12 fallback chain|V4,V5,V12,V13
T10|x|lighting: key/fill/rim + shadow dir light + ACES tone mapping + sRGB|V8
T11|x|post stack in order AO → bloom → grading, each toggleable|V8,V11
T12|x|debug UI `threeRenderSettings.ts`: fps, res scale, shadow size, AO, bloom, exposure, light intensities, hitbox/skeleton toggles, camera presets|V11
T13|x|writeup: extract shared fight-loop/presentation events from `FightScene`? decision only, no refactor|V7
T14|x|`tools/` convert script: vincent rig FBX + Mixamo clip FBXs → `public/assets/3d/characters/vincent/vincent.glb`, clips renamed per anim map, in-place root verified/stripped, idempotent + `--force` (tool: Blender headless \| FBX2glTF `?`)|I.asset,V6,V9
T15|x|clip-name map Mixamo→contract (Fight Idle→idle, Punching→attack/punch, Fireball→attack/fireball, Jumping Up→jump, Falling Idle→fall, hits→hit, Stunned→dazed, Fallen Idle→knockdown, Taunt→win) — lives in T14 script config|V4
T16|x|T14 emits clip coverage report: contract clips present \| missing \| fallback-mapped per char; T12 debug HUD shows active clip + `PLACEHOLDER` flag|V12
T17|x|`src/presentation/tickEvents.ts`: pure snapshot + `diffTick` → typed events (hit/block/attackStart/jump/dust/bounce/projectile-spawn/throw/phase cues) + vitest|V15
T18|x|Fight3D audio parity: `playMusic` stage contexts, announcer cues, s-hit/block/whoosh/jump/projectile, hurt/kiai voices — existing helpers only|V15
T19|x|Fight3D DOM HUD parity: portraits, health+ghost bars, timer, win pips, combo counter — `<img>` from existing pngs|V15
T20|x|`ThreeFxSystem`: additive billboard quads — spark-hit/heavy/block tinted attacker color, per-move overlay art (impact\|ground anchor)|V15
T21|x|mesh impact feedback: victim emissive flash (counter = red, longer) + camera shake (render offset, ⊥ gameplay coords)|V15
T22|x|blood: instanced particle spray per hit — cone toward impact velocity, gravity, floor kill; volume ∝ damage; KO gush|V16
T23|x|3D projectiles: billboard pool from `proj-*` textures (moveId→texture fallback like 2D), additive glow + PointLight, driven by `state.projectiles`|V15
T25|x|fps audit w/ full stack (AO+bloom+2 shadow lamps) via CDP `game.loop.actualFps`; document; degrade defaults if <60|V8
T26|x|clip `impactNorm` piecewise warp in `clipTimeSec` + vitest; per-clip values in clipContract.json for vincent attack clips|V13,V5
T27|x|fatality + win parity: fatality phase → DOM panel overlay cycling `assets/fatalities/<char>/<id>-<n>.jpg` (count = char JSON `fatality.panels`); matchEnd → win overlay (winner portrait, loser `-ko.png`, random `winQuotes`); dizzy stars billboard|V15
T24|x|parallax + mood: perspective cam follow (x=midpoint lerp, dolly ∝ separation, clamp) replicating 2D layer-factor feel via real depth; night street placeholder stage (building rows @ staggered depth, street lamps w/ warm pools, dim key/ambient); projectile glow quad + light illuminate env+chars; bloom default on (V8 fps watch)|V10,V8,V16

T28|x|directional hit reactions: hitstun clip picked by attacker side vs victim facing (hit-front/hit-back + fallbacks), pure fn + vitest; GLB gains React From Front/Back clips|V12,V13
T29|x|HUD componentization: `src/renderer3d/hud/` — FightHud, WinOverlay, FatalityOverlay classes (build/update/dispose), FightScene3D keeps wiring only|V15
T30|x|blend-glitch pass: action RESTART detection (same moveId re-trigger resets elapsed via frame counter direction), ⊥ mid-fade pops|V13
T31|x|uppercut: `Uppercut.fbx` arrived → `attack/rising-glyph` remapped (stripY, impactNorm 0.4) + regen|V12

T32|x|taunt button (T): renderer-side gesture override while idle, ⊥ engine change; variant shuffle system (`name#N` clips, tick-hash latch per action instance) spreads Lead Jab×3/Hook×2/Elbow×2, reaction flavors, taunts×3|V1,V12
T33|x|dash stocks: engine `dashStocks`/`dashRegen` (2 stocks, 150-tick regen) gate the existing double-tap impulse + 4 vitests; HUD ◆ pips w/ recharge fade; dash-forward/back clips read off vx|V1,V15
T34|x|extract `FightSession` (local impl): accumulator, KeyboardSource/CpuDriver gather, `step`, koSlow pacing; FightScene + FightScene3D consume it; behavior unchanged (executes T13 decision)|V17,V18
T35|x|engine pure helpers: `unpackInput(n)` + `hashState(s)` (FNV over numeric core: tick, phase, fighters x/y/vx/vy/health/action.kind+frame, wins, timer, projectiles) + vitests; audit engine for impl-varying Math ops|V20
T36|x|`src/net/transport.ts`: Transport iface (send/onMessage/onStatus) + `LoopbackTransport` w/ latency+jitter sim + vitest|V18
T37|x|`NetSession` rollback core: snapshot ring (W=10, `structuredClone`), predict remote = last input, confirmedTick tracking, mispredict → restore + re-sim to head, input delay D=1–2, stall past W, hash exchange on confirmed ticks; vitest loopback pair w/ latency+jitter: converges, confirmed hashes equal, V25 replay-equivalence|V19,V20,V22,V25
T38|x|WebRTC transport `src/net/webrtc.ts`: host/join, DataChannel wiring, signaling per §C decision|V18
T39|~|`LobbyScene`: host → room code display + copy; join → code entry; per-side char pick; ready → hello/start handshake → launch Fight w/ NetSession|V21
T40|.|scenes accept injected session; online: pause = overlay only, disconnect → V27 grace/rejoin flow, rematch handshake|V23,V27,V7
T41|.|net UI: lobby connect-lifecycle states w/ failure reasons; in-fight compact indicator (ping + green/yellow/red quality) via existing HUD component pattern; stall overlay past W; debug detail (rollback count/depth, delay D, ahead/behind) behind toggle|V20,V26,V24
T42|.|desync harness: two full sessions over loopback, inject forced divergence, assert detect ≤ 60 confirmed ticks|V20
T43|.|perf audit: worst-case W re-steps + snapshot per frame measured, < 2ms mid laptop else shrink W; 3D route works w/ NetSession unmodified (proof of V18)|V8,V18
T44|.|tick-keyed event stream: session emits `tickEvents` diffs w/ tick ids, fire-once dedupe across re-sims, both scenes consume stream instead of own diffing; vitest (rollback ⊥ double-fire, ⊥ skip confirmed-only events)|V24
T45|.|timesync: tick-delta from input packets → ahead side pacing ease (drop ~1 tick per interval); vitest converging drift|V26
T46|.|rejoin: transport reconnect events (peerjs room persists), `NetSession.resync()` (adopt host state, clear input/snapshot buffers, resume), grace-window freeze + countdown UI, expiry → forfeit; vitest: kill transport mid-match, reattach, timelines converge|V27,V21
## §B

id|date|cause|fix
