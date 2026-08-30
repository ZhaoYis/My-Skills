import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupDirectories } from '../helpers/cleanup.js';
import { isSameFileSystemEntry } from '../helpers/filesystem.js';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const libUrl = pathToFileURL(
  path.join(PACKAGE_ROOT, 'src/templates/common/skills/opsx-dev-pipeline/scripts/pipeline-lib.mjs'),
).href;
const createdDirs: string[] = [];
let repo = '';
let bin = '';

interface ModuleResult {
  code: number;
  stdout: string;
  stderr: string;
}

beforeEach(async () => {
  repo = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-pipeline-lib-'));
  createdDirs.push(repo);
  bin = path.join(repo, 'mock&bin');
  await fs.ensureDir(bin);
  await runCommand('git', ['init', '--quiet'], repo);

  await writeNodeCommand(
    'fixture-command',
    `const mode = process.argv[2];
if (mode === 'success') process.stdout.write('{"status":"ok","items":[1,2]}\\n');
else if (mode === 'failure') { process.stderr.write('fixture failed\\n'); process.exit(7); }
else if (mode === 'empty') process.exit(0);
else if (mode === 'invalid') process.stdout.write('not-json\\n');
else if (mode === 'large') process.stdout.write('x'.repeat(11 * 1024 * 1024));
`,
  );
  await writeNodeCommand('openspec', 'process.exit(0);\n');
});

afterEach(async () => {
  await cleanupDirectories(createdDirs);
});

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ModuleResult> {
  return new Promise((resolve) => {
    execFile(command, args, { cwd, env }, (error, stdout, stderr) => {
      const code = error && 'code' in error && typeof error.code === 'number' ? error.code : 0;
      resolve({ code, stdout, stderr });
    });
  });
}

function runModule(source: string, env: NodeJS.ProcessEnv = commandEnv()): Promise<ModuleResult> {
  return runCommand(process.execPath, ['--input-type=module', '--eval', source], repo, env);
}

function commandEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}` };
}

async function writeNodeCommand(name: string, content: string): Promise<void> {
  const script = path.join(bin, `${name}.mjs`);
  await fs.outputFile(script, content);
  if (process.platform === 'win32') {
    const nodeExe = process.execPath.replace(/"/g, '""');
    const scriptPath = script.replace(/"/g, '""');
    await fs.outputFile(
      path.join(bin, `${name}.cmd`),
      `@echo off\r\n"${nodeExe}" "${scriptPath}" %*\r\nexit /b %ERRORLEVEL%\r\n`,
    );
  } else {
    const executable = path.join(bin, name);
    await fs.outputFile(executable, `#!/usr/bin/env node\n${content}`);
    await fs.chmod(executable, 0o755);
  }
}

describe('pipeline-lib', () => {
  it('wraps Windows command shims with cmd.exe', async () => {
    const result = await runModule(`
      import { resolveCommandInvocation } from ${JSON.stringify(libUrl)};
      process.stdout.write(JSON.stringify(
        resolveCommandInvocation(
          'C:\\\\tools & fixtures\\\\openspec.cmd',
          ['--version', 'name&value'],
          'win32'
        )
      ));
    `);

    const invocation = JSON.parse(result.stdout);
    expect(invocation).toMatchObject({
      command: process.env.ComSpec || 'cmd.exe',
      windowsVerbatimArguments: true,
    });
    expect(invocation.args.slice(0, 3)).toEqual(['/d', '/s', '/c']);
    expect(invocation.args[3]).toContain('tools^ ^&^ fixtures');
    expect(invocation.args[3]).toContain('name^&value');
  });

  it('accepts valid change names and identifiers', async () => {
    const result = await runModule(`
      import { validateChangeName, validateIdentifier } from ${JSON.stringify(libUrl)};
      for (const value of ['a', 'demo-change', 'change-123']) validateChangeName(value);
      for (const value of ['proposal', '.meta', '_internal', 'spec.v2']) {
        validateIdentifier('artifact-id', value);
      }
      process.stdout.write('ok');
    `);

    expect(result).toMatchObject({ code: 0, stdout: 'ok', stderr: '' });
  });

  it.each([
    '',
    '-leading',
    'trailing-',
    'Uppercase',
    'with_underscore',
    'a'.repeat(65),
  ])('rejects invalid change name %j', async (value) => {
    const result = await runModule(`
        import { validateChangeName } from ${JSON.stringify(libUrl)};
        validateChangeName(${JSON.stringify(value)});
      `);

    expect(result.code).toBe(4);
    expect(JSON.parse(result.stdout).reason).toBe('invalid-change-name');
  });

  it.each([
    '',
    '-leading',
    'contains space',
    'a'.repeat(129),
  ])('rejects invalid identifier %j', async (value) => {
    const result = await runModule(`
        import { validateIdentifier } from ${JSON.stringify(libUrl)};
        validateIdentifier('artifact-id', ${JSON.stringify(value)});
      `);

    expect(result.code).toBe(4);
    expect(JSON.parse(result.stdout).reason).toBe('invalid-identifier');
  });

  it('emits normalized structured errors with the requested exit code', async () => {
    const result = await runModule(`
      import { emitError } from ${JSON.stringify(libUrl)};
      emitError('fixture-error', String.raw\`C:\\temp\\file\`, 'retry', 9);
    `);

    expect(result.code).toBe(9);
    expect(JSON.parse(result.stdout)).toEqual({
      status: 'error',
      reason: 'fixture-error',
      detail: 'C:/temp/file',
      nextAction: 'retry',
    });
    expect(result.stderr).toBe('');
  });

  it('checks commands through PATH without executing them', async () => {
    const present = await runModule(`
      import { requireCommand } from ${JSON.stringify(libUrl)};
      requireCommand('fixture-command', 'missing-fixture', 'install-fixture');
      process.stdout.write('ok');
    `);
    expect(present).toMatchObject({ code: 0, stdout: 'ok' });

    const missing = await runModule(`
      import { requireCommand } from ${JSON.stringify(libUrl)};
      requireCommand('definitely-not-installed', 'missing-fixture', 'install-fixture');
    `);
    expect(missing.code).toBe(1);
    expect(JSON.parse(missing.stdout).reason).toBe('missing-fixture');
  });

  it('returns the repository root without changing directory', async () => {
    const nested = path.join(repo, 'packages/api');
    await fs.ensureDir(nested);
    const result = await runCommand(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import { getRepoRoot } from ${JSON.stringify(libUrl)}; process.stdout.write(getRepoRoot());`,
      ],
      nested,
      commandEnv(),
    );

    expect(result.code).toBe(0);
    expect(await isSameFileSystemEntry(result.stdout, repo)).toBe(true);
  });

  it('runs a command from the repository root and parses its JSON', async () => {
    const nested = path.join(repo, 'nested');
    await fs.ensureDir(nested);
    const result = await runCommand(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
          import { runJsonCommand } from ${JSON.stringify(libUrl)};
          const payload = runJsonCommand(['fixture-command', 'success'], {
            failureReason: 'fixture-failed', nextAction: 'retry-fixture'
          });
          process.stdout.write(JSON.stringify(payload));
        `,
      ],
      nested,
      commandEnv(),
    );

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ status: 'ok', items: [1, 2] });
  });

  it.each([
    ['failure', 5, 'fixture-failed'],
    ['empty', 6, 'command-output-empty'],
    ['invalid', 6, 'command-output-json-invalid'],
    ['large', 5, 'fixture-failed'],
  ] as const)('maps %s command output to exit %i', async (mode, code, reason) => {
    const result = await runModule(`
      import { runJsonCommand } from ${JSON.stringify(libUrl)};
      runJsonCommand(['fixture-command', ${JSON.stringify(mode)}], {
        failureReason: 'fixture-failed', nextAction: 'retry-fixture'
      });
    `);

    expect(result.code).toBe(code);
    expect(JSON.parse(result.stdout).reason).toBe(reason);
    expect(result.stderr).toBe('');
  });

  it('prepares an OpenSpec repository and returns its root', async () => {
    const result = await runModule(`
      import { prepareOpenSpecRepo } from ${JSON.stringify(libUrl)};
      process.stdout.write(prepareOpenSpecRepo());
    `);

    expect(result.code).toBe(0);
    expect(await isSameFileSystemEntry(result.stdout, repo)).toBe(true);
  });

  it('finds the nearest openspec project root and falls back to git root', async () => {
    // Case 1: No openspec/ directory → fall back to git root
    const noProject = await runModule(`
      import { findOpenSpecRoot } from ${JSON.stringify(libUrl)};
      process.stdout.write(findOpenSpecRoot());
    `);
    expect(noProject.code).toBe(0);
    expect(await isSameFileSystemEntry(noProject.stdout, repo)).toBe(true);

    // Case 2: openspec/ with config.yaml exists in a subdirectory
    const projectDir = path.join(repo, 'packages/my-app');
    await fs.ensureDir(path.join(projectDir, 'openspec', 'changes'));
    await fs.outputFile(path.join(projectDir, 'openspec', 'config.yaml'), 'schema: frontend\n');
    const nested = path.join(projectDir, 'src', 'components');
    await fs.ensureDir(nested);

    const result = await runCommand(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import { findOpenSpecRoot } from ${JSON.stringify(libUrl)}; process.stdout.write(findOpenSpecRoot());`,
      ],
      nested,
      commandEnv(),
    );

    expect(result.code).toBe(0);
    expect(await isSameFileSystemEntry(result.stdout, projectDir)).toBe(true);

    // Keep the relative path shorter than the typical Windows 8.3-to-long-path difference.
    const shallowProjectDir = path.join(repo, 'a');
    await fs.ensureDir(path.join(shallowProjectDir, 'openspec', 'changes'));
    const shallowResult = await runCommand(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import { findOpenSpecRoot } from ${JSON.stringify(libUrl)}; process.stdout.write(findOpenSpecRoot());`,
      ],
      shallowProjectDir,
      commandEnv(),
    );

    expect(shallowResult.code).toBe(0);
    expect(await isSameFileSystemEntry(shallowResult.stdout, shallowProjectDir)).toBe(true);

    // Case 3: openspec/changes/ (without config.yaml) also counts as a valid project
    const changelessDir = path.join(repo, 'packages/other-app');
    await fs.ensureDir(path.join(changelessDir, 'openspec', 'changes'));
    // No config.yaml — still valid because openspec/changes/ exists

    const result2 = await runCommand(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import { findOpenSpecRoot } from ${JSON.stringify(libUrl)}; process.stdout.write(findOpenSpecRoot());`,
      ],
      changelessDir,
      commandEnv(),
    );

    expect(result2.code).toBe(0);
    expect(await isSameFileSystemEntry(result2.stdout, changelessDir)).toBe(true);
  });
});
