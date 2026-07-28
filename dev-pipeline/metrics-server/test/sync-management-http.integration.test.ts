import type { Server } from 'node:http';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const database = enabled
  ? new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL })
  : null;
const db = database as PrismaClient;
const prefix = 'm012-sync-http';
const apiKey = 'm012-sync-http-service-key';
let server: Server | undefined;
let baseUrl = '';
let disconnectAppDatabase: (() => Promise<void>) | undefined;

function request(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      ...init.headers,
    },
  });
}

async function cleanup() {
  if (!database) return;
  await db.developer.deleteMany({ where: { syncSource: { startsWith: prefix } } });
  await db.team.deleteMany({
    where: { OR: [{ syncSource: { startsWith: prefix } }, { externalId: { startsWith: prefix } }] },
  });
  await db.syncLog.deleteMany({ where: { source: { startsWith: prefix } } });
}

async function waitForLog(id: string) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const log = await db.syncLog.findUniqueOrThrow({ where: { id: BigInt(id) } });
    if (log.status !== 'running') return log;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`sync log ${id} did not reach a terminal state`);
}

describe.runIf(enabled)('organization sync management HTTP contract', () => {
  beforeAll(async () => {
    await cleanup();
    delete process.env.FEISHU_APP_ID;
    delete process.env.FEISHU_APP_SECRET;
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DB_PROVIDER: 'postgresql',
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      JWT_SECRET: 'm012-sync-http-secret-at-least-32-characters',
      API_KEY: apiKey,
    });
    const [{ apiRouter }, { prisma }] = await Promise.all([
      import('../src/api/router.js'),
      import('../src/config/database.js'),
    ]);
    disconnectAppDatabase = () => prisma.$disconnect();
    const app = express();
    app.use(express.json());
    app.use('/api/v1', apiRouter);
    const listeningServer = app.listen(0, '127.0.0.1');
    server = listeningServer;
    await new Promise<void>((resolve, reject) => {
      listeningServer.once('listening', resolve);
      listeningServer.once('error', reject);
    });
    const address = listeningServer.address();
    if (!address || typeof address === 'string') throw new Error('HTTP test server did not start');
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  });

  it('previews canonical JSON, confirms apply, and exposes sanitized history details', async () => {
    const source = `${prefix}-upload`;
    const snapshot = {
      teams: [{ externalId: `${source}-root`, name: 'Engineering', slug: `${source}-root` }],
      developers: [],
    };
    const previewResponse = await request('/sync/org/preview', {
      method: 'POST',
      body: JSON.stringify({ source, ...snapshot }),
    });
    expect(previewResponse.status).toBe(200);
    const previewPayload = (await previewResponse.json()) as {
      data: { id: string; status: string; dryRun: boolean; teamsCreated: number };
    };
    expect(previewPayload.data).toMatchObject({
      status: 'completed',
      dryRun: true,
      teamsCreated: 1,
    });
    expect(await db.team.findUnique({ where: { externalId: `${source}-root` } })).toBeNull();

    const applyResponse = await request(`/sync/logs/${previewPayload.data.id}/apply`, {
      method: 'POST',
    });
    expect(applyResponse.status).toBe(202);
    const applyPayload = (await applyResponse.json()) as { data: { id: string } };
    expect(await waitForLog(applyPayload.data.id)).toMatchObject({
      status: 'completed',
      dryRun: false,
    });
    expect(await db.team.findUnique({ where: { externalId: `${source}-root` } })).toMatchObject({
      isActive: true,
      syncSource: source,
    });

    const historyResponse = await request('/sync/logs?pageNum=1&pageSize=10');
    expect(historyResponse.status).toBe(200);
    const historyText = await historyResponse.text();
    expect(historyText).not.toContain('canonicalSnapshot');
    expect(historyText).not.toContain(apiKey);

    const detailResponse = await request(`/sync/logs/${previewPayload.data.id}`);
    expect(detailResponse.status).toBe(200);
    expect(await detailResponse.json()).toMatchObject({
      data: { id: previewPayload.data.id, canonicalSnapshot: snapshot },
    });
  });

  it('retries failed canonical runs and never exposes adapter credentials', async () => {
    const source = `${prefix}-retry`;
    const snapshot = {
      teams: [{ externalId: `${source}-root`, name: 'Retry Team', slug: `${source}-root` }],
      developers: [],
    };
    const failed = await db.syncLog.create({
      data: {
        source,
        status: 'error',
        startedAt: new Date(),
        finishedAt: new Date(),
        errorCategory: 'database',
        errorMessage: 'temporary failure',
        failures: 1,
        canonicalSnapshot: snapshot,
      },
    });
    const retryResponse = await request(`/sync/logs/${failed.id}/retry`, { method: 'POST' });
    expect(retryResponse.status).toBe(202);
    const retryPayload = (await retryResponse.json()) as { data: { id: string } };
    expect(await waitForLog(retryPayload.data.id)).toMatchObject({
      status: 'completed',
      triggerSource: 'retry',
      retryOfId: failed.id,
      attempt: 2,
    });

    const adaptersResponse = await request('/sync/adapters');
    expect(adaptersResponse.status).toBe(200);
    const adaptersText = await adaptersResponse.text();
    expect(adaptersText).toContain('"name":"feishu"');
    expect(adaptersText).toContain('"configured":false');
    expect(adaptersText).not.toContain(apiKey);

    const previewResponse = await request('/sync/adapters/feishu/preview', { method: 'POST' });
    expect(previewResponse.status).toBe(409);
    expect(await previewResponse.json()).toMatchObject({
      success: false,
      message: 'Feishu adapter credentials are missing',
    });
  });

  afterAll(async () => {
    await cleanup();
    if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
    await disconnectAppDatabase?.();
    await database?.$disconnect();
  });
});
