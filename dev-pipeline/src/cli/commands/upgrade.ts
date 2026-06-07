import fs from 'fs-extra';
import path from 'node:path';
import { loadToolRegistry } from '../../core/adapters/registry.js';
import { readManifest } from '../../core/manifest/io.js';
import { resolvePackageRoot } from '../../core/runtime/resolvePackageRoot.js';
import { buildInstallPlan } from '../../core/init/buildInstallPlan.js';
import { executeInstallPlan } from '../../core/init/executeInstallPlan.js';
import { resolveInstallConflicts } from '../../core/init/resolveInstallConflicts.js';
import type { InitOptions } from '../../core/prompts/types.js';

const knowledgeDirCandidates = ['.knowledge', 'docs/knowledge', 'knowledge', 'docs/domain'] as const;

async function hasExistingKnowledgeDirectory(targetDir: string): Promise<boolean> {
  for (const candidate of knowledgeDirCandidates) {
    if (await fs.pathExists(path.join(targetDir, candidate))) {
      return true;
    }
  }

  return false;
}

export async function runUpgradeCommand(options: InitOptions): Promise<void> {
  const targetDir = path.resolve(options.dir ?? process.cwd());
  const result = await readManifest(targetDir);
  if (!result) {
    throw new Error('No manifest found for upgrade. Run init first.');
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
    mode: 'upgrade',
    managedAssets: result.manifest.managedAssets,
    allowUpgradeAdoption: !(await hasExistingKnowledgeDirectory(targetDir)),
    registry
  });
  const resolvedPlan = await resolveInstallConflicts(plan, {
    yes: Boolean(options.yes),
    force: Boolean(options.force)
  });

  await executeInstallPlan(resolvedPlan);
}
