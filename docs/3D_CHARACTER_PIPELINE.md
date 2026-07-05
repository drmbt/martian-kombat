# 3D character pipeline — Tripo → Mixamo → three (reliable process)

The proven path to a playable 3D fighter, plus every failure mode we hit
and where its cure lives. Everything is automated in `tools/gen-mesh.mjs`
+ `tools/blender_fbx_to_glb.py`; per-rig quirks are MANIFEST FLAGS, never
runtime special-cases.

## The process

1. **Tripo**: generate the character mesh (~20k tris) from the canonical
   art. Download the FBX (or OBJ) with the basecolor texture.
2. **Mixamo**: upload the mesh, auto-rig (T-pose, WITH skin). Download as
   FBX Binary. This is the RIG file.
3. Drop the rig FBX in `public/assets/meshes/<char>/`. If Tripo gave you a
   separate basecolor, keep the unrigged folder next to it.
4. Add a `MESHES` entry in `tools/mesh-manifest.mjs`:
   - `rig`: the FBX filename
   - `basecolor`: path to the texture (only used if the FBX doesn't embed
     a Base Color-wired texture)
   - spread `...BASE_CLIPS` and map the character's five specials
     (`attack/<moveId>`) to clips from `public/assets/animations/`
   - flags below as needed
5. `npm run gen:mesh -- --char <id> --force`
6. Check the coverage report + play `?dev=3d&p1=<id>`. Done.

Animations are SHARED: one Mixamo skeleton fits all rigs. The library
lives in `public/assets/animations/` (subfolders fine — the index is
recursive); per-char overrides go in `meshes/<char>/animations/`.

## Failure modes & cures (all discovered the hard way)

| Symptom in game | Cause | Cure |
|---|---|---|
| Character 4–8× giant | Rig exports meter-scale skin verts under cm nodes; three's skin path ignores the node scale Blender honors | `bakeTransform: true` in the manifest — forces the glTF exporter to bake the armature transform into the skin (a specific rotation chain triggers it; nets out upright facing +X) |
| Faces camera instead of sideways | Rig authored facing +Z (Mixamo default) instead of +X | `forward: 'z'` in the manifest — tool bakes a −90° yaw |
| See-through limbs, inner surfaces visible, garbled face | Newer Mixamo converter wires a texture into material **Alpha** + marks it **BLEND**; three renders the whole character transparent (no depth-write, self-sorting chaos). **Blender workbench ignores alpha-blend — its renders look FINE, do not trust them for this.** | Automatic: `sanitize_materials` forces OPAQUE + severs Alpha links on every rig |
| White/untextured | Stray empty tex-image nodes made the injector skip; exporter sampled nothing | Automatic: basecolor injection checks the actual Base Color LINK |
| Frozen white junk geometry | Tripo exports carry an unskinned dummy mesh | Automatic: unskinned meshes dropped pre-export |
| Slides/turns during clips | Object-level root motion in some Mixamo clips | Automatic: object-level location+rotation fcurves stripped; hips horizontal always stripped, vertical kept for pose |
| Clip targets missing bones (log spam) | Rig lacks fingers the clip animates (Tripo hands vary) | Automatic: unresolvable fcurves removed, logged per clip in the report |

## Debug tools

- `public/dev/glb-viewer.html?glb=<url>&fixnormals=1` — minimal
  WebGL-vs-WebGPU side-by-side viewer, no game code. First stop when a
  model looks wrong: if both backends agree, the GLB is the problem.
- Blender headless render probes live in the session history — but
  remember workbench hides alpha-blend problems.
- In game: F1 hitboxes, F2 skeleton, F3 inspector, F4 settings; dev scene
  is a training sandbox (`?cpu=1` for a live bot, `?p1=/?p2=` cast).
