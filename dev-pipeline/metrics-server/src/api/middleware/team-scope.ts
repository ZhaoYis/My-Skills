import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { getTeamSubtreeIds } from '../../services/team-cache.js';
import { positiveId } from '../contracts/registry.js';
import { fail } from '../response.js';
import type { UserPrincipal } from '../types.js';

export async function getVisibleTeamIds(
  db: typeof prisma,
  principal: UserPrincipal,
): Promise<number[]> {
  if (principal.isAdmin) {
    const teams = await db.team.findMany({
      where: { isActive: true },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    return teams.map(({ id }) => id);
  }
  if (!principal.teamId) return [];
  return getTeamSubtreeIds(db, principal.teamId);
}

export async function teamScope(req: Request, res: Response, next: NextFunction) {
  if (req.user?.kind !== 'user') return fail(res, 403, '个人身份缺失：服务凭证不能访问团队指标');
  const parsed = positiveId.safeParse(req.params.teamId);
  if (!parsed.success) return fail(res, 400, '团队 ID 无效');
  const requested = parsed.data;
  const visible = await getVisibleTeamIds(prisma, req.user);
  return visible.includes(requested) ? next() : fail(res, 403, '无权访问该团队');
}
