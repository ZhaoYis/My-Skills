import type { FeatureId, ToolAdapter, ToolId } from '../adapters/types.js';
import type { InstallFile } from '../assets/types.js';

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
