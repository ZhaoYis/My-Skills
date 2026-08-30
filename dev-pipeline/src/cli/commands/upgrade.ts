import path from 'node:path';
import { loadToolRegistry } from '../../core/adapters/registry.js';
import type { ToolId } from '../../core/adapters/types.js';
import { buildInstallPlan } from '../../core/init/buildInstallPlan.js';
import { executeInstallPlan } from '../../core/init/executeInstallPlan.js';
import { collectExistingLanguage } from '../../core/init/resolveExistingLanguage.js';
import { resolveInstallConflicts } from '../../core/init/resolveInstallConflicts.js';
import { readManifest } from '../../core/manifest/io.js';
import type { ManagedAssetRecord } from '../../core/manifest/types.js';
import { checkManifestVersion } from '../../core/manifest/versionCheck.js';
import type { InitOptions } from '../../core/prompts/types.js';
import { resolvePackageRoot } from '../../core/runtime/resolvePackageRoot.js';
import { resolveTechStackId } from '../../core/tech-stack/registry.js';
import { refreshUpgradeFingerprints } from '../../core/upgrade/refreshFingerprints.js';
import { ensureUpgradeVersionCheck } from '../../core/upgrade/versionPrompt.js';

function installedTools(manifest: { tools: ToolId[]; tool?: ToolId }): ToolId[] {
  if (manifest.tools.length > 0) return manifest.tools;
  return manifest.tool ? [manifest.tool] : [];
}

function scopedManagedAssets(assets: ManagedAssetRecord[], tool: ToolId): ManagedAssetRecord[] {
  return assets.filter((asset) => !asset.tool || asset.tool === tool);
}

export async function runUpgradeCommand(options: InitOptions): Promise<void> {
  const targetDir = path.resolve(options.dir ?? process.cwd());
  const result = await readManifest(targetDir);
  if (!result) {
    throw new Error('No manifest found for upgrade. Run init first.');
  }
  const languageSelection = await collectExistingLanguage(targetDir, options, result.manifest);

  const versionCheck = checkManifestVersion(result.manifest.templateVersion);
  await ensureUpgradeVersionCheck(versionCheck, {
    yes: Boolean(options.yes),
    dryRun: Boolean(options.dryRun),
  });

  const toolsToUpgrade = installedTools(result.manifest);
  if (toolsToUpgrade.length === 0) {
    throw new Error(
      'Manifest does not list any installed tools. Re-run `opsx-dev-pipeline init` to repair.',
    );
  }

  const rootDir = await resolvePackageRoot(import.meta.url);
  const registry = await loadToolRegistry(rootDir);

  for (const tool of toolsToUpgrade) {
    const managedAssets = scopedManagedAssets(
      languageSelection.configNeedsUpdate
        ? [
            ...result.manifest.managedAssets,
            { id: 'stack-config', destination: 'openspec/config.yaml' },
          ]
        : result.manifest.managedAssets,
      tool,
    );

    const plan = await buildInstallPlan({
      rootDir,
      targetDir,
      projectName: result.manifest.projectName,
      tool,
      stack: result.manifest.stack,
      techStack: result.manifest.techStack
        ? resolveTechStackId(result.manifest.techStack)
        : undefined,
      language: languageSelection.language,
      features: result.manifest.features,
      scope: result.manifest.scope ?? 'project',
      dryRun: Boolean(options.dryRun),
      force: Boolean(options.force),
      mode: 'upgrade',
      languageConfigUpdate: languageSelection.configNeedsUpdate,
      managedAssets,
      registry,
    });
    if (languageSelection.configNeedsUpdate) {
      const configFile = plan.files.find((file) => file.assetId === 'stack-config');
      if (configFile?.exists) {
        configFile.resolution = 'append';
      }
    }
    const resolvedPlan = await resolveInstallConflicts(plan, {
      yes: Boolean(options.yes),
      force: Boolean(options.force),
    });

    await executeInstallPlan(resolvedPlan);
  }

  await refreshUpgradeFingerprints({
    rootDir,
    targetDir,
    dryRun: Boolean(options.dryRun),
  });
}
