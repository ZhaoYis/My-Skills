import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getEnv } from '../../config/env.js';
import { fail } from '../response.js';
import type { AuthUser } from '../types.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function auth(req: Request, res: Response, next: NextFunction) {
  const env = getEnv();
  const apiKey = req.header('x-api-key');
  if (env.API_KEY && apiKey === env.API_KEY) {
    req.user = { developerId: 0, email: 'api-key', teamId: null, isAdmin: true };
    return next();
  }

  const token = req.header('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return fail(res, 401, '缺少认证凭证');
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    req.user = {
      developerId: Number(payload.developerId),
      email: payload.email,
      teamId: payload.teamId == null ? null : Number(payload.teamId),
      isAdmin: Boolean(payload.isAdmin),
    };
    return next();
  } catch {
    return fail(res, 401, '认证凭证无效或已过期');
  }
}

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  return req.user?.isAdmin ? next() : fail(res, 403, '需要管理员权限');
}
