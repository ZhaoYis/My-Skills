import path from 'node:path';
import pc from 'picocolors';
import { loadToolRegistry } from '../adapters/registry.js';
import type { InitOptions } from '../prompts/types.js';
import { PACKAGE_NAME } from '../runtime/meta.js';
import { resolvePackageRoot } from '../runtime/resolvePackageRoot.js';
import { buildInstallPlan } from './buildInstallPlan.js';
import { collectInputs } from './collectInputs.js';
import { executeInstallPlan } from './executeInstallPlan.js';
import { resolveInstallConflicts } from './resolveInstallConflicts.js';
import { validateTarget } from './validateTarget.js';

export async function runInit(options: InitOptions): Promise<void> {
  const rootDir = await resolvePackageRoot(import.meta.url);
  const targetDir = path.resolve(options.dir ?? process.cwd());
  const registry = await loadToolRegistry(rootDir);

  if (options.tool && !registry.has(options.tool)) {
    throw new Error(
      `Unsupported tool: ${options.tool}. Run "${PACKAGE_NAME} list-tools" to see supported ids.`,
    );
  }

  const validation = await validateTarget(targetDir, registry);

  if (validation.existingEntries.length > 0 && !options.force && !options.dryRun) {
    console.log(
      pc.yellow(`Target directory is not empty: ${validation.existingEntries.join(', ')}`),
    );
    console.log(pc.yellow('Use --force to allow overwriting managed files.'));
  }

  const answers = await collectInputs(
    targetDir,
    {
      ...options,
      tool: options.tool ?? validation.suggestedTool,
    },
    registry,
  );
  const plan = await buildInstallPlan({
    rootDir,
    targetDir,
    projectName: answers.projectName,
    tool: answers.tool,
    features: answers.features,
    dryRun: Boolean(options.dryRun),
    force: Boolean(options.force),
    mode: 'init',
    registry,
  });
  const resolvedPlan = await resolveInstallConflicts(plan, {
    yes: Boolean(options.yes),
    force: Boolean(options.force),
  });

  await executeInstallPlan(resolvedPlan);
}
