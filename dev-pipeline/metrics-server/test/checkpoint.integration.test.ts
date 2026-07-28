import { generateKeyPairSync } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';
import { CollectionService } from '../src/services/collection-service.js';
import { createGitRepositoryFixture } from './helpers/git-repository.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const db = enabled ? new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL }) : null;
const database = db as PrismaClient;
let repoId: number | undefined;
let cleanupFixture: (() => Promise<void>) | undefined;

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const privateKeys = JSON.stringify({ fp1: Buffer.from(privateKey).toString('base64') });

describe.runIf(enabled)('collection checkpoint persistence', () => {
  it('advances to remote HEAD even when no relevant commits exist', async () => {
    const fixture = await createGitRepositoryFixture();
    cleanupFixture = fixture.cleanup;
    const repo = await database.repo.create({
      data: {
        name: 'm007-checkpoint-integration',
        gitUrl: fixture.remote,
        gitBranch: 'main',
        collectSince: new Date(0),
      },
    });
    repoId = repo.id;
    const service = new CollectionService(
      database,
      parseEnv({
        NODE_ENV: 'test',
        DATABASE_URL: process.env.TEST_DATABASE_URL,
        JWT_SECRET: 'checkpoint-test-secret-at-least-32-characters',
        FINGERPRINT_PRIVATE_KEYS: privateKeys,
        COLLECTOR_TEMP_DIR: fixture.collector,
      }),
    );

    const first = await service.collectRepo(repo.id);
    expect(first).toMatchObject({ commitsScanned: 0, batchesCompleted: 0 });
    expect(first.scanToCommit).not.toBeNull();
    expect(await database.repo.findUniqueOrThrow({ where: { id: repo.id } })).toMatchObject({
      lastFetchedCommit: first.scanToCommit,
      scanToCommit: first.scanToCommit,
    });

    const nextHead = await fixture.commit('README.md', 'second unrelated change\n', 'unrelated');
    await fixture.push();
    const second = await service.collectRepo(repo.id);
    expect(second).toMatchObject({
      commitsScanned: 0,
      scanFromCommit: first.scanToCommit,
      scanToCommit: nextHead,
    });
    const stored = await database.repo.findUniqueOrThrow({ where: { id: repo.id } });
    expect(stored.lastFetchedCommit).toBe(nextHead);
    const logs = await database.collectionLog.findMany({
      where: { repoId: repo.id },
      orderBy: { startedAt: 'asc' },
    });
    expect(logs).toHaveLength(2);
    expect(logs.every((log) => log.status === 'completed' && log.batchesCompleted === 0)).toBe(
      true,
    );
  }, 60_000);
});

afterAll(async () => {
  if (repoId) await database.repo.delete({ where: { id: repoId } });
  await db?.$disconnect();
  await cleanupFixture?.();
});
