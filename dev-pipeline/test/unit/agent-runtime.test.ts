import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { actionRisk, requiresApproval } from '../../src/agent/domain/decisions.js';
import {
  DEFAULT_PHASE_DEFINITIONS,
  getPhaseDefinition,
} from '../../src/agent/domain/phase-definition.js';
import {
  type PipelineRun,
  transitionRun,
  validateTransition,
} from '../../src/agent/domain/pipeline-state.js';
import {
  type AgentEvent,
  AgentRuntime,
  type Evidence,
} from '../../src/agent/runtime/agent-runtime.js';
import { ApprovalPolicy } from '../../src/agent/runtime/policy.js';
import { InMemoryStateStore, JsonFileStateStore } from '../../src/agent/runtime/state-store.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.remove(directory)));
});

function makeRun(overrides: Partial<PipelineRun> = {}): PipelineRun {
  return {
    schemaVersion: 3,
    _version: 0,
    runId: 'add-login',
    changeName: 'add-login',
    sourceBranch: 'feature/add-login',
    targetBranch: 'main',
    currentPhase: 1,
    currentStep: 5,
    status: 'active',
    executionMode: 'pipeline',
    decisions: {},
    phaseHistory: [
      {
        phase: 1,
        step: 5,
        executedBy: 'pipeline',
        status: 'in-progress',
        startedAt: '2026-01-01T00:00:00.000Z',
        completedAt: null,
        decisions: {},
        gatesBypassed: [],
      },
    ],
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

describe('agent domain decisions', () => {
  it('classifies action risk and protects high-risk side effects', () => {
    expect(actionRisk('git.diff')).toBe('medium');
    expect(actionRisk('git.push')).toBe('high');
    expect(actionRisk('git.delete-branch')).toBe('critical');
    expect(requiresApproval({ kind: 'git.push', risk: 'high' })).toBe(true);
    expect(requiresApproval({ kind: 'openspec.status', risk: 'low' })).toBe(false);
  });
});

describe('approval policy', () => {
  it('keeps destructive actions gated in assisted and semi-auto modes', () => {
    const action = { actionId: 'push-1', kind: 'git.push', phase: 6, risk: 'high' as const };
    expect(new ApprovalPolicy('assisted').evaluate(action).requiresApproval).toBe(true);
    expect(new ApprovalPolicy('semi-auto').evaluate(action).requiresApproval).toBe(true);
    expect(
      new ApprovalPolicy('semi-auto').evaluate({ ...action, kind: 'git.diff', risk: 'low' })
        .requiresApproval,
    ).toBe(false);
  });

  it('allows an explicitly approved action without weakening global policy', () => {
    const policy = new ApprovalPolicy('assisted', new Set(['git.commit']));
    expect(
      policy.evaluate({ actionId: 'commit-1', kind: 'git.commit', phase: 6, risk: 'high' }).reason,
    ).toBe('explicitly-allowed-by-policy');
  });
});

describe('phase definitions', () => {
  it('defines all pipeline phases and exposes phase-specific actions', () => {
    expect(DEFAULT_PHASE_DEFINITIONS.map((phase) => phase.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(getPhaseDefinition(3).allowedActions).toContain('review.run');
    expect(getPhaseDefinition(7).approvalPoints.map((point) => point.id)).toEqual([
      'merge',
      'target-push',
    ]);
    expect(() => getPhaseDefinition(8)).toThrow('Unknown pipeline phase');
  });
});

describe('pipeline state domain', () => {
  it('enforces proposal and implementation gates', () => {
    const initial = makeRun();
    expect(validateTransition(initial, 2)?.code).toBe('proposal-approval-required');

    const approved = makeRun({ decisions: { proposalApproved: true } });
    expect(validateTransition(approved, 2)).toBeNull();
    const applying = { ...approved, currentPhase: 2, currentStep: 8 };
    expect(validateTransition(applying, 3)?.code).toBe('implementation-confirmation-required');
    expect(
      validateTransition(
        { ...applying, decisions: { proposalApproved: true, implementationConfirmed: true } },
        3,
      ),
    ).toBeNull();
  });

  it('enforces verify, archive, delivery and merge gates', () => {
    const beforeArchive = makeRun({
      currentPhase: 5,
      currentStep: 19,
      decisions: {
        proposalApproved: true,
        implementationConfirmed: true,
        postArchiveAction: 'merge',
      },
      tests: { status: 'passed', attempts: 1, command: 'npm test', detail: null },
    });
    expect(validateTransition(beforeArchive, 6)?.code).toBe('verify-gate-required');
    const readyForDelivery = makeRun({
      ...beforeArchive,
      verify: { status: 'passed', attempts: 1, command: 'npm run verify', detail: null },
      archivePath: 'openspec/changes/archive/add-login',
    });
    expect(validateTransition(readyForDelivery, 6)).toBeNull();
    expect(validateTransition({ ...readyForDelivery, currentPhase: 6 }, 7)?.code).toBe(
      'commit-required',
    );
    expect(
      validateTransition(
        {
          ...readyForDelivery,
          currentPhase: 6,
          delivery: { ...readyForDelivery.delivery, commitSha: 'abc', sourcePushed: true },
        },
        7,
      ),
    ).toBeNull();
  });

  it('records phase history when transitioning', () => {
    const state = makeRun({ decisions: { proposalApproved: true } });
    const next = transitionRun(state, 2, 6, '2026-01-01T01:00:00.000Z');
    expect(next.currentPhase).toBe(2);
    expect(next.phaseHistory[0]).toMatchObject({
      phase: 1,
      status: 'completed',
      completedAt: '2026-01-01T01:00:00.000Z',
    });
    expect(next.phaseHistory.at(-1)).toMatchObject({ phase: 2, step: 6, status: 'in-progress' });
  });
});

describe('state stores', () => {
  it('detects optimistic concurrency conflicts in memory', async () => {
    const store = new InMemoryStateStore([makeRun()]);
    const state = await store.load('add-login');
    if (!state) throw new Error('fixture state missing');
    const saved = await store.save({ ...state, currentStep: 6 }, state._version);
    expect(saved._version).toBe(1);
    await expect(store.save({ ...saved, currentStep: 7 }, 0)).rejects.toThrow(
      'state-version-conflict',
    );
  });

  it('writes JSON state atomically below openspec/.pipeline-state', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-agent-state-'));
    temporaryDirectories.push(root);
    const store = new JsonFileStateStore(root);
    const saved = await store.save(makeRun());
    expect(saved._version).toBe(0);
    expect(await fs.pathExists(path.join(root, 'openspec/.pipeline-state/add-login.json'))).toBe(
      true,
    );
    expect((await store.load('add-login'))?.changeName).toBe('add-login');
  });
});

describe('agent runtime', () => {
  it('executes safe actions and records evidence', async () => {
    const store = new InMemoryStateStore([makeRun()]);
    const events: AgentEvent[] = [];
    const evidence: Evidence[] = [{ type: 'diff-stat', value: '1 file changed' }];
    const runtime = new AgentRuntime({
      stateStore: store,
      observer: { observe: async () => ({ clean: false }) },
      planner: {
        nextAction: async () => ({
          actionId: 'inspect-1',
          kind: 'git.diff',
          phase: 1,
          risk: 'low',
        }),
      },
      executor: {
        execute: async () => ({ status: 'succeeded', summary: 'diff loaded', evidence }),
      },
      eventLog: {
        append: async (event) => {
          events.push(event);
        },
      },
    });
    const result = await runtime.step('add-login');
    expect(result.status).toBe('completed');
    expect(events[0]).toMatchObject({ actionId: 'inspect-1', status: 'succeeded', evidence });
  });

  it('pauses on fact divergence and resumes only after explicit approval', async () => {
    const store = new InMemoryStateStore([makeRun()]);
    const approvals: string[] = [];
    let executeCount = 0;
    const runtime = new AgentRuntime({
      stateStore: store,
      observer: { observe: async () => ({}) },
      planner: {
        nextAction: async () => ({
          actionId: 'commit-1',
          kind: 'git.commit',
          phase: 6,
          risk: 'high',
        }),
      },
      executor: {
        execute: async () => {
          executeCount += 1;
          return { status: 'succeeded', summary: 'committed' };
        },
      },
      interaction: {
        requestApproval: async ({ action }) => {
          approvals.push(action.actionId);
        },
      },
    });
    const pending = await runtime.step('add-login');
    expect(pending.status).toBe('awaiting-approval');
    expect(approvals).toEqual(['commit-1']);
    await runtime.approve('add-login', 'commit-1');
    const completed = await runtime.step('add-login');
    expect(completed.status).toBe('completed');
    expect(executeCount).toBe(1);
    const repeated = await runtime.step('add-login');
    expect(repeated.status).toBe('awaiting-approval');
  });

  it('pauses when observer detects divergence', async () => {
    const store = new InMemoryStateStore([makeRun()]);
    const runtime = new AgentRuntime({
      stateStore: store,
      observer: {
        observe: async () => ({ divergence: 'current branch differs from sourceBranch' }),
      },
      planner: {
        nextAction: async () => ({ actionId: 'never', kind: 'git.diff', phase: 1, risk: 'low' }),
      },
      executor: { execute: async () => ({ status: 'succeeded', summary: 'unexpected' }) },
      now: () => '2026-01-01T02:00:00.000Z',
    });
    const result = await runtime.step('add-login');
    expect(result).toMatchObject({
      status: 'paused',
      reason: 'current branch differs from sourceBranch',
    });
    expect((await store.load('add-login'))?.status).toBe('paused');
  });

  it('surfaces blocked executor results as failed runtime steps', async () => {
    const store = new InMemoryStateStore([makeRun()]);
    const runtime = new AgentRuntime({
      stateStore: store,
      observer: { observe: async () => ({}) },
      planner: {
        nextAction: async () => ({
          actionId: 'validate-1',
          kind: 'openspec.validate',
          phase: 1,
          risk: 'low',
        }),
      },
      executor: { execute: async () => ({ status: 'blocked', summary: 'missing artifact' }) },
    });
    const result = await runtime.step('add-login');
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.error).toBe('missing artifact');
  });

  it('pauses when a planner returns an invalid or unavailable action', async () => {
    const store = new InMemoryStateStore([makeRun()]);
    const runtime = new AgentRuntime({
      stateStore: store,
      observer: { observe: async () => ({}) },
      planner: {
        nextAction: async () => {
          throw new Error('model-action-not-allowed-in-phase');
        },
      },
      executor: { execute: async () => ({ status: 'succeeded', summary: 'unexpected' }) },
      now: () => '2026-01-01T03:00:00.000Z',
    });
    const result = await runtime.step('add-login');
    expect(result).toMatchObject({
      status: 'paused',
      reason: 'planner-error: model-action-not-allowed-in-phase',
    });
  });
});
