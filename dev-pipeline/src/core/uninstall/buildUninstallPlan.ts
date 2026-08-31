import path from 'node:path';
import fs from 'fs-extra';
import type { ToolId } from '../adapters/types.js';
import { findAssetDefinition, resolveFileWritePolicy } from '../init/fileWritePolicy.js';
import { assertPathWithinBase } from '../init/sanitizeInput.js';
import type { ManifestReadResult } from '../manifest/io.js';
import type { ManagedAssetRecord } from '../manifest/types.js';
import { inferInstallKind } from './inferInstallKind.js';
import type { UninstallFile, UninstallPlan } from './types.js';

export interface BuildUninstallPlanInput {
  targetDir: string;
  manifestResult: ManifestReadResult;
  dryRun: boolean;
  yes: boolean;
  /**
   * When provided, only assets owned by this tool (or shared assets when this is the
   * only/last tool) are scheduled for removal. When omitted, every managed asset is
   * scheduled — including shared ones — to fully clean up the project.
   */
  tool?: ToolId;
}

/** Returns true when the asset should be removed by the given uninstall scope. */
function shouldRemoveAsset(
  asset: ManagedAssetRecord,
  tool: ToolId | undefined,
  installedTools: ToolId[],
): boolean {
  if (!tool) return true;
  // Assets explicitly tagged with another tool are out of scope.
  if (asset.tool && asset.tool !== tool) return false;
  // Shared assets (no `tool` field) are only removed when this uninstall wipes the
  // last remaining tool, otherwise they stay for the surviving tools.
  if (!asset.tool) {
    const remainingTools = installedTools.filter((entry) => entry !== tool);
    return remainingTools.length === 0;
  }
  return true;
}

export async function buildUninstallPlan(input: BuildUninstallPlanInput): Promise<UninstallPlan> {
  const installedTools = input.manifestResult.manifest.tools;
  const scopedAssets = input.manifestResult.manifest.managedAssets.filter((asset) =>
    shouldRemoveAsset(asset, input.tool, installedTools),
  );

  const files = await Promise.all(
    scopedAssets.map(async (asset): Promise<UninstallFile> => {
      // Validate that the destination stays within the target directory (path traversal guard).
      // Skip for user-scope destinations (absolute paths outside the project directory).
      if (!path.isAbsolute(asset.destination)) {
        assertPathWithinBase(input.targetDir, asset.destination);
      }
      const destinationPath = path.isAbsolute(asset.destination)
        ? asset.destination
        : path.join(input.targetDir, asset.destination);
      const exists = await fs.pathExists(destinationPath);
      const kind = inferInstallKind(asset.id);
      const appendable =
        resolveFileWritePolicy(findAssetDefinition(asset.id), { kind, destinationPath }, 'init')
          .appendStrategy !== 'none';

      return {
        assetId: asset.id,
        destinationPath,
        exists,
        appendable,
        resolution: !exists ? 'skip' : input.yes ? 'remove' : 'unresolved',
      };
    }),
  );

  return {
    targetDir: input.targetDir,
    // `tool` doubles as the uninstall-scope flag: undefined means "remove everything";
    // a defined value means "remove only assets owned by this tool (plus shared ones
    // when this is the last remaining tool)".
    tool: input.tool,
    files,
    dryRun: input.dryRun,
    manifestPath: input.manifestResult.path,
    manifestStorage: input.manifestResult.storage,
  };
}
