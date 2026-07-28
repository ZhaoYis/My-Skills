import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { prisma } from '../../config/database.js';
import { getEnv } from '../../config/env.js';
import { authenticateServiceApiKey } from '../../services/service-key-service.js';
import { fail } from '../response.js';
import type { AuthPrincipal } from '../types.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthPrincipal;
    }
  }
}

interface CurrentDeveloper {
  id: number;
  email: string;
  teamId: number | null;
  role: string | null;
  isActive: boolean;
  tokenVersion: number;
}

export type DeveloperAuthorizationLookup = (id: number) => Promise<CurrentDeveloper | null>;

const lookupCurrentDeveloper: DeveloperAuthorizationLookup = (id) =>
  prisma.developer.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      teamId: true,
      role: true,
      isActive: true,
      tokenVersion: true,
    },
  });

interface SessionToken extends JwtPayload {
  developerId?: unknown;
  tokenVersion?: unknown;
}

export function createAuthMiddleware(
  env: ReturnType<typeof getEnv>,
  findDeveloper: DeveloperAuthorizationLookup = lookupCurrentDeveloper,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const service = authenticateServiceApiKey(req.header('x-api-key'), env);
    if (service) {
      req.user = service;
      return next();
    }

    const impersonatedId = Number(req.header('x-dev-impersonate'));
    if (
      env.NODE_ENV === 'development' &&
      env.DEV_IMPERSONATE_DEVELOPER_ID !== undefined &&
      impersonatedId === env.DEV_IMPERSONATE_DEVELOPER_ID
    ) {
      const developer = await findDeveloper(impersonatedId);
      if (!developer?.isActive) return fail(res, 401, '模拟开发者不存在或已停用');
      req.user = {
        kind: 'user',
        developerId: developer.id,
        email: developer.email,
        teamId: developer.teamId,
        isAdmin: developer.role === 'admin',
        tokenVersion: developer.tokenVersion,
        impersonated: true,
      };
      return next();
    }

    const token = req.header('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return fail(res, 401, '缺少认证凭证');
    let payload: SessionToken;
    try {
      payload = jwt.verify(token, env.JWT_SECRET, {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      }) as SessionToken;
    } catch {
      return fail(res, 401, '认证凭证无效或已过期');
    }

    const developerId = Number(payload.developerId);
    const tokenVersion = Number(payload.tokenVersion);
    if (!Number.isInteger(developerId) || developerId <= 0 || !Number.isInteger(tokenVersion)) {
      return fail(res, 401, '认证凭证无效或已过期');
    }

    try {
      const developer = await findDeveloper(developerId);
      if (!developer?.isActive || developer.tokenVersion !== tokenVersion) {
        return fail(res, 401, '认证凭证无效或已过期');
      }
      req.user = {
        kind: 'user',
        developerId: developer.id,
        email: developer.email,
        teamId: developer.teamId,
        isAdmin: developer.role === 'admin',
        tokenVersion: developer.tokenVersion,
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function auth(req: Request, res: Response, next: NextFunction) {
  return createAuthMiddleware(getEnv())(req, res, next);
}

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  const allowed =
    (req.user?.kind === 'user' && req.user.isAdmin) ||
    (req.user?.kind === 'service' && req.user.purposes.includes('management'));
  return allowed ? next() : fail(res, 403, '需要管理员权限');
}

export function userOnly(req: Request, res: Response, next: NextFunction) {
  return req.user?.kind === 'user'
    ? next()
    : fail(res, 403, '个人身份缺失：服务凭证不能访问个人指标');
}
