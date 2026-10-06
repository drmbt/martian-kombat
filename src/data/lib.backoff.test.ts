// tools/lib.mjs withBackoff: transient upstream failures (429/5xx AND
// network-level "fetch failed") retry with backoff; real errors don't.
import { describe, expect, it } from 'vitest';
import { withBackoff } from '../../tools/lib.mjs';

const flaky = (failures: Error[]) => {
  let n = 0;
  return async (): Promise<string> => {
    if (n < failures.length) throw failures[n++];
    return 'ok';
  };
};
const status = (code: number): Error => Object.assign(new Error(`http ${code}`), { status: code });

describe('withBackoff', () => {
  it('retries 503s and network-level fetch failures, then succeeds', async () => {
    const fn = flaky([status(503), new TypeError('fetch failed'), status(429)]);
    await expect(withBackoff(fn, { tries: 5, baseMs: 1, label: 't' })).resolves.toBe('ok');
  });
  it('does not retry a non-transient error', async () => {
    const fn = flaky([status(400)]);
    await expect(withBackoff(fn, { tries: 5, baseMs: 1, label: 't' })).rejects.toThrow('http 400');
  });
  it('gives up after `tries`', async () => {
    const fn = flaky([status(503), status(503), status(503)]);
    await expect(withBackoff(fn, { tries: 2, baseMs: 1, label: 't' })).rejects.toThrow('http 503');
  });
});
