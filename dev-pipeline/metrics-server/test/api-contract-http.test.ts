import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let server: Server;
let baseUrl = '';

beforeAll(async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DB_PROVIDER: 'postgresql',
    DATABASE_URL: 'postgresql://postgres:password@localhost:5432/metrics',
    JWT_SECRET: 'api-contract-test-secret-at-least-32-characters',
    API_KEY: 'api-contract-service-key',
  });
  const { apiRouter } = await import('../src/api/router.js');
  const app = express();
  app.use(express.json());
  app.use('/api/v1', apiRouter);
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', (error?: Error) => (error ? reject(error) : resolve()));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('HTTP test server did not start');
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('API envelope and status contract', () => {
  it('covers public success and protected 400, 401, 403, and 404 boundaries', async () => {
    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({
      success: true,
      code: 200,
      data: { status: 'ok', timestamp: expect.stringMatching(/^\d{4}-/) },
    });

    const unauthorized = await fetch(`${baseUrl}/teams`);
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toMatchObject({ success: false, code: 401, data: null });

    const serviceHeaders = { 'x-api-key': 'api-contract-service-key' };
    const forbidden = await fetch(`${baseUrl}/metrics/me`, { headers: serviceHeaders });
    expect(forbidden.status).toBe(403);

    const invalid = await fetch(`${baseUrl}/teams/NaN`, {
      method: 'DELETE',
      headers: { ...serviceHeaders, 'content-type': 'application/json' },
      body: '{}',
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
      data: null,
      details: expect.any(Array),
    });

    const missing = await fetch(`${baseUrl}/not-registered`, { headers: serviceHeaders });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ success: false, code: 404, data: null });
  });
});
