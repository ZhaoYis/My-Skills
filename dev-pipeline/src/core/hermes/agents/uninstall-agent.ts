import { buildUninstallPlan } from '../../uninstall/buildUninstallPlan.js';
import { executeUninstallPlan } from '../../uninstall/executeUninstallPlan.js';
import { resolveUninstallConflicts } from '../../uninstall/resolveUninstallConflicts.js';
import { readManifest } from '../../manifest/io.js';
import path from 'node:path';
import type { DecisionRecord } from '../types.js';
import type { AgentContext, AgentResult } from './types.js';

export const uninstallAgentHandler = async (
  ctx: AgentContext,
): Promise<AgentResult> => {
  let tokensUsed = 0;
  let toolCalls = 0;
  const decisions: DecisionRecord[] = [];

  try {
    const targetDir = path.resolve(
      (ctx.options.dir as string) ?? ctx.targetDir,
    );
    const yes = Boolean(ctx.options.yes);
    const dryRun = Boolean(ctx.options.dryRun);
    const keepKnowledge = Boolean(ctx.options.keepKnowledge);

    const manifestResult = await readManifest(targetDir);
    toolCalls++;
    if (!manifestResult) {
      throw new Error(
        'No manifest found for uninstall. Nothing to remove.',
      );
    }

    const plan = await buildUninstallPlan({
      targetDir,
      manifestResult,
      dryRun,
      yes,
      keepKnowledge,
    });

    if (plan.files.length === 0) {
      throw new Error('No managed files matched the uninstall plan.');
    }

    decisions.push({
      id: `uninstall-${Date.now()}`,
      phase: ctx.state?.currentPhase ?? 'terminated',
      type: 'A' as const,
      context: `Removing ${plan.files.length} managed files${keepKnowledge ? ' (keeping .knowledge)' : ''}`,
      choice: 'proceed',
      reason: 'Agent executing uninstall',
      timestamp: new Date().toISOString(),
    });

    const resolvedPlan = await resolveUninstallConflicts(plan, { yes });
    await executeUninstallPlan(resolvedPlan);
    toolCalls++;

    return {
      success: true,
      output: {
        targetDir,
        fileCount: plan.files.length,
        dryRun,
        keepKnowledge,
      },
      tokensUsed,
      toolCalls,
      decisions,
      suggestedNextPhase: 'terminated',
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