import type { PipelinePhase } from './types.js';

// ── Allowed Transitions Map ──

const ALLOWED_TRANSITIONS: ReadonlyMap<PipelinePhase, readonly PipelinePhase[]> =
  new Map<PipelinePhase, readonly PipelinePhase[]>([
    ['pre_pipeline', ['phase0_entrance', 'terminated']],
    ['phase0_entrance', ['phase1_propose', 'terminated']],
    ['phase1_propose', ['phase2_apply', 'terminated']],
    ['phase2_apply', ['phase3_review', 'terminated']],
    [
      'phase3_review',
      ['phase3_fix', 'phase4_archive', 'terminated'],
    ],
    ['phase3_fix', ['phase3_review', 'terminated']],
    ['phase4_archive', ['phase5_unittest', 'phase6_push', 'terminated']],
    ['phase5_unittest', ['phase6_push', 'terminated']],
    ['phase6_push', ['phase6_merge', 'completed']],
    ['phase6_merge', ['completed']],
    ['phase7_pr_created', ['phase7_ci_pending', 'terminated']],
    [
      'phase7_ci_pending',
      ['phase7_ci_triage', 'phase7_pr_merge', 'terminated'],
    ],
    ['phase7_ci_triage', ['phase7_ci_pending', 'phase7_pr_merge', 'terminated']],
    ['phase7_pr_merge', ['completed', 'terminated']],
    ['completed', []],
    ['terminated', []],
  ]);

// ── Recovery Behavior Descriptions ──

const RECOVERY_BEHAVIORS: ReadonlyMap<PipelinePhase, string> = new Map([
  ['pre_pipeline', '从头开始执行'],
  ['phase0_entrance', '从入口预检阶段重新开始（已生成的产物跳过）'],
  ['phase1_propose', '从提案编写阶段重新开始'],
  ['phase2_apply', '从提案应用阶段重新开始（已生成的文件跳过）'],
  ['phase3_review', '从代码审查阶段重新开始'],
  ['phase3_fix', '从审查修复阶段重新开始'],
  ['phase4_archive', '从归档阶段重新开始（检查制品状态）'],
  ['phase5_unittest', '从单测门禁阶段重新开始'],
  ['phase6_push', '检查 git remote：已推送则跳过，未推送则执行'],
  ['phase6_merge', '检查 git log：已合并则跳过，未合并则执行'],
  ['phase7_pr_created', '检查 PR 是否存在：存在则读取当前状态'],
  ['phase7_ci_pending', '检查 CI 最新状态：pending 暂停，passed 进入合并'],
  ['phase7_ci_triage', '读取上次失败分类，进入修复回路或重新检查'],
  ['phase7_pr_merge', '检查 PR 是否已合并：已合并完成，未合并则执行'],
  ['completed', '输出最终摘要，不重复任何操作'],
  ['terminated', '询问是否重新开始或从断点续接'],
]);

// ── Terminal Phases ──

const TERMINAL_PHASES: ReadonlySet<PipelinePhase> = new Set([
  'completed',
  'terminated',
]);

// ── Public API ──

export function getAllowedTransitions(
  currentPhase: PipelinePhase,
): readonly PipelinePhase[] {
  return ALLOWED_TRANSITIONS.get(currentPhase) ?? [];
}

export function validateTransition(
  from: PipelinePhase,
  to: PipelinePhase,
): boolean {
  const allowed = ALLOWED_TRANSITIONS.get(from);
  return allowed != null && allowed.includes(to);
}

export function getRecoveryBehavior(phase: PipelinePhase): string {
  return RECOVERY_BEHAVIORS.get(phase) ?? '无特殊恢复行为，从该阶段开始执行';
}

export function isTerminal(phase: PipelinePhase): boolean {
  return TERMINAL_PHASES.has(phase);
}

export function isRecoverable(phase: PipelinePhase): boolean {
  return !isTerminal(phase);
}