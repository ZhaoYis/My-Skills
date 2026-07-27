import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { createSession } from '../../services/auth-service.js';
import { fail, ok } from '../response.js';
import { getEnv } from '../../config/env.js';

const bodySchema = z.object({ email: z.string().email(), name: z.string().min(1).max(255), sub: z.string().min(1).max(255) });
export const authRoutes = Router();

authRoutes.post('/session', async (req, res) => {
  const env = getEnv();
  if (!env.API_KEY || req.header('x-api-key') !== env.API_KEY) {
    return fail(res, 401, '会话交换凭证无效');
  }
  const body = bodySchema.parse(req.body);
  return ok(res, await createSession(prisma, body.email, body.name, body.sub), '登录成功');
});
