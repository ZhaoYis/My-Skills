import { Router } from 'express';
import { prisma } from '../../config/database.js';
import { MetricsService } from '../../services/metrics-service.js';
import { teamScope } from '../middleware/team-scope.js';
import { ok, pageParams, pagination } from '../response.js';

export const metricsRoutes = Router();
const service = new MetricsService(prisma);

function me(req: Express.Request) {
  return [req.user!.developerId];
}

metricsRoutes.get('/me', async (req, res) => ok(res, await service.overview(me(req), Math.min(365, Number(req.query.days) || 30))));
metricsRoutes.get('/me/cycle-time', async (req, res) => ok(res, await service.cycleTime(me(req))));
metricsRoutes.get('/me/phases', async (req, res) => ok(res, await service.phaseBreakdown(me(req))));
metricsRoutes.get('/me/reviews', async (req, res) => ok(res, await service.reviews(me(req))));
metricsRoutes.get('/me/completions', async (req, res) => ok(res, await service.completions(me(req))));
metricsRoutes.get('/me/pauses', async (req, res) => ok(res, await service.pauses(me(req))));
metricsRoutes.get('/me/bypasses', async (req, res) => ok(res, await service.bypasses(me(req))));

metricsRoutes.use('/team/:teamId', teamScope);
metricsRoutes.get('/team/:teamId', async (req, res) => {
  const ids = await service.teamDeveloperIds(Number(req.params.teamId));
  return ok(res, await service.overview(ids, Math.min(365, Number(req.query.days) || 30)));
});
metricsRoutes.get('/team/:teamId/members', async (req, res) => {
  const page = pageParams(req.query);
  const result = await service.members(Number(req.params.teamId), page.skip, page.pageSize);
  return ok(res, pagination(result.records, result.totalCount, page.pageNum, page.pageSize));
});
metricsRoutes.get('/team/:teamId/trend', async (req, res) => {
  const ids = await service.teamDeveloperIds(Number(req.params.teamId));
  return ok(res, await service.trend(ids, Math.min(365, Number(req.query.days) || 30)));
});
metricsRoutes.get('/team/:teamId/phases', async (req, res) => {
  const ids = await service.teamDeveloperIds(Number(req.params.teamId));
  return ok(res, await service.phaseBreakdown(ids));
});
