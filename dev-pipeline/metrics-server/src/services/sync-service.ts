import type { PrismaClient } from '@prisma/client';

export interface OrgData {
  teams: Array<{
    externalId: string;
    name: string;
    slug: string;
    parentExternalId?: string | null;
  }>;
  developers: Array<{
    sub: string;
    email: string;
    name: string;
    teamExternalId?: string | null;
  }>;
}

export async function syncOrg(db: PrismaClient, source: string, data: OrgData) {
  const log = await db.syncLog.create({ data: { source, status: 'running', startedAt: new Date() } });
  try {
    const externalIds = data.teams.map((team) => team.externalId);
    const existing = await db.team.findMany({ where: { externalId: { in: externalIds } }, select: { externalId: true } });
    const existingIds = new Set(existing.map(({ externalId }) => externalId));
    for (const team of data.teams) {
      await db.team.upsert({
        where: { externalId: team.externalId },
        create: { name: team.name, slug: team.slug, externalId: team.externalId },
        update: { name: team.name, slug: team.slug },
      });
    }
    const storedTeams = await db.team.findMany({
      where: { externalId: { in: externalIds } },
      select: { id: true, externalId: true },
    });
    const teamIds = new Map(storedTeams.map((team) => [team.externalId!, team.id]));
    for (const team of data.teams) {
      await db.team.update({
        where: { externalId: team.externalId },
        data: { parentId: team.parentExternalId ? (teamIds.get(team.parentExternalId) ?? null) : null },
      });
    }

    let devsLinked = 0;
    for (const dev of data.developers) {
      const email = dev.email.trim().toLowerCase();
      const found = await db.developer.findFirst({
        where: { OR: [{ externalId: dev.sub }, { email }] },
      });
      const teamId = dev.teamExternalId ? (teamIds.get(dev.teamExternalId) ?? null) : null;
      if (found) {
        await db.developer.update({
          where: { id: found.id },
          data: { email, displayName: dev.name, externalId: dev.sub, teamId, lastSeenAt: new Date() },
        });
        devsLinked += 1;
      } else {
        const now = new Date();
        await db.developer.create({
          data: { email, displayName: dev.name, externalId: dev.sub, teamId, firstSeenAt: now, lastSeenAt: now },
        });
      }
    }
    return await db.syncLog.update({
      where: { id: log.id },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        teamsCreated: data.teams.length - existingIds.size,
        teamsUpdated: existingIds.size,
        devsLinked,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await db.syncLog.update({
      where: { id: log.id },
      data: { status: 'error', errorMessage, finishedAt: new Date() },
    });
    throw error;
  }
}
