import type { Response } from 'express';
import { apiErrorSchema, apiSuccessSchema, paginationQuerySchema } from './contracts/registry.js';

function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

export function ok(res: Response, data: unknown, message = '请求成功', code = 200) {
  const payload = apiSuccessSchema.parse({ success: true, code, message, data: jsonSafe(data) });
  return res.status(code).json(payload);
}

export function fail(
  res: Response,
  status: number,
  message: string,
  options: {
    code?: string | number;
    details?: unknown;
    requestId?: string;
    errorCategory?: string;
  } = {},
) {
  const requestId =
    options.requestId ?? ((res.locals?.requestId as string | undefined) || undefined);
  if (res.locals) res.locals.errorCategory = options.errorCategory;
  const payload = apiErrorSchema.parse({
    success: false,
    code: options.code ?? status,
    message,
    data: null,
    ...(options.details === undefined ? {} : { details: jsonSafe(options.details) }),
    ...(requestId ? { requestId } : {}),
  });
  return res.status(status).json(payload);
}

export function pagination<T>(records: T[], totalCount: number, pageNum: number, pageSize: number) {
  return { pageNum, pageSize, totalCount, totalPage: Math.ceil(totalCount / pageSize), records };
}

export function pageParams(query: Record<string, unknown>) {
  const { pageNum, pageSize } = paginationQuerySchema.parse(query);
  return { pageNum, pageSize, skip: (pageNum - 1) * pageSize };
}
