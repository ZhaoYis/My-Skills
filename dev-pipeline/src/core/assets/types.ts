import type { FeatureId, ToolId } from '../adapters/types.js';

export type AssetKind = 'template' | 'static';
export type AssetScope = 'common' | 'tool';

export interface AssetDefinition {
  id: string;
  kind: AssetKind;
  scope: AssetScope;
  feature: FeatureId;
  source: string;
  destination: string;
  tools?: ToolId[];
}

export interface InstallFile {
  assetId: string;
  sourcePath: string;
  destinationPath: string;
  kind: AssetKind;
}
