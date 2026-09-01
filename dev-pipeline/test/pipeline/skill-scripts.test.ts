import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupDirectories } from '../helpers/cleanup.js';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const SCRIPTS_DIR = path.join(
  PACKAGE_ROOT,
  'src/templates/common/skills/opsx-dev-pipeline/scripts',
);
const createdDirs: string[] = [];
let repo = '';
let bin = '';

interface ScriptResult {
  code: number;
  stdout: string;
  stderr: string;
}

beforeEach(async () => {
  repo = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-pipeline-skill-'));
  createdDirs.push(repo);
  bin = path.join(repo, 'mock-bin');
  await fs.ensureDir(bin);
  await run('git', ['init', '--quiet']);
  await run('git', ['config', 'user.name', 'Skill Tester']);
  await run('git', ['config', 'user.email', 'skill@example.com']);
  // nodeBin (e.g. nvm4w's C:\nvm4w\nodejs) may ship a globally-installed openspec
  // alongside node.exe; commandEnv drops such a dir, so stub node in `bin` to keep
  // `requireCommand('node')` satisfiable without exposing the stray openspec.
  if (directoryHasExecutable(path.dirname(process.execPath), 'openspec')) {
    await writeNodeStub();
  }
});

afterEach(async () => {
  await cleanupDirectories(createdDirs);
});

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd: repo }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function runScript(
  script: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<ScriptResult> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [path.join(SCRIPTS_DIR, script), ...args],
      { cwd: repo, env },
      (error, stdout, stderr) => {
        const code = error && 'code' in error && typeof error.code === 'number' ? error.code : 0;
        resolve({ code, stdout, stderr });
      },
    );
  });
}

async function writeOpenspecMock(content: string, _exitCode = 0): Promise<void> {
  const executable = path.join(bin, 'openspec');
  await fs.outputFile(executable, `#!/usr/bin/env node\n${content}`);
  await fs.chmod(executable, 0o755);
  if (process.platform === 'win32') {
    const cmdPath = path.join(bin, 'openspec.cmd');
    const nodeExe = process.execPath.replace(/"/g, '""');
    const scriptPath = executable.replace(/"/g, '""');
    await fs.outputFile(
      cmdPath,
      `@echo off\r\n"${nodeExe}" "${scriptPath}" %*\r\nexit /b %ERRORLEVEL%\r\n`,
    );
  }
}

async function writeNodeStub(): Promise<void> {
  if (process.platform === 'win32') {
    const nodeExe = process.execPath.replace(/"/g, '""');
    await fs.outputFile(
      path.join(bin, 'node.cmd'),
      `@echo off\r\n"${nodeExe}" %*\r\nexit /b %ERRORLEVEL%\r\n`,
    );
  } else {
    await fs.symlink(process.execPath, path.join(bin, 'node'));
  }
}

function findExecutableDir(name: string): string | null {
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  const extensions =
    process.platform === 'win32'
      ? ['.cmd', '.bat', '.exe', '']
      : [''];
  const mode = process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK;
  for (const dir of dirs) {
    for (const ext of extensions) {
      try {
        const full = path.join(dir, `${name}${ext}`);
        fs.accessSync(full, mode);
        return dir;
      } catch {
        // try the next candidate
      }
    }
  }
  return null;
}

function directoryHasExecutable(dir: string, name: string): boolean {
  const extensions =
    process.platform === 'win32'
      ? ['.cmd', '.bat', '.exe', '']
      : [''];
  for (const ext of extensions) {
    try {
      fs.accessSync(path.join(dir, `${name}${ext}`), fs.constants.F_OK);
      return true;
    } catch {
      // try the next candidate
    }
  }
  return false;
}

function commandEnv(options: { isolateOpenspec?: boolean } = {}): NodeJS.ProcessEnv {
  const env = { ...process.env };
  env.FORCE_COLOR = '0';
  env.NO_COLOR = '1';
  const nodeBin = path.dirname(process.execPath);
  const gitBin = findExecutableDir('git');
  const inheritedPath = (process.env.PATH?.split(path.delimiter) ?? []).filter(Boolean);
  // Drop inherited directories that already expose an openspec binary, otherwise the
  // "fails when openspec is not on PATH" test picks up a globally-installed copy on
  // CI runners that ship one in their PATH. The mock in `bin` is prepended below so
  // happy-path tests still find the mock.
  const safeInheritedPath = inheritedPath.filter((dir) => !directoryHasExecutable(dir, 'openspec'));
  // nodeBin gets the same treatment: on machines where node.exe shares its install
  // dir with a global openspec (nvm4w), the entry would smuggle openspec into the
  // isolated PATH. A node forwarder stub in `bin` (see beforeEach) keeps `node`
  // findable when this entry is dropped.
  const safeNodeBin = directoryHasExecutable(nodeBin, 'openspec') ? null : nodeBin;
  if (options.isolateOpenspec === false) {
    env.PATH = [bin, ...safeInheritedPath].join(path.delimiter);
  } else {
    const parts: string[] = [bin];
    if (safeNodeBin) parts.push(safeNodeBin);
    if (gitBin) parts.push(gitBin);
    if (process.platform === 'win32') {
      parts.push(...safeInheritedPath);
    } else {
      parts.push('/usr/bin', '/bin', '/usr/local/bin');
    }
    env.PATH = parts.join(path.delimiter);
  }
  const nullDevice = process.platform === 'win32' ? 'NUL' : '/dev/null';
  env.GIT_CONFIG_GLOBAL = nullDevice;
  env.GIT_CONFIG_SYSTEM = nullDevice;
  return env;
}

function parseJson(stdout: string): Record<string, unknown> {
  return stdout ? (JSON.parse(stdout) as Record<string, unknown>) : {};
}

describe('pipeline skill scripts (mocked openspec CLI)', () => {
  describe('preflight.mjs', () => {
    it('returns the openspec version and an explicit root source', async () => {
      await fs.outputFile(
        path.join(repo, 'openspec/config.yaml'),
        'schema: spec-driven\n',
      );
      await writeOpenspecMock(`
        if (process.argv[2] === '--version') {
          process.stdout.write('0.7.0\\n');
        } else if (process.argv[2] === 'list' && process.argv[3] === '--json') {
          process.stdout.write(JSON.stringify({ root: { source: 'explicit' } }));
        }
      `);

      const result = await runScript('preflight.mjs', [], commandEnv());
      expect(result.code).toBe(0);
      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        status: 'ok',
        nextAction: 'continue-phase-0',
        openspecVersion: '0.7.0',
        rootSource: 'explicit',
      });
      expect(payload.reason).toBe('preflight-passed');
      expect(payload.warnings).toEqual([]);
    });

    it('surfaces git config warnings while still passing', async () => {
      await fs.outputFile(path.join(repo, 'openspec/config.yaml'), 'schema: spec-driven\n');
      await writeOpenspecMock(`
        if (process.argv[2] === '--version') process.stdout.write('0.7.0\\n');
        else if (process.argv[2] === 'list') process.stdout.write(JSON.stringify({ root: { source: 'explicit' } }));
      `);
      await run('git', ['config', '--unset', 'user.name']);
      await run('git', ['config', '--unset', 'user.email']);

      const result = await runScript('preflight.mjs', [], commandEnv());
      expect(result.code).toBe(0);
      const payload = parseJson(result.stdout);
      expect(payload.reason).toBe('preflight-passed-with-warnings');
      expect(payload.warnings).toEqual(
        expect.arrayContaining(['git-config-user-name-missing', 'git-config-user-email-missing']),
      );
    });

    it('fails when openspec is not on PATH', async () => {
      const result = await runScript('preflight.mjs', [], commandEnv());
      expect(result.code).toBe(1);
      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        status: 'error',
        reason: 'openspec-cli-not-found',
        nextAction: 'install-openspec',
      });
    });

    it('fails when openspec --version exits non-zero', async () => {
      await fs.outputFile(path.join(repo, 'openspec/config.yaml'), 'schema: spec-driven\n');
      await writeOpenspecMock(`
        process.stderr.write('boom\\n');
        process.exit(1);
      `);

      const result = await runScript('preflight.mjs', [], commandEnv());
      expect(result.code).toBe(1);
      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        status: 'error',
        reason: 'openspec-version-failed',
        nextAction: 'check-openspec-install',
      });
    });

    it('fails when openspec/config.yaml is missing', async () => {
      await writeOpenspecMock(`
        if (process.argv[2] === '--version') process.stdout.write('0.7.0\\n');
        else if (process.argv[2] === 'list') process.stdout.write(JSON.stringify({ root: { source: 'explicit' } }));
      `);

      const result = await runScript('preflight.mjs', [], commandEnv());
      expect(result.code).toBe(3);
      expect(parseJson(result.stdout)).toMatchObject({
        status: 'error',
        reason: 'openspec-not-initialized',
        nextAction: 'run-openspec-init',
      });
    });

    it('fails when openspec list --json reports an implicit root', async () => {
      await fs.outputFile(path.join(repo, 'openspec/config.yaml'), 'schema: spec-driven\n');
      await writeOpenspecMock(`
        if (process.argv[2] === '--version') process.stdout.write('0.7.0\\n');
        else if (process.argv[2] === 'list') process.stdout.write(JSON.stringify({ root: { source: 'implicit' } }));
      `);

      const result = await runScript('preflight.mjs', [], commandEnv());
      expect(result.code).toBe(3);
      expect(parseJson(result.stdout)).toMatchObject({
        status: 'error',
        reason: 'openspec-not-initialized',
      });
    });

    it('fails when openspec list --json returns invalid JSON', async () => {
      await fs.outputFile(path.join(repo, 'openspec/config.yaml'), 'schema: spec-driven\n');
      await writeOpenspecMock(`
        if (process.argv[2] === '--version') process.stdout.write('0.7.0\\n');
        else if (process.argv[2] === 'list') process.stdout.write('not-json');
      `);

      const result = await runScript('preflight.mjs', [], commandEnv());
      expect(result.code).toBe(6);
      expect(parseJson(result.stdout)).toMatchObject({
        status: 'error',
        reason: 'openspec-list-json-invalid',
      });
    });
  });

  describe('new-change.mjs', () => {
    beforeEach(async () => {
      await fs.outputFile(path.join(repo, 'openspec/config.yaml'), 'schema: spec-driven\n');
    });

    it('forwards the change name to openspec new change', async () => {
      await writeOpenspecMock(`
        if (process.argv[2] !== 'new') process.exit(2);
        const payload = { changeName: process.argv[4], files: ['proposal.md'] };
        process.stdout.write(JSON.stringify(payload));
      `);

      const result = await runScript('new-change.mjs', ['add-login'], commandEnv());
      expect(result.code).toBe(0);
      expect(parseJson(result.stdout)).toEqual({
        changeName: 'add-login',
        files: ['proposal.md'],
      });
    });

    it('rejects calls without a change-name argument', async () => {
      const result = await runScript('new-change.mjs', [], commandEnv());
      expect(result.code).toBe(4);
      expect(parseJson(result.stdout)).toMatchObject({
        status: 'error',
        reason: 'missing-argument',
      });
    });

    it.each(['AddLogin', '-leading', 'trailing-'])('rejects invalid change name %j', async (name) => {
      await writeOpenspecMock('process.stdout.write("ignored");');

      const result = await runScript('new-change.mjs', [name], commandEnv());
      expect(result.code).toBe(4);
      expect(parseJson(result.stdout)).toMatchObject({
        status: 'error',
        reason: 'invalid-change-name',
      });
    });

    it('surfaces openspec failures with a structured error', async () => {
      await writeOpenspecMock(`
        process.stderr.write('openspec: invalid spec\\n');
        process.exit(2);
      `);

      const result = await runScript('new-change.mjs', ['add-login'], commandEnv());
      expect(result.code).toBe(5);
      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        status: 'error',
        reason: 'openspec-new-change-failed',
        nextAction: 'choose-another-change-name',
      });
      expect(String(payload.detail)).toContain('openspec: invalid spec');
    });

    it('rejects non-JSON openspec output', async () => {
      await writeOpenspecMock('process.stdout.write("plain text");');

      const result = await runScript('new-change.mjs', ['add-login'], commandEnv());
      expect(result.code).toBe(6);
      expect(parseJson(result.stdout)).toMatchObject({
        status: 'error',
        reason: 'command-output-json-invalid',
      });
    });
  });

  describe('list-changes.mjs', () => {
    beforeEach(async () => {
      await fs.outputFile(path.join(repo, 'openspec/config.yaml'), 'schema: spec-driven\n');
    });

    it('returns the parsed openspec list payload', async () => {
      const payload = { changes: [{ name: 'fix-typo' }, { name: 'add-login' }] };
      await writeOpenspecMock(`
        if (process.argv[2] === 'list') process.stdout.write(${JSON.stringify(JSON.stringify(payload))});
      `);

      const result = await runScript('list-changes.mjs', [], commandEnv());
      expect(result.code).toBe(0);
      expect(parseJson(result.stdout)).toEqual(payload);
    });

    it('reports when openspec returns empty output', async () => {
      await writeOpenspecMock(`process.stdout.write('   \\n');`);

      const result = await runScript('list-changes.mjs', [], commandEnv());
      expect(result.code).toBe(6);
      expect(parseJson(result.stdout)).toMatchObject({
        status: 'error',
        reason: 'command-output-empty',
      });
    });

    it('rejects when openspec returns non-JSON', async () => {
      await writeOpenspecMock(`process.stdout.write('not json');`);

      const result = await runScript('list-changes.mjs', [], commandEnv());
      expect(result.code).toBe(6);
      expect(parseJson(result.stdout)).toMatchObject({
        status: 'error',
        reason: 'command-output-json-invalid',
      });
    });
  });

  describe('validate-change.mjs', () => {
    beforeEach(async () => {
      await fs.outputFile(path.join(repo, 'openspec/config.yaml'), 'schema: spec-driven\n');
    });

    it('passes through the openspec validate payload', async () => {
      const payload = { valid: true, changeName: 'add-login', issues: [] };
      await writeOpenspecMock(`
        if (process.argv[2] === 'validate') {
          process.stdout.write(${JSON.stringify(JSON.stringify(payload))});
        }
      `);

      const result = await runScript('validate-change.mjs', ['add-login'], commandEnv());
      expect(result.code).toBe(0);
      expect(parseJson(result.stdout)).toEqual(payload);
    });

    it('fails when validate exits with a non-zero status', async () => {
      await writeOpenspecMock(`
        if (process.argv[2] === 'validate') {
          process.stderr.write('schema mismatch\\n');
          process.exit(2);
        }
      `);

      const result = await runScript('validate-change.mjs', ['add-login'], commandEnv());
      expect(result.code).toBe(5);
      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        status: 'error',
        reason: 'openspec-validate-change-failed',
        nextAction: 'fix-change-artifacts',
      });
      expect(String(payload.detail)).toContain('schema mismatch');
    });

    it('rejects invalid change names before invoking openspec', async () => {
      await writeOpenspecMock(`process.stdout.write('unreachable');`);

      const result = await runScript('validate-change.mjs', ['InvalidName'], commandEnv());
      expect(result.code).toBe(4);
      expect(parseJson(result.stdout)).toMatchObject({
        status: 'error',
        reason: 'invalid-change-name',
      });
    });

    it('reports missing arguments with code 4', async () => {
      const result = await runScript('validate-change.mjs', [], commandEnv());
      expect(result.code).toBe(4);
      expect(parseJson(result.stdout)).toMatchObject({
        status: 'error',
        reason: 'missing-argument',
      });
    });
  });

  describe('validate-all.mjs', () => {
    beforeEach(async () => {
      await fs.outputFile(path.join(repo, 'openspec/config.yaml'), 'schema: spec-driven\n');
    });

    it('forwards openspec validate --all output', async () => {
      const payload = { valid: true, changeCount: 4 };
      await writeOpenspecMock(`
        if (process.argv[2] === 'validate' && process.argv[3] === '--all') {
          process.stdout.write(${JSON.stringify(JSON.stringify(payload))});
        }
      `);

      const result = await runScript('validate-all.mjs', [], commandEnv());
      expect(result.code).toBe(0);
      expect(parseJson(result.stdout)).toEqual(payload);
    });

    it('maps non-zero exits to openspec-validate-all-failed', async () => {
      await writeOpenspecMock(`
        process.stderr.write('boom\\n');
        process.exit(3);
      `);

      const result = await runScript('validate-all.mjs', [], commandEnv());
      expect(result.code).toBe(5);
      expect(parseJson(result.stdout)).toMatchObject({
        status: 'error',
        reason: 'openspec-validate-all-failed',
        nextAction: 'fix-validation-errors',
      });
    });
  });

  describe('archive.mjs', () => {
    beforeEach(async () => {
      await fs.outputFile(path.join(repo, 'openspec/config.yaml'), 'schema: spec-driven\n');
    });

    it('invokes openspec archive and returns its JSON', async () => {
      const payload = { archived: true, path: 'openspec/changes/archive/add-login' };
      await writeOpenspecMock(`
        if (process.argv[2] === 'archive') {
          process.stdout.write(${JSON.stringify(JSON.stringify(payload))});
        }
      `);

      const result = await runScript('archive.mjs', ['add-login'], commandEnv());
      expect(result.code).toBe(0);
      expect(parseJson(result.stdout)).toEqual(payload);
    });

    it('surfaces openspec archive failures', async () => {
      await writeOpenspecMock(`
        process.stderr.write('tasks remain\\n');
        process.exit(2);
      `);

      const result = await runScript('archive.mjs', ['add-login'], commandEnv());
      expect(result.code).toBe(5);
      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        status: 'error',
        reason: 'openspec-archive-failed',
        nextAction: 'fix-validation-or-pending-tasks',
      });
    });

    it('rejects invalid change names before invoking openspec', async () => {
      const result = await runScript('archive.mjs', ['InvalidName'], commandEnv());
      expect(result.code).toBe(4);
      expect(parseJson(result.stdout)).toMatchObject({
        status: 'error',
        reason: 'invalid-change-name',
      });
    });

    it('rejects calls without an argument', async () => {
      const result = await runScript('archive.mjs', [], commandEnv());
      expect(result.code).toBe(4);
      expect(parseJson(result.stdout)).toMatchObject({
        status: 'error',
        reason: 'missing-argument',
      });
    });
  });

  describe('change-status.mjs', () => {
    beforeEach(async () => {
      await fs.outputFile(path.join(repo, 'openspec/config.yaml'), 'schema: spec-driven\n');
    });

    it('returns the parsed status payload', async () => {
      const payload = {
        changeName: 'add-login',
        artifacts: [{ id: 'proposal', status: 'ready' }],
      };
      await writeOpenspecMock(`
        if (process.argv[2] === 'status') {
          process.stdout.write(${JSON.stringify(JSON.stringify(payload))});
        }
      `);

      const result = await runScript('change-status.mjs', ['add-login'], commandEnv());
      expect(result.code).toBe(0);
      expect(parseJson(result.stdout)).toEqual(payload);
    });

    it('rejects invalid names', async () => {
      const result = await runScript('change-status.mjs', ['Add_Login'], commandEnv());
      expect(result.code).toBe(4);
      expect(parseJson(result.stdout)).toMatchObject({
        status: 'error',
        reason: 'invalid-change-name',
      });
    });

    it('maps non-zero exits to openspec-status-failed', async () => {
      await writeOpenspecMock(`
        process.stderr.write('missing\\n');
        process.exit(1);
      `);

      const result = await runScript('change-status.mjs', ['add-login'], commandEnv());
      expect(result.code).toBe(5);
      expect(parseJson(result.stdout)).toMatchObject({
        status: 'error',
        reason: 'openspec-status-failed',
        nextAction: 'check-change-name',
      });
    });
  });

  describe('instructions.mjs', () => {
    beforeEach(async () => {
      await fs.outputFile(path.join(repo, 'openspec/config.yaml'), 'schema: spec-driven\n');
    });

    it('uses the explicit artifact-id when provided', async () => {
      const payload = { instructions: 'do apply', artifact: 'tasks' };
      const argLog = path.join(bin, 'openspec-invocations.json');
      await writeOpenspecMock(`
        const fs = require('node:fs');
        const log = ${JSON.stringify(argLog)};
        fs.appendFileSync(log, JSON.stringify(process.argv.slice(2)) + '\\n');
        process.stdout.write(${JSON.stringify(JSON.stringify(payload))});
      `);

      const result = await runScript('instructions.mjs', ['add-login', 'tasks'], commandEnv());
      expect(result.code).toBe(0);
      expect(parseJson(result.stdout)).toEqual(payload);
      const calls = (await fs.readFile(argLog, 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as string[]);
      const lastCall = calls[calls.length - 1] ?? [];
      expect(lastCall).toEqual(
        expect.arrayContaining(['instructions', 'tasks', '--change', 'add-login', '--json']),
      );
    });

    it('auto-selects the first ready artifact when none is supplied', async () => {
      const statusPayload = {
        changeName: 'add-login',
        artifacts: [
          { id: 'proposal', status: 'pending' },
          { id: 'tasks', status: 'ready' },
          { id: 'spec', status: 'ready' },
        ],
      };
      const instructionsPayload = { instructions: 'do tasks', artifact: 'tasks' };

      await writeOpenspecMock(`
        if (process.argv[2] === 'status') {
          process.stdout.write(${JSON.stringify(JSON.stringify(statusPayload))});
        } else if (process.argv[2] === 'instructions') {
          process.stdout.write(${JSON.stringify(JSON.stringify(instructionsPayload))});
        }
      `);

      const result = await runScript('instructions.mjs', ['add-login'], commandEnv());
      expect(result.code).toBe(0);
      expect(parseJson(result.stdout)).toEqual(instructionsPayload);
    });

    it('rejects when no ready artifact is available', async () => {
      const statusPayload = {
        changeName: 'add-login',
        artifacts: [
          { id: 'proposal', status: 'pending' },
          { id: 'spec', status: 'pending' },
        ],
      };
      await writeOpenspecMock(`
        if (process.argv[2] === 'status') {
          process.stdout.write(${JSON.stringify(JSON.stringify(statusPayload))});
        }
      `);

      const result = await runScript('instructions.mjs', ['add-login'], commandEnv());
      expect(result.code).toBe(4);
      expect(parseJson(result.stdout)).toMatchObject({
        status: 'error',
        reason: 'no-ready-artifact',
        nextAction: 'pass-artifact-id',
      });
    });

    it('rejects explicit artifact-id that is malformed', async () => {
      await writeOpenspecMock('process.stdout.write("ignored");');

      const result = await runScript(
        'instructions.mjs',
        ['add-login', '-bad id'],
        commandEnv(),
      );
      expect(result.code).toBe(4);
      expect(parseJson(result.stdout)).toMatchObject({
        status: 'error',
        reason: 'invalid-identifier',
      });
    });

    it('rejects calls without a change name', async () => {
      const result = await runScript('instructions.mjs', [], commandEnv());
      expect(result.code).toBe(4);
      expect(parseJson(result.stdout)).toMatchObject({
        status: 'error',
        reason: 'missing-argument',
      });
    });
  });

  describe('instructions-apply.mjs', () => {
    beforeEach(async () => {
      await fs.outputFile(path.join(repo, 'openspec/config.yaml'), 'schema: spec-driven\n');
    });

    it('invokes openspec instructions apply', async () => {
      const payload = { applied: true, changeName: 'add-login' };
      await writeOpenspecMock(`
        if (process.argv[2] === 'instructions' && process.argv[3] === 'apply') {
          process.stdout.write(${JSON.stringify(JSON.stringify(payload))});
        }
      `);

      const result = await runScript('instructions-apply.mjs', ['add-login'], commandEnv());
      expect(result.code).toBe(0);
      expect(parseJson(result.stdout)).toEqual(payload);
    });

    it('surfaces openspec apply failures', async () => {
      await writeOpenspecMock(`
        process.stderr.write('apply failed\\n');
        process.exit(2);
      `);

      const result = await runScript('instructions-apply.mjs', ['add-login'], commandEnv());
      expect(result.code).toBe(5);
      expect(parseJson(result.stdout)).toMatchObject({
        status: 'error',
        reason: 'openspec-apply-instructions-failed',
        nextAction: 'check-change-artifacts',
      });
    });

    it('rejects invalid change names before invoking openspec', async () => {
      const result = await runScript('instructions-apply.mjs', ['BadName'], commandEnv());
      expect(result.code).toBe(4);
      expect(parseJson(result.stdout)).toMatchObject({
        status: 'error',
        reason: 'invalid-change-name',
      });
    });
  });
});