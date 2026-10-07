# 3D renderer spike plan

Goal: prove a Three.js WebGPU presentation path can run beside the current 2D
game without forking the fight rules. The deterministic engine in `src/engine/`
continues to own movement, timing, hitboxes, hurtboxes, projectiles, rounds,
throws, fatalities, CPU input, and training behavior.

The spike should target Three.js r185 (`three@0.185.x`). The r185 package exports
`three/webgpu` for the modern WebGPU renderer and `three/addons/*` for loaders
and tools. Confirm exact inspector imports against the installed package before
writing code; do not copy older WebGL example paths by memory.

## Constraints

- Keep the existing 2D `FightScene` as the default production path.
- Add a dev-only entry such as `?dev=3d`; do not route menu/select into 3D until
  the spike is useful.
- Do not move combat logic into Three objects. Meshes are presentation only.
- No mesh collision. Debug hitboxes must visualize the existing engine boxes.
- The fight remains on a 2D combat plane. 3D depth is visual stage depth.
- GLB/GLTF assets are expected but not currently present in `public/assets`.

## Proposed files

```text
src/scenes/FightScene3D.ts
src/renderer3d/ThreeFightRenderer.ts
src/renderer3d/ThreeStageView.ts
src/renderer3d/ThreeFighterView.ts
src/renderer3d/ThreeHitboxDebug.ts
src/renderer3d/threeCoordinates.ts
src/renderer3d/threeRenderSettings.ts
src/renderer3d/threeAssets.ts
```

`FightScene3D` should be a Phaser scene only because the app already uses Phaser
for boot, input, audio, scene flow, and overlays. Three owns a separate canvas or
DOM element mounted by that scene. The existing Phaser HUD can be reused above
the Three canvas later, but the first spike can start with a minimal debug HUD.

## Dev launch

Extend `src/devLaunch.ts` with `?dev=3d`:

```ts
export function random3dFight(): LaunchTarget {
  return {
    scene: 'Fight3D',
    data: { p1: 'vincent', p2: 'yulia', stage: 'chiba-roof', cpu: true },
  };
}
```

Register `FightScene3D` in `src/main.ts`, but do not touch the default menu,
select, versus, or 2D fight routes.

## Coordinate contract

Current engine constants:

```text
STAGE_W = 960
STAGE_H = 540
FLOOR_Y = 460
STAGE_MIN_X = 50
STAGE_MAX_X = 910
```

Current engine boxes are foot-relative. `Box.x` is facing-relative, `Box.y` is
negative-up from the fighter feet, and `worldBox(f, box)` is the source of truth.

Use this mapping for the spike:

```text
engine X            -> Three X
engine floor        -> Three Y = 0
engine vertical up  -> Three Y
combat lane         -> Three Z = 0
stage depth         -> Three Z negative/positive behind the lane
```

Recommended scale:

```text
WORLD_SCALE = 0.01 meters per engine pixel
Three X = (engineX - STAGE_W / 2) * WORLD_SCALE
Three Y = (FLOOR_Y - engineY) * WORLD_SCALE
Three Z = 0
```

Characters face along +/-X. The camera looks toward the combat lane from
positive Z with a slight downward angle.

## Fighter model contract

Each character GLB should live at:

```text
public/assets/3d/characters/<id>/<id>.glb
```

The model contract:

- Root origin is between the feet at ground contact.
- Neutral standing height matches `CharacterDef.hurtStand.h * WORLD_SCALE`.
- Forward points toward +X in authoring space.
- Animations are root-in-place for X/Z. Engine state controls translation.
- Vertical root motion is also disabled unless explicitly extracted and matched
  to engine jumps, knockdowns, and bounces.
- Feet should contact local Y=0 in idle, walk, crouch, block, and grounded attack
  frames.

Add optional render metadata to character JSON only after the first GLB proves
the contract:

```ts
render3d?: {
  file: string;
  height?: number;
  clips?: Record<string, string>;
}
```

The engine must not read this field.

## Animation mapping

The 2D renderer maps engine actions to sprite cells. The 3D renderer should map
the same actions to animation clips:

```text
idle                 -> idle
walkF                -> walk-forward
walkB                -> walk-back
crouch/prejump       -> crouch
air                  -> jump or fall
landing/getup        -> crouch/getup
hitstun/airHit       -> hit
blockstun            -> block-stand or block-crouch
knockdown            -> knockdown
ko                   -> ko
dazed                -> dazed
attack/airAttack     -> attack/<moveId>
```

For accurate timing, prefer sampling clips from engine tick state instead of
letting animations free-run. For each action:

```text
clip time = action.frame / 60
```

For attacks, resolve the move with `resolveMove(...)` and clamp clip time to the
move's startup + active + recovery length. If a move needs authored anticipation
or follow-through, the clip can be longer, but impact timing must still align to
engine active frames.

## Hitbox and hurtbox visualization

Use the engine's `worldBox` output exactly. Convert each rect to a translucent
3D cuboid with a fixed lane depth:

```text
rect.l/r -> Three X min/max
rect.t/b -> Three Y max/min, using FLOOR_Y - screenY
Z depth  -> +/- 0.18m around the combat lane
```

Debug layers:

- Hurtbox: blue.
- Body/pushbox: white.
- Active hitbox: red/orange.
- Projectile box: yellow.
- Throw range: purple slab.

This preserves the current F1 mental model while making it obvious when a 3D
mesh pose does not match the deterministic gameplay box.

## Stage model contract

Each 3D stage should live at:

```text
public/assets/3d/stages/<stage-id>/stage.glb
```

The 2D stage template used `sky`, `far`, `near`, and `floor` layers. The 3D
equivalent should be named groups inside the GLB:

```text
StageRoot
  Sky
  Far
  Near
  Floor
  Props
  Lights
  SpawnMarkers
```

`Floor` must contain the visual ground plane. Gameplay still uses `FLOOR_Y` and
engine X bounds, so any 3D floor shape is cosmetic unless the engine contract is
changed later.

Optional stage metadata:

```ts
render3d?: {
  file: string;
  camera?: {
    position: [number, number, number];
    target: [number, number, number];
    fov?: number;
    orthographic?: boolean;
  };
  exposure?: number;
  environment?: string;
}
```

For the first playable spike, use an orthographic camera. It preserves fighting
game readability and keeps hitbox overlays visually honest. A low-FOV perspective
camera can be tested later once the GLB proportions are stable.

## Lighting and post

The target look is PBR with strong readability, not a dark cinematic demo.

Baseline setup:

- WebGPU renderer from `three/webgpu`.
- ACES-style tone mapping and sRGB output.
- HDR/EXR/KTX environment lighting per stage once assets exist.
- Large soft key light aimed at the combat lane.
- Fill light from camera side so black outfits still read.
- Rim/back light to separate fighters from the stage.
- Shadow-casting directional light onto the floor.
- Contact shadow helper plane if real shadow maps are too soft or too expensive.

Post stack to evaluate in this order:

1. Ambient occlusion, preferably Three's current WebGPU-compatible AO pass/node.
2. Subtle bloom only for effects, not the whole scene.
3. Color grading/tone mapping controls.
4. Optional depth of field only for non-gameplay cutscenes.

Keep every effect toggleable from the inspector/debug UI. The performance target
is still 60fps.

## Inspector and debug UI

Use the Three.js r185 inspector/addon path after confirming it from the installed
package. The debug UI should expose:

- FPS/frame time.
- Render resolution scale.
- Shadow map size.
- AO on/off and radius/intensity.
- Bloom on/off and strength.
- Tone mapping exposure.
- Key/fill/rim light intensities.
- Hitbox overlay on/off.
- Skeleton overlay on/off.
- Camera preset selection.

If the inspector API is not stable enough for the first pass, keep the controls
isolated in `threeRenderSettings.ts` so replacing the debug UI does not touch
renderer logic.

## Dependency step

Install Three only when beginning the implementation spike:

```sh
npm install three@0.185.1
```

After install, verify imports with the actual package:

```ts
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
```

Then locate the r185 inspector addon path from `node_modules/three/examples/jsm`
or the package's addon barrel export. Do not guess this path.

## Spike sequence

1. Add `three@0.185.1`; inspect WebGPU, GLTFLoader, postprocessing, and inspector
   exports.
2. Add `FightScene3D` behind `?dev=3d` using the same `initialState`, `step`,
   `KeyboardSource`, and `CpuDriver` flow as `FightScene`.
3. Render placeholder capsule/cube fighters and a simple floor using WebGPU.
4. Add 3D hitbox debug cuboids from `worldBox`.
5. Load `public/assets/3d/stages/chiba-roof/stage.glb` when provided.
6. Load one character GLB, scale it to `hurtStand.h`, and place its root at the
   engine foot origin.
7. Add `AnimationMixer` and action-to-clip mapping.
8. Add lighting, shadows, AO, tone mapping, and inspector controls.
9. Decide whether to extract shared fight-loop/presentation events from
   `FightScene` after the spike proves the shape.

## Main risks

- WebGPU and Three r185 APIs are modern but still more volatile than the current
  Phaser path.
- GLB root motion can desync visuals from deterministic engine movement.
- Model scale and foot-origin mistakes will make hitboxes look wrong even when
  the engine is correct.
- Heavy AO/shadows/post can miss the 60fps target quickly.
- Reusing the full Phaser HUD over a Three canvas may need layering cleanup, but
  that should happen after rendering and animation are proven.

## References

- Three r185 package exports, checked with `npm view three@0.185.0 exports`:
  `three/webgpu` and `three/addons/*` are available.
- Three current package version, checked with `npm view three version`:
  `0.185.1`.
- Official Three GLTFLoader source documents GLB/GLTF support for scenes,
  meshes, materials, textures, skins, skeletons, morph targets, animations,
  lights, and cameras:
  https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/loaders/GLTFLoader.js
- Official Three WebGPU examples index:
  https://threejs.org/examples/?q=webgpu

## Post-spike decision: shared fight-loop / presentation events (T13)

Spike verdict — the shape works. What FightScene3D duplicated from
FightScene, and what that says about extraction:

1. **Fixed-timestep loop (accumulator + input poll + step)**: ~25 lines
   duplicated. Worth extracting into a small `FightLoop` helper (owns
   accumulator, KO slow-mo factor, per-tick input polling from
   KeyboardSource/CpuDriver). Low risk, pure win — both scenes shrink.
2. **Presentation events**: FightScene's `presentTick(snapshot)` diffs
   pre/post tick state into sounds, sparks, combo bookkeeping. The 3D scene
   will need the exact same diffing for SFX/VFX parity. Extract a
   `diffTick(prev, next): FightEvent[]` pure function (hits, blocks, KOs,
   projectile spawns/deaths, throws, dizzy) that both presenters consume.
   The 2D scene keeps its Phaser reactions; the 3D scene maps the same
   events to Three effects.
3. **Do NOT extract yet.** FightScene is 1,645 lines and Sprint 19
   (cancels & chains) is about to touch the same code. Sequence the
   extraction AFTER Sprint 19 lands, as its own commit, with the 3D scene
   as the second consumer proving the seam.

What still hurts (candidate work if the spike graduates):
- Attack clips play linearly across startup+active+recovery; per-clip
  `impactNorm` time-warp (already spec'd in clipContract) would snap
  impact frames to engine active frames for authored-feel attacks.
- Walk-speed sync uses a heuristic (3 px/tick baseline); measuring real
  clip stride in gen-mesh and storing it in the GLB report would make
  foot-slide exact.
- Yulia (and the rest of the roster) need the Tripo -> Mixamo -> gen-mesh
  pass; the pipeline is one command per character once the rig FBX exists.
