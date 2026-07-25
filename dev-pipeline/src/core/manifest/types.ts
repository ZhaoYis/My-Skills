import type { FeatureId, StackId, ToolId } from '../adapters/types.js';

export interface ManagedAssetRecord {
  id: string;
  destination: string;
}

export interface PipelineManifest {
  schemaVersion: number;
  projectName: string;
  tool: ToolId;
  stack?: StackId;
  features: FeatureId[];
  templateVersion: string;
  packageName: string;
  managedAssets: ManagedAssetRecord[];
}
