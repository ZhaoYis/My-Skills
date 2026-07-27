import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { adminOnly } from '../middleware/auth.js';
import { ok, pageParams, pagination } from '../response.js';

const repoBody = z.object({
  name: z.string().min(1).max(255),
  gitUrl: z.string().min(1).max(512),
  gitBranch: z.string().min(1).max(255).default('main'),
  collectSince: z.coerce.date(),
  isActive: z.boolean().default(true),
  retentionDays: z.number().int().positive().default(365),
});

export const repoRoutes = Router();
repoRoutes.use(adminOnly);

repoRoutes.get('/', async (req, res) => {
  const page = pageParams(req.query);
  const [records, count] = await Promise.all([
    prisma.repo.findMany({ skip: page.skip, take: page.pageSize, orderBy: { id: 'asc' } }),
    prisma.repo.count(),
  ]);
  return ok(res, pagination(records, count, page.pageNum, page.pageSize));
});
repoRoutes.get('/:id', async (req, res) => ok(res, await prisma.repo.findUniqueOrThrow({ where: { id: Number(req.params.id) } })));
repoRoutes.post('/', async (req, res) => ok(res, await prisma.repo.create({ data: repoBody.parse(req.body) }), '创建成功', 201));
repoRoutes.put('/:id', async (req, res) => ok(res, await prisma.repo.update({ where: { id: Number(req.params.id) }, data: repoBody.partial().parse(req.body) })));
repoRoutes.delete('/:id', async (req, res) => ok(res, await prisma.repo.delete({ where: { id: Number(req.params.id) } }), '删除成功'));
repoRoutes.post('/:id/reset-collection', async (req, res) =>
  ok(
    res,
    await prisma.repo.update({
      where: { id: Number(req.params.id) },
      data: { lastFetchedCommit: null, lastFetchedAt: null, collectionStatus: 'idle', collectionStartedAt: null, collectionError: null },
    }),
  ),
);
