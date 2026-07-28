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
const apiKey = 'm009-organization-http-service-key';
const jwtSecret = 'm009-organization-http-secret-at-least-32-characters';
const prefix = 'm009-http';
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

async function createTeam(name: string, parentId?: number) {
  const response = await request('/teams', {
    method: 'POST',
    body: JSON.stringify({
      name,
      slug: name,
      externalId: `${name}-external`,
      parentId: parentId ?? null,
    }),
  });
  const payload = (await response.json()) as { data: { id: number } };
  expect(response.status, JSON.stringify(payload)).toBe(201);
  return payload.data.id;
}

describe.runIf(enabled)('organization administration HTTP contract', () => {
  beforeAll(async () => {
    await db.developer.deleteMany({ where: { email: { startsWith: prefix } } });
    await db.team.deleteMany({ where: { slug: { startsWith: prefix } } });
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DB_PROVIDER: 'postgresql',
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      JWT_SECRET: jwtSecret,
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

  it('supports safe team lifecycle, developer assignment, claims, and cache invalidation', async () => {
    const rootId = await createTeam(`${prefix}-root`);
    const childId = await createTeam(`${prefix}-child`, rootId);
    const grandchildId = await createTeam(`${prefix}-grandchild`, childId);
    const destinationId = await createTeam(`${prefix}-destination`);
    const linked = await db.developer.create({
      data: {
        email: `${prefix}-linked@example.invalid`,
        displayName: 'Linked Developer',
        role: 'member',
        teamId: childId,
        externalId: `${prefix}-linked-external`,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      },
    });
    const unlinked = await db.developer.create({
      data: {
        email: `${prefix}-pending@example.invalid`,
        displayName: 'Pending Developer',
        role: 'member',
        teamId: childId,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      },
    });

    const pendingPage = await request(`/developers?q=${prefix}-pending&claim=unlinked`);
    expect(pendingPage.status).toBe(200);
    expect(await pendingPage.json()).toMatchObject({
      data: { totalCount: 1, records: [{ id: unlinked.id, externalId: null }] },
    });

    const updatedDeveloper = await request(`/developers/${unlinked.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        teamId: destinationId,
        role: 'admin',
        externalId: `${prefix}-claimed-external`,
      }),
    });
    expect(updatedDeveloper.status).toBe(200);
    expect(await updatedDeveloper.json()).toMatchObject({
      data: { teamId: destinationId, role: 'admin', tokenVersion: 1 },
    });

    const { getTeamSubtreeIds } = await import('../src/services/team-cache.js');
    expect(await getTeamSubtreeIds(db, rootId)).toContain(childId);
    const moved = await request(`/teams/${childId}`, {
      method: 'PUT',
      body: JSON.stringify({ parentId: destinationId }),
    });
    expect(moved.status).toBe(200);
    expect(await getTeamSubtreeIds(db, rootId)).not.toContain(childId);
    expect(await db.developer.findUniqueOrThrow({ where: { id: linked.id } })).toMatchObject({
      tokenVersion: 1,
    });

    const cycle = await request(`/teams/${destinationId}`, {
      method: 'PUT',
      body: JSON.stringify({ parentId: grandchildId }),
    });
    expect(cycle.status).toBe(409);
    expect(await cycle.json()).toMatchObject({ message: '团队不能移动到自身或其子团队' });

    const rejectedDeactivate = await request(`/teams/${childId}`, {
      method: 'DELETE',
      body: '{}',
    });
    expect(rejectedDeactivate.status).toBe(409);
    expect(await rejectedDeactivate.json()).toMatchObject({
      message: '团队仍有活跃子团队，请选择提升子团队后停用',
    });

    const deactivated = await request(`/teams/${childId}`, {
      method: 'DELETE',
      body: JSON.stringify({ childStrategy: 'promote', memberStrategy: 'unassign' }),
    });
    expect(deactivated.status).toBe(200);
    expect(await db.team.findUniqueOrThrow({ where: { id: childId } })).toMatchObject({
      isActive: false,
      deactivatedAt: expect.any(Date),
    });
    expect(await db.team.findUniqueOrThrow({ where: { id: grandchildId } })).toMatchObject({
      parentId: destinationId,
    });
    expect(await db.developer.findUniqueOrThrow({ where: { id: linked.id } })).toMatchObject({
      teamId: null,
      tokenVersion: 2,
    });

    const unassignedPage = await request(`/developers?q=${prefix}-linked&unassigned=true`);
    expect(await unassignedPage.json()).toMatchObject({ data: { totalCount: 1 } });

    const memberToken = jwt.sign(
      {
        developerId: linked.id,
        email: linked.email,
        teamId: null,
        isAdmin: false,
        tokenVersion: 2,
      },
      jwtSecret,
      {
        expiresIn: '5m',
        issuer: 'opsx-metrics-server',
        audience: 'opsx-metrics-api',
      },
    );
    const forbidden = await fetch(`${baseUrl}/teams`, {
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(forbidden.status).toBe(403);
  }, 90_000);
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await disconnectAppDatabase?.();
  await db?.developer.deleteMany({ where: { email: { startsWith: prefix } } });
  await db?.team.deleteMany({ where: { slug: { startsWith: prefix } } });
  await database?.$disconnect();
});
