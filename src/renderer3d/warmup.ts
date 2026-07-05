// Pre-boot the 3D renderer while the VS screen (local) / stage-settle (online)
// is up, so the heavy work — importing the three chunk, spinning up the WebGPU
// device, and streaming + parsing the character GLBs — overlaps a screen the
// player is already looking at instead of a black screen after it. FightScene3D
// then adopts the warmed renderer instead of booting its own.
//
// One warm slot, keyed by matchup+stage. Starting a warmup for a new key
// discards the old (a different match was picked). takeWarm() hands off the
// warmed renderer (or boots fresh if there was no matching warmup).
import type { Defs } from '../engine';
import { characters } from '../data/characters';
import { stageById } from '../data/stages';
import type { ThreeFightRenderer } from './ThreeFightRenderer';
import type { PlaceholderKind, Stage2DLayer } from './ThreeStageView';

type Chars = [string, string];

interface Warm {
  key: string;
  promise: Promise<ThreeFightRenderer | null>;
}

let warm: Warm | null = null;

const keyOf = (chars: Chars, stageId: string): string => `${chars[0]}|${chars[1]}|${stageId}`;

/** compute the room + 2D-bridge stage layers the renderer needs (was inline in
 *  FightScene3D.bootRenderer). Dev `?room=` overrides still apply. */
function roomFor(stageId: string): { room: PlaceholderKind; stage2d?: Stage2DLayer[] } {
  const roomParam =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('room') : null;
  const room: PlaceholderKind =
    stageId === 'test-room' || roomParam === 'test'
      ? 'test-room'
      : roomParam === 'street'
        ? 'street'
        : '2d';
  if (room !== '2d') return { room };
  const entry = stageById(stageId);
  const l = entry?.layers;
  const stage2d = l
    ? [
        { file: l.sky!.file, factor: l.sky?.factor ?? 0.14 },
        { file: l.far!.file, factor: l.far?.factor ?? 0.34 },
        { file: l.near!.file, factor: l.near?.factor ?? 0.68 },
        { file: l.floor!.file, factor: l.floor?.factor ?? 1 },
      ]
    : entry
      ? [{ file: entry.file, factor: 0.32 }]
      : undefined;
  return { room, stage2d };
}

async function boot(chars: Chars, stageId: string, defs: Defs): Promise<ThreeFightRenderer | null> {
  const { ThreeFightRenderer } = await import('./ThreeFightRenderer');
  const { room, stage2d } = roomFor(stageId);
  const renderer = new ThreeFightRenderer(defs, chars, room, stage2d);
  await renderer.init(stageId); // models + stage + pipelines — the slow part
  return renderer;
}

/** kick off (or reuse) a warmup for this matchup. Idempotent per key. */
export function warmupRenderer(chars: Chars, stageId: string): void {
  const key = keyOf(chars, stageId);
  if (warm?.key === key) return;
  warm = { key, promise: boot(chars, stageId, characters).catch(() => null) };
}

/** hand off the warmed renderer for this matchup, or boot fresh if none was
 *  warming this exact match. The caller owns disposing it. */
export function takeWarmRenderer(chars: Chars, stageId: string): Promise<ThreeFightRenderer | null> {
  const key = keyOf(chars, stageId);
  const hit = warm?.key === key ? warm.promise : boot(chars, stageId, characters).catch(() => null);
  warm = null; // consumed — next match warms afresh
  return hit;
}
