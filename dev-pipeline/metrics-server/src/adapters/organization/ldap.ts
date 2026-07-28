import { z } from 'zod';
import { type OrgData, OrgDataSchema } from '../../services/sync-service.js';
import { canonicalSlug } from './types.js';

const ldapData = z.object({
  groups: z.array(
    z.object({
      dn: z.string().min(1),
      name: z.string().min(1),
      parentDn: z.string().nullable().optional(),
    }),
  ),
  users: z.array(
    z.object({
      dn: z.string().min(1),
      mail: z.string().email(),
      displayName: z.string().min(1),
      groupDn: z.string().nullable().optional(),
    }),
  ),
});

export function convertLdapOrganization(input: unknown): OrgData {
  const parsed = ldapData.parse(input);
  return OrgDataSchema.parse({
    teams: parsed.groups.map((group, index) => ({
      externalId: group.dn,
      name: group.name,
      slug: canonicalSlug('ldap', group.dn, index),
      parentExternalId: group.parentDn ?? null,
    })),
    developers: parsed.users.map((user) => ({
      externalId: user.dn,
      email: user.mail,
      name: user.displayName,
      teamExternalId: user.groupDn ?? null,
    })),
  });
}
