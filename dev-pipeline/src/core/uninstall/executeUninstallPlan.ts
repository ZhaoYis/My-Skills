import path from 'node:path';
import fs from 'fs-extra';
import pc from 'picocolors';
import { readManifest, removeManifest, writeManifest } from '../manifest/io.js';
import { PACKAGE_NAME, TEMPLATE_VERSION } from '../runtime/meta.js';
import type { UninstallPlan } from './types.js';

async function removeEmptyParentDirectories(
  targetDir: string,
  removedFilePaths: string[],
): Promise<void> {
  const parentDirs = new Set(removedFilePaths.map((filePath) => path.dirname(filePath)));

  const sortedParents = Array.from(parentDirs).sort((left, right) => right.length - left.length);

  for (const parentDir of sortedParents) {
    if (!parentDir.startsWith(targetDir) || parentDir === targetDir) {
      continue;
    }

    try {
      const entries = await fs.readdir(parentDir);
      if (entries.length === 0) {
        await fs.rmdir(parentDir);
      }
    } catch {
      // ignore races or non-empty directories
    }
  }
}

async function updateManifestAfterUninstall(plan: UninstallPlan): Promise<void> {
  const manifestResult = await readManifest(plan.targetDir);
  if (!manifestResult) {
    return;
  }

  const removedAssetIds = new Set(
    plan.files.filter((file) => file.resolution === 'remove').map((file) => file.assetId),
  );
  const remainingAssets = manifestResult.manifest.managedAssets.filter(
    (asset) => !removedAssetIds.has(asset.id),
  );

  if (remainingAssets.length === 0) {
    await removeManifest(plan.targetDir, plan.manifestStorage);
    return;
  }

  await writeManifest(plan.targetDir, {
    ...manifestResult.manifest,
    templateVersion: TEMPLATE_VERSION,
    managedAssets: remainingAssets,
  });
}

export async function executeUninstallPlan(plan: UninstallPlan): Promise<void> {
  const filesToRemove = plan.files.filter((file) => file.resolution === 'remove');
  const filesToSkip = plan.files.filter((file) => file.resolution === 'skip');

  if (plan.dryRun) {
    console.log(pc.cyan('Dry run: the following managed files would be removed:'));
    for (const file of filesToRemove) {
      console.log(`- ${path.relative(plan.targetDir, file.destinationPath)}`);
    }

    const manifestResult = await readManifest(plan.targetDir);
    const removedAssetIds = new Set(filesToRemove.map((file) => file.assetId));
    const remainingAssets =
      manifestResult?.manifest.managedAssets.filter((asset) => !removedAssetIds.has(asset.id)) ??
      [];

    if (remainingAssets.length === 0) {
      console.log(pc.cyan('Manifest would be removed after file cleanup.'));
    } else {
      console.log(
        pc.cyan(`Manifest would be updated to keep ${remainingAssets.length} managed asset(s).`),
      );
    }

    return;
  }

  const removedPaths: string[] = [];

  for (const file of filesToRemove) {
    if (!(await fs.pathExists(file.destinationPath))) {
      continue;
    }

    await fs.remove(file.destinationPath);
    removedPaths.push(file.destinationPath);
  }

  await removeEmptyParentDirectories(plan.targetDir, removedPaths);
  await updateManifestAfterUninstall(plan);

  console.log(pc.green(`Uninstalled ${PACKAGE_NAME} managed files.`));
  console.log(`- removed: ${filesToRemove.length}`);
  console.log(`- skipped: ${filesToSkip.length}`);
}
