import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { parseEnv } from '../src/config/env.js';
import { ObservabilityRegistry } from '../src/observability/metrics.js';
import { checkReadiness } from '../src/observability/readiness.js';

const requestLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
const metrics = new ObservabilityRegistry();
let server: Server;
let baseUrl = '';
const tmpDir = mkdtempSync(join(tmpdir(), 'observability-test-'));
const keyPath = join(tmpDir, 'private.pem');

beforeAll(async () => {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  writeFileSync(keyPath, privateKey);
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DB_PROVIDER: 'postgresql',
    DATABASE_URL: 'postgresql://postgres:password@localhost:5432/metrics',
    JWT_SECRET: 'observability-test-secret-at-least-32-characters',
    API_KEY: 'observability-service-key',
    FINGERPRINT_PRIVATE_KEYS_PATH: keyPath,
  });
  const { createApp } = await import('../src/server.js');
  const app = createApp({
    metrics,
    requestLogger: requestLog,
    readinessCheck: async () => ({
      ready: false,
      category: 'database-unavailable',
      checks: { configuration: 'ok', database: 'failed' },
    }),
  });
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', (error?: Error) => (error ? reject(error) : resolve()));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('HTTP test server did not start');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('HTTP observability and health probes', () => {
  it('propagates a valid request ID and generates one for invalid input', async () => {
    const propagated = await fetch(`${baseUrl}/api/v1/health/live`, {
      headers: { 'x-request-id': 'deploy-probe-42' },
    });
    expect(propagated.status).toBe(200);
    expect(propagated.headers.get('x-request-id')).toBe('deploy-probe-42');

    const generated = await fetch(`${baseUrl}/api/v1/health/live`, {
      headers: { 'x-request-id': 'invalid request id' },
    });
    expect(generated.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps liveness green while readiness reports a stable database failure', async () => {
    const [live, ready] = await Promise.all([
      fetch(`${baseUrl}/api/v1/health/live`),
      fetch(`${baseUrl}/api/v1/health/ready`, { headers: { 'x-request-id': 'ready-42' } }),
    ]);
    expect(live.status).toBe(200);
    expect(ready.status).toBe(503);
    expect(await ready.json()).toMatchObject({
      success: false,
      code: 'SERVICE_NOT_READY',
      requestId: 'ready-42',
      details: {
        category: 'database-unavailable',
        checks: { configuration: 'ok', database: 'failed' },
      },
    });

    const env = parseEnv(process.env);
    await expect(
      checkReadiness(async () => {
        throw new Error('database credentials must not be returned');
      }, env),
    ).resolves.toMatchObject({
      ready: false,
      category: 'database-unavailable',
      checks: { configuration: 'ok', database: 'failed' },
    });
    await expect(
      checkReadiness(async () => undefined, {
        ...env,
        FINGERPRINT_PRIVATE_KEYS_PATH: '/nonexistent/key.pem',
      }),
    ).resolves.toMatchObject({
      ready: false,
      category: 'configuration-not-ready',
      checks: { configuration: 'failed', database: 'ok' },
    });
  });

  it('logs request latency/error category and exposes Prometheus text metrics', async () => {
    await fetch(`${baseUrl}/api/v1/not-registered`, {
      headers: {
        'x-api-key': 'observability-service-key',
        'x-request-id': 'missing-42',
      },
    });
    await vi.waitFor(() =>
      expect(requestLog.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'missing-42',
          method: 'GET',
          statusCode: 404,
          durationMs: expect.any(Number),
          errorCategory: 'not-found',
        }),
        'request completed',
      ),
    );

    metrics.observeCollectionRun('completed');
    metrics.observeCollectionRun('error', 'git');
    metrics.observeFingerprintRejection('unknown-key');
    metrics.configureScheduler('collector');
    metrics.startSchedulerRun('collector', 1_000);
    metrics.finishSchedulerRun('collector', 'success', 1_000, 2_000);

    const response = await fetch(`${baseUrl}/observability/metrics`);
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(body).toContain('opsx_api_request_duration_seconds_bucket');
    expect(body).toContain('route="/api/v1/health/live"');
    expect(body).toContain(
      'opsx_collection_jobs_total{status="completed",error_category="none"} 1',
    );
    expect(body).toContain('opsx_collection_success_ratio 0.5');
    expect(body).toContain('opsx_fingerprint_rejections_total{reason_code="unknown-key"} 1');
    expect(body).toContain('opsx_scheduler_runs_total{job="collector",status="success"} 1');
  });

  it('returns a request-linked JSON envelope for malformed request bodies', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/session`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'malformed-42',
      },
      body: '{invalid-json',
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'INVALID_REQUEST',
      requestId: 'malformed-42',
    });
  });
});
