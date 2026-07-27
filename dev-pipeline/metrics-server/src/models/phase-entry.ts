import type { PrismaClient } from '@prisma/client';

export class PhaseEntryRepository {
  constructor(private readonly db: PrismaClient) {}
  forRun(runId: bigint) {
    return this.db.phaseHistoryEntry.findMany({ where: { runId }, orderBy: { startedAt: 'asc' } });
  }
}
