import type { PrismaClient } from '@prisma/client';

export class RepoRepository {
  constructor(private readonly db: PrismaClient) {}
  active() {
    return this.db.repo.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } });
  }
  byId(id: number) {
    return this.db.repo.findUnique({ where: { id } });
  }
}
