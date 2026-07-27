import { Prisma, type PrismaClient } from '@prisma/client';

const cache = new Map<number, { ids: number[]; expiresAt: number }>();

export async function getTeamSubtreeIds(db: PrismaClient, teamId: number): Promise<number[]> {
  const cached = cache.get(teamId);
  if (cached && cached.expiresAt > Date.now()) return cached.ids;
  const rows = await db.$queryRaw<{ id: number }[]>(Prisma.sql`
    WITH RECURSIVE team_tree AS (
      SELECT id FROM teams WHERE id = ${teamId}
      UNION ALL
      SELECT child.id FROM teams child
      JOIN team_tree parent ON child.parent_id = parent.id
    )
    SELECT id FROM team_tree
  `);
  const ids = rows.map(({ id }) => id);
  cache.set(teamId, { ids, expiresAt: Date.now() + 60_000 });
  return ids;
}

export function clearTeamCache() {
  cache.clear();
}
