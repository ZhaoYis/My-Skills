import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'fs-extra';
import type { AgentExecutor } from './PipelineAgentOrchestrator.js';
import type { PhaseId, ScenarioConfig, TestEnvironment } from './types.js';
import { PHASE_VALIDATORS } from '../validators/PhaseValidators.js';
import { gitCommit } from '../utils/gitHelpers.js';

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
  await runState(env, 'init', scenario.changeName, env.sourceBranch);
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
  const validation = await runSkillScript(
    env,
    'validate-change.mjs',
    scenario.changeName,
  );
  await runState(env, 'decision', scenario.changeName, 'proposalApproved', 'true');
  await runState(env, 'transition', scenario.changeName, '2', '6');
  return { validation };
}

async function executePhase2(
  env: TestEnvironment,
  scenario: ScenarioConfig,
): Promise<Record<string, unknown>> {
  const instructions = await runSkillScript(
    env,
    'instructions-apply.mjs',
    scenario.changeName,
  );
  await addDueDate(path.join(env.rootDir, 'backend/src/models/todo.ts'));
  await addDueDate(path.join(env.rootDir, 'frontend/src/api/client.ts'));
  const tasksPath = path.join(
    env.rootDir,
    'openspec',
    'changes',
    scenario.changeName,
    'tasks.md',
  );
  const tasks = await fs.readFile(tasksPath, 'utf8');
  await fs.writeFile(tasksPath, tasks.replaceAll('- [ ]', '- [x]'));
  await runSkillScript(env, 'validate-change.mjs', scenario.changeName);
  await runState(env, 'decision', scenario.changeName, 'implementationConfirmed', 'true');
  await runState(env, 'decision', scenario.changeName, 'reviewDisposition', '"review"');
  await runState(env, 'transition', scenario.changeName, '3', '9');
  return { instructions };
}

async function executePhase3(
  env: TestEnvironment,
  scenario: ScenarioConfig,
): Promise<Record<string, unknown>> {
  const reviewRelative = `openspec/review/2099-01-01-00-00-${scenario.changeName}-pipeline-review.md`;
  await fs.outputFile(
    path.join(env.rootDir, reviewRelative),
    '# Review\n\n- Correctness: passed\n- Security and secret scan: passed\n- Conventions: passed\n- Performance: no regression\n',
  );
  await runState(env, 'set', scenario.changeName, 'review.reportPath', JSON.stringify(reviewRelative));
  await runState(env, 'attempt', scenario.changeName, 'review', 'passed');
  await runState(env, 'transition', scenario.changeName, '4', '13');
  return { reviewPath: reviewRelative };
}

async function executePhase4(
  env: TestEnvironment,
  scenario: ScenarioConfig,
): Promise<Record<string, unknown>> {
  const test = await runNpm(env, 'test');
  await runState(env, 'set', scenario.changeName, 'tests.command', '"npm test"');
  await runState(env, 'attempt', scenario.changeName, 'tests', 'passed');
  await runState(env, 'transition', scenario.changeName, '5', '15');
  return { command: 'npm test', stdout: test.stdout };
}

async function executePhase5(
  env: TestEnvironment,
  scenario: ScenarioConfig,
): Promise<Record<string, unknown>> {
  const verify = await runNpm(env, 'run', 'verify');
  await runState(env, 'set', scenario.changeName, 'verify.command', '"npm run verify"');
  await runState(env, 'attempt', scenario.changeName, 'verify', 'passed');
  await runSkillScript(env, 'change-status.mjs', scenario.changeName);
  const archive = await runSkillScript(
    env,
    'archive.mjs',
    scenario.changeName,
    '-y',
  );
  const archivePath = String(archive.archivePath);
  await runState(env, 'set', scenario.changeName, 'archivePath', JSON.stringify(archivePath));
  await runState(env, 'decision', scenario.changeName, 'postArchiveAction', '"merge"');
  await runState(env, 'transition', scenario.changeName, '6', '20');
  return { archivePath, verify: verify.stdout };
}

async function executePhase6(
  env: TestEnvironment,
  scenario: ScenarioConfig,
): Promise<Record<string, unknown>> {
  await runState(env, 'decision', scenario.changeName, 'commitApproved', 'true');
  const commit = await gitCommit(env.rootDir, 'feat(todo): add due date support');
  if (!commit.success) throw new Error('Feature commit was not created.');
  const commitSha = (await git(env, 'rev-parse', 'HEAD')).trim();
  await runState(env, 'set', scenario.changeName, 'delivery.commitSha', JSON.stringify(commitSha));

  await runState(env, 'decision', scenario.changeName, 'sourcePushApproved', 'true');
  await git(env, 'push', '-u', 'origin', env.sourceBranch);
  await runState(env, 'set', scenario.changeName, 'delivery.sourcePushed', 'true');

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
  await runState(env, 'complete', scenario.changeName);

  return { commitSha, mergeCommitSha };
}

async function addDueDate(file: string): Promise<void> {
  const content = await fs.readFile(file, 'utf8');
  if (!content.includes('dueDate?: string')) {
    await fs.writeFile(
      file,
      content.replace('  completed: boolean;\n', '  completed: boolean;\n  dueDate?: string;\n'),
    );
  }
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
  return execFileAsync('npm', args, { cwd: env.rootDir, env: commandEnv(env) });
}
