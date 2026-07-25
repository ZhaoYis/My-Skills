import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Initialize a git repository in the given directory.
 * Sets local user.name and user.email for commit capability.
 */
export async function gitInit(cwd: string): Promise<GitResult> {
  await execFileAsync('git', ['init', '-b', 'main'], { cwd });
  // Set local git config for test commits
  await execFileAsync('git', ['config', 'user.name', 'Pipeline Test Bot'], { cwd });
  await execFileAsync('git', ['config', 'user.email', 'test@opsx-pipeline.local'], { cwd });
  return { stdout: '', stderr: '', exitCode: 0 };
}

/**
 * Stage tracked files plus individually reviewed untracked files and create a commit.
 * Returns success=false when there is nothing to commit (no error thrown).
 */
export async function gitCommit(
  cwd: string,
  message: string,
): Promise<GitResult & { success: boolean }> {
  await execFileAsync('git', ['add', '-u'], { cwd });
  const untracked = await execFileAsync(
    'git',
    ['ls-files', '--others', '--exclude-standard', '-z'],
    { cwd, encoding: 'buffer' },
  );
  for (const file of untracked.stdout.toString('utf8').split('\0').filter(Boolean)) {
    await execFileAsync('git', ['add', '--', file], { cwd });
  }
  try {
    const result = await execFileAsync('git', ['commit', '-m', message], { cwd });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
      success: true,
    };
  } catch (error) {
    const commandError = error as { stdout?: string; stderr?: string };
    if (
      commandError.stderr?.includes('nothing to commit') ||
      commandError.stdout?.includes('nothing to commit')
    ) {
      return { stdout: '', stderr: 'nothing to commit', exitCode: 0, success: false };
    }
    throw error;
  }
}

/**
 * Get the current git status as porcelain format.
 */
export async function gitStatus(cwd: string): Promise<{ stdout: string; isClean: boolean }> {
  const result = await execFileAsync('git', ['status', '--porcelain'], { cwd });
  return {
    stdout: result.stdout,
    isClean: result.stdout.trim() === '',
  };
}

/**
 * Get the diff of staged changes.
 */
export async function gitDiffStaged(cwd: string): Promise<string> {
  const result = await execFileAsync('git', ['diff', '--staged', '--stat'], { cwd });
  return result.stdout;
}

/**
 * Get the full diff of all changes (staged + unstaged + untracked).
 */
export async function gitDiffAll(cwd: string): Promise<string> {
  const result = await execFileAsync('git', ['diff', 'HEAD', '--stat'], { cwd });
  return result.stdout;
}

/**
 * Get a list of changed files between two refs.
 */
export async function gitChangedFiles(
  cwd: string,
  from: string = 'HEAD~1',
  to: string = 'HEAD',
): Promise<string[]> {
  const result = await execFileAsync('git', ['diff', '--name-only', from, to], { cwd });
  return result.stdout.trim().split('\n').filter(Boolean);
}

/**
 * Get the current branch name.
 */
export async function gitCurrentBranch(cwd: string): Promise<string> {
  const result = await execFileAsync('git', ['branch', '--show-current'], { cwd });
  return result.stdout.trim();
}

/**
 * Check if the given directory is inside a git work tree.
 */
export async function gitIsWorkTree(cwd: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], { cwd });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the last commit hash.
 */
export async function gitLastCommitHash(cwd: string): Promise<string> {
  const result = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd });
  return result.stdout.trim();
}

/**
 * Get the last commit message.
 */
export async function gitLastCommitMessage(cwd: string): Promise<string> {
  const result = await execFileAsync('git', ['log', '-1', '--format=%s'], { cwd });
  return result.stdout.trim();
}

/**
 * Create a bare repository for push simulation.
 */
export async function gitInitBare(cwd: string, name: string): Promise<string> {
  const barePath = path.join(cwd, `${name}.git`);
  await execFileAsync('git', ['init', '--bare', barePath]);
  return barePath;
}
