import type { FeatureId, ToolId } from '../adapters/types.js';

export type AssetKind = 'template' | 'static' | 'bundle';
export type AssetScope = 'common' | 'tool';

export interface AssetDefinition {
  id: string;
  kind: AssetKind;
  scope: AssetScope;
  feature: FeatureId;
  source: string;
  destination: string;
  tools?: ToolId[];
  includeExtensions?: string[];
  templateFiles?: string[];
  excludePatterns?: string[];
}

export interface InstallFile {
  assetId: string;
  sourcePath: string;
  destinationPath: string;
  kind: 'template' | 'static';
}
