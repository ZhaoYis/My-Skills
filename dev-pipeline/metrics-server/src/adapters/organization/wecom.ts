import { z } from 'zod';
import { type OrgData, OrgDataSchema } from '../../services/sync-service.js';
import { canonicalSlug } from './types.js';

const wecomData = z.object({
  departments: z.array(
    z.object({
      id: z.number().int().positive(),
      name: z.string().min(1),
      parentid: z.number().int(),
    }),
  ),
  users: z.array(
    z.object({
      userid: z.string().min(1),
      name: z.string().min(1),
      email: z.string().email(),
      department: z.array(z.number().int().positive()),
    }),
  ),
});

export function convertWecomOrganization(input: unknown): OrgData {
  const parsed = wecomData.parse(input);
  const departmentIds = new Set(parsed.departments.map((department) => String(department.id)));
  return OrgDataSchema.parse({
    teams: parsed.departments.map((department, index) => ({
      externalId: String(department.id),
      name: department.name,
      slug: canonicalSlug('wecom', String(department.id), index),
      parentExternalId:
        department.parentid > 0 && departmentIds.has(String(department.parentid))
          ? String(department.parentid)
          : null,
    })),
    developers: parsed.users.map((user) => ({
      externalId: user.userid,
      email: user.email,
      name: user.name,
      teamExternalId: user.department.map(String).find((id) => departmentIds.has(id)) ?? null,
    })),
  });
}
