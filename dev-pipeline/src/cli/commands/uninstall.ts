import path from 'node:path';
import { readManifest } from '../../core/manifest/io.js';
import { buildUninstallPlan } from '../../core/uninstall/buildUninstallPlan.js';
import { executeUninstallPlan } from '../../core/uninstall/executeUninstallPlan.js';
import { resolveUninstallConflicts } from '../../core/uninstall/resolveUninstallConflicts.js';
import type { UninstallOptions } from '../../core/uninstall/types.js';

export async function runUninstallCommand(options: UninstallOptions): Promise<void> {
  const targetDir = path.resolve(options.dir ?? process.cwd());
  const manifestResult = await readManifest(targetDir);

  if (!manifestResult) {
    throw new Error('No manifest found for uninstall. Nothing to remove.');
  }

  if (options.tool && !manifestResult.manifest.tools.includes(options.tool)) {
    const installed = manifestResult.manifest.tools.join(', ') || '(none recorded)';
    throw new Error(
      `Tool "${options.tool}" is not installed in this project. Installed tools: ${installed}.`,
    );
  }

  const plan = await buildUninstallPlan({
    targetDir,
    manifestResult,
    dryRun: Boolean(options.dryRun),
    yes: Boolean(options.yes),
    tool: options.tool,
  });

  if (plan.files.length === 0) {
    throw new Error(
      options.tool
        ? `No managed files matched tool "${options.tool}".`
        : 'No managed files matched the uninstall plan.',
    );
  }

  const resolvedPlan = await resolveUninstallConflicts(plan, {
    yes: Boolean(options.yes),
  });

  await executeUninstallPlan(resolvedPlan);
}
