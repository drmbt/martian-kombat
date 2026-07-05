// Attract dance formation (SPEC: 3D attract). A lightweight sibling of
// ThreeFightRenderer — no engine, no HUD, no FX/hitboxes. It lines the meshed
// fighters up across the stage and drives every one of them with the SAME
// synced dance clip (via ViewContext.override), sequencing the Thriller parts
// so the whole row moves as one.
import * as THREE from 'three/webgpu';
import type { CharacterDef, Defs, FighterState } from '../engine';
import { FLOOR_Y, STAGE_W } from '../engine';
import { ThreeFighterView } from './ThreeFighterView';

/** ordered Thriller sequence + each part's length in seconds (baked 30fps clip
 *  durations) — the row advances part→part in lockstep, looping. */
const SEQUENCE: { clip: string; seconds: number }[] = [
  { clip: 'dance-thriller-1', seconds: 18.83 },
  { clip: 'dance-thriller-2', seconds: 25.6 },
  { clip: 'dance-thriller-3', seconds: 37.1 },
];

/** playback rate vs the clips' authored 30fps speed (1 = as authored) */
const DANCE_SPEED = 1.0;

const CAM_TARGET = new THREE.Vector3(0, 1.2, 0);
/** camera eye offset from the target at zoom = 1 */
const CAM_OFFSET = new THREE.Vector3(0, 4, 17.8);

function rowPositions(n: number): number[] {
  const step = Math.min(230, (STAGE_W - 200) / Math.max(n, 1));
  return Array.from({ length: n }, (_, i) => STAGE_W / 2 + (i - (n - 1) / 2) * step);
}

/** minimal FighterState standing idle at a floor slot, facing +X */
function danceState(x: number): FighterState {
  return {
    x,
    y: FLOOR_Y,
    vx: 0,
    vy: 0,
    facing: 1,
    hitstop: 0,
    health: 100,
    action: { kind: 'idle', frame: 0 },
  } as unknown as FighterState;
}

export class DanceRenderer {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGPURenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private dancers: ThreeFighterView[];
  private slots: number[];
  private ready = false;
  private disposed = false;
  /** real-time-advanced dance clock (ticks @ 60/s baseline); drives clip + sequence */
  private danceTick = 0;
  private lastTime = 0;
  private partIdx = 0;
  private partStartTick = 0;
  private zoomLevel = 1;
  private spots: THREE.SpotLight[] = [];
  private tmp = new THREE.Vector3();

  constructor(defs: Defs, private ids: string[]) {
    this.renderer = new THREE.WebGPURenderer({ antialias: true });
    this.canvas = this.renderer.domElement;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(30, STAGE_W / 540, 0.1, 120);
    this.applyZoom();

    this.scene.background = new THREE.Color(0x14121a);

    // flat, soft lighting: a strong key over lighter clothing was reading shiny
    // (vincent's dark cloak hid it). Keep it dim + ambient-heavy so all four read
    // matte and even, no hot highlight from above.
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(-3, 7.5, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -9;
    key.shadow.camera.right = 9;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -2;
    key.shadow.bias = -0.0005;
    const fill = new THREE.DirectionalLight(0xe8e8f0, 0.5);
    fill.position.set(4, 3, 7);
    const ambient = new THREE.HemisphereLight(0xb0b0b8, 0x40404a, 1.05);
    this.scene.add(key, fill, ambient);

    // flat open stage — a single large floor, dark space around and behind the
    // row (no test-room walls boxing them in)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x2b2833, roughness: 0.96, metalness: 0 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.slots = rowPositions(ids.length);
    this.dancers = ids.map((id) => new ThreeFighterView(defs[id] as CharacterDef));
    for (const d of this.dancers) this.scene.add(d.group);

    // one follow-spot per dancer, angled from BEHIND-above (upstage) rather than
    // straight down — rakes each dancer, throws a long shadow toward the camera,
    // and tracks them as they roam. Repositioned each frame in drawFrame.
    for (let i = 0; i < this.dancers.length; i++) {
      const spot = new THREE.SpotLight(0xfff0dc, 55, 28, 0.5, 0.5, 1.2);
      spot.castShadow = false;
      this.scene.add(spot, spot.target);
      this.spots.push(spot);
    }
  }

  private applyZoom(): void {
    this.camera.position.copy(CAM_TARGET).addScaledVector(CAM_OFFSET, this.zoomLevel);
    this.camera.lookAt(CAM_TARGET);
  }

  /** mouse-wheel dolly: negative deltaY (scroll up) zooms in */
  zoom(deltaY: number): void {
    this.zoomLevel = Math.min(2.2, Math.max(0.45, this.zoomLevel + Math.sign(deltaY) * 0.12));
    this.applyZoom();
  }

  async init(): Promise<void> {
    await Promise.all([...this.dancers.map((d) => d.loadModel(this.scene)), this.renderer.init()]);
    if (this.disposed) return;
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } catch (err) {
      console.warn('[dance] compileAsync failed (continuing):', err);
    }
    if (this.disposed) return;
    this.ready = true;
    this.renderer.setAnimationLoop((time: number) => this.drawFrame(time));
  }

  private drawFrame(time: number): void {
    if (this.disposed || !this.ready) return;
    // advance by REAL time, not per-frame: setAnimationLoop runs at the display
    // refresh rate (often 100-144Hz), so a per-frame step played the 30fps dance
    // fast + monitor-dependent. 60 ticks == 1 second of clip at DANCE_SPEED 1.
    if (this.lastTime === 0) this.lastTime = time;
    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    this.danceTick += dt * 60 * DANCE_SPEED;

    const elapsedSec = (this.danceTick - this.partStartTick) / 60;
    if (elapsedSec >= SEQUENCE[this.partIdx].seconds) {
      this.partIdx = (this.partIdx + 1) % SEQUENCE.length;
      this.partStartTick = this.danceTick;
    }
    const clip = SEQUENCE[this.partIdx].clip;
    for (let i = 0; i < this.dancers.length; i++) {
      const d = this.dancers[i];
      d.update(this.danceTick, danceState(this.slots[i]), { override: clip });
      // GLBs face +X; turn the row a quarter so they face the camera (+Z).
      d.group.rotation.y = -Math.PI / 2;
      // follow-spot tracks the roaming dancer, angled from behind-above (−Z)
      d.rootWorldPosition(this.tmp);
      const spot = this.spots[i];
      spot.position.set(this.tmp.x, 6.5, this.tmp.z - 4.5);
      spot.target.position.set(this.tmp.x, 1.1, this.tmp.z);
      spot.target.updateMatrixWorld();
    }
    this.renderer.render(this.scene, this.camera);
  }

  setSize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.scene.clear();
    this.renderer.dispose();
    this.canvas.remove(); // pull the canvas off the DOM so the menu shows again
  }
}
