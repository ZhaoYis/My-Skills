import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { apiRouter } from './api/router.js';
import { prisma } from './config/database.js';
import { getEnv } from './config/env.js';
import { startCollectorScheduler } from './scheduler/cron.js';
import { logger } from './utils/logger.js';

export function createApp() {
  const env = getEnv();
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((value) => value.trim()), credentials: true }));
  app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8' }));
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/v1', apiRouter);
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const env = getEnv();
  await prisma.$connect();
  createApp().listen(env.PORT, () => logger.info({ port: env.PORT }, 'metrics server listening'));
  startCollectorScheduler();
}
