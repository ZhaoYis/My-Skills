import { generateKeyPairSync } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { CollectionService } from '../src/services/collection-service.ts';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const db = enabled ? new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL }) : null;
let repoId;

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const env = {
  NODE_ENV: 'test',
  PORT: 3001,
  DB_PROVIDER: 'postgresql',
  DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://localhost/test',
  JWT_SECRET: '01234567890123456789012345678901',
  FINGERPRINT_PRIVATE_KEYS: JSON.stringify({ fp1: Buffer.from(privateKey).toString('base64') }),
  COLLECTOR_TEMP_DIR: '.collector',
  COLLECTOR_CRON_SCHEDULE: '0 */4 * * *',
  COLLECTOR_CONCURRENCY: 2,
  COLLECTOR_LOCK_TIMEOUT: 60_000,
  CORS_ORIGIN: 'http://localhost:3000',
};

describe.runIf(enabled)('collector lock', () => {
  it('rejects an active lock and recovers an expired lock', async () => {
    const repo = await db.repo.create({ data: { name: 'lock-test', gitUrl: 'https://example.invalid/lock.git', collectSince: new Date() } });
    repoId = repo.id;
    const service = new CollectionService(db, env);
    expect(await service.acquireLock(repo.id)).toBe(true);
    expect(await service.acquireLock(repo.id)).toBe(false);
    await db.repo.update({
      where: { id: repo.id },
      data: { collectionStartedAt: new Date(Date.now() - 120_000) },
    });
    expect(await service.acquireLock(repo.id)).toBe(true);
  });
});

afterAll(async () => {
  if (repoId) await db.repo.delete({ where: { id: repoId } });
  await db?.$disconnect();
});
