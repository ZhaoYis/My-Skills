import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanupDirectories } from '../helpers/cleanup.js';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const scripts = path.join(PACKAGE_ROOT, 'src/templates/common/skills/opsx-dev-pipeline/scripts');
const dirs: string[] = [];

afterEach(async () => cleanupDirectories(dirs));

async function run(root: string, command: string, args: string[]) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    execFile(command, args, { cwd: root }, (error, stdout, stderr) => {
      resolve({
        code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
        stdout,
        stderr,
      });
    });
  });
}

async function git(root: string, ...args: string[]) {
  const result = await run(root, 'git', args);
  expect(result.code, result.stderr).toBe(0);
  return result.stdout.trim();
}

async function script(root: string, name: string, ...args: string[]) {
  const result = await run(root, process.execPath, [path.join(scripts, name), ...args]);
  return { code: result.code, payload: JSON.parse(result.stdout) };
}

async function repo(withCommit = true) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-evidence-'));
  dirs.push(root);
  const remote = path.join(root, 'remote.git');
  const work = path.join(root, 'work');
  await git(root, 'init', '--bare', remote);
  await git(root, 'clone', remote, work);
  await git(work, 'config', 'user.name', 'Evidence Tester');
  await git(work, 'config', 'user.email', 'evidence@example.com');
  await git(work, 'config', 'core.autocrlf', 'false');
  await fs.outputFile(path.join(work, '.gitignore'), 'openspec/.pipeline-state/\n');
  if (withCommit) {
    await git(work, 'add', '--', '.gitignore');
    await git(work, 'commit', '-m', 'chore: base');
  }
  await git(work, 'branch', '-M', 'main');
  await fs.outputFile(path.join(work, 'openspec/config.yaml'), 'schema: spec-driven\n');
  // Configuration is not an implementation file in the review fixture.
  await git(work, 'config', 'core.excludesFile', path.join(root, 'exclude'));
  await fs.outputFile(path.join(root, 'exclude'), 'openspec/config.yaml\n');
  return { work, remote };
}

async function init(work: string) {
  const result = await script(
    work,
    'dev-pipeline-state.mjs',
    'init',
    'demo-change',
    'main',
    '--skip-feature-association',
  );
  expect(result.code).toBe(0);
  return result.payload.state;
}

async function writeState(work: string, state: Record<string, unknown>) {
  await fs.outputJson(path.join(work, 'openspec/.pipeline-state/demo-change.json'), state, {
    spaces: 2,
  });
}

describe('Pipeline Git evidence', () => {
  it('reviews committed and pushed changes, worktree edits and untracked files together', async () => {
    const { work } = await repo();
    const state = await init(work);
    const base = await git(work, 'rev-parse', 'HEAD');
    expect(state.review.baseCommit).toBe(base);
    await fs.outputFile(path.join(work, 'implemented.txt'), 'implemented\n');
    await git(work, 'add', '--', 'implemented.txt');
    await git(work, 'commit', '-m', 'feat: implementation');
    await git(work, 'push', '-u', 'origin', 'main');
    await fs.appendFile(path.join(work, 'implemented.txt'), 'worktree edit\n');
    await fs.outputFile(path.join(work, 'new feature 中文.txt'), 'new implementation\n');
    const result = await script(work, 'review-scope.mjs', 'demo-change');
    expect(result.code).toBe(0);
    expect(result.payload).toMatchObject({ baseCommit: base, hasChanges: true });
    expect(result.payload.trackedFiles).toContain('implemented.txt');
    expect(result.payload.untrackedFiles).toContain('new feature 中文.txt');
    expect(result.payload.untrackedFiles).not.toContain(
      'openspec/.pipeline-state/demo-change.json',
    );
    expect(result.payload.diff).toContain('+implemented');
    expect(result.payload.diff).toContain('+worktree edit');
    expect(await git(work, 'log', '--oneline', 'origin/main..HEAD')).toBe('');
  });

  it('requires an explicit review base for legacy states and rejects unrelated history', async () => {
    const { work } = await repo();
    const state = await init(work);
    delete state.review.baseCommit;
    delete state.review.baseEmpty;
    await writeState(work, state);
    expect(await script(work, 'review-scope.mjs', 'demo-change')).toMatchObject({
      code: 4,
      payload: { reason: 'review-baseline-required' },
    });
    expect((await script(work, 'review-scope.mjs', 'demo-change', '--base', 'HEAD')).code).toBe(0);
    expect((await script(work, 'review-scope.mjs', 'demo-change', '--base', '--help')).code).toBe(
      4,
    );
    const base = await git(work, 'rev-parse', 'HEAD');
    await git(work, 'checkout', '--orphan', 'unrelated');
    await fs.outputFile(path.join(work, 'other.txt'), 'other\n');
    await git(work, 'add', '--', 'other.txt');
    await git(work, 'commit', '-m', 'chore: unrelated history');
    expect(await script(work, 'review-scope.mjs', 'demo-change', '--base', base)).toMatchObject({
      code: 4,
      payload: { reason: 'review-baseline-not-ancestor' },
    });
  });

  it('covers the first commit when Pipeline starts in an empty repository', async () => {
    const { work } = await repo(false);
    await init(work);
    await fs.outputFile(path.join(work, 'first.txt'), 'first implementation\n');
    await git(work, 'add', '--', 'first.txt');
    const before = await script(work, 'review-scope.mjs', 'demo-change');
    expect(before.code).toBe(0);
    expect(before.payload.trackedFiles).toContain('first.txt');
    await git(work, 'commit', '-m', 'feat: first implementation');
    const after = await script(work, 'review-scope.mjs', 'demo-change');
    expect(after.code).toBe(0);
    expect(after.payload.trackedFiles).toContain('first.txt');
    expect(after.payload.diff).toContain('+first implementation');
  });

  it('distinguishes a committed final state from a remotely delivered final state', async () => {
    const { work } = await repo();
    const state = await init(work);
    state.status = 'completed';
    state.decisions.postArchiveAction = 'push-only';
    state.delivery.sourcePushed = true;
    await git(work, 'push', '-u', 'origin', 'main');
    await writeState(work, state);
    await git(work, 'add', '-f', '--', 'openspec/.pipeline-state/demo-change.json');
    await git(work, 'commit', '-m', 'chore(demo-change): finalize pipeline delivery state');
    expect(await script(work, 'delivery-check.mjs', 'final-state', 'demo-change')).toMatchObject({
      code: 0,
      payload: { localCommitted: true, remoteContains: false },
    });
    await git(work, 'push', 'origin', 'main');
    expect(await script(work, 'delivery-check.mjs', 'final-state', 'demo-change')).toMatchObject({
      code: 0,
      payload: { localCommitted: true, remoteContains: true },
    });
    state.status = 'paused';
    await writeState(work, state);
    expect(
      (await script(work, 'delivery-check.mjs', 'final-state', 'demo-change')).payload
        .localCommitted,
    ).toBe(false);
  });

  it('does not trust stale tracking refs when remote final state is absent', async () => {
    const { work, remote } = await repo();
    const state = await init(work);
    const base = await git(work, 'rev-parse', 'HEAD');
    state.status = 'completed';
    state.decisions.postArchiveAction = 'push-only';
    await writeState(work, state);
    await git(work, 'add', '-f', '--', 'openspec/.pipeline-state/demo-change.json');
    await git(work, 'commit', '-m', 'chore(demo-change): finalize pipeline delivery state');
    await git(work, 'push', '-u', 'origin', 'main');
    await git(remote, 'update-ref', 'refs/heads/main', base);
    expect(await script(work, 'delivery-check.mjs', 'final-state', 'demo-change')).toMatchObject({
      code: 0,
      payload: { localCommitted: true, remoteContains: false, remoteHead: base },
    });
  });

  it('resumes a failed final-state push without rewriting the snapshot or commit', async () => {
    const { work, remote } = await repo();
    const state = await init(work);
    state.status = 'completed';
    state.decisions.postArchiveAction = 'push-only';
    state.delivery.sourcePushed = true;
    await git(work, 'push', '-u', 'origin', 'main');
    await writeState(work, state);
    await git(work, 'add', '-f', '--', 'openspec/.pipeline-state/demo-change.json');
    await git(work, 'commit', '-m', 'chore(demo-change): finalize pipeline delivery state');
    const statePath = path.join(work, 'openspec/.pipeline-state/demo-change.json');
    const snapshot = await fs.readFile(statePath, 'utf8');
    const commit = await git(work, 'rev-parse', 'HEAD');
    await git(work, 'remote', 'set-url', 'origin', path.join(work, 'missing-remote.git'));
    expect((await run(work, 'git', ['push', 'origin', 'main'])).code).not.toBe(0);
    expect(await script(work, 'delivery-check.mjs', 'final-state', 'demo-change')).toMatchObject({
      code: 5,
      payload: { reason: 'remote-query-failed' },
    });
    expect(await fs.readFile(statePath, 'utf8')).toBe(snapshot);
    await git(work, 'remote', 'set-url', 'origin', remote);
    expect(await script(work, 'delivery-check.mjs', 'final-state', 'demo-change')).toMatchObject({
      code: 0,
      payload: { localCommitted: true, remoteContains: false, finalStateCommitSha: commit },
    });
    await git(work, 'push', 'origin', 'main');
    expect(await script(work, 'delivery-check.mjs', 'final-state', 'demo-change')).toMatchObject({
      code: 0,
      payload: { localCommitted: true, remoteContains: true, finalStateCommitSha: commit },
    });
    expect(await git(work, 'rev-parse', 'HEAD')).toBe(commit);
    expect(await fs.readFile(statePath, 'utf8')).toBe(snapshot);
    expect(await git(work, 'status', '--porcelain')).toBe('');
  });

  it('supports local-only final state without a remote and reports unreachable remotes', async () => {
    const { work } = await repo();
    const state = await init(work);
    state.status = 'completed';
    state.decisions.postArchiveAction = 'local-only';
    await writeState(work, state);
    await git(work, 'add', '-f', '--', 'openspec/.pipeline-state/demo-change.json');
    await git(work, 'commit', '-m', 'chore(demo-change): finalize pipeline delivery state');
    await git(work, 'remote', 'remove', 'origin');
    expect(await script(work, 'delivery-check.mjs', 'final-state', 'demo-change')).toMatchObject({
      code: 0,
      payload: { localCommitted: true, remoteContains: null },
    });
    state.decisions.postArchiveAction = 'push-only';
    await writeState(work, state);
    expect(await script(work, 'delivery-check.mjs', 'final-state', 'demo-change')).toMatchObject({
      code: 5,
      payload: { reason: 'remote-query-failed' },
    });
  });

  for (const strategy of ['standard', 'squash', 'no-ff']) {
    it(`checks ${strategy} delivery and keeps squash source without blocking tags`, async () => {
      const { work } = await repo();
      const state = await init(work);
      await git(work, 'push', '-u', 'origin', 'main');
      await git(work, 'switch', '-c', 'feature/demo');
      await fs.outputFile(path.join(work, 'feature.txt'), 'feature\n');
      await git(work, 'add', '--', 'feature.txt');
      await git(work, 'commit', '-m', 'feat: feature');
      state.sourceBranch = 'feature/demo';
      state.targetBranch = 'main';
      state.decisions.postArchiveAction = 'merge';
      state.decisions.mergeStrategy = strategy;
      state.delivery.commitSha = await git(work, 'rev-parse', 'HEAD');
      await git(work, 'push', '-u', 'origin', 'feature/demo');
      await git(work, 'switch', 'main');
      if (strategy === 'squash') {
        await git(work, 'merge', '--squash', 'feature/demo');
        await git(work, 'commit', '-m', 'feat: squash feature');
      } else {
        await git(
          work,
          'merge',
          ...(strategy === 'no-ff' ? ['--no-ff'] : []),
          'feature/demo',
          '--no-edit',
        );
      }
      state.delivery.mergeCommitSha = await git(work, 'rev-parse', 'HEAD');
      await writeState(work, state);
      expect((await script(work, 'delivery-check.mjs', 'merge', 'demo-change')).code).toBe(11);
      await git(work, 'push', 'origin', 'main');
      expect(await script(work, 'delivery-check.mjs', 'merge', 'demo-change')).toMatchObject({
        code: 0,
        payload: { delivered: true, canDeleteLocal: strategy !== 'squash' },
      });
      await git(work, 'tag', 'delivery-test');
      expect(await git(work, 'rev-parse', 'delivery-test')).toBe(state.delivery.mergeCommitSha);
      await git(work, 'switch', 'feature/demo');
      await fs.appendFile(path.join(work, 'feature.txt'), 'new work\n');
      await git(work, 'add', '--', 'feature.txt');
      await git(work, 'commit', '-m', 'feat: new work');
      await git(work, 'switch', 'main');
      expect(await script(work, 'delivery-check.mjs', 'merge', 'demo-change')).toMatchObject({
        code: 11,
        payload: { reason: 'source-commit-changed' },
      });
      // A remote source can move independently of the local branch too.
      await git(work, 'push', 'origin', 'feature/demo');
      await git(work, 'branch', '-f', 'feature/demo', state.delivery.commitSha);
      expect(await script(work, 'delivery-check.mjs', 'merge', 'demo-change')).toMatchObject({
        code: 11,
        payload: { reason: 'source-commit-changed' },
      });
      // Cleanup may already be complete when an interrupted tagging step resumes.
      await git(work, 'push', 'origin', '--delete', 'feature/demo');
      if (strategy === 'squash') {
        // Keep the unmerged local branch; deleting it is not required for tagging.
        expect(await script(work, 'delivery-check.mjs', 'merge', 'demo-change')).toMatchObject({
          code: 0,
          payload: { delivered: true, sourceBranchExists: true, remoteSourceExists: false },
        });
      } else {
        await git(work, 'branch', '-d', 'feature/demo');
        expect(await script(work, 'delivery-check.mjs', 'merge', 'demo-change')).toMatchObject({
          code: 0,
          payload: {
            delivered: true,
            sourceBranchExists: false,
            canDeleteLocal: false,
            remoteSourceExists: false,
          },
        });
      }
      expect(await git(work, 'rev-parse', 'delivery-test')).toBe(state.delivery.mergeCommitSha);
    });
  }
});
