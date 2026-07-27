import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { clearTeamCache } from '../../services/team-cache.js';
import { adminOnly } from '../middleware/auth.js';
import { ok } from '../response.js';

const teamBody = z.object({
  name: z.string().min(1).max(128),
  slug: z.string().min(1).max(128).regex(/^[a-z0-9-]+$/),
  parentId: z.number().int().positive().nullable().optional(),
  externalId: z.string().max(255).nullable().optional(),
});

export const teamRoutes = Router();
teamRoutes.use(adminOnly);
teamRoutes.get('/', async (_req, res) => {
  const teams = await prisma.team.findMany({ orderBy: { name: 'asc' } });
  const nodes = new Map(teams.map((team) => [team.id, { ...team, children: [] as unknown[] }]));
  const roots: unknown[] = [];
  for (const team of teams) {
    const node = nodes.get(team.id)!;
    const parent = team.parentId ? nodes.get(team.parentId) : undefined;
    parent ? parent.children.push(node) : roots.push(node);
  }
  return ok(res, roots);
});
teamRoutes.post('/', async (req, res) => {
  const result = await prisma.team.create({ data: teamBody.parse(req.body) });
  clearTeamCache();
  return ok(res, result, '创建成功', 201);
});
teamRoutes.put('/:id', async (req, res) => {
  const result = await prisma.team.update({ where: { id: Number(req.params.id) }, data: teamBody.partial().parse(req.body) });
  clearTeamCache();
  return ok(res, result);
});
teamRoutes.delete('/:id', async (req, res) => {
  const result = await prisma.team.delete({ where: { id: Number(req.params.id) } });
  clearTeamCache();
  return ok(res, result, '删除成功');
});
