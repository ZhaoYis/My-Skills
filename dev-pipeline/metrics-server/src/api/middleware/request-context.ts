import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { type ObservabilityRegistry, observability } from '../../observability/metrics.js';
import { logger } from '../../utils/logger.js';
import { endpointRegistry } from '../contracts/registry.js';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export interface RequestLogger {
  info(context: object, message: string): void;
  warn(context: object, message: string): void;
  error(context: object, message: string): void;
}

interface RequestContextOptions {
  log?: RequestLogger;
  metrics?: ObservabilityRegistry;
  now?: () => number;
  requestId?: () => string;
}

const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const apiRoutes = endpointRegistry.map((endpoint) => ({
  method: endpoint.method.toUpperCase(),
  path: endpoint.path,
  pattern: new RegExp(
    `^/api/v1${endpoint.path
      .split('/')
      .map((segment) =>
        segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      )
      .join('/')}/?$`,
  ),
}));

function routeTemplate(req: Request) {
  const pathname = req.originalUrl.split('?', 1)[0] ?? req.path;
  if (pathname === '/observability/metrics') return pathname;
  const matched = apiRoutes.find(
    (route) => route.method === req.method.toUpperCase() && route.pattern.test(pathname),
  );
  return matched ? `/api/v1${matched.path}` : 'unmatched';
}

function errorCategory(statusCode: number, configured?: string) {
  if (configured) return configured;
  if (statusCode < 400) return undefined;
  if (statusCode === 400) return 'validation';
  if (statusCode === 401) return 'authentication';
  if (statusCode === 403) return 'authorization';
  if (statusCode === 404) return 'not-found';
  if (statusCode === 409) return 'conflict';
  if (statusCode >= 500) return 'server';
  return 'client';
}

function principalContext(req: Request) {
  if (req.user?.kind === 'user') {
    return { principalType: 'user', developerId: req.user.developerId };
  }
  if (req.user?.kind === 'service') {
    return { principalType: 'service', serviceKeyId: req.user.keyId };
  }
  return { principalType: 'anonymous' };
}

export function requestContext(options: RequestContextOptions = {}): RequestHandler {
  const log = options.log ?? logger;
  const metrics = options.metrics ?? observability;
  const now = options.now ?? Date.now;
  const generateRequestId = options.requestId ?? randomUUID;

  return (req: Request, res: Response, next: NextFunction) => {
    const supplied = req.header('x-request-id');
    const requestId = supplied && requestIdPattern.test(supplied) ? supplied : generateRequestId();
    const startedAt = now();
    req.requestId = requestId;
    res.locals.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    res.once('finish', () => {
      const durationMs = Math.max(0, now() - startedAt);
      const route = routeTemplate(req);
      const category = errorCategory(
        res.statusCode,
        res.locals.errorCategory as string | undefined,
      );
      metrics.observeApiRequest(req.method, route, res.statusCode, durationMs / 1_000);
      const context = {
        requestId,
        method: req.method,
        route,
        statusCode: res.statusCode,
        durationMs,
        ...(category ? { errorCategory: category } : {}),
        ...principalContext(req),
      };
      if (res.statusCode >= 500) log.error(context, 'request completed');
      else if (res.statusCode >= 400) log.warn(context, 'request completed');
      else log.info(context, 'request completed');
    });
    next();
  };
}
