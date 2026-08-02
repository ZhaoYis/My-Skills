import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PipelineRun } from '../../src/agent/domain/pipeline-state.js';
import { PipelineController } from '../../src/agent/runtime/pipeline-controller.js';
import { InMemoryStateStore } from '../../src/agent/runtime/state-store.js';
import { runAgentCommand } from '../../src/cli/commands/agent.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.remove(directory)));
});

function makeRun(overrides: Partial<PipelineRun> = {}): PipelineRun {
  return {
    schemaVersion: 3,
    _version: 0,
    runId: 'demo-change',
    changeName: 'demo-change',
    sourceBranch: 'feature/demo-change',
    targetBranch: 'main',
    currentPhase: 1,
    currentStep: 5,
    status: 'active',
    executionMode: 'pipeline',
    decisions: {},
    phaseHistory: [],
    gatesBypassed: [],
    tests: { status: 'pending', attempts: 0, command: null, detail: null },
    verify: { status: 'pending', attempts: 0, command: null, detail: null },
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
    ...overrides,
  };
}

describe('PipelineController', () => {
  it('approves, pauses and resumes a persisted run', async () => {
    const store = new InMemoryStateStore([
      makeRun({ pendingApproval: { actionId: 'commit-1', kind: 'git.commit' } }),
    ]);
    const controller = new PipelineController(store, () => '2026-01-01T01:00:00.000Z');

    const approved = await controller.approve('demo-change', 'commit-1');
    expect(approved.approvedActions).toEqual(['commit-1']);
    expect(approved.pendingApproval).toBeUndefined();

    const paused = await controller.pause('demo-change', 'manual-check');
    expect(paused.status).toBe('paused');
    expect(paused.pauseReason).toBe('manual-check');

    const resumed = await controller.resume('demo-change');
    expect(resumed.status).toBe('active');
    expect(resumed.pauseReason).toBeUndefined();
  });

  it('uses the same transition gate rules as the Runtime', async () => {
    const store = new InMemoryStateStore([makeRun({ decisions: { proposalApproved: true } })]);
    const controller = new PipelineController(store, () => '2026-01-01T02:00:00.000Z');
    const next = await controller.transition('demo-change', 2, 6);
    expect(next.currentPhase).toBe(2);
    await expect(controller.transition('demo-change', 3, 9)).rejects.toThrow(
      'implementation-confirmation-required',
    );
  });
});

describe('agent CLI command', () => {
  it('prints persisted state as structured JSON', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-agent-command-'));
    temporaryDirectories.push(root);
    const store = new InMemoryStateStore([makeRun()]);
    const state = await store.load('demo-change');
    await fs.ensureDir(path.join(root, 'openspec/.pipeline-state'));
    await fs.writeJson(path.join(root, 'openspec/.pipeline-state/demo-change.json'), state, {
      spaces: 2,
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runAgentCommand('status', 'demo-change', { dir: root, json: true });

    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      status: string;
      state: { changeName: string; currentPhase: number };
    };
    expect(payload).toMatchObject({
      status: 'ok',
      state: { changeName: 'demo-change', currentPhase: 1 },
    });
  });

  it('rejects approve without an action id', async () => {
    await expect(runAgentCommand('approve', 'demo-change', { dir: '/tmp' })).rejects.toThrow(
      'agent approve requires --action-id',
    );
  });

  it('requires explicit and complete model planner configuration', async () => {
    await expect(
      runAgentCommand('run', 'demo-change', { dir: '/tmp', planner: 'unknown' }),
    ).rejects.toThrow('agent-run --planner must be deterministic or model');
    await expect(
      runAgentCommand('run', 'demo-change', { dir: '/tmp', planner: 'model', model: 'planner-1' }),
    ).rejects.toThrow('model planner requires --endpoint or OPSX_AGENT_ENDPOINT');
  });
});
