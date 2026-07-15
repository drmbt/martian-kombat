// GLB loading with graceful absence: a missing file logs once and returns
// null — placeholders stay up (SPEC T7). Vite serves public/ at the base URL.
import * as THREE from 'three/webgpu';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

/** Layer for unlit additive FX (beams, glows, steam, blood, projectiles).
 *  The AO G-pass renders solid layer 0 only — transparent quads otherwise
 *  stamp the MRT normal attachment and GTAO darkens their whole rectangle. */
export const FX_LAYER = 1;

/** procedural radial falloff — glow halos, light pools, lamp heads */
export function radialTexture(stops: [number, string][] = [
  [0, 'rgba(255,255,255,1)'],
  [0.4, 'rgba(255,255,255,0.35)'],
  [1, 'rgba(255,255,255,0)'],
]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// Heavy 3D meshes (30 MB GLBs) exceed the 25 MiB Cloudflare Workers per-file
// cap, so they're excluded from the Workers upload (public/.assetsignore) and
// served from R2 instead. VITE_ASSET_BASE (e.g. https://cdn.martiankombat.com/)
// is the R2 origin; empty falls back to same-origin BASE_URL for local dev.
// See docs/3D_MODE_R2.md.
const ASSET_BASE = import.meta.env.VITE_ASSET_BASE || import.meta.env.BASE_URL;

export function characterGlbUrl(charId: string): string {
  return `${ASSET_BASE}assets/3d/characters/${charId}/${charId}.glb`;
}

export function stageGlbUrl(stageId: string): string {
  return `${ASSET_BASE}assets/3d/stages/${stageId}/stage.glb`;
}

/** Session-lived BYTE cache: scene restarts (rematch, round flow) skip the
 *  fetch and re-parse from memory — kills the capsule blink on restart.
 *  We deliberately re-parse per consumer instead of SkeletonUtils-cloning a
 *  parsed scene: the addons clone builds Skeletons from the WebGL-build
 *  classes and the WebGPU renderer silently skips those skinned meshes. */
const glbBytes = new Map<string, Promise<ArrayBuffer | null>>();

async function fetchGlbBytes(url: string): Promise<ArrayBuffer | null> {
  try {
    // no-cache: regenerated GLBs must never be served stale from HTTP cache
    const res = await fetch(url, { cache: 'no-cache' });
    // reject the vite/SPA fallback (missing file -> 200 with index.html) but
    // accept any binary type — static hosts often serve .glb as octet-stream
    if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) {
      console.info(`[3d] no asset at ${url} — placeholder stays`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(`[3d] failed to fetch ${url}:`, err);
    return null;
  }
}

/** Resolve to null when the asset doesn't exist (or fails to parse). */
export async function loadGlb(url: string): Promise<GLTF | null> {
  let bytes = glbBytes.get(url);
  if (!bytes) {
    bytes = fetchGlbBytes(url);
    glbBytes.set(url, bytes);
  }
  const buffer = await bytes;
  if (!buffer) return null;
  try {
    const gltf = await new Promise<GLTF>((resolve, reject) => loader.parse(buffer, '', resolve, reject));
    console.info(`[3d] parsed ${url} (${gltf.animations.length} clips)`);
    return gltf;
  } catch (err) {
    console.warn(`[3d] failed to parse ${url}:`, err);
    return null;
  }
}
