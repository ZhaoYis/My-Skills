import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import fs from 'fs-extra';
import { PHASE_VALIDATORS } from '../validators/PhaseValidators.js';
import type { AgentExecutor } from './PipelineAgentOrchestrator.js';
import type { PhaseId, ScenarioConfig, TestEnvironment } from './types.js';

const execFileAsync = promisify(execFile);

export const deterministicPipelineExecutor: AgentExecutor = async (
  phaseId,
  _prompt,
  env,
  scenario,
) => {
  const phaseData = await executePhase(phaseId, env, scenario);
  const validation = await PHASE_VALIDATORS[phaseId](env, {
    changeName: scenario.changeName,
    postArchiveAction: scenario.postArchiveAction,
    testsStatus: scenario.testsStatus,
    reviewDisposition: scenario.reviewDisposition,
  });
  const passed = validation.assertions.every((assertion) => assertion.passed);

  return {
    status: passed ? 'pass' : 'fail',
    summary: `Executed ${phaseId} against installed scripts and an isolated Git remote`,
    assertions: validation.assertions,
    artifacts: validation.artifacts,
    errors: passed ? undefined : ['One or more phase postconditions failed.'],
    phaseData,
  };
};

async function executePhase(
  phaseId: PhaseId,
  env: TestEnvironment,
  scenario: ScenarioConfig,
): Promise<Record<string, unknown>> {
  switch (phaseId) {
    case 'phase-0-entrance':
      return executePhase0(env, scenario);
    case 'phase-1-propose':
      return executePhase1(env, scenario);
    case 'phase-2-apply':
      return executePhase2(env, scenario);
    case 'phase-3-review':
      return executePhase3(env, scenario);
    case 'phase-4-unit-tests':
      return executePhase4(env, scenario);
    case 'phase-5-archive':
      return executePhase5(env, scenario);
    case 'phase-6-merge-push':
      return executePhase6(env, scenario);
  }
}

async function executePhase0(
  env: TestEnvironment,
  scenario: ScenarioConfig,
): Promise<Record<string, unknown>> {
  const preflight = await runSkillScript(env, 'preflight.mjs');
  await runState(env, 'init', scenario.changeName, env.sourceBranch, '--skip-feature-association');
  await runState(env, 'transition', scenario.changeName, '1', '3');
  return { preflight };
}

async function executePhase1(
  env: TestEnvironment,
  scenario: ScenarioConfig,
): Promise<Record<string, unknown>> {
  await runState(env, 'decision', scenario.changeName, 'requirementsConfirmed', 'true');
  await runSkillScript(env, 'new-change.mjs', scenario.changeName);
  const changeDir = path.join(env.rootDir, 'openspec', 'changes', scenario.changeName);
  await fs.ensureDir(path.join(changeDir, 'specs'));
  await fs.writeFile(
    path.join(changeDir, 'proposal.md'),
    '# Add todo due date\n\nAdd an optional dueDate field to backend and frontend contracts.\n',
  );
  await fs.writeFile(
    path.join(changeDir, 'design.md'),
    '# Design\n\nKeep dueDate as an optional ISO-8601 string.\n',
  );
  await fs.writeFile(
    path.join(changeDir, 'tasks.md'),
    '- [ ] Add dueDate to backend contract\n- [ ] Add dueDate to frontend contract\n',
  );
  await fs.writeFile(
    path.join(changeDir, 'specs', 'todo.md'),
    '# Todo contract delta\n\nTodo MAY expose an optional dueDate string.\n',
  );
  const validation = await runSkillScript(env, 'validate-change.mjs', scenario.changeName);
  await runState(env, 'decision', scenario.changeName, 'proposalApproved', 'true');
  await runState(env, 'transition', scenario.changeName, '2', '6');
  return { validation };
}

async function executePhase2(
  env: TestEnvironment,
  scenario: ScenarioConfig,
): Promise<Record<string, unknown>> {
  const instructions = await runSkillScript(env, 'instructions-apply.mjs', scenario.changeName);
  // Modify known source files; add dueDate to at least one to create a diff
  const modified = [
    await addDueDate(path.join(env.rootDir, 'backend/src/models/todo.ts')),
    await addDueDate(path.join(env.rootDir, 'frontend/src/api/client.ts')),
  ];
  // If no known files were modified, try any TypeScript source file
  if (!modified.some(Boolean)) {
    await modifyAnySourceFile(env.rootDir);
  }
  const tasksPath = path.join(env.rootDir, 'openspec', 'changes', scenario.changeName, 'tasks.md');
  const tasks = await fs.readFile(tasksPath, 'utf8');
  await fs.writeFile(tasksPath, tasks.replaceAll('- [ ]', '- [x]'));
  await runSkillScript(env, 'validate-change.mjs', scenario.changeName);
  await runState(env, 'decision', scenario.changeName, 'implementationConfirmed', 'true');

  const reviewDisposition = scenario.reviewDisposition ?? 'review';
  await runState(
    env,
    'decision',
    scenario.changeName,
    'reviewDisposition',
    JSON.stringify(reviewDisposition),
  );

  if (reviewDisposition === 'skip-review') {
    await runState(env, 'transition', scenario.changeName, '4', '13');
  } else {
    await runState(env, 'transition', scenario.changeName, '3', '9');
  }
  return { instructions, reviewDisposition };
}

async function executePhase3(
  env: TestEnvironment,
  scenario: ScenarioConfig,
): Promise<Record<string, unknown>> {
  const reviewRelative = `openspec/review/2099-01-01-00-00-${scenario.changeName}-pipeline-review.md`;

  if (scenario.reviewDisposition === 'fix-and-rereview') {
    await fs.outputFile(
      path.join(env.rootDir, reviewRelative),
      '# Review\n\n- Correctness: missing null check\n- Security and secret scan: passed\n- Conventions: passed\n',
    );
    await runState(
      env,
      'set',
      scenario.changeName,
      'review.reportPath',
      JSON.stringify(reviewRelative),
    );
    await runState(env, 'attempt', scenario.changeName, 'review', 'issues-found');

    const fixProposalRelative = `openspec/changes/${scenario.changeName}/fix-proposal-round-1.md`;
    await fs.outputFile(
      path.join(env.rootDir, fixProposalRelative),
      '# Fix proposal: validate todo titles\n\n## Problem\n\nThe review found a missing null check for todo titles.\n\n## Proposed changes\n\nValidate the title before creating a todo.\n\n## Impact\n\nInvalid input is rejected before it reaches the in-memory store.\n',
    );
    await runState(
      env,
      'decision',
      scenario.changeName,
      'fixProposalPath',
      JSON.stringify(fixProposalRelative),
    );
    await runState(env, 'decision', scenario.changeName, 'fixProposalGenerated', 'true');
    await runState(env, 'decision', scenario.changeName, 'fixProposalApproved', 'true');
    await addNullCheck(path.join(env.rootDir, 'backend/src/models/todo.ts'));
    await runState(env, 'decision', scenario.changeName, 'fixApplied', 'true');

    const rereviewRelative = `openspec/review/2099-01-01-00-01-${scenario.changeName}-pipeline-review-round-2.md`;
    await fs.outputFile(
      path.join(env.rootDir, rereviewRelative),
      '# Review round 2\n\n- Correctness: passed\n- Security and secret scan: passed\n- Conventions: passed\n- Performance: no regression\n',
    );
    await runState(
      env,
      'set',
      scenario.changeName,
      'review.reportPath',
      JSON.stringify(rereviewRelative),
    );
    await runState(env, 'attempt', scenario.changeName, 'review', 'passed');
    await runState(env, 'transition', scenario.changeName, '4', '13');
    return {
      reviewPath: rereviewRelative,
      initialReviewPath: reviewRelative,
      fixProposalPath: fixProposalRelative,
    };
  }

  await fs.outputFile(
    path.join(env.rootDir, reviewRelative),
    '# Review\n\n- Correctness: passed\n- Security and secret scan: passed\n- Conventions: passed\n- Performance: no regression\n',
  );
  await runState(
    env,
    'set',
    scenario.changeName,
    'review.reportPath',
    JSON.stringify(reviewRelative),
  );
  await runState(env, 'attempt', scenario.changeName, 'review', 'passed');
  await runState(env, 'transition', scenario.changeName, '4', '13');
  return { reviewPath: reviewRelative };
}

async function addNullCheck(file: string): Promise<boolean> {
  try {
    await fs.access(file);
  } catch {
    return false;
  }

  const content = await fs.readFile(file, 'utf8');
  const signature = 'export function createTodo(title: string): Todo {\n';
  if (!content.includes(signature) || content.includes('title?.trim()')) return false;
  await fs.writeFile(
    file,
    content.replace(
      signature,
      `${signature}  if (!title?.trim()) throw new Error('Todo title is required');\n`,
    ),
  );
  return true;
}

async function executePhase4(
  env: TestEnvironment,
  scenario: ScenarioConfig,
): Promise<Record<string, unknown>> {
  const testsStatus = scenario.testsStatus ?? 'passed';

  if (testsStatus === 'passed') {
    const test = await runNpm(env, 'test');
    await runState(env, 'set', scenario.changeName, 'tests.command', '"npm test"');
    await runState(env, 'attempt', scenario.changeName, 'tests', 'passed');
    await runState(env, 'transition', scenario.changeName, '5', '15');
    return { command: 'npm test', stdout: test.stdout, testsStatus };
  }

  // skipped or debt-recorded: set status directly without running tests
  await runState(env, 'set', scenario.changeName, 'tests.command', '"npm test"');
  await runState(env, 'set', scenario.changeName, 'tests.status', JSON.stringify(testsStatus));
  await runState(env, 'set', scenario.changeName, 'tests.attempts', '0');
  await runState(env, 'transition', scenario.changeName, '5', '15');
  return { command: 'npm test', testsStatus };
}

async function executePhase5(
  env: TestEnvironment,
  scenario: ScenarioConfig,
): Promise<Record<string, unknown>> {
  const verify = await runNpm(env, 'run', 'verify');
  await runState(env, 'set', scenario.changeName, 'verify.command', '"npm run verify"');
  await runState(env, 'attempt', scenario.changeName, 'verify', 'passed');
  await runSkillScript(env, 'change-status.mjs', scenario.changeName);
  const archive = await runSkillScript(env, 'archive.mjs', scenario.changeName, '-y');
  const archivePath = String(archive.archivePath);
  await runState(env, 'set', scenario.changeName, 'archivePath', JSON.stringify(archivePath));
  const postArchiveAction = scenario.postArchiveAction ?? 'merge';
  await runState(
    env,
    'decision',
    scenario.changeName,
    'postArchiveAction',
    JSON.stringify(postArchiveAction),
  );
  await runState(env, 'transition', scenario.changeName, '6', '20');
  return { archivePath, verify: verify.stdout, postArchiveAction };
}

async function executePhase6(
  env: TestEnvironment,
  scenario: ScenarioConfig,
): Promise<Record<string, unknown>> {
  const postArchiveAction = scenario.postArchiveAction ?? 'merge';

  await runState(env, 'decision', scenario.changeName, 'commitApproved', 'true');
  await stageFeatureChanges(env);
  await git(env, 'commit', '-m', 'feat(todo): add due date support');
  const commitSha = (await git(env, 'rev-parse', 'HEAD')).trim();
  await runState(env, 'set', scenario.changeName, 'delivery.commitSha', JSON.stringify(commitSha));

  if (postArchiveAction === 'local-only') {
    // Local only: no remote operations at all
    await runState(env, 'set', scenario.changeName, 'delivery.sourcePushed', 'false');
    await runState(env, 'set', scenario.changeName, 'delivery.targetPushed', 'false');
    const stateCommitSha = await finalizePipelineState(env, scenario.changeName, postArchiveAction);
    return { commitSha, stateCommitSha, postArchiveAction };
  }

  // push-only or merge: push source branch
  await runState(env, 'decision', scenario.changeName, 'sourcePushApproved', 'true');
  await git(env, 'push', '-u', 'origin', env.sourceBranch);
  await runState(env, 'set', scenario.changeName, 'delivery.sourcePushed', 'true');

  if (postArchiveAction === 'push-only') {
    // Push-only: skip merge and target push
    await runState(env, 'set', scenario.changeName, 'delivery.targetPushed', 'false');
    const stateCommitSha = await finalizePipelineState(env, scenario.changeName, postArchiveAction);
    return { commitSha, stateCommitSha, postArchiveAction };
  }

  // Full merge flow
  await runState(env, 'set', scenario.changeName, 'targetBranch', JSON.stringify(env.targetBranch));
  await runState(env, 'decision', scenario.changeName, 'mergeApproved', 'true');
  await git(env, 'checkout', env.targetBranch);
  await git(env, 'pull', '--ff-only', 'origin', env.targetBranch);
  await git(
    env,
    'merge',
    '--no-ff',
    '--no-edit',
    env.sourceBranch,
    '-m',
    `merge: deliver ${scenario.changeName}`,
  );

  await runNpm(env, 'test');
  await runNpm(env, 'run', 'verify');
  const mergeCommitSha = (await git(env, 'rev-parse', 'HEAD')).trim();
  await runState(
    env,
    'set',
    scenario.changeName,
    'delivery.mergeCommitSha',
    JSON.stringify(mergeCommitSha),
  );
  await runState(env, 'decision', scenario.changeName, 'targetPushApproved', 'true');
  await git(env, 'push', 'origin', env.targetBranch);
  await runState(env, 'set', scenario.changeName, 'delivery.targetPushed', 'true');
  const stateCommitSha = await finalizePipelineState(env, scenario.changeName, postArchiveAction);

  return { commitSha, mergeCommitSha, stateCommitSha, postArchiveAction };
}

async function stageFeatureChanges(env: TestEnvironment): Promise<void> {
  const statePrefix = 'openspec/.pipeline-state/';
  await git(env, 'add', '-u');
  await git(env, 'add', 'openspec/');
  await git(env, 'reset', '--', statePrefix);

  const untracked = (await git(env, 'ls-files', '--others', '--exclude-standard'))
    .split('\n')
    .filter((file) => file && !file.startsWith(statePrefix));
  for (const file of untracked) {
    await git(env, 'add', '--', file);
  }
}

async function finalizePipelineState(
  env: TestEnvironment,
  changeName: string,
  postArchiveAction: 'local-only' | 'push-only' | 'merge',
): Promise<string> {
  const statePath = `openspec/.pipeline-state/${changeName}.json`;
  await runState(env, 'complete', changeName);
  await git(env, 'add', '-f', '--', statePath);
  await git(env, 'commit', '-m', `chore(${changeName}): finalize pipeline delivery state`);
  const stateCommitSha = (await git(env, 'rev-parse', 'HEAD')).trim();

  if (postArchiveAction === 'push-only') {
    await git(env, 'push', 'origin', env.sourceBranch);
  } else if (postArchiveAction === 'merge') {
    await git(env, 'push', 'origin', env.targetBranch);
  }

  return stateCommitSha;
}

async function modifyAnySourceFile(rootDir: string): Promise<void> {
  // Try to find any source file to modify in common locations
  const candidates = [
    path.join(rootDir, 'src', 'index.ts'),
    path.join(rootDir, 'src', 'main.ts'),
    path.join(rootDir, 'src', 'app.ts'),
  ];
  for (const file of candidates) {
    try {
      await fs.access(file);
      const content = await fs.readFile(file, 'utf8');
      await fs.writeFile(file, `${content}\n// pipeline-change: added dueDate field support\n`);
      return;
    } catch {
      // File doesn't exist, try next
    }
  }
  // Last resort: create a marker file
  await fs.outputFile(
    path.join(rootDir, 'CHANGES.md'),
    '# Pipeline Changes\n\n- Added dueDate field support\n',
  );
}

async function addDueDate(file: string): Promise<boolean> {
  try {
    await fs.access(file);
  } catch {
    return false;
  }
  const content = await fs.readFile(file, 'utf8');
  if (content.includes('dueDate?: string')) {
    return true;
  }

  // Try specific pattern first
  const withDueDate = content.replace(
    '  completed: boolean;\n',
    '  completed: boolean;\n  dueDate?: string;\n',
  );
  if (withDueDate !== content) {
    await fs.writeFile(file, withDueDate);
    return true;
  }

  // Fallback: append a comment to create a diff
  await fs.writeFile(file, `${content}\n// pipeline-change: added dueDate field support\n`);
  return true;
}

async function runSkillScript(
  env: TestEnvironment,
  script: string,
  ...args: string[]
): Promise<Record<string, unknown>> {
  const result = await execFileAsync(
    process.execPath,
    [path.join(env.skillRoot, 'scripts', script), ...args],
    { cwd: env.rootDir, env: commandEnv(env) },
  );
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

async function runState(
  env: TestEnvironment,
  command: string,
  changeName: string,
  ...args: string[]
): Promise<Record<string, unknown>> {
  const result = await execFileAsync(
    process.execPath,
    [path.join(env.skillRoot, 'scripts', 'dev-pipeline-state.mjs'), command, changeName, ...args],
    { cwd: env.rootDir },
  );
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

async function git(env: TestEnvironment, ...args: string[]): Promise<string> {
  const result = await execFileAsync('git', args, { cwd: env.rootDir });
  return result.stdout;
}

function commandEnv(env: TestEnvironment): NodeJS.ProcessEnv {
  const nodeBin = path.dirname(process.execPath);
  const pathValue = env.mockBinDir
    ? [env.mockBinDir, nodeBin, process.env.PATH ?? ''].join(path.delimiter)
    : [nodeBin, process.env.PATH ?? ''].join(path.delimiter);
  return { ...process.env, PATH: pathValue };
}

async function runNpm(env: TestEnvironment, ...args: string[]) {
  const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
  const commandArgs = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd', ...args] : args;
  return execFileAsync(command, commandArgs, { cwd: env.rootDir, env: commandEnv(env) });
}
