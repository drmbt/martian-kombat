// Type declarations for the job runner. Keep in sync with jobs.mjs.
export interface Job {
  id: string;
  kind: string;
  label: string;
  char?: string;
  payload: Record<string, unknown>;
  deps: string[];
  estCost: Record<string, number>;
  status: 'queued' | 'running' | 'done' | 'error' | 'skipped' | 'cancelled';
  log: string[];
  cost: Record<string, number>;
  error?: string;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  cancelRequested?: boolean;
}

export interface JobApi {
  log(line: string): void;
  cost(patch: Record<string, number>): void;
  onCancel(fn: () => void): void;
  isCancelled(): boolean;
}

export type JobWorker = (job: Job, api: JobApi) => Promise<void>;

export type JobEvent =
  | { type: 'snapshot'; jobs: Job[] }
  | { type: 'job'; job: Job }
  | { type: 'log'; id: string; line: string }
  | { type: 'cost'; id: string; cost: Record<string, number> };

export class JobRunner {
  constructor(opts: { dir: string; workers: Record<string, JobWorker>; concurrency?: number });
  jobs: Map<string, Job>;
  enqueue(spec: { kind: string; label?: string; char?: string; payload?: Record<string, unknown>; deps?: string[]; estCost?: Record<string, number> }): Job;
  enqueueDag(specs: { key: string; kind: string; label?: string; char?: string; payload?: Record<string, unknown>; deps?: string[]; estCost?: Record<string, number> }[]): Job[];
  subscribe(fn: (ev: JobEvent) => void): () => void;
  cancel(id: string): boolean;
  list(): Job[];
  idle(): Promise<void>;
  busy(): boolean;
}
