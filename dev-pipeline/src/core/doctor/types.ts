export type HealthStatus = 'ok' | 'warn' | 'fail';

export interface HealthCheckResult {
  id: string;
  status: HealthStatus;
  message: string;
  path?: string;
  missingFiles?: string[];
  missingSections?: string[];
  placeholderCount?: number;
}

export interface KnowledgeHealthSummary {
  ok: number;
  warn: number;
  fail: number;
}

export interface KnowledgeHealthReport {
  status: HealthStatus;
  rootPath: string;
  checks: HealthCheckResult[];
  summary: KnowledgeHealthSummary;
}
