// Three.js WebGPU presentation layer for the fight. Owns its own canvas —
// mounted next to (visually over) the Phaser canvas by FightScene3D.
// Reads GameState, never writes it (SPEC V1). Verified r185 import paths:
//   three/webgpu                                -> WebGPURenderer, PostProcessing
//   three/addons/loaders/GLTFLoader.js          -> GLTFLoader
//   three/addons/inspector/Inspector.js         -> Inspector (renderer.inspector)
//   three/addons/tsl/display/{GTAONode,BloomNode}.js -> AO / bloom nodes
import * as THREE from 'three/webgpu';
import { mrt, normalView, output, pass, vec3, vec4 } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import type { Defs, GameState } from '../engine';
import { STAGE_W, STAGE_H } from '../engine';
import { engineToWorld, WORLD_SCALE } from './threeCoordinates';
import { DEFAULT_SETTINGS, type RenderSettings } from './threeRenderSettings';
import { ThreeFighterView } from './ThreeFighterView';
import { ThreeHitboxDebug } from './ThreeHitboxDebug';
import { ThreeStageView } from './ThreeStageView';
import type { ResolvedClip } from './clipContract';

export class ThreeFightRenderer {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGPURenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private fighters: [ThreeFighterView, ThreeFighterView];
  readonly hitboxes = new ThreeHitboxDebug();
  private stage = new ThreeStageView();
  private ready = false;
  private disposed = false;
  private lights!: { key: THREE.DirectionalLight; fill: THREE.DirectionalLight; rim: THREE.DirectionalLight };
  private baseSize = { w: STAGE_W, h: STAGE_H };
  private settings: RenderSettings = { ...DEFAULT_SETTINGS };
  private post: THREE.RenderPipeline | null = null;
  private readonly viewH: number;

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
    // Frustum spans the engine stage width plus a small margin; the downward
    // tilt from +Z shows the floor plane as a proper ground band (not a line)
    // while keeping the lane distortion-free.
    const viewW = STAGE_W * WORLD_SCALE + 0.9;
    const viewH = viewW * (STAGE_H / STAGE_W);
    this.viewH = viewH;
    this.camera = new THREE.OrthographicCamera(-viewW / 2, viewW / 2, viewH / 2, -viewH / 2, 0.1, 60);
    this.applyCameraPreset('default');

    this.scene.background = new THREE.Color(0x171b26);
    this.scene.fog = new THREE.Fog(0x171b26, 14, 34);

    // three-point rig (SPEC T10): warm key with shadows, cool fill from the
    // camera side so black outfits keep detail, rim from behind to separate
    // fighters from the stage, hemisphere ambient for the rest
    const key = new THREE.DirectionalLight(0xfff0dd, 3.2);
    key.position.set(-3.5, 6, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -7;
    key.shadow.camera.right = 7;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -2;
    key.shadow.bias = -0.0005;
    const fill = new THREE.DirectionalLight(0xbfd4ff, 1.3);
    fill.position.set(4, 2.5, 7);
    const rim = new THREE.DirectionalLight(0x9fc4ff, 2.4);
    rim.position.set(1, 4.5, -6);
    const ambient = new THREE.HemisphereLight(0x9fb4d4, 0x3a332b, 0.7);
    this.scene.add(key, fill, rim, ambient);
    this.lights = { key, fill, rim };
    this.renderer.toneMappingExposure = DEFAULT_SETTINGS.exposure;

    this.stage.buildPlaceholder();

    this.fighters = [
      new ThreeFighterView(defs[charIds[0]]),
      new ThreeFighterView(defs[charIds[1]]),
    ];
    this.scene.add(
      this.fighters[0].group,
      this.fighters[1].group,
      this.hitboxes.group,
      this.stage.group,
    );
  }

  /** WebGPU init is async; render() is a no-op until this resolves. */
  async init(stageId?: string): Promise<void> {
    // models load in parallel with the backend; each falls back gracefully
    void this.fighters[0].loadModel();
    void this.fighters[1].loadModel();
    if (stageId) void this.stage.load(stageId);
    await this.renderer.init();
    if (this.disposed) return; // scene shut down while the backend was booting
    this.ready = true;
    this.buildPost();
  }

  /** Active clip per fighter for the debug HUD (SPEC V12). */
  clipInfo(slot: 0 | 1): ResolvedClip {
    return this.fighters[slot].clipInfo;
  }

  setSkeletonVisible(on: boolean): void {
    this.fighters[0].setSkeletonVisible(on);
    this.fighters[1].setSkeletonVisible(on);
  }

  setSize(w: number, h: number): void {
    this.baseSize = { w, h };
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * this.settings.resolutionScale);
    this.renderer.setSize(w, h, false);
  }

  applyCameraPreset(preset: RenderSettings['cameraPreset']): void {
    // ortho: position sets the tilt, the frustum stays honest to hitboxes
    if (preset === 'low') {
      this.camera.position.set(0, 2.6, 11);
      this.camera.lookAt(0, this.viewH / 2 - 0.45, 0);
    } else if (preset === 'high') {
      this.camera.position.set(0, 7, 12);
      this.camera.lookAt(0, this.viewH / 2 - 1.1, 0);
    } else {
      this.camera.position.set(0, 4.6, 11);
      this.camera.lookAt(0, this.viewH / 2 - 0.75, 0);
    }
  }

  applySettings(s: RenderSettings): void {
    const rebuildPost =
      s.aoEnabled !== this.settings.aoEnabled ||
      s.bloomEnabled !== this.settings.bloomEnabled ||
      s.bloomStrength !== this.settings.bloomStrength;
    const resizeShadows = s.shadowMapSize !== this.settings.shadowMapSize;
    this.settings = { ...s };

    this.renderer.toneMappingExposure = s.exposure;
    this.lights.key.intensity = s.keyIntensity;
    this.lights.fill.intensity = s.fillIntensity;
    this.lights.rim.intensity = s.rimIntensity;
    this.hitboxes.visible = s.hitboxes;
    this.setSkeletonVisible(s.skeleton);
    this.applyCameraPreset(s.cameraPreset);
    this.setSize(this.baseSize.w, this.baseSize.h);
    if (resizeShadows) {
      this.lights.key.shadow.mapSize.set(s.shadowMapSize, s.shadowMapSize);
      this.lights.key.shadow.map?.dispose();
      this.lights.key.shadow.map = null;
    }
    if (rebuildPost && this.ready) this.buildPost();
  }

  /** AO -> bloom composition via TSL nodes; null when both are off (T11). */
  private buildPost(): void {
    this.post?.dispose();
    this.post = null;
    const s = this.settings;
    if (!s.aoEnabled && !s.bloomEnabled) return;

    const scenePass = pass(this.scene, this.camera);
    // TSL chain: each mul/add returns a fresh vec4 node; type as base Node
    let color: THREE.Node = scenePass.getTextureNode('output');
    if (s.aoEnabled) {
      scenePass.setMRT(mrt({ output, normal: normalView }));
      const aoPass = ao(scenePass.getTextureNode('depth'), scenePass.getTextureNode('normal'), this.camera);
      color = (color as ReturnType<typeof vec4>).mul(vec4(vec3(aoPass.getTextureNode().r), 1));
    }
    if (s.bloomEnabled) {
      color = (color as ReturnType<typeof vec4>).add(
        bloom(color as ReturnType<typeof vec4>, s.bloomStrength, 0.35, 0.85),
      );
    }
    this.post = new THREE.RenderPipeline(this.renderer);
    this.post.outputNode = color;
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
    this.fighters[0].update(state.tick, state.fighters[0]);
    this.fighters[1].update(state.tick, state.fighters[1]);
    this.hitboxes.update(state, this.defs);
    this.track(state);
    if (this.post) this.post.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /** Lazy-attach the official three.js inspector (r185 addon). */
  async enableInspector(): Promise<void> {
    const { Inspector } = await import('three/addons/inspector/Inspector.js');
    this.renderer.inspector = new Inspector();
  }

  dispose(): void {
    this.disposed = true;
    this.ready = false;
    this.renderer.dispose();
    this.canvas.remove();
  }
}
