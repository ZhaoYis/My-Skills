import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import fs from 'fs-extra';
import type { ArtifactInfo, AssertionResult, TestEnvironment } from '../harness/types.js';
import { expectConventionalCommit, expectFileContains } from '../utils/fileAssertions.js';
import { gitStatus } from '../utils/gitHelpers.js';
import { fileExists, listFilesRecursive } from '../utils/tempDir.js';

const execFileAsync = promisify(execFile);

interface PipelineState {
  currentPhase: number;
  currentStep: number;
  status: string;
  sourceBranch: string;
  targetBranch: string | null;
  archivePath: string | null;
  review: {
    rounds: Array<{
      round: number;
      reportPath: string | null;
      status: string;
      timestamp: string;
      decisions: Record<string, unknown>;
    }>;
    currentRound: number;
    reportPath: string | null;
    status: string;
  };
  tests: { attempts: number; status: string; command: string | null };
  verify: { attempts: number; status: string; command: string | null };
  delivery: {
    commitSha: string | null;
    mergeCommitSha: string | null;
    sourcePushed: boolean;
    targetPushed: boolean;
  };
}

type ValidationResult = Promise<{ assertions: AssertionResult[]; artifacts: ArtifactInfo[] }>;

export async function validatePhase0(env: TestEnvironment, changeName: string): ValidationResult {
  const state = await readState(env, changeName);
  return {
    assertions: [
      { description: 'Git work tree is active', passed: env.isWorkTree },
      {
        description: 'Installed preflight uses the configured OpenSpec fixture',
        passed: env.openspecAvailable && env.openspecMode === 'mock',
        detail: env.openspecVersion,
      },
      stateAt(state, 1, 3),
      {
        description: 'Source branch is persisted before Phase1',
        passed: state.sourceBranch === env.sourceBranch,
        detail: state.sourceBranch,
      },
    ],
    artifacts: [artifact(env, statePath(env, changeName))],
  };
}

export async function validatePhase1(env: TestEnvironment, changeName: string): ValidationResult {
  const state = await readState(env, changeName);
  const changeDir = path.join(env.rootDir, 'openspec', 'changes', changeName);
  const expected = ['proposal.md', 'design.md', 'tasks.md', 'specs/todo.md'];
  const assertions: AssertionResult[] = [stateAt(state, 2, 6)];
  for (const relative of expected) {
    assertions.push({
      description: `${relative} exists`,
      passed: await fileExists(path.join(changeDir, relative)),
    });
  }
  assertions.push(
    await expectFileContains(
      path.join(changeDir, 'tasks.md'),
      /\[ \]/,
      'Proposal contains pending implementation tasks',
    ),
  );

  return {
    assertions,
    artifacts: (await listFilesRecursive(changeDir)).map((file) => artifact(env, file)),
  };
}

export async function validatePhase2(
  env: TestEnvironment,
  changeName: string,
  reviewDisposition?: string,
): ValidationResult {
  const state = await readState(env, changeName);
  const status = await gitStatus(env.rootDir);
  const tasks = path.join(env.rootDir, 'openspec', 'changes', changeName, 'tasks.md');
  const skipped = reviewDisposition === 'skip-review';
  return {
    assertions: [
      skipped ? stateAt(state, 4, 13) : stateAt(state, 3, 9),
      {
        description: 'Implementation produces a Git diff',
        passed: !status.isClean,
        detail: status.stdout,
      },
      await expectFileContains(tasks, /\[x\]/, 'Implementation tasks are completed'),
      ...(await sampleSpecificAssertions(env.rootDir)),
    ],
    artifacts: [],
  };
}

async function sampleSpecificAssertions(rootDir: string): Promise<AssertionResult[]> {
  const checks = [
    path.join(rootDir, 'backend/src/models/todo.ts'),
    path.join(rootDir, 'frontend/src/api/client.ts'),
    path.join(rootDir, 'src/models/item.ts'),
    path.join(rootDir, 'src/index.ts'),
    path.join(rootDir, 'CHANGES.md'),
  ];
  let anyModified = false;
  let anyFound = false;
  for (const file of checks) {
    if (await fileExists(file)) {
      anyFound = true;
      const passed = (
        await expectFileContains(
          file,
          /dueDate|pipeline-change/,
          `Source file ${path.relative(rootDir, file)} includes the expected change`,
        )
      ).passed;
      if (passed) anyModified = true;
    }
  }

  if (!anyFound) {
    return [
      {
        description: 'At least one source file was modified',
        passed: false,
        detail: 'No known source files found to verify implementation changes',
      },
    ];
  }

  return [
    {
      description: 'At least one source file was modified by implementation',
      passed: anyModified,
      detail: anyModified
        ? undefined
        : 'Known source files exist but none contain the expected change pattern',
    },
  ];
}

export async function validatePhase3(
  env: TestEnvironment,
  changeName: string,
  reviewDisposition?: string,
): ValidationResult {
  const state = await readState(env, changeName);
  const expectedRounds = reviewDisposition === 'fix-and-rereview' ? 2 : 1;
  const reviewPath = state.review.reportPath
    ? path.join(env.rootDir, state.review.reportPath)
    : path.join(env.rootDir, '__missing-review__');
  return {
    assertions: [
      stateAt(state, 4, 13),
      {
        description: 'Review attempt is recorded as passed',
        passed:
          state.review.rounds.length === expectedRounds &&
          state.review.currentRound === expectedRounds &&
          state.review.status === 'passed' &&
          state.review.rounds.at(-1)?.status === 'passed',
      },
      ...(reviewDisposition === 'fix-and-rereview'
        ? [
            {
              description: 'Review fix proposal is generated, approved and applied before rereview',
              passed:
                state.review.rounds[0]?.status === 'issues-found' &&
                state.review.rounds[1]?.decisions.fixProposalGenerated === true &&
                state.review.rounds[1]?.decisions.fixProposalApproved === true &&
                state.review.rounds[1]?.decisions.fixApplied === true,
            },
          ]
        : []),
      await expectFileContains(reviewPath, /security|secret/i, 'Review covers security'),
      await expectFileContains(reviewPath, /correctness/i, 'Review covers correctness'),
      await expectFileContains(reviewPath, /conventions/i, 'Review covers conventions'),
    ],
    artifacts: (await fileExists(reviewPath)) ? [artifact(env, reviewPath)] : [],
  };
}

export async function validateUnitTests(
  env: TestEnvironment,
  changeName: string,
  testsStatus?: string,
): ValidationResult {
  const state = await readState(env, changeName);
  const expectedStatus = testsStatus ?? 'passed';
  const expectedAttempts = expectedStatus === 'passed' ? 1 : 0;
  return {
    assertions: [
      stateAt(state, 5, 15),
      {
        description: `Test status is persisted as ${expectedStatus}`,
        passed:
          state.tests.status === expectedStatus &&
          state.tests.attempts === expectedAttempts &&
          state.tests.command === 'npm test',
      },
    ],
    artifacts: [],
  };
}

export async function validateArchive(env: TestEnvironment, changeName: string): ValidationResult {
  const state = await readState(env, changeName);
  const archivedPath = state.archivePath ? path.join(env.rootDir, state.archivePath) : '';
  const activePath = path.join(env.rootDir, 'openspec', 'changes', changeName);
  return {
    assertions: [
      stateAt(state, 6, 20),
      {
        description: 'Verify attempt passed before archive',
        passed:
          state.verify.status === 'passed' &&
          state.verify.attempts === 1 &&
          state.verify.command === 'npm run verify',
      },
      {
        description: 'Actual archive path is persisted and exists',
        passed: Boolean(archivedPath) && (await directoryExists(archivedPath)),
        detail: state.archivePath ?? undefined,
      },
      {
        description: 'Active change is removed after archive',
        passed: !(await directoryExists(activePath)),
      },
    ],
    artifacts:
      archivedPath && (await directoryExists(archivedPath))
        ? (await listFilesRecursive(archivedPath)).map((file) => artifact(env, file))
        : [],
  };
}

export async function validatePhase6(
  env: TestEnvironment,
  changeName: string,
  postArchiveAction?: string,
): ValidationResult {
  const state = await readState(env, changeName);
  const commitMessage = state.delivery.commitSha
    ? (await git(env, 'show', '-s', '--format=%s', state.delivery.commitSha)).trim()
    : '';
  const action = postArchiveAction ?? 'merge';
  const isLocalOnly = action === 'local-only';
  const isPushOnly = action === 'push-only';

  const assertions: AssertionResult[] = [
    {
      description: 'Commit SHA is persisted',
      passed: Boolean(state.delivery.commitSha),
    },
    {
      ...(await expectConventionalCommit(commitMessage)),
      description: 'Source commit message follows conventional commit format',
    },
    {
      description: 'Source push is persisted for non-local-only',
      passed: isLocalOnly ? !state.delivery.sourcePushed : state.delivery.sourcePushed,
    },
  ];

  if (isLocalOnly || isPushOnly) {
    const stateCommitMessage = (
      await git(env, 'log', '-1', '--format=%s', '--', `openspec/.pipeline-state/${changeName}.json`)
    ).trim();
    assertions.push({
      description: 'Pipeline state is completed in Phase6',
      passed: state.currentPhase === 6 && state.status === 'completed',
    });
    assertions.push({
      description: 'Final pipeline state commit exists in git log',
      passed: stateCommitMessage.includes('finalize pipeline delivery state'),
      detail: stateCommitMessage,
    });
  } else {
    assertions.push({
      description: 'Phase 6 transitions to Phase 7 for merge mode',
      passed: state.currentPhase === 7 && state.status === 'active',
    });
  }

  if (isLocalOnly) {
    assertions.push({
      description: 'No remote operations for local-only delivery',
      passed: !state.delivery.sourcePushed && !state.delivery.targetPushed,
    });
  }

  return {
    assertions,
    artifacts: [artifact(env, statePath(env, changeName))],
  };
}

export async function validatePhase7(
  env: TestEnvironment,
  changeName: string,
  _postArchiveAction?: string,
): ValidationResult {
  const state = await readState(env, changeName);
  const currentBranch = (await git(env, 'branch', '--show-current')).trim();
  const remoteSource = await remoteRef(env, `refs/heads/${env.sourceBranch}`);
  const remoteTarget = await remoteRef(env, `refs/heads/${env.targetBranch}`);
  const stateCommitMessage = (
    await git(env, 'log', '-1', '--format=%s', '--', `openspec/.pipeline-state/${changeName}.json`)
  ).trim();

  const assertions: AssertionResult[] = [
    {
      description: 'Pipeline state is completed in Phase7',
      passed: state.currentPhase === 7 && state.status === 'completed',
    },
    {
      description: 'Source and target pushes are persisted',
      passed: state.delivery.sourcePushed && state.delivery.targetPushed,
    },
    {
      description: 'Merge SHA is persisted',
      passed: Boolean(state.delivery.mergeCommitSha),
    },
    {
      description: 'Delivery finishes on the target branch',
      passed: currentBranch === env.targetBranch,
    },
    {
      description: 'Remote source and target refs exist',
      passed: Boolean(remoteSource && remoteTarget),
    },
    {
      description: 'Final pipeline state commit exists in git log',
      passed: stateCommitMessage.includes('finalize pipeline delivery state'),
      detail: stateCommitMessage,
    },
  ];

  return {
    assertions,
    artifacts: [artifact(env, statePath(env, changeName))],
  };
}

export const PHASE_VALIDATORS: Record<
  string,
  (
    env: TestEnvironment,
    context: {
      changeName: string;
      postArchiveAction?: string;
      testsStatus?: string;
      reviewDisposition?: string;
    },
  ) => Promise<{ assertions: AssertionResult[]; artifacts: ArtifactInfo[] }>
> = {
  'phase-0-entrance': (env, ctx) => validatePhase0(env, ctx.changeName),
  'phase-1-propose': (env, ctx) => validatePhase1(env, ctx.changeName),
  'phase-2-apply': (env, ctx) => validatePhase2(env, ctx.changeName, ctx.reviewDisposition),
  'phase-3-review': (env, ctx) => validatePhase3(env, ctx.changeName, ctx.reviewDisposition),
  'phase-4-unit-tests': (env, ctx) => validateUnitTests(env, ctx.changeName, ctx.testsStatus),
  'phase-5-archive': (env, ctx) => validateArchive(env, ctx.changeName),
  'phase-6-commit-push': (env, ctx) => validatePhase6(env, ctx.changeName, ctx.postArchiveAction),
  'phase-7-merge-deliver': (env, ctx) => validatePhase7(env, ctx.changeName, ctx.postArchiveAction),
};

async function readState(env: TestEnvironment, changeName: string): Promise<PipelineState> {
  return fs.readJson(statePath(env, changeName)) as Promise<PipelineState>;
}

function statePath(env: TestEnvironment, changeName: string): string {
  return path.join(env.rootDir, 'openspec', '.pipeline-state', `${changeName}.json`);
}

function stateAt(state: PipelineState, phase: number, step: number): AssertionResult {
  return {
    description: `State advanced to Phase${phase} Step${step}`,
    passed: state.currentPhase === phase && state.currentStep === step && state.status === 'active',
    detail: `Phase${state.currentPhase} Step${state.currentStep} (${state.status})`,
  };
}

function artifact(env: TestEnvironment, file: string): ArtifactInfo {
  return { path: path.relative(env.rootDir, file), type: 'file', exists: true };
}

async function directoryExists(directory: string): Promise<boolean> {
  try {
    return (await fs.stat(directory)).isDirectory();
  } catch {
    return false;
  }
}

async function git(env: TestEnvironment, ...args: string[]): Promise<string> {
  return (await execFileAsync('git', args, { cwd: env.rootDir })).stdout;
}

async function remoteRef(env: TestEnvironment, ref: string): Promise<string> {
  try {
    return (await execFileAsync('git', ['ls-remote', env.remotePath, ref])).stdout.trim();
  } catch {
    return '';
  }
}
