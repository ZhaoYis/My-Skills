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

beforeEach(async () => {
  repo = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-state-'));
  createdDirs.push(repo);
  await run('git', ['init', '--quiet']);
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
  return run(process.execPath, [stateScript, ...args]);
}

describe('pipeline state machine', () => {
  it('initializes Schema v2 with standalone integration fields', async () => {
    const initialized = await state('init', 'schema-v2', 'feature/schema-v2');
    const initializedState = initialized.payload.state as {
      schemaVersion: number;
      _version: number;
      executionMode: string;
      phaseHistory: unknown[];
      gatesBypassed: unknown[];
      _readVersion?: number;
    };

    expect(initialized.code).toBe(0);
    expect(initializedState).toMatchObject({
      schemaVersion: 2,
      _version: 1,
      executionMode: 'pipeline',
      phaseHistory: [],
      gatesBypassed: [],
    });
    expect(initializedState._readVersion).toBeUndefined();

    const persisted = await fs.readJson(path.join(repo, 'openspec/.pipeline-state/schema-v2.json'));
    expect(persisted._readVersion).toBeUndefined();
  });

  it('migrates Schema v1 only after confirmation and remains idempotent', async () => {
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
      schemaVersion: 2,
      _version: 1,
      executionMode: 'pipeline',
      phaseHistory: [],
      gatesBypassed: [],
      decisions: { proposalApproved: true },
    });

    const repeated = await state('migrate-schema', 'legacy-change', '--confirm');
    expect(repeated.payload).toMatchObject({ status: 'ok', reason: 'already-v2' });
    expect((repeated.payload.state as { _version: number })._version).toBe(1);
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

    expect(currentState.executionMode).toBe('hybrid');
    expect(currentState.gatesBypassed).toEqual(['review-skipped']);
    expect(currentState.phaseHistory).toHaveLength(2);
    expect(currentState.phaseHistory[0]).toMatchObject({
      phase: 2,
      step: 8,
      executedBy: 'openspec-apply-change',
      status: 'completed',
      decisions: { implementationConfirmed: true },
      gatesBypassed: ['review-skipped'],
    });
    expect(currentState.phaseHistory[0]?.completedAt).toBeTruthy();
    expect(currentState.phaseHistory[1]).toMatchObject({
      phase: 3,
      status: 'abandoned',
    });
    expect(currentState.phaseHistory[1]?.completedAt).toBeTruthy();
  });

  it('requires Schema v2 before recording phase history', async () => {
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
    ).phaseHistory;
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

  it('allows standalone forward jumps while preserving strict pipeline transitions', async () => {
    await state('init', 'strict-jump', 'feature/strict-jump');
    await state('transition', 'strict-jump', '1', '3');
    expect((await state('transition', 'strict-jump', '3', '9')).payload.reason).toBe(
      'pipeline-transition-not-allowed',
    );

    await state('init', 'standalone-jump', 'feature/standalone-jump');
    await state('set', 'standalone-jump', 'executionMode', 'standalone');
    await state('transition', 'standalone-jump', '1', '3');
    const jump = await state('transition', 'standalone-jump', '3', '9');
    expect(jump.code).toBe(0);
    expect((jump.payload.state as { currentPhase: number }).currentPhase).toBe(3);

    await state('init', 'hybrid-jump', 'feature/hybrid-jump');
    await state('transition', 'hybrid-jump', '1', '3');
    await state('record-phase', 'hybrid-jump', '5', '15', 'openspec-archive-change', '--start');
    await state('set', 'hybrid-jump', 'tests.status', 'passed');
    const hybridJump = await state('transition', 'hybrid-jump', '5', '15');
    expect(hybridJump.code).toBe(0);
    expect(hybridJump.payload.state).toMatchObject({
      currentPhase: 5,
      executionMode: 'hybrid',
    });
  });

  it('persists inferred proposal and implementation gates in hybrid mode', async () => {
    await state('init', 'gate-inference', 'feature/gate-inference');
    await state('set', 'gate-inference', 'executionMode', 'standalone');
    await state('transition', 'gate-inference', '1', '3');
    await state('record-phase', 'gate-inference', '2', '6', 'openspec-apply-change', '--start');

    const enterApply = await state('transition', 'gate-inference', '2', '6');
    expect(enterApply.code).toBe(0);
    expect(enterApply.payload.state).toMatchObject({
      currentPhase: 2,
      decisions: { proposalApproved: true },
    });

    await state('record-phase', 'gate-inference', '3', '9', 'pipeline', '--start');
    const leaveApply = await state('transition', 'gate-inference', '3', '9');
    expect(leaveApply.code).toBe(0);
    expect(leaveApply.payload.state).toMatchObject({
      currentPhase: 3,
      decisions: { proposalApproved: true, implementationConfirmed: true },
    });
  });

  it('never infers the post-archive delivery action', async () => {
    await state('init', 'delivery-gate', 'feature/delivery-gate');
    await state('set', 'delivery-gate', 'executionMode', 'standalone');
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
    expect(invalid.payload.reason).toBe('pipeline-transition-not-allowed');

    await state('pause', 'resume-change', 'waiting for user');
    const current = await state('get', 'resume-change');
    expect((current.payload.state as { status: string }).status).toBe('paused');

    const stateDir = path.join(repo, 'openspec/.pipeline-state');
    expect((await fs.readdir(stateDir)).sort()).toEqual(['resume-change.json']);
  });

  it.each([
    ['review', 'issues-found', 'review-attempt-limit-reached', 'round'],
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
      review: { round: number };
      tests: { attempts: number };
      verify: { attempts: number };
    };
    expect(currentState.status).toBe('paused');
    const attemptCount =
      scope === 'review' ? currentState.review.round : currentState[scope][counter];
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
