import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'fs-extra';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deterministicPipelineExecutor } from '../../src/harness/DeterministicPipelineExecutor.js';
import { createTestEnvironment } from '../../src/harness/EnvironmentFactory.js';
import type { ScenarioConfig, TestEnvironment } from '../../src/harness/types.js';

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

const scenario: ScenarioConfig = {
  name: 'archive-pending-tasks-recovery',
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
  changeName: 'archive-recovery',
  featureDescription: 'Exercise pending-task archive recovery',
};

describe('E2E recovery - Archive with pending tasks', () => {
  let env: TestEnvironment;
  let tasksPath: string;

  beforeAll(async () => {
    env = await createTestEnvironment({
      sampleProject: scenario.sampleProject,
      toolId: scenario.toolId,
      changeName: scenario.changeName,
      openspecMode: 'mock',
    });
    tasksPath = path.join(
      env.rootDir,
      'openspec',
      'changes',
      scenario.changeName,
      'tasks.md',
    );

    for (const phase of scenario.phases.slice(0, 5)) {
      const result = await deterministicPipelineExecutor(phase, '', env, scenario);
      expect(result.status).toBe('pass');
    }
    const tasks = await fs.readFile(tasksPath, 'utf8');
    await fs.writeFile(tasksPath, tasks.replace('- [x]', '- [ ]'));
  }, 120000);

  afterAll(async () => {
    await env.cleanup();
  });

  it('returns structured archive failure and remains resumable in Phase5', async () => {
    const result = await runArchive(env, scenario.changeName);
    expect(result).toMatchObject({ code: 5, stderr: '' });
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: 'error',
      reason: 'openspec-archive-failed',
      nextAction: 'fix-validation-or-pending-tasks',
    });

    const state = await readState(env, scenario.changeName);
    expect(state).toMatchObject({ currentPhase: 5, currentStep: 15, status: 'active' });
    expect(state.archivePath).toBeNull();
  });

  it('recovers after pending work is explicitly dispositioned', async () => {
    const tasks = await fs.readFile(tasksPath, 'utf8');
    await fs.writeFile(
      tasksPath,
      `${tasks.replaceAll('- [ ]', '- [~]')}\n\nPending work dispositioned for follow-up.\n`,
    );

    const phase = await deterministicPipelineExecutor('phase-5-archive', '', env, scenario);
    expect(phase.status).toBe('pass');
    expect(phase.assertions?.every((assertion) => assertion.passed)).toBe(true);

    const state = await readState(env, scenario.changeName);
    expect(state).toMatchObject({
      currentPhase: 6,
      currentStep: 20,
      status: 'active',
      verify: { status: 'passed', attempts: 1 },
    });
    expect(state.archivePath).toContain('archive-recovery');
  });
});

function runArchive(env: TestEnvironment, changeName: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [path.join(env.skillRoot, 'scripts/archive.mjs'), changeName, '-y'],
      {
        cwd: env.rootDir,
        env: {
          ...process.env,
          PATH: `${env.mockBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
        },
      },
      (error, stdout, stderr) => {
        const code = error && 'code' in error && typeof error.code === 'number' ? error.code : 0;
        resolve({ code, stdout, stderr });
      },
    );
  });
}

interface RecoveryState {
  currentPhase: number;
  currentStep: number;
  status: string;
  archivePath: string | null;
  verify: { status: string; attempts: number };
}

async function readState(env: TestEnvironment, changeName: string): Promise<RecoveryState> {
  return fs.readJson(
    path.join(env.rootDir, 'openspec', '.pipeline-state', `${changeName}.json`),
  ) as Promise<RecoveryState>;
}
