import path from 'node:path';
import { buildUninstallPlan } from '../../core/uninstall/buildUninstallPlan.js';
import { executeUninstallPlan } from '../../core/uninstall/executeUninstallPlan.js';
import { resolveUninstallConflicts } from '../../core/uninstall/resolveUninstallConflicts.js';
import type { UninstallOptions } from '../../core/uninstall/types.js';
import { readManifest } from '../../core/manifest/io.js';

export async function runUninstallCommand(options: UninstallOptions): Promise<void> {
  const targetDir = path.resolve(options.dir ?? process.cwd());
  const manifestResult = await readManifest(targetDir);

  if (!manifestResult) {
    throw new Error('No manifest found for uninstall. Nothing to remove.');
  }

  const plan = await buildUninstallPlan({
    targetDir,
    manifestResult,
    dryRun: Boolean(options.dryRun),
    yes: Boolean(options.yes),
  });

  if (plan.files.length === 0) {
    throw new Error('No managed files matched the uninstall plan.');
  }

  const resolvedPlan = await resolveUninstallConflicts(plan, {
    yes: Boolean(options.yes),
  });

  await executeUninstallPlan(resolvedPlan);
}
