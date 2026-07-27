import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'fs-extra';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deterministicPipelineExecutor } from '../../src/harness/DeterministicPipelineExecutor.js';
import { createTestEnvironment } from '../../src/harness/EnvironmentFactory.js';
import type { ScenarioConfig, TestEnvironment } from '../../src/harness/types.js';

const scenario: ScenarioConfig = {
  name: 'review-fix-loop',
  sampleProject: 'fullstack-todo',
  phases: [
    'phase-0-entrance',
    'phase-1-propose',
    'phase-2-apply',
    'phase-3-review',
    'phase-4-unit-tests',
  ],
  toolId: 'claude',
  openspecMode: 'mock',
  changeName: 'review-loop-test',
  featureDescription: 'Exercise review fix loop with 3-round limit',
};

describe('E2E recovery - Review fix loop with attempt limit', () => {
  let env: TestEnvironment;

  beforeAll(async () => {
    env = await createTestEnvironment({
      sampleProject: scenario.sampleProject,
      toolId: scenario.toolId,
      changeName: scenario.changeName,
      openspecMode: 'mock',
    });

    // Run Phase 0-2 normally
    for (const phase of scenario.phases.slice(0, 3)) {
      const result = await deterministicPipelineExecutor(phase, '', env, scenario);
      expect(result.status).toBe('pass');
    }
  }, 120000);

  afterAll(async () => {
    if (env) await env.cleanup();
  });

  it('pauses pipeline after third review failure', async () => {
    // Simulate review finding issues three times in a row
    for (let i = 1; i <= 3; i++) {
      await runState(env, 'attempt', scenario.changeName, 'review', 'issues-found');
    }

    const state = await readState(env, scenario.changeName);
    expect(state.review.currentRound).toBe(3);
    expect(state.review.rounds).toHaveLength(3);
    expect(state.review.rounds.every((round) => round.status === 'issues-found')).toBe(true);
    expect(state.review.status).toBe('issues-found');
    // After 3 failures the status should be paused
    expect(state.status).toBe('paused');
  });

  it('can reset and recover from paused state after fixing issues', async () => {
    // Fix: write a valid review report and pass review
    const reviewRelative = `openspec/review/2099-01-01-00-00-${scenario.changeName}-pipeline-review.md`;
    await fs.outputFile(
      path.join(env.rootDir, reviewRelative),
      '# Fixed Review\n\n- Correctness: passed\n- Security: passed\n- Conventions: passed\n',
    );
    await runState(
      env,
      'set',
      scenario.changeName,
      'review.reportPath',
      JSON.stringify(reviewRelative),
    );
    await runState(env, 'attempt', scenario.changeName, 'review', 'passed');

    // Transition to Phase 4
    await runState(env, 'transition', scenario.changeName, '4', '13');

    const state = await readState(env, scenario.changeName);
    expect(state.currentPhase).toBe(4);
    expect(state.currentStep).toBe(13);
    expect(state.status).toBe('active');
    expect(state.review.currentRound).toBe(4);
    expect(state.review.rounds).toHaveLength(4);
    expect(state.review.rounds.map((round) => round.status)).toEqual([
      'issues-found',
      'issues-found',
      'issues-found',
      'passed',
    ]);
    expect(state.review.rounds[3]?.reportPath).toBe(reviewRelative);
    expect(state.review.status).toBe('passed');
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

interface LoopState {
  currentPhase: number;
  currentStep: number;
  status: string;
  review: {
    currentRound: number;
    rounds: Array<{
      round: number;
      status: string;
      reportPath: string | null;
      timestamp: string;
      decisions: Record<string, unknown>;
    }>;
    status: string;
    reportPath: string | null;
  };
}

async function readState(env: TestEnvironment, changeName: string): Promise<LoopState> {
  return fs.readJson(
    path.join(env.rootDir, 'openspec', '.pipeline-state', `${changeName}.json`),
  ) as Promise<LoopState>;
}
