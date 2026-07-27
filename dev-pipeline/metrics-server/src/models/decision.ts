import type { PrismaClient } from '@prisma/client';

export class DecisionRepository {
  constructor(private readonly db: PrismaClient) {}
  forRun(runId: bigint) {
    return this.db.pipelineDecision.findMany({ where: { runId }, orderBy: { decisionKey: 'asc' } });
  }
}
