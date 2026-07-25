import { describe, expect, it } from 'vitest';
import {
  normalizePhaseResult,
  PipelineAgentOrchestrator,
} from '../src/harness/PipelineAgentOrchestrator.js';
import type { AgentPhaseResult, ScenarioConfig } from '../src/harness/types.js';

const scenario: ScenarioConfig = {
  name: 'report-integrity',
  sampleProject: 'fullstack-todo',
  phases: ['phase-0-entrance'],
  toolId: 'claude',
  changeName: 'report-integrity',
  featureDescription: 'Validate report status normalization',
};

function phaseResult(overrides: Partial<AgentPhaseResult> = {}): AgentPhaseResult {
  return {
    phaseId: 'phase-0-entrance',
    label: 'Phase0 - Entrance',
    status: 'pass',
    startedAt: new Date(0).toISOString(),
    durationMs: 0,
    agentSummary: 'Synthetic result for status validation',
    assertions: [],
    artifacts: [],
    ...overrides,
  };
}

describe('pipeline report integrity', () => {
  it('converts a synthetic pass with a failed assertion into fail', () => {
    const normalized = normalizePhaseResult(
      phaseResult({ assertions: [{ description: 'required output exists', passed: false }] }),
    );

    expect(normalized.status).toBe('fail');
    expect(normalized.errors).toContain('One or more required assertions failed.');
  });

  it('refuses to run a full flow without an Agent executor', async () => {
    const orchestrator = new PipelineAgentOrchestrator(scenario);
    const report = await orchestrator.runFullFlow();

    expect(report.meta.overallStatus).toBe('fail');
    expect(report.phases[0]?.status).toBe('error');
    await orchestrator.getEnvironment().cleanup();
  });
});
