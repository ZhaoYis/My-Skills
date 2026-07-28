import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { type RequestLogger, requestContext } from './api/middleware/request-context.js';
import { fail } from './api/response.js';
import { createApiRouter } from './api/router.js';
import { prisma } from './config/database.js';
import { getEnv } from './config/env.js';
import {
  type ObservabilityRegistry,
  observability,
  prometheusContentType,
} from './observability/metrics.js';
import type { ReadinessResult } from './observability/readiness.js';
import { startCollectorScheduler, startRetentionScheduler } from './scheduler/cron.js';
import { logger } from './utils/logger.js';

interface CreateAppOptions {
  metrics?: ObservabilityRegistry;
  requestLogger?: RequestLogger;
  readinessCheck?: () => Promise<ReadinessResult>;
}

export function createApp(options: CreateAppOptions = {}) {
  const env = getEnv();
  const metrics = options.metrics ?? observability;
  const app = express();
  app.disable('x-powered-by');
  app.use(requestContext({ log: options.requestLogger, metrics }));
  app.use(helmet());
  app.use(
    cors({ origin: env.CORS_ORIGIN.split(',').map((value) => value.trim()), credentials: true }),
  );
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: 'draft-8',
      handler: (_req, res) =>
        fail(res, 429, '请求过于频繁', {
          code: 'RATE_LIMITED',
          errorCategory: 'rate-limit',
        }),
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.get('/observability/metrics', (_req, res) => {
    res.type(prometheusContentType).send(metrics.render());
  });
  app.use('/api/v1', createApiRouter({ readinessCheck: options.readinessCheck }));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const statusCandidate =
      error && typeof error === 'object' && 'status' in error ? Number(error.status) : 500;
    const status =
      Number.isInteger(statusCandidate) && statusCandidate >= 400 && statusCandidate < 600
        ? statusCandidate
        : 500;
    return fail(
      res,
      status,
      status === 413 ? '请求体过大' : status < 500 ? '请求格式无效' : '服务器内部错误',
      {
        code:
          status === 413
            ? 'PAYLOAD_TOO_LARGE'
            : status < 500
              ? 'INVALID_REQUEST'
              : 'INTERNAL_ERROR',
        errorCategory: status < 500 ? 'request-parse' : 'internal',
      },
    );
  });
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const env = getEnv();
  await prisma.$connect();
  createApp().listen(env.PORT, () => logger.info({ port: env.PORT }, 'metrics server listening'));
  startCollectorScheduler();
  startRetentionScheduler();
}
