import type { PrismaClient } from '@prisma/client';

export class PipelineRunRepository {
  constructor(private readonly db: PrismaClient) {}
  latestForDeveloper(developerId: number) {
    return this.db.pipelineRun.findMany({
      where: { developerId, isLatest: true, fingerprintVerified: true },
      orderBy: { updatedAtPipeline: 'desc' },
    });
  }
}
