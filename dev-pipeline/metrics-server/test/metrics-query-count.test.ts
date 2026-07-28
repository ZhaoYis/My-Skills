import type { PrismaClient } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearMetricsCache } from '../src/services/metrics-cache.js';
import { MetricsService } from '../src/services/metrics-service.js';
import { clearTeamCache } from '../src/services/team-cache.js';

function thousandMemberDatabase() {
  const developers = Array.from({ length: 1_000 }, (_, index) => ({
    id: index + 1,
    displayName: `Developer ${String(index + 1).padStart(4, '0')}`,
    email: `developer-${index + 1}@example.invalid`,
    team: { id: 1, name: 'Scale Team' },
  }));
  const db = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: 1 }]),
    developer: {
      findMany: vi
        .fn()
        .mockImplementation((query) =>
          Promise.resolve(query.select?.id ? developers.map(({ id }) => ({ id })) : developers),
        ),
    },
    pipelineRun: { findMany: vi.fn().mockResolvedValue([]) },
    phaseHistoryEntry: { findMany: vi.fn().mockResolvedValue([]) },
    pipelineGateBypassed: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { db: db as unknown as PrismaClient, spies: db };
}

afterEach(clearTeamCache);

describe('large-team metrics query count', () => {
  it('keeps data access fixed for 1000 members and invalidates the member cache explicitly', async () => {
    const { db, spies } = thousandMemberDatabase();
    const service = new MetricsService(db);
    const page = await service.members(1, 1, 20, { days: 30 });

    expect(page.totalCount).toBe(1_000);
    expect(page.records).toHaveLength(20);
    expect(spies.$queryRaw).toHaveBeenCalledOnce();
    expect(spies.developer.findMany).toHaveBeenCalledTimes(2);
    expect(spies.pipelineRun.findMany).toHaveBeenCalledOnce();
    expect(spies.phaseHistoryEntry.findMany).toHaveBeenCalledOnce();
    expect(spies.pipelineGateBypassed.findMany).toHaveBeenCalledOnce();
    expect(
      spies.$queryRaw.mock.calls.length +
        spies.developer.findMany.mock.calls.length +
        spies.pipelineRun.findMany.mock.calls.length +
        spies.phaseHistoryEntry.findMany.mock.calls.length +
        spies.pipelineGateBypassed.findMany.mock.calls.length,
    ).toBe(6);

    await service.teamDeveloperIds(1);
    expect(spies.developer.findMany).toHaveBeenCalledTimes(2);
    clearTeamCache();
    await service.teamDeveloperIds(1);
    expect(spies.developer.findMany).toHaveBeenCalledTimes(3);
  });

  it('caches bounded overview queries and supports explicit collection invalidation', async () => {
    const { db, spies } = thousandMemberDatabase();
    const service = new MetricsService(db);
    await service.overview([1], { days: 30, repoId: 7 });
    await service.overview([1], { days: 30, repoId: 7 });
    expect(spies.pipelineRun.findMany).toHaveBeenCalledOnce();
    expect(spies.phaseHistoryEntry.findMany).toHaveBeenCalledOnce();
    expect(spies.pipelineGateBypassed.findMany).toHaveBeenCalledOnce();
    expect(spies.$queryRaw).toHaveBeenCalledOnce();

    clearMetricsCache(db);
    await service.overview([1], { days: 30, repoId: 7 });
    expect(spies.pipelineRun.findMany).toHaveBeenCalledTimes(2);
    expect(spies.$queryRaw).toHaveBeenCalledTimes(2);
  });
});
