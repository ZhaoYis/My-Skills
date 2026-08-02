import type { ActionProposal } from '../domain/decisions.js';
import type { PipelineRun } from '../domain/pipeline-state.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { AgentExecutor, Evidence } from './agent-runtime.js';

export class RegistryToolExecutor implements AgentExecutor {
  constructor(private readonly registry: ToolRegistry) {}

  async execute(action: ActionProposal, state: PipelineRun) {
    const response = await this.registry.execute(action.kind, action.args ?? {}, { run: state });
    const nextState = {
      ...state,
      lastActionId: action.actionId,
      lastActionStatus: response.status,
      lastActionSummary: response.summary,
    };
    return {
      status: response.status,
      summary: response.summary,
      evidence: (response.evidence ?? []) as Evidence[],
      nextState,
    };
  }
}
