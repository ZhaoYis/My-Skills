import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import {
  AdministrationService,
  InvalidTeamAssignmentError,
} from '../../services/administration-service.js';
import { positiveId } from '../contracts/registry.js';
import { adminOnly } from '../middleware/auth.js';
import { fail, ok, pageParams, pagination } from '../response.js';

const listQuery = z.object({
  q: z.string().trim().max(255).optional(),
  unassigned: z.enum(['true', 'false']).optional(),
  claim: z.enum(['all', 'linked', 'unlinked']).default('all'),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  teamId: positiveId.optional(),
});
const updateBody = z.object({
  teamId: z.number().int().positive().nullable().optional(),
  role: z.enum(['admin', 'member']).nullable().optional(),
  displayName: z.string().trim().min(1).max(255).optional(),
  externalId: z.string().trim().min(1).max(255).nullable().optional(),
  isActive: z.boolean().optional(),
});
const idParam = positiveId;

export const developerRoutes = Router();
const administration = new AdministrationService(prisma);
developerRoutes.use(adminOnly);

developerRoutes.get('/', async (req, res) => {
  const page = pageParams(req.query);
  const query = listQuery.parse(req.query);
  const result = await administration.listDevelopers({
    skip: page.skip,
    take: page.pageSize,
    q: query.q,
    unassigned: query.unassigned === 'true',
    claim: query.claim,
    status: query.status,
    teamId: query.teamId,
  });
  return ok(res, pagination(result.records, result.totalCount, page.pageNum, page.pageSize));
});

developerRoutes.put('/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const data = updateBody.parse(req.body);
  try {
    return ok(res, await administration.updateDeveloper(id, data), '开发者权限与归属已更新');
  } catch (error) {
    if (error instanceof InvalidTeamAssignmentError) return fail(res, 400, error.message);
    throw error;
  }
});
