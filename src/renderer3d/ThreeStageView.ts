// Stage GLB mount (SPEC T7). The GLB is cosmetic — gameplay bounds stay on
// FLOOR_Y and the engine X clamp regardless of what the floor mesh looks like.
// Expected named groups (stage model contract): StageRoot / Sky / Far / Near /
// Floor / Props / Lights / SpawnMarkers — none are required for the spike.
//
// Until a stage GLB exists, buildPlaceholder() stands in with a readable
// test box: grid floor, back wall, side walls — so fighters (and their
// all-black outfits) never float in a void.
import * as THREE from 'three/webgpu';
import { STAGE_W } from '../engine';
import { WORLD_SCALE } from './threeCoordinates';
import { loadGlb, stageGlbUrl } from './threeAssets';

export class ThreeStageView {
  readonly group = new THREE.Group();
  loaded = false;
  private placeholder: THREE.Group | null = null;

  buildPlaceholder(): void {
    const g = new THREE.Group();
    const stageW = STAGE_W * WORLD_SCALE;

    const floorMat = new THREE.MeshStandardMaterial({ color: 0x6e6a63, roughness: 0.95 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(stageW + 8, 0.1, 10), floorMat);
    floor.position.set(0, -0.05, -1.5);
    floor.receiveShadow = true;

    // 1m grid so scale and travel read on screen, cropped to the floor slab
    const grid = new THREE.GridHelper(stageW + 8, Math.round(stageW + 8), 0x8f8a80, 0x57534c);
    grid.position.y = 0.005;
    grid.position.z = -1.5;
    grid.scale.z = 10 / (stageW + 8);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x39404e, roughness: 0.9 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(stageW + 8, 6), wallMat);
    back.position.set(0, 3, -6.5);
    back.receiveShadow = true;

    // matching 1m grid up the back wall — vertical scale reference
    const wallGrid = new THREE.GridHelper(stageW + 8, Math.round(stageW + 8), 0x6d7486, 0x4a5162);
    wallGrid.rotation.x = Math.PI / 2;
    wallGrid.scale.z = 6 / (stageW + 8);
    wallGrid.position.set(0, 3, -6.49);

    // far side walls to close the box at the corners
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.9 });
    for (const dir of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), sideMat);
      side.position.set(dir * (stageW / 2 + 4), 3, -1.5);
      side.rotation.y = -dir * Math.PI * 0.5;
      g.add(side);
    }

    // skyline strip above the back wall so the void has a horizon
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(stageW + 20, 10),
      new THREE.MeshBasicMaterial({ color: 0x1c2233 }),
    );
    sky.position.set(0, 9, -7.4);

    g.add(floor, grid, back, wallGrid, sky);
    this.placeholder = g;
    this.group.add(g);
  }

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
    if (this.placeholder) {
      this.group.remove(this.placeholder);
      this.placeholder = null;
    }
    this.group.add(gltf.scene);
    this.loaded = true;
  }
}
