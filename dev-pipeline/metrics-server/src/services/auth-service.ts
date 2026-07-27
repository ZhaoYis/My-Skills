import type { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';

export async function createSession(db: PrismaClient, emailInput: string, name: string, sub: string) {
  const email = emailInput.trim().toLowerCase();
  const now = new Date();
  const developer = await db.developer.upsert({
    where: { email },
    create: { email, displayName: name, externalId: sub, firstSeenAt: now, lastSeenAt: now },
    update: { displayName: name, externalId: sub, lastSeenAt: now },
  });
  const token = jwt.sign(
    {
      developerId: developer.id,
      email: developer.email,
      teamId: developer.teamId,
      isAdmin: developer.role === 'admin',
    },
    getEnv().JWT_SECRET,
    { expiresIn: '24h' },
  );
  return { token, developer };
}
