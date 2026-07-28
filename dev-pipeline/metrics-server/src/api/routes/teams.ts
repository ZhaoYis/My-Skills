import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import {
  OrganizationAdminService,
  OrganizationConflictError,
  OrganizationInputError,
} from '../../services/organization-admin-service.js';
import { positiveId } from '../contracts/registry.js';
import { adminOnly } from '../middleware/auth.js';
import { fail, ok } from '../response.js';

const teamBody = z.object({
  name: z.string().trim().min(1).max(128),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9-]+$/),
  parentId: z.number().int().positive().nullable().optional(),
  externalId: z.string().trim().max(255).nullable().optional(),
});
const teamListQuery = z.object({
  status: z.enum(['all', 'active', 'inactive']).default('all'),
});
const deactivateBody = z.object({
  childStrategy: z.enum(['reject', 'promote']).default('reject'),
  memberStrategy: z.enum(['reject', 'unassign', 'move']).default('reject'),
  targetTeamId: z.number().int().positive().optional(),
});
const idParam = positiveId;

export const teamRoutes = Router();
const organization = new OrganizationAdminService(prisma);
teamRoutes.use(adminOnly);

teamRoutes.get('/', async (req, res) => {
  const query = teamListQuery.parse(req.query);
  return ok(res, await organization.listTeams(query.status));
});

teamRoutes.post('/', async (req, res) => {
  const data = teamBody.parse(req.body);
  try {
    return ok(res, await organization.createTeam(data), '创建成功', 201);
  } catch (error) {
    if (error instanceof OrganizationInputError) return fail(res, 400, error.message);
    throw error;
  }
});

teamRoutes.put('/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const data = teamBody.partial().parse(req.body);
  try {
    return ok(res, await organization.updateTeam(id, data));
  } catch (error) {
    if (error instanceof OrganizationConflictError) return fail(res, 409, error.message);
    throw error;
  }
});

teamRoutes.delete('/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const strategy = deactivateBody.parse(req.body ?? {});
  try {
    return ok(res, await organization.deactivateTeam(id, strategy), '团队已停用，历史归属保留');
  } catch (error) {
    if (error instanceof OrganizationConflictError) return fail(res, 409, error.message);
    throw error;
  }
});
