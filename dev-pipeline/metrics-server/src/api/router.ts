import { Prisma } from '@prisma/client';
import { type NextFunction, type Request, type Response, Router } from 'express';
import { ZodError } from 'zod';
import { checkReadiness, type ReadinessResult } from '../observability/readiness.js';
import { auth, userOnly } from './middleware/auth.js';
import { fail, ok } from './response.js';
import { authRoutes } from './routes/auth.js';
import { collectionRoutes } from './routes/collection.js';
import { developerRoutes } from './routes/developers.js';
import { metricsRoutes } from './routes/metrics.js';
import { repoRoutes } from './routes/repos.js';
import { syncRoutes } from './routes/sync.js';
import { teamRoutes } from './routes/teams.js';

interface ApiRouterOptions {
  readinessCheck?: () => Promise<ReadinessResult>;
}

function health(res: Response, status: 'ok' | 'live') {
  return ok(res, { status, timestamp: new Date().toISOString() });
}

export function createApiRouter(options: ApiRouterOptions = {}) {
  const router = Router();
  const readinessCheck = options.readinessCheck ?? checkReadiness;

  router.get('/health', (_req, res) => health(res, 'ok'));
  router.get('/health/live', (_req, res) => health(res, 'live'));
  router.get('/health/ready', async (_req, res) => {
    const readiness = await readinessCheck();
    if (!readiness.ready) {
      return fail(res, 503, '服务尚未就绪', {
        code: 'SERVICE_NOT_READY',
        errorCategory: readiness.category,
        details: { category: readiness.category, checks: readiness.checks },
      });
    }
    return ok(res, {
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: readiness.checks,
    });
  });
  router.use('/auth', authRoutes);
  router.use(auth);
  router.get('/auth/me', userOnly, (req, res) => ok(res, req.user));
  router.use('/metrics', metricsRoutes);
  router.use('/repos', repoRoutes);
  router.use('/teams', teamRoutes);
  router.use('/developers', developerRoutes);
  router.use('/collection', collectionRoutes);
  router.use('/sync', syncRoutes);

  router.use((_req, res) => fail(res, 404, '接口不存在'));

  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError)
      return fail(res, 400, error.issues.map((issue) => issue.message).join('; '), {
        code: 'VALIDATION_ERROR',
        details: error.issues,
        errorCategory: 'validation',
      });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        return fail(res, 409, '数据已存在', {
          code: error.code,
          errorCategory: 'database-conflict',
        });
      if (error.code === 'P2025')
        return fail(res, 404, '数据不存在', {
          code: error.code,
          errorCategory: 'database-not-found',
        });
    }
    const message = error instanceof Error ? error.message : '服务器内部错误';
    return fail(res, 500, process.env.NODE_ENV === 'production' ? '服务器内部错误' : message, {
      errorCategory: 'internal',
    });
  });

  return router;
}

export const apiRouter = createApiRouter();
