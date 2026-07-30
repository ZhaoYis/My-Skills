import type { DocLanguage, FeatureId, StackId, ToolId } from '../adapters/types.js';
import type { TechStackId } from '../tech-stack/types.js';

export interface InitOptions {
  dir?: string;
  dryRun?: boolean;
  force?: boolean;
  tool?: ToolId;
  stack?: StackId;
  techStack?: string;
  language?: DocLanguage;
  yes?: boolean;
  /** Optional, non-default features to enable. Repeatable on the CLI via --feature. */
  feature?: string | string[];
}

export interface InitAnswers {
  projectName: string;
  tool: ToolId;
  stack: StackId;
  techStack?: TechStackId;
  language: DocLanguage;
  features: FeatureId[];
}
