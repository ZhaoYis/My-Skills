import { auth } from '@/auth';
import type { Overview } from './types';

const baseUrl = process.env.METRICS_API_URL ?? 'http://localhost:3001/api/v1';

export async function apiGet<T>(path: string): Promise<T> {
  const session = await auth();
  const headers: HeadersInit = session?.apiToken
    ? { authorization: `Bearer ${session.apiToken}` }
    : process.env.METRICS_API_KEY
      ? { 'x-api-key': process.env.METRICS_API_KEY }
      : {};
  const response = await fetch(`${baseUrl}${path}`, { headers, cache: 'no-store' });
  if (!response.ok) throw new Error(`Metrics API request failed: ${response.status}`);
  const payload = (await response.json()) as { data: T };
  return payload.data;
}

export async function apiPost<T>(path: string, body: unknown = {}): Promise<T> {
  const session = await auth();
  const headers: HeadersInit = {
    'content-type': 'application/json',
    ...(session?.apiToken
      ? { authorization: `Bearer ${session.apiToken}` }
      : process.env.METRICS_API_KEY
        ? { 'x-api-key': process.env.METRICS_API_KEY }
        : {}),
  };
  const response = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Metrics API request failed: ${response.status}`);
  const payload = (await response.json()) as { data: T };
  return payload.data;
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
    phaseBreakdown: Array.from({ length: 7 }, (_, phase) => ({ phase, count: 0, avgSec: 0, p50Sec: 0, p95Sec: 0 })),
    recentTrend: [],
  };
}
