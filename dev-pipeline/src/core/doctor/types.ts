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
  /** Identifier of the check that produced this issue (e.g. `managed-assets`,
   *  `path-escapes`, `tool-config`). Optional for backward compatibility with
   *  callers that emit issues outside of a named check. */
  checkId?: string;
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

// ── Managed Assets check ──

export interface ManagedAssetHealthResult {
  /** Whether every declared managed asset resolves to a readable file */
  valid: boolean;
  /** Issues found while resolving / probing managed assets */
  issues: StackIssue[];
}

// ── Path Escape check ──

export interface PathEscapeHealthResult {
  /** Whether every project-scoped managed asset stays within the project root */
  valid: boolean;
  /** Issues found while validating destination paths */
  issues: StackIssue[];
}

// ── Tool / Feature / Stack / Scope config check ──

export interface ToolConfigHealthResult {
  /** Whether the manifest's tool/feature/stack/scope identifiers are all valid */
  valid: boolean;
  /** Issues found while validating manifest identifiers */
  issues: StackIssue[];
}
