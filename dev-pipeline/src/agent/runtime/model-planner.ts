import { z } from 'zod';
import { type ActionProposal, actionRisk } from '../domain/decisions.js';
import { getPhaseDefinition } from '../domain/phase-definition.js';
import type { PipelineRun } from '../domain/pipeline-state.js';
import type { AgentFacts, AgentPlanner } from './agent-runtime.js';
import type { ContextBuilder } from './context-builder.js';

export interface ModelClient {
  complete(input: { prompt: string; responseFormat: 'json' }): Promise<string>;
}

const modelActionSchema = z.object({
  actionId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/),
  kind: z.string().min(1),
  phase: z.number().int().min(0).max(7),
  args: z.record(z.string(), z.unknown()).optional(),
});

const modelResponseSchema = z.object({ action: modelActionSchema.nullable() });

function parseModelResponse(raw: string): z.infer<typeof modelResponseSchema> {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return modelResponseSchema.parse(JSON.parse(trimmed));
}

export class ModelPlanner implements AgentPlanner {
  constructor(
    private readonly model: ModelClient,
    private readonly contextBuilder: ContextBuilder,
    private readonly availableTools: ReadonlySet<string>,
  ) {}

  async nextAction(input: {
    state: PipelineRun;
    facts: AgentFacts;
  }): Promise<ActionProposal | null> {
    const context = this.contextBuilder.build(input.state, input.facts);
    const raw = await this.model.complete({
      prompt: this.contextBuilder.toPrompt(context),
      responseFormat: 'json',
    });
    const parsed = parseModelResponse(raw).action;
    if (!parsed) return null;

    const phase = getPhaseDefinition(input.state.currentPhase);
    if (parsed.phase !== input.state.currentPhase) {
      throw new Error('model-action-phase-mismatch');
    }
    if (!phase.allowedActions.includes(parsed.kind)) {
      throw new Error(`model-action-not-allowed-in-phase: ${parsed.kind}`);
    }
    if (!this.availableTools.has(parsed.kind)) {
      throw new Error(`model-action-tool-not-registered: ${parsed.kind}`);
    }
    return {
      actionId: parsed.actionId,
      kind: parsed.kind,
      phase: parsed.phase,
      args: parsed.args,
      risk: actionRisk(parsed.kind),
    };
  }
}
