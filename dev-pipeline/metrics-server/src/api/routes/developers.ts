import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { adminOnly } from '../middleware/auth.js';
import { ok, pageParams, pagination } from '../response.js';

export const developerRoutes = Router();
developerRoutes.use(adminOnly);
developerRoutes.get('/', async (req, res) => {
  const page = pageParams(req.query);
  const where = req.query.unassigned === 'true' ? { teamId: null } : {};
  const [records, count] = await Promise.all([
    prisma.developer.findMany({ where, skip: page.skip, take: page.pageSize, include: { team: true }, orderBy: { id: 'asc' } }),
    prisma.developer.count({ where }),
  ]);
  return ok(res, pagination(records, count, page.pageNum, page.pageSize));
});
developerRoutes.put('/:id', async (req, res) => {
  const data = z.object({ teamId: z.number().int().positive().nullable().optional(), role: z.enum(['admin', 'member']).nullable().optional(), displayName: z.string().max(255).optional() }).parse(req.body);
  return ok(res, await prisma.developer.update({ where: { id: Number(req.params.id) }, data }));
});
