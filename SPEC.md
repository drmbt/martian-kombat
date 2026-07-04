# SPEC — 3D renderer spike

Source doc: `docs/THREE_D_RENDERER_SPIKE.md` (full prose detail: anim map, lighting, model contract).
Branch: `spike/3d-renderer`.

## §G

Prove Three.js WebGPU presentation path beside 2D game. `src/engine/` keeps owning all fight logic; 3D = presentation only.

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

## §I

- url: `?dev=3d` → scene `Fight3D` {p1:'vincent', p2:'yulia', stage:'chiba-roof', cpu:true} via `random3dFight()` in `src/devLaunch.ts`
- files: `src/scenes/FightScene3D.ts`; `src/renderer3d/` → `ThreeFightRenderer.ts`, `ThreeStageView.ts`, `ThreeFighterView.ts`, `ThreeHitboxDebug.ts`, `threeCoordinates.ts`, `threeRenderSettings.ts`, `threeAssets.ts`
- dep: `npm install three@0.185.1`
- asset: `public/assets/3d/characters/<id>/<id>.glb`; `public/assets/3d/stages/<stage-id>/stage.glb` (named groups: StageRoot/Sky/Far/Near/Floor/Props/Lights/SpawnMarkers)
- asset-src: `public/assets/meshes/vincent/` → rig FBX + `animations/*.fbx` + `animations/Action Adventure Pack.zip` (22 more clips, unzip before T14) — input to T14 conversion, ⊥ runtime-loaded
- data: char JSON optional `render3d?: {file, height?, clips?}` — add only after first GLB proves contract
- coords: `WORLD_SCALE = 0.01` m/px; `Three X = (engineX - STAGE_W/2) * WORLD_SCALE`; `Three Y = (FLOOR_Y - engineY) * WORLD_SCALE`; combat lane Z=0; engine constants STAGE_W=960 STAGE_H=540 FLOOR_Y=460 STAGE_MIN_X=50 STAGE_MAX_X=910

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

## §B

id|date|cause|fix
