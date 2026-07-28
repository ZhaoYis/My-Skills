import { Prisma, type PrismaClient } from '@prisma/client';

const cache = new Map<number, { ids: number[]; expiresAt: number }>();
const memberCache = new Map<number, { ids: number[]; expiresAt: number }>();

function cacheTtl() {
  const configured = Number(process.env.METRICS_TEAM_CACHE_TTL_MS);
  return Number.isFinite(configured) && configured >= 1_000 ? configured : 60_000;
}

export async function getTeamSubtreeIds(db: PrismaClient, teamId: number): Promise<number[]> {
  const cached = cache.get(teamId);
  if (cached && cached.expiresAt > Date.now()) return cached.ids;
  const rows = await db.$queryRaw<{ id: number }[]>(Prisma.sql`
    WITH RECURSIVE team_tree AS (
      SELECT id FROM teams WHERE id = ${teamId} AND is_active = TRUE
      UNION ALL
      SELECT child.id FROM teams child
      JOIN team_tree parent ON child.parent_id = parent.id
      WHERE child.is_active = TRUE
    )
    SELECT id FROM team_tree
  `);
  const ids = rows.map(({ id }) => id);
  cache.set(teamId, { ids, expiresAt: Date.now() + cacheTtl() });
  return ids;
}

export async function getTeamDeveloperIds(db: PrismaClient, teamId: number): Promise<number[]> {
  const cached = memberCache.get(teamId);
  if (cached && cached.expiresAt > Date.now()) return cached.ids;
  const teamIds = await getTeamSubtreeIds(db, teamId);
  const developers = await db.developer.findMany({
    where: { teamId: { in: teamIds }, isActive: true },
    select: { id: true },
  });
  const ids = developers.map(({ id }) => id);
  memberCache.set(teamId, { ids, expiresAt: Date.now() + cacheTtl() });
  return ids;
}

export function clearTeamCache() {
  cache.clear();
  memberCache.clear();
}
