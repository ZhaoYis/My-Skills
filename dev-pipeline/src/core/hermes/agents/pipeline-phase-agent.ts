import fs from 'fs-extra';
import path from 'node:path';
import {
  getAllowedTransitions,
  getRecoveryBehavior,
  isTerminal,
  validateTransition,
} from '../state-machine.js';
import type { AgentContext, AgentResult } from './types.js';
import type { DecisionRecord, PipelinePhase } from '../types.js';

/**
 * The PipelinePhaseAgent handles a single pipeline phase execution.
 *
 * It reads the corresponding phase reference document (e.g. phase-1-propose.md)
 * and produces a structured result describing what the phase should do.
 *
 * In a real LLM-driven pipeline, this agent would:
 * 1. Read the phase reference document
 * 2. Read the current runtime state
 * 3. Read relevant decisions and skill memories
 * 4. Execute the phase logic (via LLM tool calls)
 * 5. Record decisions and suggest next phase
 *
 * For now, it serves as the structured entry point for each phase,
 * producing a detailed execution plan the orchestrator can act on.
 */

// ── Phase to Reference File Mapping ──

const PHASE_REFERENCE_MAP: ReadonlyMap<PipelinePhase, string> = new Map([
  ['pre_pipeline', 'phase-0-entrance.md'],
  ['phase0_entrance', 'phase-0-entrance.md'],
  ['phase1_propose', 'phase-1-propose.md'],
  ['phase2_apply', 'phase-2-apply.md'],
  ['phase3_review', 'phase-3-review.md'],
  ['phase3_fix', 'phase-3.1-fix-review.md'],
  ['phase4_archive', 'phase-4-archive.md'],
  ['phase5_unittest', 'phase-5-unit-tests.md'],
  ['phase6_push', 'phase-6-merge-push.md'],
  ['phase6_merge', 'phase-6-merge-push.md'],
  ['phase7_pr_created', 'phase-7-pr-ci.md'],
  ['phase7_ci_pending', 'phase-7-pr-ci.md'],
  ['phase7_ci_triage', 'phase-7-pr-ci.md'],
  ['phase7_pr_merge', 'phase-7-pr-ci.md'],
  ['completed', ''],
  ['terminated', ''],
]);

// ── Phase Descriptions (Chinese) ──

const PHASE_DESCRIPTIONS: ReadonlyMap<PipelinePhase, string> = new Map([
  ['pre_pipeline', '流水线入口：检查前置条件与运行时状态'],
  ['phase0_entrance', 'Phase 0 — 入口预检：确认 change、分支和交付模式'],
  ['phase1_propose', 'Phase 1 — 提案编写：基于分析结果编写 OpenSpec 提案'],
  ['phase2_apply', 'Phase 2 — 提案应用：将提案中的变更落地为代码'],
  ['phase3_review', 'Phase 3 — 代码审查：对变更进行规范、安全和逻辑审查'],
  ['phase3_fix', 'Phase 3.1 — 审查修复：根据审查意见修复问题'],
  ['phase4_archive', 'Phase 4 — 归档与验证：归档 change 并执行验证门禁'],
  ['phase5_unittest', 'Phase 5 — 单测门禁：运行单元测试检查'],
  ['phase6_push', 'Phase 6 — 推送：将变更推送到远程仓库'],
  ['phase6_merge', 'Phase 6 — 合并：将变更合并到目标分支'],
  ['phase7_pr_created', 'Phase 7 — PR 已创建：等待审查'],
  ['phase7_ci_pending', 'Phase 7 — CI 等待中：等待 CI 检查完成'],
  ['phase7_ci_triage', 'Phase 7 — CI 分诊：分析 CI 失败原因'],
  ['phase7_pr_merge', 'Phase 7 — PR 合并：执行 PR 合并'],
  ['completed', '流水线完成：所有阶段已执行完毕'],
  ['terminated', '流水线终止：用户中止或异常退出'],
]);

/**
 * Attempt to read the phase reference document from the templates directory.
 */
async function readPhaseReference(
  packageRoot: string,
  phase: PipelinePhase,
): Promise<string | null> {
  const refFile = PHASE_REFERENCE_MAP.get(phase);
  if (!refFile) return null;

  const refPath = path.join(
    packageRoot,
    'templates',
    'common',
    'skills',
    'opsx-dev-pipeline',
    'references',
    refFile,
  );

  if (await fs.pathExists(refPath)) {
    return fs.readFile(refPath, 'utf-8');
  }
  return null;
}

// ── Handler Implementation ──

export const pipelinePhaseAgentHandler = async (
  ctx: AgentContext,
): Promise<AgentResult> => {
  const startTime = new Date().toISOString();
  let tokensUsed = 0;
  let toolCalls = 0;
  const decisions: DecisionRecord[] = [];

  try {
    // Determine which phase to execute
    const phase =
      (ctx.options.phase as PipelinePhase) ??
      ctx.state?.currentPhase ??
      'pre_pipeline';

    if (isTerminal(phase)) {
      return {
        success: true,
        output: {
          phase,
          description: PHASE_DESCRIPTIONS.get(phase) ?? '',
          message: `Phase "${phase}" is terminal. No action needed.`,
        },
        tokensUsed,
        toolCalls,
        decisions,
      };
    }

    // Get recovery behavior
    const recoveryBehavior = getRecoveryBehavior(phase);

    // Get allowed next phases
    const allowedTransitions = getAllowedTransitions(phase);

    // Calculate suggested next phase (prefer the first non-terminated transition)
    const suggestedNextPhase = allowedTransitions.find(
      (t) => !isTerminal(t) && t !== 'terminated',
    );

    // Find relevant decisions from context
    const phaseDecisions = ctx.decisions.filter(
      (d) => d.phase === phase,
    );

    // Find relevant skill memories
    const phaseMemories = ctx.memories.filter((m) =>
      m.category.startsWith(phase),
    );

    // Compute a confidence score based on past success rate
    const totalSuccessRate = phaseMemories.length > 0
      ? phaseMemories.reduce((sum, m) => sum + m.successRate, 0) /
          phaseMemories.length
      : 0.5; // Default: neutral confidence

    // Build phase execution plan
    const executionPlan = {
      phase,
      description: PHASE_DESCRIPTIONS.get(phase) ?? '',
      recoveryBehavior,
      allowedTransitions,
      suggestedNextPhase,
      confidence: Math.round(totalSuccessRate * 100) / 100,
      pastDecisions: phaseDecisions.length,
      relevantMemories: phaseMemories.length,
      referenceAvailable: false as boolean,
    };

    // Check if reference document is available
    // Attempt to resolve package root from target directory
    const refContent = await readPhaseReference(
      path.resolve(ctx.targetDir, '../../'),
      phase,
    );
    toolCalls++;
    if (refContent) {
      executionPlan.referenceAvailable = true;
    }

    // If there are past failed decisions, lower confidence
    const pastFailures = phaseDecisions.filter(
      (d) => d.choice === 'terminate' || d.choice === 'abort',
    );
    if (pastFailures.length > 0) {
      decisions.push({
        id: `phase-${phase}-history-${Date.now()}`,
        phase,
        type: 'B',
        context: `当前阶段 ${phase} 在过去有 ${pastFailures.length} 次终止/放弃记录`,
        choice: 'proceed-with-caution',
        reason: '基于历史决策记录，建议谨慎推进',
        timestamp: startTime,
      });
    }

    // If confidence is low and this is not the first attempt, flag for human review
    if (
      executionPlan.confidence < 0.4 &&
      (ctx.state?.recoveryAttempts ?? 0) > 0
    ) {
      decisions.push({
        id: `phase-${phase}-low-confidence-${Date.now()}`,
        phase,
        type: 'A',
        context: `阶段 ${phase} 的信心度较低 (${executionPlan.confidence})，且已有 ${
          ctx.state?.recoveryAttempts ?? 0
        } 次恢复尝试`,
        choice: 'request-human-review',
        reason: '连续低信心度执行可能表明需要人工介入调整策略',
        timestamp: startTime,
      });
    }

    return {
      success: true,
      output: executionPlan,
      tokensUsed,
      toolCalls,
      decisions,
      suggestedNextPhase,
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

// Re-export for convenience
export { PHASE_DESCRIPTIONS, PHASE_REFERENCE_MAP };