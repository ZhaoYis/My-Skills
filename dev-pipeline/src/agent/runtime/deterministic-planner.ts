import type { ActionProposal } from '../domain/decisions.js';
import type { PipelineRun } from '../domain/pipeline-state.js';
import type { AgentFacts, AgentPlanner } from './agent-runtime.js';

export class PhaseAwarePlanner implements AgentPlanner {
  async nextAction(input: {
    state: PipelineRun;
    facts: AgentFacts;
  }): Promise<ActionProposal | null> {
    const { state } = input;
    const action = this.actionForPhase(state);
    if (!action || state.lastActionId === action.actionId) return null;
    return action;
  }

  private actionForPhase(state: PipelineRun): ActionProposal | null {
    const base = { phase: state.currentPhase, args: { changeName: state.changeName } };
    switch (state.currentPhase) {
      case 0:
        return { ...base, actionId: 'phase-0-preflight', kind: 'openspec.preflight', risk: 'low' };
      case 1:
        return { ...base, actionId: 'phase-1-status', kind: 'openspec.status', risk: 'low' };
      case 2:
        return {
          ...base,
          actionId: 'phase-2-instructions',
          kind: 'openspec.instructions',
          risk: 'low',
        };
      case 3:
        return { ...base, actionId: 'phase-3-diff', kind: 'git.diff', args: {}, risk: 'medium' };
      case 4:
        return {
          ...base,
          actionId: 'phase-4-detect-tests',
          kind: 'tests.detect',
          args: {},
          risk: 'low',
        };
      case 5:
        return { ...base, actionId: 'phase-5-validate', kind: 'openspec.validate', risk: 'low' };
      case 6:
      case 7:
        return {
          ...base,
          actionId: `phase-${state.currentPhase}-git-status`,
          kind: 'git.status',
          args: {},
          risk: 'low',
        };
      default:
        return null;
    }
  }
}
