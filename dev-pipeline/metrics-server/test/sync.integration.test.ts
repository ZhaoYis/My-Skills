import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { syncOrg } from '../src/services/sync-service.js';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const db = enabled ? new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL }) : null;
const suffix = 'integration-sync';

describe.runIf(enabled)('organization sync', () => {
  it('upserts hierarchy and links an existing collected identity by normalized email', async () => {
    const now = new Date();
    await db!.developer.create({ data: { email: `${suffix}@example.invalid`, displayName: 'Collected Name', firstSeenAt: now, lastSeenAt: now } });
    const log = await syncOrg(db!, 'test', {
      teams: [
        { externalId: `${suffix}-root`, name: 'Platform', slug: `${suffix}-platform` },
        { externalId: `${suffix}-child`, name: 'AI Delivery', slug: `${suffix}-ai`, parentExternalId: `${suffix}-root` },
      ],
      developers: [{ sub: `${suffix}-sub`, email: `${suffix}@EXAMPLE.INVALID`, name: 'Domain Name', teamExternalId: `${suffix}-child` }],
    });
    expect(log).toMatchObject({ status: 'completed', teamsCreated: 2, devsLinked: 1 });
    const developer = await db!.developer.findUniqueOrThrow({ where: { email: `${suffix}@example.invalid` }, include: { team: { include: { parent: true } } } });
    expect(developer).toMatchObject({ externalId: `${suffix}-sub`, displayName: 'Domain Name' });
    expect(developer.team?.parent?.externalId).toBe(`${suffix}-root`);
  });
});

afterAll(async () => {
  if (db) {
    await db.developer.deleteMany({ where: { email: `${suffix}@example.invalid` } });
    await db.team.deleteMany({ where: { externalId: { in: [`${suffix}-child`, `${suffix}-root`] } } });
    await db.syncLog.deleteMany({ where: { source: 'test' } });
  }
  await db?.$disconnect();
});
