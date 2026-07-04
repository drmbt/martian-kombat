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
import { cameraPosition, color, normalWorld, positionWorld, uv } from 'three/tsl';
import { STAGE_W } from '../engine';
import { WORLD_SCALE } from './threeCoordinates';
import { loadGlb, radialTexture, stageGlbUrl } from './threeAssets';

/** Cheap fake-volumetric beam (TSL): additive cone whose opacity peaks when
 *  the surface faces the camera and dies at the silhouette — soft shaft, no
 *  hard triangle edges — with a vertical gradient toward the lamp head. */
function beamMaterial(beamColor: number, strength: number): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  const viewDir = cameraPosition.sub(positionWorld).normalize();
  const facing = normalWorld.dot(viewDir).abs(); // 1 face-on, 0 edge-on
  m.colorNode = color(beamColor);
  m.opacityNode = facing.pow(1.6).mul(uv().y.pow(1.5)).mul(strength);
  return m;
}

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
  private train: THREE.Group | null = null;

  /** ambient stage motion (the elevated train) — tick-driven, render-side */
  update(tick: number): void {
    if (this.train) {
      const span = 70;
      this.train.position.x = ((tick * 0.045) % span) - span / 2;
    }
  }

  buildPlaceholder(): void {
    const g = new THREE.Group();
    const stageW = STAGE_W * WORLD_SCALE;

    // asphalt fight lane + raised sidewalk with a real curb face + joints
    const asphalt = new THREE.Mesh(
      new THREE.BoxGeometry(stageW + 30, 0.1, 9),
      new THREE.MeshStandardMaterial({ color: 0x232529, roughness: 0.94 }),
    );
    asphalt.position.set(0, -0.05, 0.5);
    asphalt.receiveShadow = true;
    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(stageW + 30, 0.22, 3.4),
      new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.9 }),
    );
    sidewalk.position.set(0, 0.11 - 0.1, -5.7);
    sidewalk.receiveShadow = true;
    // curb: lighter worn top edge + darker vertical face at the lane boundary
    const curbTop = new THREE.Mesh(
      new THREE.BoxGeometry(stageW + 30, 0.03, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x55555c, roughness: 0.8 }),
    );
    curbTop.position.set(0, 0.12, -3.95);
    const curbFace = new THREE.Mesh(
      new THREE.BoxGeometry(stageW + 30, 0.14, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x1a1b20, roughness: 0.95 }),
    );
    curbFace.position.set(0, 0.05, -3.85);
    g.add(asphalt, sidewalk, curbTop, curbFace);
    // sidewalk expansion joints — cheap lines that sell the concrete slabs
    const jointMat = new THREE.MeshStandardMaterial({ color: 0x232329, roughness: 1 });
    for (let jx = -14; jx <= 14; jx += 1.4) {
      const joint = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 3.3), jointMat);
      joint.position.set(jx, 0.125, -5.7);
      g.add(joint);
    }
    // wet patches near the curb — low roughness picks up lamp speculars
    const puddleMat = new THREE.MeshStandardMaterial({
      color: 0x101318,
      roughness: 0.08,
      metalness: 0.55,
    });
    for (const [px, pw] of [
      [-4.2, 2.4],
      [2.6, 1.8],
      [8.5, 2.8],
    ] as const) {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 12), puddleMat);
      puddle.rotation.x = -Math.PI / 2;
      puddle.scale.set(pw, 0.55, 1);
      puddle.position.set(px, 0.002, -3.1);
      g.add(puddle);
    }

    // faded center-line dashes give x-travel a read without a debug grid
    const dashMat = new THREE.MeshStandardMaterial({ color: 0x8f8a6a, roughness: 0.8 });
    for (let i = -8; i <= 8; i++) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.012, 0.12), dashMat);
      dash.position.set(i * 1.6, 0.006, 2.6);
      dash.receiveShadow = true;
      g.add(dash);
    }

    // gradient night sky + low moon behind everything
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 4;
    skyCanvas.height = 128;
    const skyCtx = skyCanvas.getContext('2d')!;
    const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 128);
    skyGrad.addColorStop(0, '#05070f');
    skyGrad.addColorStop(0.62, '#101527');
    skyGrad.addColorStop(1, '#2a2438'); // faint warm city-glow horizon
    skyCtx.fillStyle = skyGrad;
    skyCtx.fillRect(0, 0, 4, 128);
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(stageW + 110, 40),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(skyCanvas), fog: false }),
    );
    sky.position.set(0, 16, -34);
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 24),
      new THREE.MeshBasicMaterial({ color: 0xe8ecff, fog: false }),
    );
    moon.position.set(-9, 13, -33.5);
    const moonGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 9),
      new THREE.MeshBasicMaterial({
        map: radialTexture(),
        color: 0x9aa6d8,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    moonGlow.position.set(-9, 13, -33.4);
    g.add(sky, moon, moonGlow);

    // backlot ground under all building rows — kills the void "holes" that
    // showed between and behind the blocks
    const backlot = new THREE.Mesh(
      new THREE.BoxGeometry(stageW + 90, 0.1, 36),
      new THREE.MeshStandardMaterial({ color: 0x0b0d13, roughness: 1 }),
    );
    backlot.position.set(0, -0.06, -22);
    g.add(backlot);

    // building rows at staggered depths — the parallax layers (near → skyline).
    // near row deliberately sparse: the GAPS are where the deeper rows peek
    // through and the parallax actually reads during camera travel.
    // near/mid rows draw from a muted color palette so the all-black fighters
    // separate from the walls instead of grey-on-grey mush
    const NEAR_PALETTE = [0x4a3339, 0x2f4548, 0x413c2d, 0x39405c, 0x442f4a];
    const MID_PALETTE = [0x32262b, 0x223034, 0x2d2a22, 0x282e42];
    const rows: { z: number; h: [number, number]; color: number; palette?: number[]; count: number; span: number }[] = [
      { z: -8.5, h: [3, 7], color: 0x2e3340, palette: NEAR_PALETTE, count: 6, span: stageW + 30 },
      { z: -13.5, h: [5, 10], color: 0x232734, palette: MID_PALETTE, count: 10, span: stageW + 40 },
      { z: -20, h: [8, 16], color: 0x181b26, count: 12, span: stageW + 55 },
      { z: -29, h: [13, 24], color: 0x0e1119, count: 15, span: stageW + 80 },
    ];
    const windowMat = new THREE.MeshBasicMaterial({ color: 0x8f7443 });
    for (const [ri, row] of rows.entries()) {
      for (let i = 0; i < row.count; i++) {
        const r = hash01(ri * 131 + i * 17);
        const w = 2 + r * 3.5;
        const h = row.h[0] + hash01(ri * 57 + i * 23) * (row.h[1] - row.h[0]);
        const x = -row.span / 2 + (i + 0.5) * (row.span / row.count) + (r - 0.5) * 1.2;
        const bColor = row.palette
          ? row.palette[Math.floor(hash01(ri * 211 + i * 41) * row.palette.length)]
          : row.color;
        const b = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, 2 + r * 2),
          new THREE.MeshStandardMaterial({ color: bColor, roughness: 0.95 }),
        );
        b.position.set(x, h / 2, row.z);
        g.add(b);
        // faint uplight glow at near-row bases — colors the wall, sells depth
        if (ri === 0) {
          const uplight = new THREE.Mesh(
            new THREE.PlaneGeometry(w * 0.9, 1.8),
            new THREE.MeshBasicMaterial({
              map: radialTexture([
                [0, 'rgba(255,178,102,0.22)'],
                [1, 'rgba(255,178,102,0)'],
              ]),
              transparent: true,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          );
          uplight.position.set(x, 0.7, row.z + (2 + r * 2) / 2 + 0.015);
          g.add(uplight);
        }
        // sparse lit windows on the two near rows (cheap, sells "city at night")
        if (ri <= 1) {
          const winCount = 2 + Math.floor(r * 4);
          for (let wi = 0; wi < winCount; wi++) {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.3), windowMat);
            win.position.set(
              x + (hash01(i * 97 + wi * 31) - 0.5) * (w * 0.7),
              0.8 + hash01(i * 61 + wi * 43) * (h - 1.6),
              row.z + (2 + r * 2) / 2 + 0.01,
            );
            g.add(win);
          }
        }
        // a few neon signs on the near row for cozy color depth
        if (ri === 0 && hash01(i * 613) > 0.55) {
          const neonColor = [0xff4d6d, 0x39d0ff, 0x9dff5e, 0xffb347][Math.floor(hash01(i * 271) * 4)];
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(0.22, 1.1 + hash01(i * 331) * 0.8),
            new THREE.MeshBasicMaterial({ color: neonColor }),
          );
          sign.position.set(x + (hash01(i * 449) - 0.5) * w * 0.6, 1.6 + hash01(i * 523) * 2, row.z + (2 + r * 2) / 2 + 0.02);
          const signGlow = new THREE.Mesh(
            new THREE.PlaneGeometry(1.4, 2.6),
            new THREE.MeshBasicMaterial({
              map: radialTexture(),
              color: neonColor,
              transparent: true,
              opacity: 0.35,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          );
          signGlow.position.copy(sign.position);
          signGlow.position.z += 0.03;
          g.add(sign, signGlow);
        }
      }
    }

    // elevated rail viaduct behind the near row + a train that crosses it —
    // the moving layer that makes the parallax impossible to miss
    const viaductMat = new THREE.MeshStandardMaterial({ color: 0x14161e, roughness: 0.9 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(stageW + 44, 0.5, 1.6), viaductMat);
    deck.position.set(0, 5.4, -11);
    g.add(deck);
    for (let px = -16; px <= 16; px += 4) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.2, 1.1), viaductMat);
      pylon.position.set(px, 2.6, -11);
      g.add(pylon);
    }
    const train = new THREE.Group();
    const trainBody = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.9, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x1d222e, roughness: 0.7 }),
    );
    trainBody.position.y = 6.1;
    train.add(trainBody);
    const trainWinMat = new THREE.MeshBasicMaterial({ color: 0xb8c6e8 });
    for (let wx = -4; wx <= 4; wx += 0.8) {
      const tw = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.3), trainWinMat);
      tw.position.set(wx, 6.15, 0.46);
      train.add(tw);
    }
    train.position.z = -11;
    g.add(train);
    this.train = train;

    // sagging power cables across the street — cheap lines, lots of depth
    const cableMat = new THREE.LineBasicMaterial({ color: 0x05060a });
    for (const [x1, x2, y, zc] of [
      [-14, -2, 4.6, -3.5],
      [-3, 12, 4.9, -3.2],
      [-10, 6, 5.4, -7.8],
    ] as const) {
      const mid = new THREE.Vector3((x1 + x2) / 2, y - 0.7, zc);
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(x1, y, zc),
        mid,
        new THREE.Vector3(x2, y + 0.2, zc),
      );
      const cable = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)),
        cableMat,
      );
      g.add(cable);
    }

    // foreground silhouettes (bollards + low wall chunks) at the frame edges —
    // the fast-moving parallax layer in front of the lane
    const fgMat = new THREE.MeshStandardMaterial({ color: 0x07080d, roughness: 1 });
    for (const [x, w, h] of [
      [-8.5, 2.6, 0.9],
      [7.8, 3.2, 0.7],
    ] as const) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), fgMat);
      wall.position.set(x, h / 2, 5.6);
      g.add(wall);
    }
    for (const x of [-6.4, -5.4, 5, 6]) {
      const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.75, 8), fgMat);
      bollard.position.set(x, 0.375, 5.4);
      g.add(bollard);
    }

    // street lamps along the sidewalk — warm pools, the secondary lights
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.6, metalness: 0.4 });
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffc37a });
    // poles stand on the sidewalk edge but the arm hangs the head OVER the
    // combat lane (z=0) so fighters stand inside the light pools; two lamps,
    // both shadow casters (point-light shadows are 6 cube faces each — the
    // whole reason we don't scatter five of them around)
    for (const x of [-3.2, 3.2]) {
      const HEAD_Y = 6.4;
      const CONE_ANGLE = 0.34; // rad — beam mesh and SpotLight share this
      const baseR = Math.tan(CONE_ANGLE) * HEAD_Y;
      const lamp = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, HEAD_Y - 0.1, 8), poleMat);
      pole.position.y = (HEAD_Y - 0.1) / 2;
      pole.castShadow = true;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.7), poleMat);
      arm.position.set(0, HEAD_Y + 0.05, 0.85);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), headMat);
      head.position.set(0, HEAD_Y, 1.6);
      // SpotLight, not a 360° point: the lit world follows the visible cone
      const light = new THREE.SpotLight(0xffc37a, 260, HEAD_Y + 6, CONE_ANGLE, 0.45, 1.6);
      light.position.copy(head.position);
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.bias = -0.002;
      const target = new THREE.Object3D();
      target.position.set(0, 0, 1.6); // straight down from the head
      light.target = target;
      // fake-volumetric shaft matching the SpotLight frustum exactly
      const beam = new THREE.Group();
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1, true), beamMaterial(0xffb765, 0.2));
      cone.scale.set(baseR, HEAD_Y, baseR);
      cone.position.set(0, HEAD_Y / 2 + 0.02, 0);
      beam.add(cone);
      beam.position.set(0, 0, 1.6);
      const headGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 1.8),
        new THREE.MeshBasicMaterial({
          map: radialTexture(),
          color: 0xffc37a,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      headGlow.position.set(0, HEAD_Y, 1.62);
      // subtle pool decal sized to the beam footprint (the real pool now
      // comes from the SpotLight itself)
      const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(baseR * 2.3, baseR * 1.7),
        new THREE.MeshBasicMaterial({
          map: radialTexture([
            [0, 'rgba(255,205,140,0.16)'],
            [0.55, 'rgba(255,190,120,0.07)'],
            [1, 'rgba(255,190,120,0)'],
          ]),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(0, 0.004, 1.6);
      lamp.add(pole, arm, head, light, target, beam, headGlow, pool);
      lamp.position.set(x, 0, -1.6);
      g.add(lamp);
    }

    // two colored accent washes on the near wall — lift it off the fighters
    // without brightening the lane (short falloff, no shadows)
    const warmWash = new THREE.PointLight(0xff8a50, 9, 9, 1.8);
    warmWash.position.set(-5.5, 2.2, -6.8);
    const coolWash = new THREE.PointLight(0x4fa8ff, 8, 9, 1.8);
    coolWash.position.set(5.5, 2.6, -6.8);
    g.add(warmWash, coolWash);

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
