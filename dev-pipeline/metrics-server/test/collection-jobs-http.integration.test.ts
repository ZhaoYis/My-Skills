import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';
import {
  type CollectionJobConflictError,
  CollectionService,
} from '../src/services/collection-service.js';
import { createGitRepositoryFixture } from './helpers/git-repository.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const database = enabled
  ? new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL })
  : null;
const db = database as PrismaClient;
const apiKey = 'm011-collection-jobs-service-key';
const jwtSecret = 'm011-collection-jobs-secret-at-least-32-characters';
const repoName = 'm011-collection-jobs';
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const tmpDir = mkdtempSync(join(tmpdir(), 'collection-jobs-'));
const keyPath = join(tmpDir, 'private.pem');
writeFileSync(keyPath, privateKey.export({ format: 'pem', type: 'pkcs8' }));
let fixture: Awaited<ReturnType<typeof createGitRepositoryFixture>> | undefined;
let repoId: number | undefined;
let server: Server | undefined;
let baseUrl = '';
let disconnectAppDatabase: (() => Promise<void>) | undefined;

function requiredRepoId() {
  if (!repoId) throw new Error('Test repository was not created');
  return repoId;
}

function requiredFixture() {
  if (!fixture) throw new Error('Git fixture was not created');
  return fixture;
}

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

async function waitForJob(jobId: string, statuses: string[]) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const response = await request(`/collection/jobs/${jobId}`);
    const payload = (await response.json()) as { data: { status: string } };
    if (statuses.includes(payload.data.status)) return payload.data;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Collection job ${jobId} did not reach ${statuses.join('/')}`);
}

describe.runIf(enabled)('durable collection job HTTP contract', () => {
  let service: CollectionService;

  beforeAll(async () => {
    await db.repo.deleteMany({ where: { name: repoName } });
    fixture = await createGitRepositoryFixture();
    const repo = await db.repo.create({
      data: {
        name: repoName,
        gitUrl: fixture.remote,
        gitBranch: 'main',
        collectSince: new Date(0),
      },
    });
    repoId = repo.id;
    const env = parseEnv({
      NODE_ENV: 'test',
      DB_PROVIDER: 'postgresql',
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      JWT_SECRET: jwtSecret,
      API_KEY: apiKey,
      FINGERPRINT_PRIVATE_KEYS_PATH: keyPath,
      COLLECTOR_TEMP_DIR: fixture.collector,
      COLLECTOR_LOCK_TIMEOUT: '1000',
      COLLECTOR_CONCURRENCY: '1',
    });
    service = new CollectionService(db, env);

    Object.assign(process.env, {
      NODE_ENV: 'test',
      DB_PROVIDER: 'postgresql',
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      JWT_SECRET: jwtSecret,
      API_KEY: apiKey,
      FINGERPRINT_PRIVATE_KEYS_PATH: keyPath,
      COLLECTOR_TEMP_DIR: fixture.collector,
      COLLECTOR_LOCK_TIMEOUT: '1000',
      COLLECTOR_CONCURRENCY: '1',
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
  }, 60_000);

  it('persists queue state, prevents duplicates, cancels, retries, and drains after restart', async () => {
    const queued = await service.enqueueRepo(requiredRepoId(), { dryRun: true });
    expect(queued).toMatchObject({ status: 'queued', startedAt: null, dryRun: true, attempt: 1 });
    await expect(service.enqueueRepo(requiredRepoId(), { dryRun: true })).rejects.toMatchObject({
      name: 'CollectionJobConflictError',
      jobId: queued.id,
    } satisfies Partial<CollectionJobConflictError>);

    const cancelled = await service.cancelJob(queued.id);
    expect(cancelled).toMatchObject({
      status: 'cancelled',
      cancelRequestedAt: expect.any(Date),
      cancelledAt: expect.any(Date),
    });
    const retry = await service.retryJob(queued.id);
    expect(retry).toMatchObject({ status: 'queued', retryOfId: queued.id, attempt: 2 });

    const restartedService = new CollectionService(
      db,
      parseEnv({
        NODE_ENV: 'test',
        DB_PROVIDER: 'postgresql',
        DATABASE_URL: process.env.TEST_DATABASE_URL,
        JWT_SECRET: jwtSecret,
        FINGERPRINT_PRIVATE_KEYS_PATH: keyPath,
        COLLECTOR_TEMP_DIR: requiredFixture().collector,
        COLLECTOR_LOCK_TIMEOUT: '1000',
        COLLECTOR_CONCURRENCY: '1',
      }),
    );
    const results = await restartedService.processQueue();
    expect(results).toHaveLength(1);
    expect(await db.collectionLog.findUniqueOrThrow({ where: { id: retry.id } })).toMatchObject({
      status: 'completed',
      startedAt: expect.any(Date),
      finishedAt: expect.any(Date),
      workerId: expect.any(String),
    });
  }, 60_000);

  it('marks stale running jobs as timeout and restores repository terminal state', async () => {
    await db.repo.update({
      where: { id: repoId },
      data: { collectionStatus: 'running', collectionStartedAt: new Date(Date.now() - 10_000) },
    });
    const stale = await db.collectionLog.create({
      data: {
        repoId: requiredRepoId(),
        status: 'running',
        startedAt: new Date(Date.now() - 10_000),
        heartbeatAt: new Date(Date.now() - 10_000),
      },
    });
    expect(await service.recoverStaleJobs()).toBe(1);
    expect(await db.collectionLog.findUniqueOrThrow({ where: { id: stale.id } })).toMatchObject({
      status: 'timeout',
      errorCategory: 'timeout',
      finishedAt: expect.any(Date),
    });
    expect(await db.repo.findUniqueOrThrow({ where: { id: repoId } })).toMatchObject({
      collectionStatus: 'error',
      collectionStartedAt: null,
    });
    await db.repo.update({
      where: { id: repoId },
      data: { collectionStatus: 'idle', collectionStartedAt: null, collectionError: null },
    });
  });

  it('returns 202 with a durable job ID and exposes list, detail, cancellation, and retry APIs', async () => {
    const triggered = await request('/collection/trigger', {
      method: 'POST',
      body: JSON.stringify({ repoId, dryRun: true, mode: 'trusted' }),
    });
    expect(triggered.status).toBe(202);
    const triggeredPayload = (await triggered.json()) as { data: { jobId: string } };
    expect(triggeredPayload.data.jobId).toMatch(/^\d+$/);
    await waitForJob(triggeredPayload.data.jobId, ['completed']);

    const queued = await service.enqueueRepo(requiredRepoId(), { dryRun: true });
    const duplicate = await request('/collection/trigger', {
      method: 'POST',
      body: JSON.stringify({ repoId, dryRun: true }),
    });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({
      code: 'COLLECTION_JOB_ACTIVE',
      data: null,
      details: { jobId: queued.id.toString() },
    });

    const cancelled = await request(`/collection/jobs/${queued.id}/cancel`, {
      method: 'POST',
      body: '{}',
    });
    expect(cancelled.status).toBe(200);
    expect(await cancelled.json()).toMatchObject({ data: { status: 'cancelled' } });

    const retried = await request(`/collection/jobs/${queued.id}/retry`, {
      method: 'POST',
      body: '{}',
    });
    expect(retried.status).toBe(202);
    const retriedPayload = (await retried.json()) as { data: { jobId: string } };
    await waitForJob(retriedPayload.data.jobId, ['completed']);

    const jobs = await request(`/collection/logs?repoId=${repoId}&status=completed`);
    const jobsPayload = (await jobs.json()) as {
      data: { totalCount: number; records: Array<{ dryRun: boolean }> };
    };
    expect(jobsPayload.data.totalCount).toBe(3);
    expect(jobsPayload.data.records.every(({ dryRun }) => dryRun)).toBe(true);
    expect((await request(`/collection/jobs/${retriedPayload.data.jobId}`)).status).toBe(200);
  }, 60_000);
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await disconnectAppDatabase?.();
  if (repoId) await db?.repo.delete({ where: { id: repoId } });
  await database?.$disconnect();
  await fixture?.cleanup();
});
