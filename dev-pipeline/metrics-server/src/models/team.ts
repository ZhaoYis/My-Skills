import type { PrismaClient } from '@prisma/client';

export class TeamRepository {
  constructor(private readonly db: PrismaClient) {}
  list() {
    return this.db.team.findMany({ orderBy: [{ parentId: 'asc' }, { name: 'asc' }] });
  }
  byId(id: number) {
    return this.db.team.findUnique({ where: { id } });
  }
}
