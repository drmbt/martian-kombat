// Three.js WebGPU presentation layer for the fight. Owns its own canvas —
// mounted next to (visually over) the Phaser canvas by FightScene3D.
// Reads GameState, never writes it (SPEC V1). Verified r185 import paths:
//   three/webgpu                                -> WebGPURenderer, PostProcessing
//   three/addons/loaders/GLTFLoader.js          -> GLTFLoader
//   three/addons/inspector/Inspector.js         -> Inspector (renderer.inspector)
//   three/addons/tsl/display/{GTAONode,BloomNode}.js -> AO / bloom nodes
import * as THREE from 'three/webgpu';
import type { Defs, GameState } from '../engine';
import { STAGE_W, STAGE_H } from '../engine';
import { engineToWorld, WORLD_SCALE } from './threeCoordinates';
import { ThreeFighterView } from './ThreeFighterView';
import { ThreeHitboxDebug } from './ThreeHitboxDebug';

export class ThreeFightRenderer {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGPURenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private fighters: [ThreeFighterView, ThreeFighterView];
  readonly hitboxes = new ThreeHitboxDebug();
  private ready = false;
  private disposed = false;

  constructor(
    private defs: Defs,
    charIds: [string, string],
  ) {
    this.renderer = new THREE.WebGPURenderer({ antialias: true });
    this.canvas = this.renderer.domElement;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Orthographic first (SPEC V10): fighting-game readability, honest hitboxes.
    // Frustum spans the engine stage width plus a small margin; slight downward
    // tilt from +Z gives the lane depth without perspective distortion.
    const viewW = STAGE_W * WORLD_SCALE + 0.9;
    const viewH = viewW * (STAGE_H / STAGE_W);
    this.camera = new THREE.OrthographicCamera(-viewW / 2, viewW / 2, viewH / 2, -viewH / 2, 0.1, 40);
    this.camera.position.set(0, 2.6, 9);
    this.camera.lookAt(0, viewH / 2 - 0.35, 0);

    this.scene.background = new THREE.Color(0x11131c);

    // minimal work light so placeholders read; the real rig is T10
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(-3, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -7;
    key.shadow.camera.right = 7;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -2;
    this.scene.add(key, new THREE.HemisphereLight(0xbdd4ff, 0x30281e, 0.9));

    // placeholder ground plane at engine floor level (world Y=0)
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(STAGE_W * WORLD_SCALE + 4, 0.1, 7),
      new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.9 }),
    );
    floor.position.y = -0.05;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.fighters = [
      new ThreeFighterView(defs[charIds[0]]),
      new ThreeFighterView(defs[charIds[1]]),
    ];
    this.scene.add(this.fighters[0].group, this.fighters[1].group, this.hitboxes.group);
  }

  /** WebGPU init is async; render() is a no-op until this resolves. */
  async init(): Promise<void> {
    await this.renderer.init();
    if (this.disposed) return; // scene shut down while the backend was booting
    this.ready = true;
  }

  setSize(w: number, h: number): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
  }

  /** Camera drifts to keep both fighters framed (ortho pan only, no zoom yet). */
  private track(state: GameState): void {
    const [a, b] = state.fighters;
    const [cx] = engineToWorld((a.x + b.x) / 2, 0);
    const limit = (STAGE_W * WORLD_SCALE) / 2 - (this.camera.right - this.camera.left) / 2;
    this.camera.position.x = limit > 0 ? Math.max(-limit, Math.min(limit, cx * 0.4)) : 0;
  }

  render(state: GameState): void {
    if (!this.ready || this.disposed) return;
    this.fighters[0].update(state.fighters[0]);
    this.fighters[1].update(state.fighters[1]);
    this.hitboxes.update(state, this.defs);
    this.track(state);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposed = true;
    this.ready = false;
    this.renderer.dispose();
    this.canvas.remove();
  }
}
