import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { simpleGit } from 'simple-git';

export async function createGitRepositoryFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'metrics-git-'));
  const source = path.join(root, 'source');
  const remote = path.join(root, 'remote.git');
  const collector = path.join(root, 'collector');
  await Promise.all([mkdir(source, { recursive: true }), mkdir(remote, { recursive: true })]);
  await simpleGit(remote).init(true);
  const git = simpleGit(source);
  await git.init();
  await git.addConfig('user.name', 'Metrics Test');
  await git.addConfig('user.email', 'metrics-test@example.invalid');

  async function commit(relativePath: string, content: string, message: string) {
    const target = path.join(source, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
    await git.add(relativePath);
    await git.commit(message);
    return (await git.revparse(['HEAD'])).trim();
  }

  await commit('README.md', 'fixture\n', 'initial fixture');
  await git.raw(['branch', '-M', 'main']);
  await git.addRemote('origin', remote);
  await git.raw(['push', '-u', 'origin', 'main']);

  return {
    root,
    source,
    remote,
    collector,
    git,
    commit,
    async push(force = false) {
      await git.raw(['push', ...(force ? ['--force'] : []), 'origin', 'HEAD:main']);
    },
    async rewrite(relativePath: string, content: string) {
      await git.raw(['checkout', '--orphan', 'rewritten']);
      for (const entry of await readdir(source)) {
        if (entry !== '.git') await rm(path.join(source, entry), { recursive: true, force: true });
      }
      await commit(relativePath, content, 'rewritten history');
      await git.raw(['push', '--force', 'origin', 'HEAD:main']);
    },
    async cleanup() {
      await rm(root, { recursive: true, force: true });
    },
  };
}
