import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'fs-extra';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deterministicPipelineExecutor } from '../../src/harness/DeterministicPipelineExecutor.js';
import { createTestEnvironment } from '../../src/harness/EnvironmentFactory.js';
import type { ScenarioConfig, TestEnvironment } from '../../src/harness/types.js';

const scenario: ScenarioConfig = {
  name: 'verify-fail-rollback',
  sampleProject: 'fullstack-todo',
  phases: [
    'phase-0-entrance',
    'phase-1-propose',
    'phase-2-apply',
    'phase-3-review',
    'phase-4-unit-tests',
    'phase-5-archive',
  ],
  toolId: 'claude',
  openspecMode: 'mock',
  changeName: 'verify-rollback-test',
  featureDescription: 'Exercise verify failure rollback to Phase 2',
};

describe('E2E recovery - Verify failure rollback to Phase 2', () => {
  let env: TestEnvironment;

  beforeAll(async () => {
    env = await createTestEnvironment({
      sampleProject: scenario.sampleProject,
      toolId: scenario.toolId,
      changeName: scenario.changeName,
      openspecMode: 'mock',
    });

    // Run Phase 0-4 normally
    for (const phase of scenario.phases.slice(0, 5)) {
      const result = await deterministicPipelineExecutor(phase, '', env, scenario);
      expect(result.status).toBe('pass');
    }
  }, 120000);

  afterAll(async () => {
    if (env) await env.cleanup();
  });

  it('allows rollback from Phase 5 to Phase 2 after verify failure', async () => {
    // Record verify as failed in Phase 5
    await runState(env, 'set', scenario.changeName, 'verify.command', '"npm run verify"');
    await runState(env, 'attempt', scenario.changeName, 'verify', 'failed');

    // Now rollback to Phase 2 Step 6 (fix implementation)
    await runState(env, 'transition', scenario.changeName, '2', '6');

    const state = await readState(env, scenario.changeName);
    expect(state.currentPhase).toBe(2);
    expect(state.currentStep).toBe(6);
    expect(state.status).toBe('active');
    expect(state.verify.status).toBe('failed');
  });

  it('state remains consistent after rollback', async () => {
    // After rollback, the state should correctly reflect Phase 2 with verify failed
    const state = await readState(env, scenario.changeName);
    expect(state.currentPhase).toBe(2);
    expect(state.currentStep).toBe(6);
    expect(state.status).toBe('active');
    expect(state.verify.status).toBe('failed');
    // Previous review data should still be present
    expect(state.review).toBeDefined();
    expect(state.tests).toBeDefined();
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

interface RollbackState {
  currentPhase: number;
  currentStep: number;
  status: string;
  verify: { status: string; attempts: number; command: string | null };
}

async function readState(env: TestEnvironment, changeName: string): Promise<RollbackState> {
  return fs.readJson(
    path.join(env.rootDir, 'openspec', '.pipeline-state', `${changeName}.json`),
  ) as Promise<RollbackState>;
}
