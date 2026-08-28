import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupDirectories } from '../helpers/cleanup.js';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const stateScript = path.join(
  PACKAGE_ROOT,
  'src/templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs',
);
const createdDirs: string[] = [];
let repo = '';

interface StateResult {
  code: number;
  payload: Record<string, unknown>;
}

beforeEach(async () => {
  repo = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-pipeline-gates-'));
  createdDirs.push(repo);
  await run('git', ['init', '--quiet']);
  await run('git', ['config', 'user.name', 'Gate Tester']);
  await run('git', ['config', 'user.email', 'gate@example.com']);
  await fs.ensureDir(path.join(repo, 'openspec', '.pipeline-state'));
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

function state(...args: string[]): Promise<StateResult> {
  const hasFeatureDecision =
    args.includes('--feature-id') || args.includes('--skip-feature-association');
  const normalizedArgs =
    args[0] === 'init' && !hasFeatureDecision ? [...args, '--skip-feature-association'] : args;
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [stateScript, ...normalizedArgs, '--view', 'full'],
      { cwd: repo },
      (error, stdout) => {
        const code = error && 'code' in error && typeof error.code === 'number' ? error.code : 0;
        resolve({ code, payload: stdout ? JSON.parse(stdout) : {} });
      },
    );
  });
}

async function initChange(changeName: string): Promise<void> {
  const result = await state('init', changeName, `feature/${changeName}`);
  expect(result.code).toBe(0);
}

async function jump(changeName: string, toPhase: number, toStep: number): Promise<StateResult> {
  return state('transition', changeName, String(toPhase), String(toStep));
}

describe('Phase 1 → Phase 2 gate (proposal-approval-required)', () => {
  it('blocks entering Phase 2 without proposalApproved in pipeline mode', async () => {
    await initChange('gate-proposal-pipeline');
    await state('transition', 'gate-proposal-pipeline', '1', '3');

    const result = await jump('gate-proposal-pipeline', 2, 6);
    expect(result.code).toBe(11);
    expect(result.payload.reason).toBe('proposal-approval-required');
  });

  it('allows entering Phase 2 once proposalApproved is set', async () => {
    await initChange('gate-proposal-allow');
    await state('transition', 'gate-proposal-allow', '1', '3');
    await state('decision', 'gate-proposal-allow', 'proposalApproved', 'true');

    const result = await jump('gate-proposal-allow', 2, 6);
    expect(result.code).toBe(0);
    expect(result.payload.state).toMatchObject({ currentPhase: 2 });
  });

  it('blocks entering Phase 2 without proposalApproved in standalone mode', async () => {
    await initChange('gate-proposal-standalone');
    await state('set', 'gate-proposal-standalone', 'executionMode', 'standalone');

    const result = await jump('gate-proposal-standalone', 2, 6);
    expect(result.code).toBe(11);
    expect(result.payload.reason).toBe('proposal-approval-required');
  });
});

describe('Phase 2 → Phase 3 gate (implementation-confirmation-required)', () => {
  it('blocks leaving Phase 2 without implementationConfirmed', async () => {
    await initChange('gate-impl-block');
    await state('transition', 'gate-impl-block', '1', '3');
    await state('decision', 'gate-impl-block', 'proposalApproved', 'true');
    await jump('gate-impl-block', 2, 6);

    const result = await jump('gate-impl-block', 3, 9);
    expect(result.code).toBe(11);
    expect(result.payload.reason).toBe('implementation-confirmation-required');
  });

  it('allows leaving Phase 2 after implementationConfirmed=true', async () => {
    await initChange('gate-impl-allow');
    await state('transition', 'gate-impl-allow', '1', '3');
    await state('decision', 'gate-impl-allow', 'proposalApproved', 'true');
    await jump('gate-impl-allow', 2, 6);
    await state('decision', 'gate-impl-allow', 'implementationConfirmed', 'true');

    const result = await jump('gate-impl-allow', 3, 9);
    expect(result.code).toBe(0);
  });
});

describe('Phase 4 → Phase 5 gate (test-gate-required)', () => {
  it('blocks entering Phase 5 with pending tests', async () => {
    await initChange('gate-test-block');
    await state('decision', 'gate-test-block', 'proposalApproved', 'true');
    await state('decision', 'gate-test-block', 'implementationConfirmed', 'true');
    await jump('gate-test-block', 4, 13);

    const result = await jump('gate-test-block', 5, 15);
    expect(result.code).toBe(11);
    expect(result.payload.reason).toBe('test-gate-required');
  });

  it.each(['passed', 'skipped', 'debt-recorded'])(
    'allows entering Phase 5 with tests.status=%j',
    async (status) => {
      await initChange(`gate-test-${status}`);
      await state('decision', `gate-test-${status}`, 'proposalApproved', 'true');
      await state('decision', `gate-test-${status}`, 'implementationConfirmed', 'true');
      await state('set', `gate-test-${status}`, 'tests.status', status);
      await jump(`gate-test-${status}`, 4, 13);

      const result = await jump(`gate-test-${status}`, 5, 15);
      expect(result.code).toBe(0);
    },
  );
});

describe('Phase 5 → Phase 6 gate (verify + archive + postArchive)', () => {
  it('blocks entering Phase 6 with no verify result', async () => {
    await initChange('gate-verify-block');
    await state('decision', 'gate-verify-block', 'proposalApproved', 'true');
    await state('decision', 'gate-verify-block', 'implementationConfirmed', 'true');
    await state('set', 'gate-verify-block', 'tests.status', 'passed');
    await jump('gate-verify-block', 5, 15);

    const result = await jump('gate-verify-block', 6, 20);
    expect(result.code).toBe(11);
    expect(result.payload.reason).toBe('verify-gate-required');
  });

  it('blocks entering Phase 6 with no archive path even after verify passes', async () => {
    await initChange('gate-archive-block');
    await state('decision', 'gate-archive-block', 'proposalApproved', 'true');
    await state('decision', 'gate-archive-block', 'implementationConfirmed', 'true');
    await state('set', 'gate-archive-block', 'tests.status', 'passed');
    await jump('gate-archive-block', 5, 15);
    await state('set', 'gate-archive-block', 'verify.status', 'passed');

    const result = await jump('gate-archive-block', 6, 20);
    expect(result.code).toBe(11);
    expect(result.payload.reason).toBe('archive-required');
  });

  it('blocks entering Phase 6 without an explicit post-archive action', async () => {
    await initChange('gate-postarchive-block');
    await state('decision', 'gate-postarchive-block', 'proposalApproved', 'true');
    await state('decision', 'gate-postarchive-block', 'implementationConfirmed', 'true');
    await state('set', 'gate-postarchive-block', 'tests.status', 'passed');
    await jump('gate-postarchive-block', 5, 15);
    await state('set', 'gate-postarchive-block', 'verify.status', 'passed');
    await state(
      'set',
      'gate-postarchive-block',
      'archivePath',
      'openspec/changes/archive/gate-postarchive-block',
    );

    const result = await jump('gate-postarchive-block', 6, 20);
    expect(result.code).toBe(11);
    expect(result.payload.reason).toBe('post-archive-decision-required');
  });

  it('allows push-only delivery for Phase 6', async () => {
    await initChange('gate-push-only');
    await state('decision', 'gate-push-only', 'proposalApproved', 'true');
    await state('decision', 'gate-push-only', 'implementationConfirmed', 'true');
    await state('set', 'gate-push-only', 'tests.status', 'passed');
    await jump('gate-push-only', 5, 15);
    await state('set', 'gate-push-only', 'verify.status', 'passed');
    await state(
      'set',
      'gate-push-only',
      'archivePath',
      'openspec/changes/archive/gate-push-only',
    );
    await state('decision', 'gate-push-only', 'postArchiveAction', 'push-only');

    const result = await jump('gate-push-only', 6, 20);
    expect(result.code).toBe(0);
  });

  it.each(['merge', 'push-only', 'local-only'])(
    'accepts postArchiveAction=%j for Phase 6 entry',
    async (action) => {
      await initChange(`gate-action-${action}`);
      await state('decision', `gate-action-${action}`, 'proposalApproved', 'true');
      await state('decision', `gate-action-${action}`, 'implementationConfirmed', 'true');
      await state('set', `gate-action-${action}`, 'tests.status', 'passed');
      await jump(`gate-action-${action}`, 5, 15);
      await state('set', `gate-action-${action}`, 'verify.status', 'passed');
      await state(
        'set',
        `gate-action-${action}`,
        'archivePath',
        `openspec/changes/archive/gate-action-${action}`,
      );
      await state('decision', `gate-action-${action}`, 'postArchiveAction', action);

      const result = await jump(`gate-action-${action}`, 6, 20);
      expect(result.code).toBe(0);
    },
  );
});

describe('Phase 6 → Phase 7 gate (merge delivery)', () => {
  it('blocks entering Phase 7 when postArchiveAction is not merge', async () => {
    await initChange('gate-merge-block-action');
    await state('decision', 'gate-merge-block-action', 'proposalApproved', 'true');
    await state('decision', 'gate-merge-block-action', 'implementationConfirmed', 'true');
    await state('set', 'gate-merge-block-action', 'tests.status', 'passed');
    await jump('gate-merge-block-action', 5, 15);
    await state('set', 'gate-merge-block-action', 'verify.status', 'passed');
    await state(
      'set',
      'gate-merge-block-action',
      'archivePath',
      'openspec/changes/archive/gate-merge-block-action',
    );
    await state('decision', 'gate-merge-block-action', 'postArchiveAction', 'push-only');
    await jump('gate-merge-block-action', 6, 20);

    const result = await jump('gate-merge-block-action', 7, 23);
    expect(result.code).toBe(11);
    expect(result.payload.reason).toBe('merge-gate-required');
  });

  it('blocks entering Phase 7 without delivery.commitSha', async () => {
    await initChange('gate-merge-block-commit');
    await state('decision', 'gate-merge-block-commit', 'proposalApproved', 'true');
    await state('decision', 'gate-merge-block-commit', 'implementationConfirmed', 'true');
    await state('set', 'gate-merge-block-commit', 'tests.status', 'passed');
    await jump('gate-merge-block-commit', 5, 15);
    await state('set', 'gate-merge-block-commit', 'verify.status', 'passed');
    await state(
      'set',
      'gate-merge-block-commit',
      'archivePath',
      'openspec/changes/archive/gate-merge-block-commit',
    );
    await state('decision', 'gate-merge-block-commit', 'postArchiveAction', 'merge');
    await jump('gate-merge-block-commit', 6, 20);

    const result = await jump('gate-merge-block-commit', 7, 23);
    expect(result.code).toBe(11);
    expect(result.payload.reason).toBe('commit-required');
  });

  it('blocks entering Phase 7 when sourcePushed is false', async () => {
    await initChange('gate-merge-block-push');
    await state('decision', 'gate-merge-block-push', 'proposalApproved', 'true');
    await state('decision', 'gate-merge-block-push', 'implementationConfirmed', 'true');
    await state('set', 'gate-merge-block-push', 'tests.status', 'passed');
    await jump('gate-merge-block-push', 5, 15);
    await state('set', 'gate-merge-block-push', 'verify.status', 'passed');
    await state(
      'set',
      'gate-merge-block-push',
      'archivePath',
      'openspec/changes/archive/gate-merge-block-push',
    );
    await state('decision', 'gate-merge-block-push', 'postArchiveAction', 'merge');
    await jump('gate-merge-block-push', 6, 20);
    await state('set', 'gate-merge-block-push', 'delivery.commitSha', 'abc123');

    const result = await jump('gate-merge-block-push', 7, 23);
    expect(result.code).toBe(11);
    expect(result.payload.reason).toBe('source-push-required');
  });

  it('allows Phase 7 when merge is fully prepared', async () => {
    await initChange('gate-merge-allow');
    await state('decision', 'gate-merge-allow', 'proposalApproved', 'true');
    await state('decision', 'gate-merge-allow', 'implementationConfirmed', 'true');
    await state('set', 'gate-merge-allow', 'tests.status', 'passed');
    await jump('gate-merge-allow', 5, 15);
    await state('set', 'gate-merge-allow', 'verify.status', 'passed');
    await state(
      'set',
      'gate-merge-allow',
      'archivePath',
      'openspec/changes/archive/gate-merge-allow',
    );
    await state('decision', 'gate-merge-allow', 'postArchiveAction', 'merge');
    await jump('gate-merge-allow', 6, 20);
    await state('set', 'gate-merge-allow', 'delivery.commitSha', 'abc123');
    await state('set', 'gate-merge-allow', 'delivery.sourcePushed', 'true');

    const result = await jump('gate-merge-allow', 7, 23);
    expect(result.code).toBe(0);
  });
});

describe('Cumulative gate enforcement on forward jumps', () => {
  it('refuses a 0→5 jump when no decision is recorded', async () => {
    await initChange('gate-jump-block');

    const result = await jump('gate-jump-block', 5, 15);
    expect(result.code).toBe(11);
    expect(result.payload.reason).toBe('proposal-approval-required');
  });

  it('still blocks a 0→5 jump until every intermediate gate is satisfied', async () => {
    await initChange('gate-jump-mid');
    await state('decision', 'gate-jump-mid', 'proposalApproved', 'true');
    await state('decision', 'gate-jump-mid', 'implementationConfirmed', 'true');

    const result = await jump('gate-jump-mid', 5, 15);
    expect(result.code).toBe(11);
    expect(result.payload.reason).toBe('test-gate-required');
  });

  it('accepts a 0→5 jump once proposal, implementation, and tests are recorded', async () => {
    await initChange('gate-jump-allow');
    await state('decision', 'gate-jump-allow', 'proposalApproved', 'true');
    await state('decision', 'gate-jump-allow', 'implementationConfirmed', 'true');
    await state('set', 'gate-jump-allow', 'tests.status', 'passed');

    const result = await jump('gate-jump-allow', 5, 15);
    expect(result.code).toBe(0);
  });
});

describe('Attempt limits pause the pipeline', () => {
  const failureStatus: Record<'review' | 'tests' | 'verify', 'issues-found' | 'failed'> = {
    review: 'issues-found',
    tests: 'failed',
    verify: 'failed',
  };

  for (const scope of ['review', 'tests', 'verify'] as const) {
    it(`pauses the pipeline after three ${scope} failures`, async () => {
      const failure = failureStatus[scope];
      await initChange(`pause-${scope}`);

      expect((await state('attempt', `pause-${scope}`, scope, failure)).code).toBe(0);
      expect((await state('attempt', `pause-${scope}`, scope, failure)).code).toBe(0);
      const third = await state('attempt', `pause-${scope}`, scope, failure);

      expect(third.code).toBe(11);
      expect(third.payload.reason).toBe(`${scope}-attempt-limit-reached`);

      const current = await state('get', `pause-${scope}`);
      expect(current.payload.state).toMatchObject({ status: 'paused' });
    });
  }

  it('keeps review counter separate from previous successful rounds', async () => {
    await initChange('pause-review-reset');
    await state('attempt', 'pause-review-reset', 'review', 'issues-found');
    await state('attempt', 'pause-review-reset', 'review', 'issues-found');
    await state('attempt', 'pause-review-reset', 'review', 'passed');
    // Counter resets after a passing round
    await state('attempt', 'pause-review-reset', 'review', 'issues-found');

    const current = await state('get', 'pause-review-reset');
    expect(current.payload.state).toMatchObject({
      status: 'active',
      review: { status: 'issues-found' },
    });
  });
});

describe('Standalone mode requires explicit decisions', () => {
  it('requires proposal approval even on direct phase 2 entry', async () => {
    await initChange('standalone-proposal');
    await state('set', 'standalone-proposal', 'executionMode', 'standalone');

    const result = await jump('standalone-proposal', 2, 6);
    expect(result.code).toBe(11);
    expect(result.payload.reason).toBe('proposal-approval-required');
  });

  it('requires implementation confirmation before leaving Phase 2', async () => {
    await initChange('standalone-impl');
    await state('set', 'standalone-impl', 'executionMode', 'standalone');
    await state('decision', 'standalone-impl', 'proposalApproved', 'true');
    await jump('standalone-impl', 2, 6);

    const result = await jump('standalone-impl', 3, 9);
    expect(result.code).toBe(11);
    expect(result.payload.reason).toBe('implementation-confirmation-required');
  });
});

describe('Re-entry and round-trip gates', () => {
  it('re-enforces implementation confirmation if a user explicitly resets the decision', async () => {
    await initChange('reentry');
    await state('decision', 'reentry', 'proposalApproved', 'true');
    await state('decision', 'reentry', 'implementationConfirmed', 'true');
    await state('set', 'reentry', 'tests.status', 'skipped');
    await jump('reentry', 5, 15);
    await jump('reentry', 2, 6);

    // Reset the decision to invalid; subsequent transition must re-validate the gate.
    await state('decision', 'reentry', 'implementationConfirmed', 'null');
    const leaveApply = await jump('reentry', 3, 9);
    expect(leaveApply.code).toBe(11);
    expect(leaveApply.payload.reason).toBe('implementation-confirmation-required');
  });
});