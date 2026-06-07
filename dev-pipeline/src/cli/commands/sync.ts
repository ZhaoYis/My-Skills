import path from 'node:path';
import { loadToolRegistry } from '../../core/adapters/registry.js';
import { readManifest } from '../../core/manifest/io.js';
import { resolvePackageRoot } from '../../core/runtime/resolvePackageRoot.js';
import { buildInstallPlan } from '../../core/init/buildInstallPlan.js';
import { executeInstallPlan } from '../../core/init/executeInstallPlan.js';
import type { InitOptions } from '../../core/prompts/types.js';

export async function runSyncCommand(options: InitOptions): Promise<void> {
  const targetDir = path.resolve(options.dir ?? process.cwd());
  const result = await readManifest(targetDir);
  if (!result) {
    throw new Error('No manifest found for sync. Run init first.');
  }

  const rootDir = await resolvePackageRoot(import.meta.url);
  const registry = await loadToolRegistry(rootDir);
  const plan = await buildInstallPlan({
    rootDir,
    targetDir,
    projectName: result.manifest.projectName,
    tool: result.manifest.tool,
    features: result.manifest.features,
    dryRun: Boolean(options.dryRun),
    force: Boolean(options.force),
    mode: 'sync',
    managedAssets: result.manifest.managedAssets,
    registry
  });

  await executeInstallPlan(plan);
}
