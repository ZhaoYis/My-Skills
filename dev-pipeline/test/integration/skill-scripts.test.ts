import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanupDirectories } from '../helpers/cleanup.js';
import { isSameFileSystemEntry } from '../helpers/filesystem.js';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const scriptsRoot = path.join(
  PACKAGE_ROOT,
  'src/templates/common/skills/opsx-dev-pipeline/scripts',
);
const createdDirs: string[] = [];

interface ScriptResult {
  code: number;
  stdout: string;
  stderr: string;
}

afterEach(async () => {
  await cleanupDirectories(createdDirs);
});

async function createRepo(initialized: boolean): Promise<{ root: string; bin: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-scripts-'));
  createdDirs.push(root);
  const bin = path.join(root, 'mock-bin');
  await fs.ensureDir(bin);
  await exec('git', ['init', '--quiet'], root);

  if (initialized) {
    await fs.outputFile(path.join(root, 'openspec/config.yaml'), 'schema: spec-driven\n');
  }

  const mock = `
const command = process.argv[2];
if (command === '--version') {
  process.stdout.write('1.6.0\\n');
  process.exit(0);
}
switch (command) {
  case 'list':
    process.stdout.write((process.env.MOCK_LIST_JSON || JSON.stringify({
      changes: [], root: { path: process.cwd(), source: 'config' }
    })) + '\\n');
    break;
  case 'status':
    process.stdout.write((process.env.MOCK_STATUS_JSON ||
      '{"artifacts":[{"id":"proposal","status":"ready"}]}') + '\\n');
    break;
  case 'instructions':
    process.stdout.write(JSON.stringify({ status: 'ok', cwd: process.cwd() }) + '\\n');
    break;
  case 'archive':
    if (process.env.MOCK_ARCHIVE_EXIT) {
      process.stdout.write('{"status":"error","reason":"pending-tasks"}\\n');
      process.exit(Number(process.env.MOCK_ARCHIVE_EXIT));
    }
    process.stdout.write((process.env.MOCK_ARCHIVE_JSON || '{"status":"ok"}') + '\\n');
    break;
  case 'new':
  case 'validate':
    process.stdout.write('{"status":"ok"}\\n');
    break;
  default:
    process.stdout.write('{"status":"error","reason":"unexpected-mock-command"}\\n');
    process.exit(9);
}
`;
  const mockScript = path.join(bin, 'openspec.mjs');
  await fs.outputFile(mockScript, mock);
  if (process.platform === 'win32') {
    const nodeExe = process.execPath.replace(/"/g, '""');
    const mockPath = mockScript.replace(/"/g, '""');
    await fs.outputFile(
      path.join(bin, 'openspec.cmd'),
      `@echo off\r\n"${nodeExe}" "${mockPath}" %*\r\nexit /b %ERRORLEVEL%\r\n`,
    );
  } else {
    const mockPath = path.join(bin, 'openspec');
    await fs.outputFile(mockPath, `#!/usr/bin/env node\n${mock}`);
    await fs.chmod(mockPath, 0o755);
  }
  return { root, bin };
}

function exec(command: string, args: string[], cwd: string): Promise<ScriptResult> {
  return new Promise((resolve) => {
    execFile(command, args, { cwd }, (error, stdout, stderr) => {
      const code = error && 'code' in error && typeof error.code === 'number' ? error.code : 0;
      resolve({ code, stdout, stderr });
    });
  });
}

function runScript(
  script: string,
  args: string[],
  cwd: string,
  bin: string,
  extraEnv: NodeJS.ProcessEnv = {},
): Promise<ScriptResult> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [path.join(scriptsRoot, script), ...args],
      {
        cwd,
        env: {
          ...process.env,
          PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
          ...extraEnv,
        },
      },
      (error, stdout, stderr) => {
        const code = error && 'code' in error && typeof error.code === 'number' ? error.code : 0;
        resolve({ code, stdout, stderr });
      },
    );
  });
}

describe('opsx-dev-pipeline script contracts', () => {
  it('returns a stable dependency error when OpenSpec is not installed', async () => {
    const { root, bin } = await createRepo(false);
    const result = await runScript('preflight.mjs', [], root, bin, {
      PATH: '',
    });

    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: 'error',
      reason: 'openspec-cli-not-found',
      nextAction: 'install-openspec',
    });
    expect(result.stderr).toBe('');
  });

  it('rejects an implicit OpenSpec root as not initialized', async () => {
    const { root, bin } = await createRepo(false);
    const result = await runScript('preflight.mjs', [], root, bin, {
      MOCK_LIST_JSON: JSON.stringify({ changes: [], root: { path: root, source: 'implicit' } }),
    });

    expect(result.code).toBe(3);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: 'error',
      reason: 'openspec-not-initialized',
    });
    expect(result.stderr).toBe('');
  });

  it('accepts an initialized OpenSpec repository', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('preflight.mjs', [], root, bin);
    const payload = JSON.parse(result.stdout) as { status: string; rootSource: string };

    expect(result.code).toBe(0);
    expect(payload.status).toBe('ok');
    expect(payload.rootSource).toBe('config');
  });

  it('returns structured JSON when status output is invalid', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('instructions.mjs', ['demo-change'], root, bin, {
      MOCK_STATUS_JSON: 'not-json',
    });

    expect(result.code).toBe(6);
    expect(JSON.parse(result.stdout).reason).toBe('openspec-status-json-parse-failed');
    expect(result.stderr).toBe('');
  });

  it('returns structured JSON when no artifact is ready', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('instructions.mjs', ['demo-change'], root, bin, {
      MOCK_STATUS_JSON: JSON.stringify({ artifacts: [] }),
    });

    expect(result.code).toBe(4);
    expect(JSON.parse(result.stdout).reason).toBe('no-ready-artifact');
  });

  it('returns structured JSON when the artifact list has an invalid shape', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('instructions.mjs', ['demo-change'], root, bin, {
      MOCK_STATUS_JSON: JSON.stringify({ artifacts: {} }),
    });

    expect(result.code).toBe(4);
    expect(JSON.parse(result.stdout).reason).toBe('no-ready-artifact');
    expect(result.stderr).toBe('');
  });

  it('rejects damaged archive JSON without losing the failure reason', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('archive.mjs', ['demo-change', '-y'], root, bin, {
      MOCK_ARCHIVE_JSON: 'archive complete but not json',
    });

    expect(result.code).toBe(6);
    expect(JSON.parse(result.stdout).reason).toBe('command-output-json-invalid');
    expect(result.stderr).toBe('');
  });

  it('preserves structured JSON when the wrapped archive command fails', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('archive.mjs', ['demo-change', '-y'], root, bin, {
      MOCK_ARCHIVE_EXIT: '9',
    });

    expect(result.code).toBe(5);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: 'error',
      reason: 'openspec-archive-failed',
      nextAction: 'fix-validation-or-pending-tasks',
    });
    expect(result.stderr).toBe('');
  });

  it('returns structured JSON for a missing change argument', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('change-status.mjs', [], root, bin);

    expect(result.code).toBe(4);
    expect(JSON.parse(result.stdout).reason).toBe('missing-argument');
  });

  it('runs OpenSpec from the repository root when invoked in a subdirectory', async () => {
    const { root, bin } = await createRepo(true);
    const subdir = path.join(root, 'packages/api');
    await fs.ensureDir(subdir);
    const result = await runScript('instructions.mjs', ['demo-change', 'proposal'], subdir, bin);

    expect(result.code).toBe(0);
    expect(await isSameFileSystemEntry(JSON.parse(result.stdout).cwd, root)).toBe(true);
  });
});

// --- Script wrapper success-path and edge-case tests ---

describe('new-change.mjs', () => {
  it('creates a change successfully', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('new-change.mjs', ['demo-change'], root, bin);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ status: 'ok' });
  });

  it('returns structured error for missing argument', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('new-change.mjs', [], root, bin);

    expect(result.code).toBe(4);
    expect(JSON.parse(result.stdout)).toMatchObject({ reason: 'missing-argument' });
  });

  it('returns structured error for invalid change name', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('new-change.mjs', ['invalid name with spaces'], root, bin);

    expect(result.code).toBe(4);
    expect(JSON.parse(result.stdout)).toMatchObject({ reason: 'invalid-change-name' });
  });
});

describe('instructions-apply.mjs', () => {
  it('gets apply instructions successfully', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('instructions-apply.mjs', ['demo-change'], root, bin);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ status: 'ok' });
  });

  it('returns structured error for missing argument', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('instructions-apply.mjs', [], root, bin);

    expect(result.code).toBe(4);
    expect(JSON.parse(result.stdout)).toMatchObject({ reason: 'missing-argument' });
  });
});

describe('validate-change.mjs', () => {
  it('validates a change successfully', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('validate-change.mjs', ['demo-change'], root, bin);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ status: 'ok' });
  });

  it('returns structured error for missing argument', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('validate-change.mjs', [], root, bin);

    expect(result.code).toBe(4);
    expect(JSON.parse(result.stdout)).toMatchObject({ reason: 'missing-argument' });
  });
});

describe('validate-all.mjs', () => {
  it('validates all changes successfully', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('validate-all.mjs', [], root, bin);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ status: 'ok' });
  });
});

describe('list-changes.mjs', () => {
  it('lists changes successfully', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('list-changes.mjs', [], root, bin);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toHaveProperty('changes');
  });
});

describe('instructions.mjs success path', () => {
  it('returns instructions for a specific artifact', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('instructions.mjs', ['demo-change', 'proposal'], root, bin);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ status: 'ok' });
  });
});

describe('change-status.mjs success path', () => {
  it('returns status for a change', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('change-status.mjs', ['demo-change'], root, bin);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toHaveProperty('artifacts');
  });
});

describe('archive.mjs success path', () => {
  it('archives a change successfully', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('archive.mjs', ['demo-change', '-y'], root, bin);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ status: 'ok' });
  });
});
