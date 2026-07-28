import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  PercentileInputLimitError,
  PrismaMetricsQueryPort,
  trustedRunFilter,
} from '../src/services/metrics-query-port.js';

function database(durationRows: Array<{ changeDurationSeconds: number | null }> = []) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ medianSeconds: 25, p95Seconds: 38.5 }]),
    pipelineRun: { findMany: vi.fn().mockResolvedValue(durationRows) },
  } as unknown as PrismaClient;
}

describe('metrics query data port', () => {
  it('centralizes trusted, date, and repository filtering', () => {
    expect(trustedRunFilter([1, 2], { days: 30, repoId: 7 })).toMatchObject({
      developerId: { in: [1, 2] },
      repoId: 7,
      isLatest: true,
      fingerprintVerified: true,
      snapshotSource: 'collector',
      OR: [
        { status: 'completed', completedAtPipeline: { gte: expect.any(Date) } },
        { status: { not: 'completed' }, updatedAtPipeline: { gte: expect.any(Date) } },
      ],
    });
  });

  it('uses PostgreSQL PERCENTILE_CONT and matches the controlled MySQL result', async () => {
    const postgresDb = database();
    const mysqlDb = database([
      { changeDurationSeconds: 10 },
      { changeDurationSeconds: 20 },
      { changeDurationSeconds: 30 },
      { changeDurationSeconds: 40 },
    ]);
    const postgres = await new PrismaMetricsQueryPort(postgresDb, 'postgresql').durationPercentiles(
      [1],
      { days: 30 },
    );
    const mysql = await new PrismaMetricsQueryPort(mysqlDb, 'mysql', 10).durationPercentiles([1], {
      days: 30,
    });

    expect(postgres).toEqual({ medianSeconds: 25, p95Seconds: 38.5 });
    expect(mysql).toEqual(postgres);
    expect(postgresDb.$queryRaw).toHaveBeenCalledOnce();
    expect(mysqlDb.pipelineRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { changeDurationSeconds: true },
        orderBy: { changeDurationSeconds: 'asc' },
        take: 11,
      }),
    );
  });

  it('rejects an unbounded MySQL percentile input', async () => {
    const db = database([
      { changeDurationSeconds: 10 },
      { changeDurationSeconds: 20 },
      { changeDurationSeconds: 30 },
    ]);
    await expect(
      new PrismaMetricsQueryPort(db, 'mysql', 2).durationPercentiles([1]),
    ).rejects.toBeInstanceOf(PercentileInputLimitError);
  });
});
