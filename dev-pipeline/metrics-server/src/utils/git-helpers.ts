import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { type SimpleGit, simpleGit } from 'simple-git';

export interface CommitEntry {
  sha: string;
  timestamp: Date;
}

export interface PreparedRepository {
  git: SimpleGit;
  remoteHead: string;
}

export function repoWorkingDirectory(base: string, repoId: number): string {
  return path.resolve(base, `repo-${repoId}`);
}

export async function prepareRepository(options: {
  id: number;
  gitUrl: string;
  gitBranch: string;
  tempDir: string;
}): Promise<PreparedRepository> {
  await mkdir(options.tempDir, { recursive: true });
  const directory = repoWorkingDirectory(options.tempDir, options.id);
  const git = simpleGit();
  const directoryExists = await access(directory)
    .then(() => true)
    .catch(() => false);
  const isRepository = directoryExists
    ? await simpleGit(directory)
        .checkIsRepo()
        .catch(() => false)
    : false;
  if (!isRepository) {
    await git.clone(options.gitUrl, directory, ['--branch', options.gitBranch, '--single-branch']);
  }
  const local = simpleGit(directory);
  await local.fetch('origin', options.gitBranch, ['--prune']);
  await local.reset(['--hard', `origin/${options.gitBranch}`]);
  const remoteHead = (await local.revparse([`origin/${options.gitBranch}`])).trim();
  return { git: local, remoteHead };
}

export async function isAncestor(git: SimpleGit, ancestor: string, descendant: string) {
  return git
    .raw(['merge-base', ancestor, descendant])
    .then((mergeBase) => mergeBase.trim() === ancestor)
    .catch(() => false);
}

export async function relevantCommits(
  git: SimpleGit,
  options: { scanFrom?: string | null; scanTo: string; since: Date },
): Promise<CommitEntry[]> {
  const range = options.scanFrom ? `${options.scanFrom}..${options.scanTo}` : options.scanTo;
  const args = [
    'log',
    '--reverse',
    '--format=%H%x09%aI',
    '--diff-filter=ACMR',
    ...(options.scanFrom ? [range] : [`--after=${options.since.toISOString()}`, range]),
    '--',
    'openspec/.pipeline-state/',
  ];
  const output = await git.raw(args);
  return output
    .split('\n')
    .filter((line) => /^[a-f0-9]{40}\t/i.test(line))
    .flatMap((line) => {
      const [sha, timestamp] = line.split('\t');
      return sha && timestamp ? [{ sha, timestamp: new Date(timestamp) }] : [];
    });
}
