import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const db = enabled ? new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL }) : null;

describe.runIf(enabled)('metrics query plan', () => {
  it('can use the trusted-latest composite index for bounded developer queries', async () => {
    const indexes = await db?.$queryRaw<Array<{ indexname: string }>>(Prisma.sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = current_schema() AND tablename = 'pipeline_runs'
    `);
    expect(indexes?.map(({ indexname }) => indexname)).toContain(
      'pipeline_runs_trusted_latest_query_idx',
    );

    const plan = await db?.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL enable_seqscan = off`;
      return tx.$queryRaw<Array<{ 'QUERY PLAN': string }>>(Prisma.sql`
        EXPLAIN (FORMAT TEXT)
        SELECT "developer_id", "status", "change_duration_seconds"
        FROM "pipeline_runs"
        WHERE "developer_id" IN (1, 2, 3)
          AND "is_latest" = TRUE
          AND "fingerprint_verified" = TRUE
          AND "snapshot_source" = 'collector'
          AND "completed_at_pipeline" >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        ORDER BY "developer_id", "is_latest", "fingerprint_verified", "snapshot_source", "completed_at_pipeline", "repo_id"
      `);
    });
    expect(plan?.map((row) => row['QUERY PLAN']).join('\n')).toContain(
      'pipeline_runs_trusted_latest_query_idx',
    );
  });
});

afterAll(async () => {
  await db?.$disconnect();
});
