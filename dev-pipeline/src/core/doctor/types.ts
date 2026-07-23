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
