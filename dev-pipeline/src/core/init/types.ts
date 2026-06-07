import type { FeatureId, ToolAdapter, ToolId } from '../adapters/types.js';
import type { InstallConflictResolution, InstallFile } from '../assets/types.js';

export interface InstallPlan {
  projectName: string;
  tool: ToolId;
  features: FeatureId[];
  adapter: ToolAdapter;
  files: InstallFile[];
  targetDir: string;
  dryRun: boolean;
  force: boolean;
}

export interface ResolveInstallConflictsOptions {
  yes: boolean;
  force: boolean;
}

export type ConflictBulkAction = 'overwrite-all' | 'append-all-safe' | 'skip-all';

export interface ManagedInstallFile extends InstallFile {
  resolution: Exclude<InstallConflictResolution, 'skip' | 'unresolved'>;
}
