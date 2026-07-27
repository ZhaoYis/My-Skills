import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const script = fileURLToPath(
  new URL(
    '../../templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs',
    import.meta.url,
  ),
);
let repo;
let stateDirectory;
let sequence = 0;

function baseState(changeName, currentPhase, overrides = {}) {
  return {
    schemaVersion: 3,
    _version: 1,
    changeName,
    sourceBranch: 'feature/gate-test',
    targetBranch: null,
    currentPhase,
    currentStep: 1,
    status: 'active',
    executionMode: 'pipeline',
    phaseHistory: [
      {
        phase: currentPhase,
        step: 1,
        executedBy: 'pipeline',
        status: 'in-progress',
        startedAt: '2026-07-26 00:00:00',
        completedAt: null,
        decisions: {},
        gatesBypassed: [],
      },
    ],
    gatesBypassed: [],
    decisions: {
      proposalApproved: true,
      implementationConfirmed: true,
      postArchiveAction: 'push-only',
    },
    review: { currentRound: 0, rounds: [], reportPath: null, status: 'pending' },
    tests: { command: null, attempts: 0, status: 'passed', detail: null },
    verify: { command: null, attempts: 0, status: 'passed', detail: null },
    archivePath: 'openspec/changes/archive/gate-test',
    delivery: {},
    createdAt: '2026-07-26 00:00:00',
    updatedAt: '2026-07-26 00:00:00',
    ...overrides,
  };
}

async function transition(from, to, overrides = {}) {
  sequence += 1;
  const changeName = `transition-${sequence}`;
  const state = baseState(changeName, from, overrides);
  await writeFile(path.join(stateDirectory, `${changeName}.json`), `${JSON.stringify(state)}\n`);

  const result = spawnSync(process.execPath, [script, 'transition', changeName, String(to), '99'], {
    cwd: repo,
    encoding: 'utf8',
  });

  return {
    code: result.status,
    payload: result.stdout ? JSON.parse(result.stdout) : {},
  };
}

async function expectAllowed(from, to, overrides) {
  const result = await transition(from, to, overrides);
  expect(result.code, `${from}->${to} should be allowed`).toBe(0);
  expect(result.payload.state.currentPhase).toBe(to);
}

async function expectRejected(from, to, reason, overrides) {
  const result = await transition(from, to, overrides);
  expect(result.code, `${from}->${to} should be rejected`).toBe(11);
  expect(result.payload.reason).toBe(reason);
}

beforeAll(async () => {
  repo = await mkdtemp(path.join(os.tmpdir(), 'dev-pipeline-state-test-'));
  stateDirectory = path.join(repo, 'openspec/.pipeline-state');
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  await mkdir(stateDirectory, { recursive: true });
});

afterAll(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe('dev-pipeline-state transition gates', () => {
  it('enforces the complete transition and cumulative gate matrix', async () => {
    for (const [from, to] of [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [2, 1],
      [3, 2],
      [4, 2],
      [5, 1],
      [5, 2],
      [3, 3],
      [4, 4],
    ]) {
      await expectAllowed(from, to);
    }

    await expectAllowed(3, 5, {
      tests: { command: null, attempts: 0, status: 'skipped', detail: 'user-confirmed' },
    });
    await expectRejected(3, 6, 'test-gate-required', {
      tests: { command: null, attempts: 0, status: 'pending', detail: null },
      verify: { command: null, attempts: 0, status: 'pending', detail: null },
    });
    await expectRejected(3, 6, 'verify-gate-required', {
      verify: { command: null, attempts: 0, status: 'pending', detail: null },
    });
    await expectRejected(2, 5, 'implementation-confirmation-required', {
      decisions: { proposalApproved: true },
    });
    await expectRejected(5, 6, 'archive-required', { archivePath: null });
    await expectRejected(5, 6, 'post-archive-decision-required', {
      decisions: { proposalApproved: true, implementationConfirmed: true },
    });
    await expectAllowed(5, 6);
    await expectRejected(1, 5, 'proposal-approval-required', { decisions: {} });
    await expectRejected(2, 6, 'implementation-confirmation-required', {
      decisions: { proposalApproved: true },
    });
  });
});
