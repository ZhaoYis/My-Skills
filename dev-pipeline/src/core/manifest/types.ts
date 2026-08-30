import type { DocLanguage, FeatureId, InstallScope, StackId, ToolId } from '../adapters/types.js';

export interface ManagedAssetRecord {
  id: string;
  destination: string;
  /** Tool attribution for this asset. Undefined means the asset is tool-agnostic/shared
   *  (e.g. README.md, openspec/config.yaml) and stays after any single-tool uninstall. */
  tool?: ToolId;
}

export interface PipelineManifest {
  schemaVersion: number;
  projectName: string;
  /** Primary/active tool. Kept for backward compatibility with legacy manifests and
   *  single-tool consumers (e.g. `opsx-dev-pipeline sync` when only one tool is installed).
   *  When multiple tools are installed, prefer `tools` as the source of truth. */
  tool?: ToolId;
  /** All tools currently installed in this project. Empty for legacy manifests
   *  that haven't been migrated yet (the reader fills it from `tool`). */
  tools: ToolId[];
  stack?: StackId;
  techStack?: string;
  language?: DocLanguage;
  features: FeatureId[];
  scope?: InstallScope;
  templateVersion: string;
  packageName: string;
  managedAssets: ManagedAssetRecord[];
}
