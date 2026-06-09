import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { runInit } from '../../src/core/init/runInit.js';

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const nodeBinDir = path.dirname(process.execPath);
const createdDirs: string[] = [];

beforeAll(async () => {
  await execFileAsync('npm', ['run', 'build'], { cwd: rootDir });
}, 30000);

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function initClaudeRepo(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-dev-pipeline-preflight-'));
  createdDirs.push(dir);

  await runInit({
    dir,
    tool: 'claude',
    yes: true,
    force: false,
    dryRun: false
  });
  await execFileAsync('git', ['init'], { cwd: dir });

  return dir;
}

describe('runInit', () => {
  it('executes opsx-learn preflight script and returns knowledge health JSON when opsx-dev-pipeline is available', async () => {
    const dir = await initClaudeRepo();

    const binDir = path.join(dir, '.test-bin');
    await fs.ensureDir(binDir);
    const wrapperPath = path.join(binDir, 'opsx-dev-pipeline');
    await fs.writeFile(
      wrapperPath,
      `#!/usr/bin/env bash\nexec node ${JSON.stringify(path.join(rootDir, 'dist/bin/opsx-dev-pipeline.js'))} "$@"\n`
    );
    await fs.chmod(wrapperPath, 0o755);

    const scriptPath = path.join(dir, '.claude/skills/opsx-learn/scripts/opsx-learn-preflight.sh');
    const { stdout } = await execFileAsync('bash', [scriptPath], {
      cwd: dir,
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH ?? '/usr/bin:/bin'}`,
        HOME: process.env.HOME ?? dir
      }
    });

    const parsed = JSON.parse(stdout);
    expect(parsed.status).toBe('ok');
    expect(await fs.realpath(parsed.repoRoot)).toBe(await fs.realpath(dir));
    expect(parsed.knowledgeHealthAvailable).toBe(true);
    expect(parsed.knowledgeHealthSource).toBe('global');
    expect(['ok', 'warn']).toContain(parsed.knowledgeHealthStatus);
    expect(typeof parsed.knowledgeHealthSummary).toBe('string');
    expect(Array.isArray(parsed.knowledgeHealthHighlights)).toBe(true);
    expect(parsed.knowledgeHealth).toBeDefined();
    expect(['ok', 'warn']).toContain(parsed.knowledgeHealth.status);
    expect(Array.isArray(parsed.knowledgeHealth.checks)).toBe(true);
    expect(parsed.knowledgeHealth.summary).toBeDefined();
  });

  it('executes opsx-learn preflight script and resolves doctor via npx when global CLI is absent', async () => {
    const dir = await initClaudeRepo();

    const binDir = path.join(dir, '.test-bin');
    await fs.ensureDir(binDir);
    const npxWrapperPath = path.join(binDir, 'npx');
    await fs.writeFile(
      npxWrapperPath,
      `#!/usr/bin/env bash
set -euo pipefail
if [ "\${1:-}" = "--yes" ] && [ "\${2:-}" = "opsx-dev-pipeline" ]; then
  shift 2
  exec node ${JSON.stringify(path.join(rootDir, 'dist/bin/opsx-dev-pipeline.js'))} "$@"
fi
echo "unexpected npx invocation: $*" >&2
exit 1
`
    );
    await fs.chmod(npxWrapperPath, 0o755);

    const scriptPath = path.join(dir, '.claude/skills/opsx-learn/scripts/opsx-learn-preflight.sh');
    const { stdout } = await execFileAsync('bash', [scriptPath], {
      cwd: dir,
      env: {
        PATH: `${binDir}:${nodeBinDir}:/usr/bin:/bin`,
        HOME: process.env.HOME ?? dir
      }
    });

    const parsed = JSON.parse(stdout);
    expect(parsed.status).toBe('ok');
    expect(parsed.knowledgeHealthAvailable).toBe(true);
    expect(parsed.knowledgeHealthSource).toBe('npx');
    expect(['ok', 'warn']).toContain(parsed.knowledgeHealthStatus);
    expect(parsed.knowledgeHealth).toBeDefined();
  });

  it('executes opsx-learn preflight script and returns degraded JSON when CLI cannot be resolved', async () => {
    const dir = await initClaudeRepo();

    const scriptPath = path.join(dir, '.claude/skills/opsx-learn/scripts/opsx-learn-preflight.sh');
    const { stdout } = await execFileAsync('bash', [scriptPath], {
      cwd: dir,
      env: {
        PATH: '/usr/bin:/bin',
        HOME: process.env.HOME ?? dir
      }
    });

    const parsed = JSON.parse(stdout);
    expect(parsed.status).toBe('ok');
    expect(await fs.realpath(parsed.repoRoot)).toBe(await fs.realpath(dir));
    expect(typeof parsed.firstUse).toBe('boolean');
    expect(parsed.recommendedKnowledgeDir).toBe('.knowledge');
    expect(parsed.knowledgeHealthAvailable).toBe(false);
    expect(parsed.knowledgeHealthStatus).toBe('unknown');
    expect(parsed.knowledgeHealthSummary).toBeUndefined();
    expect(parsed.knowledgeHealthHighlights).toBeUndefined();
    expect(parsed.knowledgeHealth).toBeUndefined();
    expect(parsed.knowledgeHealthSource).toBeUndefined();
    expect(typeof parsed.message).toBe('string');
  });
});
