import type { PrismaClient } from '@prisma/client';

export class DeveloperRepository {
  constructor(private readonly db: PrismaClient) {}
  byEmail(email: string) {
    return this.db.developer.findUnique({ where: { email: email.trim().toLowerCase() } });
  }
  list(skip: number, take: number) {
    return this.db.developer.findMany({ skip, take, include: { team: true }, orderBy: { id: 'asc' } });
  }
}
