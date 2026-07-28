import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  AdministrationService,
  InvalidTeamAssignmentError,
} from '../src/services/administration-service.js';

function database() {
  const db = {
    repo: {
      findMany: vi.fn().mockResolvedValue([{ id: 1, name: 'api' }]),
      count: vi.fn().mockResolvedValue(1),
    },
    collectionLog: {
      findMany: vi.fn().mockResolvedValue([{ id: 2n }]),
      count: vi.fn().mockResolvedValue(1),
    },
    team: { findFirst: vi.fn() },
    developer: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockResolvedValue({ id: 7, teamId: 2, tokenVersion: 4 }),
    },
  };
  return { db: db as unknown as PrismaClient, spies: db };
}

describe('injectable administration data service', () => {
  it('owns repository and collection pagination filters', async () => {
    const { db, spies } = database();
    const service = new AdministrationService(db);
    await expect(
      service.listRepos({ q: 'api', status: 'active', skip: 20, take: 10 }),
    ).resolves.toMatchObject({ records: [{ id: 1 }], totalCount: 1 });
    expect(spies.repo.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        deletedAt: null,
        isActive: true,
        OR: [{ name: { contains: 'api' } }, { gitUrl: { contains: 'api' } }],
      }),
      skip: 20,
      take: 10,
      orderBy: { id: 'asc' },
    });

    await expect(
      service.collectionLogs({ status: 'error', repoId: 3, skip: 0, take: 25 }),
    ).resolves.toMatchObject({ records: [{ id: 2n }], totalCount: 1 });
    expect(spies.collectionLog.count).toHaveBeenCalledWith({
      where: { status: 'error', repoId: 3 },
    });
  });

  it('validates team assignment and increments authorization version inside the service', async () => {
    const invalidDatabase = database();
    invalidDatabase.spies.team.findFirst.mockResolvedValue(null);
    await expect(
      new AdministrationService(invalidDatabase.db).updateDeveloper(7, { teamId: 99 }),
    ).rejects.toBeInstanceOf(InvalidTeamAssignmentError);
    expect(invalidDatabase.spies.developer.update).not.toHaveBeenCalled();

    const validDatabase = database();
    validDatabase.spies.team.findFirst.mockResolvedValue({ id: 2 });
    await new AdministrationService(validDatabase.db).updateDeveloper(7, {
      teamId: 2,
      role: 'admin',
      isActive: true,
    });
    expect(validDatabase.spies.developer.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({
        teamId: 2,
        role: 'admin',
        isActive: true,
        deactivatedAt: null,
        tokenVersion: { increment: 1 },
      }),
      include: { team: true },
    });
  });
});
