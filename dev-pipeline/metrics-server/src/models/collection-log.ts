import type { PrismaClient } from '@prisma/client';

export class CollectionLogRepository {
  constructor(private readonly db: PrismaClient) {}
  recent(take = 50) {
    return this.db.collectionLog.findMany({ take, include: { repo: true }, orderBy: { startedAt: 'desc' } });
  }
}
