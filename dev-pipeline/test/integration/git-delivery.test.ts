import { execFile } from 'node:child_process';
import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';

const createdDirs: string[] = [];

interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

afterEach(async () => {
  // Use native fs.promises.rm instead of fs-extra's remove to avoid
  // graceful-fs compat issues with Node.js ≥22 on Linux (ENOTEMPTY).
  await Promise.all(
    createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

function runGit(cwd: string, args: string[]): Promise<GitResult> {
  return new Promise((resolve) => {
    execFile('git', args, { cwd }, (error, stdout, stderr) => {
      const code = error && 'code' in error && typeof error.code === 'number' ? error.code : 0;
      resolve({ code, stdout, stderr });
    });
  });
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  const result = await runGit(cwd, args);
  if (result.code !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

async function commitFile(repo: string, file: string, content: string, message: string) {
  await fs.outputFile(path.join(repo, file), content);
  await git(repo, 'add', '--', file);
  await git(repo, 'commit', '-m', message);
}

async function createDeliveryRepo(): Promise<{ root: string; remote: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-git-delivery-'));
  createdDirs.push(root);
  const remote = path.join(root, 'remote.git');
  const repo = path.join(root, 'work');
  await git(root, 'init', '--bare', remote);
  await git(root, 'clone', remote, repo);
  await git(repo, 'config', 'core.autocrlf', 'false');
  await git(repo, 'config', 'user.name', 'Pipeline Test');
  await git(repo, 'config', 'user.email', 'pipeline@example.com');
  await commitFile(repo, 'base.txt', 'base\n', 'chore: initialize repository');
  await git(repo, 'branch', '-M', 'main');
  await git(repo, 'push', '-u', 'origin', 'main');
  await git(repo, 'switch', '-c', 'feature/demo');
  await commitFile(repo, 'source.txt', 'source\n', 'feat: add source change');
  await git(repo, 'push', '-u', 'origin', 'feature/demo');
  await git(repo, 'switch', 'main');
  await commitFile(repo, 'target.txt', 'target\n', 'chore: advance target');
  await git(repo, 'push', 'origin', 'main');
  return { root: repo, remote };
}

describe('Phase6 isolated Git delivery commands', () => {
  for (const strategy of ['standard', 'squash', 'no-ff'] as const) {
    it(`delivers with ${strategy} merge without a real remote`, async () => {
      const { root } = await createDeliveryRepo();

      if (strategy === 'standard') {
        await git(root, 'merge', 'feature/demo', '--no-edit');
      } else if (strategy === 'squash') {
        await git(root, 'merge', '--squash', 'feature/demo');
        await git(root, 'commit', '-m', 'feat: squash source change');
      } else {
        await git(root, 'merge', '--no-ff', 'feature/demo', '--no-edit');
      }

      expect(await fs.readFile(path.join(root, 'source.txt'), 'utf8')).toBe('source\n');
      expect((await runGit(root, ['diff', '--name-only', '--diff-filter=U'])).stdout).toBe('');
      expect((await runGit(root, ['push', 'origin', 'main'])).code).toBe(0);

      const ancestor = await runGit(root, ['merge-base', '--is-ancestor', 'feature/demo', 'HEAD']);
      expect(ancestor.code).toBe(strategy === 'squash' ? 1 : 0);
    });
  }

  it('lists conflicts and can abort a standard merge cleanly', async () => {
    const { root } = await createDeliveryRepo();
    await git(root, 'switch', 'feature/demo');
    await commitFile(root, 'conflict.txt', 'source\n', 'feat: source conflict');
    await git(root, 'switch', 'main');
    await commitFile(root, 'conflict.txt', 'target\n', 'chore: target conflict');

    const merge = await runGit(root, ['merge', 'feature/demo', '--no-edit']);
    expect(merge.code).not.toBe(0);
    expect(await git(root, 'diff', '--name-only', '--diff-filter=U')).toBe('conflict.txt');
    await git(root, 'merge', '--abort');
    expect(await git(root, 'status', '--porcelain')).toBe('');
    expect(await fs.readFile(path.join(root, 'conflict.txt'), 'utf8')).toBe('target\n');
  });

  it('rejects a non-fast-forward pull when local and remote target diverge', async () => {
    const { root, remote } = await createDeliveryRepo();
    const peer = path.join(path.dirname(root), 'peer');
    await git(path.dirname(root), 'clone', remote, peer);
    await git(peer, 'config', 'user.name', 'Pipeline Peer');
    await git(peer, 'config', 'user.email', 'peer@example.com');
    await git(peer, 'switch', 'main');
    await commitFile(peer, 'remote.txt', 'remote\n', 'chore: advance remote independently');
    await git(peer, 'push', 'origin', 'main');

    await commitFile(root, 'local.txt', 'local\n', 'chore: advance local independently');
    const pull = await runGit(root, ['pull', '--ff-only', 'origin', 'main']);
    expect(pull.code).not.toBe(0);
  });
});
