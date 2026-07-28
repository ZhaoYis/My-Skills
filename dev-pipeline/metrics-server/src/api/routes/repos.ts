import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AdministrationService } from '../../services/administration-service.js';
import {
  CollectionJobConflictError,
  CollectionService,
} from '../../services/collection-service.js';
import { kickCollectionQueue } from '../../services/collection-worker.js';
import {
  RepositoryConnectionError,
  testRepositoryConnection,
} from '../../services/repo-service.js';
import { RetentionService } from '../../services/retention-service.js';
import { logger } from '../../utils/logger.js';
import { positiveBigIntId, positiveId } from '../contracts/registry.js';
import { adminOnly } from '../middleware/auth.js';
import { fail, ok, pageParams, pagination } from '../response.js';

const gitUrl = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .refine((value) => !value.startsWith('-'));
const repoBody = z.object({
  name: z.string().trim().min(1).max(255),
  gitUrl,
  gitBranch: z.string().trim().min(1).max(255).default('main'),
  collectSince: z.coerce.date(),
  isActive: z.boolean().default(true),
  retentionDays: z.number().int().min(1).max(3650).default(365),
});
const listQuery = z.object({
  q: z.string().trim().max(255).optional(),
  status: z.enum(['all', 'active', 'inactive', 'error', 'deleted']).default('all'),
});
const idParam = positiveId;
const retentionBody = z.object({ dryRun: z.boolean().default(true) });
const retentionArchiveQuery = z.object({
  take: z.coerce.number().int().min(1).max(1000).default(100),
  cursor: positiveBigIntId.optional(),
});

export const repoRoutes = Router();
const administration = new AdministrationService(prisma);
repoRoutes.use(adminOnly);

repoRoutes.get('/', async (req, res) => {
  const page = pageParams(req.query);
  const query = listQuery.parse(req.query);
  const result = await administration.listRepos({
    q: query.q,
    status: query.status,
    skip: page.skip,
    take: page.pageSize,
  });
  return ok(res, pagination(result.records, result.totalCount, page.pageNum, page.pageSize));
});

repoRoutes.post('/test-connection', async (req, res) => {
  const input = z.object({ gitUrl, gitBranch: z.string().trim().min(1).max(255) }).parse(req.body);
  try {
    return ok(res, await testRepositoryConnection(input.gitUrl, input.gitBranch), '连接成功');
  } catch (error) {
    if (error instanceof RepositoryConnectionError) {
      return fail(res, 422, error.message, {
        code: error.code,
      });
    }
    throw error;
  }
});

repoRoutes.get('/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  return ok(res, await administration.repoDetail(id));
});

repoRoutes.get('/:id/retention', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const service = new RetentionService(prisma);
  const [classification, history] = await Promise.all([service.classify(id), service.history(id)]);
  return ok(res, { classification, history });
});

repoRoutes.get('/:id/retention/archive', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const query = retentionArchiveQuery.parse(req.query);
  return ok(res, await new RetentionService(prisma).archiveBatch(id, query));
});

repoRoutes.post('/:id/retention', async (req, res) => {
  const id = idParam.parse(req.params.id);
  await administration.ensureRepo(id);
  const { dryRun } = retentionBody.parse(req.body ?? {});
  const [result] = await new RetentionService(prisma).run({
    repoId: id,
    dryRun,
    triggerSource: 'manual',
  });
  return ok(
    res,
    result,
    result?.status === 'checked'
      ? '保留条件未满足，仅已记录检查'
      : dryRun
        ? '保留清理预演完成'
        : '保留清理完成',
  );
});

repoRoutes.post('/:id/restore', async (req, res) => {
  const id = idParam.parse(req.params.id);
  return ok(res, await administration.restoreRepo(id), '仓库配置已恢复，需手动启用后才会采集');
});

repoRoutes.post('/', async (req, res) =>
  ok(res, await administration.createRepo(repoBody.parse(req.body)), '创建成功', 201),
);

repoRoutes.put('/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const data = repoBody.partial().parse(req.body);
  return ok(res, await administration.updateRepo(id, data));
});

repoRoutes.patch('/:id/status', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
  return ok(
    res,
    await administration.setRepoStatus(id, isActive),
    isActive ? '仓库已启用' : '仓库已停用',
  );
});

repoRoutes.delete('/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  return ok(res, await administration.softDeleteRepo(id), '仓库已软删除，历史指标保留');
});

repoRoutes.post('/:id/reset-collection', async (req, res) => {
  const id = idParam.parse(req.params.id);
  return ok(
    res,
    await administration.resetRepoCollection(id),
    '采集 checkpoint 已重置，历史指标未删除',
  );
});

repoRoutes.post('/:id/collect', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const repo = await administration.collectibleRepo(id);
  const service = new CollectionService(prisma);
  try {
    const job = await service.enqueueRepo(repo.id);
    void kickCollectionQueue(service);
    return ok(res, { status: job.status, repoId: repo.id, jobId: job.id }, '采集任务已排队', 202);
  } catch (error) {
    if (error instanceof CollectionJobConflictError) {
      return fail(res, 409, '仓库已有排队中或运行中的采集任务', {
        code: 'COLLECTION_JOB_ACTIVE',
        details: { jobId: error.jobId },
      });
    }
    logger.error(
      {
        requestId: req.requestId,
        repoId: repo.id,
        errorCategory: 'collection-enqueue',
        errorName: error instanceof Error ? error.name : 'UnknownError',
      },
      'manual repository collection failed',
    );
    throw error;
  }
});
