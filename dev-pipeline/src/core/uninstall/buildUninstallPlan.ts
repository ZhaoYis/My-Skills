import fs from 'fs-extra';
import path from 'node:path';
import { isAppendableInstallFile } from '../init/isAppendableInstallFile.js';
import type { ManifestReadResult } from '../manifest/io.js';
import { inferInstallKind } from './inferInstallKind.js';
import type { UninstallFile, UninstallPlan } from './types.js';

function isKnowledgeAsset(assetId: string, destination: string): boolean {
  return (
    assetId.startsWith('common-knowledge-skeleton:') ||
    destination === '.knowledge' ||
    destination.startsWith('.knowledge/')
  );
}

export interface BuildUninstallPlanInput {
  targetDir: string;
  manifestResult: ManifestReadResult;
  dryRun: boolean;
  yes: boolean;
  keepKnowledge: boolean;
}

export async function buildUninstallPlan(input: BuildUninstallPlanInput): Promise<UninstallPlan> {
  const files = await Promise.all(
    input.manifestResult.manifest.managedAssets
      .filter((asset) => !(input.keepKnowledge && isKnowledgeAsset(asset.id, asset.destination)))
      .map(async (asset): Promise<UninstallFile> => {
        const destinationPath = path.join(input.targetDir, asset.destination);
        const exists = await fs.pathExists(destinationPath);
        const kind = inferInstallKind(asset.id);
        const appendable = isAppendableInstallFile({ kind, destinationPath });

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
    keepKnowledge: input.keepKnowledge,
    manifestPath: input.manifestResult.path,
    manifestStorage: input.manifestResult.storage,
  };
}
