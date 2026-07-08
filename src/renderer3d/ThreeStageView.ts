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
import { FX_LAYER, loadGlb, radialTexture, stageGlbUrl } from './threeAssets';

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

/** repeating grid texture for the test room: light lines over a flat shade,
 *  one canvas cell per world unit via the repeat counts */
function gridTexture(bg: string, line: string, repeatX: number, repeatY: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.strokeRect(0.5, 0.5, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  return t;
}

/** compact annotation plate for the test room (NEAR / FAR / SKY / FLOOR) */
function makeLabel(text: string, x: number, y: number, z: number): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 48;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#232327';
  ctx.fillRect(0, 0, 192, 48);
  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = '#cfcfd4';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 96, 25);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.29), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z);
  return m;
}

export type PlaceholderKind = 'test-room' | 'street' | '2d';

/** one painted 2D stage layer to mount in 3D (see build2DBridge) */
export interface Stage2DLayer {
  file: string;
  factor: number;
}

export class ThreeStageView {
  readonly group = new THREE.Group();
  loaded = false;
  private placeholder: THREE.Group | null = null;
  private train: THREE.Group | null = null;
  private neons: { mat: THREE.MeshBasicMaterial; base: THREE.Color; phase: number }[] = [];
  private blinkers: { mat: THREE.MeshBasicMaterial; phase: number }[] = [];
  private steam: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; phase: number }[] = [];
  private haze: THREE.Mesh[] = [];
  private cars: { group: THREE.Group; speed: number; span: number; offset: number }[] = [];
  private trafficHeads: THREE.MeshBasicMaterial[] = [];

  /** ambient stage motion — all tick-driven, render-side only */
  update(tick: number): void {
    if (this.train) {
      const span = 70;
      this.train.position.x = ((tick * 0.045) % span) - span / 2;
    }
    // neon flicker: mostly steady, occasional dropouts per-sign
    for (const n of this.neons) {
      const t = tick + n.phase;
      const drop = hash01(Math.floor(t / 7) * 31 + n.phase) < 0.06;
      const flick = drop ? 0.25 : 0.92 + 0.08 * Math.sin(t * 0.7);
      n.mat.color.copy(n.base).multiplyScalar(flick);
    }
    // rooftop aviation blinkers: slow sin pulse, staggered
    for (const b of this.blinkers) {
      b.mat.opacity = 0.15 + 0.85 * Math.max(0, Math.sin((tick + b.phase) * 0.045));
    }
    // manhole steam: quads rise, fade, loop
    for (const s of this.steam) {
      const p = ((tick + s.phase) % 240) / 240;
      s.mesh.position.y = 0.2 + p * 2.4;
      s.mesh.scale.setScalar(0.6 + p * 1.6);
      s.mat.opacity = 0.16 * (1 - p) * Math.min(p * 6, 1);
    }
    // haze sheets drift sideways very slowly
    this.haze.forEach((h, i) => {
      h.position.x = Math.sin(tick * 0.0016 + i * 2.4) * 3;
    });
    // distant traffic: recede/approach along the cross street (z axis)
    for (const c of this.cars) {
      const p = (((tick * Math.abs(c.speed) + c.offset) % c.span) + c.span) % c.span;
      c.group.position.z = c.speed > 0 ? -28 + p : -5.5 - p;
    }
    // traffic light cycle: green -> amber -> red
    const cycle = tick % 720;
    const active = cycle < 320 ? 2 : cycle < 400 ? 1 : 0; // g, a, r
    this.trafficHeads.forEach((m, i) => {
      m.opacity = i === active ? 1 : 0.12;
    });
  }

  buildPlaceholder(kind: PlaceholderKind = 'test-room', stage2d?: Stage2DLayer[]): void {
    if (kind === '2d' && stage2d?.length) this.build2DBridge(stage2d);
    else if (kind === 'street') this.buildStreet();
    else this.buildTestRoom();
  }

  /** 2D-stage bridge: mounts the existing painted stage art as billboards
   *  whose DEPTHS reproduce the 2D parallax factors under the perspective
   *  camera — a layer with factor f at reference distance D0 sits at D0/f.
   *  Layered stages (chiba-roof) get all four planes; single-jpg stages get
   *  one far billboard. A ShadowMaterial ground plane catches the fighters'
   *  shadows so the 3D characters seat into the painted world. */
  private build2DBridge(layers: Stage2DLayer[]): void {
    const g = new THREE.Group();
    const load = (file: string): THREE.Texture => {
      const t = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}${file}`);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    };
    // A single flat jpg gets SLICED per the stage-art contract (bottom quarter =
    // walkable ground): the floor band lies flat and recedes to a back wall built
    // from the upper band. Stages that ship separated parallax layers keep the
    // depth-staggered billboard treatment.
    if (layers.length <= 1 && layers[0]) this.buildSlicedStage(g, load, layers[0].file);
    else this.buildLayeredStage(g, load, layers);

    // invisible ground that renders ONLY the fighters' shadows so they seat into
    // the painted world
    const catcher = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 20),
      new THREE.ShadowMaterial({ opacity: 0.4 }),
    );
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.set(0, 0.002, 0);
    catcher.receiveShadow = true;
    g.add(catcher);

    this.placeholder = g;
    this.group.add(g);
  }

  /** stage-art contract: 1680x720, bottom quarter is the walkable ground plane */
  private static readonly FLOOR_BAND = 0.25;
  private static readonly ART_ASPECT = 1680 / 720;

  /** Single flat jpg → floor band laid HORIZONTAL (receding to the back) + upper
   *  band standing as a VERTICAL back wall. The two share the art's horizon so
   *  they read as one continuous 3D room. */
  private buildSlicedStage(g: THREE.Group, load: (f: string) => THREE.Texture, file: string): void {
    const BAND = ThreeStageView.FLOOR_BAND;
    const W = 26; // world width the stage spans (arena + generous margin)
    const FRONT_Z = 11; // floor front edge, pulled toward the camera (z=17) so the
    //                     near edge fills the bottom of frame — no seeing under it
    const BACK_Z = -16; // back wall pushed further back: the wall reads smaller and
    //                     lower on screen (more floor visible, backdrop sits "in the
    //                     background") and the floor plane gets a deeper recede
    const floorDepth = FRONT_Z - BACK_Z;

    // FLOOR — bottom band, flat, receding from the fighters to the wall
    const floorTex = load(file);
    floorTex.offset.set(0, 0);
    floorTex.repeat.set(1, BAND);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(W, floorDepth),
      new THREE.MeshBasicMaterial({ map: floorTex, fog: false }),
    );
    // rotate so the art's NEAR floor edge (v=0) is at FRONT_Z, far edge at the wall
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, (FRONT_Z + BACK_Z) / 2);
    floor.renderOrder = -12;
    g.add(floor);

    // BACK WALL — upper band, vertical, sitting on the floor's far edge
    const wallTex = load(file);
    wallTex.offset.set(0, BAND);
    wallTex.repeat.set(1, 1 - BAND);
    const wallH = (W * (1 - BAND)) / ThreeStageView.ART_ASPECT;
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(W, wallH),
      new THREE.MeshBasicMaterial({ map: wallTex, fog: false }),
    );
    wall.position.set(0, wallH / 2, BACK_Z);
    wall.renderOrder = -11;
    g.add(wall);
  }

  /** Separated parallax layers → depth-staggered vertical billboards (chiba-roof
   *  et al). The floor layer (factor ~1) is laid flat; the rest stand back. */
  private buildLayeredStage(g: THREE.Group, load: (f: string) => THREE.Texture, layers: Stage2DLayer[]): void {
    const D0 = 16.5; // reference camera distance to the combat lane
    const VFOV = (20 * Math.PI) / 180;
    // fighters' floor line within the STAGE background art (14.86% up the 21:9
    // image) — a stage-art composition constant, NOT the sprite-cell
    // FLOOR_FRAC from src/render/coords.json
    const FLOOR_FRACTION = 0.1486;
    for (const layer of layers) {
      const f = Math.min(Math.max(layer.factor, 0.05), 1);
      const isFloor = f >= 0.999;
      const tex = load(layer.file);
      const transparent = layer.file.endsWith('.png');
      if (isFloor) {
        // floor layer laid FLAT so fighters stand on painted ground, not a wall
        const W = 26;
        const floor = new THREE.Mesh(
          new THREE.PlaneGeometry(W, W / ThreeStageView.ART_ASPECT),
          new THREE.MeshBasicMaterial({ map: tex, fog: false, transparent }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, 0, -3);
        floor.renderOrder = -12;
        g.add(floor);
        continue;
      }
      const z = -(D0 / f - D0);
      const dist = D0 - z;
      const h = 2 * Math.tan(VFOV / 2) * dist * 1.15; // slight overscan
      const w = h * ThreeStageView.ART_ASPECT;
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: tex, transparent, fog: false }),
      );
      plane.position.set(0, h / 2 - h * FLOOR_FRACTION, z);
      plane.renderOrder = -10;
      g.add(plane);
    }
  }

  /** Dev test chamber (default while the 3D engine is under construction):
   *  four grey wall layers at staggered depths, grid patterns on every
   *  surface, depth labels — pure structure readout with readable chars. */
  private buildTestRoom(): void {
    const g = new THREE.Group();
    const stageW = STAGE_W * WORLD_SCALE;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(stageW + 44, 24),
      new THREE.MeshStandardMaterial({
        map: gridTexture('#8a8a8e', '#a9a9ad', stageW + 44, 24),
        roughness: 0.92,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -4);
    floor.receiveShadow = true;
    g.add(floor);

    // named like the 2D stage template: NEAR / FAR / SKY walls + FLOOR —
    // further = darker + taller, all visible at once
    const layers = [
      // spans sized for the widened arena + camera travel + frustum spread
      { z: -3, h: 1.2, name: 'NEAR', labelY: 0.8, shade: '#7b7b80', line: '#94949a', span: stageW + 24 },
      { z: -9, h: 2.6, name: 'FAR', labelY: 2.2, shade: '#5a5a60', line: '#70707a', span: stageW + 38 },
      // SKY towers over FAR so it owns everything above the horizon line
      { z: -24, h: 14, name: 'SKY', labelY: 4.6, shade: '#38383e', line: '#48484f', span: stageW + 80 },
    ];
    for (const [i, l] of layers.entries()) {
      const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(l.span, l.h),
        new THREE.MeshStandardMaterial({
          map: gridTexture(l.shade, l.line, l.span, l.h),
          roughness: 0.95,
        }),
      );
      wall.position.set(0, l.h / 2, l.z);
      wall.receiveShadow = true;
      g.add(wall);
      g.add(makeLabel(`${l.name} z${l.z}`, -3.5 - i * 1.4, l.labelY, l.z + 0.02));
    }
    // floor label lies flat on the ground plane
    const floorLabel = makeLabel('FLOOR z0', 3.4, 0.006, -1.2);
    floorLabel.rotation.x = -Math.PI / 2;
    g.add(floorLabel);

    // side walls close the box (out past the widened bounds)
    const sideMat = new THREE.MeshStandardMaterial({
      map: gridTexture('#59595e', '#6e6e74', 24, 10),
      roughness: 0.95,
    });
    for (const dir of [-1, 1] as const) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(24, 10), sideMat);
      side.position.set(dir * (stageW / 2 + 8.5), 5, -9);
      side.rotation.y = -dir * Math.PI * 0.5;
      side.receiveShadow = true;
      g.add(side);
    }

    // low end-of-range walls: the motion clamp made visible on both sides
    // (engine bounds -110..1070 px -> ±5.9m world)
    const endMat = new THREE.MeshStandardMaterial({
      map: gridTexture('#6a6a70', '#83838a', 6, 1),
      roughness: 0.9,
    });
    for (const dir of [-1, 1] as const) {
      // bounds clamp the fighter CENTER (±5.9m) — pad by ~a half-body so
      // feet/coats can't poke through the barrier
      const end = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 6), endMat);
      end.position.set(dir * 7.4, 0.3, -0.6);
      end.castShadow = true;
      end.receiveShadow = true;
      g.add(end);
      const endLabel = makeLabel(`RANGE ${dir === 1 ? 'MAX' : 'MIN'}`, dir * 7.4, 0.85, -0.6);
      endLabel.rotation.y = -dir * Math.PI * 0.5;
      g.add(endLabel);
    }

    // lane markers: center line + spawn ticks
    const markMat = new THREE.MeshStandardMaterial({ color: 0xc8c84a, roughness: 0.8 });
    const center = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 3), markMat);
    center.position.set(0, 0.007, 0);
    g.add(center);
    for (const mx of [-1.8, 1.8]) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.08), markMat);
      tick.position.set(mx, 0.007, 0);
      g.add(tick);
    }

    this.placeholder = g;
    this.group.add(g);
  }

  private buildStreet(): void {
    const g = new THREE.Group();
    const stageW = STAGE_W * WORLD_SCALE;

    // asphalt fight lane + raised sidewalk with a real curb face + joints
    const asphalt = new THREE.Mesh(
      new THREE.BoxGeometry(stageW + 30, 0.1, 9),
      new THREE.MeshStandardMaterial({ color: 0x232529, roughness: 0.94 }),
    );
    asphalt.position.set(0, -0.05, 0.5);
    asphalt.receiveShadow = true;
    // the sidewalk/curb splits around a cross street at CROSS_X — the gap the
    // distant traffic drives through instead of ghosting between houses
    const CROSS_X = 9;
    const CROSS_W = 3.6;
    const half = (stageW + 30) / 2;
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.9 });
    const curbTopMat = new THREE.MeshStandardMaterial({ color: 0x55555c, roughness: 0.8 });
    const curbFaceMat = new THREE.MeshStandardMaterial({ color: 0x1a1b20, roughness: 0.95 });
    const segments: [number, number][] = [
      [-half, CROSS_X - CROSS_W / 2],
      [CROSS_X + CROSS_W / 2, half],
    ];
    for (const [x0, x1] of segments) {
      const w = x1 - x0;
      const cx = (x0 + x1) / 2;
      const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 3.4), sidewalkMat);
      sidewalk.position.set(cx, 0.01, -5.7);
      sidewalk.receiveShadow = true;
      const curbTop = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, 0.22), curbTopMat);
      curbTop.position.set(cx, 0.12, -3.95);
      const curbFace = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, 0.04), curbFaceMat);
      curbFace.position.set(cx, 0.05, -3.85);
      g.add(sidewalk, curbTop, curbFace);
    }
    g.add(asphalt);
    // sidewalk expansion joints — cheap lines that sell the concrete slabs
    const jointMat = new THREE.MeshStandardMaterial({ color: 0x232329, roughness: 1 });
    for (let jx = -14; jx <= 14; jx += 1.4) {
      if (Math.abs(jx - CROSS_X) < CROSS_W / 2 + 0.2) continue;
      const joint = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 3.3), jointMat);
      joint.position.set(jx, 0.125, -5.7);
      g.add(joint);
    }
    // the cross street itself: receding asphalt ribbon + center dashes
    const crossRoad = new THREE.Mesh(
      new THREE.PlaneGeometry(CROSS_W + 0.8, 27),
      new THREE.MeshStandardMaterial({ color: 0x282a31, roughness: 0.92 }),
    );
    crossRoad.rotation.x = -Math.PI / 2;
    crossRoad.position.set(CROSS_X, 0.004, -17);
    crossRoad.receiveShadow = true;
    g.add(crossRoad);
    const crossDashMat = new THREE.MeshStandardMaterial({ color: 0x8a8468, roughness: 0.85 });
    for (let dz = -6; dz >= -28; dz -= 2.2) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.008, 0.7), crossDashMat);
      dash.position.set(CROSS_X, 0.01, dz);
      g.add(dash);
    }
    // cool spill down the cross street so the corridor reads at a glance
    const corridorLight = new THREE.PointLight(0x9fb8dd, 12, 12, 1.8);
    corridorLight.position.set(CROSS_X, 3.2, -11);
    g.add(corridorLight);
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
    moonGlow.layers.set(FX_LAYER);
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
    // heights tuned so ROOFLINES sit inside the camera frame (20° fov from
    // y≈2.2): near row tops ~3-4.5m, each deeper row a bit taller
    const rows: { z: number; h: [number, number]; color: number; palette?: number[]; count: number; span: number }[] = [
      { z: -8.5, h: [2.4, 4.4], color: 0x2e3340, palette: NEAR_PALETTE, count: 6, span: stageW + 30 },
      { z: -13.5, h: [3.6, 6.4], color: 0x232734, palette: MID_PALETTE, count: 10, span: stageW + 40 },
      { z: -20, h: [5.5, 9.5], color: 0x181b26, count: 12, span: stageW + 55 },
      { z: -29, h: [8, 13], color: 0x0e1119, count: 15, span: stageW + 80 },
    ];
    const windowMat = new THREE.MeshBasicMaterial({ color: 0x8f7443 });
    for (const [ri, row] of rows.entries()) {
      for (let i = 0; i < row.count; i++) {
        const r = hash01(ri * 131 + i * 17);
        const w = 2 + r * 3.5;
        const h = row.h[0] + hash01(ri * 57 + i * 23) * (row.h[1] - row.h[0]);
        const x = -row.span / 2 + (i + 0.5) * (row.span / row.count) + (r - 0.5) * 1.2;
        // keep the cross-street corridor clear so the road reads to the
        // horizon — measured to the building EDGE, not its center (wide
        // blocks used to lean into the road and cars drove through them)
        if (ri <= 2 && Math.abs(x - 9) < 2.6 + ri * 0.4 + w / 2) continue;
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
                [0, 'rgba(255,178,102,0.34)'],
                [1, 'rgba(255,178,102,0)'],
              ]),
              transparent: true,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          );
          uplight.position.set(x, 0.7, row.z + (2 + r * 2) / 2 + 0.015);
          uplight.layers.set(FX_LAYER);
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
          const signMat = new THREE.MeshBasicMaterial({ color: neonColor });
          this.neons.push({ mat: signMat, base: new THREE.Color(neonColor), phase: Math.floor(hash01(i * 89) * 600) });
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(0.22, 1.1 + hash01(i * 331) * 0.8),
            signMat,
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
          signGlow.layers.set(FX_LAYER);
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
      if (Math.abs(px - 9) < 3) continue; // the rail bridges the cross street
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
      cone.layers.set(FX_LAYER);
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
      headGlow.layers.set(FX_LAYER);
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
      pool.layers.set(FX_LAYER);
      lamp.add(pole, arm, head, light, target, beam, headGlow, pool);
      lamp.position.set(x, 0, -1.6);
      g.add(lamp);
    }

    // rooftop aviation blinkers on the tallest far-row silhouettes
    let blinked = 0;
    for (const [bx, by, bz] of [
      [-11, 12.2, -29],
      [4, 13.2, -29],
      [13, 11.4, -29],
      [-3, 9.6, -20],
      [6, 9.2, -20],
    ] as const) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, fog: false });
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), mat);
      dot.position.set(bx, by, bz);
      g.add(dot);
      this.blinkers.push({ mat, phase: blinked++ * 47 });
    }

    // manhole cover: procedural texture — rim, grooves, vent-hole pattern
    const mhCanvas = document.createElement('canvas');
    mhCanvas.width = mhCanvas.height = 128;
    const mh = mhCanvas.getContext('2d')!;
    mh.fillStyle = '#17181d';
    mh.beginPath();
    mh.arc(64, 64, 62, 0, Math.PI * 2);
    mh.fill();
    mh.strokeStyle = '#242730';
    mh.lineWidth = 5;
    mh.beginPath();
    mh.arc(64, 64, 58, 0, Math.PI * 2);
    mh.stroke();
    mh.strokeStyle = '#1c1e24';
    mh.lineWidth = 3;
    for (const rr of [44, 30]) {
      mh.beginPath();
      mh.arc(64, 64, rr, 0, Math.PI * 2);
      mh.stroke();
    }
    mh.fillStyle = '#0a0b0e';
    for (let ring = 0; ring < 2; ring++) {
      const rr = ring === 0 ? 37 : 22;
      const n = ring === 0 ? 10 : 6;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + ring * 0.3;
        mh.beginPath();
        mh.arc(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr, 4.4, 0, Math.PI * 2);
        mh.fill();
      }
    }
    mh.beginPath();
    mh.arc(64, 64, 5, 0, Math.PI * 2);
    mh.fill();
    // CanvasTexture defaults to linear — without sRGB tagging the dark greys
    // decode ~4x brighter and the cover reads near-white under the lamp
    const mhTex = new THREE.CanvasTexture(mhCanvas);
    mhTex.colorSpace = THREE.SRGBColorSpace;
    const grate = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 20),
      new THREE.MeshStandardMaterial({
        map: mhTex,
        transparent: true,
        roughness: 0.85,
        metalness: 0.05,
      }),
    );
    grate.rotation.x = -Math.PI / 2;
    grate.position.set(-2.2, 0.004, 1.8);
    grate.receiveShadow = true;
    g.add(grate);
    for (let si = 0; si < 3; si++) {
      const mat = new THREE.MeshBasicMaterial({
        map: radialTexture([
          [0, 'rgba(200,210,230,0.5)'],
          [1, 'rgba(200,210,230,0)'],
        ]),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        // additive: normal blending darkens the quad's low-alpha rim into a
        // visible dark square (same fringe issue the projectiles had)
        blending: THREE.AdditiveBlending,
        // fog on an additive quad tints its whole rectangle toward the fog
        // color — THE rim-box artifact when a puff crosses a lamp beam
        fog: false,
      });
      const puff = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      puff.renderOrder = 25; // after beams/pools so it never darkens them
      puff.layers.set(FX_LAYER);
      puff.position.set(-2.2, 0.3, 1.8);
      g.add(puff);
      this.steam.push({ mesh: puff, mat, phase: si * 80 });
    }

    // two huge slow haze sheets between building rows — atmosphere + depth
    for (const [hz, hy, ho] of [
      [-10.5, 2.4, 0.05],
      [-17, 4, 0.04],
    ] as const) {
      const hazeMat = new THREE.MeshBasicMaterial({
        map: radialTexture([
          [0, 'rgba(150,170,210,0.5)'],
          [1, 'rgba(150,170,210,0)'],
        ]),
        transparent: true,
        opacity: ho,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      });
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(26, 5), hazeMat);
      sheet.layers.set(FX_LAYER);
      sheet.position.set(0, hy, hz);
      g.add(sheet);
      this.haze.push(sheet);
    }

    // distant traffic drives the cross street, receding into the depth —
    // one lane going away (tail lights), one coming toward (headlights)
    for (const [lane, toward, speed, offset] of [
      [8.2, false, 0.05, 0],
      [9.8, true, 0.055, 14],
    ] as const) {
      const car = new THREE.Group();
      const front = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 6, 5),
        new THREE.MeshBasicMaterial({ color: toward ? 0xfff2c8 : 0xff3b30, fog: false }),
      );
      const side = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 6, 5),
        new THREE.MeshBasicMaterial({ color: toward ? 0xfff2c8 : 0xff3b30, fog: false }),
      );
      front.position.x = -0.35;
      side.position.x = 0.35;
      car.add(front, side);
      car.position.set(lane, 0.45, -28);
      g.add(car);
      // span runs along Z now: -28 (far) .. -5.5 (mouth of the cross street)
      this.cars.push({ group: car, speed: toward ? speed : -speed, span: 22.5, offset });
    }

    // traffic light on the sidewalk at frame right — cycles, sells "street"
    const tlPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 8), poleMat);
    tlPole.position.set(8.6, 1.7, -4.1);
    const tlBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.8, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x14151b, roughness: 0.7 }),
    );
    tlBox.position.set(8.6, 3.55, -4.1);
    g.add(tlPole, tlBox);
    for (const [ci, cc] of ([0xff3b30, 0xffb340, 0x3ddc6a] as const).entries()) {
      const mat = new THREE.MeshBasicMaterial({ color: cc, transparent: true, opacity: 0.12 });
      const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.075, 10), mat);
      bulb.position.set(8.6, 3.8 - ci * 0.25, -3.97);
      g.add(bulb);
      this.trafficHeads.push(mat);
    }

    // sidewalk clutter: trash can, bags, boxes, hydrant — silhouette props
    const propMat = new THREE.MeshStandardMaterial({ color: 0x181a20, roughness: 0.9 });
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.75, 10), propMat);
    can.position.set(-7.2, 0.4, -4.6);
    can.castShadow = true;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 10), propMat);
    lid.position.set(-7.2, 0.8, -4.6);
    for (const [bx, bs] of [
      [-6.6, 0.3],
      [-6.9, 0.22],
    ] as const) {
      const bag = new THREE.Mesh(new THREE.SphereGeometry(bs, 7, 6), propMat);
      bag.position.set(bx, bs * 0.75, -4.4);
      bag.scale.y = 0.8;
      bag.castShadow = true;
      g.add(bag);
    }
    const box1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.4), new THREE.MeshStandardMaterial({ color: 0x2e2620, roughness: 1 }));
    box1.position.set(6.9, 0.28, -4.7);
    box1.rotation.y = 0.4;
    box1.castShadow = true;
    const hydrant = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.14, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: 0x5c2a24, roughness: 0.75 }),
    );
    hydrant.position.set(4.4, 0.38, -4.3);
    hydrant.castShadow = true;
    const hydrantCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x5c2a24, roughness: 0.75 }),
    );
    hydrantCap.position.set(4.4, 0.68, -4.3);
    g.add(can, lid, box1, hydrant, hydrantCap);

    // two colored accent washes on the near wall — lift it off the fighters
    // without brightening the lane (short falloff, no shadows)
    const warmWash = new THREE.PointLight(0xff8a50, 18, 13, 1.8);
    warmWash.position.set(-5.5, 2.2, -6.8);
    const coolWash = new THREE.PointLight(0x4fa8ff, 16, 13, 1.8);
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
