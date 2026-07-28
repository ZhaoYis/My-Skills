import type { Server } from 'node:http';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RETENTION_CONFIRMATION, RetentionService } from '../src/services/retention-service.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const db = enabled ? new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL }) : null;
const database = db as PrismaClient;
const prefix = 'm015-retention';
let repoId: number | undefined;
const logIds: bigint[] = [];
let server: Server | undefined;
let baseUrl = '';
let disconnectAppDatabase: (() => Promise<void>) | undefined;

function request(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-api-key': 'm015-retention-api-key',
      ...init.headers,
    },
  });
}

async function createRun(
  changeName: string,
  updatedAtPipeline: Date,
  flags: { isLatest?: boolean; isLatestHistorical?: boolean } = {},
) {
  return database.pipelineRun.create({
    data: {
      repoId: repoId as number,
      changeName,
      stateVersion: 1,
      sourceBranch: `feature/${changeName}`,
      currentPhase: 6,
      currentStep: 24,
      status: 'completed',
      executionMode: 'pipeline',
      isLatest: flags.isLatest ?? false,
      isLatestHistorical: flags.isLatestHistorical ?? false,
      snapshotSource: 'collector',
      fingerprintId: `fp1.${'A'.repeat(342)}`,
      fingerprintNonce: changeName.slice(-8).padStart(8, '0'),
      fingerprintVerified: true,
      fingerprintKeyVersion: 'fp1',
      createdByEmail: `${prefix}@example.invalid`,
      createdBy: 'Retention Test',
      createdAtSource: new Date(updatedAtPipeline.getTime() - 60_000),
      createdAtPipeline: new Date(updatedAtPipeline.getTime() - 60_000),
      updatedAtPipeline,
      completedAtPipeline: updatedAtPipeline,
      changeDurationSeconds: 60,
      contentHash: changeName.padEnd(32, '0').slice(0, 32),
      commitSha: changeName.padEnd(40, '0').slice(0, 40),
      commitTimestamp: updatedAtPipeline,
      phaseHistory: {
        create: {
          phase: 1,
          step: 2,
          executedBy: 'pipeline',
          status: 'completed',
          startedAt: new Date(updatedAtPipeline.getTime() - 60_000),
          completedAt: updatedAtPipeline,
          durationSeconds: 60,
        },
      },
    },
  });
}

describe.runIf(enabled)('PostgreSQL retention cleanup', () => {
  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DB_PROVIDER: 'postgresql',
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      JWT_SECRET: 'm015-retention-secret-at-least-32-characters',
      API_KEY: 'm015-retention-api-key',
      RETENTION_ENABLED: 'false',
      RETENTION_DRY_RUN: 'true',
      RETENTION_CONFIRMATION: '',
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

  it('preserves hot and latest audit snapshots while deleting only eligible cold history', async () => {
    await database.repo.deleteMany({ where: { name: prefix } });
    const now = new Date('2026-07-28T00:00:00.000Z');
    const repo = await database.repo.create({
      data: {
        name: prefix,
        gitUrl: `https://example.invalid/${prefix}.git`,
        collectSince: new Date(0),
        retentionDays: 30,
      },
    });
    repoId = repo.id;
    const old = new Date('2026-04-01T00:00:00.000Z');
    const recent = new Date('2026-07-27T00:00:00.000Z');
    const [cold, trustedLatest, historicalLatest, hot] = await Promise.all([
      createRun(`${prefix}-cold`, old),
      createRun(`${prefix}-trusted`, old, { isLatest: true }),
      createRun(`${prefix}-historical`, old, { isLatestHistorical: true }),
      createRun(`${prefix}-hot`, recent),
    ]);
    const config = {
      RETENTION_ENABLED: true,
      RETENTION_DRY_RUN: true,
      RETENTION_CONFIRMATION,
    };
    const service = new RetentionService(database, config);
    const archive = await service.archiveBatch(repoId, { now });
    expect(archive.records).toMatchObject([{ id: cold.id, rawStateJson: null }]);

    const disabledRun = await new RetentionService(database, {
      ...config,
      RETENTION_ENABLED: false,
    }).run({ repoId, triggerSource: 'scheduled', dryRun: false, now });
    logIds.push(...disabledRun.map(({ id }) => id));
    expect(disabledRun[0]).toMatchObject({ status: 'checked', eligibleRuns: 1, deletedRuns: 0 });
    expect(await database.pipelineRun.count({ where: { repoId } })).toBe(4);

    const dryRun = await service.run({ repoId, triggerSource: 'manual', dryRun: true, now });
    logIds.push(...dryRun.map(({ id }) => id));
    expect(dryRun[0]).toMatchObject({ status: 'completed', eligibleRuns: 1, deletedRuns: 0 });
    expect(await database.pipelineRun.count({ where: { repoId } })).toBe(4);

    const executed = await service.run({ repoId, triggerSource: 'manual', dryRun: false, now });
    logIds.push(...executed.map(({ id }) => id));
    expect(executed[0]).toMatchObject({ status: 'completed', eligibleRuns: 1, deletedRuns: 1 });
    expect(await database.pipelineRun.findUnique({ where: { id: cold.id } })).toBeNull();
    expect(
      await database.pipelineRun.findMany({
        where: { id: { in: [trustedLatest.id, historicalLatest.id, hot.id] } },
        select: { id: true },
      }),
    ).toHaveLength(3);
    expect(await database.phaseHistoryEntry.count({ where: { runId: cold.id } })).toBe(0);
    expect(await service.history(repoId)).toHaveLength(3);
  }, 90_000);

  it('exposes retention classification, safe checks, soft deletion, and restoration', async () => {
    const deleted = await request(`/repos/${repoId}`, { method: 'DELETE' });
    expect(deleted.status).toBe(200);
    expect(await database.pipelineRun.count({ where: { repoId } })).toBe(3);

    const retention = await request(`/repos/${repoId}/retention`);
    expect(retention.status).toBe(200);
    expect(await retention.json()).toMatchObject({
      data: {
        classification: { repoId, preservedRuns: 3, eligibleRuns: 0 },
        history: expect.any(Array),
      },
    });
    const archive = await request(`/repos/${repoId}/retention/archive?take=10`);
    expect(archive.status).toBe(200);
    expect(await archive.json()).toMatchObject({ data: { records: [], nextCursor: null } });

    const blockedExecution = await request(`/repos/${repoId}/retention`, {
      method: 'POST',
      body: JSON.stringify({ dryRun: false }),
    });
    expect(blockedExecution.status).toBe(200);
    const blockedPayload = (await blockedExecution.json()) as {
      data: { id: string; status: string; deletedRuns: number };
    };
    logIds.push(BigInt(blockedPayload.data.id));
    expect(blockedPayload.data).toMatchObject({ status: 'checked', deletedRuns: 0 });
    expect(await database.pipelineRun.count({ where: { repoId } })).toBe(3);

    const restored = await request(`/repos/${repoId}/restore`, { method: 'POST', body: '{}' });
    expect(restored.status).toBe(200);
    expect(await database.repo.findUniqueOrThrow({ where: { id: repoId } })).toMatchObject({
      deletedAt: null,
      isActive: false,
    });
  }, 60_000);
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await disconnectAppDatabase?.();
  if (logIds.length) await db?.retentionOperationLog.deleteMany({ where: { id: { in: logIds } } });
  if (repoId) await db?.repo.delete({ where: { id: repoId } }).catch(() => undefined);
  await db?.$disconnect();
});
