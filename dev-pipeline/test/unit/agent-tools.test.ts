import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import type { PipelineRun } from '../../src/agent/domain/pipeline-state.js';
import { AgentRuntime } from '../../src/agent/runtime/agent-runtime.js';
import { PhaseAwarePlanner } from '../../src/agent/runtime/deterministic-planner.js';
import { InMemoryStateStore } from '../../src/agent/runtime/state-store.js';
import { RegistryToolExecutor } from '../../src/agent/runtime/tool-executor.js';
import type { CommandResult, CommandRunner } from '../../src/agent/tools/command-runner.js';
import { GitAdapter } from '../../src/agent/tools/git-adapter.js';
import { OpenSpecAdapter } from '../../src/agent/tools/openspec-adapter.js';
import { createLocalToolRegistry, ToolRegistry } from '../../src/agent/tools/registry.js';
import { TestAdapter } from '../../src/agent/tools/test-adapter.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.remove(directory)));
});

class FakeRunner implements CommandRunner {
  readonly calls: Array<{ command: string; args: string[]; cwd?: string }> = [];
  constructor(private readonly responses: Record<string, CommandResult> = {}) {}

  async run(
    command: string,
    args: string[],
    options: { cwd?: string } = {},
  ): Promise<CommandResult> {
    this.calls.push({ command, args, cwd: options.cwd });
    return (
      this.responses[`${command} ${args.join(' ')}`] ?? { exitCode: 0, stdout: '', stderr: '' }
    );
  }
}

describe('OpenSpecAdapter', () => {
  it('runs preflight and preserves structured OpenSpec output', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-agent-openspec-'));
    temporaryDirectories.push(root);
    await fs.outputFile(path.join(root, 'openspec/config.yaml'), 'schema: spec-driven\n');
    const runner = new FakeRunner({
      'openspec --version': { exitCode: 0, stdout: '1.7.0\n', stderr: '' },
      'openspec list --json': { exitCode: 0, stdout: '{"changes":[]}', stderr: '' },
      'openspec status --change demo-change --json': {
        exitCode: 0,
        stdout: '{"artifacts":[]}',
        stderr: '',
      },
    });
    const adapter = new OpenSpecAdapter(root, runner);
    const preflight = await adapter.preflight();
    expect(preflight).toMatchObject({ status: 'succeeded', summary: 'OpenSpec preflight passed' });
    expect((await adapter.status({ changeName: 'demo-change' })).value).toEqual({ artifacts: [] });
    expect(runner.calls.every((call) => call.cwd === root)).toBe(true);
  });

  it('blocks preflight when the repository is not initialized', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-agent-openspec-'));
    temporaryDirectories.push(root);
    const adapter = new OpenSpecAdapter(root, new FakeRunner());
    await expect(adapter.preflight()).resolves.toMatchObject({
      status: 'blocked',
      summary: 'openspec/config.yaml not found',
    });
  });
});

describe('GitAdapter', () => {
  it('uses argument arrays and returns commit evidence', async () => {
    const runner = new FakeRunner({
      'git rev-parse HEAD': { exitCode: 0, stdout: 'abc123\n', stderr: '' },
    });
    const adapter = new GitAdapter('/repo', runner);
    await adapter.stage({ paths: ['src/app.ts'] });
    const commit = await adapter.commit({ message: 'feat: add app' });
    expect(commit).toMatchObject({ status: 'succeeded', value: { sha: 'abc123' } });
    expect(runner.calls[0]).toMatchObject({ command: 'git', args: ['add', '--', 'src/app.ts'] });
    expect(runner.calls[1]).toMatchObject({
      command: 'git',
      args: ['commit', '-m', 'feat: add app'],
    });
  });

  it('blocks empty staging and parses conflict paths', async () => {
    const runner = new FakeRunner({
      'git diff --name-only --diff-filter=U': { exitCode: 0, stdout: 'a.ts\nb.ts\n', stderr: '' },
    });
    const adapter = new GitAdapter('/repo', runner);
    expect(await adapter.stage({ paths: [] })).toMatchObject({ status: 'blocked' });
    expect(await adapter.listConflicts()).toMatchObject({
      status: 'succeeded',
      value: ['a.ts', 'b.ts'],
    });
  });
});

describe('TestAdapter and ToolRegistry', () => {
  it('detects package scripts and executes a parsed command', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-agent-tests-'));
    temporaryDirectories.push(root);
    await fs.writeJson(path.join(root, 'package.json'), {
      scripts: { test: 'vitest', 'test:unit': 'vitest run' },
    });
    const runner = new FakeRunner({ 'npm test': { exitCode: 0, stdout: 'passed', stderr: '' } });
    const adapter = new TestAdapter(root, runner);
    expect(await adapter.detect()).toMatchObject({
      status: 'succeeded',
      value: ['npm test', 'npm run test:unit'],
    });
    expect(await adapter.run({ command: 'npm test' })).toMatchObject({ status: 'succeeded' });
    expect(runner.calls[0]?.cwd).toBe(root);
  });

  it('registers local tools and returns a structured unknown-tool block', async () => {
    const registry = createLocalToolRegistry('/repo', new FakeRunner());
    expect(registry.has('git.status')).toBe(true);
    expect(registry.list()).toContain('openspec.preflight');
    expect(await registry.execute('missing.tool', {}, { run: {} as never })).toMatchObject({
      status: 'blocked',
      summary: 'tool-not-registered: missing.tool',
    });
    const custom = new ToolRegistry();
    custom.register('fixture', async () => ({ status: 'succeeded', summary: 'ok' }));
    expect(await custom.execute('fixture', {}, { run: {} as never })).toMatchObject({
      status: 'succeeded',
    });
  });
});

describe('deterministic planner and registry executor', () => {
  it('executes one safe phase action and stops at the next checkpoint', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-agent-loop-'));
    temporaryDirectories.push(root);
    await fs.outputFile(path.join(root, 'openspec/config.yaml'), 'schema: spec-driven\n');
    const runner = new FakeRunner({
      'openspec status --change demo-change --json': {
        exitCode: 0,
        stdout: '{"artifacts":[{"id":"proposal","status":"ready"}]}',
        stderr: '',
      },
    });
    const state: PipelineRun = {
      schemaVersion: 3,
      _version: 0,
      runId: 'demo-change',
      changeName: 'demo-change',
      sourceBranch: 'feature/demo-change',
      targetBranch: 'main',
      currentPhase: 1,
      currentStep: 3,
      status: 'active',
      executionMode: 'pipeline',
      decisions: {},
      phaseHistory: [],
      gatesBypassed: [],
      tests: { status: 'pending', attempts: 0 },
      verify: { status: 'pending', attempts: 0 },
      archivePath: null,
      delivery: {
        commitSha: null,
        mergeCommitSha: null,
        sourcePushed: false,
        targetPushed: false,
        tag: null,
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const store = new InMemoryStateStore([state]);
    const runtime = new AgentRuntime({
      stateStore: store,
      observer: { observe: async () => ({}) },
      planner: new PhaseAwarePlanner(),
      executor: new RegistryToolExecutor(createLocalToolRegistry(root, runner)),
    });
    const first = await runtime.step('demo-change');
    expect(first).toMatchObject({ status: 'completed', action: { kind: 'openspec.status' } });
    expect((await store.load('demo-change'))?.lastActionId).toBe('phase-1-status');
    const checkpoint = await runtime.step('demo-change');
    expect(checkpoint).toMatchObject({ status: 'completed', action: null });
  });
});
