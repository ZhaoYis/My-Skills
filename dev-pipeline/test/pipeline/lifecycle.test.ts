import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import prompts from 'prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runInit } from '../../src/core/init/runInit.js';
import { runUninstallCommand } from '../../src/cli/commands/uninstall.js';
import { readManifest } from '../../src/core/manifest/io.js';
import type { PipelineManifest } from '../../src/core/manifest/types.js';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

vi.mock('prompts', () => ({
  default: vi.fn(),
}));

const createdDirs: string[] = [];
let bin = '';

interface StateResult {
  code: number;
  payload: Record<string, unknown>;
}

const STATE_SCRIPT = path.join(
  PACKAGE_ROOT,
  'src/templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs',
);

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

beforeEach(() => {
  bin = '';
});

async function createRepo(): Promise<string> {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-pipeline-lifecycle-'));
  createdDirs.push(repo);
  await run(repo, 'git', ['init', '--quiet']);
  await run(repo, 'git', ['config', 'user.name', 'Lifecycle Tester']);
  await run(repo, 'git', ['config', 'user.email', 'lifecycle@example.com']);
  return repo;
}

function run(repo: string, command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd: repo }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function writeOpenspecMock(repo: string, behavior: 'success' | 'fail' = 'success'): Promise<void> {
  bin = path.join(repo, 'mock-bin');
  await fs.ensureDir(bin);
  const successBody = `
    if (process.argv[2] === '--version') {
      process.stdout.write('1.6.0\\n');
      return;
    }
    if (process.argv[2] === 'init') {
      const openspecDir = ${JSON.stringify(path.join(repo, 'openspec'))};
      const fs = require('node:fs');
      fs.mkdirSync(${JSON.stringify(path.join(repo, 'openspec', 'changes'))}, { recursive: true });
      fs.mkdirSync(${JSON.stringify(path.join(repo, 'openspec', 'specs'))}, { recursive: true });
      fs.writeFileSync(${JSON.stringify(path.join(repo, 'openspec', 'config.yaml'))}, 'schema: spec-driven\\n');
      process.exit(0);
    }
    if (process.argv[2] === 'list' && process.argv[3] === '--json') {
      process.stdout.write(JSON.stringify({ root: { source: 'explicit' } }));
      return;
    }
    process.exit(0);
  `;
  const failBody = `
    process.stderr.write('openspec: simulated failure\\n');
    process.exit(2);
  `;
  await fs.outputFile(path.join(bin, 'openspec'), `#!/usr/bin/env node\n${behavior === 'success' ? successBody : failBody}`);
  await fs.chmod(path.join(bin, 'openspec'), 0o755);
  if (process.platform === 'win32') {
    const nodeExe = process.execPath.replace(/"/g, '""');
    const mockPath = path.join(bin, 'openspec').replace(/"/g, '""');
    await fs.outputFile(
      path.join(bin, 'openspec.cmd'),
      `@echo off\r\n"${nodeExe}" "${mockPath}" %*\r\nexit /b %ERRORLEVEL%\r\n`,
    );
  }
  // Prepend the mock to PATH so runInit resolves the fake openspec instead of a
  // globally installed one; inherited PATH is kept so git stays reachable.
  vi.stubEnv('PATH', `${bin}${path.delimiter}${process.env.PATH ?? ''}`);
}

function state(repo: string, ...args: string[]): Promise<StateResult> {
  const hasFeatureDecision =
    args.includes('--feature-id') || args.includes('--skip-feature-association');
  const normalizedArgs =
    args[0] === 'init' && !hasFeatureDecision ? [...args, '--skip-feature-association'] : args;
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [STATE_SCRIPT, ...normalizedArgs, '--view', 'full'],
      { cwd: repo },
      (error, stdout) => {
        const code = error && 'code' in error && typeof error.code === 'number' ? error.code : 0;
        resolve({ code, payload: stdout ? JSON.parse(stdout) : {} });
      },
    );
  });
}

async function readPipelineState(repo: string): Promise<PipelineManifest | null> {
  return ((await readManifest(repo))?.manifest ?? null) as PipelineManifest | null;
}

describe('end-to-end pipeline lifecycle (mocked openspec CLI)', () => {
  beforeEach(() => {
    vi.mocked(prompts).mockReset();
  });

  it('runs runInit against a clean repo and writes manifest + skill files', async () => {
    const repo = await createRepo();
    await writeOpenspecMock(repo);

    await runInit({
      dir: repo,
      tool: 'claude',
      stack: 'backend',
      techStack: 'java-spring-boot',
      language: 'zh',
      yes: true,
    });

    const manifest = await readPipelineState(repo);
    expect(manifest).not.toBeNull();
    expect(manifest?.tool).toBe('claude');
    expect(manifest?.techStack).toBe('java-spring-boot');
    expect(manifest?.language).toBe('zh');
    expect(manifest?.templateVersion).toBeTruthy();

    // Managed asset catalogue covers commands + skill bundle + hooks
    const ids = manifest?.managedAssets.map((asset) => asset.id) ?? [];
    expect(ids).toEqual(
      expect.arrayContaining([
        'common-readme',
        'common-gitignore',
        'opsx-dev-pipeline-command',
        'opsx-propose-command',
      ]),
    );
    expect(
      ids.some((id) => id.startsWith('opsx-dev-pipeline-skill-bundle:SKILL.md.hbs')),
    ).toBe(true);

    // README + claude docs are actually on disk
    expect(await fs.pathExists(path.join(repo, 'README.md'))).toBe(true);
    expect(await fs.pathExists(path.join(repo, 'CLAUDE.md'))).toBe(true);
    expect(
      await fs.pathExists(
        path.join(repo, '.claude/skills/opsx-dev-pipeline/SKILL.md'),
      ),
    ).toBe(true);
  });

  it('refuses runInit when openspec --version fails', async () => {
    const repo = await createRepo();
    await writeOpenspecMock(repo, 'fail');

    await expect(
      runInit({ dir: repo, tool: 'claude', stack: 'backend', yes: true }),
    ).rejects.toThrow(/OpenSpec|openspec/i);
  });

  it('runs a trivial change lifecycle after runInit', async () => {
    const repo = await createRepo();
    await writeOpenspecMock(repo);

    await runInit({
      dir: repo,
      tool: 'claude',
      stack: 'backend',
      yes: true,
      techStack: 'java-spring-boot',
    });

    // Create a change using dev-pipeline-state
    const init = await state(repo, 'init', 'fix-typo', 'feature/fix-typo');
    expect(init.code).toBe(0);

    // Trivial route allows Phase 0 → 2 directly when implementation is confirmed
    await state(repo, 'decision', 'fix-typo', 'proposalApproved', 'true');
    await state(repo, 'decision', 'fix-typo', 'implementationConfirmed', 'true');

    const toPhase2 = await state(repo, 'transition', 'fix-typo', '2', '6');
    expect(toPhase2.code).toBe(0);
    expect(toPhase2.payload.state).toMatchObject({ currentPhase: 2 });

    // Fill out Phase 6 prerequisites (push-only delivery)
    await state(repo, 'set', 'fix-typo', 'tests.status', 'skipped');
    await state(repo, 'set', 'fix-typo', 'verify.status', 'passed');
    await state(
      repo,
      'set',
      'fix-typo',
      'archivePath',
      'openspec/changes/archive/fix-typo',
    );
    await state(repo, 'decision', 'fix-typo', 'postArchiveAction', 'push-only');

    const toPhase6 = await state(repo, 'transition', 'fix-typo', '6', '20');
    expect(toPhase6.code).toBe(0);
    expect(toPhase6.payload.state).toMatchObject({ currentPhase: 6 });

    const completed = await state(repo, 'complete', 'fix-typo');
    expect(completed.code).toBe(0);
    expect(completed.payload.state).toMatchObject({
      status: 'completed',
      currentPhase: 6,
    });
  });

  it('runs a standard change lifecycle: propose → apply → archive → push', async () => {
    const repo = await createRepo();
    await writeOpenspecMock(repo);

    await runInit({
      dir: repo,
      tool: 'claude',
      stack: 'backend',
      yes: true,
      techStack: 'java-spring-boot',
    });

    await state(repo, 'init', 'add-feature', 'feature/add-feature');

    // Phase 0 → Phase 1 (proposal)
    expect((await state(repo, 'transition', 'add-feature', '1', '3')).code).toBe(0);

    // Proposal approved gate satisfied
    await state(repo, 'decision', 'add-feature', 'proposalApproved', 'true');

    // Phase 1 → Phase 2 (apply)
    expect((await state(repo, 'transition', 'add-feature', '2', '6')).code).toBe(0);

    // Implementation confirmation gate satisfied
    await state(repo, 'decision', 'add-feature', 'implementationConfirmed', 'true');

    // Phase 2 → Phase 5 (archive) - skip Phase 3 review and Phase 4 tests
    await state(repo, 'set', 'add-feature', 'tests.status', 'passed');
    expect((await state(repo, 'transition', 'add-feature', '5', '15')).code).toBe(0);

    // Phase 5 → Phase 6 (push)
    await state(repo, 'set', 'add-feature', 'verify.status', 'passed');
    await state(
      repo,
      'set',
      'add-feature',
      'archivePath',
      'openspec/changes/archive/add-feature',
    );
    await state(repo, 'decision', 'add-feature', 'postArchiveAction', 'push-only');
    expect((await state(repo, 'transition', 'add-feature', '6', '20')).code).toBe(0);

    const completed = await state(repo, 'complete', 'add-feature');
    expect(completed.code).toBe(0);
    expect(completed.payload.state).toMatchObject({
      currentPhase: 6,
      status: 'completed',
    });
  });

  it('runs a full change lifecycle with merge delivery (Phase 7)', async () => {
    const repo = await createRepo();
    await writeOpenspecMock(repo);

    await runInit({
      dir: repo,
      tool: 'claude',
      stack: 'backend',
      yes: true,
      techStack: 'java-spring-boot',
    });

    await state(repo, 'init', 'core-change', 'feature/core-change');

    expect((await state(repo, 'transition', 'core-change', '1', '3')).code).toBe(0);
    await state(repo, 'decision', 'core-change', 'proposalApproved', 'true');
    expect((await state(repo, 'transition', 'core-change', '2', '6')).code).toBe(0);
    await state(repo, 'decision', 'core-change', 'implementationConfirmed', 'true');

    // Phase 3 review
    expect((await state(repo, 'transition', 'core-change', '3', '9')).code).toBe(0);
    // Phase 4 tests
    expect((await state(repo, 'transition', 'core-change', '4', '13')).code).toBe(0);
    await state(repo, 'set', 'core-change', 'tests.status', 'passed');
    expect((await state(repo, 'transition', 'core-change', '5', '15')).code).toBe(0);

    // Phase 6 — merge delivery
    await state(repo, 'set', 'core-change', 'verify.status', 'passed');
    await state(
      repo,
      'set',
      'core-change',
      'archivePath',
      'openspec/changes/archive/core-change',
    );
    await state(repo, 'decision', 'core-change', 'postArchiveAction', 'merge');
    expect((await state(repo, 'transition', 'core-change', '6', '20')).code).toBe(0);

    // Phase 7 gate prerequisites
    await state(repo, 'set', 'core-change', 'delivery.commitSha', 'abc123');
    await state(repo, 'set', 'core-change', 'delivery.sourcePushed', 'true');
    expect((await state(repo, 'transition', 'core-change', '7', '23')).code).toBe(0);

    expect((await state(repo, 'complete', 'core-change')).code).toBe(0);
    const finalState = await state(repo, 'get', 'core-change');
    expect(finalState.payload.state).toMatchObject({
      currentPhase: 7,
      status: 'completed',
      route: { choice: 'full' },
    });
  });

  it('records phase history as the agent switches phases', async () => {
    const repo = await createRepo();
    await writeOpenspecMock(repo);

    await runInit({
      dir: repo,
      tool: 'claude',
      stack: 'backend',
      yes: true,
      techStack: 'java-spring-boot',
    });

    await state(repo, 'init', 'history-trace', 'feature/history');
    await state(repo, 'transition', 'history-trace', '1', '3');
    await state(repo, 'decision', 'history-trace', 'proposalApproved', 'true');
    await state(repo, 'transition', 'history-trace', '2', '6');

    const final = await state(repo, 'get', 'history-trace');
    const phaseHistory = (final.payload.state as { phaseHistory: unknown[] }).phaseHistory;

    expect(phaseHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phase: 0, status: 'completed', executedBy: 'pipeline' }),
        expect.objectContaining({ phase: 1, status: 'completed', executedBy: 'pipeline' }),
        expect.objectContaining({ phase: 2, status: 'in-progress', executedBy: 'pipeline' }),
      ]),
    );
  });

  it('supports pause and resume of a change mid-flight', async () => {
    const repo = await createRepo();
    await writeOpenspecMock(repo);

    await runInit({
      dir: repo,
      tool: 'claude',
      stack: 'backend',
      yes: true,
      techStack: 'java-spring-boot',
    });

    await state(repo, 'init', 'pausable', 'feature/pausable');
    expect((await state(repo, 'transition', 'pausable', '1', '3')).code).toBe(0);

    const pause = await state(repo, 'pause', 'pausable', 'waiting on review');
    expect(pause.code).toBe(0);
    expect(pause.payload.state).toMatchObject({ status: 'paused' });

    const resume = await state(repo, 'get', 'pausable');
    expect(resume.payload.state).toMatchObject({ status: 'paused' });

    // Resume: re-approve proposal and continue
    await state(repo, 'decision', 'pausable', 'proposalApproved', 'true');
    const continueTo2 = await state(repo, 'transition', 'pausable', '2', '6');
    expect(continueTo2.code).toBe(0);
    expect(continueTo2.payload.state).toMatchObject({
      status: 'active',
      currentPhase: 2,
    });
  });
});

describe('end-to-end pipeline lifecycle with uninstall', () => {
  beforeEach(() => {
    vi.mocked(prompts).mockReset();
  });

  it('round-trips runInit → runUninstallCommand cleanly', async () => {
    const repo = await createRepo();
    await writeOpenspecMock(repo);

    await runInit({
      dir: repo,
      tool: 'claude',
      stack: 'backend',
      yes: true,
      techStack: 'java-spring-boot',
    });

    expect(await fs.pathExists(path.join(repo, 'README.md'))).toBe(true);
    expect(await fs.pathExists(path.join(repo, 'CLAUDE.md'))).toBe(true);

    await runUninstallCommand({ dir: repo, yes: true });

    expect(await fs.pathExists(path.join(repo, 'README.md'))).toBe(false);
    expect(await fs.pathExists(path.join(repo, 'CLAUDE.md'))).toBe(false);
    expect(await readManifest(repo)).toBeNull();
  });
});