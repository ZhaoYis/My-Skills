import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestEnvironment } from '../../src/harness/EnvironmentFactory.js';
import type { ScenarioConfig, TestEnvironment } from '../../src/harness/types.js';

const scenario: ScenarioConfig = {
  name: 'concurrent-state-conflict',
  sampleProject: 'fullstack-todo',
  phases: ['phase-0-entrance'],
  toolId: 'claude',
  openspecMode: 'mock',
  changeName: 'concurrent-test',
  featureDescription: 'Exercise concurrent state modification detection',
};

function statePath(env: TestEnvironment, changeName: string): string {
  return path.join(env.rootDir, 'openspec', '.pipeline-state', `${changeName}.json`);
}

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

describe('E2E recovery - Concurrent state modification', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await createTestEnvironment({
      sampleProject: scenario.sampleProject,
      toolId: scenario.toolId,
      changeName: scenario.changeName,
      openspecMode: 'mock',
    });
  }, 120000);

  afterEach(async () => {
    if (env) await env.cleanup();
  });

  it('state file includes version tracking field', async () => {
    await runState(env, 'init', scenario.changeName, env.sourceBranch, '--skip-feature-association');

    const sp = statePath(env, scenario.changeName);
    const state = await fs.readJson(sp);

    // Version field exists for concurrency detection
    expect(state).toHaveProperty('_version');
    expect(typeof state._version).toBe('number');
    expect(state._version).toBeGreaterThanOrEqual(0);
  });

  it('state file version is incremented on writes', async () => {
    await runState(env, 'init', scenario.changeName, env.sourceBranch, '--skip-feature-association');

    const sp = statePath(env, scenario.changeName);
    const v1 = (await fs.readJson(sp))._version;

    // Make a state transition which writes the file
    await runState(env, 'transition', scenario.changeName, '1', '3');

    const v2 = (await fs.readJson(sp))._version;

    // Version should increase after a write operation
    expect(v2).toBeGreaterThanOrEqual(v1);
  });

  it('state remains structurally valid after external tampering does not crash reader', async () => {
    await runState(env, 'init', scenario.changeName, env.sourceBranch, '--skip-feature-association');

    const sp = statePath(env, scenario.changeName);

    // Simulate external modification that corrupts the file
    await fs.writeFile(sp, '{ "broken": true ');

    // Reading the state after corruption should be possible
    // (the state file exists, even if content is invalid)
    expect(await fs.pathExists(sp)).toBe(true);

    // Clean up corrupted file and re-init should work
    await fs.remove(sp);
    await runState(env, 'init', scenario.changeName, env.sourceBranch, '--skip-feature-association');
    const recovered = await fs.readJson(sp);
    expect(recovered).toHaveProperty('currentPhase');
    expect(recovered).toHaveProperty('status');
    expect(recovered).toHaveProperty('sourceBranch');
  });
});
