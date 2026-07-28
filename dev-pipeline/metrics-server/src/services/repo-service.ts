import { simpleGit } from 'simple-git';

export type RepositoryConnectionErrorCode =
  | 'authentication-failed'
  | 'repository-not-found'
  | 'branch-not-found'
  | 'connection-failed';

export class RepositoryConnectionError extends Error {
  constructor(
    readonly code: RepositoryConnectionErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'RepositoryConnectionError';
  }
}

export function classifyRepositoryConnectionFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /authentication failed|permission denied|publickey|could not read username|access denied/i.test(
      message,
    )
  ) {
    return new RepositoryConnectionError('authentication-failed', 'Git 仓库认证失败', {
      cause: error,
    });
  }
  if (
    /repository not found|not a git repository|does not appear to be a git repository/i.test(
      message,
    )
  ) {
    return new RepositoryConnectionError('repository-not-found', 'Git 仓库不存在或地址无效', {
      cause: error,
    });
  }
  return new RepositoryConnectionError('connection-failed', '无法连接 Git 仓库', { cause: error });
}

export async function testRepositoryConnection(gitUrl: string, branch: string) {
  const git = simpleGit({ timeout: { block: 15_000 } }).env('GIT_TERMINAL_PROMPT', '0');
  let output: string;
  try {
    output = await git.raw(['ls-remote', '--heads', gitUrl]);
  } catch (error) {
    throw classifyRepositoryConnectionFailure(error);
  }
  const expectedRef = `refs/heads/${branch}`;
  const match = output
    .split('\n')
    .map((line) => line.split('\t'))
    .find(([, ref]) => ref === expectedRef);
  const commit = match?.[0];
  if (!commit) {
    throw new RepositoryConnectionError('branch-not-found', `Git 分支不存在: ${branch}`);
  }
  return { status: 'connected' as const, branch, commit };
}
