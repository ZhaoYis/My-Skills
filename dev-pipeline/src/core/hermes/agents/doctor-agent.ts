import { checkKnowledgeHealth } from '../../doctor/checkKnowledgeHealth.js';
import { checkStackHealth } from '../../doctor/checkStackHealth.js';
import { applyKnowledgeHealthHistory } from '../../doctor/healthHistory.js';
import { readManifest } from '../../manifest/io.js';
import {
  checkManifestVersion,
  mergeHealthStatus,
} from '../../manifest/versionCheck.js';
import path from 'node:path';
import type { DecisionRecord } from '../types.js';
import type { AgentContext, AgentResult } from './types.js';
import type { HealthStatus, KnowledgeHealthReport } from '../../doctor/types.js';
import type { ManifestVersionCheck } from '../../manifest/versionCheck.js';

export const doctorAgentHandler = async (
  ctx: AgentContext,
): Promise<AgentResult> => {
  let tokensUsed = 0;
  let toolCalls = 0;
  const decisions: DecisionRecord[] = [];

  try {
    const targetDir = path.resolve(
      (ctx.options.dir as string) ?? ctx.targetDir,
    );
    const history = Boolean(ctx.options.history);
    const staleDays =
      typeof ctx.options.staleDays === 'number'
        ? ctx.options.staleDays
        : undefined;
    const stackOnly = Boolean(ctx.options.stackOnly);

    // Stack-only mode
    if (stackOnly) {
      const stackResult = await checkStackHealth(targetDir);
      toolCalls++;
      const status: HealthStatus = stackResult.valid ? 'ok' : 'fail';
      return {
        success: stackResult.valid,
        output: { mode: 'stack', ...stackResult },
        tokensUsed,
        toolCalls,
        decisions,
      };
    }

    // Full health check
    const manifestResult = await readManifest(targetDir);
    toolCalls++;

    let knowledgeReport: KnowledgeHealthReport | undefined;
    let versionCheck: ManifestVersionCheck | null = null;

    if (manifestResult) {
      knowledgeReport = await checkKnowledgeHealth(
        targetDir,
        manifestResult.manifest.managedAssets,
        { staleDays },
      );
      toolCalls++;

      if (history) {
        await applyKnowledgeHealthHistory(targetDir, knowledgeReport, {
          persist: true,
        });
        toolCalls++;
      }

      versionCheck = checkManifestVersion(
        manifestResult.manifest.templateVersion,
      );
    }

    const status: HealthStatus = mergeHealthStatus(
      knowledgeReport?.status ?? 'warn',
      versionCheck?.status === 'outdated' ? 'warn' : 'ok',
    );

    if (status === 'fail' || status === 'warn') {
      decisions.push({
        id: `doctor-${Date.now()}`,
        phase: ctx.state?.currentPhase ?? 'pre_pipeline',
        type: 'B',
        context: `Health check status: ${status}. Score: ${knowledgeReport?.score?.value ?? 'N/A'}`,
        choice: status === 'fail' ? 'requires-action' : 'review-recommended',
        reason: `Doctor agent detected ${status === 'fail' ? 'issues' : 'warnings'}`,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      success: status !== 'fail',
      output: {
        status,
        score: knowledgeReport?.score,
        trend: knowledgeReport?.trend,
        versionCheck,
        hasManifest: !!manifestResult,
        checks: knowledgeReport?.checks,
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