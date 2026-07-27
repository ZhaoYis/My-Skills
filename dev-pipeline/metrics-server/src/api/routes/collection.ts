import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { CollectionService } from '../../services/collection-service.js';
import { logger } from '../../utils/logger.js';
import { adminOnly } from '../middleware/auth.js';
import { ok, pageParams, pagination } from '../response.js';

export const collectionRoutes = Router();
collectionRoutes.use(adminOnly);
collectionRoutes.get('/status', async (_req, res) => ok(res, await prisma.repo.findMany({ select: { id: true, name: true, collectionStatus: true, collectionStartedAt: true, collectionError: true, lastFetchedAt: true } })));
collectionRoutes.get('/logs', async (req, res) => {
  const page = pageParams(req.query);
  const [records, count] = await Promise.all([
    prisma.collectionLog.findMany({ skip: page.skip, take: page.pageSize, include: { repo: true }, orderBy: { startedAt: 'desc' } }),
    prisma.collectionLog.count(),
  ]);
  return ok(res, pagination(records, count, page.pageNum, page.pageSize));
});
collectionRoutes.post('/trigger', async (req, res) => {
  const { repoId } = z.object({ repoId: z.number().int().positive() }).parse(req.body);
  void new CollectionService(prisma).collectRepo(repoId).catch((error) => logger.error({ error, repoId }, 'manual collection failed'));
  return ok(res, { repoId, status: 'accepted' }, '采集任务已触发', 202);
});
collectionRoutes.post('/trigger-all', async (_req, res) => {
  void new CollectionService(prisma).collectAll().catch((error) => logger.error({ error }, 'manual collection failed'));
  return ok(res, { status: 'accepted' }, '全部采集任务已触发', 202);
});
