import type { FeatureId, ToolId } from '../adapters/types.js';

export interface InitOptions {
  dir?: string;
  dryRun?: boolean;
  force?: boolean;
  tool?: ToolId;
  yes?: boolean;
}

export interface InitAnswers {
  projectName: string;
  tool: ToolId;
  features: FeatureId[];
}
