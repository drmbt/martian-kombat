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
import { ThreeStageView, type PlaceholderKind, type Stage2DLayer } from './ThreeStageView';
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

  /** true once models + stage + pipelines are loaded and the first frame can
   *  draw — the scene holds the sim (intro/countdown/sfx) until this flips */
  get isReady(): boolean {
    return this.ready;
  }
  private disposed = false;
  private lights!: { key: THREE.DirectionalLight; fill: THREE.DirectionalLight; rim: THREE.DirectionalLight };
  private baseSize = { w: STAGE_W, h: STAGE_H };
  private settings: RenderSettings = { ...DEFAULT_SETTINGS };
  private post: THREE.RenderPipeline | null = null;
  private readonly viewH: number;
  // free mouse-orbit inspection camera + game-frustum gizmos (backtick toggle)
  private inspectorCam: THREE.PerspectiveCamera | null = null;
  private orbit: { update(): void; dispose(): void } | null = null;
  private camHelper: THREE.CameraHelper | null = null;
  private extentL: THREE.Line | null = null;
  private extentR: THREE.Line | null = null;
  private inspectorOn = false;

  private charIds: [string, string];

  constructor(
    private defs: Defs,
    charIds: [string, string],
    private roomKind: PlaceholderKind = 'test-room',
    private stage2d?: Stage2DLayer[],
  ) {
    this.charIds = charIds;
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

    // mood per room: the street is a dark night scene the lamps carry; the
    // test room is a neutral, evenly lit chamber for structure readouts
    // the 2D bridge keeps neutral-bright lighting so painted art reads true
    const testRoom = this.roomKind === 'test-room' || this.roomKind === '2d';
    this.scene.background = new THREE.Color(testRoom ? 0x1a1a1e : 0x0b0e17);
    if (!testRoom) this.scene.fog = new THREE.Fog(0x0e1120, 11, 30);

    const key = new THREE.DirectionalLight(testRoom ? 0xffffff : 0xcfd8ff, testRoom ? 2.4 : 0.6);
    key.position.set(-3.5, 7, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -8.5;
    key.shadow.camera.right = 8.5;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -2;
    key.shadow.bias = -0.0005;
    const fill = new THREE.DirectionalLight(testRoom ? 0xe8e8f0 : 0x7a86b8, testRoom ? 0.8 : 0.3);
    fill.position.set(4, 2.5, 7);
    const rim = new THREE.DirectionalLight(0x8fb4ff, testRoom ? 1.8 : 1.6);
    rim.position.set(1, 4.5, -6);
    const ambient = new THREE.HemisphereLight(
      testRoom ? 0x8a8a92 : 0x232c48,
      testRoom ? 0x3a3a3e : 0x0e0c0a,
      testRoom ? 0.55 : 0.4,
    );
    this.scene.add(key, fill, rim, ambient);
    this.lights = { key, fill, rim };
    this.renderer.toneMappingExposure = DEFAULT_SETTINGS.exposure;

    this.stage.buildPlaceholder(this.roomKind, this.stage2d);

    this.fighters = [
      new ThreeFighterView(defs[charIds[0]]),
      new ThreeFighterView(defs[charIds[1]]),
    ];
    this.fx = new ThreeFxSystem(defs);
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
    // everything the fight can touch loads BEFORE the first frame: models,
    // stage, every FX texture — then one prewarm pass instantiates every
    // material variant and compileAsync builds all GPU pipelines up front.
    // First-use pipeline compiles + texture uploads were the mid-fight
    // stutter on projectiles/effects.
    await Promise.all([
      this.fighters[0].loadModel(this.scene),
      this.fighters[1].loadModel(this.scene),
      stageId ? this.stage.load(stageId) : Promise.resolve(),
      this.fx.preloadAll(this.charIds),
      this.renderer.init(),
    ]);
    if (this.disposed) return; // scene shut down while the backend was booting
    this.fx.prewarm(true, this.charIds);
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } catch (err) {
      console.warn('[3d] compileAsync failed (continuing):', err);
    }
    this.fx.prewarm(false, this.charIds);
    if (this.disposed) return;
    this.ready = true;
    this.buildPost();
    // the renderer drives its own draw loop so the r185 inspector gets a
    // proper frame scope (node inspection needs setAnimationLoop)
    this.renderer.setAnimationLoop(() => this.drawFrame());
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
    const sep01 = Math.min(Math.abs(a.x - b.x) / 1000, 1);
    const targetX = mx * 0.8;
    const targetZ = 13.5 + sep01 * 6.5; // dolly out as they spread
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
        bloom(color as ReturnType<typeof vec4>, s.bloomStrength, 0.35, 0.92),
      );
    }
    this.post = new THREE.RenderPipeline(this.renderer);
    this.post.outputNode = color;
  }

  render(state: GameState, alpha = 0): void {
    if (!this.ready || this.disposed) return;
    // round-1 intro plays the entry gesture (later rounds go straight to idle)
    const intro = state.phase === 'intro' && state.roundNumber === 1;
    const ended = state.phase === 'matchEnd' && state.roundWinner !== null;
    const [fa, fb] = state.fighters;
    this.fighters[0].update(state.tick, fa, {
      opponent: fb,
      opponentDef: this.defs[fb.charId],
      intro,
      victor: ended && state.roundWinner === 0,
      defeated: ended && state.roundWinner === 1,
    }, alpha);
    this.fighters[1].update(state.tick, fb, {
      opponent: fa,
      opponentDef: this.defs[fa.charId],
      intro,
      victor: ended && state.roundWinner === 1,
      defeated: ended && state.roundWinner === 0,
    }, alpha);
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
    // drawing happens in renderer.setAnimationLoop (see init) — the
    // inspector needs draws inside its frame scope; sim/update stays here,
    // driven by Phaser's fixed-timestep loop
  }

  private drawFrame(): void {
    if (!this.ready || this.disposed) return;
    if (this.inspectorOn && this.inspectorCam) {
      // render from the free orbit cam; the game cam still updates each frame
      // (render() runs from the scene loop), so its frustum gizmo tracks live
      this.orbit?.update();
      this.camHelper?.update();
      this.updateExtentRays();
      this.renderer.render(this.scene, this.inspectorCam);
      return;
    }
    if (this.post) this.post.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /** True camera frame (frustum) + colored rays to its left/right extent, drawn
   *  through the scene so the inspector shows exactly what the game cam sees. */
  private updateExtentRays(): void {
    const cam = this.camera; // the live GAME camera
    const set = (line: THREE.Line | null, ndcX: number): void => {
      if (!line) return;
      const far = new THREE.Vector3(ndcX, 0, 1).unproject(cam);
      const pos = (line.geometry as THREE.BufferGeometry).getAttribute('position') as THREE.BufferAttribute;
      pos.setXYZ(0, cam.position.x, cam.position.y, cam.position.z);
      pos.setXYZ(1, far.x, far.y, far.z);
      pos.needsUpdate = true;
    };
    set(this.extentL, -1);
    set(this.extentR, 1);
  }

  /** Toggle the mouse orbit/zoom/pan inspection camera. Returns the new state.
   *  domElement must receive pointer events (caller flips canvas pointer-events). */
  async toggleInspectorCam(domElement: HTMLElement): Promise<boolean> {
    if (this.inspectorOn) {
      this.disableInspectorCam();
      return false;
    }
    const cam = new THREE.PerspectiveCamera(45, this.persp.aspect, 0.05, 300);
    cam.position.copy(this.camera.position).add(new THREE.Vector3(7, 4, 9));
    cam.lookAt(0, 1.3, 0);
    this.inspectorCam = cam;
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    if (!this.inspectorCam) return false; // toggled back off during the import
    const ctrl = new OrbitControls(cam, domElement);
    ctrl.target.set(0, 1.3, 0);
    ctrl.enableDamping = true;
    ctrl.update();
    this.orbit = ctrl;
    const mkRay = (color: number): THREE.Line => {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, depthTest: false }));
      l.renderOrder = 999;
      l.frustumCulled = false;
      return l;
    };
    this.camHelper = new THREE.CameraHelper(this.camera);
    this.extentL = mkRay(0xff3b30); // left extent — red
    this.extentR = mkRay(0x0affff); // right extent — cyan
    this.scene.add(this.camHelper, this.extentL, this.extentR);
    this.inspectorOn = true;
    return true;
  }

  private disableInspectorCam(): void {
    this.orbit?.dispose();
    this.orbit = null;
    if (this.camHelper) {
      this.scene.remove(this.camHelper);
      this.camHelper.dispose();
      this.camHelper = null;
    }
    for (const l of [this.extentL, this.extentR]) {
      if (l) {
        this.scene.remove(l);
        (l.geometry as THREE.BufferGeometry).dispose();
      }
    }
    this.extentL = this.extentR = null;
    this.inspectorCam = null;
    this.inspectorOn = false;
  }

  /** Lazy-attach the official three.js inspector (r185 addon). */
  async enableInspector(): Promise<void> {
    const { Inspector } = await import('three/addons/inspector/Inspector.js');
    const inspector = new Inspector();
    this.renderer.inspector = inspector;
    // the renderer only calls inspector.init() inside renderer.init() — we
    // attach after boot, so mount the UI ourselves (init appends the DOM)
    inspector.init();
  }

  dispose(): void {
    this.disposed = true;
    this.ready = false;
    if (this.inspectorOn) this.disableInspectorCam();
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    this.canvas.remove();
  }
}
