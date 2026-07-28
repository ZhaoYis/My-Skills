import type { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';

export class InactiveDeveloperError extends Error {}

export async function createSession(
  db: PrismaClient,
  emailInput: string,
  name: string,
  sub: string,
) {
  const email = emailInput.trim().toLowerCase();
  const now = new Date();
  const developer = await db.developer.upsert({
    where: { email },
    create: { email, displayName: name, externalId: sub, firstSeenAt: now, lastSeenAt: now },
    update: { displayName: name, externalId: sub, lastSeenAt: now },
  });
  if (!developer.isActive) throw new InactiveDeveloperError('开发者账号已停用');
  const env = getEnv();
  const token = jwt.sign(
    {
      developerId: developer.id,
      email: developer.email,
      teamId: developer.teamId,
      isAdmin: developer.role === 'admin',
      tokenVersion: developer.tokenVersion,
    },
    env.JWT_SECRET,
    {
      expiresIn: '24h',
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      subject: String(developer.id),
    },
  );
  return { token, developer };
}
