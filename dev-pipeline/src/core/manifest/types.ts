import type { DocLanguage, FeatureId, StackId, ToolId } from '../adapters/types.js';

export interface ManagedAssetRecord {
  id: string;
  destination: string;
}

export interface PipelineManifest {
  schemaVersion: number;
  projectName: string;
  tool: ToolId;
  stack?: StackId;
  language?: DocLanguage;
  features: FeatureId[];
  templateVersion: string;
  packageName: string;
  managedAssets: ManagedAssetRecord[];
}
