import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { resolvePrismaConfig } from '../scripts/prisma-config.mjs';

describe('Prisma provider selection', () => {
  it.each([
    ['postgresql', 'postgresql://postgres:password@localhost:5432/metrics'],
    ['mysql', 'mysql://root:password@localhost:3306/metrics'],
  ])('selects one matching schema and migration root for %s', (provider, databaseUrl) => {
    const config = resolvePrismaConfig({ DB_PROVIDER: provider, DATABASE_URL: databaseUrl });
    expect(config.schemaPath).toContain(`/providers/${provider}/schema.prisma`);
    expect(config.migrationsPath).toContain(`/providers/${provider}/migrations`);
  });

  it('rejects cross-provider migration selection before invoking Prisma', () => {
    expect(() =>
      resolvePrismaConfig({
        DB_PROVIDER: 'mysql',
        DATABASE_URL: 'postgresql://postgres:password@localhost:5432/metrics',
      }),
    ).toThrow('does not match DB_PROVIDER=mysql');
  });

  it('requires an explicit database URL for Prisma commands', () => {
    expect(() => resolvePrismaConfig({ DB_PROVIDER: 'postgresql' })).toThrow(
      'DATABASE_URL is required',
    );
  });

  it.each([
    ['postgresql', 'postgresql://postgres:password@localhost:5432/metrics'],
    ['mysql', 'mysql://root:password@localhost:3306/metrics'],
  ])('keeps a complete provider-specific baseline for %s', async (provider, databaseUrl) => {
    const config = resolvePrismaConfig({ DB_PROVIDER: provider, DATABASE_URL: databaseUrl });
    const [lock, migration] = await Promise.all([
      readFile(`${config.migrationsPath}/migration_lock.toml`, 'utf8'),
      readFile(`${config.migrationsPath}/20260728010000_init/migration.sql`, 'utf8'),
    ]);
    expect(lock).toContain(`provider = "${provider}"`);
    expect(migration.match(/^CREATE TABLE/gm)).toHaveLength(13);
    if (provider === 'postgresql') {
      expect(migration).toContain('BIGSERIAL');
      expect(migration).not.toContain('AUTO_INCREMENT');
    } else {
      expect(migration).toContain('AUTO_INCREMENT');
      expect(migration).not.toContain('BIGSERIAL');
      expect(migration).not.toContain('JSONB');
    }
  });
});
