import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createGitRepositoryFixture } from './helpers/git-repository.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const database = enabled
  ? new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL })
  : null;
const db = database as PrismaClient;
const apiKey = 'm008-repository-http-service-key';
const jwtSecret = 'm008-repository-http-secret-at-least-32-characters';
const repoName = 'm008-repository-http';
let server: Server | undefined;
let baseUrl = '';
let repoId: number | undefined;
let disconnectAppDatabase: (() => Promise<void>) | undefined;
const tmpDir = mkdtempSync(join(tmpdir(), 'repos-http-test-'));
let cleanupFixture: (() => Promise<void>) | undefined;
let fixture: Awaited<ReturnType<typeof createGitRepositoryFixture>>;

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

async function waitForCollection(id: number) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const repo = await db.repo.findUniqueOrThrow({ where: { id } });
    if (repo.collectionStatus === 'idle' && repo.lastFetchedCommit) return repo;
    if (repo.collectionStatus === 'error')
      throw new Error(repo.collectionError ?? 'collection failed');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('collection did not complete');
}

describe.runIf(enabled)('repository administration HTTP contract', () => {
  beforeAll(async () => {
    await db.repo.deleteMany({ where: { name: { startsWith: repoName } } });
    fixture = await createGitRepositoryFixture();
    cleanupFixture = fixture.cleanup;
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const keyPath = join(tmpDir, 'private.pem');
    writeFileSync(keyPath, privateKey);
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DB_PROVIDER: 'postgresql',
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      JWT_SECRET: jwtSecret,
      API_KEY: apiKey,
      FINGERPRINT_PRIVATE_KEYS_PATH: keyPath,
      COLLECTOR_TEMP_DIR: fixture.collector,
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

  it('supports the complete administrator repository workflow and preserves soft-deleted data', async () => {
    const connected = await request('/repos/test-connection', {
      method: 'POST',
      body: JSON.stringify({ gitUrl: fixture.remote, gitBranch: 'main' }),
    });
    const connectedPayload = await connected.json();
    expect(connected.status, JSON.stringify(connectedPayload)).toBe(200);
    expect(connectedPayload).toMatchObject({ data: { status: 'connected', branch: 'main' } });

    const missingBranch = await request('/repos/test-connection', {
      method: 'POST',
      body: JSON.stringify({ gitUrl: fixture.remote, gitBranch: 'missing' }),
    });
    expect(missingBranch.status).toBe(422);
    expect(await missingBranch.json()).toMatchObject({ code: 'branch-not-found' });

    const created = await request('/repos', {
      method: 'POST',
      body: JSON.stringify({
        name: repoName,
        gitUrl: fixture.remote,
        gitBranch: 'main',
        collectSince: new Date(0).toISOString(),
        retentionDays: 180,
      }),
    });
    expect(created.status).toBe(201);
    const createdPayload = (await created.json()) as { data: { id: number } };
    repoId = createdPayload.data.id;

    const searched = await request(`/repos?q=${repoName}&status=active&pageNum=1&pageSize=10`);
    expect(searched.status).toBe(200);
    expect(await searched.json()).toMatchObject({
      data: { totalCount: 1, records: [{ id: repoId }] },
    });

    const updated = await request(`/repos/${repoId}`, {
      method: 'PUT',
      body: JSON.stringify({ name: `${repoName}-updated`, retentionDays: 365 }),
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      data: { name: `${repoName}-updated`, retentionDays: 365 },
    });

    const collected = await request(`/repos/${repoId}/collect`, { method: 'POST', body: '{}' });
    expect(collected.status).toBe(202);
    await waitForCollection(repoId);

    const detail = await request(`/repos/${repoId}`);
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({
      data: { id: repoId, collectionLogs: [{ status: 'completed', commitsScanned: 0 }] },
    });

    const reset = await request(`/repos/${repoId}/reset-collection`, {
      method: 'POST',
      body: '{}',
    });
    expect(reset.status).toBe(200);
    expect(await reset.json()).toMatchObject({
      data: { lastFetchedCommit: null, scanToCommit: null },
    });

    const disabled = await request(`/repos/${repoId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
    });
    expect(disabled.status).toBe(200);
    expect(await disabled.json()).toMatchObject({ data: { isActive: false } });

    const enabledResponse = await request(`/repos/${repoId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: true }),
    });
    expect(enabledResponse.status).toBe(200);

    const member = await db.developer.create({
      data: {
        email: `${repoName}-member@example.invalid`,
        displayName: 'Repository Member',
        role: 'member',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      },
    });
    const memberToken = jwt.sign(
      {
        developerId: member.id,
        email: member.email,
        teamId: null,
        isAdmin: false,
        tokenVersion: member.tokenVersion,
      },
      jwtSecret,
      {
        expiresIn: '5m',
        issuer: 'opsx-metrics-server',
        audience: 'opsx-metrics-api',
      },
    );
    const forbidden = await fetch(`${baseUrl}/repos`, {
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(forbidden.status).toBe(403);

    const deleted = await request(`/repos/${repoId}`, { method: 'DELETE' });
    expect(deleted.status).toBe(200);
    expect(await db.repo.findUniqueOrThrow({ where: { id: repoId } })).toMatchObject({
      isActive: false,
      deletedAt: expect.any(Date),
    });
    expect(await db.collectionLog.count({ where: { repoId } })).toBe(1);

    const activeList = await request(`/repos?q=${repoName}`);
    expect(await activeList.json()).toMatchObject({ data: { totalCount: 0 } });
    const deletedList = await request(`/repos?q=${repoName}&status=deleted`);
    expect(await deletedList.json()).toMatchObject({ data: { totalCount: 1 } });
  }, 90_000);
});

afterAll(async () => {
  if (repoId) await db.repo.delete({ where: { id: repoId } }).catch(() => undefined);
  await db?.developer.deleteMany({ where: { email: { startsWith: repoName } } });
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await disconnectAppDatabase?.();
  await database?.$disconnect();
  await cleanupFixture?.();
});
