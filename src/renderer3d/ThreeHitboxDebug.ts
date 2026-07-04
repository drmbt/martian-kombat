// Translucent debug cuboids mirroring the 2D F1 overlay in 3D space.
// SPEC V2: every rect comes from the engine's worldBox/projRect math —
// nothing here re-derives geometry, so a mesh pose that disagrees with a
// cuboid is a MODEL problem, never a gameplay one.
import * as THREE from 'three/webgpu';
import { GameState, resolveMove, worldBox } from '../engine';
import type { Defs } from '../engine';
import { rectToCuboid } from './threeCoordinates';

// hurt blue · body/push white · startup amber · active red · recovery grey ·
// projectile yellow · throw purple (SPEC V2 color contract)
const COLORS = {
  hurt: 0x3b82f6,
  body: 0xffffff,
  startup: 0xffc53d,
  hit: 0xef4444,
  /** active frames AFTER the move already connected (hasHit) — spent */
  spent: 0x7f3a4a,
  recovery: 0x9ca3af,
  projectile: 0xfacc15,
  throw: 0xa855f7,
  /** hitbox ∩ hurtbox overlap — the actual region damage applies to */
  impact: 0xffffff,
} as const;
type BoxKind = keyof typeof COLORS;

interface PoolEntry {
  mesh: THREE.Mesh;
  edges: THREE.LineSegments;
  kind: BoxKind | null;
}

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_EDGES = new THREE.EdgesGeometry(UNIT_BOX);

export class ThreeHitboxDebug {
  readonly group = new THREE.Group();
  private pool: PoolEntry[] = [];
  private used = 0;
  private materials = new Map<BoxKind, { fill: THREE.MeshBasicMaterial; line: THREE.LineBasicMaterial }>();

  constructor() {
    this.group.visible = false;
    for (const [kind, color] of Object.entries(COLORS) as [BoxKind, number][]) {
      this.materials.set(kind, {
        fill: new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          // the impact overlap is the payload — render it hot
          opacity: kind === 'impact' ? 0.55 : 0.18,
          depthWrite: false,
        }),
        line: new THREE.LineBasicMaterial({ color }),
      });
    }
  }

  set visible(on: boolean) {
    this.group.visible = on;
  }

  get visible(): boolean {
    return this.group.visible;
  }

  update(state: GameState, defs: Defs): void {
    if (!this.group.visible) return;
    this.used = 0;

    // hurt rects first — attack passes below overlap-test against them to
    // show WHERE damage applies (2D F1 parity, but volumetric)
    const hurtRects = [0, 1].map((slot) => {
      const f = state.fighters[slot];
      const def = defs[f.charId];
      const crouched =
        f.action.kind === 'crouch' ||
        (f.action.kind === 'attack' && f.action.moveId?.startsWith('c'));
      return worldBox(f, crouched ? def.hurtCrouch : def.hurtStand);
    });

    for (const slot of [0, 1] as const) {
      const f = state.fighters[slot];
      const def = defs[f.charId];
      this.place('hurt', hurtRects[slot]);
      this.place('body', worldBox(f, def.bodyBox));

      const a = f.action;
      if ((a.kind === 'attack' || a.kind === 'airAttack') && a.moveId) {
        const m = resolveMove(def.moves[a.moveId], a.strength);
        if (m.hitbox) {
          const active = a.frame >= m.startup && a.frame < m.startup + m.active;
          const kind: BoxKind =
            a.frame < m.startup ? 'startup' : active ? (a.hasHit ? 'spent' : 'hit') : 'recovery';
          const hb = worldBox(f, m.hitbox);
          this.place(kind, hb);
          // the money shot: live hitbox ∩ opponent hurtbox = damage region
          if (active) {
            const opp = hurtRects[slot === 0 ? 1 : 0];
            const ix = {
              l: Math.max(hb.l, opp.l),
              r: Math.min(hb.r, opp.r),
              t: Math.max(hb.t, opp.t),
              b: Math.min(hb.b, opp.b),
            };
            if (ix.l < ix.r && ix.t < ix.b) this.place('impact', ix);
          }
        }
        if (m.grab && a.frame >= m.startup && a.frame < m.startup + m.active) {
          const front = f.facing === 1 ? f.x : f.x - m.grab.range;
          this.place('throw', { l: front, r: front + m.grab.range, t: f.y - 120, b: f.y });
        }
      }
    }

    for (const p of state.projectiles) {
      this.place('projectile', {
        l: p.x + p.box.x,
        t: p.y + p.box.y,
        r: p.x + p.box.x + p.box.w,
        b: p.y + p.box.y + p.box.h,
      });
    }

    for (let i = this.used; i < this.pool.length; i++) {
      this.pool[i].mesh.visible = false;
      this.pool[i].edges.visible = false;
    }
  }

  private place(kind: BoxKind, rect: { l: number; r: number; t: number; b: number }): void {
    let entry = this.pool[this.used];
    if (!entry) {
      entry = {
        mesh: new THREE.Mesh(UNIT_BOX),
        edges: new THREE.LineSegments(UNIT_EDGES),
        kind: null,
      };
      entry.mesh.renderOrder = 10;
      this.group.add(entry.mesh, entry.edges);
      this.pool.push(entry);
    }
    const mats = this.materials.get(kind)!;
    if (entry.kind !== kind) {
      entry.mesh.material = mats.fill;
      entry.edges.material = mats.line;
      entry.kind = kind;
    }
    const c = rectToCuboid(rect);
    entry.mesh.position.set(c.cx, c.cy, 0);
    entry.mesh.scale.set(c.w, c.h, c.d);
    entry.edges.position.copy(entry.mesh.position);
    entry.edges.scale.copy(entry.mesh.scale);
    entry.mesh.visible = true;
    entry.edges.visible = true;
    this.used++;
  }
}
