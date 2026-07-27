import type { SimpleGit } from 'simple-git';

export interface ExtractedState {
  path: string;
  content: string;
}

export async function extractStates(git: SimpleGit, commitSha: string): Promise<ExtractedState[]> {
  const files = (
    await git.raw(['ls-tree', '-r', '--name-only', commitSha, '--', 'openspec/.pipeline-state/'])
  )
    .split('\n')
    .filter((file) => file.endsWith('.json'));
  return Promise.all(
    files.map(async (file) => ({
      path: file,
      content: await git.raw(['show', `${commitSha}:${file}`]),
    })),
  );
}
