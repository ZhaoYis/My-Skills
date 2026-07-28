import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { syncOrg } from '../src/services/sync-service.js';
import { getTeamSubtreeIds } from '../src/services/team-cache.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const db = enabled ? new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL }) : null;
const database = db as PrismaClient;
const prefix = 'm006-integration-sync';

async function cleanup() {
  if (!db) return;
  await db.repo.deleteMany({ where: { name: { startsWith: prefix } } });
  await db.developer.deleteMany({
    where: {
      OR: [
        { syncSource: { startsWith: prefix } },
        { email: { endsWith: '@m006.example.invalid' } },
      ],
    },
  });
  await db.team.deleteMany({
    where: { OR: [{ syncSource: { startsWith: prefix } }, { externalId: { startsWith: prefix } }] },
  });
  await db.syncLog.deleteMany({ where: { source: { startsWith: prefix } } });
}

describe.runIf(enabled)('atomic organization sync', () => {
  beforeAll(cleanup);

  it('links an existing collected identity by normalized email', async () => {
    const source = `${prefix}-link`;
    const now = new Date();
    await database.developer.create({
      data: {
        email: `link@m006.example.invalid`,
        displayName: 'Collected Name',
        firstSeenAt: now,
        lastSeenAt: now,
      },
    });
    const log = await syncOrg(database, source, {
      teams: [
        { externalId: `${source}-root`, name: 'Platform', slug: `${source}-platform` },
        {
          externalId: `${source}-child`,
          name: 'AI Delivery',
          slug: `${source}-ai`,
          parentExternalId: `${source}-root`,
        },
      ],
      developers: [
        {
          externalId: `${source}-developer`,
          email: 'link@M006.EXAMPLE.INVALID',
          name: 'Domain Name',
          teamExternalId: `${source}-child`,
        },
      ],
    });
    expect(log).toMatchObject({
      status: 'completed',
      teamsCreated: 2,
      devsUpdated: 1,
      devsLinked: 1,
    });
    const developer = await database.developer.findUniqueOrThrow({
      where: { email: 'link@m006.example.invalid' },
      include: { team: { include: { parent: true } } },
    });
    expect(developer).toMatchObject({
      externalId: `${source}-developer`,
      displayName: 'Domain Name',
      syncSource: source,
      isActive: true,
    });
    expect(developer.team?.parent?.externalId).toBe(`${source}-root`);
  });

  it('previews and reconciles consecutive snapshots while preserving history and invalidating cache', async () => {
    const source = `${prefix}-snapshots`;
    const rootExternalId = `${source}-root`;
    const oldTeamExternalId = `${source}-old-team`;
    const newTeamExternalId = `${source}-new-team`;
    const formerExternalId = `${source}-former`;
    const activeExternalId = `${source}-active`;
    await syncOrg(database, source, {
      teams: [
        { externalId: rootExternalId, name: 'Root', slug: `${source}-root` },
        {
          externalId: oldTeamExternalId,
          name: 'Old Team',
          slug: `${source}-old`,
          parentExternalId: rootExternalId,
        },
      ],
      developers: [
        {
          externalId: formerExternalId,
          email: 'former@m006.example.invalid',
          name: 'Former Developer',
          teamExternalId: oldTeamExternalId,
        },
      ],
    });
    const root = await database.team.findUniqueOrThrow({ where: { externalId: rootExternalId } });
    const former = await database.developer.findUniqueOrThrow({
      where: { externalId: formerExternalId },
    });
    expect(await getTeamSubtreeIds(database, root.id)).toHaveLength(2);

    const now = new Date();
    const repo = await database.repo.create({
      data: {
        name: `${prefix}-history-repo`,
        gitUrl: 'https://example.invalid/m006-history.git',
        collectSince: now,
      },
    });
    const historicalRun = await database.pipelineRun.create({
      data: {
        repoId: repo.id,
        developerId: former.id,
        changeName: 'historical-change',
        stateVersion: 3,
        sourceBranch: 'feature/history',
        currentPhase: 6,
        currentStep: 24,
        status: 'completed',
        executionMode: 'pipeline',
        isLatest: true,
        isLatestHistorical: true,
        fingerprintId: `fp1.${'A'.repeat(342)}`,
        fingerprintNonce: '1234abcd',
        fingerprintVerified: true,
        fingerprintKeyVersion: 'fp1',
        createdByEmail: former.email,
        createdBy: former.displayName ?? 'Former Developer',
        createdAtSource: now,
        createdAtPipeline: now,
        updatedAtPipeline: now,
        completedAtPipeline: now,
        changeDurationSeconds: 60,
        contentHash: 'e'.repeat(32),
        commitSha: 'e'.repeat(40),
        commitTimestamp: now,
      },
    });

    const secondSnapshot = {
      teams: [
        { externalId: rootExternalId, name: 'Root', slug: `${source}-root` },
        {
          externalId: newTeamExternalId,
          name: 'New Team',
          slug: `${source}-new`,
          parentExternalId: rootExternalId,
        },
      ],
      developers: [
        {
          externalId: activeExternalId,
          email: 'active@m006.example.invalid',
          name: 'Active Developer',
          teamExternalId: newTeamExternalId,
        },
      ],
    };
    const preview = await syncOrg(database, source, secondSnapshot, { dryRun: true });
    expect(preview).toMatchObject({
      dryRun: true,
      teamsCreated: 1,
      teamsDeactivated: 1,
      devsCreated: 1,
      devsDeactivated: 1,
    });
    expect(await database.team.findUnique({ where: { externalId: newTeamExternalId } })).toBeNull();
    expect(await database.developer.findUniqueOrThrow({ where: { id: former.id } })).toMatchObject({
      isActive: true,
    });

    const applied = await syncOrg(database, source, secondSnapshot);
    expect(applied).toMatchObject({
      dryRun: false,
      teamsCreated: 1,
      teamsDeactivated: 1,
      devsCreated: 1,
      devsDeactivated: 1,
    });
    const oldTeam = await database.team.findUniqueOrThrow({
      where: { externalId: oldTeamExternalId },
    });
    expect(oldTeam).toMatchObject({ isActive: false });
    expect(oldTeam.deactivatedAt).not.toBeNull();
    expect(await database.developer.findUniqueOrThrow({ where: { id: former.id } })).toMatchObject({
      isActive: false,
      teamId: oldTeam.id,
    });
    expect(
      await database.pipelineRun.findUniqueOrThrow({ where: { id: historicalRun.id } }),
    ).toMatchObject({
      developerId: former.id,
    });
    const newTeam = await database.team.findUniqueOrThrow({
      where: { externalId: newTeamExternalId },
    });
    expect(new Set(await getTeamSubtreeIds(database, root.id))).toEqual(
      new Set([root.id, newTeam.id]),
    );

    const third = await syncOrg(database, source, {
      teams: [
        { externalId: rootExternalId, name: 'Root', slug: `${source}-root` },
        { externalId: newTeamExternalId, name: 'New Team', slug: `${source}-new` },
      ],
      developers: [
        {
          externalId: activeExternalId,
          email: 'active@m006.example.invalid',
          name: 'Active Developer',
          teamExternalId: null,
        },
      ],
    });
    expect(third).toMatchObject({ teamsMoved: 1, devsUnassigned: 1 });
    expect(
      await database.developer.findUniqueOrThrow({ where: { externalId: activeExternalId } }),
    ).toMatchObject({
      isActive: true,
      teamId: null,
    });
  }, 60_000);

  it('rolls back all organization writes and records an error outside the transaction', async () => {
    const source = `${prefix}-rollback`;
    await database.team.create({
      data: {
        externalId: `${source}-existing`,
        name: 'Existing',
        slug: `${source}-reserved`,
      },
    });
    await expect(
      syncOrg(database, source, {
        teams: [
          { externalId: `${source}-would-create`, name: 'Would Create', slug: `${source}-new` },
          { externalId: `${source}-conflict`, name: 'Conflict', slug: `${source}-reserved` },
        ],
        developers: [],
      }),
    ).rejects.toThrow();
    expect(
      await database.team.findUnique({ where: { externalId: `${source}-would-create` } }),
    ).toBeNull();
    expect(
      await database.team.findUnique({ where: { externalId: `${source}-conflict` } }),
    ).toBeNull();
    expect(
      await database.syncLog.findFirstOrThrow({
        where: { source },
        orderBy: { startedAt: 'desc' },
      }),
    ).toMatchObject({
      status: 'error',
      failures: 1,
    });
  });
});

afterAll(async () => {
  await cleanup();
  await db?.$disconnect();
});
