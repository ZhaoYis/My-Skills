import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'fs-extra';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deterministicPipelineExecutor } from '../../src/harness/DeterministicPipelineExecutor.js';
import { createTestEnvironment } from '../../src/harness/EnvironmentFactory.js';
import type { ScenarioConfig, TestEnvironment } from '../../src/harness/types.js';

const execFileAsync = promisify(execFile);

const scenario: ScenarioConfig = {
  name: 'network-push-failure',
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
  changeName: 'network-fail-test',
  featureDescription: 'Exercise network failure during push recovery',
};

describe('E2E recovery - Network failure during push', () => {
  let env: TestEnvironment;

  beforeAll(async () => {
    env = await createTestEnvironment({
      sampleProject: scenario.sampleProject,
      toolId: scenario.toolId,
      changeName: scenario.changeName,
      openspecMode: 'mock',
    });

    // Run Phase 0-5 normally
    for (const phase of scenario.phases) {
      const result = await deterministicPipelineExecutor(phase, '', env, scenario);
      expect(result.status).toBe('pass');
    }
  }, 120000);

  afterAll(async () => {
    if (env) await env.cleanup();
  });

  it('fails gracefully when remote is unavailable during push', async () => {
    // Simulate network failure by removing the remote directory
    const remoteBackup = `${env.remotePath}.backup`;
    await fs.move(env.remotePath, remoteBackup);

    try {
      // Attempt to push — should fail because remote is gone
      await expect(
        execFileAsync('git', ['push', 'origin', env.sourceBranch], { cwd: env.rootDir }),
      ).rejects.toThrow();
    } finally {
      // Restore remote for subsequent tests
      await fs.move(remoteBackup, env.remotePath, { overwrite: true });
    }
  });

  it('state remains resumable after push failure', async () => {
    const state = await fs.readJson(
      path.join(env.rootDir, 'openspec', '.pipeline-state', `${scenario.changeName}.json`),
    );
    // State should still be active — not corrupted by the failed push
    expect(state.currentPhase).toBe(6);
    expect(state.currentStep).toBe(20);
    expect(state.status).toBe('active');
  });

  it('push succeeds after remote is restored', async () => {
    // Restore remote and push should now work
    await execFileAsync('git', ['push', '-u', 'origin', env.sourceBranch], { cwd: env.rootDir });

    // Verify remote has the ref
    const lsResult = await execFileAsync('git', [
      'ls-remote',
      env.remotePath,
      `refs/heads/${env.sourceBranch}`,
    ]);
    expect(lsResult.stdout.trim()).toBeTruthy();
  });
});
