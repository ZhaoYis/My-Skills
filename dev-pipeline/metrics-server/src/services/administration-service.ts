import type { Prisma, PrismaClient } from '@prisma/client';
import { clearTeamCache } from './team-cache.js';

export interface PageInput {
  skip: number;
  take: number;
}

export type RepoStatus = 'all' | 'active' | 'inactive' | 'error' | 'deleted';
export type DeveloperClaim = 'all' | 'linked' | 'unlinked';
export type DeveloperStatus = 'all' | 'active' | 'inactive';

export interface DeveloperAdminUpdate {
  teamId?: number | null;
  role?: 'admin' | 'member' | null;
  displayName?: string;
  externalId?: string | null;
  isActive?: boolean;
}

export class InvalidTeamAssignmentError extends Error {}

export class AdministrationService {
  constructor(private readonly db: PrismaClient) {}

  async listRepos(input: PageInput & { q?: string; status: RepoStatus }) {
    const where: Prisma.RepoWhereInput = {
      ...(input.q
        ? { OR: [{ name: { contains: input.q } }, { gitUrl: { contains: input.q } }] }
        : {}),
      ...(input.status === 'deleted' ? { deletedAt: { not: null } } : { deletedAt: null }),
      ...(input.status === 'active' ? { isActive: true } : {}),
      ...(input.status === 'inactive' ? { isActive: false } : {}),
      ...(input.status === 'error' ? { collectionStatus: 'error' } : {}),
    };
    const [records, totalCount] = await Promise.all([
      this.db.repo.findMany({
        where,
        skip: input.skip,
        take: input.take,
        orderBy: { id: 'asc' },
      }),
      this.db.repo.count({ where }),
    ]);
    return { records, totalCount };
  }

  repoDetail(id: number) {
    return this.db.repo.findUniqueOrThrow({
      where: { id },
      include: { collectionLogs: { orderBy: { startedAt: 'desc' }, take: 10 } },
    });
  }

  ensureRepo(id: number) {
    return this.db.repo.findUniqueOrThrow({ where: { id }, select: { id: true } });
  }

  createRepo(data: Prisma.RepoCreateInput) {
    return this.db.repo.create({ data });
  }

  updateRepo(id: number, data: Prisma.RepoUpdateInput) {
    return this.db.repo.update({ where: { id, deletedAt: null }, data });
  }

  setRepoStatus(id: number, isActive: boolean) {
    return this.db.repo.update({
      where: { id, deletedAt: null },
      data: {
        isActive,
        ...(!isActive
          ? { collectionStatus: 'idle', collectionStartedAt: null, collectionError: null }
          : {}),
      },
    });
  }

  softDeleteRepo(id: number, now = new Date()) {
    return this.db.repo.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: now,
        collectionStatus: 'idle',
        collectionStartedAt: null,
        collectionError: null,
      },
    });
  }

  restoreRepo(id: number) {
    return this.db.repo.update({
      where: { id, deletedAt: { not: null } },
      data: {
        isActive: false,
        deletedAt: null,
        collectionStatus: 'idle',
        collectionStartedAt: null,
        collectionError: null,
      },
    });
  }

  resetRepoCollection(id: number) {
    return this.db.repo.update({
      where: { id, deletedAt: null },
      data: {
        lastFetchedCommit: null,
        scanFromCommit: null,
        scanToCommit: null,
        lastRelevantCommit: null,
        lastFetchedAt: null,
        collectionStatus: 'idle',
        collectionStartedAt: null,
        collectionError: null,
      },
    });
  }

  collectibleRepo(id: number) {
    return this.db.repo.findUniqueOrThrow({
      where: { id, deletedAt: null, isActive: true },
    });
  }

  collectionStatus() {
    return this.db.repo.findMany({
      select: {
        id: true,
        name: true,
        collectionStatus: true,
        collectionStartedAt: true,
        collectionError: true,
        lastFetchedAt: true,
      },
    });
  }

  async collectionLogs(input: PageInput & { status?: string; repoId?: number }) {
    const where = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.repoId ? { repoId: input.repoId } : {}),
    };
    const [records, totalCount] = await Promise.all([
      this.db.collectionLog.findMany({
        where,
        skip: input.skip,
        take: input.take,
        include: { repo: true },
        orderBy: { queuedAt: 'desc' },
      }),
      this.db.collectionLog.count({ where }),
    ]);
    return { records, totalCount };
  }

  collectionJob(id: bigint) {
    return this.db.collectionLog.findUnique({ where: { id }, include: { repo: true } });
  }

  async historyImports(input: PageInput) {
    const where = { snapshotSource: 'history-import' };
    const [records, totalCount] = await Promise.all([
      this.db.pipelineRun.findMany({
        where,
        skip: input.skip,
        take: input.take,
        orderBy: { commitTimestamp: 'desc' },
        select: {
          id: true,
          repoId: true,
          changeName: true,
          stateVersion: true,
          fingerprintId: true,
          fingerprintVerified: true,
          isLatestHistorical: true,
          commitSha: true,
          commitTimestamp: true,
        },
      }),
      this.db.pipelineRun.count({ where }),
    ]);
    return { records, totalCount };
  }

  async syncLogs(input: PageInput & { status: 'all' | 'running' | 'completed' | 'error' }) {
    const where = input.status === 'all' ? {} : { status: input.status };
    const [records, totalCount] = await Promise.all([
      this.db.syncLog.findMany({
        where,
        select: syncLogListSelect,
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        skip: input.skip,
        take: input.take,
      }),
      this.db.syncLog.count({ where }),
    ]);
    return { records, totalCount };
  }

  syncLog(id: bigint) {
    return this.db.syncLog.findUnique({ where: { id } });
  }

  lastSync() {
    return this.db.syncLog.findFirst({ select: syncLogListSelect, orderBy: { startedAt: 'desc' } });
  }

  async listDevelopers(
    input: PageInput & {
      q?: string;
      unassigned?: boolean;
      claim: DeveloperClaim;
      status: DeveloperStatus;
      teamId?: number;
    },
  ) {
    const where: Prisma.DeveloperWhereInput = {
      ...(input.q
        ? {
            OR: [
              { email: { contains: input.q } },
              { displayName: { contains: input.q } },
              { externalId: { contains: input.q } },
            ],
          }
        : {}),
      ...(input.unassigned ? { teamId: null } : {}),
      ...(input.teamId ? { teamId: input.teamId } : {}),
      ...(input.claim === 'linked' ? { externalId: { not: null } } : {}),
      ...(input.claim === 'unlinked' ? { externalId: null } : {}),
      ...(input.status === 'active' ? { isActive: true } : {}),
      ...(input.status === 'inactive' ? { isActive: false } : {}),
    };
    const [records, totalCount] = await Promise.all([
      this.db.developer.findMany({
        where,
        skip: input.skip,
        take: input.take,
        include: { team: true },
        orderBy: { id: 'asc' },
      }),
      this.db.developer.count({ where }),
    ]);
    return { records, totalCount };
  }

  async updateDeveloper(id: number, data: DeveloperAdminUpdate) {
    if (data.teamId) {
      const target = await this.db.team.findFirst({
        where: { id: data.teamId, isActive: true },
        select: { id: true },
      });
      if (!target) throw new InvalidTeamAssignmentError('目标团队不存在或已停用');
    }
    const result = await this.db.developer.update({
      where: { id },
      data: {
        ...data,
        ...(data.isActive === undefined
          ? {}
          : { deactivatedAt: data.isActive ? null : new Date() }),
        tokenVersion: { increment: 1 },
      },
      include: { team: true },
    });
    clearTeamCache();
    return result;
  }

  visibleTeams(ids: number[]) {
    return this.db.team.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, name: true, slug: true, parentId: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }
}

export const syncLogListSelect = {
  id: true,
  source: true,
  adapter: true,
  triggerSource: true,
  attempt: true,
  retryOfId: true,
  status: true,
  startedAt: true,
  finishedAt: true,
  dryRun: true,
  teamsCreated: true,
  teamsUpdated: true,
  teamsMoved: true,
  teamsDeactivated: true,
  devsCreated: true,
  devsUpdated: true,
  devsLinked: true,
  devsMoved: true,
  devsUnassigned: true,
  devsDeactivated: true,
  failures: true,
  errorCategory: true,
  errorMessage: true,
} as const;
