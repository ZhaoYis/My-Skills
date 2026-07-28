import { type Request, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AdministrationService } from '../../services/administration-service.js';
import { MetricsService } from '../../services/metrics-service.js';
import {
  metricsFilterQuerySchema,
  paginationQuerySchema,
  positiveId,
} from '../contracts/registry.js';
import { userOnly } from '../middleware/auth.js';
import { getVisibleTeamIds, teamScope } from '../middleware/team-scope.js';
import { fail, ok, pagination } from '../response.js';

export const metricsRoutes = Router();
const service = new MetricsService(prisma);
const administration = new AdministrationService(prisma);
metricsRoutes.use(userOnly);

const memberQuery = paginationQuerySchema
  .extend({
    q: z.string().trim().max(255).default(''),
    dataStatus: z.enum(['all', 'with-data', 'without-data']).default('all'),
    sortBy: z
      .enum([
        'displayName',
        'completedRuns',
        'completionRate',
        'avgCycleTimeMinutes',
        'avgReviewRounds',
      ])
      .default('displayName'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  })
  .extend(metricsFilterQuerySchema.shape);

type VisibleTeam = {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  children: VisibleTeam[];
};

function visibleTeamTree(
  teams: Array<Omit<VisibleTeam, 'children'>>,
  visibleIds: number[],
): VisibleTeam[] {
  const visible = new Set(visibleIds);
  const nodes = new Map<number, VisibleTeam>(
    teams.map((team) => [
      team.id,
      {
        ...team,
        parentId: team.parentId && visible.has(team.parentId) ? team.parentId : null,
        children: [],
      },
    ]),
  );
  const roots: VisibleTeam[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function metricsQuery(req: Request) {
  return metricsFilterQuerySchema.parse(req.query);
}

function me(req: Request) {
  if (req.user?.kind !== 'user') throw new Error('Personal metrics require a user principal');
  return [req.user.developerId];
}

metricsRoutes.get('/me', async (req, res) =>
  ok(res, await service.overview(me(req), metricsQuery(req))),
);
metricsRoutes.get('/me/cycle-time', async (req, res) =>
  ok(res, await service.cycleTime(me(req), metricsQuery(req))),
);
metricsRoutes.get('/me/phases', async (req, res) =>
  ok(res, await service.phaseBreakdown(me(req), metricsQuery(req))),
);
metricsRoutes.get('/me/reviews', async (req, res) =>
  ok(res, await service.reviews(me(req), metricsQuery(req))),
);
metricsRoutes.get('/me/completions', async (req, res) =>
  ok(res, await service.completions(me(req), metricsQuery(req))),
);
metricsRoutes.get('/me/pauses', async (req, res) =>
  ok(res, await service.pauses(me(req), metricsQuery(req))),
);
metricsRoutes.get('/me/bypasses', async (req, res) =>
  ok(res, await service.bypasses(me(req), metricsQuery(req))),
);

metricsRoutes.get('/teams/visible', async (req, res) => {
  if (req.user?.kind !== 'user') return fail(res, 403, '个人身份缺失');
  const ids = await getVisibleTeamIds(prisma, req.user);
  if (!ids.length) return ok(res, []);
  const teams = await administration.visibleTeams(ids);
  return ok(res, visibleTeamTree(teams, ids));
});

metricsRoutes.use('/team/:teamId', teamScope);
metricsRoutes.get('/team/:teamId', async (req, res) => {
  const ids = await service.teamDeveloperIds(positiveId.parse(req.params.teamId));
  return ok(res, await service.overview(ids, metricsQuery(req)));
});
metricsRoutes.get('/team/:teamId/members', async (req, res) => {
  const query = memberQuery.parse(req.query);
  const result = await service.members(
    positiveId.parse(req.params.teamId),
    query.pageNum,
    query.pageSize,
    query,
  );
  return ok(res, pagination(result.records, result.totalCount, query.pageNum, query.pageSize));
});
metricsRoutes.get('/team/:teamId/members/:developerId', async (req, res) => {
  const developerId = positiveId.parse(req.params.developerId);
  const result = await service.member(
    positiveId.parse(req.params.teamId),
    developerId,
    metricsQuery(req),
  );
  return result ? ok(res, result) : fail(res, 404, '团队成员不存在');
});
metricsRoutes.get('/team/:teamId/trend', async (req, res) => {
  const ids = await service.teamDeveloperIds(positiveId.parse(req.params.teamId));
  return ok(res, await service.trend(ids, metricsQuery(req)));
});
metricsRoutes.get('/team/:teamId/phases', async (req, res) => {
  const ids = await service.teamDeveloperIds(positiveId.parse(req.params.teamId));
  return ok(res, await service.phaseBreakdown(ids, metricsQuery(req)));
});
