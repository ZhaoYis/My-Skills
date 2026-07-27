import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { syncOrg } from '../../services/sync-service.js';
import { logger } from '../../utils/logger.js';
import { adminOnly } from '../middleware/auth.js';
import { ok } from '../response.js';

const orgBody = z.object({
  source: z.string().min(1).max(32),
  teams: z.array(z.object({ externalId: z.string().min(1), name: z.string().min(1), slug: z.string().min(1), parentExternalId: z.string().nullable().optional() })),
  developers: z.array(z.object({ sub: z.string().min(1), email: z.string().email(), name: z.string().min(1), teamExternalId: z.string().nullable().optional() })),
});

export const syncRoutes = Router();
syncRoutes.use(adminOnly);
syncRoutes.post('/org', async (req, res) => {
  const { source, ...data } = orgBody.parse(req.body);
  void syncOrg(prisma, source, data).catch((error) => logger.error({ error, source }, 'org sync failed'));
  return ok(res, { status: 'accepted', source }, '组织同步已触发', 202);
});
syncRoutes.get('/status', async (_req, res) => ok(res, { lastSync: await prisma.syncLog.findFirst({ orderBy: { startedAt: 'desc' } }) }));
