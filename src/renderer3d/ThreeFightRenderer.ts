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
import { ThreeFxSystem } from './ThreeFxSystem';
import type { ResolvedClip } from './clipContract';

export class ThreeFightRenderer {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGPURenderer;
  private scene = new THREE.Scene();
  /** active camera: perspective by default (real parallax), ortho preset for debug */
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private persp: THREE.PerspectiveCamera;
  private ortho: THREE.OrthographicCamera;
  /** smoothed follow state (world meters) */
  private camX = 0;
  private camZ = 17;
  private fighters: [ThreeFighterView, ThreeFighterView];
  readonly hitboxes = new ThreeHitboxDebug();
  readonly fx: ThreeFxSystem;
  private stage = new ThreeStageView();
  private lastFxTick = -1;
  private shakeUntil = -1;
  private shakeDur = 0;
  private shakeAmp = 0;
  private baseCamY = 0;
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
    // perspective default (V10 amended): low FOV keeps fighter proportions
    // honest while depth-staggered stage layers parallax for real
    this.persp = new THREE.PerspectiveCamera(20, STAGE_W / STAGE_H, 0.1, 80);
    this.ortho = new THREE.OrthographicCamera(-viewW / 2, viewW / 2, viewH / 2, -viewH / 2, 0.1, 80);
    this.persp.layers.enable(1); // FX layer — see threeAssets.FX_LAYER
    this.ortho.layers.enable(1);
    this.camera = this.persp;
    this.applyCameraPreset('default');

    // night street mood (T24): dark blue ambience + haze; the street lamps
    // carry the scene — key/fill stay low so their warm pools read cozy
    this.scene.background = new THREE.Color(0x0b0e17);
    this.scene.fog = new THREE.Fog(0x0e1120, 11, 30);

    const key = new THREE.DirectionalLight(0xcfd8ff, 0.6); // dim cool moon
    key.position.set(-3.5, 7, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -7;
    key.shadow.camera.right = 7;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -2;
    key.shadow.bias = -0.0005;
    const fill = new THREE.DirectionalLight(0x7a86b8, 0.3);
    fill.position.set(4, 2.5, 7);
    const rim = new THREE.DirectionalLight(0x8fb4ff, 1.2);
    rim.position.set(1, 4.5, -6);
    const ambient = new THREE.HemisphereLight(0x232c48, 0x0e0c0a, 0.4);
    this.scene.add(key, fill, rim, ambient);
    this.lights = { key, fill, rim };
    this.renderer.toneMappingExposure = DEFAULT_SETTINGS.exposure;

    this.stage.buildPlaceholder();

    this.fighters = [
      new ThreeFighterView(defs[charIds[0]]),
      new ThreeFighterView(defs[charIds[1]]),
    ];
    this.fx = new ThreeFxSystem(defs);
    this.fx.preload([charIds[0], charIds[1]]);
    this.scene.add(
      this.fighters[0].group,
      this.fighters[1].group,
      this.hitboxes.group,
      this.stage.group,
      this.fx.group,
    );
  }

  /** Victim impact flash (T21). */
  flashFighter(slot: 0 | 1, tick: number, ticks: number, color: number): void {
    this.fighters[slot].flash(tick, ticks, color);
  }

  /** Presentation-only camera shake (T21) — never touches gameplay coords. */
  shake(tick: number, ticks: number, amplitude: number): void {
    this.shakeUntil = tick + ticks;
    this.shakeDur = ticks;
    this.shakeAmp = amplitude;
  }

  /** WebGPU init is async; render() is a no-op until this resolves. */
  async init(stageId?: string): Promise<void> {
    // models load in parallel with the backend; each falls back gracefully
    void this.fighters[0].loadModel(this.scene);
    void this.fighters[1].loadModel(this.scene);
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
    this.persp.aspect = w / h;
    this.persp.updateProjectionMatrix();
  }

  applyCameraPreset(preset: RenderSettings['cameraPreset']): void {
    if (preset === 'ortho') {
      this.camera = this.ortho;
      this.camera.position.set(0, 4.6, 11);
      this.camera.lookAt(0, this.viewH / 2 - 0.75, 0);
    } else {
      this.camera = this.persp;
      // presets shift the eye height/tilt; follow logic drives x/z each frame
      const y = preset === 'low' ? 1.4 : preset === 'high' ? 4.6 : 2.2;
      this.camera.position.set(this.camX, y, this.camZ);
      this.camera.lookAt(this.camX * 0.85, 1.3, 0);
    }
    this.baseCamY = this.camera.position.y;
    if (this.ready && this.post) this.buildPost(); // post pass binds the camera
  }

  /** Perspective follow (T24): midpoint x with soft lerp, dolly ∝ separation. */
  private followCamera(state: GameState): void {
    if (this.camera !== this.persp) {
      // ortho debug: simple clamped pan like the old behavior
      const [a, b] = state.fighters;
      const [cx] = engineToWorld((a.x + b.x) / 2, 0);
      this.camera.position.x = cx * 0.4;
      return;
    }
    const [a, b] = state.fighters;
    const [mx] = engineToWorld((a.x + b.x) / 2, 0);
    const sep01 = Math.min(Math.abs(a.x - b.x) / 700, 1);
    const targetX = mx * 0.8;
    const targetZ = 13.5 + sep01 * 4.5; // dolly out as they spread
    this.camX += (targetX - this.camX) * 0.08;
    this.camZ += (targetZ - this.camZ) * 0.05;
    this.camera.position.set(this.camX, this.baseCamY, this.camZ);
    this.camera.lookAt(this.camX * 0.85, 1.3, 0);
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
      // AO gets its own solid-only G-pass: transparent FX quads (layer 1)
      // otherwise stamp the normal attachment and GTAO darkens their whole
      // rect — the "black square around smoke/projectiles" artifact
      const solidOnly = new THREE.Layers(); // defaults to layer 0 only
      const gPass = pass(this.scene, this.camera);
      gPass.setLayers(solidOnly);
      // AO is low-frequency — half-res G-pass halves the second scene render
      // cost with no visible difference after the blur/denoise
      gPass.setResolutionScale(0.5);
      gPass.setMRT(mrt({ output, normal: normalView }));
      const aoPass = ao(gPass.getTextureNode('depth'), gPass.getTextureNode('normal'), this.camera);
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

  render(state: GameState): void {
    if (!this.ready || this.disposed) return;
    this.fighters[0].update(state.tick, state.fighters[0], state.fighters[1]);
    this.fighters[1].update(state.tick, state.fighters[1], state.fighters[0]);
    this.hitboxes.update(state, this.defs);
    const dtTicks = this.lastFxTick < 0 ? 0 : Math.max(state.tick - this.lastFxTick, 0);
    this.lastFxTick = state.tick;
    this.fx.update(dtTicks, state);
    this.stage.update(state.tick);
    this.followCamera(state); // sets pos + aim; shake jitters on top
    if (state.tick < this.shakeUntil && this.shakeDur > 0) {
      const decay = (this.shakeUntil - state.tick) / this.shakeDur;
      const j = (seed: number): number => (((seed * 2654435761) >>> 13) % 1000) / 500 - 1;
      this.camera.position.x += j(state.tick * 3 + 1) * this.shakeAmp * decay;
      this.camera.position.y += j(state.tick * 7 + 5) * this.shakeAmp * decay;
    }
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
