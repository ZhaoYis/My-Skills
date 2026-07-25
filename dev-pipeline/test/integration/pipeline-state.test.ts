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
  ] as const)(
    'pauses after the third failed %s attempt',
    async (scope, status, reason, counter) => {
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
    },
  );

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
