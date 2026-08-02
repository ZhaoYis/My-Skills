import type { DocLanguage, FeatureId, InstallScope, StackId, ToolId } from '../adapters/types.js';

export interface ManagedAssetRecord {
  id: string;
  destination: string;
}

export interface PipelineManifest {
  schemaVersion: number;
  projectName: string;
  tool: ToolId;
  stack?: StackId;
  techStack?: string;
  language?: DocLanguage;
  features: FeatureId[];
  scope?: InstallScope;
  templateVersion: string;
  packageName: string;
  managedAssets: ManagedAssetRecord[];
}
