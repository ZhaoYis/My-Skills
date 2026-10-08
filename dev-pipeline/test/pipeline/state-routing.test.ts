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
  payload: {
    reason?: string;
    nextPhase?: number;
    state: {
      review: Record<string, unknown>;
      decisions: Record<string, unknown>;
      delivery: Record<string, unknown>;
      phaseHistory: Record<string, unknown>[];
      route: { upgradeHistory: { invalidated: { delivery: { commitSha: string | null } } }[] };
      tests: Record<string, unknown>;
      verify: Record<string, unknown>;
      archivePath: string | null;
    };
  };
}

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd: repo }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout.trim());
    });
  });
}

function state(...args: string[]): Promise<StateResult> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [stateScript, ...args, '--view', 'full'],
      { cwd: repo },
      (error, stdout) => {
        const code = error && 'code' in error && typeof error.code === 'number' ? error.code : 0;
        resolve({ code, payload: stdout ? JSON.parse(stdout) : {} });
      },
    );
  });
}

async function init(route = 'full') {
  expect(
    (
      await state(
        'init',
        'change',
        'feature/change',
        '--route',
        route,
        '--skip-feature-association',
      )
    ).code,
  ).toBe(0);
}

async function snapshot() {
  return (await state('get', 'change')).payload.state;
}

beforeEach(async () => {
  repo = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-state-routing-'));
  createdDirs.push(repo);
  await run('git', ['init', '--quiet']);
  await run('git', ['config', 'user.name', 'Routing Tester']);
  await run('git', ['config', 'user.email', 'routing@example.com']);
  await fs.outputFile(path.join(repo, 'openspec', 'config.yaml'), 'schema: spec-driven\n');
});

afterEach(async () => {
  await cleanupDirectories(createdDirs);
});

describe('Route exit gates and next Phase queries', () => {
  it.each([
    ['trivial', 6, 20],
    ['standard', 5, 15],
  ])('requires implementation confirmation for %s Route', async (route, phase, step) => {
    await init(String(route));
    await state('decision', 'change', 'proposalApproved', 'true');
    await state('transition', 'change', '2', '6');
    const before = await snapshot();
    const blocked = await state('transition', 'change', String(phase), String(step));
    expect(blocked.code).toBe(11);
    expect(blocked.payload.reason).toBe('implementation-confirmation-required');
    expect(await snapshot()).toEqual(before);
    await state('decision', 'change', 'implementationConfirmed', 'true');
    expect((await state('transition', 'change', String(phase), String(step))).code).toBe(0);
  });

  it.each([
    ['trivial', 2, 6],
    ['standard', 1, 3],
    ['full', 1, 3],
  ])('reports the configured entry for %s without writing state', async (route, phase, step) => {
    await init(String(route));
    const before = await snapshot();
    const next = await state('next', 'change');
    expect(next.code).toBe(0);
    expect(next.payload).toMatchObject({ nextPhase: phase, nextStep: step, terminal: false });
    expect(await snapshot()).toEqual(before);
  });

  it('honors explicit skip-review without skipping the test gate', async () => {
    await init();
    await state('decision', 'change', 'proposalApproved', 'true');
    await state('transition', 'change', '2', '6');
    await state('decision', 'change', 'reviewDisposition', 'skip-review');
    expect((await state('next', 'change')).payload).toMatchObject({ nextPhase: 4, nextStep: 13 });
  });

  it('validates the consumer Route config before calculating the next Phase', async () => {
    await init('trivial');
    await fs.outputFile(
      path.join(repo, 'openspec', 'config.yaml'),
      [
        'pipeline:',
        '  routes:',
        '    trivial:',
        '      description: Trivial',
        '      phases: [0, 2]',
        '    standard:',
        '      description: Standard',
        '      phases: [0, 1, 2, 5, 6]',
        '    full:',
        '      description: Full',
        '      phases: [0, 1, 2, 3, 4, 5, 6, 7]',
        '',
      ].join('\n'),
    );
    const before = await snapshot();
    const result = await state('next', 'change');
    expect(result.code).toBe(4);
    expect(result.payload.reason).toBe('invalid-route-config');
    expect(await snapshot()).toEqual(before);
  });

  it('requires an upgrade for merge delivery on a light Route', async () => {
    await init('trivial');
    await state('decision', 'change', 'implementationConfirmed', 'true');
    await state('transition', 'change', '6', '20');
    await state('decision', 'change', 'postArchiveAction', 'merge');
    const result = await state('next', 'change');
    expect(result.code).toBe(11);
    expect(result.payload.reason).toBe('merge-route-upgrade-required');
    await state('decision', 'change', 'postArchiveAction', 'push-only');
    expect((await state('next', 'change')).payload).toMatchObject({
      nextPhase: null,
      nextStep: null,
      terminal: true,
    });
  });
});

describe('Route upgrade compensation', () => {
  it('rewinds a trivial delivery to proposal and snapshots invalidated evidence', async () => {
    await init('trivial');
    await state('decision', 'change', 'implementationConfirmed', 'true');
    await state('transition', 'change', '6', '20');
    await state('decision', 'change', 'postArchiveAction', 'push-only');
    await state('decision', 'change', 'commitApproved', 'true');
    await state('set', 'change', 'delivery.commitSha', 'old-commit');
    const result = await state('route', 'change', 'upgrade', 'standard');
    expect(result.code).toBe(0);
    expect(result.payload).toMatchObject({ rewound: true, resumePhase: 1, resumeStep: 3 });
    const current = await snapshot();
    expect(current.decisions).toEqual({ postArchiveAction: 'push-only' });
    expect(current.delivery.commitSha).toBeNull();
    expect(current.route.upgradeHistory[0]?.invalidated.delivery.commitSha).toBe('old-commit');
    expect(current.phaseHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phase: 6, status: 'abandoned' }),
        expect.objectContaining({ phase: 1, status: 'in-progress' }),
      ]),
    );
    expect((await state('transition', 'change', '2', '6')).payload.reason).toBe(
      'proposal-approval-required',
    );
  });

  it('rewinds an archived standard delivery to quality phases and returns to merge delivery', async () => {
    await init('standard');
    await state('decision', 'change', 'proposalApproved', 'true');
    await state('decision', 'change', 'implementationConfirmed', 'true');
    await state('decision', 'change', 'postArchiveAction', 'merge');
    await state('set', 'change', 'verify.status', 'passed');
    await state('set', 'change', 'archivePath', 'openspec/changes/archive/change');
    await state('transition', 'change', '6', '20');
    await state('set', 'change', 'delivery.commitSha', 'old-commit');
    await state('set', 'change', 'delivery.sourcePushed', 'true');
    const result = await state('route', 'change', 'upgrade', 'full');
    expect(result.payload).toMatchObject({ rewound: true, resumePhase: 3, resumeStep: 9 });
    const current = await snapshot();
    expect(current.archivePath).toBe('openspec/changes/archive/change');
    expect(current.tests.status).toBe('pending');
    expect(current.verify.status).toBe('pending');
    expect(current.delivery.sourcePushed).toBe(false);
    expect(current.decisions.postArchiveAction).toBe('merge');
    expect((await state('transition', 'change', '5', '15')).payload.reason).toBe(
      'test-gate-required',
    );
    await state('attempt', 'change', 'tests', 'passed');
    await state('transition', 'change', '5', '15');
    expect((await state('transition', 'change', '6', '20')).payload.reason).toBe(
      'verify-gate-required',
    );
    await state('attempt', 'change', 'verify', 'passed');
    expect((await state('transition', 'change', '6', '20')).code).toBe(0);
    expect((await state('next', 'change')).payload).toMatchObject({ nextPhase: 7, nextStep: 23 });
  });

  it('keeps the current Phase when newly required phases are all ahead', async () => {
    await init('standard');
    await state('decision', 'change', 'proposalApproved', 'true');
    await state('transition', 'change', '2', '6');
    const result = await state('route', 'change', 'upgrade', 'full');
    expect(result.payload).toMatchObject({ rewound: false, resumePhase: 2, resumeStep: 6 });
    expect((await state('next', 'change')).payload.nextPhase).toBe(3);
  });
});

describe('Delivery completion conditions', () => {
  async function ready(route = 'trivial', mode = 'push-only') {
    await init(route);
    await state('decision', 'change', 'proposalApproved', 'true');
    await state('decision', 'change', 'implementationConfirmed', 'true');
    await state('decision', 'change', 'postArchiveAction', mode);
    await state('set', 'change', 'tests.status', 'passed');
    await state('set', 'change', 'verify.status', 'passed');
    await state('set', 'change', 'archivePath', 'openspec/changes/archive/change');
    await state('transition', 'change', '6', '20');
    await state('set', 'change', 'delivery.commitSha', 'source-commit');
  }

  it('allows local-only without push, and rejects reopening an already delivered Route', async () => {
    await ready('trivial', 'local-only');
    expect((await state('complete', 'change')).code).toBe(0);
    const before = await snapshot();
    expect((await state('complete', 'change')).payload.reason).toBe('pipeline-already-completed');
    expect(await snapshot()).toEqual(before);
    expect((await state('route', 'change', 'upgrade', 'full')).payload.reason).toBe(
      'completed-pipeline-route-upgrade-not-allowed',
    );
    expect(await snapshot()).toEqual(before);
  });

  it('requires source push for push-only', async () => {
    await ready();
    expect((await state('complete', 'change')).payload.reason).toBe('source-push-required');
    await state('set', 'change', 'delivery.sourcePushed', 'true');
    expect((await state('complete', 'change')).code).toBe(0);
  });

  it('requires Phase7 and target push for merge', async () => {
    await ready('full', 'merge');
    await state('set', 'change', 'delivery.sourcePushed', 'true');
    expect((await state('complete', 'change')).payload.reason).toBe('merge-phase-required');
    await state('transition', 'change', '7', '23');
    await state('set', 'change', 'delivery.mergeCommitSha', 'merge-commit');
    expect((await state('complete', 'change')).payload.reason).toBe('target-push-required');
    await state('set', 'change', 'delivery.targetPushed', 'true');
    expect((await state('complete', 'change')).code).toBe(0);
  });
});

describe('Review baseline capture', () => {
  it('captures the initial HEAD even when sourceBranch is a different configured name', async () => {
    await fs.outputFile(path.join(repo, 'tracked.txt'), 'base\n');
    await run('git', ['add', 'tracked.txt']);
    await run('git', ['commit', '-qm', 'initial']);
    const initialHead = await run('git', ['rev-parse', 'HEAD']);
    const initialBranch = await run('git', ['branch', '--show-current']);
    await init();
    expect((await snapshot()).review).toMatchObject({
      baseCommit: initialHead,
      baseBranch: initialBranch,
      baseEmpty: false,
    });
  });

  it('distinguishes an unborn initial repository from a missing legacy baseline', async () => {
    await init();
    expect((await snapshot()).review).toMatchObject({ baseCommit: null, baseEmpty: true });
    const statePath = path.join(repo, 'openspec', '.pipeline-state', 'change.json');
    const legacy = await fs.readJson(statePath);
    delete legacy.review.baseCommit;
    delete legacy.review.baseBranch;
    delete legacy.review.baseEmpty;
    await fs.writeJson(statePath, legacy);
    expect((await snapshot()).review).not.toHaveProperty('baseEmpty');
  });
});
