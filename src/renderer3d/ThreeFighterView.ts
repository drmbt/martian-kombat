// Fighter presentation: capsule placeholder until the character GLB loads,
// then a skinned model driven by ClipPlayer. The engine owns all translation
// and timing — clips are sampled from tick state, never free-run
// (SPEC V1, V4, V6, V9, V12, V13).
import * as THREE from 'three/webgpu';
import type { CharacterDef, FighterState } from '../engine';
import { resolveMove } from '../engine';
import { engineToWorld, WORLD_SCALE } from './threeCoordinates';
import { characterGlbUrl, loadGlb } from './threeAssets';
import {
  actionToClipName,
  attackClipTime,
  clipClass,
  clipTimeSec,
  fadeTicksFor,
  impactNorm,
  resolveClipName,
  syncToWalkSpeed,
  type ResolvedClip,
} from './clipContract';

interface ActiveClip extends ResolvedClip {
  action: THREE.AnimationAction;
  windowTicks?: number;
  startupTicks?: number;
}

/** Tick-sampled clip playback with class-based crossfades (SPEC V13). */
class ClipPlayer {
  private mixer: THREE.AnimationMixer;
  private available: ReadonlySet<string>;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: ActiveClip | null = null;
  private previous: ActiveClip | null = null;
  private fadeStart = 0;
  private fadeTicks = 0;
  /** ticks spent in the current engine action — Action.frame counts DOWN for
   *  reels, so the renderer keeps its own tick-derived elapsed counter */
  private elapsed = 0;
  private actionKey = '';
  private lastTick = -1;
  private lastActionFrame = -1;
  private heavyReel = false;

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root);
    this.available = new Set(clips.map((c) => c.name));
    for (const clip of clips) {
      const action = this.mixer.clipAction(clip);
      action.loop = THREE.LoopRepeat; // time is set manually; loop mode is moot
      action.clampWhenFinished = true;
      this.actions.set(clip.name, action);
    }
  }

  get info(): ResolvedClip {
    return this.current ?? { name: '-', placeholder: false };
  }

  update(tick: number, f: FighterState, def: CharacterDef, opponent?: FighterState): void {
    const key = `${f.action.kind}/${f.action.moveId ?? ''}`;
    // RESTART detection (T30): the same action re-triggering (lp lp lp
    // mashing, a fresh reel while already reeling) keeps the key identical
    // but snaps the engine frame counter backwards (up-counters) or upwards
    // (hitstun counts DOWN). Without this the clip keeps playing mid-way —
    // the "fast glitch" where repeats show only clip tails.
    const kind = f.action.kind;
    const countsDown = kind === 'hitstun' || kind === 'blockstun';
    const restarted =
      key === this.actionKey &&
      this.lastActionFrame >= 0 &&
      (countsDown ? f.action.frame > this.lastActionFrame : f.action.frame < this.lastActionFrame);
    if (key !== this.actionKey || restarted) {
      this.actionKey = key;
      this.elapsed = countsDown ? 0 : f.action.frame;
      // latch reel weight at the moment of impact: long stun or counter =
      // heavy reaction; frame counts down so this can't be derived later
      this.heavyReel = kind === 'hitstun' && (f.action.frame >= 20 || f.action.counter === true);
    } else if (this.lastTick >= 0 && f.hitstop <= 0) {
      // hitstop freezes the engine action — freeze the clip with it
      this.elapsed += Math.max(tick - this.lastTick, 0);
    }
    this.lastTick = tick;
    this.lastActionFrame = f.action.frame;

    const want = actionToClipName(f, opponent, this.heavyReel);
    const resolved = resolveClipName(this.available, want);
    if (!this.current || this.current.name !== resolved.name || restarted) {
      this.transitionTo(resolved, tick, f, def);
    }
    const cur = this.current!;

    // clip time from tick state (V4/V13) — walk loops scale with walk speed;
    // attacks with a declared impactNorm warp so the authored hit frame lands
    // exactly when the engine's active window opens (V5)
    const dur = cur.action.getClip().duration;
    const norm = impactNorm(cur.name);
    if (cur.windowTicks && cur.startupTicks !== undefined && norm !== undefined) {
      cur.action.time = attackClipTime(this.elapsed, cur.startupTicks, cur.windowTicks, dur, norm);
    } else {
      let ticks = this.elapsed;
      if (syncToWalkSpeed(cur.name)) {
        const speed = f.action.kind === 'walkB' ? def.backSpeed : def.walkSpeed;
        ticks *= speed / 3; // ~3px/tick reads as a natural stride at 1x
      }
      cur.action.time = clipTimeSec(clipClass(cur.name), ticks, dur, cur.windowTicks);
    }

    // crossfade weights, tick-derived (V13)
    let w = 1;
    if (this.previous && this.fadeTicks > 0) {
      w = Math.min((tick - this.fadeStart) / this.fadeTicks, 1);
      this.previous.action.setEffectiveWeight(1 - w);
      if (w >= 1) {
        this.previous.action.stop();
        this.previous = null;
      }
    }
    cur.action.setEffectiveWeight(w);
    this.mixer.update(0); // evaluate at the exact times we just set — no drift
  }

  private transitionTo(resolved: ResolvedClip, tick: number, f: FighterState, def: CharacterDef): void {
    if (this.previous) this.previous.action.stop(); // 3-deep pileup: drop the oldest
    this.previous = this.current;
    this.fadeStart = tick;
    this.fadeTicks = this.previous ? fadeTicksFor(this.previous.name, resolved.name) : 0;

    let windowTicks: number | undefined;
    let startupTicks: number | undefined;
    const a = f.action;
    if ((a.kind === 'attack' || a.kind === 'airAttack') && a.moveId && def.moves[a.moveId]) {
      const m = resolveMove(def.moves[a.moveId], a.strength);
      windowTicks = m.startup + m.active + m.recovery;
      startupTicks = m.startup;
    }
    const action = this.actions.get(resolved.name)!;
    action.reset().play();
    this.current = { ...resolved, action, windowTicks, startupTicks };
  }
}

/** action kinds where the engine says we're airborne — no ground snap */
const AIRBORNE = new Set(['air', 'airAttack', 'airHit']);
const BLACK = new THREE.Color(0x000000);

export class ThreeFighterView {
  readonly group = new THREE.Group();
  private placeholder = new THREE.Group();
  /** wrapper so facing is a rotation (skinned meshes hate negative scale) */
  private modelWrapper: THREE.Group | null = null;
  private model: THREE.Object3D | null = null;
  private player: ClipPlayer | null = null;
  private skeleton: THREE.SkeletonHelper | null = null;
  private bones: THREE.Bone[] = [];
  private modelBaseY = 0;
  private v = new THREE.Vector3();
  private materials: THREE.MeshStandardMaterial[] = [];
  private flashUntil = -1;
  private flashColor = new THREE.Color(0xffffff);

  constructor(private def: CharacterDef) {
    const h = def.hurtStand.h * WORLD_SCALE;
    const r = Math.min((def.hurtStand.w * WORLD_SCALE) / 2, h * 0.22);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(def.color),
      roughness: 0.55,
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(h - 2 * r, 0.1), 6, 16), mat);
    body.position.y = h / 2;
    body.castShadow = true;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(r, r * 0.5, r * 0.5), mat);
    nose.position.set(r * 1.1, h * 0.85, 0);
    nose.castShadow = true;
    this.placeholder.add(body, nose);
    this.group.add(this.placeholder);
  }

  /** What's playing (for the debug HUD's PLACEHOLDER flag — SPEC V12). */
  get clipInfo(): ResolvedClip {
    return this.player?.info ?? { name: 'capsule', placeholder: true };
  }

  setSkeletonVisible(on: boolean): void {
    if (this.skeleton) this.skeleton.visible = on;
  }

  /** Emissive impact flash (SPEC T21) — white pop, red + longer on counter. */
  flash(tick: number, ticks: number, color: number): void {
    this.flashUntil = tick + ticks;
    this.flashColor.setHex(color);
  }

  private applyFlash(tick: number): void {
    const active = tick < this.flashUntil;
    for (const m of this.materials) {
      m.emissive.copy(active ? this.flashColor : BLACK);
      m.emissiveIntensity = active ? 0.45 : 0;
    }
  }

  /** `sceneRoot`: SkeletonHelper computes world matrices itself, so it must
   *  hang off the scene root — inside the (moving) fighter group it would be
   *  double-transformed and drift away from the mesh. */
  async loadModel(sceneRoot: THREE.Object3D): Promise<void> {
    try {
      await this.swapInModel(sceneRoot);
    } catch (err) {
      console.error(`[3d] model swap failed for ${this.def.id}:`, err);
    }
  }

  private async swapInModel(sceneRoot: THREE.Object3D): Promise<void> {
    const gltf = await loadGlb(characterGlbUrl(this.def.id));
    if (!gltf) return;

    // scale so standing height matches the gameplay hurtbox, feet at Y=0 (V9)
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const rawH = box.max.y - box.min.y;
    const scale = (this.def.hurtStand.h * WORLD_SCALE) / (rawH || 1);
    const wrapper = new THREE.Group();
    wrapper.scale.setScalar(scale);
    model.position.y -= box.min.y; // foot contact at local origin
    wrapper.add(model);

    model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.frustumCulled = false; // skinned bounds lag the pose; never blink
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m instanceof THREE.MeshStandardMaterial) this.materials.push(m);
        }
      }
      if ((o as THREE.Bone).isBone) this.bones.push(o as THREE.Bone);
    });

    this.player = new ClipPlayer(model, gltf.animations);
    this.skeleton = new THREE.SkeletonHelper(model);
    this.skeleton.visible = false;

    this.group.remove(this.placeholder);
    this.group.scale.set(1, 1, 1); // model facing is rotation, not mirror-scale
    this.group.add(wrapper);
    sceneRoot.add(this.skeleton);
    this.modelWrapper = wrapper;
    this.model = model;
    this.modelBaseY = model.position.y;
    console.info(`[3d] ${this.def.id} model live (scale ${scale.toFixed(4)})`);
  }

  /**
   * Mixamo clips carry their own hip heights, so the posed model drifts off
   * the ground plane the engine promises. For grounded actions, snap the
   * lowest skeleton bone exactly onto the fighter's ground (feet neither
   * float nor poke through the stage floor). Airborne actions skip the snap —
   * the engine owns the jump arc and clips are root-stripped (SPEC V6/V14).
   */
  private snapFeetToGround(f: FighterState): void {
    if (!this.model || !this.modelWrapper || this.bones.length === 0) return;
    if (AIRBORNE.has(f.action.kind)) {
      this.model.position.y = this.modelBaseY;
      return;
    }
    this.group.updateMatrixWorld(true);
    let min = Infinity;
    for (const b of this.bones) min = Math.min(min, b.getWorldPosition(this.v).y);
    const worldDelta = min - this.group.position.y;
    const scale = this.modelWrapper.scale.y || 1;
    this.model.position.y -= worldDelta / scale;
  }

  update(tick: number, f: FighterState, opponent?: FighterState): void {
    const [x, y] = engineToWorld(f.x, f.y);
    this.group.position.set(x, y, 0);

    if (this.modelWrapper && this.player) {
      // our Blender FBX->GLB export lands the model facing +X (verified
      // empirically via spawn screenshot) — 0 for right, 180 for left
      this.modelWrapper.rotation.y = f.facing === 1 ? 0 : Math.PI;
      this.player.update(tick, f, this.def, opponent);
      this.snapFeetToGround(f);
      this.applyFlash(tick);
      return;
    }

    // capsule fallback: mirror-scale + posture squash
    this.group.scale.x = f.facing;
    const k = f.action.kind;
    this.group.scale.y =
      k === 'crouch' || k === 'knockdown' || k === 'ko' ? 0.55 : k === 'getup' ? 0.75 : 1;
  }
}
