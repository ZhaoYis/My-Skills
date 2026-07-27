import type { Response } from 'express';

function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

export function ok(res: Response, data: unknown, message = '请求成功', code = 200) {
  return res.status(code).json({ success: true, code, message, data: jsonSafe(data) });
}

export function fail(res: Response, code: number, message: string) {
  return res.status(code).json({ success: false, code, message, data: null });
}

export function pagination<T>(records: T[], totalCount: number, pageNum: number, pageSize: number) {
  return { pageNum, pageSize, totalCount, totalPage: Math.ceil(totalCount / pageSize), records };
}

export function pageParams(query: Record<string, unknown>) {
  const pageNum = Math.max(1, Number(query.pageNum) || 1);
  const pageSize = Math.min(1000, Math.max(1, Number(query.pageSize) || 20));
  return { pageNum, pageSize, skip: (pageNum - 1) * pageSize };
}
