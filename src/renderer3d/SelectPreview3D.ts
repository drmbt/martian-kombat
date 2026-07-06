// Live 3D idle previews for the character-select side slots (3D mode): a
// lightweight sibling of DanceRenderer — one transparent full-viewport
// canvas over the Phaser scene, both picks standing on a close plane so
// they project onto the same screen spots the 2D side sprites used. Each
// fighter plays their own idle clip via ThreeFighterView; while a GLB is
// still streaming (or absent) the scene keeps the portrait fallback —
// SelectScene checks active(slot) and we call onReady() when a model lands.
// three only loads on the 3D path: SelectScene imports this dynamically.
import * as THREE from 'three/webgpu';
import type { CharacterDef, Defs, FighterState } from '../engine';
import { FLOOR_Y, STAGE_W } from '../engine';
import { ThreeFighterView } from './ThreeFighterView';

// Framing: fighters ride a plane POD_Z meters toward the camera so they read
// big; SIDE_X engine coords project onto the 2D layout's side-slot centers.
const CAM_FOV = 24;
const CAM_DIST = 12.7;
const CAM_Y = 1.75;
const POD_Z = 3.5;
const SIDE_X: [number, number] = [216, STAGE_W - 216];

/** minimal idle FighterState at an engine-x slot (same trick as DanceRenderer) */
function idleState(x: number, facing: 1 | -1): FighterState {
  return {
    x,
    y: FLOOR_Y,
    vx: 0,
    vy: 0,
    facing,
    hitstop: 0,
    health: 100,
    action: { kind: 'idle', frame: 0 },
  } as unknown as FighterState;
}

interface Pod {
  charId: string | null;
  view: ThreeFighterView | null;
  seq: number;
}

export class SelectPreview3D {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGPURenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private pods: [Pod, Pod] = [
    { charId: null, view: null, seq: 0 },
    { charId: null, view: null, seq: 0 },
  ];
  /** loaded views survive cursor moves — flicking across the grid is free */
  private cache = new Map<string, ThreeFighterView>();
  private ready = false;
  private disposed = false;
  private tick = 0;
  private lastTime = 0;

  constructor(
    private defs: Defs,
    /** fired when a model finishes loading — SelectScene re-runs redraw() */
    private onReady: () => void,
  ) {
    this.renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0); // transparent — Phaser shows through
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.canvas = this.renderer.domElement;
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';

    this.camera = new THREE.PerspectiveCamera(CAM_FOV, 16 / 9, 0.1, 60);
    this.camera.position.set(0, CAM_Y, CAM_DIST);
    this.camera.lookAt(0, CAM_Y, 0);

    // flat matte lighting (the DanceRenderer recipe) — no floor, no shadows;
    // the Phaser podium glow under each slot grounds the figure instead
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(-3, 7.5, 6);
    const ambient = new THREE.HemisphereLight(0xb0b0b8, 0x40404a, 1.05);
    this.scene.add(key, ambient);
  }

  async init(): Promise<void> {
    await this.renderer.init();
    if (this.disposed) return;
    this.ready = true;
  }

  /** point a side slot at a fighter (null = clear → portrait fallback) */
  setChar(slot: 0 | 1, charId: string | null): void {
    const pod = this.pods[slot];
    if (pod.charId === charId) return;
    pod.charId = charId;
    const seq = ++pod.seq;
    if (pod.view) {
      this.scene.remove(pod.view.group); // stays cached for a re-visit
      pod.view = null;
    }
    if (!charId) return;
    const key = `${slot}:${charId}`; // per-slot instances: mirror picks need two
    const cached = this.cache.get(key);
    if (cached) {
      pod.view = cached;
      this.scene.add(cached.group);
      return;
    }
    const view = new ThreeFighterView(this.defs[charId] as CharacterDef);
    void view.loadModel(this.scene).then(() => {
      if (this.disposed || pod.seq !== seq || pod.charId !== charId) return; // stale pick
      if (view.clipInfo.placeholder) return; // no GLB — keep the portrait
      this.cache.set(key, view);
      pod.view = view;
      this.scene.add(view.group);
      this.onReady();
    });
  }

  /** a real model (not a capsule) is up for this slot */
  active(slot: 0 | 1): boolean {
    return this.pods[slot].view !== null;
  }

  setVisible(v: boolean): void {
    this.canvas.style.display = v ? 'block' : 'none';
  }

  /** drive from the scene's update() (Phaser-paced, works headless too) */
  render(timeMs: number): void {
    if (!this.ready || this.disposed) return;
    if (this.lastTime === 0) this.lastTime = timeMs;
    const dt = Math.min((timeMs - this.lastTime) / 1000, 0.1);
    this.lastTime = timeMs;
    this.tick += dt * 60; // idle clips are authored against the 60hz tick
    for (const slot of [0, 1] as const) {
      const pod = this.pods[slot];
      if (!pod.view) continue;
      pod.view.update(this.tick, idleState(SIDE_X[slot], slot === 0 ? 1 : -1));
      pod.view.group.position.z = POD_Z; // ride the close plane (bigger read)
    }
    this.renderer.render(this.scene, this.camera);
  }

  setSize(w: number, h: number): void {
    this.renderer.setSize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.disposed = true;
    this.scene.clear();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
