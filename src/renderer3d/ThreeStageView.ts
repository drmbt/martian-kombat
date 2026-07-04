// Stage GLB mount (SPEC T7). The GLB is cosmetic — gameplay bounds stay on
// FLOOR_Y and the engine X clamp regardless of what the floor mesh looks like.
// Expected named groups (stage model contract): StageRoot / Sky / Far / Near /
// Floor / Props / Lights / SpawnMarkers — none are required for the spike.
//
// Until a stage GLB exists, buildPlaceholder() stands in with a night street
// (SPEC T24): asphalt lane, sidewalk, lamp posts with warm light pools, and
// building rows at staggered depths so the perspective camera gets real
// parallax — the 3D answer to the 2D layer factors (sky .14 / far .34 /
// near .68 / floor 1).
import * as THREE from 'three/webgpu';
import { STAGE_W } from '../engine';
import { WORLD_SCALE } from './threeCoordinates';
import { loadGlb, stageGlbUrl } from './threeAssets';

function hash01(seed: number): number {
  let h = (seed | 0) * 2654435761;
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}

export class ThreeStageView {
  readonly group = new THREE.Group();
  loaded = false;
  private placeholder: THREE.Group | null = null;

  buildPlaceholder(): void {
    const g = new THREE.Group();
    const stageW = STAGE_W * WORLD_SCALE;

    // asphalt fight lane + lighter sidewalk band behind it
    const asphalt = new THREE.Mesh(
      new THREE.BoxGeometry(stageW + 30, 0.1, 9),
      new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.94 }),
    );
    asphalt.position.set(0, -0.05, 0.5);
    asphalt.receiveShadow = true;
    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(stageW + 30, 0.16, 3.4),
      new THREE.MeshStandardMaterial({ color: 0x4a4a50, roughness: 0.9 }),
    );
    sidewalk.position.set(0, -0.08 + 0.06, -5.5);
    sidewalk.receiveShadow = true;
    g.add(asphalt, sidewalk);

    // faded center-line dashes give x-travel a read without a debug grid
    const dashMat = new THREE.MeshStandardMaterial({ color: 0x8f8a6a, roughness: 0.8 });
    for (let i = -8; i <= 8; i++) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.012, 0.12), dashMat);
      dash.position.set(i * 1.6, 0.006, 2.6);
      dash.receiveShadow = true;
      g.add(dash);
    }

    // building rows at staggered depths — the parallax layers
    const rows: { z: number; h: [number, number]; color: number; count: number; span: number }[] = [
      { z: -8.5, h: [3, 7], color: 0x363b49, count: 9, span: stageW + 26 },
      { z: -15, h: [6, 12], color: 0x252936, count: 11, span: stageW + 40 },
      { z: -24, h: [10, 20], color: 0x181b26, count: 13, span: stageW + 60 },
    ];
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xc9a35e });
    for (const [ri, row] of rows.entries()) {
      for (let i = 0; i < row.count; i++) {
        const r = hash01(ri * 131 + i * 17);
        const w = 2 + r * 3.5;
        const h = row.h[0] + hash01(ri * 57 + i * 23) * (row.h[1] - row.h[0]);
        const x = -row.span / 2 + (i + 0.5) * (row.span / row.count) + (r - 0.5) * 1.2;
        const b = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, 2 + r * 2),
          new THREE.MeshStandardMaterial({ color: row.color, roughness: 0.95 }),
        );
        b.position.set(x, h / 2, row.z);
        g.add(b);
        // sparse lit windows on the near row only (cheap, sells "city at night")
        if (ri === 0) {
          const winCount = 2 + Math.floor(r * 4);
          for (let wi = 0; wi < winCount; wi++) {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.4), windowMat);
            win.position.set(
              x + (hash01(i * 97 + wi * 31) - 0.5) * (w * 0.7),
              0.8 + hash01(i * 61 + wi * 43) * (h - 1.6),
              row.z + (2 + r * 2) / 2 + 0.01,
            );
            g.add(win);
          }
        }
      }
    }

    // street lamps along the sidewalk — warm pools, the secondary lights
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.6, metalness: 0.4 });
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffc37a });
    // fake-volumetric cone: additive, vertex-alpha-free translucent shell that
    // fades toward the ground — reads as light in haze without real scattering
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xffb765,
      transparent: true,
      opacity: 0.07,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    // poles stand on the sidewalk edge but the arm hangs the head OVER the
    // combat lane (z=0) so fighters stand inside the light pools; two lamps,
    // both shadow casters (point-light shadows are 6 cube faces each — the
    // whole reason we don't scatter five of them around)
    for (const x of [-3.2, 3.2]) {
      const lamp = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.6, 8), poleMat);
      pole.position.y = 1.8;
      pole.castShadow = true;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.7), poleMat);
      arm.position.set(0, 3.55, 0.85);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), headMat);
      head.position.set(0, 3.5, 1.6);
      // lamps carry the scene light (cozy pools, not flat fill)
      const light = new THREE.PointLight(0xffc37a, 30, 11, 1.7);
      light.position.copy(head.position);
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.bias = -0.002;
      // stacked open cones under the head sell the volume without scattering
      const beam = new THREE.Group();
      for (const [rBot, h, o] of [
        [1.1, 3.5, 0.09],
        [1.7, 3.5, 0.05],
      ] as const) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 20, 1, true), coneMat.clone());
        (cone.material as THREE.MeshBasicMaterial).opacity = o;
        cone.scale.set(rBot, h, rBot);
        cone.position.set(0, h / 2 + 0.02, 0);
        beam.add(cone);
      }
      beam.position.set(0, 0, 1.6);
      lamp.add(pole, arm, head, light, beam);
      lamp.position.set(x, 0, -1.6);
      g.add(lamp);
    }

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
