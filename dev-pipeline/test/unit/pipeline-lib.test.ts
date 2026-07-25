import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const libUrl = pathToFileURL(
  path.join(PACKAGE_ROOT, 'templates/common/skills/opsx-dev-pipeline/scripts/pipeline-lib.mjs'),
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
  bin = path.join(repo, 'mock-bin');
  await fs.ensureDir(bin);
  await runCommand('git', ['init', '--quiet'], repo);

  await writeExecutable(
    'fixture-command',
    `#!/usr/bin/env bash
case "\${1:-}" in
  success) printf '%s\\n' '{"status":"ok","items":[1,2]}' ;;
  failure) printf '%s\\n' 'fixture failed' >&2; exit 7 ;;
  empty) exit 0 ;;
  invalid) printf '%s\\n' 'not-json' ;;
  large) node -e 'process.stdout.write("x".repeat(11 * 1024 * 1024))' ;;
esac
`,
  );
  await writeExecutable('openspec', '#!/usr/bin/env bash\nexit 0\n');
});

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
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

async function writeExecutable(name: string, content: string): Promise<void> {
  const file = path.join(bin, name);
  await fs.outputFile(file, content);
  await fs.chmod(file, 0o755);
}

describe('pipeline-lib', () => {
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
    expect(await fs.realpath(result.stdout)).toBe(await fs.realpath(repo));
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
    expect(await fs.realpath(result.stdout)).toBe(await fs.realpath(repo));
  });
});
