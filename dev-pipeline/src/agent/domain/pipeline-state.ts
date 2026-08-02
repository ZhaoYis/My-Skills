export type PipelineStatus = 'active' | 'paused' | 'completed';
export type ExecutionMode = 'pipeline' | 'standalone' | 'hybrid';

export type DecisionValue = boolean | number | string | null;

export interface PhaseRecord {
  phase: number;
  step: number;
  executedBy: string;
  status: 'in-progress' | 'completed' | 'abandoned';
  startedAt: string;
  completedAt: string | null;
  decisions: Record<string, DecisionValue>;
  gatesBypassed: string[];
}

export interface AttemptRecord {
  status: string;
  attempts: number;
  detail?: string | null;
}

export interface GateAttemptState extends AttemptRecord {
  command?: string | null;
}

export interface PipelineRun {
  schemaVersion: number;
  _version: number;
  runId: string;
  changeName: string;
  sourceBranch: string;
  targetBranch: string | null;
  currentPhase: number;
  currentStep: number;
  status: PipelineStatus;
  executionMode: ExecutionMode;
  decisions: Record<string, DecisionValue>;
  approvedActions?: string[];
  pendingApproval?: {
    actionId: string;
    kind: string;
  };
  phaseHistory: PhaseRecord[];
  gatesBypassed: string[];
  attempts?: {
    review: AttemptRecord;
    tests: AttemptRecord;
    verify: AttemptRecord;
  };
  tests: GateAttemptState;
  verify: GateAttemptState;
  archivePath: string | null;
  delivery: {
    commitSha: string | null;
    mergeCommitSha: string | null;
    sourcePushed: boolean;
    targetPushed: boolean;
    tag: string | null;
  };
  pauseReason?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export type GateError = {
  code: string;
  message: string;
};

const allowedTransitions: Record<number, number[]> = {
  0: [0, 1],
  1: [1, 2],
  2: [1, 2, 3, 4],
  3: [2, 3, 4],
  4: [2, 4, 5],
  5: [1, 2, 5, 6],
  6: [6, 7],
  7: [7],
};

export function canTransition(from: number, to: number): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}

export function validateTransitionGates(
  state: Pick<
    PipelineRun,
    'decisions' | 'tests' | 'attempts' | 'verify' | 'archivePath' | 'delivery'
  > &
    Partial<Pick<PipelineRun, 'currentPhase'>>,
  from: number,
  to: number,
): GateError | null {
  const decisions = state.decisions;
  const tests = state.tests ?? state.attempts?.tests;
  const verify = state.verify ?? state.attempts?.verify;

  if (to === 2 && decisions.proposalApproved !== true) {
    return { code: 'proposal-approval-required', message: '进入 Phase2 前必须确认 proposal' };
  }
  if (from === 2 && to >= 3 && decisions.implementationConfirmed !== true) {
    return {
      code: 'implementation-confirmation-required',
      message: '离开 Phase2 前必须确认实施摘要',
    };
  }
  if (to === 5 && !['passed', 'skipped', 'debt-recorded'].includes(String(tests?.status))) {
    return { code: 'test-gate-required', message: '进入 Phase5 前必须完成或明确跳过测试' };
  }
  if (to === 6) {
    if (!['passed', 'skipped'].includes(String(verify?.status))) {
      return { code: 'verify-gate-required', message: '进入 Phase6 前必须通过或明确跳过 verify' };
    }
    if (!state.archivePath) {
      return { code: 'archive-required', message: '进入 Phase6 前必须记录归档路径' };
    }
    if (!['merge', 'push-only', 'local-only'].includes(String(decisions.postArchiveAction))) {
      return { code: 'post-archive-decision-required', message: '必须选择归档后的交付方式' };
    }
  }
  if (to === 7) {
    if (decisions.postArchiveAction !== 'merge') {
      return { code: 'merge-gate-required', message: '进入 Phase7 前必须选择 merge' };
    }
    if (!state.delivery.commitSha) {
      return { code: 'commit-required', message: '进入 Phase7 前必须记录 commit' };
    }
    if (!state.delivery.sourcePushed) {
      return { code: 'source-push-required', message: '进入 Phase7 前必须推送源分支' };
    }
  }
  return null;
}

export function validateTransition(state: PipelineRun, toPhase: number): GateError | null {
  const fromPhase = state.currentPhase;
  if (!Number.isInteger(toPhase) || toPhase < 0 || toPhase > 7) {
    return { code: 'invalid-transition-target', message: '目标 Phase 必须为 0-7' };
  }
  if (!canTransition(fromPhase, toPhase)) {
    return {
      code: 'pipeline-transition-not-allowed',
      message: `不允许从 Phase${fromPhase} 跳转到 Phase${toPhase}`,
    };
  }
  if (toPhase > fromPhase) {
    for (let phase = fromPhase + 1; phase <= toPhase; phase += 1) {
      const gateError = validateTransitionGates(state, phase - 1, phase);
      if (gateError) return gateError;
    }
  } else {
    const gateError = validateTransitionGates(state, fromPhase, toPhase);
    if (gateError) return gateError;
  }
  return null;
}

export function transitionRun(
  state: PipelineRun,
  toPhase: number,
  toStep: number,
  now: string,
): PipelineRun {
  const error = validateTransition(state, toPhase);
  if (error) throw new Error(`${error.code}: ${error.message}`);

  const next = structuredClone(state);
  const current = next.phaseHistory.find(
    (entry) =>
      entry.phase === next.currentPhase &&
      entry.executedBy === 'pipeline' &&
      entry.status === 'in-progress',
  );
  if (current && next.currentPhase !== toPhase) {
    current.status = 'completed';
    current.completedAt = now;
    current.step = next.currentStep;
  }
  if (
    !next.phaseHistory.some(
      (entry) =>
        entry.phase === toPhase &&
        entry.executedBy === 'pipeline' &&
        entry.status === 'in-progress',
    )
  ) {
    next.phaseHistory.push({
      phase: toPhase,
      step: toStep,
      executedBy: 'pipeline',
      status: 'in-progress',
      startedAt: now,
      completedAt: null,
      decisions: { ...next.decisions },
      gatesBypassed: [],
    });
  }
  next.currentPhase = toPhase;
  next.currentStep = toStep;
  next.status = 'active';
  next.pauseReason = undefined;
  return next;
}

export function pauseRun(state: PipelineRun, reason: string, now: string): PipelineRun {
  const next = structuredClone(state);
  next.status = 'paused';
  next.pauseReason = reason;
  next.updatedAt = now;
  return next;
}
