import path from 'node:path';
import fs from 'fs-extra';
import { findAssetDefinition, resolveFileWritePolicy } from '../init/fileWritePolicy.js';
import { assertPathWithinBase } from '../init/sanitizeInput.js';
import type { ManifestReadResult } from '../manifest/io.js';
import { inferInstallKind } from './inferInstallKind.js';
import type { UninstallFile, UninstallPlan } from './types.js';

export interface BuildUninstallPlanInput {
  targetDir: string;
  manifestResult: ManifestReadResult;
  dryRun: boolean;
  yes: boolean;
}

export async function buildUninstallPlan(input: BuildUninstallPlanInput): Promise<UninstallPlan> {
  const files = await Promise.all(
    input.manifestResult.manifest.managedAssets.map(async (asset): Promise<UninstallFile> => {
      // Validate that the destination stays within the target directory (path traversal guard)
      assertPathWithinBase(input.targetDir, asset.destination);
      const destinationPath = path.join(input.targetDir, asset.destination);
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
    tool: input.manifestResult.manifest.tool,
    files,
    dryRun: input.dryRun,
    manifestPath: input.manifestResult.path,
    manifestStorage: input.manifestResult.storage,
  };
}
