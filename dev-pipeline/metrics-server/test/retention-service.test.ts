import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { RETENTION_CONFIRMATION, RetentionService } from '../src/services/retention-service.js';

function database(options: { failCount?: boolean } = {}) {
  const db = {
    repo: {
      findMany: vi.fn().mockResolvedValue([{ id: 1 }]),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 1, retentionDays: 30 }),
    },
    pipelineRun: {
      count: options.failCount
        ? vi.fn().mockRejectedValue(new Error('count failed'))
        : vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(3),
      deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
    retentionOperationLog: {
      create: vi.fn().mockResolvedValue({ id: 10n }),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 10n, ...data })),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  return { db: db as unknown as PrismaClient, spies: db };
}

const disabled = {
  RETENTION_ENABLED: false,
  RETENTION_DRY_RUN: true,
  RETENTION_CONFIRMATION: undefined,
};
const enabled = {
  RETENTION_ENABLED: true,
  RETENTION_DRY_RUN: true,
  RETENTION_CONFIRMATION,
};

describe('retention cleanup safety boundary', () => {
  it('classifies hot, protected warm, and eligible cold snapshots', async () => {
    const { db, spies } = database();
    const result = await new RetentionService(db, disabled).classify(
      1,
      new Date('2026-07-28T00:00:00.000Z'),
    );
    expect(result).toMatchObject({
      hotRuns: 2,
      warmRuns: 1,
      coldRuns: 3,
      eligibleRuns: 3,
      preservedRuns: 3,
    });
    expect(spies.pipelineRun.count).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ isLatest: true }, { isLatestHistorical: true }],
        }),
      }),
    );
    expect(spies.pipelineRun.count).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: expect.objectContaining({ isLatest: false, isLatestHistorical: false }),
      }),
    );
  });

  it('records a check without deleting when execution conditions are missing', async () => {
    const { db, spies } = database();
    const [result] = await new RetentionService(db, disabled).run({
      triggerSource: 'scheduled',
      dryRun: false,
    });
    expect(result).toMatchObject({ status: 'checked', deletedRuns: 0 });
    expect(spies.pipelineRun.deleteMany).not.toHaveBeenCalled();
    expect(spies.retentionOperationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        triggerSource: 'scheduled',
        dryRun: true,
        enabled: false,
        details: { executionBlocked: 'RETENTION_ENABLED is false' },
      }),
    });
  });

  it('supports dry-run and executes only after explicit enablement', async () => {
    const dryDatabase = database();
    const [dryResult] = await new RetentionService(dryDatabase.db, enabled).run({
      triggerSource: 'manual',
      dryRun: true,
    });
    expect(dryResult).toMatchObject({ status: 'completed', deletedRuns: 0, eligibleRuns: 3 });
    expect(dryDatabase.spies.pipelineRun.deleteMany).not.toHaveBeenCalled();

    const executeDatabase = database();
    const [executeResult] = await new RetentionService(executeDatabase.db, enabled).run({
      triggerSource: 'manual',
      dryRun: false,
    });
    expect(executeResult).toMatchObject({ status: 'completed', deletedRuns: 3 });
    expect(executeDatabase.spies.pipelineRun.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ isLatest: false, isLatestHistorical: false }),
    });
  });

  it('records a failed operation before propagating the error', async () => {
    const { db, spies } = database({ failCount: true });
    await expect(
      new RetentionService(db, enabled).run({ triggerSource: 'scheduled' }),
    ).rejects.toThrow('count failed');
    expect(spies.retentionOperationLog.update).toHaveBeenLastCalledWith({
      where: { id: 10n },
      data: expect.objectContaining({ status: 'error', errorMessage: 'count failed' }),
    });
  });
});
