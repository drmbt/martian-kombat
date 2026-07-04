import { ROSTER } from './data/roster';
import { STAGES } from './data/stages';

export type LaunchData = Record<string, unknown>;

export interface LaunchTarget {
  scene: string;
  data?: LaunchData;
}

const KEY = 'martian-kombat:dev-launch';

const randomPick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
const DEV_STAGE = STAGES.some((s) => s.id === 'chiba-roof') ? 'chiba-roof' : randomPick(STAGES).id;

export function randomFight(): LaunchTarget {
  const playable = ROSTER.filter((r) => r.playable).map((r) => r.id);
  return {
    scene: 'Fight',
    data: {
      p1: randomPick(playable),
      p2: randomPick(playable),
      stage: DEV_STAGE,
      cpu: true,
    },
  };
}

export function randomTraining(): LaunchTarget {
  const playable = ROSTER.filter((r) => r.playable).map((r) => r.id);
  return {
    scene: 'Fight',
    data: {
      p1: randomPick(playable),
      p2: randomPick(playable),
      stage: DEV_STAGE,
      training: true,
    },
  };
}

export function random3dFight(): LaunchTarget {
  // ?p1= / ?p2= pick the matchup (vincent, flo, yulia have GLBs so far);
  // anyone else gets the capsule placeholder
  const params = new URLSearchParams(window.location.search);
  return {
    scene: 'Fight3D',
    data: {
      p1: params.get('p1') ?? 'vincent',
      p2: params.get('p2') ?? 'vincent',
      stage: DEV_STAGE,
      cpu: true,
    },
  };
}

export function devBootTarget(): LaunchTarget | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const directFight = params.get('fight') === 'random' || params.get('dev') === 'fight';
  if (directFight) return randomFight();
  if (params.get('dev') === 'training') return randomTraining();
  if (params.get('dev') === '3d') return random3dFight();

  const saved = window.sessionStorage.getItem(KEY);
  if (!saved) return null;
  try {
    const target = JSON.parse(saved) as LaunchTarget;
    if (!target.scene || target.scene === 'Boot' || target.scene === 'Volume') return null;
    return target;
  } catch {
    window.sessionStorage.removeItem(KEY);
    return null;
  }
}

export function rememberDevLaunch(scene: string, data?: LaunchData): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  if (scene === 'Boot' || scene === 'Volume') return;
  window.sessionStorage.setItem(KEY, JSON.stringify({ scene, data: data ?? {} }));
}
