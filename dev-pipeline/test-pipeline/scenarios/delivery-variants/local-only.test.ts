import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deterministicPipelineExecutor } from '../../src/harness/DeterministicPipelineExecutor.js';
import { PipelineAgentOrchestrator } from '../../src/harness/PipelineAgentOrchestrator.js';
import { ALL_PHASES } from '../../src/harness/types.js';
import type { PipelineReport, ScenarioConfig, TestEnvironment } from '../../src/harness/types.js';

const scenario: ScenarioConfig = {
  name: 'local-only-delivery',
  sampleProject: 'fullstack-todo',
  phases: ALL_PHASES.filter((p) => p !== 'phase-7-merge-deliver'),
  toolId: 'claude',
  openspecMode: 'mock',
  changeName: 'add-todo-due-date',
  featureDescription: 'Add an optional dueDate field to backend and frontend todo contracts',
  postArchiveAction: 'local-only',
};

describe('E2E - Local-only delivery (no remote operations)', () => {
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

  it('executes the seven applicable phases without failures', () => {
    expect(report.phases.every((p) => p.status === 'pass')).toBe(true);
    expect(report.summary.overallScore).toBe(100);
    expect(report.meta.overallStatus).toBe('pass');
  });

  it('records local-only delivery with no remote pushes', async () => {
    const statePath = `${env.rootDir}/openspec/.pipeline-state/${scenario.changeName}.json`;
    const { default: fs } = await import('fs-extra');
    const state = await fs.readJson(statePath);

    expect(state.currentPhase).toBe(6);
    expect(state.status).toBe('completed');
    // No remote operations at all
    expect(state.delivery.sourcePushed).toBe(false);
    expect(state.delivery.targetPushed).toBe(false);
  });

  it('has a local commit but no remote refs', async () => {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);

    // Commit exists locally
    const log = await execFileAsync('git', ['log', '--oneline', '-1'], { cwd: env.rootDir });
    expect(log.stdout.trim()).toBeTruthy();

    // Source ref does NOT exist on remote (never pushed)
    const sourceRef = await execFileAsync('git', [
      'ls-remote',
      env.remotePath,
      `refs/heads/${env.sourceBranch}`,
    ]);
    expect(sourceRef.stdout.trim()).toBe('');
  });
});
