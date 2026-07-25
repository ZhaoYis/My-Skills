import { execFile } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestEnvironment } from '../../src/harness/EnvironmentFactory.js';
import type { TestEnvironment } from '../../src/harness/types.js';

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

describe('E2E recovery - OpenSpec dependency missing', () => {
  let env: TestEnvironment;

  beforeAll(async () => {
    env = await createTestEnvironment({
      sampleProject: 'fullstack-todo',
      toolId: 'claude',
      changeName: 'missing-openspec',
      openspecMode: 'missing',
    });
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it('returns the stable dependency error from the installed preflight script', async () => {
    const result = await runCommand(
      '/bin/bash',
      [path.join(env.skillRoot, 'scripts/dev-pipeline-preflight.sh')],
      env.rootDir,
      { ...process.env, PATH: '/usr/bin:/bin' },
    );

    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: 'error',
      reason: 'openspec-cli-not-found',
      nextAction: 'install-openspec',
    });
    expect(result.stderr).toBe('');
  });

  it('does not create pipeline state when preflight cannot run', async () => {
    expect(
      await import('fs-extra').then((fs) =>
        fs.pathExists(path.join(env.rootDir, 'openspec/.pipeline-state/missing-openspec.json')),
      ),
    ).toBe(false);
  });
});

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(command, args, { cwd, env }, (error, stdout, stderr) => {
      const code = error && 'code' in error && typeof error.code === 'number' ? error.code : 0;
      resolve({ code, stdout, stderr });
    });
  });
}
