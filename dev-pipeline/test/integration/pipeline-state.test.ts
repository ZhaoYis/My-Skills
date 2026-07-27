import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const stateScript = path.join(
  PACKAGE_ROOT,
  'templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs',
);
const createdDirs: string[] = [];
let repo = '';

interface StateResult {
  code: number;
  payload: Record<string, unknown>;
}

interface PhaseHistoryEntry {
  phase: number;
  step: number;
  executedBy: string;
  status: 'in-progress' | 'completed' | 'abandoned';
  startedAt: string;
  completedAt: string | null;
  decisions: Record<string, unknown>;
  gatesBypassed: string[];
}

interface ReviewState {
  currentRound: number;
  rounds: Array<{
    round: number;
    reportPath: string | null;
    status: string;
    timestamp: string;
    decisions: Record<string, unknown>;
  }>;
  reportPath: string | null;
  status: string;
}

beforeEach(async () => {
  repo = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-state-'));
  createdDirs.push(repo);
  await run('git', ['init', '--quiet']);
  await run('git', ['config', 'user.name', 'Pipeline Tester']);
  await run('git', ['config', 'user.email', 'pipeline@example.com']);
});

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

function run(command: string, args: string[]): Promise<StateResult> {
  return new Promise((resolve) => {
    execFile(command, args, { cwd: repo }, (error, stdout) => {
      const code = error && 'code' in error && typeof error.code === 'number' ? error.code : 0;
      resolve({ code, payload: stdout ? JSON.parse(stdout) : {} });
    });
  });
}

function state(...args: string[]): Promise<StateResult> {
  const hasFeatureDecision =
    args.includes('--feature-id') || args.includes('--skip-feature-association');
  const normalizedArgs =
    args[0] === 'init' && !hasFeatureDecision ? [...args, '--skip-feature-association'] : args;
  return run(process.execPath, [stateScript, ...normalizedArgs]);
}

function rawState(...args: string[]): Promise<StateResult> {
  return run(process.execPath, [stateScript, ...args]);
}

describe('pipeline state machine', () => {
  it('rejects initialization without an explicit feature association decision', async () => {
    const result = await rawState('init', 'missing-feature-decision', 'feature/missing-decision');

    expect(result.code).toBe(11);
    expect(result.payload).toMatchObject({
      reason: 'feature-association-decision-required',
      nextAction: 'provide-feature-id-or-skip-feature-association',
    });
    expect(
      await fs.pathExists(
        path.join(repo, 'openspec/.pipeline-state/missing-feature-decision.json'),
      ),
    ).toBe(false);
  });

  it('accepts an explicit feature association skip', async () => {
    const result = await rawState(
      'init',
      'explicit-feature-skip',
      'feature/explicit-skip',
      '--skip-feature-association',
    );

    expect(result.code).toBe(0);
    expect(result.payload.state).toMatchObject({ featureInfo: null });
  });

  it('rejects conflicting feature association options', async () => {
    const result = await rawState(
      'init',
      'conflicting-feature-options',
      'feature/conflicting-options',
      '--feature-id',
      'PROJ-1234',
      '--skip-feature-association',
    );

    expect(result.code).toBe(11);
    expect(result.payload).toMatchObject({ reason: 'feature-association-options-conflict' });
  });

  it('rejects a feature URL without a feature ID', async () => {
    const result = await rawState(
      'init',
      'feature-url-without-id',
      'feature/url-without-id',
      '--feature-url',
      'https://jira.example.com/browse/PROJ-1234',
    );

    expect(result.code).toBe(11);
    expect(result.payload).toMatchObject({ reason: 'feature-id-required' });
  });

  it('initializes Schema v3 with standalone integration fields and review rounds', async () => {
    const initialized = await state('init', 'schema-v3', 'feature/schema-v3');
    const initializedState = initialized.payload.state as {
      schemaVersion: number;
      _version: number;
      executionMode: string;
      phaseHistory: PhaseHistoryEntry[];
      gatesBypassed: unknown[];
      review: ReviewState;
      _readVersion?: number;
    };

    expect(initialized.code).toBe(0);
    expect(initializedState).toMatchObject({
      schemaVersion: 3,
      _version: 1,
      executionMode: 'pipeline',
      gatesBypassed: [],
      review: {
        currentRound: 0,
        rounds: [],
        reportPath: null,
        status: 'pending',
      },
    });
    expect(initializedState.phaseHistory).toEqual([
      expect.objectContaining({
        phase: 0,
        step: 1,
        executedBy: 'pipeline',
        status: 'in-progress',
        completedAt: null,
      }),
    ]);
    expect(initializedState._readVersion).toBeUndefined();

    const persisted = await fs.readJson(path.join(repo, 'openspec/.pipeline-state/schema-v3.json'));
    expect(persisted._readVersion).toBeUndefined();
  });

  it('initializes creator, machine, feature and fingerprint metadata', async () => {
    const initialized = await state('init', 'metadata-fields', 'feature/metadata-fields');
    const initializedState = initialized.payload.state as {
      createdBy: string;
      createdByEmail: string;
      machineInfo: Record<string, string>;
      featureInfo: null;
      fingerprintId: string;
      fingerprintNonce: string;
    };

    expect(initializedState).toMatchObject({
      createdBy: 'Pipeline Tester',
      createdByEmail: 'pipeline@example.com',
      featureInfo: null,
      machineInfo: {
        platform: os.platform(),
        hostname: os.hostname(),
        osRelease: os.release(),
        nodeVersion: process.version,
        arch: os.arch(),
      },
    });
    expect(initializedState.fingerprintId).toMatch(/^fp1\.[A-Za-z0-9_-]{342}$/);
    expect(initializedState.fingerprintNonce).toMatch(/^[a-f0-9]{8}$/);
  });

  it('accepts feature metadata during initialization', async () => {
    const initialized = await state(
      'init',
      'feature-metadata',
      'feature/metadata',
      '--feature-id',
      'PROJ-1234',
      '--feature-url',
      'https://jira.example.com/browse/PROJ-1234',
    );

    expect(initialized.payload.state).toMatchObject({
      sourceBranch: 'feature/metadata',
      featureInfo: {
        featureId: 'PROJ-1234',
        featureUrl: 'https://jira.example.com/browse/PROJ-1234',
      },
    });
  });

  it('accepts a createdBy override during initialization', async () => {
    const initialized = await state(
      'init',
      'creator-override',
      'feature/creator-override',
      '--created-by',
      'testuser',
    );

    expect(initialized.payload.state).toMatchObject({
      createdBy: 'testuser',
      createdByEmail: 'pipeline@example.com',
    });
  });

  it('generates a unique fingerprint for each change', async () => {
    const first = await state('init', 'fingerprint-one', 'feature/fingerprint-one');
    const second = await state('init', 'fingerprint-two', 'feature/fingerprint-two');

    expect((first.payload.state as { fingerprintId: string }).fingerprintId).not.toBe(
      (second.payload.state as { fingerprintId: string }).fingerprintId,
    );
  });

  it('fills metadata defaults when loading an older Schema v2 state', async () => {
    const stateDir = path.join(repo, 'openspec/.pipeline-state');
    await fs.ensureDir(stateDir);
    await fs.writeJson(path.join(stateDir, 'older-v2.json'), {
      schemaVersion: 2,
      _version: 7,
      changeName: 'older-v2',
      currentPhase: 1,
      currentStep: 3,
      executionMode: 'pipeline',
      phaseHistory: [],
      gatesBypassed: [],
      decisions: {},
    });

    const loaded = await state('get', 'older-v2');
    expect(loaded.payload.state).toMatchObject({
      createdBy: 'unknown',
      createdByEmail: '',
      machineInfo: {
        platform: 'unknown',
        hostname: 'unknown',
        osRelease: 'unknown',
        nodeVersion: 'unknown',
        arch: 'unknown',
      },
      featureInfo: null,
      fingerprintId: '',
      fingerprintNonce: '',
    });
  });

  it('records pipeline phase history during transitions', async () => {
    await state('init', 'transition-history', 'feature/transition-history');
    await state('transition', 'transition-history', '1', '3');
    await state('decision', 'transition-history', 'proposalApproved', 'true');
    const transitioned = await state('transition', 'transition-history', '2', '6');
    const transitionedState = transitioned.payload.state as {
      _version: number;
      phaseHistory: PhaseHistoryEntry[];
    };

    expect(transitionedState._version).toBe(4);
    expect(transitionedState.phaseHistory).toEqual([
      expect.objectContaining({ phase: 0, executedBy: 'pipeline', status: 'completed' }),
      expect.objectContaining({ phase: 1, executedBy: 'pipeline', status: 'completed' }),
      expect.objectContaining({ phase: 2, executedBy: 'pipeline', status: 'in-progress' }),
    ]);
  });

  it('reuses pipeline history for transitions within the same phase', async () => {
    await state('init', 'same-phase-history', 'feature/same-phase-history');
    await state('transition', 'same-phase-history', '1', '3');
    await state('transition', 'same-phase-history', '1', '4');
    await state('transition', 'same-phase-history', '1', '5');
    const current = await state('get', 'same-phase-history');
    const history = (current.payload.state as { phaseHistory: PhaseHistoryEntry[] }).phaseHistory;
    const phaseOneEntries = history.filter(
      (entry) => entry.phase === 1 && entry.executedBy === 'pipeline',
    );

    expect(phaseOneEntries).toEqual([
      expect.objectContaining({ step: 5, status: 'in-progress', completedAt: null }),
    ]);
  });

  it('allows featureInfo to be updated through mutable state paths', async () => {
    await state('init', 'mutable-feature', 'feature/mutable-feature');
    const updated = await state('set', 'mutable-feature', 'featureInfo.featureId', '"PROJ-5678"');
    const withUrl = await state(
      'set',
      'mutable-feature',
      'featureInfo.featureUrl',
      '"https://jira.example.com/browse/PROJ-5678"',
    );

    expect(updated.code).toBe(0);
    expect(withUrl.payload.state).toMatchObject({
      featureInfo: {
        featureId: 'PROJ-5678',
        featureUrl: 'https://jira.example.com/browse/PROJ-5678',
      },
    });
  });

  it('keeps fingerprint metadata stable across transitions', async () => {
    const initialized = await state('init', 'stable-fingerprint', 'feature/stable-fingerprint');
    const initialState = initialized.payload.state as {
      fingerprintId: string;
      fingerprintNonce: string;
    };
    await state('transition', 'stable-fingerprint', '1', '3');
    await state('transition', 'stable-fingerprint', '1', '5');
    const current = await state('get', 'stable-fingerprint');

    expect(current.payload.state).toMatchObject({
      fingerprintId: initialState.fingerprintId,
      fingerprintNonce: initialState.fingerprintNonce,
    });
  });

  it('records both sides of a backward phase transition', async () => {
    await state('init', 'backward-history', 'feature/backward-history');
    await state('set', 'backward-history', 'executionMode', 'standalone');
    await state('decision', 'backward-history', 'proposalApproved', 'true');
    await state('decision', 'backward-history', 'implementationConfirmed', 'true');
    await state('set', 'backward-history', 'tests.status', 'passed');
    await state('transition', 'backward-history', '5', '15');
    const transitioned = await state('transition', 'backward-history', '2', '6');
    const history = (transitioned.payload.state as { phaseHistory: PhaseHistoryEntry[] })
      .phaseHistory;

    expect(history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phase: 5, executedBy: 'pipeline', status: 'completed' }),
        expect.objectContaining({ phase: 2, executedBy: 'pipeline', status: 'in-progress' }),
      ]),
    );
  });

  it('keeps standalone record-phase entries separate from transition history', async () => {
    await state('init', 'interleaved-history', 'feature/interleaved-history');
    await state('transition', 'interleaved-history', '1', '3');
    await state('record-phase', 'interleaved-history', '1', '3', 'openspec-propose', '--start');
    await state('record-phase', 'interleaved-history', '1', '5', 'openspec-propose');
    await state('decision', 'interleaved-history', 'proposalApproved', 'true');
    const transitioned = await state('transition', 'interleaved-history', '2', '6');
    const history = (transitioned.payload.state as { phaseHistory: PhaseHistoryEntry[] })
      .phaseHistory;

    expect(history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phase: 1,
          executedBy: 'pipeline',
          status: 'completed',
        }),
        expect.objectContaining({
          phase: 1,
          executedBy: 'openspec-propose',
          status: 'completed',
        }),
        expect.objectContaining({
          phase: 2,
          executedBy: 'pipeline',
          status: 'in-progress',
        }),
      ]),
    );
  });

  it('keeps complete lifecycle history across repeated forward and backward transitions', async () => {
    await state('init', 'repeated-history', 'feature/repeated-history');
    await state('transition', 'repeated-history', '1', '3');
    await state('decision', 'repeated-history', 'proposalApproved', 'true');
    await state('transition', 'repeated-history', '2', '6');
    await state('transition', 'repeated-history', '1', '3');
    await state('transition', 'repeated-history', '2', '6');
    await state('decision', 'repeated-history', 'implementationConfirmed', 'true');
    const transitioned = await state('transition', 'repeated-history', '4', '13');
    const history = (transitioned.payload.state as { phaseHistory: PhaseHistoryEntry[] })
      .phaseHistory;

    expect(history.map(({ phase, status }) => ({ phase, status }))).toEqual([
      { phase: 0, status: 'completed' },
      { phase: 1, status: 'completed' },
      { phase: 2, status: 'completed' },
      { phase: 1, status: 'completed' },
      { phase: 2, status: 'completed' },
      { phase: 4, status: 'in-progress' },
    ]);
    expect(history.filter((entry) => entry.status === 'in-progress')).toHaveLength(1);
    expect(history.slice(0, -1).every((entry) => entry.completedAt !== null)).toBe(true);
  });

  it('tracks a pure pipeline Phase 0 lifecycle from initialization', async () => {
    const initialized = await state('init', 'phase-zero-lifecycle', 'feature/phase-zero');
    const initialEntry = (initialized.payload.state as { phaseHistory: PhaseHistoryEntry[] })
      .phaseHistory[0];
    expect(initialEntry).toMatchObject({
      phase: 0,
      executedBy: 'pipeline',
      status: 'in-progress',
      completedAt: null,
    });

    const transitioned = await state('transition', 'phase-zero-lifecycle', '1', '3');
    const completedEntry = (transitioned.payload.state as { phaseHistory: PhaseHistoryEntry[] })
      .phaseHistory[0];
    expect(completedEntry).toMatchObject({
      phase: 0,
      executedBy: 'pipeline',
      status: 'completed',
    });
    expect(completedEntry?.startedAt).toBeTruthy();
    expect(completedEntry?.completedAt).toBeTruthy();
    if (!completedEntry?.completedAt) throw new Error('Phase 0 history was not completed');
    // yyyy-MM-dd HH:mm:ss 格式支持字典序比较
    expect(completedEntry.startedAt <= completedEntry.completedAt).toBe(true);
  });

  it('migrates Schema v1 to v3 only after confirmation and remains idempotent', async () => {
    const stateDir = path.join(repo, 'openspec/.pipeline-state');
    await fs.ensureDir(stateDir);
    await fs.writeJson(path.join(stateDir, 'legacy-change.json'), {
      schemaVersion: 1,
      changeName: 'legacy-change',
      sourceBranch: 'feature/legacy',
      targetBranch: null,
      currentPhase: 2,
      currentStep: 6,
      status: 'active',
      decisions: { proposalApproved: true },
      review: { round: 0, reportPath: null, status: 'pending' },
      tests: { command: null, attempts: 0, status: 'pending', detail: null },
      verify: { command: null, attempts: 0, status: 'pending', detail: null },
      archivePath: null,
      delivery: {},
      createdAt: '2026-07-25T00:00:00.000Z',
      updatedAt: '2026-07-25T00:00:00.000Z',
    });

    const prompt = await state('migrate-schema', 'legacy-change');
    expect(prompt).toMatchObject({ code: 0 });
    expect(prompt.payload).toMatchObject({
      status: 'prompt',
      reason: 'migration-requires-confirmation',
    });
    expect((await fs.readJson(path.join(stateDir, 'legacy-change.json'))).schemaVersion).toBe(1);

    const migrated = await state('migrate-schema', 'legacy-change', '--confirm');
    expect(migrated.code).toBe(0);
    expect(migrated.payload).toMatchObject({ status: 'ok', reason: 'schema-migrated' });
    expect(migrated.payload.state).toMatchObject({
      schemaVersion: 3,
      _version: 1,
      executionMode: 'pipeline',
      phaseHistory: [],
      gatesBypassed: [],
      decisions: { proposalApproved: true },
      review: {
        currentRound: 0,
        rounds: [],
        reportPath: null,
        status: 'pending',
      },
    });

    const repeated = await state('migrate-schema', 'legacy-change', '--confirm');
    expect(repeated.payload).toMatchObject({ status: 'ok', reason: 'already-v3' });
    expect((repeated.payload.state as { _version: number })._version).toBe(1);
  });

  it('migrates a completed Schema v2 review into a v3 round and clears the staging path', async () => {
    const stateDir = path.join(repo, 'openspec/.pipeline-state');
    await fs.ensureDir(stateDir);
    await fs.writeJson(path.join(stateDir, 'legacy-review.json'), {
      schemaVersion: 2,
      _version: 4,
      changeName: 'legacy-review',
      currentPhase: 3,
      currentStep: 12,
      executionMode: 'pipeline',
      phaseHistory: [],
      gatesBypassed: [],
      decisions: { reviewDisposition: 'fix-and-rereview' },
      review: {
        round: 2,
        reportPath: 'openspec/review/legacy-review.md',
        status: 'issues-found',
      },
      updatedAt: '2026-07-27 14:30:00',
    });

    const migrated = await state('migrate-schema', 'legacy-review', '--confirm');
    expect(migrated.code).toBe(0);
    expect(migrated.payload.state).toMatchObject({
      schemaVersion: 3,
      _version: 5,
      review: {
        currentRound: 2,
        reportPath: null,
        status: 'issues-found',
        rounds: [
          {
            round: 2,
            reportPath: 'openspec/review/legacy-review.md',
            status: 'issues-found',
            timestamp: '2026-07-27 14:30:00',
            decisions: { reviewDisposition: 'fix-and-rereview' },
          },
        ],
      },
    });
  });

  it('records resumable phase history, decision snapshots and bypassed gates', async () => {
    await state('init', 'phase-history', 'feature/phase-history');
    await state('record-phase', 'phase-history', '2', '6', 'openspec-apply-change', '--start');
    await state('decision', 'phase-history', 'implementationConfirmed', 'true');
    await state(
      'record-phase',
      'phase-history',
      '2',
      '8',
      'openspec-apply-change',
      'review-skipped',
      'review-skipped',
    );
    await state('record-phase', 'phase-history', '3', '9', 'pipeline', '--start');
    await state('record-phase', 'phase-history', '3', '9', 'pipeline', '--abandon');

    const current = await state('get', 'phase-history');
    const currentState = current.payload.state as {
      executionMode: string;
      phaseHistory: Array<{
        phase: number;
        step: number;
        executedBy: string;
        status: string;
        startedAt: string;
        completedAt: string | null;
        decisions: Record<string, unknown>;
        gatesBypassed: string[];
      }>;
      gatesBypassed: string[];
    };

    expect(currentState.executionMode).toBe('pipeline');
    expect(currentState.gatesBypassed).toEqual(['review-skipped']);
    expect(currentState.phaseHistory).toHaveLength(3);
    expect(currentState.phaseHistory[1]).toMatchObject({
      phase: 2,
      step: 8,
      executedBy: 'openspec-apply-change',
      status: 'completed',
      decisions: { implementationConfirmed: true },
      gatesBypassed: ['review-skipped'],
    });
    expect(currentState.phaseHistory[1]?.completedAt).toBeTruthy();
    expect(currentState.phaseHistory[2]).toMatchObject({
      phase: 3,
      status: 'abandoned',
    });
    expect(currentState.phaseHistory[2]?.completedAt).toBeTruthy();
  });

  it('requires Schema v3 before recording phase history', async () => {
    const stateDir = path.join(repo, 'openspec/.pipeline-state');
    await fs.ensureDir(stateDir);
    await fs.writeJson(path.join(stateDir, 'legacy-record.json'), {
      schemaVersion: 1,
      changeName: 'legacy-record',
      decisions: {},
    });

    const result = await state(
      'record-phase',
      'legacy-record',
      '1',
      '3',
      'openspec-propose',
      '--start',
    );
    expect(result.code).toBe(11);
    expect(result.payload.reason).toBe('pipeline-state-migration-required');
  });

  it('keeps concurrent Phase 5 operation histories isolated by executor', async () => {
    await state('init', 'phase-five-history', 'feature/phase-five-history');
    await state(
      'record-phase',
      'phase-five-history',
      '5',
      '16',
      'openspec-verify-change',
      '--start',
    );
    await state(
      'record-phase',
      'phase-five-history',
      '5',
      '15',
      'openspec-archive-change',
      '--start',
    );
    await state('record-phase', 'phase-five-history', '5', '19', 'openspec-archive-change');

    const current = await state('get', 'phase-five-history');
    const history = (
      current.payload.state as {
        phaseHistory: Array<{ executedBy: string; status: string; completedAt: string | null }>;
      }
    ).phaseHistory.filter((entry) => entry.executedBy !== 'pipeline');
    expect(history).toEqual([
      expect.objectContaining({
        executedBy: 'openspec-verify-change',
        status: 'in-progress',
        completedAt: null,
      }),
      expect.objectContaining({
        executedBy: 'openspec-archive-change',
        status: 'completed',
      }),
    ]);
  });

  it.each([
    'pipeline',
    'standalone',
    'hybrid',
  ])('enforces cumulative gates in %s mode', async (executionMode) => {
    const changeName = `${executionMode}-jump`;
    await state('init', changeName, `feature/${executionMode}-jump`);
    await state('set', changeName, 'executionMode', executionMode);

    const jump = await state('transition', changeName, '5', '15');
    expect(jump.code).toBe(11);
    expect(jump.payload.reason).toBe('proposal-approval-required');

    const current = await state('get', changeName);
    expect(current.payload.state).toMatchObject({ currentPhase: 0, executionMode });
  });

  it('allows a forward jump only after every intermediate gate is satisfied', async () => {
    await state('init', 'gated-jump', 'feature/gated-jump');
    await state('decision', 'gated-jump', 'proposalApproved', 'true');
    await state('decision', 'gated-jump', 'implementationConfirmed', 'true');
    await state('set', 'gated-jump', 'tests.status', 'skipped');

    const jump = await state('transition', 'gated-jump', '5', '15');
    expect(jump.code).toBe(0);
    expect(jump.payload.state).toMatchObject({ currentPhase: 5, executionMode: 'pipeline' });
  });

  it('requires explicit proposal and implementation decisions in standalone mode', async () => {
    await state('init', 'gate-inference', 'feature/gate-inference');
    await state('set', 'gate-inference', 'executionMode', 'standalone');
    await state('transition', 'gate-inference', '1', '3');
    await state('record-phase', 'gate-inference', '2', '6', 'openspec-apply-change', '--start');

    const enterApply = await state('transition', 'gate-inference', '2', '6');
    expect(enterApply.code).toBe(11);
    expect(enterApply.payload.reason).toBe('proposal-approval-required');

    await state('decision', 'gate-inference', 'proposalApproved', 'true');
    expect((await state('transition', 'gate-inference', '2', '6')).code).toBe(0);
    await state('record-phase', 'gate-inference', '3', '9', 'pipeline', '--start');
    const leaveApply = await state('transition', 'gate-inference', '3', '9');
    expect(leaveApply.code).toBe(11);
    expect(leaveApply.payload.reason).toBe('implementation-confirmation-required');
  });

  it('never infers the post-archive delivery action', async () => {
    await state('init', 'delivery-gate', 'feature/delivery-gate');
    await state('set', 'delivery-gate', 'executionMode', 'standalone');
    await state('decision', 'delivery-gate', 'proposalApproved', 'true');
    await state('decision', 'delivery-gate', 'implementationConfirmed', 'true');
    await state('set', 'delivery-gate', 'tests.status', 'passed');
    await state('transition', 'delivery-gate', '5', '15');
    await state('set', 'delivery-gate', 'verify.status', 'passed');
    await state('set', 'delivery-gate', 'archivePath', 'openspec/changes/archive/delivery-gate');

    const transition = await state('transition', 'delivery-gate', '6', '20');
    expect(transition.code).toBe(11);
    expect(transition.payload.reason).toBe('post-archive-decision-required');
  });

  it('enforces proposal, implementation, test and archive gates', async () => {
    expect((await state('init', 'demo-change', 'feature/demo')).code).toBe(0);
    expect((await state('transition', 'demo-change', '1', '3')).code).toBe(0);

    const noProposalApproval = await state('transition', 'demo-change', '2', '6');
    expect(noProposalApproval.code).toBe(11);
    expect(noProposalApproval.payload.reason).toBe('proposal-approval-required');

    await state('decision', 'demo-change', 'proposalApproved', 'true');
    expect((await state('transition', 'demo-change', '2', '6')).code).toBe(0);

    const noImplementationConfirmation = await state('transition', 'demo-change', '3', '9');
    expect(noImplementationConfirmation.payload.reason).toBe(
      'implementation-confirmation-required',
    );

    await state('decision', 'demo-change', 'implementationConfirmed', 'true');
    expect((await state('transition', 'demo-change', '3', '9')).code).toBe(0);
    expect((await state('transition', 'demo-change', '4', '13')).code).toBe(0);

    const noTestResult = await state('transition', 'demo-change', '5', '15');
    expect(noTestResult.payload.reason).toBe('test-gate-required');

    await state('set', 'demo-change', 'tests.status', 'passed');
    expect((await state('transition', 'demo-change', '5', '15')).code).toBe(0);

    const noVerify = await state('transition', 'demo-change', '6', '20');
    expect(noVerify.payload.reason).toBe('verify-gate-required');

    await state('set', 'demo-change', 'verify.status', 'passed');
    const noArchive = await state('transition', 'demo-change', '6', '20');
    expect(noArchive.payload.reason).toBe('archive-required');

    await state('set', 'demo-change', 'archivePath', 'openspec/changes/archive/demo-change');
    await state('decision', 'demo-change', 'postArchiveAction', 'push-only');
    expect((await state('transition', 'demo-change', '6', '20')).code).toBe(0);
    expect((await state('complete', 'demo-change')).code).toBe(0);

    const current = await state('get', 'demo-change');
    const currentState = current.payload.state as { currentPhase: number; status: string };
    expect(currentState.currentPhase).toBe(6);
    expect(currentState.status).toBe('completed');
  });

  it('rejects unsupported jumps and writes state atomically', async () => {
    await state('init', 'resume-change', 'feature/resume');
    const repeatedInit = await state('init', 'resume-change', 'feature/overwrite-attempt');
    expect(repeatedInit.payload.reason).toBe('pipeline-state-already-exists');
    expect((repeatedInit.payload.state as { sourceBranch: string }).sourceBranch).toBe(
      'feature/resume',
    );

    const invalid = await state('transition', 'resume-change', '4', '13');

    expect(invalid.code).toBe(11);
    expect(invalid.payload.reason).toBe('proposal-approval-required');

    await state('pause', 'resume-change', 'waiting for user');
    const current = await state('get', 'resume-change');
    expect((current.payload.state as { status: string }).status).toBe('paused');

    const stateDir = path.join(repo, 'openspec/.pipeline-state');
    expect((await fs.readdir(stateDir)).sort()).toEqual(['resume-change.json']);
  });

  it('records every review round with report, timestamp and decision snapshots', async () => {
    await state('init', 'review-history', 'feature/review-history');
    await state(
      'set',
      'review-history',
      'review.reportPath',
      '"openspec/review/review-history-round-1.md"',
    );
    await state('decision', 'review-history', 'reviewDisposition', 'fix-and-rereview');
    await state('attempt', 'review-history', 'review', 'issues-found');

    await state(
      'decision',
      'review-history',
      'fixProposalPath',
      'openspec/changes/review-history/fix-proposal-round-1.md',
    );
    await state('decision', 'review-history', 'fixProposalGenerated', 'true');
    await state('decision', 'review-history', 'fixProposalApproved', 'true');
    await state('decision', 'review-history', 'fixApplied', 'true');
    await state(
      'set',
      'review-history',
      'review.reportPath',
      '"openspec/review/review-history-round-2.md"',
    );
    const second = await state('attempt', 'review-history', 'review', 'passed');
    const review = (second.payload.state as { review: ReviewState }).review;

    expect(review.currentRound).toBe(2);
    expect(review.status).toBe('passed');
    expect(review.reportPath).toBe('openspec/review/review-history-round-2.md');
    expect(review.rounds).toHaveLength(2);
    expect(review.rounds[0]).toMatchObject({
      round: 1,
      reportPath: 'openspec/review/review-history-round-1.md',
      status: 'issues-found',
      decisions: { reviewDisposition: 'fix-and-rereview' },
    });
    expect(review.rounds[0]?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(review.rounds[1]).toMatchObject({
      round: 2,
      reportPath: 'openspec/review/review-history-round-2.md',
      status: 'passed',
      decisions: {
        fixProposalPath: 'openspec/changes/review-history/fix-proposal-round-1.md',
        fixProposalGenerated: true,
        fixProposalApproved: true,
        fixApplied: true,
      },
    });
    expect(review.rounds[1]?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('does not allow review status or round history to be changed with set', async () => {
    await state('init', 'protected-review', 'feature/protected-review');

    for (const field of ['review.status', 'review.currentRound', 'review.rounds']) {
      const result = await state('set', 'protected-review', field, 'passed');
      expect(result.code).toBe(11);
      expect(result.payload.reason).toBe('invalid-state-field');
    }
  });

  it('counts only consecutive issues-found rounds toward the review limit', async () => {
    await state('init', 'review-limit-reset', 'feature/review-limit-reset');
    await state('attempt', 'review-limit-reset', 'review', 'issues-found');
    await state('attempt', 'review-limit-reset', 'review', 'issues-found');
    await state('attempt', 'review-limit-reset', 'review', 'passed');
    await state('attempt', 'review-limit-reset', 'review', 'issues-found');
    const fifth = await state('attempt', 'review-limit-reset', 'review', 'issues-found');

    expect(fifth.code).toBe(0);
    expect(fifth.payload.state).toMatchObject({
      status: 'active',
      review: { currentRound: 5, status: 'issues-found' },
    });

    const sixth = await state('attempt', 'review-limit-reset', 'review', 'issues-found');
    expect(sixth.code).toBe(11);
    expect(sixth.payload.reason).toBe('review-attempt-limit-reached');
    expect((sixth.payload.state as { review: ReviewState }).review.rounds).toHaveLength(6);
  });

  it.each([
    ['review', 'issues-found', 'review-attempt-limit-reached', 'currentRound'],
    ['tests', 'failed', 'tests-attempt-limit-reached', 'attempts'],
    ['verify', 'failed', 'verify-attempt-limit-reached', 'attempts'],
  ] as const)('pauses after the third failed %s attempt', async (scope, status, reason, counter) => {
    await state('init', `${scope}-limit`, `feature/${scope}-limit`);

    expect((await state('attempt', `${scope}-limit`, scope, status)).code).toBe(0);
    expect((await state('attempt', `${scope}-limit`, scope, status)).code).toBe(0);
    const third = await state('attempt', `${scope}-limit`, scope, status);

    expect(third.code).toBe(11);
    expect(third.payload.reason).toBe(reason);
    const current = await state('get', `${scope}-limit`);
    const currentState = current.payload.state as {
      status: string;
      review: { currentRound: number };
      tests: { attempts: number };
      verify: { attempts: number };
    };
    expect(currentState.status).toBe('paused');
    const attemptCount =
      scope === 'review' ? currentState.review.currentRound : currentState[scope][counter];
    expect(attemptCount).toBe(3);
  });

  it('resumes deterministically after archive state was persisted', async () => {
    await state('init', 'archive-resume', 'feature/archive-resume');
    await state('transition', 'archive-resume', '1', '3');
    await state('decision', 'archive-resume', 'proposalApproved', 'true');
    await state('transition', 'archive-resume', '2', '6');
    await state('decision', 'archive-resume', 'implementationConfirmed', 'true');
    await state('transition', 'archive-resume', '4', '13');
    await state('set', 'archive-resume', 'tests.status', 'skipped');
    await state('transition', 'archive-resume', '5', '15');
    await state('set', 'archive-resume', 'verify.status', 'passed');
    await state(
      'set',
      'archive-resume',
      'archivePath',
      'openspec/changes/archive/2026-07-25-archive-resume',
    );
    await state('pause', 'archive-resume', 'session-ended-after-archive');

    const resumed = await state('get', 'archive-resume');
    const resumedState = resumed.payload.state as {
      currentPhase: number;
      archivePath: string;
      status: string;
    };
    expect(resumedState).toMatchObject({
      currentPhase: 5,
      archivePath: 'openspec/changes/archive/2026-07-25-archive-resume',
      status: 'paused',
    });

    await state('decision', 'archive-resume', 'postArchiveAction', 'push-only');
    const transition = await state('transition', 'archive-resume', '6', '20');
    expect(transition.code).toBe(0);
  });
});
