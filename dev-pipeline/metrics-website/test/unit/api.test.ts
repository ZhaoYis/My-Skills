import { describe, expect, it, vi } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

import { fetchMetrics, isMetricsApiError, MetricsApiError } from '../../lib/api';

function response(status: number, payload: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json', 'x-request-id': 'request-test' },
    }),
  );
}

describe('metrics API error classification', () => {
  it('returns successful data including a real empty result', async () => {
    const data = await fetchMetrics<{ totalRuns: number }>('http://metrics.test', {}, () =>
      response(200, { success: true, data: { totalRuns: 0 } }),
    );
    expect(data).toEqual({ totalRuns: 0 });
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [500, 'server'],
    [409, 'business'],
  ] as const)('maps HTTP %s to %s', async (status, kind) => {
    await expect(
      fetchMetrics('http://metrics.test', {}, () =>
        response(status, { success: false, code: `E${status}`, message: `failure-${status}` }),
      ),
    ).rejects.toMatchObject({
      name: 'MetricsApiError',
      kind,
      status,
      apiCode: `E${status}`,
      requestId: 'request-test',
    } satisfies Partial<MetricsApiError>);
  });

  it('maps connection failures without converting them to empty data', async () => {
    await expect(
      fetchMetrics('http://metrics.test', {}, async () => {
        throw new TypeError('connection refused');
      }),
    ).rejects.toMatchObject({ kind: 'network', status: 0, apiCode: 'NETWORK_ERROR' });
  });

  it('recognizes classified errors after a server module boundary strips the prototype', () => {
    expect(
      isMetricsApiError({ name: 'MetricsApiError', message: 'offline', kind: 'network', status: 0 }),
    ).toBe(true);
    expect(isMetricsApiError(new Error('unexpected'))).toBe(false);
  });
});
