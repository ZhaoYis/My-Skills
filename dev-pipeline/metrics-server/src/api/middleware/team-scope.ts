import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../config/database.js';
import { getTeamSubtreeIds } from '../../services/team-cache.js';
import { fail } from '../response.js';

export async function teamScope(req: Request, res: Response, next: NextFunction) {
  if (req.user?.isAdmin) return next();
  const requested = Number(req.params.teamId);
  if (!Number.isInteger(requested) || !req.user?.teamId) return fail(res, 403, '无权访问该团队');
  const visible = await getTeamSubtreeIds(prisma, req.user.teamId);
  return visible.includes(requested) ? next() : fail(res, 403, '无权访问该团队');
}
