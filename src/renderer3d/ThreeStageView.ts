// Stage GLB mount (SPEC T7). The GLB is cosmetic — gameplay bounds stay on
// FLOOR_Y and the engine X clamp regardless of what the floor mesh looks like.
// Expected named groups (stage model contract): StageRoot / Sky / Far / Near /
// Floor / Props / Lights / SpawnMarkers — none are required for the spike.
import * as THREE from 'three/webgpu';
import { loadGlb, stageGlbUrl } from './threeAssets';

export class ThreeStageView {
  readonly group = new THREE.Group();
  loaded = false;

  async load(stageId: string): Promise<void> {
    const gltf = await loadGlb(stageGlbUrl(stageId));
    if (!gltf) return;
    gltf.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.receiveShadow = true;
        o.castShadow = true;
      }
    });
    // Floor contract (SPEC V14): the Floor group's top surface IS the engine
    // floor. Shift the whole stage so that surface lands exactly on world Y=0
    // — fighters can then never float above or sink into the visual ground.
    const floor = gltf.scene.getObjectByName('Floor');
    if (floor) {
      const top = new THREE.Box3().setFromObject(floor).max.y;
      gltf.scene.position.y -= top;
    } else {
      console.warn(`[3d] stage ${stageId}: no "Floor" group — alignment not enforced`);
    }
    this.group.add(gltf.scene);
    this.loaded = true;
  }
}
