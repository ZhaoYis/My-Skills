import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AdministrationService } from '../../services/administration-service.js';
import {
  CollectionJobConflictError,
  CollectionService,
} from '../../services/collection-service.js';
import { kickCollectionQueue } from '../../services/collection-worker.js';
import { positiveBigIntId, positiveId } from '../contracts/registry.js';
import { adminOnly } from '../middleware/auth.js';
import { fail, ok, pageParams, pagination } from '../response.js';

export const collectionRoutes = Router();
const jobIdParam = positiveBigIntId;
const triggerBody = z.object({
  dryRun: z.boolean().default(false),
  mode: z.enum(['trusted', 'history-import']).default('trusted'),
});
const collectionService = () => new CollectionService(prisma);
const administration = new AdministrationService(prisma);
collectionRoutes.use(adminOnly);
collectionRoutes.get('/status', async (_req, res) =>
  ok(res, await administration.collectionStatus()),
);
collectionRoutes.get('/logs', async (req, res) => {
  const page = pageParams(req.query);
  const status = z
    .enum(['queued', 'running', 'completed', 'error', 'cancelled', 'timeout'])
    .optional()
    .parse(req.query.status);
  const repoId = positiveId.optional().parse(req.query.repoId);
  const result = await administration.collectionLogs({
    skip: page.skip,
    take: page.pageSize,
    status,
    repoId,
  });
  return ok(res, pagination(result.records, result.totalCount, page.pageNum, page.pageSize));
});
collectionRoutes.get('/jobs/:id', async (req, res) => {
  const id = jobIdParam.parse(req.params.id);
  const job = await administration.collectionJob(id);
  return job ? ok(res, job) : fail(res, 404, '采集任务不存在');
});
collectionRoutes.get('/history-imports', async (req, res) => {
  const page = pageParams(req.query);
  const result = await administration.historyImports({ skip: page.skip, take: page.pageSize });
  return ok(res, pagination(result.records, result.totalCount, page.pageNum, page.pageSize));
});
collectionRoutes.post('/trigger', async (req, res) => {
  const input = z
    .object({
      repoId: z.number().int().positive(),
      ...triggerBody.shape,
    })
    .parse(req.body);
  try {
    const service = collectionService();
    const job = await service.enqueueRepo(input.repoId, input);
    void kickCollectionQueue(service);
    return ok(
      res,
      { jobId: job.id, repoId: job.repoId, status: job.status, mode: job.mode, dryRun: job.dryRun },
      '采集任务已排队',
      202,
    );
  } catch (error) {
    if (error instanceof CollectionJobConflictError) {
      return fail(res, 409, '仓库已有排队中或运行中的采集任务', {
        code: 'COLLECTION_JOB_ACTIVE',
        details: { jobId: error.jobId },
      });
    }
    throw error;
  }
});
collectionRoutes.post('/trigger-all', async (req, res) => {
  const input = triggerBody.parse(req.body ?? {});
  const service = collectionService();
  const result = await service.enqueueAll(input);
  void kickCollectionQueue(service);
  return ok(
    res,
    {
      status: 'queued',
      jobs: result.jobs.map((job) => ({ jobId: job.id, repoId: job.repoId })),
      conflicts: result.conflicts,
      dryRun: input.dryRun,
      mode: input.mode,
    },
    '采集任务已排队',
    202,
  );
});
collectionRoutes.post('/jobs/:id/cancel', async (req, res) => {
  const id = jobIdParam.parse(req.params.id);
  try {
    return ok(res, await collectionService().cancelJob(id), '取消请求已记录');
  } catch (error) {
    if (error instanceof Error && /already/.test(error.message))
      return fail(res, 409, error.message);
    throw error;
  }
});
collectionRoutes.post('/jobs/:id/retry', async (req, res) => {
  const id = jobIdParam.parse(req.params.id);
  try {
    const service = collectionService();
    const job = await service.retryJob(id);
    void kickCollectionQueue(service);
    return ok(
      res,
      { jobId: job.id, repoId: job.repoId, status: job.status },
      '重试任务已排队',
      202,
    );
  } catch (error) {
    if (error instanceof CollectionJobConflictError) {
      return fail(res, 409, '仓库已有排队中或运行中的采集任务');
    }
    if (error instanceof Error && /cannot be retried/.test(error.message)) {
      return fail(res, 409, error.message);
    }
    throw error;
  }
});
