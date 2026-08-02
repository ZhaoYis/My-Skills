import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'fs-extra';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deterministicPipelineExecutor } from '../../src/harness/DeterministicPipelineExecutor.js';
import { createTestEnvironment } from '../../src/harness/EnvironmentFactory.js';
import type { ScenarioConfig, TestEnvironment } from '../../src/harness/types.js';

const scenario: ScenarioConfig = {
  name: 'skip-tests-delivery',
  sampleProject: 'fullstack-todo',
  phases: [
    'phase-0-entrance',
    'phase-1-propose',
    'phase-2-apply',
    'phase-3-review',
    'phase-4-unit-tests',
    'phase-5-archive',
    'phase-6-commit-push',
    'phase-7-merge-deliver',
  ],
  toolId: 'claude',
  openspecMode: 'mock',
  changeName: 'add-todo-due-date',
  featureDescription: 'Add an optional dueDate field to backend and frontend todo contracts',
};

describe('E2E - Skip tests delivery', () => {
  let env: TestEnvironment;

  beforeAll(async () => {
    env = await createTestEnvironment({
      sampleProject: scenario.sampleProject,
      toolId: scenario.toolId,
      changeName: scenario.changeName,
      openspecMode: 'mock',
    });

    // Run Phase 0-4 with tests skipped
    for (const phase of scenario.phases.slice(0, 5)) {
      if (phase === 'phase-4-unit-tests') {
        // Execute Phase 4 with tests skipped
        // Mark tests as skipped using the state machine
        await runState(env, 'set', scenario.changeName, 'tests.command', '"npm test"');
        await runState(env, 'set', scenario.changeName, 'tests.status', '"skipped"');
        await runState(env, 'set', scenario.changeName, 'tests.attempts', '0');
        const transition = await runState(env, 'transition', scenario.changeName, '5', '15');
        expect(JSON.parse(transition.stdout)).toMatchObject({ status: 'ok' });
      } else {
        const result = await deterministicPipelineExecutor(phase, '', env, scenario);
        expect(result.status).toBe('pass');
      }
    }

    // Run Phase 5 and 6 normally
    for (const phase of scenario.phases.slice(5)) {
      const result = await deterministicPipelineExecutor(phase, '', env, scenario);
      expect(result.status).toBe('pass');
    }
  }, 120000);

  afterAll(async () => {
    if (env) await env.cleanup();
  });

  it('records skipped tests in pipeline state', async () => {
    const state = await fs.readJson(
      path.join(env.rootDir, 'openspec', '.pipeline-state', `${scenario.changeName}.json`),
    );

    expect(state.currentPhase).toBe(7);
    expect(state.status).toBe('completed');
    expect(state.tests.status).toBe('skipped');
    expect(state.tests.command).toBe('npm test');
  });

  it('delivers the change to remote despite skipped tests', async () => {
    const { execFile: ef } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(ef);

    const sourceRef = await execFileAsync('git', [
      'ls-remote', env.remotePath, `refs/heads/${env.sourceBranch}`,
    ]);
    expect(sourceRef.stdout.trim()).toBeTruthy();

    const targetRef = await execFileAsync('git', [
      'ls-remote', env.remotePath, `refs/heads/${env.targetBranch}`,
    ]);
    expect(targetRef.stdout.trim()).toBeTruthy();
  });
});

function runState(
  env: TestEnvironment,
  command: string,
  changeName: string,
  ...args: string[]
): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [path.join(env.skillRoot, 'scripts', 'dev-pipeline-state.mjs'), command, changeName, ...args],
      { cwd: env.rootDir },
      (error, stdout) => {
        const code = error && 'code' in error && typeof error.code === 'number' ? error.code : 0;
        resolve({ code, stdout });
      },
    );
  });
}
