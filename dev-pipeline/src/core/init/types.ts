import type { DocLanguage, FeatureId, StackId, ToolAdapter, ToolId } from '../adapters/types.js';
import type { InstallConflictResolution, InstallFile, InstallMode } from '../assets/types.js';
import type { TechStackId } from '../tech-stack/types.js';

export interface InstallPlan {
  projectName: string;
  tool: ToolId;
  stack?: StackId;
  techStack?: TechStackId;
  language: DocLanguage;
  features: FeatureId[];
  adapter: ToolAdapter;
  files: InstallFile[];
  targetDir: string;
  dryRun: boolean;
  force: boolean;
  mode: InstallMode;
}

export interface ResolveInstallConflictsOptions {
  yes: boolean;
  force: boolean;
}

export type ConflictBulkAction = 'overwrite-all' | 'append-all-safe' | 'skip-all';

export interface ManagedInstallFile extends InstallFile {
  resolution: Exclude<InstallConflictResolution, 'skip' | 'unresolved'>;
}
