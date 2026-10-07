// core/jobs.mjs — the job runner behind /__editor/jobs and studio:run.
// Synthetic in-memory workers (no child processes, no network).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { JobRunner, type Job, type JobApi } from '../../tools/core/jobs.mjs';

const dirs: string[] = [];
const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'mk-jobs-'));
  dirs.push(d);
  return d;
};
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('JobRunner', () => {
  it('runs a DAG in dependency order with pooled concurrency', async () => {
    const order: string[] = [];
    const runner = new JobRunner({
      dir: tmp(),
      concurrency: 2,
      workers: { t: async (job: Job) => { order.push(job.label); await wait(5); } },
    });
    runner.enqueueDag([
      { key: 'a', kind: 't', label: 'a' },
      { key: 'b', kind: 't', label: 'b' },
      { key: 'c', kind: 't', label: 'c', deps: ['a', 'b'] },
    ]);
    await runner.idle();
    expect(order).toHaveLength(3);
    expect(order[2]).toBe('c'); // c strictly after both deps
    expect(runner.list().every((j) => j.status === 'done')).toBe(true);
  });

  it('skips dependents when a dependency errors', async () => {
    const runner = new JobRunner({
      dir: tmp(),
      workers: { t: async (job: Job) => { if (job.label === 'boom') throw new Error('boom'); } },
    });
    runner.enqueueDag([
      { key: 'boom', kind: 't', label: 'boom' },
      { key: 'after', kind: 't', label: 'after', deps: ['boom'] },
      { key: 'free', kind: 't', label: 'free' },
    ]);
    await runner.idle();
    const byLabel = Object.fromEntries(runner.list().map((j) => [j.label, j.status]));
    expect(byLabel).toEqual({ boom: 'error', after: 'skipped', free: 'done' });
  });

  it('accounts cost and streams log lines to subscribers', async () => {
    const runner = new JobRunner({
      dir: tmp(),
      workers: { t: async (_job: Job, api: JobApi) => { api.log('wrote x'); api.cost({ assetsWritten: 1 }); api.cost({ assetsWritten: 2 }); } },
    });
    const lines: string[] = [];
    runner.subscribe((ev) => { if (ev.type === 'log') lines.push(ev.line); });
    const job = runner.enqueue({ kind: 't', label: 'cost' });
    await runner.idle();
    expect(lines).toContain('wrote x');
    expect(job.cost.assetsWritten).toBe(3);
  });

  it('loads carried-over work PAUSED and never runs it on its own (P2.8)', async () => {
    const dir = tmp();
    const a = new JobRunner({ dir, workers: { t: async () => wait(5) } });
    const done = a.enqueue({ kind: 't', label: 'interrupted', char: 'vincent' });
    await a.idle();
    // simulate a crash mid-job + a still-queued job for ANOTHER fighter
    done.status = 'running';
    a.jobs.set('jx', { ...done, id: 'jx', label: 'queued-other', char: 'yulia', status: 'queued' });
    a.persist();
    await wait(400); // let the debounced persist flush
    let ran = 0;
    const b = new JobRunner({ dir, workers: { t: async () => { ran++; } } });
    const status = (label: string) => b.list().find((j) => j.label === label)?.status;
    expect(status('interrupted')).toBe('paused');
    expect(status('queued-other')).toBe('paused');
    await b.idle(); // paused work doesn't keep the runner busy…
    await wait(30);
    expect(ran).toBe(0); // …and nothing ran (= nothing spent)
  });

  it('resumes paused jobs only for the named character', async () => {
    const dir = tmp();
    const a = new JobRunner({ dir, workers: { t: async () => undefined } });
    const v = a.enqueue({ kind: 't', label: 'v', char: 'vincent' });
    await a.idle();
    v.status = 'running';
    a.jobs.set('jy', { ...v, id: 'jy', label: 'y', char: 'yulia', status: 'queued' });
    a.persist();
    await wait(400);
    const ran: string[] = [];
    const b = new JobRunner({ dir, workers: { t: async (job: Job) => { ran.push(job.label); } } });
    expect(() => b.resume('')).toThrow();
    expect(b.resume('vincent')).toBe(1);
    await b.idle();
    expect(ran).toEqual(['v']);
    expect(b.list().find((j) => j.label === 'y')?.status).toBe('paused');
    expect(b.cancel('jy')).toBe(true); // paused work can be dropped
    expect(b.list().find((j) => j.label === 'y')?.status).toBe('cancelled');
  });

  it('cancels queued jobs and skips their dependents', async () => {
    let ran = 0;
    const runner = new JobRunner({
      dir: tmp(),
      concurrency: 1,
      workers: { t: async () => { ran++; await wait(20); } },
    });
    const [, second, third] = runner.enqueueDag([
      { key: 'run', kind: 't', label: 'run' },
      { key: 'axe', kind: 't', label: 'axe' },
      { key: 'child', kind: 't', label: 'child', deps: ['axe'] },
    ]);
    runner.cancel(second.id);
    await runner.idle();
    expect(ran).toBe(1);
    expect(second.status).toBe('cancelled');
    expect(third.status).toBe('skipped');
  });
});
