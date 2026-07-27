import type { Repo } from '@prisma/client';
import { prepareRepository, relevantCommits } from '../utils/git-helpers.js';
import { extractStates } from './state-extractor.js';

export async function collectGitSnapshots(repo: Repo, tempDir: string) {
  const git = await prepareRepository({
    id: repo.id,
    gitUrl: repo.gitUrl,
    gitBranch: repo.gitBranch,
    tempDir,
  });
  const commits = await relevantCommits(git, {
    lastCommit: repo.lastFetchedCommit,
    since: repo.collectSince,
  });
  const batches = [];
  for (const commit of commits) {
    batches.push({ commit, states: await extractStates(git, commit.sha) });
  }
  return batches;
}
