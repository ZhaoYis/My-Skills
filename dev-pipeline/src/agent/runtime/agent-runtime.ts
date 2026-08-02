import { type ActionProposal, actionRisk, requiresApproval } from '../domain/decisions.js';
import { type PipelineRun, pauseRun } from '../domain/pipeline-state.js';
import type { ApprovalPolicy } from './policy.js';
import type { StateStore } from './state-store.js';

export interface Evidence {
  type: string;
  value: unknown;
}

export interface AgentFacts {
  divergence?: string;
  [key: string]: unknown;
}

export interface AgentPlanner {
  nextAction(input: { state: PipelineRun; facts: AgentFacts }): Promise<ActionProposal | null>;
}

export interface AgentExecutor {
  execute(
    action: ActionProposal,
    state: PipelineRun,
  ): Promise<{
    status: 'succeeded' | 'blocked' | 'failed';
    summary: string;
    evidence?: Evidence[];
    nextState?: PipelineRun;
  }>;
}

export interface AgentObserver {
  observe(state: PipelineRun): Promise<AgentFacts>;
}

export interface ApprovalRequest {
  action: ActionProposal;
  state: PipelineRun;
}

export interface AgentInteraction {
  requestApproval(request: ApprovalRequest): Promise<void>;
}

export interface AgentEvent {
  actionId: string;
  kind: string;
  phase: number;
  status: string;
  summary: string;
  evidence: Evidence[];
}

export interface AgentEventLog {
  append(event: AgentEvent): Promise<void>;
}

export type RuntimeStepResult =
  | { status: 'awaiting-approval'; action: ActionProposal; state: PipelineRun }
  | { status: 'paused'; reason: string; state: PipelineRun }
  | { status: 'completed'; action: ActionProposal | null; state: PipelineRun }
  | { status: 'failed'; action: ActionProposal; error: unknown; state: PipelineRun };

export class AgentRuntime {
  constructor(
    private readonly dependencies: {
      stateStore: StateStore;
      planner: AgentPlanner;
      executor: AgentExecutor;
      observer: AgentObserver;
      interaction?: AgentInteraction;
      eventLog?: AgentEventLog;
      policy?: ApprovalPolicy;
      now?: () => string;
    },
  ) {}

  async step(runId: string): Promise<RuntimeStepResult> {
    const { stateStore, planner, executor, observer, interaction, eventLog } = this.dependencies;
    const state = await stateStore.load(runId);
    if (!state) throw new Error(`pipeline-run-not-found: ${runId}`);
    if (state.status === 'paused')
      return { status: 'paused', reason: state.pauseReason ?? 'paused', state };
    if (state.status === 'completed') return { status: 'completed', action: null, state };

    const facts = await observer.observe(state);
    if (facts.divergence) {
      const paused = pauseRun(
        state,
        facts.divergence,
        this.dependencies.now?.() ?? new Date().toISOString(),
      );
      const saved = await stateStore.save(paused, state._version);
      return { status: 'paused', reason: facts.divergence, state: saved };
    }

    let action: ActionProposal | null;
    try {
      action = await planner.nextAction({ state, facts });
    } catch (error) {
      const reason = `planner-error: ${error instanceof Error ? error.message : String(error)}`;
      const paused = pauseRun(state, reason, this.dependencies.now?.() ?? new Date().toISOString());
      const saved = await stateStore.save(paused, state._version);
      return { status: 'paused', reason, state: saved };
    }
    if (!action) return { status: 'completed', action: null, state };
    const normalized = { ...action, risk: action.risk ?? actionRisk(action.kind) };
    const alreadyApproved = state.approvedActions?.includes(normalized.actionId) ?? false;
    const needsApproval =
      this.dependencies.policy?.evaluate(normalized).requiresApproval ??
      requiresApproval(normalized);
    if (needsApproval && !alreadyApproved) {
      if (!interaction)
        throw new Error(`approval-required-without-interaction: ${normalized.kind}`);
      const pending = {
        ...state,
        pendingApproval: { actionId: normalized.actionId, kind: normalized.kind },
      };
      const saved = await stateStore.save(pending, state._version);
      await interaction.requestApproval({ action: normalized, state: saved });
      return { status: 'awaiting-approval', action: normalized, state: saved };
    }

    try {
      const result = await executor.execute(normalized, state);
      let nextState = result.nextState;
      if (alreadyApproved && result.status === 'succeeded') {
        const baseState = nextState ?? state;
        nextState = {
          ...baseState,
          approvedActions: baseState.approvedActions?.filter((id) => id !== normalized.actionId),
          pendingApproval: undefined,
        };
      }
      const saved = nextState ? await stateStore.save(nextState, state._version) : state;
      await eventLog?.append({
        actionId: normalized.actionId,
        kind: normalized.kind,
        phase: normalized.phase,
        status: result.status,
        summary: result.summary,
        evidence: result.evidence ?? [],
      });
      if (result.status === 'failed' || result.status === 'blocked') {
        return { status: 'failed', action: normalized, error: result.summary, state: saved };
      }
      return { status: 'completed', action: normalized, state: saved };
    } catch (error) {
      return { status: 'failed', action: normalized, error, state };
    }
  }

  async approve(runId: string, actionId: string): Promise<PipelineRun> {
    const state = await this.dependencies.stateStore.load(runId);
    if (!state) throw new Error(`pipeline-run-not-found: ${runId}`);
    if (state.pendingApproval?.actionId !== actionId) {
      throw new Error(`approval-not-pending: ${actionId}`);
    }
    const approvedActions = Array.from(new Set([...(state.approvedActions ?? []), actionId]));
    const next = {
      ...state,
      approvedActions,
      pendingApproval: undefined,
    };
    return this.dependencies.stateStore.save(next, state._version);
  }

  async run(runId: string, maxSteps = 100): Promise<RuntimeStepResult> {
    let last = await this.step(runId);
    for (let index = 1; index < maxSteps; index += 1) {
      if (last.status !== 'completed' || last.action === null) return last;
      last = await this.step(runId);
    }
    return last;
  }
}
