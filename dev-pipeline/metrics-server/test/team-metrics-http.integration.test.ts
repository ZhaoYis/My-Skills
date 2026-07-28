import type { Server } from 'node:http';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const database = enabled
  ? new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL })
  : null;
const db = database as PrismaClient;
const jwtSecret = 'm010-team-metrics-http-secret-at-least-32-characters';
const prefix = 'm010-http';
let server: Server | undefined;
let baseUrl = '';
let repoId: number | undefined;
let disconnectAppDatabase: (() => Promise<void>) | undefined;

function token(teamId: number | null, isAdmin = false, developerId = 1) {
  return jwt.sign(
    {
      developerId,
      email: `${prefix}-${developerId}@example.invalid`,
      teamId,
      isAdmin,
      tokenVersion: 0,
    },
    jwtSecret,
    {
      expiresIn: '5m',
      issuer: 'opsx-metrics-server',
      audience: 'opsx-metrics-api',
    },
  );
}

function request(path: string, bearer: string) {
  return fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${bearer}` } });
}

async function createRun(developerId: number, sequence: number, durationMinutes: number) {
  if (!repoId) throw new Error('Test repository was not created');
  const now = new Date(Date.now() - sequence * 60_000);
  return db.pipelineRun.create({
    data: {
      repoId,
      developerId,
      changeName: `${prefix}-change-${developerId}-${sequence}`,
      stateVersion: 3,
      sourceBranch: `${prefix}/feature-${sequence}`,
      currentPhase: 6,
      currentStep: 24,
      status: 'completed',
      executionMode: 'pipeline',
      isLatest: true,
      isLatestHistorical: true,
      snapshotSource: 'collector',
      fingerprintId: `fp1.${'A'.repeat(342)}`,
      fingerprintNonce: sequence.toString().padStart(8, '0'),
      fingerprintVerified: true,
      fingerprintKeyVersion: 'fp1',
      createdByEmail: `${prefix}-${developerId}@example.invalid`,
      createdBy: `Developer ${developerId}`,
      createdAtSource: new Date(now.getTime() - durationMinutes * 60_000),
      reviewStatus: 'passed',
      reviewCurrentRound: sequence,
      testsAttempts: 1,
      testsStatus: 'passed',
      verifyAttempts: 1,
      verifyStatus: 'passed',
      createdAtPipeline: new Date(now.getTime() - durationMinutes * 60_000),
      updatedAtPipeline: now,
      completedAtPipeline: now,
      changeDurationSeconds: durationMinutes * 60,
      contentHash: sequence.toString(16).padStart(32, '0'),
      commitSha: sequence.toString(16).padStart(40, '0'),
      commitTimestamp: now,
      phaseHistory: {
        create: {
          phase: 2,
          step: 8,
          executedBy: 'pipeline',
          status: 'completed',
          startedAt: new Date(now.getTime() - durationMinutes * 60_000),
          completedAt: now,
          durationSeconds: durationMinutes * 60,
        },
      },
    },
  });
}

describe.runIf(enabled)('team metrics HTTP contract', () => {
  let rootId: number;
  let childId: number;
  let siblingId: number;
  let rootDeveloperId: number;
  let childDeveloperId: number;
  let noDataDeveloperId: number;
  let adminDeveloperId: number;
  let unassignedDeveloperId: number;

  beforeAll(async () => {
    await db.developer.deleteMany({ where: { email: { startsWith: prefix } } });
    await db.team.deleteMany({ where: { slug: { startsWith: prefix } } });
    await db.repo.deleteMany({ where: { name: prefix } });

    const now = new Date();
    const root = await db.team.create({
      data: { name: 'Engineering', slug: `${prefix}-root`, externalId: `${prefix}-root` },
    });
    const child = await db.team.create({
      data: {
        name: 'Platform',
        slug: `${prefix}-child`,
        externalId: `${prefix}-child`,
        parentId: root.id,
      },
    });
    const sibling = await db.team.create({
      data: { name: 'Product', slug: `${prefix}-sibling`, externalId: `${prefix}-sibling` },
    });
    rootId = root.id;
    childId = child.id;
    siblingId = sibling.id;

    const [rootDeveloper, childDeveloper, noDataDeveloper, adminDeveloper, unassignedDeveloper] =
      await Promise.all([
        db.developer.create({
          data: {
            email: `${prefix}-root@example.invalid`,
            displayName: 'Root Developer',
            role: 'member',
            teamId: rootId,
            firstSeenAt: now,
            lastSeenAt: now,
          },
        }),
        db.developer.create({
          data: {
            email: `${prefix}-child@example.invalid`,
            displayName: 'Child Developer',
            role: 'member',
            teamId: childId,
            firstSeenAt: now,
            lastSeenAt: now,
          },
        }),
        db.developer.create({
          data: {
            email: `${prefix}-empty@example.invalid`,
            displayName: 'No Data Developer',
            role: 'member',
            teamId: childId,
            firstSeenAt: now,
            lastSeenAt: now,
          },
        }),
        db.developer.create({
          data: {
            email: `${prefix}-admin@example.invalid`,
            displayName: 'Metrics Administrator',
            role: 'admin',
            firstSeenAt: now,
            lastSeenAt: now,
          },
        }),
        db.developer.create({
          data: {
            email: `${prefix}-unassigned@example.invalid`,
            displayName: 'Unassigned Developer',
            role: 'member',
            firstSeenAt: now,
            lastSeenAt: now,
          },
        }),
      ]);
    rootDeveloperId = rootDeveloper.id;
    childDeveloperId = childDeveloper.id;
    noDataDeveloperId = noDataDeveloper.id;
    adminDeveloperId = adminDeveloper.id;
    unassignedDeveloperId = unassignedDeveloper.id;

    const repo = await db.repo.create({
      data: {
        name: prefix,
        gitUrl: `https://example.invalid/${prefix}.git`,
        collectSince: now,
      },
    });
    repoId = repo.id;
    await createRun(rootDeveloperId, 1, 20);
    await createRun(childDeveloperId, 2, 10);
    await createRun(childDeveloperId, 3, 30);

    Object.assign(process.env, {
      NODE_ENV: 'test',
      DB_PROVIDER: 'postgresql',
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      JWT_SECRET: jwtSecret,
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

  it('returns only the authenticated user team subtree and rejects teams outside it', async () => {
    const rootToken = token(rootId, false, rootDeveloperId);
    const visible = await request('/metrics/teams/visible', rootToken);
    expect(visible.status).toBe(200);
    expect(await visible.json()).toMatchObject({
      data: [
        {
          id: rootId,
          children: [{ id: childId }],
        },
      ],
    });

    expect((await request(`/metrics/team/${childId}`, rootToken)).status).toBe(200);
    expect((await request(`/metrics/team/${siblingId}`, rootToken)).status).toBe(403);
    expect(
      (await request(`/metrics/team/${rootId}`, token(childId, false, childDeveloperId))).status,
    ).toBe(403);

    const adminVisible = await request(
      '/metrics/teams/visible',
      token(null, true, adminDeveloperId),
    );
    const adminPayload = (await adminVisible.json()) as { data: Array<{ id: number }> };
    expect(adminPayload.data.flatMap((team) => [team.id])).toContain(siblingId);
    expect(
      (await request(`/metrics/team/${siblingId}`, token(null, true, adminDeveloperId))).status,
    ).toBe(200);
    await expect(
      (await request('/metrics/teams/visible', token(null, false, unassignedDeveloperId))).json(),
    ).resolves.toMatchObject({ data: [] });
  });

  it('keeps overview, trend, phases, member filters, sorting, and pagination consistent', async () => {
    const rootToken = token(rootId, false, rootDeveloperId);
    const overview = await request(`/metrics/team/${rootId}?days=30`, rootToken);
    expect(await overview.json()).toMatchObject({
      data: { totalRuns: 3, completedRuns: 3, recentTrend: expect.any(Array) },
    });
    expect((await request(`/metrics/team/${rootId}/trend?days=30`, rootToken)).status).toBe(200);
    expect((await request(`/metrics/team/${rootId}/phases?days=30`, rootToken)).status).toBe(200);

    const firstPage = await request(
      `/metrics/team/${rootId}/members?pageNum=1&pageSize=1&sortBy=completedRuns&sortOrder=desc&days=30`,
      rootToken,
    );
    expect(await firstPage.json()).toMatchObject({
      data: {
        pageNum: 1,
        pageSize: 1,
        totalCount: 3,
        totalPage: 3,
        records: [{ id: childDeveloperId, completedRuns: 2, completionRate: 1 }],
      },
    });

    const secondPage = await request(
      `/metrics/team/${rootId}/members?pageNum=2&pageSize=1&sortBy=completedRuns&sortOrder=desc&days=30`,
      rootToken,
    );
    expect(await secondPage.json()).toMatchObject({
      data: { records: [{ id: rootDeveloperId, completedRuns: 1 }] },
    });

    const withoutData = await request(
      `/metrics/team/${rootId}/members?q=No%20Data&dataStatus=without-data`,
      rootToken,
    );
    expect(await withoutData.json()).toMatchObject({
      data: { totalCount: 1, records: [{ id: noDataDeveloperId, totalRuns: 0 }] },
    });

    const detail = await request(
      `/metrics/team/${rootId}/members/${childDeveloperId}?days=30`,
      rootToken,
    );
    expect(await detail.json()).toMatchObject({
      data: { id: childDeveloperId, overview: { completedRuns: 2 } },
    });
    expect(
      (await request(`/metrics/team/${childId}/members/${rootDeveloperId}`, rootToken)).status,
    ).toBe(404);
  }, 90_000);
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await disconnectAppDatabase?.();
  if (repoId) await db?.repo.delete({ where: { id: repoId } });
  await db?.developer.deleteMany({ where: { email: { startsWith: prefix } } });
  await db?.team.deleteMany({ where: { slug: { startsWith: prefix } } });
  await database?.$disconnect();
});
