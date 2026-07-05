import { loadToolRegistry } from '../../adapters/registry.js';
import { resolvePackageRoot } from '../../runtime/resolvePackageRoot.js';
import { buildInstallPlan } from '../../init/buildInstallPlan.js';
import { collectInputs } from '../../init/collectInputs.js';
import { executeInstallPlan } from '../../init/executeInstallPlan.js';
import { resolveInstallConflicts } from '../../init/resolveInstallConflicts.js';
import { validateTarget } from '../../init/validateTarget.js';
import path from 'node:path';
import type { ToolId } from '../../adapters/types.js';
import type { DecisionRecord } from '../types.js';
import type { AgentContext, AgentResult } from './types.js';

export const initAgentHandler = async (
  ctx: AgentContext,
): Promise<AgentResult> => {
  let tokensUsed = 0;
  let toolCalls = 0;
  const decisions: DecisionRecord[] = [];

  try {
    const rootDir = await resolvePackageRoot(import.meta.url);
    const targetDir = path.resolve(
      (ctx.options.dir as string) ?? ctx.targetDir,
    );
    const registry = await loadToolRegistry(rootDir);
    toolCalls += 2;

    const tool = ctx.options.tool as ToolId | undefined;
    if (tool && !registry.has(tool)) {
      throw new Error(
        `Unsupported tool: ${tool}. Run "opsx-dev-pipeline list-tools" to see supported ids.`,
      );
    }

    const force = Boolean(ctx.options.force);
    const dryRun = Boolean(ctx.options.dryRun);
    const yes = Boolean(ctx.options.yes);

    const validation = await validateTarget(targetDir, registry);
    toolCalls++;

    if (
      validation.existingEntries.length > 0 &&
      !force &&
      !dryRun
    ) {
      decisions.push({
        id: `init-existing-${Date.now()}`,
        phase: ctx.state?.currentPhase ?? 'pre_pipeline',
        type: 'A' as const,
        context: `Target directory has existing entries: ${validation.existingEntries.join(', ')}`,
        choice: force ? 'force-overwrite' : 'warn-only',
        reason: 'Non-empty target directory detected',
        timestamp: new Date().toISOString(),
      });
    }

    const answers = await collectInputs(
      targetDir,
      {
        ...ctx.options,
        tool: (tool ?? validation.suggestedTool) as ToolId,
      },
      registry,
    );
    toolCalls += 1;

    decisions.push({
      id: `init-tool-${Date.now()}`,
      phase: 'pre_pipeline',
      type: 'B',
      context: `Selected tool: ${answers.tool}, features: ${answers.features.join(', ')}`,
      choice: answers.tool,
      reason: 'Agent selected tool based on user input or auto-detection',
      timestamp: new Date().toISOString(),
    });

    const plan = await buildInstallPlan({
      rootDir,
      targetDir,
      projectName: answers.projectName,
      tool: answers.tool,
      features: answers.features,
      dryRun,
      force,
      mode: 'init',
      registry,
    });

    const resolvedPlan = await resolveInstallConflicts(plan, {
      yes,
      force,
    });

    await executeInstallPlan(resolvedPlan);
    toolCalls++;

    return {
      success: true,
      output: {
        projectName: answers.projectName,
        tool: answers.tool,
        features: answers.features,
        targetDir,
        dryRun,
        fileCount: plan.files.length,
      },
      tokensUsed,
      toolCalls,
      decisions,
      suggestedNextPhase: 'phase0_entrance',
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