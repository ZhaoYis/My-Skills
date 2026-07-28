import type { Repo } from '@prisma/client';
import type { SimpleGit } from 'simple-git';
import {
  type CommitEntry,
  isAncestor,
  prepareRepository,
  relevantCommits,
} from '../utils/git-helpers.js';

export const COLLECTION_BATCH_SIZE = 100;

export interface GitScanPlan {
  git: SimpleGit;
  scanFromCommit: string | null;
  scanToCommit: string;
  forcePushDetected: boolean;
  commits: CommitEntry[];
}

export async function createGitScanPlan(repo: Repo, tempDir: string): Promise<GitScanPlan> {
  const { git, remoteHead } = await prepareRepository({
    id: repo.id,
    gitUrl: repo.gitUrl,
    gitBranch: repo.gitBranch,
    tempDir,
  });
  const checkpoint = repo.lastFetchedCommit;
  const checkpointReachable = checkpoint ? await isAncestor(git, checkpoint, remoteHead) : true;
  const scanFromCommit = checkpointReachable ? checkpoint : null;
  return {
    git,
    scanFromCommit,
    scanToCommit: remoteHead,
    forcePushDetected: Boolean(checkpoint && !checkpointReachable),
    commits: await relevantCommits(git, {
      scanFrom: scanFromCommit,
      scanTo: remoteHead,
      since: repo.collectSince,
    }),
  };
}

export async function processInBatches<T>(
  items: T[],
  processItem: (item: T) => Promise<void>,
  checkpoint: (lastItem: T, completed: number, total: number) => Promise<void>,
  batchSize = COLLECTION_BATCH_SIZE,
) {
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error('batchSize must be positive');
  const total = Math.ceil(items.length / batchSize);
  for (let offset = 0; offset < items.length; offset += batchSize) {
    const batch = items.slice(offset, offset + batchSize);
    for (const item of batch) await processItem(item);
    const lastItem = batch.at(-1);
    if (lastItem !== undefined) await checkpoint(lastItem, offset / batchSize + 1, total);
  }
}
