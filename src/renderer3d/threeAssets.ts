// GLB loading with graceful absence: a missing file logs once and returns
// null — placeholders stay up (SPEC T7). Vite serves public/ at the base URL.
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

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
