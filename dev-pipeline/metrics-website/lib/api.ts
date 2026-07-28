import { auth } from '@/auth';
import type { ApiResponsePayload } from './generated/api-contract';
import type { Overview } from './types';

const baseUrl = process.env.METRICS_API_URL ?? 'http://localhost:3001/api/v1';

export type ApiErrorKind = 'unauthorized' | 'forbidden' | 'network' | 'server' | 'business';

export class MetricsApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status: number,
    message: string,
    readonly apiCode?: string | number,
    readonly requestId?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'MetricsApiError';
  }
}

export function isMetricsApiError(error: unknown): error is MetricsApiError {
  if (error instanceof MetricsApiError) return true;
  if (!error || typeof error !== 'object') return false;
  const candidate = error as Partial<MetricsApiError>;
  return (
    candidate.name === 'MetricsApiError' &&
    typeof candidate.message === 'string' &&
    typeof candidate.status === 'number' &&
    ['unauthorized', 'forbidden', 'network', 'server', 'business'].includes(String(candidate.kind))
  );
}

export interface ApiOptions {
  serviceAuth?: boolean;
}

export interface ApiDeleteOptions extends ApiOptions {
  body?: unknown;
}

function developmentIdentity() {
  return process.env.NODE_ENV === 'development' ? process.env.METRICS_DEV_DEVELOPER_ID : undefined;
}

async function authHeaders(options: ApiOptions = {}): Promise<HeadersInit> {
  const session = await auth();
  if (session?.apiToken) return { authorization: `Bearer ${session.apiToken}` };
  const developerId = developmentIdentity();
  if (developerId) return { 'x-dev-impersonate': developerId };
  if (options.serviceAuth && process.env.METRICS_API_KEY) {
    return { 'x-api-key': process.env.METRICS_API_KEY };
  }
  return {};
}

function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status >= 500) return 'server';
  return 'business';
}

export async function fetchMetrics<T>(
  url: string,
  init: RequestInit,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(url, init);
  } catch {
    throw new MetricsApiError('network', 0, '无法连接指标服务', 'NETWORK_ERROR');
  }

  let payload: ApiResponsePayload<T> = {};
  try {
    payload = (await response.json()) as ApiResponsePayload<T>;
  } catch {
    if (response.ok) {
      throw new MetricsApiError('server', response.status, '指标服务返回了无法解析的响应', 'INVALID_RESPONSE');
    }
  }
  if (!response.ok || payload.success === false) {
    throw new MetricsApiError(
      kindForStatus(response.status),
      response.status,
      payload.message || `Metrics API request failed: ${response.status}`,
      payload.code,
      payload.requestId ?? response.headers.get('x-request-id') ?? undefined,
      payload.details,
    );
  }
  return payload.data as T;
}

export async function apiGet<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = await authHeaders(options);
  return fetchMetrics<T>(`${baseUrl}${path}`, { headers, cache: 'no-store' });
}

export async function apiPost<T>(path: string, body: unknown = {}, options: ApiOptions = {}): Promise<T> {
  return apiMutation<T>('POST', path, body, options);
}

async function apiMutation<T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body: unknown,
  options: ApiOptions,
): Promise<T> {
  const headers: HeadersInit = {
    'content-type': 'application/json',
    ...(await authHeaders(options)),
  };
  return fetchMetrics<T>(`${baseUrl}${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

export function apiPut<T>(path: string, body: unknown, options: ApiOptions = {}) {
  return apiMutation<T>('PUT', path, body, options);
}

export function apiPatch<T>(path: string, body: unknown, options: ApiOptions = {}) {
  return apiMutation<T>('PATCH', path, body, options);
}

export function apiDelete<T>(path: string, options: ApiDeleteOptions = {}) {
  const { body = {}, ...apiOptions } = options;
  return apiMutation<T>('DELETE', path, body, apiOptions);
}

export function emptyOverview(): Overview {
  return {
    totalRuns: 0,
    completedRuns: 0,
    completionRate: 0,
    abandonmentRate: 0,
    monthlyCompleted: 0,
    overdueRate: 0,
    avgCycleTimeMinutes: 0,
    avgEffectiveCycleTimeMinutes: 0,
    medianCycleTimeMinutes: 0,
    avgReviewRounds: 0,
    reviewPassRate: 0,
    testFirstPassRate: 0,
    avgTestAttempts: 0,
    avgVerifyAttempts: 0,
    avgRollbacksPerChange: 0,
    pauseCount: 0,
    pauseRate: 0,
    bypassFrequency: {},
    bypassRate: 0,
    phaseBreakdown: Array.from({ length: 7 }, (_, phase) => ({
      phase,
      count: 0,
      avgSec: 0,
      p50Sec: 0,
      p95Sec: 0,
    })),
    recentTrend: [],
  };
}
