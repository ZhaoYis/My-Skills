import type { FeatureId, ToolId } from '../adapters/types.js';

export interface InitOptions {
  dir?: string;
  dryRun?: boolean;
  force?: boolean;
  tool?: ToolId;
  yes?: boolean;
  /** Optional, non-default features to enable (e.g. 'prototype'). Repeatable on the CLI via --feature. */
  feature?: string | string[];
}

export interface InitAnswers {
  projectName: string;
  tool: ToolId;
  features: FeatureId[];
}
