import type { ToolId } from '../adapters/types.js';
import type { ManifestStorage } from '../manifest/io.js';

export type UninstallResolution = 'remove' | 'skip' | 'unresolved';

export interface UninstallFile {
  assetId: string;
  destinationPath: string;
  exists: boolean;
  appendable: boolean;
  resolution: UninstallResolution;
}

export interface UninstallPlan {
  targetDir: string;
  /** Uninstall scope. Undefined = full uninstall (every asset). Defined = scoped to
   *  the given tool (the tool's tagged assets plus shared ones only when it's last). */
  tool?: ToolId;
  files: UninstallFile[];
  dryRun: boolean;
  manifestPath: string;
  manifestStorage: ManifestStorage;
}

export interface UninstallOptions {
  dir?: string;
  dryRun?: boolean;
  yes?: boolean;
  /** When set, only assets owned by this tool (plus shared assets when it's the last
   *  tool) are removed. Defaults to removing every managed asset. */
  tool?: ToolId;
}

export interface ResolveUninstallConflictsOptions {
  yes: boolean;
}

export type UninstallBulkAction = 'remove-all' | 'skip-all';
