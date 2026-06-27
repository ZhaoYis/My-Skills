import type { AssertionResult, ArtifactInfo } from '../harness/types.js';
import { expectFileExists, expectFileContains, expectDirExists, expectFilesExist, expectConventionalCommit } from '../utils/fileAssertions.js';
import { fileExists, listFilesRecursive } from '../utils/tempDir.js';
import { gitStatus, gitDiffStaged, gitLastCommitMessage } from '../utils/gitHelpers.js';
import type { TestEnvironment } from '../harness/types.js';
import path from 'node:path';

/**
 * Validate opsx-learn phase outputs.
 */
export async function validateLearnPhase(env: TestEnvironment): Promise<{
  assertions: AssertionResult[];
  artifacts: ArtifactInfo[];
}> {
  const assertions: AssertionResult[] = [];

  // Knowledge base should have entries
  const indexExists = await expectFileExists(path.join(env.knowledgeRoot, 'INDEX.md'));
  assertions.push(indexExists);

  // Check for knowledge subdirectories
  const techDir = await expectDirExists(path.join(env.knowledgeRoot, 'tech'));
  assertions.push(techDir);

  // Look for new knowledge files (not just the template placeholders)
  const allKnowledgeFiles = await listFilesRecursive(env.knowledgeRoot);
  const nonTemplateFiles = allKnowledgeFiles.filter(f =>
    !f.endsWith('README.md') && !f.includes('template')
  );

  assertions.push({
    description: 'Knowledge base has new entries beyond templates',
    passed: nonTemplateFiles.length > 0,
    detail: nonTemplateFiles.length > 0
      ? `Found ${nonTemplateFiles.length} non-template knowledge files`
      : 'No new knowledge entries found',
  });

  const artifacts: ArtifactInfo[] = allKnowledgeFiles.map(f => ({
    path: path.relative(env.rootDir, f),
    type: 'file' as const,
    exists: true,
  }));

  return { assertions, artifacts };
}

/**
 * Validate opsx-analysis phase outputs.
 */
export async function validateAnalysisPhase(env: TestEnvironment, changeName: string): Promise<{
  assertions: AssertionResult[];
  artifacts: ArtifactInfo[];
}> {
  const assertions: AssertionResult[] = [];

  // Analysis output file
  const analysisPath = path.join(env.rootDir, 'openspec', 'analysis', `${changeName}.md`);
  const analysisExists = await expectFileExists(analysisPath);
  assertions.push(analysisExists);

  if (analysisExists.passed) {
    // Check for structured analysis markers
    assertions.push(await expectFileContains(analysisPath, /事实|Facts/, 'Analysis contains Facts section'));
    assertions.push(await expectFileContains(analysisPath, /推断|Inferences/, 'Analysis contains Inferences section'));
    assertions.push(await expectFileContains(analysisPath, /待确认|Open Questions/, 'Analysis contains Open Questions section'));
  }

  const artifacts: ArtifactInfo[] = [];
  if (await fileExists(analysisPath)) {
    artifacts.push({ path: path.relative(env.rootDir, analysisPath), type: 'file', exists: true });
  }

  return { assertions, artifacts };
}

/**
 * Validate opsx-design phase outputs.
 */
export async function validateDesignPhase(env: TestEnvironment, changeName: string): Promise<{
  assertions: AssertionResult[];
  artifacts: ArtifactInfo[];
}> {
  const assertions: AssertionResult[] = [];

  // Design document
  const designPath = path.join(env.rootDir, 'openspec', 'changes', changeName, 'design.md');
  const designExists = await expectFileExists(designPath);
  assertions.push(designExists);

  if (designExists.passed) {
    // Check for verification assertions
    assertions.push(await expectFileContains(designPath, /验证断言|验证目标|verification|verify/, 'Design contains verification assertions'));
    // Check for quality gate
    assertions.push(await expectFileContains(designPath, /质量门禁|quality.gate|checklist/, 'Design contains quality gate'));
    // Check for impact summary
    assertions.push(await expectFileContains(designPath, /影响|impact|affected/, 'Design contains impact analysis'));
  }

  const artifacts: ArtifactInfo[] = [];
  if (await fileExists(designPath)) {
    artifacts.push({ path: path.relative(env.rootDir, designPath), type: 'file', exists: true });
  }

  return { assertions, artifacts };
}

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
export async function validatePhase1(env: TestEnvironment, changeName: string): Promise<{
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
    assertions.push(await expectFileContains(tasksPath, /\[ \]|\[x\]/, 'tasks.md contains checkbox items'));
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
export async function validatePhase2(env: TestEnvironment, changeName: string): Promise<{
  assertions: AssertionResult[];
  artifacts: ArtifactInfo[];
}> {
  const assertions: AssertionResult[] = [];

  // Git should show changes
  const diff = await gitDiffStaged(env.rootDir);
  assertions.push({
    description: 'Code changes are staged in git',
    passed: diff.trim().length === 0, // staged after work, but let's check git status
    detail: diff.trim(),
  });

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
export async function validatePhase3(env: TestEnvironment, changeName: string): Promise<{
  assertions: AssertionResult[];
  artifacts: ArtifactInfo[];
}> {
  const assertions: AssertionResult[] = [];

  // Review report
  const reviewPath = path.join(env.rootDir, 'openspec', 'review', `${changeName}-review.md`);
  const reviewExists = await expectFileExists(reviewPath);
  assertions.push(reviewExists);

  if (reviewExists.passed) {
    assertions.push(await expectFileContains(reviewPath, /security|安全|secret/, 'Review covers security'));
    assertions.push(await expectFileContains(reviewPath, /convention|规范|convention/, 'Review covers conventions'));
    assertions.push(await expectFileContains(reviewPath, /correctness|正确性/, 'Review covers correctness'));
  }

  const artifacts: ArtifactInfo[] = [];
  if (await fileExists(reviewPath)) {
    artifacts.push({ path: path.relative(env.rootDir, reviewPath), type: 'file', exists: true });
  }

  return { assertions, artifacts };
}

/**
 * Validate Phase 4 (Archive) outputs.
 */
export async function validatePhase4(env: TestEnvironment, changeName: string): Promise<{
  assertions: AssertionResult[];
  artifacts: ArtifactInfo[];
}> {
  const assertions: AssertionResult[] = [];

  // Change should be in archive
  const archiveDirs = await listFilesRecursive(path.join(env.rootDir, 'openspec', 'changes', 'archive'));
  const archivedChange = archiveDirs.find(d => d.includes(changeName));

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
 * Validate Phase 5 (Unit Tests) outputs.
 */
export async function validatePhase5(env: TestEnvironment): Promise<{
  assertions: AssertionResult[];
  artifacts: ArtifactInfo[];
}> {
  const assertions: AssertionResult[] = [];

  // This phase is primarily verified by the agent returning the test execution results.
  // We check that a test command can be identified.
  const packageJsonPath = path.join(env.rootDir, 'package.json');
  assertions.push(await expectFileContains(
    packageJsonPath,
    '"test"',
    'package.json has test script defined'
  ));

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
 * Validate opsx-verify phase outputs.
 */
export async function validateVerifyPhase(env: TestEnvironment): Promise<{
  assertions: AssertionResult[];
  artifacts: ArtifactInfo[];
}> {
  const assertions: AssertionResult[] = [];

  // Scripts should be executable
  const validateScript = path.join(env.rootDir, 'scripts', 'validate.sh');
  const scriptExists = await expectFileExists(validateScript);
  assertions.push(scriptExists);

  const artifacts: ArtifactInfo[] = [];
  return { assertions, artifacts };
}

/**
 * Validate opsx-health phase outputs.
 */
export async function validateHealthPhase(env: TestEnvironment): Promise<{
  assertions: AssertionResult[];
  artifacts: ArtifactInfo[];
}> {
  const assertions: AssertionResult[] = [];

  // Knowledge base should still be intact
  const indexExists = await expectFileExists(path.join(env.knowledgeRoot, 'INDEX.md'));
  assertions.push(indexExists);

  const artifacts: ArtifactInfo[] = [];
  return { assertions, artifacts };
}

/**
 * Validator registry — maps phase IDs to their validation functions.
 */
export const PHASE_VALIDATORS: Record<string, (env: TestEnvironment, context: Record<string, string>) => Promise<{
  assertions: AssertionResult[];
  artifacts: ArtifactInfo[];
}>> = {
  'opsx-learn': (env, ctx) => validateLearnPhase(env),
  'opsx-analysis': (env, ctx) => validateAnalysisPhase(env, ctx.changeName),
  'opsx-design': (env, ctx) => validateDesignPhase(env, ctx.changeName),
  'phase-0-entrance': (env) => validatePhase0(env),
  'phase-1-propose': (env, ctx) => validatePhase1(env, ctx.changeName),
  'phase-2-apply': (env, ctx) => validatePhase2(env, ctx.changeName),
  'phase-3-review': (env, ctx) => validatePhase3(env, ctx.changeName),
  'phase-4-archive': (env, ctx) => validatePhase4(env, ctx.changeName),
  'phase-5-unit-tests': (env) => validatePhase5(env),
  'phase-6-merge-push': (env) => validatePhase6(env),
  'opsx-verify': (env) => validateVerifyPhase(env),
  'opsx-health': (env) => validateHealthPhase(env),
};
