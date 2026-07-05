import type {
  AgentExecution,
  DecisionRecord,
  LearningEvent,
  LearningResult,
  PipelinePhase,
  SkillMemoryEntry,
} from './types.js';
import { getRefinementCandidates, readSkillMemory, upsertSkillEntry } from './skill-memory.js';
import { readDecisions } from './decision-logger.js';
import { readHermesState } from './runtime-state.js';

// ── Learning Loop Entry Point ──

export async function runLearningLoop(
  targetDir: string,
  phase?: PipelinePhase,
): Promise<LearningResult> {
  const events: LearningEvent[] = [];
  const autoApplied: SkillMemoryEntry[] = [];
  const flaggedForReview: SkillMemoryEntry[] = [];

  // 1. Analyze executions from runtime state
  const state = await readHermesState(targetDir);
  const executions = state?.agentExecutions ?? [];

  // 2. Read decisions
  const decisions = await readDecisions(targetDir, phase ? { phase } : undefined);

  // 3. Detect failure patterns
  const failureEvents = detectFailurePatterns(executions, decisions, phase);
  events.push(...failureEvents);

  // 4. Detect success patterns
  const successEvents = detectSuccessPatterns(executions);
  events.push(...successEvents);

  // 5. Check refinement candidates
  const candidates = await getRefinementCandidates(targetDir, 3, 0.5);
  for (const candidate of candidates) {
    const event = analyzeCandidate(candidate, executions, decisions);
    if (event) {
      events.push(event);
    }
  }

  // 6. Generate and apply refinements
  for (const event of events) {
    if (event.confidence > 0.8) {
      // Auto-apply high confidence
      const entry = await upsertSkillEntry(targetDir, event.sourcePhase, {
        pattern: event.extractedPattern,
        refinements: [event.suggestedRefinement],
      });
      autoApplied.push(entry);
    } else if (event.confidence >= 0.5) {
      // Flag for review
      const entry = await upsertSkillEntry(targetDir, event.sourcePhase, {
        pattern: event.extractedPattern,
        refinements: [event.suggestedRefinement],
      });
      flaggedForReview.push(entry);
    }
    // Low confidence (< 0.5): only logged, no auto-action
  }

  const summary = buildSummary(
    events,
    autoApplied,
    flaggedForReview,
  );

  return {
    patternsFound: events.length,
    refinementsGenerated: autoApplied.length + flaggedForReview.length,
    autoApplied,
    flaggedForReview,
    loggedEvents: events,
    summary,
  };
}

// ── Failure Pattern Detection ──

function detectFailurePatterns(
  executions: AgentExecution[],
  decisions: DecisionRecord[],
  phase?: PipelinePhase,
): LearningEvent[] {
  const events: LearningEvent[] = [];
  const filteredExecs = phase
    ? executions.filter((e) => e.phase === phase)
    : executions;

  // Trigger 1: Failed executions
  const failures = filteredExecs.filter(
    (e) => e.status === 'failed' || e.result === 'failure',
  );
  if (failures.length >= 2) {
    const phases = [...new Set(failures.map((f) => f.phase))].join(', ');
    const tasks = failures.map((f) => f.task).join('; ');
    events.push({
      trigger: 'failure_pattern',
      sourcePhase: failures[0]!.phase,
      context: `检测到 ${failures.length} 次执行失败，涉及阶段: ${phases}`,
      extractedPattern: `任务类型: ${tasks}`,
      suggestedRefinement: `审查失败模式，考虑增加前置检查或简化任务拆分`,
      confidence: Math.min(0.7, failures.length * 0.2),
      timestamp: new Date().toISOString(),
    });
  }

  // Trigger 2: Human intervention (type 'A' decisions in quick succession)
  const typeADecisions = decisions.filter((d) => d.type === 'A');
  if (typeADecisions.length >= 2) {
    events.push({
      trigger: 'human_intervention',
      sourcePhase: typeADecisions[0]!.phase,
      context: `连续 ${typeADecisions.length} 次需要人工介入（A 类决策）`,
      extractedPattern: '过度依赖人工判断的决策点',
      suggestedRefinement: '检查是否可以提升部分 A 类决策为 B 类（含推荐默认值）',
      confidence: 0.6,
      timestamp: new Date().toISOString(),
    });
  }

  // Trigger 3: Max retries (check if recovery was exhausted)
  const recoveryFailures = filteredExecs.filter(
    (e) => e.result === 'failure' && e.phase === 'phase3_fix',
  );
  if (recoveryFailures.length >= 2) {
    events.push({
      trigger: 'max_retries',
      sourcePhase: 'phase3_fix',
      context: `修复回路触发 ${recoveryFailures.length} 次，可能超出最大重试次数`,
      extractedPattern: '审查修复循环中的常见失败原因',
      suggestedRefinement: '提前在实施阶段增加自审查，减少审查阶段修复次数',
      confidence: 0.75,
      timestamp: new Date().toISOString(),
    });
  }

  return events;
}

// ── Success Pattern Detection ──

function detectSuccessPatterns(
  executions: AgentExecution[],
): LearningEvent[] {
  const events: LearningEvent[] = [];
  const successes = executions.filter(
    (e) => e.result === 'success' && e.status === 'done',
  );

  // Group by phase
  const byPhase = new Map<PipelinePhase, AgentExecution[]>();
  for (const exec of successes) {
    const group = byPhase.get(exec.phase) ?? [];
    group.push(exec);
    byPhase.set(exec.phase, group);
  }

  for (const [phase, group] of byPhase) {
    if (group.length >= 3) {
      const avgTokens = Math.round(
        group.reduce((sum, e) => sum + e.tokensUsed, 0) / group.length,
      );
      events.push({
        trigger: 'success_pattern',
        sourcePhase: phase,
        context: `在 ${phase} 阶段连续 ${group.length} 次成功执行`,
        extractedPattern: `平均 token 消耗: ${avgTokens}，工具调用: ${Math.round(group.reduce((s, e) => s + e.toolCalls, 0) / group.length)}`,
        suggestedRefinement: `固化 ${phase} 阶段的执行策略为推荐模式`,
        confidence: Math.min(0.9, 0.5 + group.length * 0.1),
        timestamp: new Date().toISOString(),
      });
    }
  }

  return events;
}

// ── Candidate Analysis ──

function analyzeCandidate(
  candidate: SkillMemoryEntry,
  executions: AgentExecution[],
  _decisions: DecisionRecord[],
): LearningEvent | null {
  const relatedExecs = executions.filter(
    (e) =>
      e.task.toLowerCase().includes(candidate.pattern.toLowerCase()) ||
      candidate.pattern.toLowerCase().includes(e.task.toLowerCase()),
  );

  if (relatedExecs.length === 0) {
    return null;
  }

  const recentSuccesses = relatedExecs.filter(
    (e) => e.result === 'success',
  ).length;
  const ratio = relatedExecs.length > 0 ? recentSuccesses / relatedExecs.length : 0;

  return {
    trigger: ratio < 0.5 ? 'failure_pattern' : 'success_pattern',
    sourcePhase: relatedExecs[0]!.phase,
    context: `技能 "${candidate.key}" 在 ${relatedExecs.length} 次相关执行中成功率为 ${Math.round(ratio * 100)}%`,
    extractedPattern: candidate.pattern,
    suggestedRefinement:
      ratio < 0.5
        ? '建议重新评估该模式的有效性，可能需调整执行策略'
        : '可考虑将该模式提升为强推荐策略',
    confidence: Math.abs(0.5 - ratio) * 2, // distance from 0.5, scaled to 0-1
    timestamp: new Date().toISOString(),
  };
}

// ── Summary Builder ──

function buildSummary(
  events: LearningEvent[],
  autoApplied: SkillMemoryEntry[],
  flaggedForReview: SkillMemoryEntry[],
): string {
  const parts: string[] = [];

  if (events.length === 0) {
    parts.push('本次学习循环未发现新的模式。');
  } else {
    const triggers = countByTrigger(events);
    parts.push(
      `发现 ${events.length} 个模式: ` +
        Object.entries(triggers)
          .map(([trigger, count]) => `${triggerLabel(trigger)} ${count} 个`)
          .join(', '),
    );
  }

  if (autoApplied.length > 0) {
    parts.push(
      `自动应用 ${autoApplied.length} 个优化（高置信度）: ` +
        autoApplied.map((e) => e.key).join(', '),
    );
  }

  if (flaggedForReview.length > 0) {
    parts.push(
      `${flaggedForReview.length} 个优化需要人工审查: ` +
        flaggedForReview.map((e) => e.key).join(', '),
    );
  }

  return parts.join('\n');
}

function countByTrigger(events: LearningEvent[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of events) {
    counts[e.trigger] = (counts[e.trigger] ?? 0) + 1;
  }
  return counts;
}

function triggerLabel(trigger: string): string {
  switch (trigger) {
    case 'failure_pattern':
      return '失败模式';
    case 'human_intervention':
      return '人工介入';
    case 'max_retries':
      return '最大重试';
    case 'success_pattern':
      return '成功模式';
    default:
      return trigger;
  }
}