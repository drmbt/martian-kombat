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

export function characterGlbUrl(charId: string): string {
  return `${import.meta.env.BASE_URL}assets/3d/characters/${charId}/${charId}.glb`;
}

export function stageGlbUrl(stageId: string): string {
  return `${import.meta.env.BASE_URL}assets/3d/stages/${stageId}/stage.glb`;
}

/** Resolve to null when the asset doesn't exist (or fails to parse). */
export async function loadGlb(url: string): Promise<GLTF | null> {
  // probe first: GLTFLoader treats vite's HTML 404 page as a corrupt GLB
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (!head.ok || !(head.headers.get('content-type') ?? '').includes('gltf-binary')) {
      console.info(`[3d] no asset at ${url} — placeholder stays`);
      return null;
    }
    const gltf = await loader.loadAsync(url);
    console.info(`[3d] loaded ${url} (${gltf.animations.length} clips)`);
    return gltf;
  } catch (err) {
    console.warn(`[3d] failed to load ${url}:`, err);
    return null;
  }
}
