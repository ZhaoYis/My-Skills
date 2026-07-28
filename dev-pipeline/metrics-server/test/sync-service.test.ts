import { describe, expect, it } from 'vitest';
import { OrgDataSchema } from '../src/services/sync-service.js';

const valid = {
  teams: [
    { externalId: 'root', name: 'Root', slug: 'root' },
    { externalId: 'child', name: 'Child', slug: 'child', parentExternalId: 'root' },
  ],
  developers: [
    {
      externalId: 'developer-1',
      email: 'USER@EXAMPLE.COM',
      name: 'User',
      teamExternalId: 'child',
    },
  ],
};

describe('canonical organization DTO', () => {
  it('normalizes canonical external IDs and email', () => {
    const parsed = OrgDataSchema.parse(valid);
    expect(parsed.developers[0]).toMatchObject({
      externalId: 'developer-1',
      email: 'user@example.com',
      teamExternalId: 'child',
    });
  });

  it.each([
    {
      ...valid,
      teams: [...valid.teams, { externalId: 'root', name: 'Duplicate', slug: 'duplicate' }],
    },
    {
      ...valid,
      teams: [{ externalId: 'child', name: 'Child', slug: 'child', parentExternalId: 'missing' }],
      developers: [],
    },
    {
      ...valid,
      teams: [
        { externalId: 'a', name: 'A', slug: 'a', parentExternalId: 'b' },
        { externalId: 'b', name: 'B', slug: 'b', parentExternalId: 'a' },
      ],
      developers: [],
    },
    {
      ...valid,
      developers: [
        {
          externalId: 'developer-1',
          email: 'user@example.com',
          name: 'User',
          teamExternalId: 'missing',
        },
      ],
    },
  ])('rejects duplicate, missing, or cyclic mappings', (input) => {
    expect(() => OrgDataSchema.parse(input)).toThrow();
  });

  it('rejects the retired sub field instead of silently accepting an ambiguous identity', () => {
    expect(() =>
      OrgDataSchema.parse({
        teams: [],
        developers: [{ sub: 'legacy-sub', email: 'legacy@example.com', name: 'Legacy' }],
      }),
    ).toThrow();
  });
});
