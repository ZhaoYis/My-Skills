import { Router } from 'express';
import { z } from 'zod';
import {
  createOrganizationAdapterRegistry,
  publicAdapterStatuses,
} from '../../adapters/organization/registry.js';
import {
  classifyAdapterError,
  organizationAdapterNames,
} from '../../adapters/organization/types.js';
import { prisma } from '../../config/database.js';
import { AdministrationService } from '../../services/administration-service.js';
import {
  OrgDataSchema,
  startOrgSync,
  syncOrg,
  syncOrgFromAdapter,
} from '../../services/sync-service.js';
import { logger } from '../../utils/logger.js';
import { paginationQuerySchema, positiveBigIntId } from '../contracts/registry.js';
import { adminOnly } from '../middleware/auth.js';
import { fail, ok, pageParams, pagination } from '../response.js';

const orgBody = z.object({
  source: z.string().min(1).max(32),
  dryRun: z.boolean().optional().default(false),
  teams: OrgDataSchema.shape.teams,
  developers: OrgDataSchema.shape.developers,
});
const adapterName = z.enum(organizationAdapterNames);
const logId = positiveBigIntId;
const listQuery = paginationQuerySchema.extend({
  status: z.enum(['all', 'running', 'completed', 'error']).default('all'),
});

function adapterHttpStatus(category: ReturnType<typeof classifyAdapterError>['category']) {
  if (category === 'credentials') return 409;
  if (category === 'authentication' || category === 'authorization') return 502;
  if (category === 'rate-limit') return 503;
  return 502;
}

export const syncRoutes = Router();
const administration = new AdministrationService(prisma);
syncRoutes.use(adminOnly);

syncRoutes.get('/adapters', (_req, res) => ok(res, publicAdapterStatuses()));

syncRoutes.post('/adapters/:adapter/preview', async (req, res) => {
  const name = adapterName.parse(req.params.adapter);
  const adapter = createOrganizationAdapterRegistry().get(name);
  if (!adapter?.supportsPull) {
    return fail(res, 409, `${name} adapter 仅支持 canonical 转换，尚未启用直接拉取`);
  }
  try {
    const result = await syncOrgFromAdapter(prisma, adapter, { dryRun: true });
    return ok(res, result, '外部组织同步预览完成');
  } catch (error) {
    const classified = classifyAdapterError(error);
    logger.warn({ adapter: name, category: classified.category }, 'organization adapter failed');
    return fail(res, adapterHttpStatus(classified.category), classified.message);
  }
});

syncRoutes.post('/org/preview', async (req, res) => {
  const { source, ...data } = orgBody.omit({ dryRun: true }).parse(req.body);
  const log = await syncOrg(prisma, source, data, { dryRun: true, triggerSource: 'upload' });
  return ok(res, log, '组织同步预览完成');
});

syncRoutes.post('/org', async (req, res) => {
  const { source, dryRun, ...data } = orgBody.parse(req.body);
  if (dryRun) {
    const log = await syncOrg(prisma, source, data, { dryRun: true });
    return ok(res, log, '组织同步预览完成');
  }
  const log = await startOrgSync(prisma, source, data, { triggerSource: 'upload' });
  return ok(res, { id: log.id, status: log.status, source }, '组织同步已触发', 202);
});

syncRoutes.get('/logs', async (req, res) => {
  const query = listQuery.parse(req.query);
  const { pageNum, pageSize, skip } = pageParams(query);
  const result = await administration.syncLogs({ skip, take: pageSize, status: query.status });
  return ok(res, pagination(result.records, result.totalCount, pageNum, pageSize));
});

syncRoutes.get('/logs/:id', async (req, res) => {
  const item = await administration.syncLog(logId.parse(req.params.id));
  if (!item) return fail(res, 404, '同步记录不存在');
  return ok(res, item);
});

syncRoutes.post('/logs/:id/apply', async (req, res) => {
  const original = await administration.syncLog(logId.parse(req.params.id));
  if (!original) return fail(res, 404, '同步记录不存在');
  if (!original.dryRun || original.status !== 'completed' || !original.canonicalSnapshot) {
    return fail(res, 409, '只有成功的 dry-run 预览可以确认执行');
  }
  const log = await startOrgSync(prisma, original.source, original.canonicalSnapshot, {
    adapter: original.adapter ?? undefined,
    triggerSource: 'apply-preview',
    retryOfId: original.id,
  });
  return ok(res, { id: log.id, status: log.status }, '组织同步已排队', 202);
});

syncRoutes.post('/logs/:id/retry', async (req, res) => {
  const original = await administration.syncLog(logId.parse(req.params.id));
  if (!original) return fail(res, 404, '同步记录不存在');
  if (original.status !== 'error') return fail(res, 409, '只有失败的同步记录可以重试');
  if (original.canonicalSnapshot) {
    const log = await startOrgSync(prisma, original.source, original.canonicalSnapshot, {
      dryRun: original.dryRun,
      adapter: original.adapter ?? undefined,
      triggerSource: 'retry',
      retryOfId: original.id,
      attempt: original.attempt + 1,
    });
    return ok(res, { id: log.id, status: log.status }, '同步重试已排队', 202);
  }
  if (original.adapter) {
    const name = adapterName.parse(original.adapter);
    const adapter = createOrganizationAdapterRegistry().get(name);
    if (!adapter?.supportsPull) return fail(res, 409, '该 adapter 不支持直接重试');
    try {
      const log = await syncOrgFromAdapter(prisma, adapter, {
        dryRun: original.dryRun,
        triggerSource: 'retry',
        retryOfId: original.id,
        attempt: original.attempt + 1,
      });
      return ok(res, { id: log.id, status: log.status }, '同步重试完成');
    } catch (error) {
      const classified = classifyAdapterError(error);
      return fail(res, adapterHttpStatus(classified.category), classified.message);
    }
  }
  return fail(res, 409, '失败记录没有可重试的 canonical 快照');
});

syncRoutes.get('/status', async (_req, res) =>
  ok(res, {
    lastSync: await administration.lastSync(),
  }),
);
