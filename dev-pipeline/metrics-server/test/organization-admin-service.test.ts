import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  OrganizationAdminService,
  OrganizationConflictError,
} from '../src/services/organization-admin-service.js';

function database() {
  const db = {
    team: {
      findMany: vi.fn().mockResolvedValue([
        { id: 1, name: 'Root', parentId: null },
        { id: 2, name: 'Child', parentId: 1 },
      ]),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 1, parentId: null }),
      findFirst: vi.fn().mockResolvedValue({ id: 3 }),
      update: vi.fn().mockResolvedValue({ id: 1, name: 'Updated' }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
    developer: {
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      findMany: vi.fn().mockResolvedValue([{ id: 10 }, { id: 11 }]),
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((callback) => callback(db));
  return { db: db as unknown as PrismaClient, spies: db };
}

describe('injectable organization transaction service', () => {
  it('builds hierarchy without a database-specific route dependency', async () => {
    const { db } = database();
    await expect(new OrganizationAdminService(db).listTeams('all')).resolves.toMatchObject([
      { id: 1, children: [{ id: 2 }] },
    ]);
  });

  it('rejects cycles and performs authorization invalidation in one transaction', async () => {
    const cycleDatabase = database();
    await expect(
      new OrganizationAdminService(cycleDatabase.db).updateTeam(1, { parentId: 2 }),
    ).rejects.toBeInstanceOf(OrganizationConflictError);
    expect(cycleDatabase.spies.team.update).not.toHaveBeenCalled();

    const updateDatabase = database();
    await new OrganizationAdminService(updateDatabase.db).updateTeam(1, { name: 'Updated' });
    expect(updateDatabase.spies.$transaction).toHaveBeenCalledOnce();
    expect(updateDatabase.spies.developer.updateMany).toHaveBeenCalledWith({
      where: { teamId: { in: [1, 2] } },
      data: { tokenVersion: { increment: 1 } },
    });
  });
});
