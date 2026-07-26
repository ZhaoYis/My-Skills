import type { FeatureId, StackId, ToolId } from '../adapters/types.js';

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
  stacks?: StackId[];
  includeExtensions?: string[];
  templateFiles?: string[];
  excludePatterns?: string[];
  /** Replace a file generated earlier in the init workflow, then manage it normally. */
  replaceOnInit?: boolean;
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
