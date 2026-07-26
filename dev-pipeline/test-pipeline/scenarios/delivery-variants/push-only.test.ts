import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deterministicPipelineExecutor } from '../../src/harness/DeterministicPipelineExecutor.js';
import { PipelineAgentOrchestrator } from '../../src/harness/PipelineAgentOrchestrator.js';
import { ALL_PHASES } from '../../src/harness/types.js';
import type { PipelineReport, ScenarioConfig, TestEnvironment } from '../../src/harness/types.js';

const scenario: ScenarioConfig = {
  name: 'push-only-delivery',
  sampleProject: 'fullstack-todo',
  phases: ALL_PHASES,
  toolId: 'claude',
  openspecMode: 'mock',
  changeName: 'add-todo-due-date',
  featureDescription: 'Add an optional dueDate field to backend and frontend todo contracts',
  postArchiveAction: 'push-only',
};

describe('E2E - Push-only delivery (no merge)', () => {
  let orchestrator: PipelineAgentOrchestrator;
  let report: PipelineReport;
  let env: TestEnvironment;

  beforeAll(
    async () => {
      orchestrator = new PipelineAgentOrchestrator(scenario, deterministicPipelineExecutor);
      report = await orchestrator.runFullFlow();
      env = orchestrator.getEnvironment();
    },
    120000,
  );

  afterAll(async () => {
    if (env) await env.cleanup();
  });

  it('executes all seven phases without failures', () => {
    expect(report.phases.every((p) => p.status === 'pass')).toBe(true);
    expect(report.summary.overallScore).toBe(100);
    expect(report.meta.overallStatus).toBe('pass');
  });

  it('records push-only delivery state', async () => {
    const statePath = `${env.rootDir}/openspec/.pipeline-state/${scenario.changeName}.json`;
    const { default: fs } = await import('fs-extra');
    const state = await fs.readJson(statePath);

    expect(state.currentPhase).toBe(6);
    expect(state.status).toBe('completed');
    // Source pushed but target not pushed (no merge happened)
    expect(state.delivery.sourcePushed).toBe(true);
    expect(state.delivery.targetPushed).toBe(false);
  });

  it('has source branch on remote but no merge commit on target', async () => {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);

    // Source ref exists on remote
    const sourceRef = await execFileAsync('git', ['ls-remote', env.remotePath, `refs/heads/${env.sourceBranch}`]);
    expect(sourceRef.stdout.trim()).toBeTruthy();

    // No merge commit on target (target wasn't pushed)
    const phase6 = report.phases.find((p) => p.phaseId === 'phase-6-merge-push');
    expect(phase6?.assertions.every((a) => a.passed)).toBe(true);
  });
});
