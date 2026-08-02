import { getPhaseDefinition } from '../domain/phase-definition.js';
import type { PipelineRun } from '../domain/pipeline-state.js';
import type { AgentFacts } from './agent-runtime.js';

export interface PlannerContext {
  phase: ReturnType<typeof getPhaseDefinition>;
  state: {
    runId: string;
    changeName: string;
    currentPhase: number;
    currentStep: number;
    status: PipelineRun['status'];
    decisions: PipelineRun['decisions'];
    lastActionId?: string;
  };
  facts: AgentFacts;
  availableTools: string[];
}

export class ContextBuilder {
  constructor(private readonly availableTools: string[]) {}

  build(state: PipelineRun, facts: AgentFacts): PlannerContext {
    const { runId, changeName, currentPhase, currentStep, status, decisions } = state;
    return {
      phase: getPhaseDefinition(currentPhase),
      state: {
        runId,
        changeName,
        currentPhase,
        currentStep,
        status,
        decisions,
        lastActionId: typeof state.lastActionId === 'string' ? state.lastActionId : undefined,
      },
      facts,
      availableTools: [...this.availableTools].sort(),
    };
  }

  toPrompt(context: PlannerContext): string {
    return [
      'You are a gated development pipeline planner.',
      'Return exactly one JSON object with either {"action": null} or an action proposal.',
      'Never approve a gate, skip a gate, or perform a high-risk delivery action implicitly.',
      'The action kind must be one of the phase allowed actions and available tools.',
      JSON.stringify(context, null, 2),
    ].join('\n\n');
  }
}
