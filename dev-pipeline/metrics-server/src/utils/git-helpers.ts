import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { simpleGit, type SimpleGit } from 'simple-git';

export interface CommitEntry {
  sha: string;
  timestamp: Date;
}

export function repoWorkingDirectory(base: string, repoId: number): string {
  return path.resolve(base, `repo-${repoId}`);
}

export async function prepareRepository(options: {
  id: number;
  gitUrl: string;
  gitBranch: string;
  tempDir: string;
}): Promise<SimpleGit> {
  await mkdir(options.tempDir, { recursive: true });
  const directory = repoWorkingDirectory(options.tempDir, options.id);
  const git = simpleGit();
  if (!(await simpleGit(directory).checkIsRepo().catch(() => false))) {
    await git.clone(options.gitUrl, directory, ['--branch', options.gitBranch, '--single-branch']);
  }
  const local = simpleGit(directory);
  await local.fetch('origin', options.gitBranch, ['--prune']);
  await local.reset(['--hard', `origin/${options.gitBranch}`]);
  return local;
}

export async function relevantCommits(
  git: SimpleGit,
  options: { lastCommit?: string | null; since: Date },
): Promise<CommitEntry[]> {
  const range = options.lastCommit ? `${options.lastCommit}..HEAD` : 'HEAD';
  const args = [
    'log',
    '--reverse',
    '--format=%H%x09%aI',
    '--diff-filter=ACMR',
    ...(options.lastCommit ? [range] : [`--after=${options.since.toISOString()}`, range]),
    '--',
    'openspec/.pipeline-state/',
  ];
  const output = await git.raw(args);
  return output
    .split('\n')
    .filter((line) => /^[a-f0-9]{40}\t/i.test(line))
    .map((line) => {
      const [sha, timestamp] = line.split('\t');
      return { sha: sha!, timestamp: new Date(timestamp!) };
    });
}
