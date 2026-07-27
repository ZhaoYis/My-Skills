import type { PrismaClient } from '@prisma/client';

export class ReviewRoundRepository {
  constructor(private readonly db: PrismaClient) {}
  forRun(runId: bigint) {
    return this.db.reviewRound.findMany({ where: { runId }, orderBy: { roundNumber: 'asc' } });
  }
}
