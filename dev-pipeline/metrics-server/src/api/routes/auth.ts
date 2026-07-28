import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { getEnv } from '../../config/env.js';
import { createSession, InactiveDeveloperError } from '../../services/auth-service.js';
import { authenticateServiceApiKey } from '../../services/service-key-service.js';
import { fail, ok } from '../response.js';

const bodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  sub: z.string().min(1).max(255),
});
export const authRoutes = Router();

authRoutes.post('/session', async (req, res) => {
  const env = getEnv();
  const service = authenticateServiceApiKey(req.header('x-api-key'), env);
  if (!service?.purposes.includes('session-exchange')) {
    return fail(res, 401, '会话交换凭证无效');
  }
  const body = bodySchema.parse(req.body);
  try {
    return ok(res, await createSession(prisma, body.email, body.name, body.sub), '登录成功');
  } catch (error) {
    if (error instanceof InactiveDeveloperError) return fail(res, 403, error.message);
    throw error;
  }
});
