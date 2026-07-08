// Impact presentation for the 3D path (SPEC T20/T22/T23, V15/V16):
// - billboard quads reusing the 2D spark/per-move overlay art
// - instanced blood spray (gore greenlit — direction follows impact velocity)
// - projectile pool reusing the 2D projectile pngs + additive glow + light
// Everything is renderer-side; randomness is tick-hashed, never engine RNG.
import * as THREE from 'three/webgpu';
import type { CharacterDef, GameState, Projectile } from '../engine';
import { FLOOR_Y } from '../engine';
import type { Defs } from '../engine';
import { engineToWorld, WORLD_SCALE } from './threeCoordinates';
import { FX_LAYER, radialTexture } from './threeAssets';
import assetManifest from '../data/assetManifest.json';

const BASE = import.meta.env.BASE_URL;
// chars that still ship a legacy single projectile.png — same gate BootScene
// uses, so we never request (and 404) art the manifest says doesn't exist
const HAS_LEGACY_PROJ = new Set<string>(assetManifest.legacyProj);

/** deterministic-enough presentation rand: hash a seed into [0,1) */
function hash01(seed: number): number {
  let h = (seed | 0) * 2654435761;
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}

interface Billboard {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  max: number;
  grow: number;
  active: boolean;
}

const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);

interface BloodDrop {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
}

const BLOOD_CAP = 512;
const SPLAT_CAP = 64;
const GRAVITY = 14; // m/s² — heavier than earth reads punchier
const TICK = 1 / 60;

export class ThreeFxSystem {
  readonly group = new THREE.Group();
  private loader = new THREE.TextureLoader();
  private textures = new Map<string, THREE.Texture | 'loading' | 'missing'>();

  private billboards: Billboard[] = [];

  private blood: THREE.InstancedMesh;
  private drops: BloodDrop[] = [];
  private splats: THREE.InstancedMesh;
  private splatLives: number[] = [];
  private splatCursor = 0;
  private dummy = new THREE.Object3D();

  private projMeshes: {
    sprite: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    glow: THREE.Mesh;
    glowMat: THREE.MeshBasicMaterial;
  }[] = [];
  /** ALWAYS in the scene at intensity 0 when unused: toggling a light's
   *  presence (e.g. hiding its parent sprite) changes the light count and
   *  forces a pipeline rehash of every lit material — the first-projectile
   *  stutter. Four is the illumination cap from T23. */
  private projLights: THREE.PointLight[] = [];
  private glowTexture: THREE.Texture;
  private ownerColors = new Map<string, THREE.Color>();

  constructor(private defs: Defs) {
    // circle, not quad: stretched drops read as ellipses instead of rectangles
    const dropGeo = new THREE.CircleGeometry(0.5, 7);
    const dropMat = new THREE.MeshBasicMaterial({ color: 0x9e0e12, transparent: true, opacity: 0.95 });
    this.blood = new THREE.InstancedMesh(dropGeo, dropMat, BLOOD_CAP);
    this.blood.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.blood.count = 0;
    this.blood.frustumCulled = false;
    this.blood.layers.set(FX_LAYER);
    for (let i = 0; i < BLOOD_CAP; i++) this.drops.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0 });

    const splatGeo = new THREE.CircleGeometry(0.5, 8);
    const splatMat = new THREE.MeshBasicMaterial({ color: 0x6d090c, transparent: true, opacity: 0.85 });
    this.splats = new THREE.InstancedMesh(splatGeo, splatMat, SPLAT_CAP);
    this.splats.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.splats.count = 0;
    this.splats.frustumCulled = false;
    this.splats.layers.set(FX_LAYER);
    this.splatLives = new Array(SPLAT_CAP).fill(0);

    this.group.add(this.blood, this.splats);
    this.glowTexture = radialTexture();
    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 7, 1.8);
      this.group.add(light);
      this.projLights.push(light);
    }
  }

  // ---------- textures ----------

  private texture(url: string): THREE.Texture | null {
    const cached = this.textures.get(url);
    if (cached === 'missing' || cached === 'loading') return null;
    if (cached) return cached;
    this.textures.set(url, 'loading');
    this.loader.load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        this.textures.set(url, t);
      },
      undefined,
      () => this.textures.set(url, 'missing'),
    );
    return null;
  }

  private fightTextureUrls(charIds: string[]): string[] {
    const urls = ['spark-hit', 'spark-heavy', 'spark-block', 'dizzy'].map((k) => `${BASE}assets/vfx/${k}.png`);
    for (const id of charIds) {
      if (HAS_LEGACY_PROJ.has(id)) urls.push(`${BASE}assets/sprites/${id}/projectile.png`);
      const def = this.defs[id];
      for (const [moveId, m] of Object.entries(def.moves)) {
        if (m.projectile) {
          urls.push(`${BASE}assets/sprites/${id}/projectile-${moveId}.png`);
          if (m.projectile.detonate) urls.push(`${BASE}assets/sprites/${id}/projectile-${moveId}-burst.png`);
        }
        if (m.vfx) urls.push(`${BASE}assets/sprites/${id}/vfx-${moveId}.png`);
      }
    }
    return urls;
  }

  /** Await EVERY texture the fight can use — first-use uploads mid-combo are
   *  the stutter the perf pass measured. 404s cache as 'missing' as before. */
  async preloadAll(charIds: string[]): Promise<void> {
    await Promise.all(
      this.fightTextureUrls(charIds).map(async (url) => {
        if (this.textures.has(url)) return;
        this.textures.set(url, 'loading');
        try {
          const t = await this.loader.loadAsync(url);
          t.colorSpace = THREE.SRGBColorSpace;
          this.textures.set(url, t);
        } catch {
          this.textures.set(url, 'missing');
        }
      }),
    );
  }

  /** Instantiate one of every material/pipeline variant the fight can hit —
   *  projectile sprites+glows, both billboard blend modes, blood, splats,
   *  dizzy — so renderer.compileAsync builds all pipelines up front. Pass
   *  false to stow the prewarm instances again. */
  prewarm(on: boolean, charIds: [string, string]): void {
    if (on) {
      // projectile pool: 4 entries, each bound to a real projectile texture
      const texUrls = this.fightTextureUrls(charIds).filter((u) => u.includes('projectile'));
      while (this.projMeshes.length < 4) this.allocProjEntry();
      this.projMeshes.forEach((e, i) => {
        const tex = this.texture(texUrls[i % Math.max(texUrls.length, 1)] ?? '');
        if (tex) {
          e.mat.map = tex;
          e.mat.needsUpdate = true;
        }
        e.sprite.visible = true;
        e.sprite.scale.setScalar(0.0001);
        e.glow.visible = true;
        e.glow.scale.setScalar(0.0001);
      });
      // one billboard per blend mode, with a spark texture bound
      this.spawnBillboard(`${BASE}assets/vfx/spark-hit.png`, 480, 300, 0.01, { additive: true });
      this.spawnBillboard(`${BASE}assets/vfx/spark-heavy.png`, 480, 300, 0.01, { additive: false });
      // one blood drop + one splat so the instanced pipelines exist
      this.drops[0].alive = true;
      this.drops[0].size = 0.0001;
      this.drops[0].y = 0.5;
      this.blood.count = 1;
      this.addSplat(0, -50, 0.0001);
      // dizzy quads for both slots
      for (const slot of [0, 1] as const) {
        if (!this.dizzy[slot]) {
          const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
          mat.map = this.texture(`${BASE}assets/vfx/dizzy.png`);
          const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), mat);
          mesh.renderOrder = 21;
          mesh.layers.set(FX_LAYER);
          mesh.scale.setScalar(0.0001);
          this.group.add(mesh);
          this.dizzy[slot] = mesh;
        }
        this.dizzy[slot]!.visible = true;
      }
    } else {
      for (const e of this.projMeshes) {
        e.sprite.visible = false;
        e.glow.visible = false;
      }
      for (const l of this.projLights) l.intensity = 0;
      for (const b of this.billboards) {
        b.active = false;
        b.mesh.visible = false;
      }
      this.drops[0].alive = false;
      this.blood.count = 0;
      for (const d of this.dizzy) {
        if (d) d.visible = false;
      }
    }
  }

  // ---------- billboards (sparks + per-move overlays) ----------

  spawnBillboard(
    url: string | null,
    ex: number,
    ey: number,
    sizePx: number,
    opts: { tint?: number; flip?: boolean; additive?: boolean } = {},
  ): void {
    const tex = url ? this.texture(url) : null;
    // pooled: geometry is shared, meshes/materials are reused — spawning a
    // spark mid-combo must not allocate or recompile anything after warmup
    let b = this.billboards.find((e) => !e.active);
    if (!b) {
      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(UNIT_PLANE, mat);
      mesh.renderOrder = 20;
      mesh.layers.set(FX_LAYER);
      this.group.add(mesh);
      b = { mesh, mat, life: 0, max: 14, grow: 0, active: false };
      this.billboards.push(b);
    }
    const blending = opts.additive || !tex ? THREE.AdditiveBlending : THREE.NormalBlending;
    if (b.mat.map !== tex || b.mat.blending !== blending) {
      b.mat.map = tex;
      b.mat.blending = blending;
      b.mat.needsUpdate = true;
    }
    b.mat.color.setHex(opts.tint ?? 0xffffff);
    b.mat.opacity = 1;
    const size = sizePx * WORLD_SCALE;
    const [x, y] = engineToWorld(ex, ey);
    b.mesh.position.set(x, y, 0.25);
    b.mesh.scale.set(opts.flip ? -size : size, size, 1);
    b.mesh.visible = true;
    b.life = 14;
    b.max = 14;
    b.grow = size * 0.04;
    b.active = true;
  }

  /** hit spark parity with FightScene.spawnHitVfx (per-move art > spark) */
  spawnHitFx(state: GameState, slot: 0 | 1, counter: boolean, heavy: boolean): void {
    const f = state.fighters[slot];
    const atk = state.fighters[slot === 0 ? 1 : 0];
    const atkDef = this.defs[atk.charId];
    const a = atk.action;
    const move = a.kind === 'attack' || a.kind === 'airAttack' ? atkDef.moves[a.moveId!] : undefined;
    const ix = f.x - f.facing * 20;
    const iy = f.y - 150;

    if (counter) {
      this.spawnBillboard(`${BASE}assets/vfx/spark-heavy.png`, ix, iy, 155, {
        tint: 0xff3b30,
        flip: atk.facing === -1,
        additive: true,
      });
      return;
    }
    if (move?.vfx) {
      const size = move.vfx.size ?? 160;
      const ground = move.vfx.anchor === 'ground';
      this.spawnBillboard(
        `${BASE}assets/sprites/${atk.charId}/vfx-${a.moveId}.png`,
        ground ? f.x : ix,
        ground ? FLOOR_Y - size * 0.3 : iy,
        size,
        { flip: atk.facing === -1 },
      );
      return;
    }
    const tint = new THREE.Color(atkDef.color).getHex();
    this.spawnBillboard(
      `${BASE}assets/vfx/${heavy ? 'spark-heavy' : 'spark-hit'}.png`,
      ix,
      iy,
      heavy ? 135 : 90,
      { tint, additive: true },
    );
  }

  spawnBlockFx(state: GameState, slot: 0 | 1): void {
    const f = state.fighters[slot];
    this.spawnBillboard(`${BASE}assets/vfx/spark-block.png`, f.x + f.facing * 42, f.y - 130, 95, {
      tint: 0xa8c8ff,
      flip: f.facing === 1,
      additive: true,
    });
  }

  spawnDust(state: GameState, slot: 0 | 1): void {
    const f = state.fighters[slot];
    this.spawnBillboard(`${BASE}assets/vfx/spark-hit.png`, f.x, FLOOR_Y - 16, 95, {
      tint: 0xcbb894,
      additive: true,
    });
  }

  // ---------- blood (SPEC V16) ----------

  /** dir: +1 spray right, -1 left (impact velocity direction = attacker facing) */
  spawnBlood(ex: number, ey: number, dir: 1 | -1, amount: number, tick: number): void {
    const [x, y] = engineToWorld(ex, ey);
    let spawned = 0;
    for (let i = 0; i < BLOOD_CAP && spawned < amount; i++) {
      const d = this.drops[i];
      if (d.alive) continue;
      const r1 = hash01(tick * 131 + i * 7);
      const r2 = hash01(tick * 733 + i * 13);
      const r3 = hash01(tick * 397 + i * 29);
      d.alive = true;
      d.x = x;
      d.y = y + (r1 - 0.5) * 0.25;
      d.z = (r2 - 0.5) * 0.35;
      // cone toward `dir`, MK-style: fast forward, upward scatter, some depth
      d.vx = dir * (1.2 + r1 * 3.6);
      d.vy = 0.8 + r2 * 3.4;
      d.vz = (r3 - 0.5) * 1.8;
      // mostly droplets, occasional fat blob that lobs out slower
      d.size = 0.028 + r3 * r3 * 0.075;
      if (r2 > 0.9) {
        d.size *= 2;
        d.vx *= 0.55;
        d.vy *= 0.8;
      }
      spawned++;
    }
  }

  private simBlood(dtTicks: number): void {
    const dt = dtTicks * TICK;
    if (dt <= 0) return;
    let count = 0;
    for (const d of this.drops) {
      if (!d.alive) continue;
      d.vy -= GRAVITY * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      if (d.y <= 0) {
        d.alive = false;
        // only fat drops leave a mark — light hits shouldn't repaint the street
        if (d.size > 0.06 || hash01((d.x * 977 + d.z * 389) | 0) < 0.14) {
          this.addSplat(d.x, d.z, d.size);
        }
        continue;
      }
      // stretch along velocity ∝ speed — fast droplets streak, blobs stay fat
      // and readable from the side view instead of thinning into slivers
      const speed = Math.hypot(d.vx, d.vy);
      this.dummy.position.set(d.x, d.y, d.z);
      this.dummy.scale.set(d.size * Math.min(1 + speed * 0.12, 1.6), d.size, 1);
      // full reset: the shared dummy still carries the floor-splat's X-flip
      // otherwise, which laid mid-flight drops flat (the "facing up" bug).
      // 0,0,z keeps the quad camera-facing on the +Z view axis.
      this.dummy.rotation.set(0, 0, Math.atan2(d.vy, d.vx));
      this.dummy.updateMatrix();
      this.blood.setMatrixAt(count++, this.dummy.matrix);
    }
    this.blood.count = count;
    this.blood.instanceMatrix.needsUpdate = true;
  }

  private addSplat(x: number, z: number, size: number): void {
    const i = this.splatCursor;
    this.splatCursor = (this.splatCursor + 1) % SPLAT_CAP;
    this.splatLives[i] = 240; // ~4s
    this.dummy.position.set(x, 0.002, z);
    this.dummy.rotation.set(-Math.PI / 2, 0, 0);
    const s = size * (1.3 + hash01(i * 97) * 1.1);
    this.dummy.scale.set(s * 1.15, s, 1);
    this.dummy.updateMatrix();
    this.splats.setMatrixAt(i, this.dummy.matrix);
    this.splats.count = Math.max(this.splats.count, i + 1);
    this.splats.instanceMatrix.needsUpdate = true;
  }

  private simSplats(dtTicks: number): void {
    for (let i = 0; i < this.splats.count; i++) {
      if (this.splatLives[i] <= 0) continue;
      this.splatLives[i] -= dtTicks;
      if (this.splatLives[i] <= 0) {
        this.dummy.position.set(0, -10, 0); // park expired splats out of view
        this.dummy.scale.setScalar(0.0001);
        this.dummy.updateMatrix();
        this.splats.setMatrixAt(i, this.dummy.matrix);
        this.splats.instanceMatrix.needsUpdate = true;
      }
    }
  }

  // ---------- projectiles (SPEC T23) ----------

  private projTexture(p: Projectile, ownerChar: string): THREE.Texture | null {
    return (
      this.texture(`${BASE}assets/sprites/${ownerChar}/projectile-${p.moveId}.png`) ??
      (HAS_LEGACY_PROJ.has(ownerChar)
        ? this.texture(`${BASE}assets/sprites/${ownerChar}/projectile.png`)
        : null)
    );
  }

  private allocProjEntry(): void {
    // additive: magic reads as energy AND black-fringed pngs lose the fringe
    // (black adds nothing) — fixes the ugly dark squares around projectiles
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    sprite.renderOrder = 15;
    sprite.layers.set(FX_LAYER);
    const glowMat = new THREE.MeshBasicMaterial({
      map: this.glowTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat);
    glow.renderOrder = 14;
    glow.layers.set(FX_LAYER);
    this.group.add(sprite, glow);
    this.projMeshes.push({ sprite, mat, glow, glowMat });
  }

  private syncProjectiles(state: GameState): void {
    while (this.projMeshes.length < state.projectiles.length) this.allocProjEntry();
    this.projMeshes.forEach((entry, i) => {
      const p = state.projectiles[i];
      const light = this.projLights[i];
      if (!p) {
        entry.sprite.visible = false;
        entry.glow.visible = false;
        if (light) light.intensity = 0;
        return;
      }
      const ownerChar = state.fighters[p.owner].charId;
      const [x, y] = engineToWorld(p.x + p.box.x + p.box.w / 2, p.y + p.box.y + p.box.h / 2);
      const w = Math.max(p.box.w, 24) * WORLD_SCALE * 1.6;
      const h = Math.max(p.box.h, 24) * WORLD_SCALE * 1.6;
      let color = this.ownerColors.get(ownerChar);
      if (!color) {
        color = new THREE.Color(this.defs[ownerChar].color);
        this.ownerColors.set(ownerChar, color);
      }
      entry.sprite.visible = true;
      entry.sprite.position.set(x, y, 0.1);
      entry.sprite.scale.set(p.vx < 0 ? -w : w, h, 1);
      // needsUpdate recompiles the material — only pay it when the texture
      // actually changes (arrives from the loader / detonation morph)
      const tex = this.projTexture(p, ownerChar);
      if (entry.mat.map !== tex) {
        entry.mat.map = tex;
        entry.mat.needsUpdate = true;
      }
      entry.mat.opacity = p.field ? 0.5 : p.fuse > 0 ? 0.75 : 1;
      entry.glow.visible = !p.field;
      entry.glow.position.set(x, y, 0.05);
      const gs = Math.max(w, h) * 2.6;
      entry.glow.scale.set(gs, gs, 1);
      entry.glowMat.color = color;
      entry.glowMat.opacity = 0.85;
      if (light) {
        light.position.set(x, y, 0.4);
        light.color = color;
        light.intensity = p.field ? 0 : 18;
      }
    });
  }

  // ---------- dizzy stars (parity with the 2D vfx-dizzy overlay) ----------

  private dizzy: [THREE.Mesh | null, THREE.Mesh | null] = [null, null];

  private syncDizzy(state: GameState): void {
    for (const slot of [0, 1] as const) {
      const f = state.fighters[slot];
      const dazed = f.action.kind === 'dazed';
      let mesh = this.dizzy[slot];
      if (dazed && !mesh) {
        const mat = new THREE.MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          // normal blending: additive + bloom blew the quad out into a
          // white rectangle; the png has proper alpha, let it composite
        });
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), mat);
        mesh.renderOrder = 21;
        mesh.layers.set(FX_LAYER);
        this.group.add(mesh);
        this.dizzy[slot] = mesh;
      }
      if (!mesh) continue;
      // late-bind the texture: the loader resolves async, and a mapless
      // white quad must never show (the "rotating white square" bug)
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (!mat.map) {
        mat.map = this.texture(`${BASE}assets/vfx/dizzy.png`);
        if (mat.map) mat.needsUpdate = true;
      }
      mesh.visible = dazed && mat.map !== null;
      if (dazed) {
        const def = this.defs[f.charId];
        const [x, y] = engineToWorld(f.x, f.y - def.hurtStand.h - 18);
        mesh.position.set(x, y, 0.2);
        mesh.rotation.z = state.tick * 0.12; // lazy orbit spin
      }
    }
  }

  // ---------- per-frame ----------

  update(dtTicks: number, state: GameState): void {
    for (const b of this.billboards) {
      if (!b.active) continue;
      b.life -= dtTicks;
      if (b.life <= 0) {
        b.active = false;
        b.mesh.visible = false;
        continue;
      }
      const t = b.life / b.max;
      b.mat.opacity = t;
      // grow-and-fade like the 2D overlay sprites
      const growFactor = 1 + b.grow * dtTicks;
      b.mesh.scale.x *= growFactor;
      b.mesh.scale.y *= growFactor;
    }
    this.simBlood(dtTicks);
    this.simSplats(dtTicks);
    this.syncProjectiles(state);
    this.syncDizzy(state);
  }
}
