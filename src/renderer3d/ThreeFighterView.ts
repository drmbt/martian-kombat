// Placeholder fighter presentation: a capsule sized off the character's
// standing hurtbox, tinted their UI color, with a nose block marking facing.
// Replaced by the GLB + AnimationMixer path (SPEC T8/T9); position/facing
// logic stays — the engine owns all translation (SPEC V1, V6).
import * as THREE from 'three/webgpu';
import type { CharacterDef, FighterState } from '../engine';
import { engineToWorld, WORLD_SCALE } from './threeCoordinates';

export class ThreeFighterView {
  readonly group = new THREE.Group();

  constructor(def: CharacterDef) {
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
    this.group.add(body, nose);
  }

  update(f: FighterState): void {
    const [x, y] = engineToWorld(f.x, f.y);
    this.group.position.set(x, y, 0);
    // engine facing 1 = +X; mirror the whole rig when facing left
    this.group.scale.x = f.facing;
    // crude posture cue until animation clips land (T9)
    const k = f.action.kind;
    this.group.scale.y =
      k === 'crouch' || k === 'knockdown' || k === 'ko' ? 0.55 : k === 'getup' ? 0.75 : 1;
  }
}
