import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { classifyAdapterError, type OrganizationAdapter } from '../adapters/organization/types.js';
import { clearTeamCache } from './team-cache.js';

const externalId = z.string().trim().min(1).max(255);
const sourceSchema = z.string().trim().min(1).max(32);

const orgTeamSchema = z
  .object({
    externalId,
    name: z.string().trim().min(1).max(128),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[a-z0-9-]+$/),
    parentExternalId: externalId.nullable().optional(),
  })
  .strict();

const orgDeveloperSchema = z
  .object({
    externalId,
    email: z.string().trim().toLowerCase().email().max(255),
    name: z.string().trim().min(1).max(255),
    teamExternalId: externalId.nullable().optional(),
  })
  .strict();

export const OrgDataSchema = z
  .object({
    teams: z.array(orgTeamSchema).max(10_000),
    developers: z.array(orgDeveloperSchema).max(100_000),
  })
  .strict()
  .superRefine((data, context) => {
    const teams = new Map<string, (typeof data.teams)[number]>();
    const slugs = new Set<string>();
    for (const [index, team] of data.teams.entries()) {
      if (teams.has(team.externalId)) {
        context.addIssue({
          code: 'custom',
          message: '团队 externalId 重复',
          path: ['teams', index, 'externalId'],
        });
      }
      if (slugs.has(team.slug)) {
        context.addIssue({
          code: 'custom',
          message: '团队 slug 重复',
          path: ['teams', index, 'slug'],
        });
      }
      teams.set(team.externalId, team);
      slugs.add(team.slug);
    }

    for (const [index, team] of data.teams.entries()) {
      if (team.parentExternalId && !teams.has(team.parentExternalId)) {
        context.addIssue({
          code: 'custom',
          message: '父团队不存在于当前完整快照',
          path: ['teams', index, 'parentExternalId'],
        });
      }
    }

    const complete = new Set<string>();
    for (const team of data.teams) {
      if (complete.has(team.externalId)) continue;
      const path: string[] = [];
      const positions = new Map<string, number>();
      let current: string | null | undefined = team.externalId;
      while (current && !complete.has(current)) {
        const cycleStart = positions.get(current);
        if (cycleStart !== undefined) {
          const cycle = [...path.slice(cycleStart), current].join(' -> ');
          context.addIssue({
            code: 'custom',
            message: `团队层级存在循环: ${cycle}`,
            path: ['teams'],
          });
          break;
        }
        positions.set(current, path.length);
        path.push(current);
        current = teams.get(current)?.parentExternalId;
      }
      for (const item of path) complete.add(item);
    }

    const developerIds = new Set<string>();
    const emails = new Set<string>();
    for (const [index, developer] of data.developers.entries()) {
      if (developerIds.has(developer.externalId)) {
        context.addIssue({
          code: 'custom',
          message: '开发者 externalId 重复',
          path: ['developers', index, 'externalId'],
        });
      }
      if (emails.has(developer.email)) {
        context.addIssue({
          code: 'custom',
          message: '开发者邮箱重复',
          path: ['developers', index, 'email'],
        });
      }
      if (developer.teamExternalId && !teams.has(developer.teamExternalId)) {
        context.addIssue({
          code: 'custom',
          message: '开发者所属团队不存在于当前完整快照',
          path: ['developers', index, 'teamExternalId'],
        });
      }
      developerIds.add(developer.externalId);
      emails.add(developer.email);
    }
  });

export type OrgData = z.infer<typeof OrgDataSchema>;

export interface OrgSyncDiff {
  teamsCreated: number;
  teamsUpdated: number;
  teamsMoved: number;
  teamsDeactivated: number;
  devsCreated: number;
  devsUpdated: number;
  devsLinked: number;
  devsMoved: number;
  devsUnassigned: number;
  devsDeactivated: number;
}

type OrgDatabase = Pick<PrismaClient, 'team' | 'developer'>;

interface OrgState {
  teams: Awaited<ReturnType<typeof loadTeams>>;
  developers: Awaited<ReturnType<typeof loadDevelopers>>;
}

async function loadTeams(db: OrgDatabase, source: string, data: OrgData) {
  return db.team.findMany({
    where: {
      OR: [
        { syncSource: source },
        { externalId: { in: data.teams.map((team) => team.externalId) } },
      ],
    },
    select: {
      id: true,
      externalId: true,
      syncSource: true,
      name: true,
      slug: true,
      parentId: true,
      isActive: true,
      parent: { select: { externalId: true } },
    },
  });
}

async function loadDevelopers(db: OrgDatabase, source: string, data: OrgData) {
  return db.developer.findMany({
    where: {
      OR: [
        { syncSource: source },
        { externalId: { in: data.developers.map((developer) => developer.externalId) } },
        { email: { in: data.developers.map((developer) => developer.email) } },
      ],
    },
    select: {
      id: true,
      externalId: true,
      syncSource: true,
      email: true,
      displayName: true,
      teamId: true,
      isActive: true,
      team: { select: { externalId: true } },
    },
  });
}

async function loadOrgState(db: OrgDatabase, source: string, data: OrgData): Promise<OrgState> {
  const [teams, developers] = await Promise.all([
    loadTeams(db, source, data),
    loadDevelopers(db, source, data),
  ]);
  for (const team of teams) {
    if (team.externalId && data.teams.some((item) => item.externalId === team.externalId)) {
      if (team.syncSource && team.syncSource !== source) {
        throw new Error(`团队 externalId 已由其他同步源管理: ${team.externalId}`);
      }
    }
  }
  return { teams, developers };
}

function calculateDiffFromState(source: string, data: OrgData, state: OrgState): OrgSyncDiff {
  const diff: OrgSyncDiff = {
    teamsCreated: 0,
    teamsUpdated: 0,
    teamsMoved: 0,
    teamsDeactivated: 0,
    devsCreated: 0,
    devsUpdated: 0,
    devsLinked: 0,
    devsMoved: 0,
    devsUnassigned: 0,
    devsDeactivated: 0,
  };
  const teamByExternalId = new Map(state.teams.map((team) => [team.externalId, team]));
  const matchedTeams = new Set<number>();
  for (const team of data.teams) {
    const existing = teamByExternalId.get(team.externalId);
    if (!existing) {
      diff.teamsCreated += 1;
      continue;
    }
    matchedTeams.add(existing.id);
    const parentExternalId = existing.parent?.externalId ?? null;
    if (parentExternalId !== (team.parentExternalId ?? null)) diff.teamsMoved += 1;
    if (
      existing.name !== team.name ||
      existing.slug !== team.slug ||
      existing.syncSource !== source ||
      !existing.isActive ||
      parentExternalId !== (team.parentExternalId ?? null)
    ) {
      diff.teamsUpdated += 1;
    }
  }
  diff.teamsDeactivated = state.teams.filter(
    (team) => team.syncSource === source && team.isActive && !matchedTeams.has(team.id),
  ).length;

  const byExternalId = new Map(
    state.developers.map((developer) => [developer.externalId, developer]),
  );
  const byEmail = new Map(
    state.developers.map((developer) => [developer.email.toLowerCase(), developer]),
  );
  const matchedDevelopers = new Set<number>();
  for (const developer of data.developers) {
    const externalMatch = byExternalId.get(developer.externalId);
    const emailMatch = byEmail.get(developer.email);
    if (externalMatch && emailMatch && externalMatch.id !== emailMatch.id) {
      throw new Error(`开发者 externalId 与邮箱映射到不同记录: ${developer.externalId}`);
    }
    const existing = externalMatch ?? emailMatch;
    if (!existing) {
      diff.devsCreated += 1;
      continue;
    }
    if (existing.syncSource && existing.syncSource !== source) {
      throw new Error(`开发者已由其他同步源管理: ${developer.externalId}`);
    }
    matchedDevelopers.add(existing.id);
    const previousTeam = existing.team?.externalId ?? null;
    const nextTeam = developer.teamExternalId ?? null;
    if (previousTeam && !nextTeam) diff.devsUnassigned += 1;
    else if (previousTeam !== nextTeam) diff.devsMoved += 1;
    if (existing.externalId !== developer.externalId) diff.devsLinked += 1;
    if (
      existing.email.toLowerCase() !== developer.email ||
      existing.displayName !== developer.name ||
      existing.externalId !== developer.externalId ||
      existing.syncSource !== source ||
      !existing.isActive ||
      previousTeam !== nextTeam
    ) {
      diff.devsUpdated += 1;
    }
  }
  diff.devsDeactivated = state.developers.filter(
    (developer) =>
      developer.syncSource === source && developer.isActive && !matchedDevelopers.has(developer.id),
  ).length;
  return diff;
}

export async function previewOrgSync(db: OrgDatabase, sourceInput: string, input: unknown) {
  const source = sourceSchema.parse(sourceInput);
  const data = OrgDataSchema.parse(input);
  return calculateDiffFromState(source, data, await loadOrgState(db, source, data));
}

async function reconcileOrg(
  db: Prisma.TransactionClient,
  source: string,
  data: OrgData,
  now: Date,
) {
  const state = await loadOrgState(db, source, data);
  const diff = calculateDiffFromState(source, data, state);
  const existingTeams = new Map(state.teams.map((team) => [team.externalId, team]));
  const teamIds = new Map<string, number>();

  for (const team of data.teams) {
    const existing = existingTeams.get(team.externalId);
    const stored = existing
      ? await db.team.update({
          where: { id: existing.id },
          data: {
            name: team.name,
            slug: team.slug,
            syncSource: source,
            isActive: true,
            deactivatedAt: null,
          },
        })
      : await db.team.create({
          data: {
            externalId: team.externalId,
            name: team.name,
            slug: team.slug,
            syncSource: source,
            isActive: true,
          },
        });
    teamIds.set(team.externalId, stored.id);
  }
  for (const team of data.teams) {
    const storedTeamId = teamIds.get(team.externalId);
    const parentId = team.parentExternalId ? teamIds.get(team.parentExternalId) : null;
    if (!storedTeamId || (team.parentExternalId && !parentId)) {
      throw new Error(`同步事务内无法解析团队层级: ${team.externalId}`);
    }
    await db.team.update({
      where: { id: storedTeamId },
      data: { parentId },
    });
  }
  const activeTeamIds = new Set(data.teams.map((team) => team.externalId));
  await db.team.updateMany({
    where: { syncSource: source, isActive: true, externalId: { notIn: [...activeTeamIds] } },
    data: { isActive: false, deactivatedAt: now },
  });

  const byExternalId = new Map(
    state.developers.map((developer) => [developer.externalId, developer]),
  );
  const byEmail = new Map(
    state.developers.map((developer) => [developer.email.toLowerCase(), developer]),
  );
  const matchedDeveloperIds: number[] = [];
  for (const developer of data.developers) {
    const existing = byExternalId.get(developer.externalId) ?? byEmail.get(developer.email);
    const teamId = developer.teamExternalId ? teamIds.get(developer.teamExternalId) : null;
    if (existing) {
      await db.developer.update({
        where: { id: existing.id },
        data: {
          email: developer.email,
          displayName: developer.name,
          externalId: developer.externalId,
          syncSource: source,
          teamId,
          isActive: true,
          deactivatedAt: null,
          lastSeenAt: now,
        },
      });
      matchedDeveloperIds.push(existing.id);
    } else {
      const stored = await db.developer.create({
        data: {
          email: developer.email,
          displayName: developer.name,
          externalId: developer.externalId,
          syncSource: source,
          teamId,
          isActive: true,
          firstSeenAt: now,
          lastSeenAt: now,
        },
      });
      matchedDeveloperIds.push(stored.id);
    }
  }
  await db.developer.updateMany({
    where: { syncSource: source, isActive: true, id: { notIn: matchedDeveloperIds } },
    data: { isActive: false, deactivatedAt: now, lastSeenAt: now },
  });
  return diff;
}

export interface OrgSyncOptions {
  dryRun?: boolean;
  adapter?: string;
  triggerSource?: 'upload' | 'adapter' | 'apply-preview' | 'retry';
  retryOfId?: bigint;
  attempt?: number;
}

function syncError(error: unknown) {
  if (error instanceof z.ZodError) {
    return {
      category: 'validation',
      message: error.issues[0]?.message ?? 'Invalid organization data',
    };
  }
  return {
    category: 'database',
    message: error instanceof Error ? error.message : String(error),
  };
}

async function finishSyncError(db: PrismaClient, logId: bigint, error: unknown, category?: string) {
  const classified = category ? { category, message: String(error) } : syncError(error);
  try {
    return await db.syncLog.update({
      where: { id: logId },
      data: {
        status: 'error',
        errorCategory: classified.category,
        errorMessage: classified.message,
        failures: 1,
        finishedAt: new Date(),
      },
    });
  } catch (logError) {
    throw new AggregateError([error, logError], '组织同步失败且无法更新 SyncLog');
  }
}

async function executeOrgSync(
  db: PrismaClient,
  logId: bigint,
  source: string,
  data: OrgData,
  dryRun: boolean,
) {
  try {
    const diff = dryRun
      ? await previewOrgSync(db, source, data)
      : await db.$transaction(
          (transaction) => reconcileOrg(transaction, source, data, new Date()),
          {
            maxWait: 10_000,
            timeout: 30_000,
          },
        );
    const completed = await db.syncLog.update({
      where: { id: logId },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        errorCategory: null,
        errorMessage: null,
        ...diff,
      },
    });
    if (!dryRun) clearTeamCache();
    return completed;
  } catch (error) {
    await finishSyncError(db, logId, error);
    throw error;
  }
}

async function createSyncLog(
  db: PrismaClient,
  source: string,
  data: OrgData | null,
  options: OrgSyncOptions,
) {
  return db.syncLog.create({
    data: {
      source,
      adapter: options.adapter,
      triggerSource: options.triggerSource ?? 'upload',
      attempt: options.attempt ?? 1,
      retryOfId: options.retryOfId,
      status: 'running',
      startedAt: new Date(),
      dryRun: options.dryRun ?? false,
      canonicalSnapshot: data ? (data as Prisma.InputJsonValue) : undefined,
    },
  });
}

export async function syncOrg(
  db: PrismaClient,
  sourceInput: string,
  input: unknown,
  options: OrgSyncOptions = {},
) {
  const source = sourceSchema.parse(sourceInput);
  const data = OrgDataSchema.parse(input);
  const dryRun = options.dryRun ?? false;
  const log = await createSyncLog(db, source, data, options);
  return executeOrgSync(db, log.id, source, data, dryRun);
}

export async function startOrgSync(
  db: PrismaClient,
  sourceInput: string,
  input: unknown,
  options: OrgSyncOptions = {},
) {
  const source = sourceSchema.parse(sourceInput);
  const data = OrgDataSchema.parse(input);
  const dryRun = options.dryRun ?? false;
  const log = await createSyncLog(db, source, data, options);
  void executeOrgSync(db, log.id, source, data, dryRun).catch(() => undefined);
  return log;
}

export async function syncOrgFromAdapter(
  db: PrismaClient,
  adapter: OrganizationAdapter,
  options: OrgSyncOptions = {},
) {
  const source = sourceSchema.parse(adapter.name);
  const log = await createSyncLog(db, source, null, {
    ...options,
    adapter: adapter.name,
    triggerSource: options.triggerSource ?? 'adapter',
  });
  let data: OrgData;
  try {
    data = OrgDataSchema.parse(await adapter.pull());
    await db.syncLog.update({
      where: { id: log.id },
      data: { canonicalSnapshot: data as Prisma.InputJsonValue },
    });
  } catch (error) {
    const classified = classifyAdapterError(error);
    await finishSyncError(db, log.id, classified.message, classified.category);
    throw error;
  }
  return executeOrgSync(db, log.id, source, data, options.dryRun ?? true);
}
