import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deterministicPipelineExecutor } from '../../src/harness/DeterministicPipelineExecutor.js';
import { PipelineAgentOrchestrator } from '../../src/harness/PipelineAgentOrchestrator.js';
import type { PipelineReport, ScenarioConfig, TestEnvironment } from '../../src/harness/types.js';
import { ALL_PHASES } from '../../src/harness/types.js';

const scenario: ScenarioConfig = {
  name: 'skip-review-delivery',
  sampleProject: 'fullstack-todo',
  phases: ALL_PHASES.filter((p) => p !== 'phase-3-review'),
  toolId: 'claude',
  openspecMode: 'mock',
  changeName: 'add-todo-due-date',
  featureDescription: 'Add an optional dueDate field to backend and frontend todo contracts',
  reviewDisposition: 'skip-review',
};

describe('E2E - Skip review delivery', () => {
  let orchestrator: PipelineAgentOrchestrator;
  let report: PipelineReport;
  let env: TestEnvironment;

  beforeAll(async () => {
    orchestrator = new PipelineAgentOrchestrator(scenario, deterministicPipelineExecutor);
    report = await orchestrator.runFullFlow();
    env = orchestrator.getEnvironment();
  }, 120000);

  afterAll(async () => {
    if (env) await env.cleanup();
  });

  it('executes six phases (skipping review) without failures', () => {
    expect(report.phases.map((p) => p.phaseId)).toEqual(scenario.phases);
    expect(report.phases.every((p) => p.status === 'pass')).toBe(true);
    expect(report.summary).toMatchObject({
      totalPhases: 6,
      passedPhases: 6,
      failedPhases: 0,
      skippedPhases: 0,
      failedAssertions: 0,
      overallScore: 100,
    });
    expect(report.meta.overallStatus).toBe('pass');
  });

  it('records completed delivery state with review skipped', async () => {
    const statePath = `${env.rootDir}/openspec/.pipeline-state/${scenario.changeName}.json`;
    const { default: fs } = await import('fs-extra');
    const state = await fs.readJson(statePath);

    expect(state.currentPhase).toBe(6);
    expect(state.status).toBe('completed');
    // Review was never executed (no review phase in the flow)
    expect(state.review.status).not.toBe('passed');
    expect(state.review.currentRound).toBe(0);
    expect(state.review.rounds).toEqual([]);
  });

  it('delivers the change to the remote target', async () => {
    const phase6 = report.phases.find((p) => p.phaseId === 'phase-6-merge-push');
    expect(phase6?.status).toBe('pass');
    expect(phase6?.assertions.every((a) => a.passed)).toBe(true);
  });
});
