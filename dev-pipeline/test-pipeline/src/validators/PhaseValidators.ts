import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'fs-extra';
import type { AssertionResult, ArtifactInfo, TestEnvironment } from '../harness/types.js';
import { expectConventionalCommit, expectFileContains } from '../utils/fileAssertions.js';
import { fileExists, listFilesRecursive } from '../utils/tempDir.js';
import { gitStatus } from '../utils/gitHelpers.js';

const execFileAsync = promisify(execFile);

interface PipelineState {
  currentPhase: number;
  currentStep: number;
  status: string;
  sourceBranch: string;
  targetBranch: string | null;
  archivePath: string | null;
  review: { round: number; reportPath: string | null; status: string };
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

export async function validatePhase0(
  env: TestEnvironment,
  changeName: string,
): ValidationResult {
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

export async function validatePhase1(
  env: TestEnvironment,
  changeName: string,
): ValidationResult {
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
): ValidationResult {
  const state = await readState(env, changeName);
  const status = await gitStatus(env.rootDir);
  const tasks = path.join(env.rootDir, 'openspec', 'changes', changeName, 'tasks.md');
  return {
    assertions: [
      stateAt(state, 3, 9),
      {
        description: 'Implementation produces a Git diff',
        passed: !status.isClean,
        detail: status.stdout,
      },
      await expectFileContains(tasks, /\[x\]/, 'Implementation tasks are completed'),
      await expectFileContains(
        path.join(env.rootDir, 'backend/src/models/todo.ts'),
        'dueDate?: string',
        'Backend contract includes dueDate',
      ),
      await expectFileContains(
        path.join(env.rootDir, 'frontend/src/api/client.ts'),
        'dueDate?: string',
        'Frontend contract includes dueDate',
      ),
    ],
    artifacts: [],
  };
}

export async function validatePhase3(
  env: TestEnvironment,
  changeName: string,
): ValidationResult {
  const state = await readState(env, changeName);
  const reviewPath = state.review.reportPath
    ? path.join(env.rootDir, state.review.reportPath)
    : path.join(env.rootDir, '__missing-review__');
  return {
    assertions: [
      stateAt(state, 4, 13),
      {
        description: 'Review attempt is recorded as passed',
        passed: state.review.round === 1 && state.review.status === 'passed',
      },
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
): ValidationResult {
  const state = await readState(env, changeName);
  return {
    assertions: [
      stateAt(state, 5, 15),
      {
        description: 'Actual test attempt is persisted',
        passed:
          state.tests.status === 'passed' &&
          state.tests.attempts === 1 &&
          state.tests.command === 'npm test',
      },
    ],
    artifacts: [],
  };
}

export async function validateArchive(
  env: TestEnvironment,
  changeName: string,
): ValidationResult {
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
): ValidationResult {
  const state = await readState(env, changeName);
  const status = await gitStatus(env.rootDir);
  const currentBranch = (await git(env, 'branch', '--show-current')).trim();
  const remoteSource = await remoteRef(env, `refs/heads/${env.sourceBranch}`);
  const remoteTarget = await remoteRef(env, `refs/heads/${env.targetBranch}`);
  const commitMessage = state.delivery.commitSha
    ? (await git(env, 'show', '-s', '--format=%s', state.delivery.commitSha)).trim()
    : '';

  return {
    assertions: [
      {
        description: 'Pipeline state is completed in Phase6',
        passed: state.currentPhase === 6 && state.status === 'completed',
      },
      {
        description: 'Source and target pushes are persisted',
        passed: state.delivery.sourcePushed && state.delivery.targetPushed,
      },
      {
        description: 'Commit and merge SHAs are persisted',
        passed: Boolean(state.delivery.commitSha && state.delivery.mergeCommitSha),
      },
      {
        description: 'Delivery finishes on the target branch with a clean work tree',
        passed: currentBranch === env.targetBranch && status.isClean,
        detail: status.stdout,
      },
      {
        description: 'Remote source and target refs exist',
        passed: Boolean(remoteSource && remoteTarget),
      },
      {
        ...(await expectConventionalCommit(commitMessage)),
        description: 'Source commit message follows conventional commit format',
      },
    ],
    artifacts: [artifact(env, statePath(env, changeName))],
  };
}

export const PHASE_VALIDATORS: Record<
  string,
  (
    env: TestEnvironment,
    context: Record<string, string>,
  ) => Promise<{ assertions: AssertionResult[]; artifacts: ArtifactInfo[] }>
> = {
  'phase-0-entrance': (env, ctx) => validatePhase0(env, ctx.changeName),
  'phase-1-propose': (env, ctx) => validatePhase1(env, ctx.changeName),
  'phase-2-apply': (env, ctx) => validatePhase2(env, ctx.changeName),
  'phase-3-review': (env, ctx) => validatePhase3(env, ctx.changeName),
  'phase-4-unit-tests': (env, ctx) => validateUnitTests(env, ctx.changeName),
  'phase-5-archive': (env, ctx) => validateArchive(env, ctx.changeName),
  'phase-6-merge-push': (env, ctx) => validatePhase6(env, ctx.changeName),
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
