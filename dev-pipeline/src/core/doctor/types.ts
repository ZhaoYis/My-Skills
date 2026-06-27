export type HealthStatus = 'ok' | 'warn' | 'fail';

export type HealthGrade = 'healthy' | 'fair' | 'attention';

export interface HealthCheckResult {
  id: string;
  status: HealthStatus;
  message: string;
  path?: string;
  missingFiles?: string[];
  missingSections?: string[];
  placeholderCount?: number;
  brokenLinks?: string[];
  duplicateFiles?: string[];
  staleFiles?: string[];
}

export interface KnowledgeHealthSummary {
  ok: number;
  warn: number;
  fail: number;
}

export interface KnowledgeHealthScoreDimension {
  id: string;
  label: string;
  weight: number;
  score: number;
  status: HealthStatus;
  detail?: string;
}

export interface KnowledgeHealthScore {
  value: number;
  grade: HealthGrade;
  dimensions: KnowledgeHealthScoreDimension[];
}

export interface KnowledgeHealthDimensionDelta {
  id: string;
  delta: number | null;
}

export interface KnowledgeHealthTrend {
  previousDate: string | null;
  previousValue: number | null;
  delta: number | null;
  dimensionDeltas: KnowledgeHealthDimensionDelta[];
}

export interface KnowledgeHealthReport {
  status: HealthStatus;
  rootPath: string;
  checks: HealthCheckResult[];
  summary: KnowledgeHealthSummary;
  generatedAt?: string;
  score?: KnowledgeHealthScore;
  trend?: KnowledgeHealthTrend;
}

// ── Stack Profile Health types ──

export interface StackIssue {
  /** JSON path to the problematic field */
  path: string;
  /** Error severity */
  severity: 'error' | 'warning';
  /** Human-readable message */
  message: string;
}

export interface StackHealthResult {
  /** Overall validity */
  valid: boolean;
  /** Whether a stack profile was found */
  stackFound: boolean;
  /** Path to the config file inspected */
  configPath: string | null;
  /** Stack ID, if found */
  stackId?: string;
  /** Number of services defined */
  serviceCount?: number;
  /** Detected stacks (service names) */
  stacks?: string[];
  /** Individual issues found */
  issues: StackIssue[];
}
