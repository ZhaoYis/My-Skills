import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const scriptsRoot = path.join(
  PACKAGE_ROOT,
  'templates/common/skills/opsx-dev-pipeline/scripts',
);
const createdDirs: string[] = [];

interface ScriptResult {
  code: number;
  stdout: string;
  stderr: string;
}

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
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

  const mock = `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then
  printf '%s\\n' '1.6.0'
  exit 0
fi
case "\${1:-}" in
  list)
    if [[ -n "\${MOCK_LIST_JSON:-}" ]]; then
      printf '%s\\n' "$MOCK_LIST_JSON"
    else
      printf '{"changes":[],"root":{"path":"%s","source":"config"}}\\n' "$PWD"
    fi
    ;;
  status)
    if [[ -n "\${MOCK_STATUS_JSON:-}" ]]; then
      printf '%s\\n' "$MOCK_STATUS_JSON"
    else
      printf '%s\\n' '{"artifacts":[{"id":"proposal","status":"ready"}]}'
    fi
    ;;
  instructions)
    printf '{"status":"ok","cwd":"%s"}\\n' "$PWD"
    ;;
  archive)
    if [[ -n "\${MOCK_ARCHIVE_EXIT:-}" ]]; then
      printf '%s\\n' '{"status":"error","reason":"pending-tasks"}'
      exit "$MOCK_ARCHIVE_EXIT"
    elif [[ -n "\${MOCK_ARCHIVE_JSON:-}" ]]; then
      printf '%s\\n' "$MOCK_ARCHIVE_JSON"
    else
      printf '%s\\n' '{"status":"ok"}'
    fi
    ;;
  new|validate)
    printf '{"status":"ok"}\\n'
    ;;
  *)
    printf '%s\\n' '{"status":"error","reason":"unexpected-mock-command"}'
    exit 9
    ;;
esac
`;
  const mockPath = path.join(bin, 'openspec');
  await fs.outputFile(mockPath, mock);
  await fs.chmod(mockPath, 0o755);
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
      'bash',
      [path.join(scriptsRoot, script), ...args],
      {
        cwd,
        env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}`, ...extraEnv },
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
    const result = await runScript('dev-pipeline-preflight.sh', [], root, bin, {
      PATH: '/usr/bin:/bin',
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
    const result = await runScript('dev-pipeline-preflight.sh', [], root, bin, {
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
    const result = await runScript('dev-pipeline-preflight.sh', [], root, bin);
    const payload = JSON.parse(result.stdout) as { status: string; rootSource: string };

    expect(result.code).toBe(0);
    expect(payload.status).toBe('ok');
    expect(payload.rootSource).toBe('config');
  });

  it('returns structured JSON when status output is invalid', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('dev-pipeline-instructions.sh', ['demo-change'], root, bin, {
      MOCK_STATUS_JSON: 'not-json',
    });

    expect(result.code).toBe(6);
    expect(JSON.parse(result.stdout).reason).toBe('openspec-status-json-parse-failed');
    expect(result.stderr).toBe('');
  });

  it('returns structured JSON when no artifact is ready', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('dev-pipeline-instructions.sh', ['demo-change'], root, bin, {
      MOCK_STATUS_JSON: JSON.stringify({ artifacts: [] }),
    });

    expect(result.code).toBe(4);
    expect(JSON.parse(result.stdout).reason).toBe('no-ready-artifact');
  });

  it('rejects damaged archive JSON without losing the failure reason', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('dev-pipeline-archive.sh', ['demo-change', '-y'], root, bin, {
      MOCK_ARCHIVE_JSON: 'archive complete but not json',
    });

    expect(result.code).toBe(6);
    expect(JSON.parse(result.stdout).reason).toBe('command-output-json-invalid');
    expect(result.stderr).toBe('');
  });

  it('preserves structured JSON when the wrapped archive command fails', async () => {
    const { root, bin } = await createRepo(true);
    const result = await runScript('dev-pipeline-archive.sh', ['demo-change', '-y'], root, bin, {
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
    const result = await runScript('dev-pipeline-change-status.sh', [], root, bin);

    expect(result.code).toBe(4);
    expect(JSON.parse(result.stdout).reason).toBe('missing-argument');
  });

  it('runs OpenSpec from the repository root when invoked in a subdirectory', async () => {
    const { root, bin } = await createRepo(true);
    const subdir = path.join(root, 'packages/api');
    await fs.ensureDir(subdir);
    const result = await runScript(
      'dev-pipeline-instructions.sh',
      ['demo-change', 'proposal'],
      subdir,
      bin,
    );

    expect(result.code).toBe(0);
    expect(await fs.realpath(JSON.parse(result.stdout).cwd)).toBe(await fs.realpath(root));
  });
});
