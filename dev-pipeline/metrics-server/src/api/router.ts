import { Prisma } from '@prisma/client';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { auth } from './middleware/auth.js';
import { fail, ok } from './response.js';
import { authRoutes } from './routes/auth.js';
import { collectionRoutes } from './routes/collection.js';
import { developerRoutes } from './routes/developers.js';
import { metricsRoutes } from './routes/metrics.js';
import { repoRoutes } from './routes/repos.js';
import { syncRoutes } from './routes/sync.js';
import { teamRoutes } from './routes/teams.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => ok(res, { status: 'ok', timestamp: new Date().toISOString() }));
apiRouter.use('/auth', authRoutes);
apiRouter.use(auth);
apiRouter.use('/metrics', metricsRoutes);
apiRouter.use('/repos', repoRoutes);
apiRouter.use('/teams', teamRoutes);
apiRouter.use('/developers', developerRoutes);
apiRouter.use('/collection', collectionRoutes);
apiRouter.use('/sync', syncRoutes);

apiRouter.use((_req, res) => fail(res, 404, '接口不存在'));

apiRouter.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) return fail(res, 400, error.issues.map((issue) => issue.message).join('; '));
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return fail(res, 409, '数据已存在');
    if (error.code === 'P2025') return fail(res, 404, '数据不存在');
  }
  const message = error instanceof Error ? error.message : '服务器内部错误';
  return fail(res, 500, process.env.NODE_ENV === 'production' ? '服务器内部错误' : message);
});
