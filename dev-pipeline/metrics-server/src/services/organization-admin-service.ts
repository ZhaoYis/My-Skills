import type { Prisma, PrismaClient } from '@prisma/client';
import { clearTeamCache } from './team-cache.js';

export interface TeamAdminInput {
  name: string;
  slug: string;
  parentId?: number | null;
  externalId?: string | null;
}

export interface TeamDeactivateInput {
  childStrategy: 'reject' | 'promote';
  memberStrategy: 'reject' | 'unassign' | 'move';
  targetTeamId?: number;
}

type TeamRecord = Awaited<ReturnType<PrismaClient['team']['findMany']>>[number];
type TeamNode = TeamRecord & { children: TeamNode[] };

export class OrganizationConflictError extends Error {}
export class OrganizationInputError extends Error {}

function buildTeamTree(teams: TeamRecord[]) {
  const nodes = new Map<number, TeamNode>(
    teams.map((team) => [team.id, { ...team, children: [] }]),
  );
  const roots: TeamNode[] = [];
  for (const team of teams) {
    const node = nodes.get(team.id);
    if (!node) continue;
    const parent = team.parentId ? nodes.get(team.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function subtreeIds(teams: Array<{ id: number; parentId: number | null }>, rootId: number) {
  const result = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const team of teams) {
      if (team.parentId && result.has(team.parentId) && !result.has(team.id)) {
        result.add(team.id);
        changed = true;
      }
    }
  }
  return [...result];
}

async function activeTeamOrNull(db: Prisma.TransactionClient | PrismaClient, id: number) {
  return db.team.findFirst({ where: { id, isActive: true }, select: { id: true } });
}

export class OrganizationAdminService {
  constructor(private readonly db: PrismaClient) {}

  async listTeams(status: 'all' | 'active' | 'inactive') {
    const where: Prisma.TeamWhereInput = status === 'all' ? {} : { isActive: status === 'active' };
    const teams = await this.db.team.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return buildTeamTree(teams);
  }

  async createTeam(data: TeamAdminInput) {
    if (data.parentId && !(await activeTeamOrNull(this.db, data.parentId))) {
      throw new OrganizationInputError('父团队不存在或已停用');
    }
    const result = await this.db.team.create({ data });
    clearTeamCache();
    return result;
  }

  async updateTeam(id: number, data: Partial<TeamAdminInput>) {
    const result = await this.db.$transaction(
      async (tx) => {
        await tx.team.findUniqueOrThrow({ where: { id } });
        const teams = await tx.team.findMany({ select: { id: true, parentId: true } });
        const affectedTeamIds = subtreeIds(teams, id);
        if (data.parentId !== undefined && data.parentId !== null) {
          if (affectedTeamIds.includes(data.parentId)) {
            throw new OrganizationConflictError('团队不能移动到自身或其子团队');
          }
          if (!(await activeTeamOrNull(tx, data.parentId))) {
            throw new OrganizationConflictError('目标父团队不存在或已停用');
          }
        }
        const updated = await tx.team.update({ where: { id }, data });
        await tx.developer.updateMany({
          where: { teamId: { in: affectedTeamIds } },
          data: { tokenVersion: { increment: 1 } },
        });
        return updated;
      },
      { timeout: 30_000 },
    );
    clearTeamCache();
    return result;
  }

  async deactivateTeam(id: number, strategy: TeamDeactivateInput) {
    const result = await this.db.$transaction(
      async (tx) => {
        const team = await tx.team.findUniqueOrThrow({ where: { id } });
        const teams = await tx.team.findMany({ select: { id: true, parentId: true } });
        const affectedTeamIds = subtreeIds(teams, id);
        const [activeChildren, activeMembers, affectedDevelopers] = await Promise.all([
          tx.team.count({ where: { parentId: id, isActive: true } }),
          tx.developer.count({ where: { teamId: id, isActive: true } }),
          tx.developer.findMany({
            where: { teamId: { in: affectedTeamIds } },
            select: { id: true },
          }),
        ]);
        if (activeChildren && strategy.childStrategy === 'reject') {
          throw new OrganizationConflictError('团队仍有活跃子团队，请选择提升子团队后停用');
        }
        if (activeMembers && strategy.memberStrategy === 'reject') {
          throw new OrganizationConflictError('团队仍有活跃成员，请选择解绑或迁移成员后停用');
        }
        if (strategy.memberStrategy === 'move') {
          if (!strategy.targetTeamId || strategy.targetTeamId === id) {
            throw new OrganizationConflictError('迁移成员时必须选择其他目标团队');
          }
          if (!(await activeTeamOrNull(tx, strategy.targetTeamId))) {
            throw new OrganizationConflictError('成员目标团队不存在或已停用');
          }
        }
        if (strategy.childStrategy === 'promote') {
          await tx.team.updateMany({ where: { parentId: id }, data: { parentId: team.parentId } });
        }
        if (strategy.memberStrategy !== 'reject') {
          await tx.developer.updateMany({
            where: { teamId: id },
            data: { teamId: strategy.memberStrategy === 'move' ? strategy.targetTeamId : null },
          });
        }
        if (affectedDevelopers.length) {
          await tx.developer.updateMany({
            where: { id: { in: affectedDevelopers.map(({ id: developerId }) => developerId) } },
            data: { tokenVersion: { increment: 1 } },
          });
        }
        return tx.team.update({
          where: { id },
          data: { isActive: false, deactivatedAt: new Date() },
        });
      },
      { timeout: 30_000 },
    );
    clearTeamCache();
    return result;
  }
}
