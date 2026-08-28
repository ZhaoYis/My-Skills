import path from 'node:path';
import { loadToolRegistry } from '../../core/adapters/registry.js';
import { buildInstallPlan } from '../../core/init/buildInstallPlan.js';
import { executeInstallPlan } from '../../core/init/executeInstallPlan.js';
import { collectExistingLanguage } from '../../core/init/resolveExistingLanguage.js';
import { resolveInstallConflicts } from '../../core/init/resolveInstallConflicts.js';
import { readManifest } from '../../core/manifest/io.js';
import type { InitOptions } from '../../core/prompts/types.js';
import { resolvePackageRoot } from '../../core/runtime/resolvePackageRoot.js';
import { resolveTechStackId } from '../../core/tech-stack/registry.js';

export async function runSyncCommand(options: InitOptions): Promise<void> {
  const targetDir = path.resolve(options.dir ?? process.cwd());
  const result = await readManifest(targetDir);
  if (!result) {
    throw new Error('No manifest found for sync. Run init first.');
  }
  const languageSelection = await collectExistingLanguage(targetDir, options, result.manifest);
  const managedAssets = languageSelection.configNeedsUpdate
    ? [
        ...result.manifest.managedAssets,
        { id: 'stack-config', destination: 'openspec/config.yaml' },
      ]
    : result.manifest.managedAssets;

  const rootDir = await resolvePackageRoot(import.meta.url);
  const registry = await loadToolRegistry(rootDir);
  const plan = await buildInstallPlan({
    rootDir,
    targetDir,
    projectName: result.manifest.projectName,
    tool: result.manifest.tool,
    stack: result.manifest.stack,
    techStack: result.manifest.techStack
      ? resolveTechStackId(result.manifest.techStack)
      : undefined,
    language: languageSelection.language,
    features: result.manifest.features,
    scope: result.manifest.scope ?? 'project',
    dryRun: Boolean(options.dryRun),
    force: Boolean(options.force),
    mode: 'sync',
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
