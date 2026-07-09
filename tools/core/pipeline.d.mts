// Type declarations for the auto-pilot pipeline. Keep in sync with pipeline.mjs.
import type { Job, JobApi, JobWorker } from './jobs.mjs';

export interface DagSpec {
  key: string;
  kind: string;
  label: string;
  char: string;
  deps: string[];
  estCost: Record<string, number>;
  payload: { args: string[]; mock: boolean };
}

export const STEPS: { key: string; label: string; args: string[]; deps: string[]; perChar?: boolean; est: Record<string, number> }[];
export function buildCharacterDag(charId: string, opts?: { mock?: boolean; only?: string[] | null; force?: boolean }): DagSpec[];
export function dagPrereqs(charId: string): string[];
export function cliWorker(job: Job, api: JobApi): Promise<void>;
export const WORKERS: Record<string, JobWorker>;
export function estimateDag(specs: DagSpec[]): Record<string, number>;
