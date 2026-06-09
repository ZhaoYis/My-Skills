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
  adoptOnUpgrade?: boolean;
  /** Bundle members that require an optional feature to be enabled. */
  bundleGatedFiles?: Array<{ path: string; feature: FeatureId }>;
}

export type InstallConflictResolution = 'none' | 'overwrite' | 'append' | 'skip' | 'unresolved';

export interface InstallFile {
  assetId: string;
  sourcePath: string;
  destinationPath: string;
  kind: 'template' | 'static';
  exists: boolean;
  appendable: boolean;
  resolution: InstallConflictResolution;
}
