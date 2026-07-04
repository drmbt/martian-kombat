# Blender headless: Mixamo rig FBX + clip FBXs -> one GLB with named clips.
# Invoked by tools/gen-mesh.mjs:
#   Blender --background --factory-startup --python tools/blender_fbx_to_glb.py -- job.json
#
# job.json: { "rig": path, "basecolor": path|null, "out": path,
#             "report": path, "clips": [{ "name", "file", "stripY" }] }
#
# Root motion: horizontal hips travel is ALWAYS stripped (the engine owns
# translation — SPEC V6); vertical is kept for pose (crouch, knockdown) unless
# the clip says stripY. The vertical bone-local channel is derived from the
# rig's rest pose, not hardcoded.
import json
import re
import sys

import bpy

BONE_RE = re.compile(r'pose\.bones\["([^"]+)"\]')


def fail(msg):
    print(f"BLENDER-FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def import_fbx(path, use_anim):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, use_anim=use_anim)
    return [o for o in bpy.data.objects if o not in before]


def find_armature(objs):
    for o in objs:
        if o.type == 'ARMATURE':
            return o
    return None


def ensure_basecolor(meshes, image_path):
    """Give untextured materials a Principled+basecolor so the GLB isn't grey."""
    if not image_path:
        return False
    img = None
    applied = False
    for mesh in meshes:
        for slot in mesh.material_slots:
            mat = slot.material
            if mat is None:
                continue
            mat.use_nodes = True
            nodes = mat.node_tree.nodes
            if any(n.type == 'TEX_IMAGE' and n.image for n in nodes):
                continue
            principled = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if principled is None:
                continue
            if img is None:
                img = bpy.data.images.load(image_path)
            tex = nodes.new('ShaderNodeTexImage')
            tex.image = img
            mat.node_tree.links.new(tex.outputs['Color'], principled.inputs['Base Color'])
            applied = True
    return applied


def vertical_channel(arm, hips_name):
    """Bone-local axis index whose armature-space direction is most vertical."""
    m = arm.data.bones[hips_name].matrix_local
    return max(range(3), key=lambda i: abs(m[2][i]))


def remap_bone_paths(action, rig_bones):
    """Point fcurves at the rig's bone names when only the prefix differs.
    Curves for bones the rig simply doesn't have (e.g. Mixamo pinkies on a
    four-fingered Tripo rig) are REMOVED — they'd only spam Blender warnings
    and ship dead channels in the GLB."""
    suffix = {}
    for b in rig_bones:
        suffix[b.split(':')[-1].lower()] = b
    missing = set()
    doomed = []
    for fc in action.fcurves:
        m = BONE_RE.search(fc.data_path)
        if not m:
            continue
        name = m.group(1)
        if name in rig_bones:
            continue
        alt = suffix.get(name.split(':')[-1].lower())
        if alt:
            fc.data_path = fc.data_path.replace(f'pose.bones["{name}"]', f'pose.bones["{alt}"]')
        else:
            missing.add(name)
            doomed.append(fc)
    for fc in doomed:
        action.fcurves.remove(fc)
    return sorted(missing)


def strip_root_motion(action, hips_name, vert_idx, strip_y):
    path = f'pose.bones["{hips_name}"].location'
    stripped = []
    for fc in [f for f in action.fcurves if f.data_path == path]:
        horizontal = fc.array_index != vert_idx
        if horizontal or strip_y:
            stripped.append(f"{'XYZ'[fc.array_index]}{'v' if not horizontal else ''}")
            action.fcurves.remove(fc)
    return stripped


def main():
    job_path = sys.argv[sys.argv.index('--') + 1]
    with open(job_path) as f:
        job = json.load(f)

    bpy.ops.wm.read_factory_settings(use_empty=True)

    rig_objs = import_fbx(job['rig'], use_anim=False)
    arm = find_armature(rig_objs)
    if arm is None:
        fail('no armature in rig FBX')
    meshes = [o for o in rig_objs if o.type == 'MESH']
    textured = ensure_basecolor(meshes, job.get('basecolor'))

    rig_bones = {b.name for b in arm.data.bones}
    hips = next((b for b in rig_bones if b.lower().endswith('hips')), None)
    if hips is None:
        fail(f'no hips bone; bones: {sorted(rig_bones)[:8]}...')
    vert_idx = vertical_channel(arm, hips)

    if arm.animation_data is None:
        arm.animation_data_create()

    report = {
        'bones': len(rig_bones),
        'meshes': len(meshes),
        'basecolorApplied': textured,
        'hips': hips,
        'verticalChannel': vert_idx,
        'clips': [],
        'warnings': [],
    }

    for clip in job['clips']:
        objs = import_fbx(clip['file'], use_anim=True)
        clip_arm = find_armature(objs)
        action = clip_arm.animation_data.action if clip_arm and clip_arm.animation_data else None
        if action is None:
            report['warnings'].append(f"{clip['name']}: no action in {clip['file']}")
        else:
            missing = remap_bone_paths(action, rig_bones)
            if missing:
                report['warnings'].append(f"{clip['name']}: unmapped bones {missing[:5]}")
            stripped = strip_root_motion(action, hips, vert_idx, clip.get('stripY', False))
            action.name = clip['name']
            action.use_fake_user = True
            start, end = action.frame_range
            track = arm.animation_data.nla_tracks.new()
            track.name = clip['name']
            strip = track.strips.new(clip['name'], max(int(start), 0), action)
            strip.name = clip['name']
            report['clips'].append({
                'name': clip['name'],
                'source': clip['file'],
                'frames': round(end - start),
                'seconds': round((end - start) / bpy.context.scene.render.fps, 3),
                'rootStripped': stripped,
            })
        # the clip file's own objects are done — the action lives on our rig now
        for o in objs:
            bpy.data.objects.remove(o, do_unlink=True)

    bpy.data.orphans_purge(do_recursive=True)

    bpy.ops.export_scene.gltf(
        filepath=job['out'],
        export_format='GLB',
        export_animations=True,
        export_animation_mode='NLA_TRACKS',
        export_skins=True,
        export_yup=True,
    )

    with open(job['report'], 'w') as f:
        json.dump(report, f, indent=1)
    print(f"BLENDER-OK: {len(report['clips'])} clips -> {job['out']}")


main()
