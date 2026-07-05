import { loadToolRegistry } from '../../adapters/registry.js';
import { hasExistingKnowledgeDirectory } from '../../knowledge/dirs.js';
import { readManifest } from '../../manifest/io.js';
import { checkManifestVersion } from '../../manifest/versionCheck.js';
import { resolvePackageRoot } from '../../runtime/resolvePackageRoot.js';
import { buildInstallPlan } from '../../init/buildInstallPlan.js';
import { executeInstallPlan } from '../../init/executeInstallPlan.js';
import { resolveInstallConflicts } from '../../init/resolveInstallConflicts.js';
import { ensureUpgradeVersionCheck } from '../../upgrade/versionPrompt.js';
import path from 'node:path';
import type { DecisionRecord } from '../types.js';
import type { AgentContext, AgentResult } from './types.js';

export const upgradeAgentHandler = async (
  ctx: AgentContext,
): Promise<AgentResult> => {
  let tokensUsed = 0;
  let toolCalls = 0;
  const decisions: DecisionRecord[] = [];

  try {
    const targetDir = path.resolve(
      (ctx.options.dir as string) ?? ctx.targetDir,
    );
    const force = Boolean(ctx.options.force);
    const dryRun = Boolean(ctx.options.dryRun);
    const yes = Boolean(ctx.options.yes);

    const manifestResult = await readManifest(targetDir);
    toolCalls++;
    if (!manifestResult) {
      throw new Error('No manifest found for upgrade. Run init first.');
    }

    const versionCheck = checkManifestVersion(
      manifestResult.manifest.templateVersion,
    );
    await ensureUpgradeVersionCheck(versionCheck, { yes, dryRun });

    decisions.push({
      id: `upgrade-version-${Date.now()}`,
      phase: ctx.state?.currentPhase ?? 'pre_pipeline',
      type: versionCheck.status === 'current' ? ('C' as const) : ('A' as const),
      context: `Template version check: ${versionCheck.status}`,
      choice: 'proceed',
      reason: `Manifest version ${versionCheck.status} vs current package`,
      timestamp: new Date().toISOString(),
    });

    const rootDir = await resolvePackageRoot(import.meta.url);
    const registry = await loadToolRegistry(rootDir);
    toolCalls += 2;

    const plan = await buildInstallPlan({
      rootDir,
      targetDir,
      projectName: manifestResult.manifest.projectName,
      tool: manifestResult.manifest.tool,
      features: manifestResult.manifest.features,
      dryRun,
      force,
      mode: 'upgrade',
      managedAssets: manifestResult.manifest.managedAssets,
      allowUpgradeAdoption: !(await hasExistingKnowledgeDirectory(targetDir)),
      registry,
    });

    const resolvedPlan = await resolveInstallConflicts(plan, { yes, force });
    await executeInstallPlan(resolvedPlan);
    toolCalls++;

    return {
      success: true,
      output: {
        targetDir,
        versionCheck,
        fileCount: plan.files.length,
        dryRun,
      },
      tokensUsed,
      toolCalls,
      decisions,
    };
  } catch (error: unknown) {
    return {
      success: false,
      output: null,
      error: error instanceof Error ? error.message : String(error),
      tokensUsed,
      toolCalls,
      decisions,
    };
  }
};