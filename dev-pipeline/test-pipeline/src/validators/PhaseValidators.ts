import type { AssertionResult, ArtifactInfo } from '../harness/types.js';
import {
  expectFileExists,
  expectFileContains,
  expectDirExists,
  expectFilesExist,
  expectConventionalCommit,
} from '../utils/fileAssertions.js';
import { fileExists, listFilesRecursive } from '../utils/tempDir.js';
import { gitStatus, gitLastCommitMessage } from '../utils/gitHelpers.js';
import type { TestEnvironment } from '../harness/types.js';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Validate Phase 0 (Entrance) outputs.
 */
export async function validatePhase0(env: TestEnvironment): Promise<{
  assertions: AssertionResult[];
  artifacts: ArtifactInfo[];
}> {
  const assertions: AssertionResult[] = [];

  // Git work tree should be active
  assertions.push({
    description: 'Git work tree is active',
    passed: env.isWorkTree,
  });

  // OpenSpec should be available
  assertions.push({
    description: 'OpenSpec CLI is available',
    passed: env.openspecAvailable,
    detail: env.openspecAvailable
      ? `Version: ${env.openspecVersion}`
      : 'OpenSpec CLI not found in PATH',
  });

  const artifacts: ArtifactInfo[] = [];
  return { assertions, artifacts };
}

/**
 * Validate Phase 1 (Propose) outputs.
 */
export async function validatePhase1(
  env: TestEnvironment,
  changeName: string,
): Promise<{
  assertions: AssertionResult[];
  artifacts: ArtifactInfo[];
}> {
  const assertions: AssertionResult[] = [];
  const changeDir = path.join(env.rootDir, 'openspec', 'changes', changeName);

  // Change directory exists
  const changeDirExists = await expectDirExists(changeDir);
  assertions.push(changeDirExists);

  // Expected proposal artifacts
  const expectedFiles = ['proposal.md', 'design.md', 'tasks.md', 'specs'];
  const fileAssertions = await expectFilesExist(changeDir, expectedFiles);
  assertions.push(...fileAssertions);

  // tasks.md should have checkbox items
  const tasksPath = path.join(changeDir, 'tasks.md');
  if (await fileExists(tasksPath)) {
    assertions.push(
      await expectFileContains(tasksPath, /\[ \]|\[x\]/, 'tasks.md contains checkbox items'),
    );
  }

  const artifacts: ArtifactInfo[] = [];
  if (await fileExists(changeDir)) {
    const files = await listFilesRecursive(changeDir);
    for (const f of files) {
      artifacts.push({ path: path.relative(env.rootDir, f), type: 'file', exists: true });
    }
  }

  return { assertions, artifacts };
}

/**
 * Validate Phase 2 (Apply) outputs.
 */
export async function validatePhase2(
  env: TestEnvironment,
  changeName: string,
): Promise<{
  assertions: AssertionResult[];
  artifacts: ArtifactInfo[];
}> {
  const assertions: AssertionResult[] = [];

  // There should be changed files
  const status = await gitStatus(env.rootDir);
  assertions.push({
    description: 'Git working tree has changes',
    passed: !status.isClean,
    detail: status.stdout || 'No changes detected',
  });

  // tasks.md should have completed items
  const tasksPath = path.join(env.rootDir, 'openspec', 'changes', changeName, 'tasks.md');
  if (await fileExists(tasksPath)) {
    assertions.push(await expectFileContains(tasksPath, /\[x\]/, 'tasks.md has completed items'));
  }

  const artifacts: ArtifactInfo[] = [];
  return { assertions, artifacts };
}

/**
 * Validate Phase 3 (Review) outputs.
 */
export async function validatePhase3(
  env: TestEnvironment,
  changeName: string,
): Promise<{
  assertions: AssertionResult[];
  artifacts: ArtifactInfo[];
}> {
  const assertions: AssertionResult[] = [];

  // Review report — supports both timestamp-based (SKILL.md convention) and
  // change-name-based (legacy) naming patterns.
  const reviewDir = path.join(env.rootDir, 'openspec', 'review');
  let reviewPath: string | null = null;

  try {
    const entries = await fs.readdir(reviewDir);
    // Prefer timestamp-based pattern: YYYY-MM-DD-HH-mm-<branch-safe>-pipeline-review.md
    const timestamped = entries.find(
      (f) => f.endsWith('-pipeline-review.md') || f.endsWith('-pipeline-review-round-1.md'),
    );
    // Fall back to change-name-based pattern
    const byChange = entries.find(
      (f) => f === `${changeName}-review.md`,
    );
    const matched = timestamped ?? byChange;
    if (matched) {
      reviewPath = path.join(reviewDir, matched);
    }
  } catch {
    // Directory doesn't exist yet
  }

  const reviewExists: AssertionResult = reviewPath
    ? { description: 'Review report exists', passed: true, detail: reviewPath }
    : { description: 'Review report exists', passed: false, detail: 'No review report found' };
  assertions.push(reviewExists);

  if (reviewExists.passed && reviewPath) {
    assertions.push(
      await expectFileContains(reviewPath, /security|安全|secret/, 'Review covers security'),
    );
    assertions.push(
      await expectFileContains(
        reviewPath,
        /convention|规范|convention/,
        'Review covers conventions',
      ),
    );
    assertions.push(
      await expectFileContains(reviewPath, /correctness|正确性/, 'Review covers correctness'),
    );
  }

  const artifacts: ArtifactInfo[] = [];
  if (reviewPath && (await fileExists(reviewPath))) {
    artifacts.push({ path: path.relative(env.rootDir, reviewPath), type: 'file', exists: true });
  }

  return { assertions, artifacts };
}

/**
 * Validate Phase 5 (Archive) outputs.
 */
export async function validateArchive(
  env: TestEnvironment,
  changeName: string,
): Promise<{
  assertions: AssertionResult[];
  artifacts: ArtifactInfo[];
}> {
  const assertions: AssertionResult[] = [];

  // Pre-archive check: all tasks should be completed before archive
  const tasksPath = path.join(env.rootDir, 'openspec', 'changes', changeName, 'tasks.md');
  if (await fileExists(tasksPath)) {
    const tasksContent = await fs.readFile(tasksPath, 'utf-8');
    const hasPendingTasks = /\[ \]/.test(tasksContent);
    assertions.push({
      description: 'All tasks are completed before archive',
      passed: !hasPendingTasks,
      detail: hasPendingTasks
        ? 'Archive blocked: there are incomplete tasks in tasks.md'
        : 'All tasks completed, archive can proceed',
    });
  }

  // Change should be in archive
  const archiveDirs = await listFilesRecursive(
    path.join(env.rootDir, 'openspec', 'changes', 'archive'),
  );
  const archivedChange = archiveDirs.find((d) => d.includes(changeName));

  assertions.push({
    description: 'Change is archived',
    passed: !!archivedChange,
    detail: archivedChange
      ? `Archived to: ${path.relative(env.rootDir, archivedChange)}`
      : 'Archive directory not found',
  });

  // Active change should no longer exist
  const activeChangeDir = path.join(env.rootDir, 'openspec', 'changes', changeName);
  assertions.push({
    description: 'Active change directory is removed',
    passed: !(await fileExists(activeChangeDir)),
  });

  const artifacts: ArtifactInfo[] = [];
  if (archivedChange) {
    const files = await listFilesRecursive(archivedChange);
    for (const f of files) {
      artifacts.push({ path: path.relative(env.rootDir, f), type: 'file', exists: true });
    }
  }

  return { assertions, artifacts };
}

/**
 * Validate Phase 4 (Unit Tests) outputs.
 */
export async function validateUnitTests(env: TestEnvironment): Promise<{
  assertions: AssertionResult[];
  artifacts: ArtifactInfo[];
}> {
  const assertions: AssertionResult[] = [];

  // This phase is primarily verified by the agent returning the test execution results.
  // We check that a test command can be identified.
  const packageJsonPath = path.join(env.rootDir, 'package.json');
  assertions.push(
    await expectFileContains(packageJsonPath, '"test"', 'package.json has test script defined'),
  );

  const artifacts: ArtifactInfo[] = [];
  return { assertions, artifacts };
}

/**
 * Validate Phase 6 (Merge & Push) outputs.
 */
export async function validatePhase6(env: TestEnvironment): Promise<{
  assertions: AssertionResult[];
  artifacts: ArtifactInfo[];
}> {
  const assertions: AssertionResult[] = [];

  // Git status should be clean after commit
  const status = await gitStatus(env.rootDir);
  assertions.push({
    description: 'Git status is clean after commit',
    passed: status.isClean,
    detail: status.isClean ? undefined : `Uncommitted files: ${status.stdout}`,
  });

  // Commit message should follow conventional commit format
  const commitMsg = await gitLastCommitMessage(env.rootDir);
  assertions.push(await expectConventionalCommit(commitMsg));

  const artifacts: ArtifactInfo[] = [];
  return { assertions, artifacts };
}

/**
 * Validator registry — maps phase IDs to their validation functions.
 */
export const PHASE_VALIDATORS: Record<
  string,
  (
    env: TestEnvironment,
    context: Record<string, string>,
  ) => Promise<{
    assertions: AssertionResult[];
    artifacts: ArtifactInfo[];
  }>
> = {
  'phase-0-entrance': (env) => validatePhase0(env),
  'phase-1-propose': (env, ctx) => validatePhase1(env, ctx.changeName),
  'phase-2-apply': (env, ctx) => validatePhase2(env, ctx.changeName),
  'phase-3-review': (env, ctx) => validatePhase3(env, ctx.changeName),
  'phase-4-unit-tests': (env) => validateUnitTests(env),
  'phase-5-archive': (env, ctx) => validateArchive(env, ctx.changeName),
  'phase-6-merge-push': (env) => validatePhase6(env),
};
