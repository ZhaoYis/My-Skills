import type { FeatureId, StackId, ToolId } from '../adapters/types.js';

export type AssetKind = 'template' | 'static' | 'bundle';
export type AssetScope = 'common' | 'tool';
export type InstallMode = 'init' | 'sync' | 'upgrade';
export type AppendStrategy = 'none' | 'simple' | 'config-merge';
export type ExistingFileAction = 'prompt' | 'overwrite' | 'skip';

export interface FileWritePolicy {
  appendStrategy?: AppendStrategy;
  appendBasenames?: string[];
  appendExtensions?: string[];
  onConflict?: Partial<Record<InstallMode, ExistingFileAction>>;
}

export interface ResolvedFileWritePolicy {
  appendStrategy: AppendStrategy;
  onConflict: ExistingFileAction;
}

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
  writePolicy?: FileWritePolicy;
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
  appendStrategy: AppendStrategy;
  resolution: InstallConflictResolution;
}
